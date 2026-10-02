This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment variables

Copy `.env.example` to `.env.local` and set the MySQL and classifier values for your environment. `PYTHON_PATH` is optional; when omitted, the app tries the project `.venv` and then `python` from `PATH`.

## Classificador de falhas

O script `scripts/train_failure_classifier.py` treina um classificador com as planilhas `apontamentos Jundiai.xlsx` e `Classificação dos Apontamentos - Marília.xlsx`, localizadas em `scripts/planilhas treinamento`. Ele usa `Observações` como texto de entrada e `Classificação` como rótulo. As categorias das duas planilhas são combinadas, sem inferir equivalências semânticas; diferenças apenas de maiúsculas/minúsculas e espaços são normalizadas.

No Windows, instale as dependências e execute:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\train_failure_classifier.py
```

O pipeline limpa ruídos comuns do texto, combina TF-IDF de palavras e caracteres e treina uma Regressão Logística. Linhas sem observação ou classificação são removidas, e duplicatas exatas de texto e rótulo são deduplicadas. A mesma observação com rótulos diferentes é preservada; todas as ocorrências do mesmo texto são mantidas juntas na divisão de avaliação para evitar vazamento. A divisão se aproxima de 80% para treino e 20% para teste, com semente fixa. O conjunto de teste é usado para avaliação; após isso, um novo pipeline final é treinado com todos os registros válidos e salvo para uso nas predições.

A página **Realizar nova predição** na Sidebar prepara ou atualiza automaticamente o modelo quando uma das planilhas históricas for mais recente que o artefato treinado. Ela aceita uma planilha Excel contendo a coluna `Observações`, sem exigir rótulos, prevê todas as abas e oferece a planilha preenchida para download.

Os resultados são salvos em `scripts/resultado_modelo_falhas`: métricas gerais em `metricas.json`, métricas por origem em `metricas_por_origem.csv`, métricas por categoria em `metricas_por_classe.csv`, matriz de confusão em `matriz_confusao.csv`, previsões do conjunto de teste em `previsoes_teste.csv` e o pipeline treinado em `modelo_classificacao_apontamentos.joblib`. Os caminhos podem ser alterados com `--data-dir` e `--output-dir`.

As planilhas têm muitas categorias raras. Avalie a acurácia junto com precisão, recall, F1 e o suporte por classe.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
