"""
Serviço de classificação (FastAPI). Roda separado do Next.js.

    pip install fastapi uvicorn
    uvicorn servico_api:app --host 127.0.0.1 --port 8000

Precisa estar na mesma pasta de classificador_paradas.py e modelo_paradas.joblib.
"""
import os
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# Importa as funções de pré-processamento usadas no treino
from classificador_paradas import MARGEM_MINIMA, MODELO_PATH, normalizar

API_KEY = os.environ.get("CLASSIFICADOR_API_KEY", "troque-esta-chave")

app = FastAPI()
modelo = joblib.load(MODELO_PATH)  # carregado uma única vez na inicialização


class Entrada(BaseModel):
    texto: str
    maquina: Optional[str] = None


@app.post("/classificar")
def classificar(e: Entrada, x_api_key: str = Header(default="")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Não autorizado")

    texto = normalizar(e.texto)
    if e.maquina:
        texto = normalizar(e.maquina) + " | " + texto  # mesmo formato do treino

    scores = modelo.decision_function([texto])[0]
    ordem = np.argsort(-scores)[:3]
    margem = float(scores[ordem[0]] - scores[ordem[1]])

    return {
        "sugestoes": [str(modelo.classes_[i]) for i in ordem],
        "margem": margem,
        "status": "automatico" if margem >= MARGEM_MINIMA else "revisar",
    }
