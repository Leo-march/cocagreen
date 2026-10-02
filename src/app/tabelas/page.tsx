"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ImportedTable = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
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

export default function TablesPage() {
  const [table, setTable] = useState<ImportedTable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const visibleColumns = table ? getVisibleColumns(table.columns) : [];

  useEffect(() => {
    let isActive = true;

    async function loadTable() {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`/api/tabelas?page=${page}`, { cache: "no-store" });
        const result = (await response.json()) as { data?: ImportedTable | null; error?: string };
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar a tabela.");
        if (isActive) setTable(result.data ?? null);
      } catch (loadError) {
        if (isActive) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a tabela.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadTable();
    return () => { isActive = false; };
  }, [page]);

  return (
    <div className="dashboard-page dashboard-with-brand-bg tables-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Tabelas</h1>
          <p className="page-subtitle">Consulte todos os dados inseridos na sua operação.</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
      </header>

      {isLoading ? (
        <section className="tables-message" role="status">Carregando tabela...</section>
      ) : error ? (
        <section className="tables-message tables-message-error" role="alert">
          <h2>Não foi possível carregar os dados</h2>
          <p>{error}</p>
        </section>
      ) : !table || table.totalRows === 0 ? (
        <section className="tables-message">
          <div>
            <p className="empty-state-kicker">Nenhum registro encontrado</p>
            <h2>Ainda não existem dados inseridos</h2>
            <p>Quando você importar uma planilha, os registros completos aparecerão aqui para consulta.</p>
            <Link href="/inserirdados" className="button button-secondary">Inserir dados <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      ) : (
        <section className="import-preview tables-full-view" aria-label="Tabela completa dos dados importados">
          <div className="preview-header">
            <div className="tables-title">
              <h2>Planilha importada</h2>
              <span className="tables-name">{table.tableName}</span>
            </div>
            <span>{table.totalRows} linha(s)</span>
          </div>
          <div className="preview-scroll tables-scroll" tabIndex={0} role="region" aria-label="Tabela; use as setas para rolar horizontalmente">
            <table>
              <thead>
                <tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={String(row.id ?? rowIndex)}>
                    {visibleColumns.map((column) => <td key={`${rowIndex}-${column}`}>{String(row[column] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tables-pagination" aria-label="Navegação da tabela">
            <span>Linhas {((page - 1) * 100) + 1}–{Math.min(page * 100, table.totalRows)} de {table.totalRows}</span>
            <div>
              <button type="button" className="tables-page-button" disabled={page === 1 || isLoading} onClick={() => setPage((current) => current - 1)}>Anterior</button>
              <span>Página {page} de {Math.ceil(table.totalRows / 100)}</span>
              <button type="button" className="tables-page-button" disabled={page * 100 >= table.totalRows || isLoading} onClick={() => setPage((current) => current + 1)}>Próxima</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
