"""Predict failure classifications for observations loaded from the application database."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from train_failure_classifier import clean_observation


def predict_database_rows(input_path: Path, output_path: Path, model_path: Path) -> int:
    if not input_path.is_file():
        raise FileNotFoundError(f"Arquivo de observações não encontrado: {input_path}")
    if not model_path.is_file():
        raise FileNotFoundError("O modelo treinado não foi encontrado.")

    import joblib

    rows: Any = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("A entrada de observações precisa ser uma lista.")

    bundle = joblib.load(model_path)
    pipeline = bundle["pipeline"]
    label_lookup = bundle["label_lookup"]
    results: list[dict[str, str | float]] = []

    for start in range(0, len(rows), 512):
        batch = rows[start : start + 512]
        if any(
            not isinstance(row, dict)
            or not isinstance(row.get("id"), str)
            or not isinstance(row.get("observation"), str)
            for row in batch
        ):
            raise ValueError("Cada registro precisa conter identificador e observação em texto.")

        valid_rows: list[tuple[str, str]] = []
        for row in batch:
            cleaned = clean_observation(row["observation"])
            if cleaned:
                valid_rows.append((row["id"], cleaned))
            else:
                results.append({"id": row["id"], "label": "", "confidence": 0.0})

        if not valid_rows:
            continue

        labels = pipeline.predict([text for _, text in valid_rows])
        probabilities = pipeline.predict_proba([text for _, text in valid_rows])
        for (row_id, _), label, scores in zip(valid_rows, labels, probabilities):
            results.append({
                "id": row_id,
                "label": label_lookup[label],
                "confidence": float(scores.max()),
            })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")
    return len(results)


def main() -> None:
    parser = argparse.ArgumentParser(description="Classifica observações da tabela importada.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    args = parser.parse_args()

    try:
        count = predict_database_rows(args.input, args.output, args.model)
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error

    print(f"{count} registro(s) classificado(s).")


if __name__ == "__main__":
    main()
