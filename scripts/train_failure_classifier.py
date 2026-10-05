"""Train and evaluate a Portuguese failure classifier from historical Excel files."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.base import clone
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    precision_score,
    recall_score,
)
from sklearn.model_selection import (
    GridSearchCV,
    GroupShuffleSplit,
    StratifiedGroupKFold,
)
from sklearn.metrics import make_scorer
from sklearn.naive_bayes import ComplementNB
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.linear_model import LogisticRegression


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = SCRIPT_DIR / ".planilhas treinamento"
LEGACY_DATA_DIR = SCRIPT_DIR / "planilhas treinamento"
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
MODEL_VERSION = 4
CONFIDENCE_REVIEW_THRESHOLD = 0.60
SIMILAR_TEXT_THRESHOLD = 0.92
SPLIT_GROUP_THRESHOLD = 0.97
SIMILAR_LABEL_THRESHOLD = 0.82


def normalize_header(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", "", text.casefold())


def normalize_label(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


def clean_observation(value: object) -> str:
    """Remove markup and noise without discarding technical punctuation or digits."""
    text = unicodedata.normalize("NFKC", html.unescape(str(value))).casefold()
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"[^\w\s+#./-]", " ", text, flags=re.UNICODE)
    text = re.sub(r"(?<!\w)[+#./-]+|[+#./-]+(?!\w)", " ", text)
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


def load_approved_feedback(path: Path | None) -> pd.DataFrame:
    if path is None:
        return pd.DataFrame(columns=["observation", "classification", "source"])
    if not path.is_file():
        raise FileNotFoundError(f"Arquivo temporário de correções aprovadas não encontrado: {path}")

    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("As correções aprovadas precisam estar em uma lista JSON.")
    if any(
        not isinstance(row, dict)
        or not isinstance(row.get("observation"), str)
        or not isinstance(row.get("reviewed_label"), str)
        for row in rows
    ):
        raise ValueError("Há uma correção aprovada sem observação ou classificação revisada.")
    return pd.DataFrame(
        {
            "observation": [row["observation"] for row in rows],
            "classification": [row["reviewed_label"] for row in rows],
            "source": "Correções humanas aprovadas",
        }
    )


def load_training_data(
    data_dir: Path,
    feedback_path: Path | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    if not data_dir.is_dir() and data_dir == DEFAULT_DATA_DIR and LEGACY_DATA_DIR.is_dir():
        data_dir = LEGACY_DATA_DIR
    if not data_dir.is_dir():
        raise FileNotFoundError(
            "Pasta das planilhas de treinamento não encontrada. "
            f"Verifique '{DEFAULT_DATA_DIR}' ou '{LEGACY_DATA_DIR}'."
        )

    sheets = [load_workbook(data_dir / filename) for filename in INPUT_FILES]
    feedback = load_approved_feedback(feedback_path)
    data = pd.concat([*sheets, feedback], ignore_index=True)
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

    correction_source = "Correções humanas aprovadas"
    feedback_mask = data["source"].eq(correction_source)
    feedback_label_counts = data.loc[feedback_mask].groupby("text")["label"].nunique()
    conflicting_feedback_texts = feedback_label_counts.loc[feedback_label_counts > 1].index
    if len(conflicting_feedback_texts):
        raise ValueError(
            f"Há {len(conflicting_feedback_texts)} observação(ões) com correções aprovadas conflitantes; "
            "resolva-as na fila antes de treinar."
        )
    feedback_texts = set(data.loc[feedback_mask, "text"])
    superseded_rows = ~feedback_mask & data["text"].isin(feedback_texts)
    superseded_rows_by_source = data.loc[superseded_rows].groupby("source").size().to_dict()
    superseded_count = int(superseded_rows.sum())
    data = data.loc[~superseded_rows].copy()

    duplicate_rows = data.duplicated(subset=["text", "label"], keep="first")
    duplicate_rows_by_source = data.loc[duplicate_rows].groupby("source").size().to_dict()
    data = data.loc[~duplicate_rows].reset_index(drop=True)

    conflicting_texts = data.groupby("text")["label"].nunique().loc[lambda counts: counts > 1].index
    conflicting_rows = data["text"].isin(conflicting_texts)
    conflicting_row_count = int(conflicting_rows.sum())

    display_rows = pd.concat(
        [sheet[["classification"]] for sheet in sheets] + [feedback[["classification"]]],
        ignore_index=True,
    )
    label_names = display_rows["classification"].dropna().astype(str).str.strip()
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
    if not feedback.empty:
        source_names.append("Correções humanas aprovadas")
    for source in source_names:
        source_stats[source] = {
            "input_rows": int(source_input_rows.get(source, 0)),
            "missing_rows": int(missing_rows_by_source.get(source, 0)),
            "empty_after_text_cleaning": int(empty_after_cleaning_by_source.get(source, 0)),
            "rows_superseded_by_approved_feedback": int(superseded_rows_by_source.get(source, 0)),
            "duplicate_rows_removed": int(duplicate_rows_by_source.get(source, 0)),
            "usable_training_rows": int(surviving_counts.get(source, 0)),
        }

    label_counts = data["label"].value_counts()
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
        "classes_with_one_record": int((label_counts == 1).sum()),
        "classes_with_fewer_than_three_records": int((label_counts < 3).sum()),
        "classes_with_fewer_than_five_records": int((label_counts < 5).sum()),
        "approved_feedback_rows": int(len(feedback)),
        "historical_rows_superseded_by_approved_feedback": superseded_count,
    }
    if data["label"].nunique() < 2:
        raise ValueError("São necessárias pelo menos duas classificações válidas para treinar o modelo.")
    return data, stats


def make_union_find(size: int) -> tuple[Any, Any]:
    parent = list(range(size))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(first: int, second: int) -> None:
        first_root = find(first)
        second_root = find(second)
        if first_root != second_root:
            parent[second_root] = first_root

    return find, union


def group_similar_observations(data: pd.DataFrame, output_dir: Path) -> tuple[list[int], int]:
    """Keep exact and near-identical notes together; report near matches without deleting them."""
    count = len(data)
    if count < 2:
        return list(range(count)), 0

    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=2,
        max_features=50_000,
    )
    features = vectorizer.fit_transform(data["text"])
    neighbors = NearestNeighbors(
        n_neighbors=min(8, count),
        metric="cosine",
        algorithm="brute",
        n_jobs=1,
    )
    neighbors.fit(features)
    distances, indices = neighbors.kneighbors(features, return_distance=True)

    find, union = make_union_find(count)
    similar_rows: list[dict[str, Any]] = []
    seen_pairs: set[tuple[int, int]] = set()
    labels = data["label"].tolist()
    displays = data["label_display"].tolist()
    texts = data["observation"].tolist()

    for row_index, (row_distances, row_indices) in enumerate(zip(distances, indices)):
        for distance, neighbor_index in zip(row_distances, row_indices):
            neighbor_index = int(neighbor_index)
            if row_index == neighbor_index:
                continue
            similarity = float(1.0 - distance)
            pair = tuple(sorted((row_index, neighbor_index)))
            if similarity >= SPLIT_GROUP_THRESHOLD:
                union(*pair)
            if similarity >= SIMILAR_TEXT_THRESHOLD and pair not in seen_pairs:
                seen_pairs.add(pair)
                similar_rows.append(
                    {
                        "similarity": similarity,
                        "same_class": labels[row_index] == labels[neighbor_index],
                        "class_a": displays[row_index],
                        "class_b": displays[neighbor_index],
                        "observation_a": texts[row_index],
                        "observation_b": texts[neighbor_index],
                    }
                )

    if similar_rows:
        pd.DataFrame(similar_rows).sort_values(
            "similarity", ascending=False
        ).to_csv(output_dir / "observacoes_semelhantes.csv", index=False)
    else:
        pd.DataFrame(
            columns=[
                "similarity",
                "same_class",
                "class_a",
                "class_b",
                "observation_a",
                "observation_b",
            ]
        ).to_csv(output_dir / "observacoes_semelhantes.csv", index=False)

    return [find(index) for index in range(count)], len(similar_rows)


def audit_similar_labels(data: pd.DataFrame, output_dir: Path) -> int:
    labels = sorted(data["label"].unique())
    if len(labels) < 2:
        return 0

    displays = data.drop_duplicates("label").set_index("label")["label_display"].to_dict()
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
    features = vectorizer.fit_transform([displays[label] for label in labels])
    neighbors = NearestNeighbors(
        n_neighbors=min(4, len(labels)),
        metric="cosine",
        algorithm="brute",
        n_jobs=1,
    )
    neighbors.fit(features)
    distances, indices = neighbors.kneighbors(features, return_distance=True)
    pairs: dict[tuple[int, int], float] = {}
    for index, (row_distances, row_indices) in enumerate(zip(distances, indices)):
        for distance, neighbor_index in zip(row_distances, row_indices):
            neighbor_index = int(neighbor_index)
            if index == neighbor_index:
                continue
            similarity = float(1.0 - distance)
            if similarity < SIMILAR_LABEL_THRESHOLD:
                continue
            pair = tuple(sorted((index, neighbor_index)))
            pairs[pair] = max(pairs.get(pair, 0.0), similarity)

    rows = [
        {
            "similarity": similarity,
            "classification_a": displays[labels[first]],
            "classification_b": displays[labels[second]],
            "records_a": int((data["label"] == labels[first]).sum()),
            "records_b": int((data["label"] == labels[second]).sum()),
        }
        for (first, second), similarity in sorted(
            pairs.items(), key=lambda pair: pair[1], reverse=True
        )
    ]
    pd.DataFrame(
        rows,
        columns=["similarity", "classification_a", "classification_b", "records_a", "records_b"],
    ).to_csv(output_dir / "classificacoes_semelhantes.csv", index=False)
    return len(rows)


def build_model(classifier: Any) -> Pipeline:
    text_features = FeatureUnion(
        [
            (
                "word",
                TfidfVectorizer(
                    strip_accents="unicode",
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    max_features=100_000,
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
                    max_features=150_000,
                ),
            ),
        ]
    )
    return Pipeline([("features", text_features), ("classifier", classifier)])


def build_searches(random_state: int) -> list[tuple[str, GridSearchCV]]:
    cv = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=random_state)
    scoring = {
        "accuracy": "accuracy",
        "precision_macro": make_scorer(precision_score, average="macro", zero_division=0),
        "recall_macro": make_scorer(recall_score, average="macro", zero_division=0),
        "f1_macro": make_scorer(f1_score, average="macro", zero_division=0),
        "f1_weighted": make_scorer(f1_score, average="weighted", zero_division=0),
    }
    return [
        (
            "Regressão Logística",
            GridSearchCV(
                build_model(LogisticRegression(
                    class_weight="balanced",
                    max_iter=1_000,
                    solver="lbfgs",
                )),
                {"classifier__C": [0.5, 2.0]},
                scoring=scoring,
                refit="f1_macro",
                cv=cv,
                n_jobs=1,
                return_train_score=True,
                error_score="raise",
            ),
        ),
        (
            "Complement Naive Bayes",
            GridSearchCV(
                build_model(ComplementNB()),
                {"classifier__alpha": [0.1, 1.0]},
                scoring=scoring,
                refit="f1_macro",
                cv=cv,
                n_jobs=1,
                return_train_score=True,
                error_score="raise",
            ),
        ),
    ]


def score_predictions(expected: Any, predicted: Any) -> dict[str, float]:
    precision, recall, macro_f1, _ = precision_recall_fscore_support(
        expected, predicted, average="macro", zero_division=0
    )
    weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
        expected, predicted, average="weighted", zero_division=0
    )
    return {
        "accuracy": float(accuracy_score(expected, predicted)),
        "macro_precision": float(precision),
        "macro_recall": float(recall),
        "macro_f1": float(macro_f1),
        "weighted_precision": float(weighted_precision),
        "weighted_recall": float(weighted_recall),
        "weighted_f1": float(weighted_f1),
    }


def evaluate_model(
    model: Pipeline,
    test_data: pd.DataFrame,
    all_labels: list[str],
    label_lookup: dict[str, str],
    output_dir: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    expected = test_data["label"].to_numpy()
    predicted = model.predict(test_data["text"])
    probabilities = model.predict_proba(test_data["text"])
    confidence = probabilities.max(axis=1)
    metrics = score_predictions(expected, predicted)

    per_class_precision, per_class_recall, per_class_f1, support = precision_recall_fscore_support(
        expected,
        predicted,
        labels=all_labels,
        zero_division=0,
    )
    per_class = pd.DataFrame(
        {
            "class": [label_lookup[label] for label in all_labels],
            "precision": per_class_precision,
            "recall": per_class_recall,
            "f1_score": per_class_f1,
            "support": support,
        }
    )
    per_class.to_csv(output_dir / "metricas_por_classe.csv", index=False)

    matrix = confusion_matrix(expected, predicted, labels=all_labels)
    label_names = [label_lookup[label] for label in all_labels]
    pd.DataFrame(matrix, index=label_names, columns=label_names).rename_axis(
        "classificacao_real"
    ).to_csv(output_dir / "matriz_confusao.csv")

    predictions = test_data[["source", "observation", "label_display"]].copy()
    predictions = predictions.rename(columns={"label_display": "classificacao_real"})
    predictions["classificacao_prevista"] = [label_lookup[label] for label in predicted]
    predictions["confianca"] = confidence
    predictions["revisar_manualmente"] = confidence < CONFIDENCE_REVIEW_THRESHOLD
    predictions["correta"] = expected == predicted
    predictions.to_csv(output_dir / "previsoes_teste.csv", index=False)
    predictions.loc[~predictions["correta"]].to_csv(output_dir / "erros_teste.csv", index=False)

    confusion_counts = Counter(
        (label_lookup[actual], label_lookup[guess])
        for actual, guess in zip(expected, predicted)
        if actual != guess
    )
    top_confusions = [
        {"classificacao_real": actual, "classificacao_prevista": guess, "ocorrencias": count}
        for (actual, guess), count in confusion_counts.most_common(20)
    ]
    pd.DataFrame(
        top_confusions,
        columns=["classificacao_real", "classificacao_prevista", "ocorrencias"],
    ).to_csv(output_dir / "principais_confusoes.csv", index=False)

    source_metrics = []
    for source, group in predictions.groupby("source"):
        source_expected = group["classificacao_real"]
        source_predicted = group["classificacao_prevista"]
        source_metrics.append(
            {
                "origem": source,
                "amostras_teste": int(len(group)),
                **score_predictions(source_expected, source_predicted),
            }
        )
    pd.DataFrame(source_metrics).to_csv(output_dir / "metricas_por_origem.csv", index=False)

    worst_classes = per_class.loc[per_class["support"] > 0].sort_values(
        ["f1_score", "support"], ascending=[True, False]
    ).head(10)
    difficult_classes = [
        {
            "classificacao": str(row["class"]),
            "f1": float(row["f1_score"]),
            "recall": float(row["recall"]),
            "support": int(row["support"]),
        }
        for _, row in worst_classes.iterrows()
    ]
    error_words = Counter(
        token
        for text in predictions.loc[~predictions["correta"], "observation"]
        for token in re.findall(r"\b[\w+#./-]{3,}\b", clean_observation(text))
    )
    pd.DataFrame(
        [{"termo": word, "ocorrencias_em_erros": count} for word, count in error_words.most_common(30)]
    ).to_csv(output_dir / "termos_frequentes_em_erros.csv", index=False)

    metrics["metrics_by_source"] = source_metrics
    metrics["top_confusions"] = top_confusions
    metrics["difficult_classes"] = difficult_classes
    metrics["test_low_confidence_rows"] = int(
        (predictions["confianca"] < CONFIDENCE_REVIEW_THRESHOLD).sum()
    )
    return metrics, source_metrics


def get_previous_metrics(metrics_path: Path) -> dict[str, Any] | None:
    if not metrics_path.is_file():
        return None
    try:
        payload = json.loads(metrics_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Treina e avalia um classificador de falhas com as planilhas históricas e correções aprovadas."
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--feedback-file", type=Path)
    parser.add_argument("--feedback-fingerprint", default="")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    if not 0 < args.test_size < 1:
        parser.error("--test-size precisa ser maior que 0 e menor que 1.")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = args.output_dir / "metricas.json"
    history_path = args.output_dir / "historico_modelos.json"
    model_path = args.output_dir / "modelo_classificacao_apontamentos.joblib"
    candidate_path = args.output_dir / "modelo_classificacao_candidato.joblib"
    previous_metrics = get_previous_metrics(metrics_path)

    data, data_stats = load_training_data(args.data_dir, args.feedback_file)
    groups, near_duplicate_pairs = group_similar_observations(data, args.output_dir)
    similar_label_pairs = audit_similar_labels(data, args.output_dir)
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=args.test_size,
        random_state=args.random_state,
    )
    train_indices, test_indices = next(
        splitter.split(data["text"], data["label"], groups=groups)
    )
    train_data = data.iloc[train_indices].copy()
    test_data = data.iloc[test_indices].copy()
    train_groups = [groups[index] for index in train_indices]
    if set(train_groups).intersection(groups[index] for index in test_indices):
        raise RuntimeError("A divisão de treino/teste separou observações do mesmo grupo.")
    all_labels = sorted(data["label"].unique())
    label_lookup = data.drop_duplicates("label").set_index("label")["label_display"].to_dict()

    unique_train_groups = len(set(train_groups))
    if unique_train_groups < 3:
        raise ValueError("São necessários pelo menos três grupos de observações para a validação cruzada.")

    comparison = []
    searches = build_searches(args.random_state)
    for algorithm, search in searches:
        search.fit(train_data["text"], train_data["label"], groups=train_groups)
        results = search.cv_results_
        best_index = int(search.best_index_)
        train_macro_f1 = float(results["mean_train_f1_macro"][best_index])
        cv_macro_f1 = float(results["mean_test_f1_macro"][best_index])
        comparison.append(
            {
                "algorithm": algorithm,
                "best_parameters": search.best_params_,
                "cv_accuracy_mean": float(results["mean_test_accuracy"][best_index]),
                "cv_accuracy_std": float(results["std_test_accuracy"][best_index]),
                "cv_precision_macro_mean": float(results["mean_test_precision_macro"][best_index]),
                "cv_precision_macro_std": float(results["std_test_precision_macro"][best_index]),
                "cv_recall_macro_mean": float(results["mean_test_recall_macro"][best_index]),
                "cv_recall_macro_std": float(results["std_test_recall_macro"][best_index]),
                "cv_f1_macro_mean": cv_macro_f1,
                "cv_f1_macro_std": float(results["std_test_f1_macro"][best_index]),
                "cv_f1_weighted_mean": float(results["mean_test_f1_weighted"][best_index]),
                "cv_f1_weighted_std": float(results["std_test_f1_weighted"][best_index]),
                "train_f1_macro_mean": train_macro_f1,
                "train_validation_f1_gap": train_macro_f1 - cv_macro_f1,
                "best_estimator": search.best_estimator_,
            }
        )

    comparison.sort(key=lambda entry: entry["cv_f1_macro_mean"], reverse=True)
    selected = comparison[0]
    evaluation_model = selected["best_estimator"]
    comparison_summary = [
        {key: value for key, value in candidate.items() if key != "best_estimator"}
        for candidate in comparison
    ]
    metrics, _ = evaluate_model(
        evaluation_model,
        test_data,
        all_labels,
        label_lookup,
        args.output_dir,
    )
    metrics["model_comparison"] = comparison_summary

    production_model = build_model(evaluation_model.named_steps["classifier"])
    production_model.fit(data["text"], data["label"])
    joblib.dump(
        {
            "pipeline": production_model,
            "label_lookup": label_lookup,
            "classes": all_labels,
            "algorithm": selected["algorithm"],
            "confidence_review_threshold": CONFIDENCE_REVIEW_THRESHOLD,
            "model_version": MODEL_VERSION,
        },
        candidate_path,
    )

    current_fingerprints = {
        filename: hashlib.sha256((args.data_dir / filename).read_bytes()).hexdigest()
        for filename in INPUT_FILES
    }
    current_fingerprints["correcoes_aprovadas"] = args.feedback_fingerprint
    active_evaluation = None
    if model_path.is_file():
        active_artifact = joblib.load(model_path)
        active_pipeline = active_artifact.get("pipeline") if isinstance(active_artifact, dict) else None
        if not isinstance(active_pipeline, Pipeline):
            raise ValueError("O modelo ativo não contém um pipeline compatível para comparação.")
        active_evaluation_model = clone(active_pipeline)
        active_evaluation_model.fit(train_data["text"], train_data["label"])
        active_scores = score_predictions(
            test_data["label"],
            active_evaluation_model.predict(test_data["text"]),
        )
        active_algorithm = active_artifact.get("algorithm")
        if not active_algorithm:
            active_classifier = active_pipeline.named_steps.get("classifier")
            if isinstance(active_classifier, LogisticRegression):
                active_algorithm = "Regressão Logística"
            elif isinstance(active_classifier, ComplementNB):
                active_algorithm = "Complement Naive Bayes"
            else:
                previous_active = (previous_metrics or {}).get("active_model") or {}
                active_algorithm = (
                    previous_active.get("algorithm")
                    or (previous_metrics or {}).get("selected_algorithm")
                    or "Modelo ativo"
                )
        active_evaluation = {
            "algorithm": active_algorithm,
            "accuracy": active_scores["accuracy"],
            "macro_f1": active_scores["macro_f1"],
            "weighted_f1": active_scores["weighted_f1"],
        }
    candidate_metrics = {
        **data_stats,
        **metrics,
        "source_fingerprints": current_fingerprints,
        "feedback_fingerprint": args.feedback_fingerprint,
        "model_version": MODEL_VERSION,
        "selected_algorithm": selected["algorithm"],
        "selected_parameters": selected["best_parameters"],
        "train_rows": int(len(train_data)),
        "test_rows": int(len(test_data)),
        "train_proportion": float(len(train_data) / len(data)),
        "test_actual_proportion": float(len(test_data) / len(data)),
        "test_proportion": args.test_size,
        "random_state": args.random_state,
        "split_strategy": "near_duplicate_group_80_20_cv3",
        "cross_validation_folds": 3,
        "cross_validation_type": "StratifiedGroupKFold",
        "near_duplicate_pairs_reviewed": near_duplicate_pairs,
        "near_duplicate_group_threshold": SPLIT_GROUP_THRESHOLD,
        "similar_label_pairs_reviewed": similar_label_pairs,
        "similar_label_similarity_threshold": SIMILAR_LABEL_THRESHOLD,
        "confidence_review_threshold": CONFIDENCE_REVIEW_THRESHOLD,
        "production_training_rows": int(len(data)),
        "classes": len(all_labels),
        "confusion_matrix_csv": "matriz_confusao.csv",
        "per_class_metrics_csv": "metricas_por_classe.csv",
        "test_predictions_csv": "previsoes_teste.csv",
        "test_errors_csv": "erros_teste.csv",
        "top_confusions_csv": "principais_confusoes.csv",
        "similar_observations_csv": "observacoes_semelhantes.csv",
        "similar_labels_csv": "classificacoes_semelhantes.csv",
        "candidate_model": candidate_path.name,
    }

    old_active = active_evaluation or {
        "algorithm": None,
        "accuracy": None,
        "macro_f1": None,
        "weighted_f1": None,
    }
    if not model_path.is_file():
        shutil.copy2(candidate_path, model_path)
        promotion_status = "first_model_activated"
        active_model = {
            "algorithm": selected["algorithm"],
            **{key: candidate_metrics[key] for key in ("accuracy", "macro_f1", "weighted_f1")},
        }
    else:
        consistent_improvement = (
            candidate_metrics["macro_f1"] > float(old_active["macro_f1"] or 0) + 0.005
            and candidate_metrics["accuracy"] >= float(old_active["accuracy"] or 0) - 0.02
            and candidate_metrics["weighted_f1"] >= float(old_active["weighted_f1"] or 0) - 0.02
        )
        if consistent_improvement:
            shutil.copy2(candidate_path, model_path)
            promotion_status = "automatically_promoted"
            active_model = {
                "algorithm": selected["algorithm"],
                **{key: candidate_metrics[key] for key in ("accuracy", "macro_f1", "weighted_f1")},
            }
        else:
            promotion_status = "not_consistently_better"
            active_model = old_active

    candidate_metrics["active_model"] = active_model
    candidate_metrics["promotion_status"] = promotion_status
    candidate_metrics["active_model_comparable"] = active_evaluation is not None
    candidate_metrics["previous_active_metrics"] = old_active
    candidate_metrics["trained_model"] = model_path.name
    training_version = int((previous_metrics or {}).get("training_version", 0)) + 1
    candidate_metrics["training_version"] = training_version
    candidate_metrics["similar_label_pairs_reviewed"] = similar_label_pairs

    previous_active_record = (previous_metrics or {}).get("active_model") or {}
    previous_algorithm = (
        previous_active_record.get("algorithm")
        or (previous_metrics or {}).get("selected_algorithm")
        or ("Regressão Logística" if previous_metrics else None)
    )
    if history_path.is_file():
        model_history = json.loads(history_path.read_text(encoding="utf-8"))
        if not isinstance(model_history, list):
            raise ValueError("O histórico de modelos existente não contém uma lista JSON válida.")
    else:
        model_history = []
    if previous_metrics and not any(entry.get("training_version") == 0 for entry in model_history):
        legacy_metrics = previous_metrics.get("previous_active_metrics") or previous_active_record or previous_metrics
        model_history.insert(
            0,
            {
                "training_version": 0,
                "trained_at": "",
                "algorithm": previous_algorithm or "Modelo legado",
                "parameters": {},
                "accuracy": legacy_metrics.get("accuracy") or 0.0,
                "macro_f1": legacy_metrics.get("macro_f1") or 0.0,
                "weighted_f1": legacy_metrics.get("weighted_f1") or 0.0,
                "cv_macro_f1_mean": None,
                "cv_macro_f1_std": None,
                "promotion_status": "modelo ativo anterior",
            },
        )
    history_entry = {
        "training_version": training_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": selected["algorithm"],
        "parameters": selected["best_parameters"],
        "accuracy": candidate_metrics["accuracy"],
        "macro_f1": candidate_metrics["macro_f1"],
        "weighted_f1": candidate_metrics["weighted_f1"],
        "cv_macro_f1_mean": selected["cv_f1_macro_mean"],
        "cv_macro_f1_std": selected["cv_f1_macro_std"],
        "promotion_status": promotion_status,
    }
    model_history.append(history_entry)
    candidate_metrics["model_history"] = model_history[-10:]
    history_path.write_text(
        json.dumps(model_history, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    metrics_path.write_text(
        json.dumps(candidate_metrics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Registros válidos e deduplicados: {data_stats['usable_training_rows']}")
    print(
        f"Divisão sem vazamento: {len(train_data)} treino/CV / {len(test_data)} teste; "
        f"{near_duplicate_pairs} pares quase duplicados sinalizados."
    )
    print(f"Modelo selecionado por F1 macro em CV: {selected['algorithm']} {selected['best_parameters']}")
    print(
        f"Teste: acurácia {metrics['accuracy']:.4f} | F1 macro {metrics['macro_f1']:.4f} | "
        f"F1 ponderado {metrics['weighted_f1']:.4f}"
    )
    print(f"Estado do candidato: {promotion_status}")
    print(f"Modelo ativo: {model_path}")


if __name__ == "__main__":
    main()
