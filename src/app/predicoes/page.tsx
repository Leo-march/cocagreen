"use client";

import { ChangeEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as XLSX from "xlsx";
import { getUserRole, subscribeToAuthChanges } from "@/lib/client-auth";

type TrainingMetrics = {
  sources: Record<string, {
    input_rows: number;
    missing_rows: number;
    empty_after_text_cleaning: number;
    rows_superseded_by_approved_feedback: number;
    duplicate_rows_removed: number;
    usable_training_rows: number;
  }>;
  duplicate_rows_removed: number;
  discarded_missing_observation_or_label: number;
  historical_rows_superseded_by_approved_feedback: number;
  approved_feedback_rows: number;
  production_training_rows: number;
  classes: number;
  source_fingerprints: Record<string, string>;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
  selected_algorithm: string;
  selected_parameters: Record<string, string | number>;
  model_comparison: {
    algorithm: string;
    best_parameters: Record<string, string | number>;
    cv_accuracy_mean: number;
    cv_accuracy_std: number;
    cv_precision_macro_mean: number;
    cv_precision_macro_std: number;
    cv_recall_macro_mean: number;
    cv_recall_macro_std: number;
    cv_f1_macro_mean: number;
    cv_f1_macro_std: number;
    cv_f1_weighted_mean: number;
    cv_f1_weighted_std: number;
    train_f1_macro_mean: number;
    train_validation_f1_gap: number;
  }[];
  train_rows: number;
  test_rows: number;
  train_proportion: number;
  test_actual_proportion: number;
  classes_with_one_record: number;
  classes_with_fewer_than_three_records: number;
  classes_with_fewer_than_five_records: number;
  near_duplicate_pairs_reviewed: number;
  similar_label_pairs_reviewed: number;
  confidence_review_threshold: number;
  test_low_confidence_rows: number;
  top_confusions: {
    classificacao_real: string;
    classificacao_prevista: string;
    ocorrencias: number;
  }[];
  metrics_by_source: {
    origem: string;
    amostras_teste: number;
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    weighted_precision: number;
    weighted_recall: number;
    weighted_f1: number;
  }[];
  difficult_classes: {
    classificacao: string;
    f1: number;
    recall: number;
    support: number;
  }[];
  promotion_status: string;
  active_model_comparable: boolean;
  active_model: {
    algorithm: string | null;
    accuracy: number | null;
    macro_f1: number | null;
    weighted_f1: number | null;
  };
  previous_active_metrics: {
    algorithm: string | null;
    accuracy: number | null;
    macro_f1: number | null;
    weighted_f1: number | null;
  };
  training_version: number;
  model_history: {
    training_version: number;
    trained_at: string;
    algorithm: string;
    parameters: Record<string, string | number>;
    accuracy: number;
    macro_f1: number;
    weighted_f1: number;
    cv_macro_f1_mean: number | null;
    cv_macro_f1_std: number | null;
    promotion_status: string;
  }[];
};

type FeedbackRow = {
  id: number;
  observation: string;
  predicted_label: string;
  reviewed_label: string;
  confidence: number | null;
  source_file: string;
  created_by: string;
  created_at: string;
};

type WorkbookPreview = {
  name: string;
  columns: string[];
  rows: string[][];
  totalRows: number;
};

function createPreview(file: Blob): Promise<WorkbookPreview[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    return workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
      });
      const columns = (rows[0] ?? []).map((value) => String(value));
      return {
        name,
        columns,
        rows: rows.slice(1, 21).map((row) => row.map((value) => String(value ?? ""))),
        totalRows: Math.max(rows.length - 1, 0),
      };
    });
  });
}

