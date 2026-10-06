"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import * as XLSX from "xlsx";
import { getLoggedInUser, subscribeToAuthChanges } from "@/lib/client-auth";

type ImportedTable = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type TableLoadState = {
  user: string;
  table: ImportedTable | null;
  error: string;
};

export default function TablesPage() {
  const loggedUser = useSyncExternalStore(subscribeToAuthChanges, getLoggedInUser, () => null);
  const isHydrated = useSyncExternalStore(subscribeToAuthChanges, () => true, () => false);
  const [loadState, setLoadState] = useState<TableLoadState | null>(null);

  useEffect(() => {
    if (!loggedUser) return;

    const controller = new AbortController();
    fetch("/api/dashboard-data", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: ImportedTable | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível consultar os dados.");
        setLoadState({ user: loggedUser, table: payload.data ?? null, error: "" });
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setLoadState({
          user: loggedUser,
          table: null,
          error: loadError instanceof Error ? loadError.message : "Não foi possível consultar os dados.",
        });
      });

    return () => controller.abort();
  }, [loggedUser]);

  const currentLoad = loadState?.user === loggedUser ? loadState : null;
  const table = currentLoad?.table ?? null;
  const isLoading = Boolean(loggedUser && !currentLoad);
  const error = currentLoad?.error ?? "";

  if (!isHydrated) {
    return (
      <div className="dashboard-page dashboard-with-brand-bg">
        <div className="ops-dashboard-message" role="status">Verificando acesso...</div>
      </div>
    );
  }

  if (!loggedUser) {
    return (
      <div className="dashboard-page dashboard-with-brand-bg">
        <header className="page-header">
          <div>
            <p className="eyebrow">ACESSO RESTRITO</p>
            <h1>Tabelas</h1>
          </div>
        </header>
        <section className="ops-dashboard-message" aria-labelledby="tables-access-title">
          <h2 id="tables-access-title">Entre para consultar os dados</h2>
          <p>A tabela está disponível apenas para usuários conectados.</p>
          <Link href="/login" className="button button-primary">Fazer login</Link>
        </section>
      </div>
    );
  }

  const populatedColumns = table?.columns.filter((column) =>
    table.rows.some((row) => {
      const value = row[column];
      return value !== null && value !== undefined && String(value).trim() !== "";
    }),
  ) ?? [];

  function exportTable() {
    if (!table || !populatedColumns.length) return;

    const worksheet = XLSX.utils.json_to_sheet(
      table.rows.map((row) => Object.fromEntries(
        populatedColumns.map((column) => [column, row[column] ?? ""]),
      )),
      { header: populatedColumns },
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    const filename = table.tableName.replace(/[<>:"/\\|?*]/g, "_");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg tables-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Tabelas</h1>
          <p className="page-subtitle">Consulte os dados inseridos na sua operação.</p>
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={exportTable}
            disabled={!table || !populatedColumns.length || isLoading}
          >
            Exportar Excel
          </button>
          <Link href="/inserirdados" className="button button-primary">
            Inserir dados
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="ops-dashboard-message" role="status">Carregando dados da tabela...</div>
      ) : error ? (
        <div className="ops-dashboard-message ops-dashboard-error" role="alert">
          <p>Não foi possível carregar a tabela. {error}</p>
        </div>
      ) : !table || !table.rows.length || !populatedColumns.length ? (
        <section className="dashboard-card table-empty-state" aria-labelledby="empty-tables-title">
          <div className="table-visual">
            <Image
              src="/identidade_coca-2.jpg"
              alt="Ilustração de uma garrafa Coca-Cola"
              fill
              sizes="220px"
            />
          </div>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">Nenhum registro encontrado</p>
            <h2 id="empty-tables-title">Ainda não existem dados inseridos</h2>
            <p>Quando você inserir dados, eles aparecerão aqui em formato de tabela.</p>
            <Link href="/inserirdados" className="button button-secondary">
              Voltar para inserir dados <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : (
        <section className="import-preview tables-preview" aria-label={`Dados de ${table.tableName}`}>
          <div className="preview-header">
            <h2>{table.tableName}</h2>
            <span>{table.rows.length.toLocaleString("pt-BR")} registros</span>
          </div>
          <div className="preview-scroll">
            <table>
              <thead>
                <tr>{populatedColumns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={String(row.id ?? rowIndex)}>
                    {populatedColumns.map((column) => (
                      <td key={`${rowIndex}-${column}`}>{String(row[column] ?? "")}</td>
                    ))}
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
