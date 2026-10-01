  "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalysisTabs } from "@/components/analysis-tabs";
import { ChartFilters, type ChartFilterValues } from "@/components/chart-filters";
import { EmptyDashboardPage } from "@/components/empty-dashboard";
import { parseChartDate, parseChartNumber } from "@/lib/chart-normalize";

type DashboardData = {
  columns: string[];
  rows: Record<string, unknown>[];
};

type PeriodFilter = "month" | "week" | "day";

function columnByPattern(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(column.toLowerCase()));
}

function parseDate(value: unknown) {
  return parseChartDate(value);
}

function buildParetoData(data: DashboardData, period: PeriodFilter, selectedLine: string) {
  const lineColumn = columnByPattern(data.columns, /linha|line|setor/);
  const causeColumns = [
    columnByPattern(data.columns, /subchave|subcause/),
    columnByPattern(data.columns, /chave_1|failure|cause|falha|causa|motivo/),
    columnByPattern(data.columns, /observa/),
    columnByPattern(data.columns, /equipamento|equipment|maquina|machine|chave.*parada/),
  ].filter((column, index, columns): column is string => Boolean(column) && columns.indexOf(column) === index);
  const minutesColumn = columnByPattern(data.columns, /^minutos_de_paradas$/)
    || columnByPattern(data.columns, /minuto.*parada|total.*minuto|tempo.*parado|duration|minutes/);
  const dateColumn = columnByPattern(data.columns, /data|date|inicio/);

  if (!minutesColumn || !dateColumn) return { data: [] };

  const dates = data.rows
    .map((row) => parseDate(row[dateColumn]))
    .filter((date): date is Date => date !== null);
  if (!dates.length) return { data: [] };

  const latestDate = dates.reduce((latest, current) => (current > latest ? current : latest), dates[0]);
  const days = period === "month" ? 30 : period === "week" ? 7 : 1;
  const fromDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() - days + 1);
  const untilDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() + 1);

  const grouped = new Map<string, { label: string; minutes: number; occurrences: number }>();
  data.rows.forEach((row) => {
    const date = parseDate(row[dateColumn]);
    if (!date || date < fromDate || date >= untilDate) return;
    const line = lineColumn ? String(row[lineColumn] ?? "").trim() : "";
    if (selectedLine !== "all" && line !== selectedLine) return;

    const minutes = parseChartNumber(row[minutesColumn]);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const label = causeColumns.map((column) => String(row[column] ?? "").trim()).find(Boolean)
      || (line ? `Paradas em ${line}` : "Paradas sem causa informada");
    const current = grouped.get(label) || { label, minutes: 0, occurrences: 0 };
    grouped.set(label, { label, minutes: current.minutes + minutes, occurrences: current.occurrences + 1 });
  });

  const sorted = Array.from(grouped.values()).sort((first, second) => second.minutes - first.minutes);
  const totalMinutes = sorted.reduce((sum, item) => sum + item.minutes, 0);
  const withPercent = sorted.map((item) => ({
    ...item,
    percentage: totalMinutes > 0 ? (item.minutes / totalMinutes) * 100 : 0,
  }));
  const visible = withPercent.slice(0, 12);
  const otherItems = withPercent.slice(12);
  if (otherItems.length > 0) {
    const otherMinutes = otherItems.reduce((sum, item) => sum + item.minutes, 0);
    const otherOccurrences = otherItems.reduce((sum, item) => sum + item.occurrences, 0);
    visible.push({ label: "Outras causas", minutes: otherMinutes, occurrences: otherOccurrences, percentage: totalMinutes > 0 ? (otherMinutes / totalMinutes) * 100 : 0 });
  }

  let accumulated = 0;
  const chartData = visible.map((item) => {
    accumulated += item.percentage;
    return { ...item, accumulated: Math.min(accumulated, 100) };
  });
  return { data: chartData };
}
export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [selectedLine, setSelectedLine] = useState("all");

  useEffect(() => {
    fetch("/api/dashboard-data?view=pareto")
      .then(async (response) => {
        const payload = await response.json() as { data?: DashboardData | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
        setDashboardData(payload.data || null);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados."));
  }, []);

  const lineOptions = useMemo(() => {
    if (!dashboardData) return [];
    const lineColumn = columnByPattern(dashboardData.columns, /linha|line|setor/);
    if (!lineColumn) return [];
    return Array.from(new Set(dashboardData.rows.map((row) => String(row[lineColumn] ?? "").trim()).filter(Boolean))).sort();
  }, [dashboardData]);

  const chart = useMemo(
    () => (dashboardData ? buildParetoData(dashboardData, period, selectedLine) : { data: [] }),
    [dashboardData, period, selectedLine],
  );

  if (!dashboardData) {
    return <EmptyDashboardPage message={loadError || "Importe uma planilha com data de início e minutos de parada para visualizar o Pareto."} />;
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg analysis-dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h1>Análises</h1>
          <p className="page-subtitle">Indicadores de manutenção e falhas</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
      </header>

      <section className="dashboard-chart-card pareto-card" aria-labelledby="chart-title">
        <AnalysisTabs active="pareto" />
        <ChartFilters
          groups={[
            { id: "period", label: "Período", options: [{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }], defaultValue: ["month"] },
            { id: "line", label: "Linha", help: "Selecione uma linha para limitar a análise.", options: [{ value: "all", label: "Todas as linhas" }, ...lineOptions.map((line) => ({ value: line, label: line }))], defaultValue: ["all"] },
          ]}
          value={{ period: [period], line: [selectedLine] }}
          onApply={(next: ChartFilterValues) => { setPeriod((next.period?.[0] || "month") as PeriodFilter); setSelectedLine(next.line?.[0] || "all"); }}
        />
        <div className="chart-heading">
          <div>
            <p className="empty-state-kicker">DADOS IMPORTADOS</p>
            <h2 id="chart-title">Pareto de tempo parado</h2>
            <p>Tempo parado acumulado por causa, com participação de cada causa no total.</p>
          </div>
          <Link href="/tabelas" className="button button-secondary">Ver tabela</Link>
        </div>

        {!chart.data.length && <div className="chart-empty-message" role="status">Nenhum registro corresponde aos filtros. Ajuste as opções ou limpe os filtros.</div>}

        <div className={`pareto-layout${chart.data.length ? "" : " chart-empty-layout"}`}>
          <div className="chart-container pareto-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart.data} margin={{ top: 16, right: 16, left: 0, bottom: 45 }}>
                <CartesianGrid stroke="#eadbd7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" angle={-28} textAnchor="end" interval={0} height={78} tick={{ fill: "#806d68", fontSize: 10 }} />
                <YAxis yAxisId="minutes" tick={{ fill: "#806d68", fontSize: 12 }} label={{ value: "Tempo (min)", angle: -90, position: "insideLeft", fill: "#806d68", fontSize: 11 }} />
                <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} allowDataOverflow={false} tickFormatter={(value) => `${Math.min(100, Math.round(Number(value)))}%`} tick={{ fill: "#c9232b", fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    const item = payload?.[0]?.payload;
                    if (!active || !item) return null;

                    return (
                      <div className="pareto-tooltip">
                        <strong>{item.label}</strong>
                        <span><b>Tempo:</b> {Number(item.minutes).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min</span>
                        <span><b>Percentual:</b> {Number(item.percentage).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                        <span><b>Registros:</b> {Number(item.occurrences).toLocaleString("pt-BR")}</span>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={30} />
                <ReferenceLine yAxisId="percent" y={80} stroke="#d6928d" strokeDasharray="4 4" label={{ value: "80%", fill: "#c9232b", fontSize: 11 }} />
                <Bar yAxisId="minutes" dataKey="minutes" name="Tempo em minutos" fill="#8f1820" radius={[3, 3, 0, 0]} />
                <Line yAxisId="percent" dataKey="accumulated" name="Acumulado" type="monotone" stroke="#c9232b" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", stroke: "#c9232b", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <aside className="pareto-side-panel">
            <div className="pareto-insight">
              <p>INSIGHT</p>
              <strong>{chart.data.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0).toFixed(0)}% do tempo parado</strong>
              <span>está concentrado nas 3 principais causas.</span>
            </div>
            <div className="pareto-table-wrap">
              <table className="pareto-table">
                <thead>
                  <tr><th>Causa / sistema</th><th>Registros</th><th>% acum.</th></tr>
                </thead>
                <tbody>
                  {chart.data.slice(0, 7).map((item) => (
                    <tr key={item.label}>
                      <td title={item.label}>{item.label}</td>
                      <td>{item.occurrences}</td>
                      <td>{item.accumulated.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </div>

        <div className="pareto-summary">
          <span><strong>{chart.data.length}</strong> grupos exibidos</span>
          <span><strong>{chart.data[0]?.label}</strong> concentra {chart.data[0]?.accumulated.toFixed(1)}% do tempo</span>
        </div>
      </section>
    </div>
  );
}
