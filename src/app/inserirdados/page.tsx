"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { getLoggedInUser, getUserRole } from "@/lib/client-auth";

type ImportResult = {
  sheet: string;
  sheets?: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  tableName: string;
  tableNames?: string[];
};

function getVisibleColumns(columns: string[]) {
  const minutesIndex = columns.findIndex((column) => {
    const normalized = column
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    return normalized.includes("minutos") && normalized.includes("paradas");
  });
  return minutesIndex < 0 ? columns : columns.slice(0, minutesIndex + 1);
}

export default function InsertDataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const loggedUser = getLoggedInUser();
  const isAdmin = getUserRole() === "admin";
  const previewColumns = result ? getVisibleColumns(result.columns) : [];
  const previewRows = result?.rows.slice(0, 8) ?? [];

  if (!isAdmin) {
    return (
      <div className="dashboard-page dashboard-with-brand-bg login-page">
        <section className="login-card" aria-labelledby="readonly-title">
          <p className="eyebrow">ACESSO RESTRITO</p>
          <h1 id="readonly-title">Modo visitante</h1>
          <p className="page-subtitle">
            {loggedUser ? `${loggedUser} está visualizando em modo somente leitura.` : "Você está em modo somente leitura."}
          </p>
          <p className="login-error" role="alert">Somente a Talita pode importar e editar dados.</p>
          <Link className="button button-primary login-submit" href="/dashboard">
            Voltar para visualização
          </Link>
        </section>
      </div>
    );
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    setError("");
  }

  async function importFile() {
    if (!selectedFile) {
      setError("Selecione uma planilha Excel antes de importar.");
      return;
    }

    setIsImporting(true);
    setError("");
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/importar-excel", { method: "POST", body: formData });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível importar a planilha.");
      }
      setResult(data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Erro ao importar a planilha.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Inserir dados</h1>
          <p className="page-subtitle">Envie uma tabela Excel para alimentar seus indicadores.</p>
        </div>
      </header>
      <section className="dashboard-card import-card" aria-labelledby="insert-title">
        <div className="insert-content">
          <h2 id="insert-title">Importe sua tabela Excel</h2>
          <p>Selecione um arquivo .xlsx, .xld ou .xls com os dados da sua operação.</p>
          <label className="file-picker">
            <span>{selectedFile?.name || "Escolher arquivo Excel"}</span>
            <input type="file" accept=".xlsx,.xld,.xls" onChange={selectFile} />
          </label>
          <button className="button button-secondary import-button" type="button" onClick={importFile} disabled={isImporting}>
            {isImporting ? "Importando..." : "Importar tabela"}
          </button>
          {error && <p className="import-error" role="alert">{error}</p>}
          {result && (
            <p className="import-success" role="status">
              {result.sheets && result.sheets.length > 1
                ? `Abas ${result.sheets.map((sheet) => `“${sheet}”`).join(", ")} importadas com ${result.totalRows} linha(s) no total.`
                : `Aba “${result.sheet}” importada com ${result.totalRows} linha(s).`} Tabela criada/atualizada: {result.tableName}. Prévia disponível abaixo.
            </p>
          )}
        </div>
        <div className="insert-visual">
          <Image src="/identidade_coca-2.jpg" alt="Ilustração de uma garrafa Coca-Cola" fill sizes="240px" />
        </div>
      </section>
      {result && (
        <section className="import-preview" aria-label="Prévia dos dados importados">
          <div className="preview-header">
            <h2>Prévia da tabela</h2>
            <span>
              {Math.min(previewRows.length, result.totalRows) < result.totalRows
                ? `Prévia: ${Math.min(previewRows.length, result.totalRows)} de ${result.totalRows} linhas`
                : `${result.totalRows} linha(s)`}
            </span>
          </div>
          <div className="preview-scroll">
            <table
              className="import-preview-table"
              style={{ width: `${Math.max(previewColumns.length, 1) * 200}px` }}
            >
              <thead>
                <tr>{previewColumns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {previewColumns.map((column) => <td key={`${rowIndex}-${column}`}>{String(row[column] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
