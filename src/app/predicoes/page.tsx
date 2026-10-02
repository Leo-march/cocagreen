"use client";

import { ChangeEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";

type TrainingMetrics = {
  sources: Record<string, {
    input_rows: number;
    missing_rows: number;
    empty_after_text_cleaning: number;
    duplicate_rows_removed: number;
    usable_training_rows: number;
  }>;
  duplicate_rows_removed: number;
  discarded_missing_observation_or_label: number;
  production_training_rows: number;
  classes: number;
  source_fingerprints: Record<string, string>;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
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

export default function PredictionsPage() {
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics | null>(null);
  const [trainingError, setTrainingError] = useState("");
  const [isPreparingModel, setIsPreparingModel] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultFile, setResultFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<WorkbookPreview[]>([]);
  const [predictionError, setPredictionError] = useState("");
  const [isPredicting, setIsPredicting] = useState(false);

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

  const totalTrainRows = trainingMetrics?.production_training_rows ?? 0;
  const sourceEntries = Object.entries(trainingMetrics?.sources ?? {});
  const outputName = `predicoes-${selectedFile?.name.replace(/\.[^.]+$/, "") || "observacoes"}.xlsx`;

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
          {!isPreparingModel && trainingMetrics && <span className="prediction-status prediction-status-ready">Modelo pronto</span>}
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
                  <p><span>Duplicidades removidas</span><strong>{stats.duplicate_rows_removed.toLocaleString("pt-BR")}</strong></p>
                  <p><span>Registros usados</span><strong>{stats.usable_training_rows.toLocaleString("pt-BR")}</strong></p>
                </article>
              ))}
            </div>
            <div className="prediction-training-summary">
              <span><strong>{totalTrainRows.toLocaleString("pt-BR")}</strong> registros no modelo final</span>
              <span><strong>{trainingMetrics.classes.toLocaleString("pt-BR")}</strong> classes de falha</span>
              <span><strong>{trainingMetrics.duplicate_rows_removed.toLocaleString("pt-BR")}</strong> duplicidades removidas</span>
              <span><strong>{trainingMetrics.discarded_missing_observation_or_label.toLocaleString("pt-BR")}</strong> registros sem dados essenciais removidos</span>
            </div>
            <details className="prediction-evaluation">
              <summary>Avaliação do modelo no conjunto de teste (20%)</summary>
              <div className="prediction-evaluation-metrics">
                <span>Acurácia: <strong>{(trainingMetrics.accuracy * 100).toFixed(1)}%</strong></span>
                <span>Precisão macro: <strong>{(trainingMetrics.macro_precision * 100).toFixed(1)}%</strong></span>
                <span>Recall macro: <strong>{(trainingMetrics.macro_recall * 100).toFixed(1)}%</strong></span>
                <span>F1 macro: <strong>{(trainingMetrics.macro_f1 * 100).toFixed(1)}%</strong></span>
                <span>F1 ponderado: <strong>{(trainingMetrics.weighted_f1 * 100).toFixed(1)}%</strong></span>
              </div>
            </details>
          </>
        )}
      </section>

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
