"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardData = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

function findTimeColumn(columns: string[]) {
  return columns.find((column) => /hora|horario|hour|time|data/.test(column.toLowerCase()));
}

function findValueColumn(columns: string[], timeColumn?: string) {
  return columns.find((column) => column !== timeColumn && /valor|quantidade|total|consumo|emissao|energia|agua|value|amount/.test(column.toLowerCase()))
    || columns.find((column) => column !== timeColumn);
}

function buildHourlyData(data: DashboardData) {
  const timeColumn = findTimeColumn(data.columns);
  const valueColumn = findValueColumn(data.columns, timeColumn);
  if (!timeColumn || !valueColumn) return { data: [], timeColumn, valueColumn };

  const grouped = new Map<string, number>();
  data.rows.forEach((row) => {
    const rawTime = String(row[timeColumn] ?? "");
    const hourMatch = rawTime.match(/(?:^|T|\s)(\d{1,2})(?::\d{2})?/);
    const hour = hourMatch ? `${hourMatch[1].padStart(2, "0")}h` : rawTime || "Sem horário";
    const value = Number(String(row[valueColumn] ?? "").replace(",", "."));
    if (!Number.isNaN(value)) grouped.set(hour, (grouped.get(hour) || 0) + value);
  });

  return {
    data: Array.from(grouped, ([hour, value]) => ({ hour, value })),
    timeColumn,
    valueColumn,
  };
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard-data")
      .then(async (response) => {
        const payload = await response.json() as { data?: DashboardData | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o dashboard.");
        setDashboardData(payload.data || null);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados."));
  }, []);

  const chart = useMemo(() => dashboardData ? buildHourlyData(dashboardData) : { data: [], timeColumn: undefined, valueColumn: undefined }, [dashboardData]);
  const hasChart = chart.data.length > 0;

  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h1>Análises</h1>
          <p className="page-subtitle">Indicadores de manutenção e falhas</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
      </header>

      {hasChart ? (
        <section className="dashboard-chart-card" aria-labelledby="chart-title">
          <div className="chart-heading">
            <div>
              <p className="empty-state-kicker">DADOS IMPORTADOS</p>
              <h2 id="chart-title">Indicadores por horário</h2>
              <p>Visualização da coluna <strong>{chart.valueColumn}</strong> agrupada por <strong>{chart.timeColumn}</strong>.</p>
            </div>
            <Link href="/tabelas" className="button button-secondary">Ver tabela</Link>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#eadbd7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#806d68", fontSize: 12 }} />
                <YAxis tick={{ fill: "#806d68", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name={chart.valueColumn || "Valor"} fill="#c9232b" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <section className="dashboard-card" aria-labelledby="empty-dashboard-title">
          <div className="dashboard-visual">
            <Image src="/identidade_coca-1.jpg" alt="Garrafa Coca-Cola cercada por tampas vermelhas" fill sizes="(max-width: 700px) 100vw, 38vw" priority />
            <div className="dashboard-visual-caption">Seu impacto em um só lugar</div>
          </div>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">Tudo pronto para começar</p>
            <h2 id="empty-dashboard-title">Ainda não existem dados para analisar</h2>
            <p>{loadError || "Insira uma planilha com uma coluna de horário e um valor numérico para visualizar seus indicadores."}</p>
            <Link href="/inserirdados" className="button button-secondary">Ir para inserção de dados <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      )}
    </div>
  );
}
