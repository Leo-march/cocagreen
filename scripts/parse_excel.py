import json
import sys
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise ValueError("Informe o caminho do arquivo Excel.")

    file_path = Path(sys.argv[1])
    if not file_path.is_file():
        raise FileNotFoundError("O arquivo Excel temporário não foi encontrado.")

    workbook = pd.ExcelFile(file_path)
    if not workbook.sheet_names:
        raise ValueError("A planilha não possui abas para importar.")

    engine = "xlrd" if file_path.suffix.lower() in {".xls", ".xld"} else "openpyxl"
    sheets = []
    for sheet_name in workbook.sheet_names:
        dataframe = pd.read_excel(file_path, sheet_name=sheet_name, engine=engine, header=0)
        dataframe = dataframe.dropna(how="all").reset_index(drop=True)

        original_columns = [str(column).strip() for column in dataframe.columns]
        columns: list[str] = []
        used_columns: set[str] = set()
        for index, column in enumerate(original_columns):
            base = column or f"coluna_{index + 1}"
            name = base
            suffix = 2
            while name in used_columns:
                name = f"{base}_{suffix}"
                suffix += 1
            used_columns.add(name)
            columns.append(name)

        dataframe.columns = columns
        dataframe = dataframe.astype(object).where(pd.notna(dataframe), "")
        rows = [
            {column: row[index] for index, column in enumerate(columns)}
            for row in dataframe.itertuples(index=False, name=None)
        ]
        if columns:
            sheets.append(
                {
                    "sheet": sheet_name,
                    "columns": columns,
                    "rows": rows,
                    "totalRows": len(dataframe.index),
                }
            )

    if not sheets:
        raise ValueError("Nenhuma aba contém colunas para importar.")

    print(
        json.dumps(
            {
                "sheets": sheets,
            },
            ensure_ascii=False,
            default=str,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
