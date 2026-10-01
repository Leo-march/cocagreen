"""
Classificador de motivos de parada: texto do operador -> termo técnico.

Uso:
    pip install pandas scikit-learn openpyxl joblib scipy

    # Treinar (lê as planilhas, avalia e salva o modelo)
    python classificador_paradas.py treinar planilha1.xlsx planilha2.xlsx planilha3.xlsx planilha4.xlsx

    # Prever em uma planilha nova (precisa ter a coluna do texto do operador)
    python classificador_paradas.py prever nova.xlsx --saida resultado.xlsx
"""
import argparse
import re
import sys
import unicodedata

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC

# ----------------------------------------------------------------------
# CONFIGURAÇÃO: ajuste para os nomes reais das colunas das suas planilhas
# ----------------------------------------------------------------------
COL_TEXTO_OPERADOR = "motivo_operador"   # obrigatória
COL_TECNICO = "motivo_tecnico"           # obrigatória no treino
COL_MAQUINA = "maquina"                  # opcional (use None se não tiver)
COL_OPERADOR = "operador"                # opcional: usada para validar por operador
COL_DATA = "data"                        # opcional: usada se não houver operador

MODELO_PATH = "modelo_paradas.joblib"
MIN_EXEMPLOS_POR_CLASSE = 3              # classes mais raras que isso são descartadas
MARGEM_MINIMA = 0.5                      # abaixo disso, vai para revisão humana (ajuste após avaliar)

# Abreviações e gírias da fábrica (vá completando olhando os dados)
ABREVIACOES = {
    "mq": "maquina",
    "maq": "maquina",
    "vaz": "vazamento",
    "n": "nao",
    "nn": "nao",
    "q": "que",
}


# ----------------------------------------------------------------------
# Pré-processamento
# ----------------------------------------------------------------------
def normalizar(texto) -> str:
    if pd.isna(texto):
        return ""
    t = str(texto).lower()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    palavras = [ABREVIACOES.get(p, p) for p in t.split()]
    return " ".join(palavras)


def ler_planilhas(caminhos):
    frames = []
    for c in caminhos:
        df = pd.read_csv(c) if c.lower().endswith(".csv") else pd.read_excel(c)
        df["_origem"] = c
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


def montar_texto(df: pd.DataFrame) -> pd.Series:
    """Junta o texto do operador com a máquina (contexto), se existir."""
    texto = df[COL_TEXTO_OPERADOR].map(normalizar)
    if COL_MAQUINA and COL_MAQUINA in df.columns:
        texto = df[COL_MAQUINA].map(normalizar) + " | " + texto
    return texto


def criar_pipeline() -> Pipeline:
    features = FeatureUnion([
        ("palavras", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
        ("caracteres", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5),
                                       min_df=3, sublinear_tf=True)),
    ])
    return Pipeline([
        ("tfidf", features),
        ("clf", LinearSVC(C=0.5, class_weight="balanced")),
    ])


# ----------------------------------------------------------------------
# Treino
# ----------------------------------------------------------------------
def treinar(caminhos):
    df = ler_planilhas(caminhos)
    df = df.dropna(subset=[COL_TEXTO_OPERADOR, COL_TECNICO]).copy()

    df["_x"] = montar_texto(df)
    # Unifica variações triviais do rótulo (caixa, espaços). Revise sinônimos à mão depois.
    df["_y"] = df[COL_TECNICO].astype(str).str.strip().str.lower()
    df = df[df["_x"].str.len() > 0]

    # Remove duplicatas exatas (evita métrica inflada)
    df = df.drop_duplicates(subset=["_x", "_y"])

    # Descarta classes muito raras
    contagem = df["_y"].value_counts()
    df = df[df["_y"].isin(contagem[contagem >= MIN_EXEMPLOS_POR_CLASSE].index)]
    print(f"{len(df)} registros, {df['_y'].nunique()} classes técnicas")

    # Divisão treino/teste: por operador, senão por período, senão aleatória
    if COL_OPERADOR in df.columns:
        gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        idx_tr, idx_te = next(gss.split(df, groups=df[COL_OPERADOR]))
        treino, teste = df.iloc[idx_tr], df.iloc[idx_te]
        print("Validação separada por operador")
    elif COL_DATA in df.columns:
        df = df.sort_values(COL_DATA)
        corte = int(len(df) * 0.8)
        treino, teste = df.iloc[:corte], df.iloc[corte:]
        print("Validação separada por período (últimos 20%)")
    else:
        teste = df.sample(frac=0.2, random_state=42)
        treino = df.drop(teste.index)
        print("Validação aleatória (pode estar otimista)")

    modelo = criar_pipeline()
    modelo.fit(treino["_x"], treino["_y"])

    # Avaliação
    scores = modelo.decision_function(teste["_x"])
    classes = modelo.classes_
    ordem = np.argsort(-scores, axis=1)
    pred = classes[ordem[:, 0]]
    margem = scores[np.arange(len(scores)), ordem[:, 0]] - scores[np.arange(len(scores)), ordem[:, 1]]
    top3_ok = np.array([y in classes[o[:3]] for y, o in zip(teste["_y"], ordem)])

    print(f"\nAcurácia top-1: {accuracy_score(teste['_y'], pred):.3f}")
    print(f"Acurácia top-3: {top3_ok.mean():.3f}")
    print(f"F1 macro:       {f1_score(teste['_y'], pred, average='macro'):.3f}")

    print("\nTrade-off automação x qualidade (margem mínima):")
    for m in [0.0, 0.25, 0.5, 0.75, 1.0]:
        auto = margem >= m
        if auto.sum():
            acc = (pred[auto] == teste["_y"].values[auto]).mean()
            print(f"  margem >= {m:.2f}: automatiza {auto.mean():5.1%}, acerto {acc:.1%}")

    # Re-treina com tudo para o modelo final
    modelo.fit(df["_x"], df["_y"])
    joblib.dump(modelo, MODELO_PATH)
    print(f"\nModelo salvo em {MODELO_PATH}")


# ----------------------------------------------------------------------
# Predição
# ----------------------------------------------------------------------
def prever(caminho, saida):
    modelo = joblib.load(MODELO_PATH)
    df = ler_planilhas([caminho])
    x = montar_texto(df)

    scores = modelo.decision_function(x)
    classes = modelo.classes_
    ordem = np.argsort(-scores, axis=1)
    linhas = np.arange(len(scores))

    df["sugestao_1"] = classes[ordem[:, 0]]
    df["sugestao_2"] = classes[ordem[:, 1]]
    df["sugestao_3"] = classes[ordem[:, 2]]
    df["margem"] = scores[linhas, ordem[:, 0]] - scores[linhas, ordem[:, 1]]
    df["status"] = np.where(df["margem"] >= MARGEM_MINIMA, "automatico", "revisar")

    df.drop(columns=["_origem"]).to_excel(saida, index=False)
    print(f"{(df['status'] == 'automatico').mean():.1%} automáticos. Salvo em {saida}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("treinar")
    t.add_argument("planilhas", nargs="+")
    q = sub.add_parser("prever")
    q.add_argument("planilha")
    q.add_argument("--saida", default="resultado.xlsx")
    a = p.parse_args()

    if a.cmd == "treinar":
        treinar(a.planilhas)
    else:
        prever(a.planilha, a.saida)