function downloadWorkbook(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function requestReviewQueue() {
  const response = await fetch("/api/predicoes/revisoes");
  const payload = await response.json() as { rows?: FeedbackRow[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as correções pendentes.");
  return payload.rows ?? [];
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(1)}%`;
}

function hasAdminRole() {
  return getUserRole() === "admin";
}

export default function PredictionsPage() {
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics | null>(null);
  const [trainingError, setTrainingError] = useState("");
  const [isPreparingModel, setIsPreparingModel] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultFile, setResultFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<WorkbookPreview[]>([]);
  const [predictionError, setPredictionError] = useState("");
  const [isPredicting, setIsPredicting] = useState(false);
  const isAdmin = useSyncExternalStore(subscribeToAuthChanges, hasAdminRole, () => false);
  const [correctionFile, setCorrectionFile] = useState<File | null>(null);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [reviewingFeedbackId, setReviewingFeedbackId] = useState<number | null>(null);
  const [isPromotingCandidate, setIsPromotingCandidate] = useState(false);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTrainingStatus() {
      try {
        const response = await fetch("/api/predicoes", { signal: controller.signal });
        const payload = await response.json() as { metrics?: TrainingMetrics; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível preparar o modelo.");
        if (!payload.metrics) throw new Error("A resposta do treinamento está inválida.");
        setTrainingMetrics(payload.metrics);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTrainingError(error instanceof Error ? error.message : "Não foi possível preparar o modelo.");
        }
      } finally {
        if (!controller.signal.aborted) setIsPreparingModel(false);
      }
    }

    void loadTrainingStatus();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (getUserRole() !== "admin") return;
    void requestReviewQueue()
      .then(setFeedbackRows)
      .catch((error: unknown) => {
        setFeedbackError(error instanceof Error ? error.message : "Não foi possível carregar as correções pendentes.");
      });
  }, []);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setResultFile(null);
    setPreview([]);
    setPredictionError("");
  }

  async function predict() {
    if (!selectedFile) {
      setPredictionError("Selecione uma planilha com a coluna Observações.");
      return;
    }

    setIsPredicting(true);
    setPredictionError("");
    setResultFile(null);
    setPreview([]);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/predicoes", { method: "POST", body: formData });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error || "Não foi possível prever as classificações.");
      }
      const file = await response.blob();
      const workbookPreview = await createPreview(file);
      setResultFile(file);
      setPreview(workbookPreview);
    } catch (error) {
      setPredictionError(error instanceof Error ? error.message : "Não foi possível prever as classificações.");
    } finally {
      setIsPredicting(false);
    }
  }

  async function submitCorrections() {
    if (!correctionFile) {
      setFeedbackError("Selecione uma planilha com as colunas Observações e Classificação revisada.");
      return;
    }
    setFeedbackError("");
    setFeedbackNotice("");
    setIsSubmittingFeedback(true);
    const formData = new FormData();
    formData.append("file", correctionFile);

    try {
      const response = await fetch("/api/predicoes/revisoes", { method: "POST", body: formData });
      const payload = await response.json() as { insertedRows?: number; duplicateRows?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar as correções.");
      setFeedbackNotice(
        `${payload.insertedRows ?? 0} correção(ões) adicionada(s) à fila; ${payload.duplicateRows ?? 0} duplicada(s) ignorada(s).`,
      );
      setCorrectionFile(null);
      if (correctionInputRef.current) correctionInputRef.current.value = "";
      setFeedbackRows(await requestReviewQueue());
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Não foi possível enviar as correções.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function reviewCorrection(id: number, status: "approved" | "rejected") {
    setFeedbackError("");
    setFeedbackNotice("");
    setReviewingFeedbackId(id);
    try {
      const response = await fetch("/api/predicoes/revisoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a revisão.");
      setFeedbackRows(await requestReviewQueue());
      if (status === "approved") {
        setIsPreparingModel(true);
        const modelResponse = await fetch("/api/predicoes");
        const modelPayload = await modelResponse.json() as { metrics?: TrainingMetrics; error?: string };
        if (!modelResponse.ok || !modelPayload.metrics) {
          throw new Error(modelPayload.error || "A correção foi aprovada, mas o modelo não pôde ser atualizado.");
        }
        setTrainingMetrics(modelPayload.metrics);
        setFeedbackNotice("Correção aprovada e incluída no conjunto que alimenta o novo candidato a modelo.");
      } else {
        setFeedbackNotice("Correção rejeitada e mantida fora do treinamento.");
      }
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Não foi possível processar a revisão.");
    } finally {
      setIsPreparingModel(false);
      setReviewingFeedbackId(null);
    }
  }

  async function promoteCandidate() {
    setFeedbackError("");
    setIsPromotingCandidate(true);
    try {
      const response = await fetch("/api/predicoes/modelo", { method: "PATCH" });
      const payload = await response.json() as { metrics?: TrainingMetrics; error?: string };
      if (!response.ok || !payload.metrics) {
        throw new Error(payload.error || "Não foi possível ativar o modelo candidato.");
      }
      setTrainingMetrics(payload.metrics);
      setFeedbackNotice("Modelo candidato ativado após aprovação administrativa.");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Não foi possível ativar o modelo candidato.");
    } finally {
      setIsPromotingCandidate(false);
    }
  }

  const totalTrainRows = trainingMetrics?.production_training_rows ?? 0;
  const sourceEntries = Object.entries(trainingMetrics?.sources ?? {});
  const outputName = `predicoes-${selectedFile?.name.replace(/\.[^.]+$/, "") || "observacoes"}.xlsx`;
  const candidateNeedsReview = trainingMetrics?.promotion_status === "review_required"
    || trainingMetrics?.promotion_status === "not_consistently_better";
  const selectedModelComparison = trainingMetrics?.model_comparison.find(
    (model) => model.algorithm === trainingMetrics.selected_algorithm,
  );

  return (
    <div className="dashboard-page dashboard-with-brand-bg analysis-dashboard-page predictions-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CLASSIFICAÇÃO DE FALHAS</p>
          <h1>Realizar nova predição</h1>
          <p className="page-subtitle">
            Envie apontamentos sem classificação para prever o tipo de falha.
          </p>
        </div>
      </header>

      <section className="prediction-model-panel" aria-labelledby="prediction-model-title">
        <div className="prediction-section-heading">
          <div>
            <p className="ops-panel-kicker">BASE DE TREINAMENTO</p>
            <h2 id="prediction-model-title">Modelo treinado com as duas planilhas</h2>
          </div>
          {isPreparingModel && <span className="prediction-status">Preparando modelo...</span>}
          {!isPreparingModel && trainingMetrics && (
            <span className={`prediction-status${candidateNeedsReview ? "" : " prediction-status-ready"}`}>
              {candidateNeedsReview ? "Candidato aguardando decisão" : "Modelo ativo pronto"}
            </span>
          )}
        </div>

        {trainingError && <p className="prediction-error" role="alert">{trainingError}</p>}
        {trainingMetrics && (
          <>
            <div className="prediction-source-grid">
              {sourceEntries.map(([source, stats]) => (
                <article className="prediction-source-card" key={source}>
                  <h3>{source}</h3>
                  <p><span>Linhas lidas</span><strong>{stats.input_rows.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Linhas faltantes removidas</span><strong>{stats.missing_rows.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Observações vazias após limpeza</span><strong>{stats.empty_after_text_cleaning.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Rótulos substituídos por correção aprovada</span><strong>{stats.rows_superseded_by_approved_feedback.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Duplicidades removidas</span><strong>{stats.duplicate_rows_removed.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Registros usados</span><strong>{stats.usable_training_rows.toLocaleString("pt-BR")}</strong></p>
                </article>
              ))}
            </div>
            <div className="prediction-training-summary">
              <span><strong>{totalTrainRows.toLocaleString("pt-BR")}</strong> registros válidos no candidato</span>
              <span><strong>{trainingMetrics.classes.toLocaleString("pt-BR")}</strong> classes de falha</span>
              <span><strong>{trainingMetrics.duplicate_rows_removed.toLocaleString("pt-BR")}</strong> duplicidades removidas</span>
              <span><strong>{trainingMetrics.discarded_missing_observation_or_label.toLocaleString("pt-BR")}</strong> registros sem dados essenciais removidos</span>
              <span><strong>{trainingMetrics.approved_feedback_rows.toLocaleString("pt-BR")}</strong> correções humanas aprovadas</span>
              <span><strong>{trainingMetrics.historical_rows_superseded_by_approved_feedback.toLocaleString("pt-BR")}</strong> rótulos históricos substituídos por correções</span>
            </div>
            <details className="prediction-evaluation" open>
              <summary>Avaliação, seleção e qualidade do modelo</summary>
              <p className="prediction-evaluation-note">
                O teste permanece isolado ({trainingMetrics.test_rows.toLocaleString("pt-BR")} registros, {percent(trainingMetrics.test_actual_proportion)});
                a seleção e a otimização usam validação cruzada estratificada por grupos somente nos
                {` ${trainingMetrics.train_rows.toLocaleString("pt-BR")}`} registros de treino. A acurácia sozinha
                não representa as {trainingMetrics.classes.toLocaleString("pt-BR")} classes disponíveis.
              </p>
              <div className="prediction-evaluation-metrics">
                <span>Modelo candidato: <strong>{trainingMetrics.selected_algorithm}</strong></span>
                <span>Acurácia de teste: <strong>{percent(trainingMetrics.accuracy)}</strong></span>
                <span>Precisão macro: <strong>{percent(trainingMetrics.macro_precision)}</strong></span>
                <span>Recall macro: <strong>{percent(trainingMetrics.macro_recall)}</strong></span>
                <span>F1 macro: <strong>{percent(trainingMetrics.macro_f1)}</strong></span>
                <span>F1 ponderado: <strong>{percent(trainingMetrics.weighted_f1)}</strong></span>
                <span>Confiança abaixo de {percent(trainingMetrics.confidence_review_threshold)} no teste: <strong>{trainingMetrics.test_low_confidence_rows.toLocaleString("pt-BR")}</strong></span>
                <span>Classes com 1 exemplo: <strong>{trainingMetrics.classes_with_one_record}</strong></span>
                <span>Classes com menos de 5 exemplos: <strong>{trainingMetrics.classes_with_fewer_than_five_records}</strong></span>
                <span>Pares de textos quase duplicados auditados: <strong>{trainingMetrics.near_duplicate_pairs_reviewed}</strong></span>
                <span>Pares de classificações semelhantes para revisão: <strong>{trainingMetrics.similar_label_pairs_reviewed}</strong></span>
              </div>
              <div className="prediction-comparison-scroll">
                <table>
                  <thead><tr><th>Modelo</th><th>Parâmetros</th><th>CV F1 macro (média ± DP)</th><th>CV F1 ponderado (média ± DP)</th><th>Gap treino–validação</th></tr></thead>
                  <tbody>
                    {trainingMetrics.model_comparison.map((model) => (
                      <tr key={model.algorithm}>
                        <td>{model.algorithm}{model.algorithm === trainingMetrics.selected_algorithm ? " (selecionado)" : ""}</td>
                        <td>{Object.entries(model.best_parameters).map(([key, value]) => `${key}=${value}`).join(", ")}</td>
                        <td>{percent(model.cv_f1_macro_mean)} ± {percent(model.cv_f1_macro_std)}</td>
                        <td>{percent(model.cv_f1_weighted_mean)} ± {percent(model.cv_f1_weighted_std)}</td>
                        <td>{percent(model.train_validation_f1_gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="prediction-subheading">Desempenho por origem no teste</h3>
              <div className="prediction-comparison-scroll">
                <table>
                  <thead><tr><th>Origem</th><th>Amostras</th><th>Acurácia</th><th>F1 macro</th><th>F1 ponderado</th></tr></thead>
                  <tbody>
                    {trainingMetrics.metrics_by_source.map((source) => (
                      <tr key={source.origem}>
                        <td>{source.origem}</td>
                        <td>{source.amostras_teste.toLocaleString("pt-BR")}</td>
                        <td>{percent(source.accuracy)}</td>
                        <td>{percent(source.macro_f1)}</td>
                        <td>{percent(source.weighted_f1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedModelComparison && selectedModelComparison.train_validation_f1_gap > 0.15 && (
                <p className="prediction-overfit-warning" role="status">
                  Sinal de sobreajuste: F1 macro médio no treino supera a validação cruzada em
                  {` ${percent(selectedModelComparison.train_validation_f1_gap)}.`} Interprete o resultado com cautela.
                </p>
              )}
              <div className="prediction-evaluation-metrics">
                <span>Modelo ativo: <strong>{trainingMetrics.active_model.algorithm ?? "—"}</strong></span>
                <span>Acurácia do modelo ativo: <strong>{percent(trainingMetrics.active_model.accuracy)}</strong></span>
                <span>F1 macro ativo: <strong>{percent(trainingMetrics.active_model.macro_f1)}</strong></span>
                <span>F1 ponderado ativo: <strong>{percent(trainingMetrics.active_model.weighted_f1)}</strong></span>
                <span>Estado do candidato: <strong>{trainingMetrics.promotion_status}</strong></span>
              </div>
              {!trainingMetrics.active_model_comparable
                && trainingMetrics.promotion_status === "review_required"
                && <p className="prediction-evaluation-note">Não foi possível comparar o candidato com o modelo ativo na mesma partição de teste; ele não foi ativado automaticamente.</p>}
              {trainingMetrics.promotion_status === "not_consistently_better"
                && <p className="prediction-evaluation-note">O teste comparável não demonstrou melhora consistente; o modelo ativo foi preservado.</p>}
              {isAdmin
                && ["review_required", "not_consistently_better"].includes(trainingMetrics.promotion_status)
                && (
                  <button
                    type="button"
                    className="button button-secondary prediction-promote-button"
                    disabled={isPromotingCandidate}
                    onClick={() => void promoteCandidate()}
                  >
                    {isPromotingCandidate ? "Ativando modelo..." : "Aprovar e ativar modelo candidato"}
                  </button>
                )}
              {!!trainingMetrics.top_confusions.length && (
                <>
                  <h3 className="prediction-subheading">Confusões mais frequentes no teste</h3>
                  <ul className="prediction-analysis-list">
                    {trainingMetrics.top_confusions.slice(0, 5).map((item) => (
                      <li key={`${item.classificacao_real}-${item.classificacao_prevista}`}>
                        {item.classificacao_real} → {item.classificacao_prevista}: {item.ocorrencias}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!!trainingMetrics.difficult_classes.length && (
                <>
                  <h3 className="prediction-subheading">Classes com maior dificuldade</h3>
                  <ul className="prediction-analysis-list">
                    {trainingMetrics.difficult_classes.slice(0, 5).map((item) => (
                      <li key={item.classificacao}>
                        {item.classificacao}: F1 {percent(item.f1)}, recall {percent(item.recall)}, suporte {item.support}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h3 className="prediction-subheading">Histórico recente de versões</h3>
              <div className="prediction-comparison-scroll">
                <table>
                  <thead><tr><th>Versão</th><th>Data</th><th>Modelo</th><th>F1 macro (teste)</th><th>F1 macro (CV)</th><th>Estado</th></tr></thead>
                  <tbody>
                    {trainingMetrics.model_history.slice(-10).reverse().map((version) => (
                      <tr key={version.training_version}>
                        <td>{version.training_version}</td>
                        <td>{version.trained_at ? new Date(version.trained_at).toLocaleString("pt-BR") : "Modelo legado"}</td>
                        <td>{version.algorithm}</td>
                        <td>{percent(version.macro_f1)}</td>
                        <td>{percent(version.cv_macro_f1_mean)} ± {percent(version.cv_macro_f1_std)}</td>
                        <td>{version.promotion_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="prediction-evaluation-note">
                A confiança é a maior probabilidade estimada pelo classificador, não uma probabilidade calibrada.
                Registros abaixo do limite recebem a marca “Revisar manualmente”. As planilhas de origem só fornecem
                observação e classificação; equipamento e operador não estão disponíveis para análise de erros.
              </p>
              {isAdmin && (
                <div className="prediction-report-links" aria-label="Relatórios detalhados do modelo">
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=test-errors" download>Baixar erros do teste</a>
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=class-metrics" download>Baixar métricas por classe</a>
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=confusion-matrix" download>Baixar matriz de confusão</a>
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=similar-observations" download>Baixar textos semelhantes</a>
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=similar-labels" download>Baixar rótulos semelhantes</a>
                  <a className="button button-secondary" href="/api/predicoes/relatorios?file=error-terms" download>Baixar termos nos erros</a>
                </div>
              )}
            </details>
          </>
        )}
      </section>

      {isAdmin && (
        <section className="prediction-upload-panel" aria-labelledby="prediction-feedback-title">
          <div className="prediction-section-heading">
            <div>
              <p className="ops-panel-kicker">APRENDIZADO CONTÍNUO CONTROLADO</p>
              <h2 id="prediction-feedback-title">Enviar correções para validação</h2>
            </div>
          </div>
          <p className="prediction-instructions">
            Envie uma planilha .xlsx com <strong>Observações</strong> e <strong>Classificação revisada</strong>.
            As correções entram como pendentes; somente a aprovação administrativa permite incluí-las no próximo treinamento.
          </p>
          <label className="prediction-file-picker">
            <span>{correctionFile?.name ?? "Selecionar planilha com correções (.xlsx)"}</span>
            <input
              ref={correctionInputRef}
              type="file"
              accept=".xlsx"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setCorrectionFile(event.target.files?.[0] ?? null);
                setFeedbackError("");
              }}
            />
          </label>
          <div className="prediction-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void submitCorrections()}
              disabled={!correctionFile || isSubmittingFeedback}
            >
              {isSubmittingFeedback ? "Enviando para validação..." : "Enviar para fila de revisão"}
            </button>
          </div>
          {feedbackNotice && <p className="prediction-feedback-note" role="status">{feedbackNotice}</p>}
          {feedbackError && <p className="prediction-error" role="alert">{feedbackError}</p>}
          <h3 className="prediction-subheading">Correções aguardando aprovação ({feedbackRows.length})</h3>
          {feedbackRows.length === 0
            ? <p className="prediction-evaluation-note">Não há correções pendentes.</p>
            : (
              <div className="prediction-feedback-list">
                {feedbackRows.slice(0, 20).map((row) => (
                  <article className="prediction-feedback-item" key={row.id}>
                    <p><strong>Observação:</strong> {row.observation}</p>
                    <p><strong>Previsto:</strong> {row.predicted_label || "—"} <strong>Revisado:</strong> {row.reviewed_label}</p>
                    <p><strong>Origem:</strong> {row.source_file} · {row.created_by} · {row.created_at}</p>
                    <div className="prediction-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={reviewingFeedbackId !== null}
                        onClick={() => void reviewCorrection(row.id, "approved")}
                      >
                        Aprovar e incluir no próximo treino
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={reviewingFeedbackId !== null}
                        onClick={() => void reviewCorrection(row.id, "rejected")}
                      >
                        Rejeitar
                      </button>
                    </div>
                  </article>
                ))}
                {feedbackRows.length > 20 && <p className="prediction-preview-note">Exibindo as 20 primeiras correções pendentes.</p>}
              </div>
            )}
        </section>
      )}

      <section className="prediction-upload-panel" aria-labelledby="prediction-upload-title">
        <div className="prediction-section-heading">
          <div>
            <p className="ops-panel-kicker">NOVOS APONTAMENTOS</p>
            <h2 id="prediction-upload-title">Planilha para classificar</h2>
          </div>
        </div>
        <p className="prediction-instructions">
          A planilha deve conter a coluna <strong>Observações</strong>. Não é necessário incluir uma classificação.
          Os demais dados e abas serão preservados no arquivo preenchido.
        </p>
        <label className="prediction-file-picker">
          <span>{selectedFile?.name ?? "Selecionar arquivo Excel (.xlsx ou .xls)"}</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileSelection} />
        </label>
        {selectedFile && <p className="prediction-file-confirmation">Arquivo selecionado: {selectedFile.name}</p>}
        {predictionError && <p className="prediction-error" role="alert">{predictionError}</p>}
        <div className="prediction-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={predict}
            disabled={isPreparingModel || Boolean(trainingError) || !trainingMetrics || !selectedFile || isPredicting}
          >
            {isPredicting ? "Realizando predição..." : "Preencher"}
          </button>
          {resultFile && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => downloadWorkbook(resultFile, outputName)}
            >
              Baixar planilha preenchida
            </button>
          )}
        </div>
      </section>

      {preview.map((sheet) => (
        <section className="prediction-results-panel" aria-label={`Resultados da aba ${sheet.name}`} key={sheet.name}>
          <div className="prediction-section-heading">
            <div>
              <p className="ops-panel-kicker">RESULTADO DA PREDIÇÃO</p>
              <h2>{sheet.name}</h2>
            </div>
            <span className="prediction-status prediction-status-ready">
              {sheet.totalRows.toLocaleString("pt-BR")} registro(s)
            </span>
          </div>
          <div className="preview-scroll prediction-results-scroll">
            <table>
              <thead>
                <tr>{sheet.columns.map((column, index) => <th key={`${index}-${column}`}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {sheet.columns.map((column, columnIndex) => (
                      <td key={`${rowIndex}-${columnIndex}`}>{row[columnIndex] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.totalRows > sheet.rows.length && (
            <p className="prediction-preview-note">
              Prévia dos primeiros {sheet.rows.length} registros. A planilha baixada contém todos os dados.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
