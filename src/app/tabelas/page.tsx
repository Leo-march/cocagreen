"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type ImportedTable = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

export default function TablesPage() {
  const [tableData, setTableData] = useState<ImportedTable | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard-data")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: ImportedTable | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a tabela.");
        setTableData(payload.data || null);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados."));
  }, []);

  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Tabelas</h1>
          <p className="page-subtitle">Consulte a última tabela importada para a operação.</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">
          Inserir dados
        </Link>
      </header>

      {tableData ? (
        <section className="import-preview" aria-label="Tabela importada completa">
          <div className="preview-header">
            <h2>{tableData.tableName}</h2>
            <span>{tableData.rows.length} linha(s)</span>
          </div>
          <div className="preview-scroll">
            <table>
              <thead>
                <tr>
                  {tableData.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIndex) => (
                  <tr key={`${tableData.tableName}-${rowIndex}`}>
                    {tableData.columns.map((column) => (
                      <td key={`${tableData.tableName}-${rowIndex}-${column}`}>
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="dashboard-card table-empty-state" aria-labelledby="empty-tables-title">
          <div className="table-visual">
            <Image
              src="/identidade_coca-2.jpg"
              alt="Ilustração de uma garrafa Coca-Cola"
              fill
              sizes="220px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">{loadError ? "Erro ao carregar" : "Nenhum registro encontrado"}</p>
            <h2 id="empty-tables-title">{loadError || "Ainda não existem dados inseridos"}</h2>
            <p>
              {loadError || "Quando você importar uma planilha, ela aparecerá aqui em formato completo para consulta e acompanhamento."}
            </p>
            <Link href="/inserirdados" className="button button-secondary">
              Voltar para inserir dados <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
