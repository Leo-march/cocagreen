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

Copy `.env.example` to `.env.local` and set the MySQL and classifier values for your environment. The only administrator account is `Talita`; set its password with `COCAGREEN_ADMIN_PASSWORD` in `.env.local`. The configured development password is intentionally not stored in version control; replace it with a long, unique password before exposing the app beyond a trusted local environment. `PYTHON_PATH` is optional; when omitted, the app tries the project `.venv` and then `python` from `PATH`.

## Classificador de falhas

O script `scripts/train_failure_classifier.py` treina um classificador com as planilhas `apontamentos Jundiai.xlsx` e `Classificação dos Apontamentos - Marília.xlsx`, localizadas em `scripts/.planilhas treinamento` ou `scripts/planilhas treinamento`. Ele usa `Observações` como texto de entrada e `Classificação` como rótulo. As categorias das duas planilhas são combinadas, sem inferir equivalências semânticas; diferenças apenas de maiúsculas/minúsculas e espaços são normalizadas.

No Windows, instale as dependências e execute:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\train_failure_classifier.py
```

O pipeline limpa ruídos sem remover números e pontuação técnica, combina TF-IDF de palavras e caracteres e compara Regressão Logística com Complement Naive Bayes. Uma busca em grade com validação cruzada `StratifiedGroupKFold` de três partes seleciona os hiperparâmetros somente dentro dos 80% de treino; os 20% restantes ficam isolados para a avaliação final. Textos exatos e quase duplicados são agrupados para evitar que descrições muito semelhantes atravessem as partições. A lista de pares quase duplicados é um alerta de qualidade e não remove dados automaticamente.

O sistema registra média e desvio-padrão das métricas da validação cruzada, desempenho no teste, métricas por classe e por origem, matriz de confusão, erros individuais, confusões recorrentes e termos frequentes nos erros. Como as planilhas históricas contêm somente `Observações` e `Classificação`, não há atributos de equipamento nem de operador para segmentar os erros. O pipeline final candidato é treinado com todos os registros válidos após a avaliação.

Para comparar modelos sem reutilizar métricas legadas, o pipeline clona a configuração do modelo ativo, treina essa referência apenas na partição de treino atual e avalia referência e candidato na mesma partição de teste isolada. Um modelo candidato só substitui automaticamente o ativo quando melhora o F1 macro em pelo menos 0,5 ponto percentual e não reduz acurácia nem F1 ponderado em mais de 2 pontos percentuais; sem melhora consistente, o modelo ativo é preservado e um administrador pode revisar e ativar o candidato na página.

A página **Realizar nova predição** na Sidebar aceita planilhas `.xlsx` com `Observações`, sem exigir rótulos, preserva abas e dados originais e acrescenta classificação, confiança estimada e indicação de revisão manual. Confiança abaixo de 60% é sinalizada; é uma probabilidade estimada, não calibrada, e não substitui validação humana.

Na página **Classificação de dados**, no primeiro acesso administrativo, o sistema aplica o mesmo pipeline treinado às observações ainda sem predição e grava `classificacao_pela_ia` e `confianca_classificacao_ia` na tabela importada, logo após a coluna de observações. Registros com confiança estimada **acima de 90%** entram automaticamente em **Classificados**; os demais ficam em **Pendentes** com o percentual mostrado na coluna **Classificação pela IA**. O administrador ainda pode alterar a categoria. A confiança é a probabilidade máxima retornada pelo modelo, não uma acurácia calibrada ou garantia de acerto.

No menu de classificação, a opção **Outra falha** permite cadastrar uma categoria personalizada. As categorias são salvas no MySQL e ficam disponíveis no menu para todos os usuários administradores.

Correções manuais podem ser enviadas em uma planilha `.xlsx` com `Observações` e `Classificação revisada`. Elas ficam pendentes no MySQL e só entram em um novo candidato após aprovação administrativa explícita; uma correção aprovada substitui o rótulo histórico da mesma observação normalizada, e o sistema bloqueia duas correções aprovadas conflitantes para o mesmo texto. Configure `COCAGREEN_ADMIN_PASSWORD` e um `COCAGREEN_AUTH_SECRET` aleatório com pelo menos 32 caracteres no `.env.local`; o segredo de sessão é emitido como cookie `HttpOnly`. As aprovações e rejeições registram usuário e horário.

Os artefatos são salvos em `scripts/resultado_modelo_falhas`: métricas e comparação em `metricas.json`, histórico em `historico_modelos.json`, métricas por origem em `metricas_por_origem.csv`, métricas por categoria em `metricas_por_classe.csv`, matriz de confusão em `matriz_confusao.csv`, erros em `erros_teste.csv`, pares de observações semelhantes em `observacoes_semelhantes.csv`, sugestões de classificações semelhantes em `classificacoes_semelhantes.csv`, confusões em `principais_confusoes.csv`, previsões do teste em `previsoes_teste.csv` e os modelos ativo e candidato em arquivos `.joblib`. O sistema cria a tabela `failure_prediction_feedback` no MySQL na primeira utilização da fila. Os caminhos podem ser alterados com `--data-dir` e `--output-dir`.

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
