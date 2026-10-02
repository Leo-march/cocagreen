"""Train and evaluate a Portuguese failure classifier from the two Excel files."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import FeatureUnion, Pipeline


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = SCRIPT_DIR / "planilhas treinamento"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "resultado_modelo_falhas"
INPUT_FILES = (
    "apontamentos Jundiai.xlsx",
    "Classificação dos Apontamentos - Marília.xlsx",
)
OBSERVATION_HEADERS = {"observacao", "observacoes", "observation", "observations"}
CLASSIFICATION_HEADERS = {
    "classificacao",
    "classificacoes",
    "classification",
    "label",
    "categoria",
}


def normalize_header(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", "", text.casefold())


def normalize_label(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


def clean_observation(value: object) -> str:
    """Remove common noise while preserving Portuguese letters, numbers and words."""
    text = unicodedata.normalize("NFKC", html.unescape(str(value))).casefold()
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"_+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def find_column(columns: list[object], accepted_names: set[str], path: Path) -> object:
    for column in columns:
        if normalize_header(column) in accepted_names:
            return column
    expected = "Observações" if accepted_names == OBSERVATION_HEADERS else "Classificação"
    raise ValueError(f"A planilha '{path.name}' precisa conter a coluna '{expected}'.")


def load_workbook(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Planilha não encontrada: {path}")

    source = pd.read_excel(path, dtype=str)
    observation_column = find_column(list(source.columns), OBSERVATION_HEADERS, path)
    classification_column = find_column(list(source.columns), CLASSIFICATION_HEADERS, path)
    return pd.DataFrame(
        {
            "observation": source[observation_column],
            "classification": source[classification_column],
            "source": path.stem,
        }
    )


def load_training_data(data_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    sheets = [load_workbook(data_dir / filename) for filename in INPUT_FILES]
    data = pd.concat(sheets, ignore_index=True)
    total_rows = len(data)
    source_input_rows = data.groupby("source").size().to_dict()

    data["observation"] = data["observation"].fillna("").astype(str).str.strip()
    data["classification"] = data["classification"].fillna("").astype(str).str.strip()
    missing_observation = data["observation"].eq("")
    missing_classification = data["classification"].eq("")
    missing_rows = missing_observation | missing_classification
    missing_rows_by_source = data.loc[missing_rows].groupby("source").size().to_dict()
    data = data.loc[~missing_rows].copy()

    data["text"] = data["observation"].map(clean_observation)
    data["label"] = data["classification"].map(normalize_label)
    empty_after_cleaning = data["text"].eq("")
    empty_after_cleaning_by_source = data.loc[empty_after_cleaning].groupby("source").size().to_dict()
    data = data.loc[data["text"].ne("") & data["label"].ne("")].copy()

    # Remove exact duplicate examples, but keep the same observation with distinct labels.
    duplicate_rows = data.duplicated(subset=["text", "label"], keep="first")
    duplicate_rows_by_source = data.loc[duplicate_rows].groupby("source").size().to_dict()
    data = data.loc[~duplicate_rows].reset_index(drop=True)

    # Preserve conflicting labels, then keep all variants of each note in one split.
    conflicting_texts = data.groupby("text")["label"].nunique().loc[lambda counts: counts > 1].index
    conflicting_rows = data["text"].isin(conflicting_texts)
    conflicting_row_count = int(conflicting_rows.sum())

    label_names = (
        pd.concat([sheet[["classification"]] for sheet in sheets], ignore_index=True)
        .dropna()["classification"]
        .astype(str)
        .str.strip()
    )
    label_names = label_names.loc[label_names.ne("")]
    label_lookup = (
        pd.DataFrame({"display": label_names, "label": label_names.map(normalize_label)})
        .groupby(["label", "display"])
        .size()
        .reset_index(name="count")
        .sort_values(["label", "count", "display"], ascending=[True, False, True])
        .drop_duplicates("label")
        .set_index("label")["display"]
        .to_dict()
    )
    data["label_display"] = data["label"].map(label_lookup)

    source_stats = {}
    surviving_counts = data.groupby("source").size().to_dict()
    source_names = [sheet["source"].iloc[0] for sheet in sheets]
    for source in source_names:
        source_stats[source] = {
            "input_rows": int(source_input_rows[source]),
            "missing_rows": int(missing_rows_by_source.get(source, 0)),
            "empty_after_text_cleaning": int(empty_after_cleaning_by_source.get(source, 0)),
            "duplicate_rows_removed": int(duplicate_rows_by_source.get(source, 0)),
            "usable_training_rows": int(surviving_counts.get(source, 0)),
        }

    stats = {
        "input_rows": total_rows,
        "sources": source_stats,
        "discarded_missing_observation_or_label": int(missing_rows.sum()),
        "empty_after_text_cleaning": int(empty_after_cleaning.sum()),
        "conflicting_observation_texts": int(len(conflicting_texts)),
        "conflicting_rows_preserved": conflicting_row_count,
        "duplicate_rows_removed": int(duplicate_rows.sum()),
        "usable_training_rows": int(len(data)),
        "classes": int(data["label"].nunique()),
    }
    if data["label"].nunique() < 2:
        raise ValueError("São necessárias pelo menos duas classificações válidas para treinar o modelo.")
    return data, stats


def build_model() -> Pipeline:
    # Word n-grams capture meaning; character n-grams help with abbreviations and typos.
    text_features = FeatureUnion(
        [
            (
                "word",
                TfidfVectorizer(
                    strip_accents="unicode",
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    max_features=120_000,
                ),
            ),
            (
                "character",
                TfidfVectorizer(
                    analyzer="char_wb",
                    strip_accents="unicode",
                    ngram_range=(3, 5),
                    min_df=2,
                    sublinear_tf=True,
                    max_features=180_000,
                ),
            ),
        ]
    )
    return Pipeline(
        [
            ("features", text_features),
            (
                "classifier",
                LogisticRegression(
                    C=4.0,
                    class_weight="balanced",
                    max_iter=1_500,
                    solver="lbfgs",
                ),
            ),
        ]
    )


def evaluate_model(
    model: Pipeline,
    test_data: pd.DataFrame,
    all_labels: list[str],
    output_dir: Path,
) -> dict[str, Any]:
    expected = test_data["label"].to_numpy()
    predicted = model.predict(test_data["text"])
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected,
        predicted,
        average="macro",
        zero_division=0,
    )
    weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
        expected,
        predicted,
        average="weighted",
        zero_division=0,
    )
    metrics = {
        "accuracy": float(accuracy_score(expected, predicted)),
        "macro_precision": float(precision),
        "macro_recall": float(recall),
        "macro_f1": float(f1),
        "weighted_precision": float(weighted_precision),
        "weighted_recall": float(weighted_recall),
        "weighted_f1": float(weighted_f1),
    }

    per_class_precision, per_class_recall, per_class_f1, support = precision_recall_fscore_support(
        expected,
        predicted,
        labels=all_labels,
        zero_division=0,
    )
    pd.DataFrame(
        {
            "class": [test_data.attrs["label_lookup"][label] for label in all_labels],
            "precision": per_class_precision,
            "recall": per_class_recall,
            "f1_score": per_class_f1,
            "support": support,
        }
    ).to_csv(output_dir / "metricas_por_classe.csv", index=False)

    matrix = confusion_matrix(expected, predicted, labels=all_labels)
    label_names = [test_data.attrs["label_lookup"][label] for label in all_labels]
    pd.DataFrame(matrix, index=label_names, columns=label_names).rename_axis(
        "classificacao_real"
    ).to_csv(output_dir / "matriz_confusao.csv")

    predictions = test_data[["source", "observation", "label_display"]].copy()
    predictions = predictions.rename(columns={"label_display": "classificacao_real"})
    predictions["classificacao_prevista"] = [
        test_data.attrs["label_lookup"][label] for label in predicted
    ]
    predictions["correta"] = expected == predicted
    predictions.to_csv(output_dir / "previsoes_teste.csv", index=False)

    source_metrics = []
    for source, group in predictions.groupby("source"):
        source_expected = group["classificacao_real"]
        source_predicted = group["classificacao_prevista"]
        source_precision, source_recall, source_f1, _ = precision_recall_fscore_support(
            source_expected,
            source_predicted,
            average="macro",
            zero_division=0,
        )
        weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
            source_expected,
            source_predicted,
            average="weighted",
            zero_division=0,
        )
        source_metrics.append(
            {
                "origem": source,
                "amostras_teste": int(len(group)),
                "acuracia": float(accuracy_score(source_expected, source_predicted)),
                "precisao_macro": float(source_precision),
                "recall_macro": float(source_recall),
                "f1_macro": float(source_f1),
                "precisao_ponderada": float(weighted_precision),
                "recall_ponderado": float(weighted_recall),
                "f1_ponderado": float(weighted_f1),
            }
        )
    pd.DataFrame(source_metrics).to_csv(output_dir / "metricas_por_origem.csv", index=False)
    metrics["metrics_by_source"] = source_metrics
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Treina e avalia um classificador de falhas usando as planilhas de Jundiaí e Marília."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Pasta que contém as duas planilhas de treinamento.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Pasta onde serão salvos métricas, matriz, previsões e modelo.",
    )
    parser.add_argument("--test-size", type=float, default=0.2, help="Proporção reservada para teste (padrão: 0.2).")
    parser.add_argument("--random-state", type=int, default=42, help="Semente para reproduzir a divisão.")
    args = parser.parse_args()

    if not 0 < args.test_size < 1:
        parser.error("--test-size precisa ser maior que 0 e menor que 1.")

    data, data_stats = load_training_data(args.data_dir)
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=args.test_size,
        random_state=args.random_state,
    )
    train_indices, test_indices = next(
        splitter.split(data["text"], data["label"], groups=data["text"])
    )
    train_data = data.iloc[train_indices].copy()
    test_data = data.iloc[test_indices].copy()
    all_labels = sorted(data["label"].unique())
    label_lookup = data.drop_duplicates("label").set_index("label")["label_display"].to_dict()
    test_data.attrs["label_lookup"] = label_lookup

    evaluation_model = build_model()
    evaluation_model.fit(train_data["text"], train_data["label"])
    args.output_dir.mkdir(parents=True, exist_ok=True)

    metrics = evaluate_model(evaluation_model, test_data, all_labels, args.output_dir)

    # Evaluate on the held-out split, then train the deployable model on every valid row.
    production_model = build_model()
    production_model.fit(data["text"], data["label"])
    model_path = args.output_dir / "modelo_classificacao_apontamentos.joblib"
    joblib.dump(
        {
            "pipeline": production_model,
            "label_lookup": label_lookup,
            "classes": all_labels,
        },
        model_path,
    )

    metrics_output = {
        **data_stats,
        "source_fingerprints": {
            filename: hashlib.sha256((args.data_dir / filename).read_bytes()).hexdigest()
            for filename in INPUT_FILES
        },
        "model_version": 2,
        "train_rows": int(len(train_data)),
        "test_rows": int(len(test_data)),
        "test_actual_proportion": float(len(test_data) / len(data)),
        "production_training_rows": int(len(data)),
        "test_proportion": args.test_size,
        "random_state": args.random_state,
        "classes": len(all_labels),
        **metrics,
        "confusion_matrix_csv": "matriz_confusao.csv",
        "per_class_metrics_csv": "metricas_por_classe.csv",
        "test_predictions_csv": "previsoes_teste.csv",
        "trained_model": model_path.name,
    }
    (args.output_dir / "metricas.json").write_text(
        json.dumps(metrics_output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Registros válidos e deduplicados: {data_stats['usable_training_rows']}")
    print(
        "Descartados: {discarded_missing_observation_or_label} sem texto/rótulo, "
        "{duplicate_rows_removed} duplicados exatos. "
        "Observações com rótulos divergentes preservadas: {conflicting_rows_preserved}.".format(**data_stats)
    )
    print(
        f"Avaliação: {len(train_data)} treino / {len(test_data)} teste "
        f"(proporção teste: {len(test_data) / len(data):.1%})"
    )
    print(f"Modelo final treinado com todos os {len(data)} registros válidos.")
    print(f"Classes distintas: {len(all_labels)}")
    print(f"Acurácia: {metrics['accuracy']:.4f}")
    print(
        "Precisão macro: {macro_precision:.4f} | Recall macro: {macro_recall:.4f} | "
        "F1 macro: {macro_f1:.4f}".format(**metrics)
    )
    print(
        "Precisão ponderada: {weighted_precision:.4f} | Recall ponderado: {weighted_recall:.4f} | "
        "F1 ponderado: {weighted_f1:.4f}".format(**metrics)
    )
    print(f"Matriz de confusão: {args.output_dir / 'matriz_confusao.csv'}")
    print(f"Métricas por classe: {args.output_dir / 'metricas_por_classe.csv'}")
    print(f"Métricas por origem: {args.output_dir / 'metricas_por_origem.csv'}")
    print(f"Modelo treinado: {model_path}")


if __name__ == "__main__":
    main()
