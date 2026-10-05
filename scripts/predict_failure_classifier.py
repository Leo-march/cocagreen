"""Apply a trained failure-classification pipeline to an Excel workbook."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

from train_failure_classifier import (
    DEFAULT_OUTPUT_DIR,
    OBSERVATION_HEADERS,
    clean_observation,
    find_column,
)


PREDICTED_COLUMN = "Classificação prevista"


def make_sheet_name(name: str, used_names: set[str]) -> str:
    base = re.sub(r"[:\\/?*\[\]]", "_", name).strip("'") or "Planilha"
    candidate = base[:31]
    suffix_number = 2
    while candidate in used_names:
        suffix = f" ({suffix_number})"
        candidate = f"{base[:31 - len(suffix)]}{suffix}"
        suffix_number += 1
    used_names.add(candidate)
    return candidate


def predict_workbook(input_path: Path, output_path: Path, model_path: Path) -> int:
    if not input_path.is_file():
        raise FileNotFoundError(f"Planilha de entrada não encontrada: {input_path}")
    if not model_path.is_file():
        raise FileNotFoundError(
            "O modelo treinado não foi encontrado. Atualize ou treine o modelo antes de prever."
        )

    import joblib

    model_bundle = joblib.load(model_path)
    pipeline = model_bundle["pipeline"]
    label_lookup = model_bundle["label_lookup"]
    workbook = pd.ExcelFile(input_path)
    sheets: list[tuple[str, pd.DataFrame]] = []
    total_rows = 0
    used_sheet_names: set[str] = set()

    for sheet_name in workbook.sheet_names:
        source = pd.read_excel(workbook, sheet_name=sheet_name, dtype=str)
        observation_column = find_column(list(source.columns), OBSERVATION_HEADERS, input_path)
        observations = source[observation_column].fillna("").astype(str)
        normalized = observations.map(clean_observation)
        valid = normalized.ne("")
        predicted = pd.Series("Observação vazia — não classificada", index=source.index, dtype=str)
        if valid.any():
            labels = pipeline.predict(normalized.loc[valid])
            predicted.loc[valid] = [label_lookup[label] for label in labels]

        destination_column = PREDICTED_COLUMN
        suffix = 2
        while destination_column in source.columns:
            destination_column = f"{PREDICTED_COLUMN} {suffix}"
            suffix += 1
        source[destination_column] = predicted
        sheets.append((make_sheet_name(sheet_name, used_sheet_names), source))
        total_rows += len(source)

    if not sheets:
        raise ValueError("A planilha não contém abas para classificar.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for sheet_name, frame in sheets:
            frame.to_excel(writer, sheet_name=sheet_name, index=False)
    return total_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Prediz classificações para observações em uma planilha Excel.")
    parser.add_argument("--input", required=True, type=Path, help="Planilha .xlsx ou .xls com as observações.")
    parser.add_argument("--output", required=True, type=Path, help="Caminho da planilha .xlsx resultante.")
    parser.add_argument(
        "--model",
        type=Path,
        default=DEFAULT_OUTPUT_DIR / "modelo_classificacao_apontamentos.joblib",
        help="Arquivo do pipeline treinado.",
    )
    args = parser.parse_args()

    try:
        total_rows = predict_workbook(args.input, args.output, args.model)
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error

    print(f"{total_rows} registro(s) processado(s).")


if __name__ == "__main__":
    main()
