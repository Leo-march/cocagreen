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
import { EmptyDashboardPage } from "@/components/empty-dashboard";

type DashboardData = {
  columns: string[];
  rows: Record<string, unknown>[];
};

type PeriodFilter = "month" | "week" | "day";

function columnByPattern(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(column.toLowerCase()));
}

function parseDate(value: unknown) {
  const date = new Date(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildParetoData(data: DashboardData, period: PeriodFilter, selectedLine: string) {
  const lineColumn = columnByPattern(data.columns, /linha|line|setor/);
  const equipmentColumn = columnByPattern(data.columns, /equipamento|equipment|maquina|máquina/);
  const failureColumn = columnByPattern(data.columns, /falha|causa|motivo|failure|cause|observa|subchave/);
  const minutesColumn = columnByPattern(data.columns, /minuto|tempo.*parado|tempo|duration|minutes/);
  const dateColumn = columnByPattern(data.columns, /data|date|inicio/);

  if (!lineColumn || !equipmentColumn || !failureColumn || !minutesColumn || !dateColumn) {
    return { data: [] };
  }

  const dates = data.rows
    .map((row) => parseDate(row[dateColumn]))
    .filter((date): date is Date => date !== null);

  const latestDate = dates.reduce((latest, current) => (current > latest ? current : latest), dates[0]);
  const days = period === "month" ? 30 : period === "week" ? 7 : 1;
  const fromDate = latestDate ? new Date(latestDate.getTime() - (days - 1) * 86400000) : null;

  const periodRows = data.rows.filter((row) => {
    const date = parseDate(row[dateColumn]);
    return date && (!fromDate || date >= fromDate);
  });

  const hasSelectedLine = selectedLine === "all" || periodRows.some((row) => String(row[lineColumn] ?? "").trim() === selectedLine);
  const rowsToAnalyze = periodRows.length > 0 && hasSelectedLine ? periodRows : data.rows;

  const grouped = new Map<string, { label: string; minutes: number; occurrences: number }>();
  rowsToAnalyze.forEach((row) => {
    const line = String(row[lineColumn] ?? "").trim();
    const equipment = String(row[equipmentColumn] ?? "").trim();
    const cause = String(row[failureColumn] ?? "").trim();
    const minutes = Number(String(row[minutesColumn] ?? "").replace(",", "."));
    const rowDate = parseDate(row[dateColumn]);

    if (!line || !equipment || !cause || !rowDate || !Number.isFinite(minutes) || minutes <= 0) return;
    if (selectedLine !== "all" && line !== selectedLine) return;

    const label = selectedLine === "all" ? line : `${line} — ${equipment}`;
    const current = grouped.get(label) || { label, minutes: 0, occurrences: 0 };
    grouped.set(label, {
      label,
      minutes: current.minutes + minutes,
      occurrences: current.occurrences + 1,
    });
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
    visible.push({ label: "Outros equipamentos", minutes: otherMinutes, occurrences: otherOccurrences, percentage: totalMinutes > 0 ? (otherMinutes / totalMinutes) * 100 : 0 });
  }

  let accumulated = 0;
  const chartData = visible.map((item) => {
    accumulated += item.percentage;
    return {
      ...item,
      accumulated: Math.min(accumulated, 100),
    };
  });

  return { data: chartData };
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [selectedLine, setSelectedLine] = useState("all");

  useEffect(() => {
    fetch("/api/dashboard-data")
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

  if (!chart.data.length) {
    return <EmptyDashboardPage message={loadError || "Insira uma planilha com colunas de linha, equipamento, falha, data e tempo em minutos para visualizar o Pareto."} />;
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
        <div className="analysis-filters" aria-label="Filtros da análise">
          <label>
            Período:
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}>
              <option value="month">Mês</option>
              <option value="week">Semana</option>
              <option value="day">Dia</option>
            </select>
          </label>
          <label>
            Setor:
            <select value={selectedLine} onChange={(event) => setSelectedLine(event.target.value)}>
              <option value="all">Todas as linhas</option>
              {lineOptions.map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
          </label>
          <span>Analisar por: <strong>{selectedLine === "all" ? "Linha" : "Equipamento"}</strong></span>
        </div>

        <div className="chart-heading">
          <div>
            <p className="empty-state-kicker">DADOS IMPORTADOS</p>
            <h2 id="chart-title">Pareto de ocorrências</h2>
            <p>Visualização do tempo acumulado por causa e linha.</p>
          </div>
          <Link href="/tabelas" className="button button-secondary">Ver tabela</Link>
        </div>

        <div className="pareto-layout">
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
                        <span><b>Falhas:</b> {Number(item.occurrences).toLocaleString("pt-BR")}</span>
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
              <strong>{chart.data.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0).toFixed(0)}% das ocorrências</strong>
              <span>estão concentradas nas 3 principais causas.</span>
            </div>
            <div className="pareto-table-wrap">
              <table className="pareto-table">
                <thead>
                  <tr><th>Causa</th><th>Ocorr.</th><th>% acum.</th></tr>
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
