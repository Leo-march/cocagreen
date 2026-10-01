"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
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

type ChartKind = "pareto" | "pizza" | "barras" | "linha";
type PeriodFilter = "all" | "7" | "30" | "90";
type FilterState = { period: PeriodFilter; dimension: string; filterColumn: string; category: string };

type ChartEntry = { name: string; value: number; accumulated?: number };

const chartKinds: { value: ChartKind; label: string }[] = [
  { value: "pareto", label: "Pareto" },
  { value: "pizza", label: "Pizza" },
  { value: "barras", label: "Barras" },
  { value: "linha", label: "Linha" },
];

const palette = ["#c9232b", "#8f1820", "#d6928d", "#806d68", "#4b2b25", "#e8b1a9", "#b34953", "#f3c6c0", "#9b4735", "#c37d77"];

const columnByPattern = (columns: string[], patterns: RegExp[]) =>
  columns.find((column) => patterns.some((pattern) => pattern.test(column.toLowerCase())));

function parseDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const brazilianDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = brazilianDate
    ? new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]))
    : new Date(text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const thousandsOnly = /^-?\d{1,3}(\.\d{3})+$/.test(text);
  const normalized = text.includes(",") || thousandsOnly ? text.replace(/\./g, "").replace(",", ".") : text;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toLabel(value: unknown) {
  const label = String(value ?? "").trim();
  return label || "Sem dado";
}

function getPeriodRows(rows: Record<string, unknown>[], dateColumn: string | undefined, period: PeriodFilter) {
  if (!dateColumn || period === "all") return rows;

  const dates = rows
    .map((row) => parseDate(row[dateColumn]))
    .filter((date): date is Date => date !== null);

  if (!dates.length) return rows;

  const latestDate = dates.reduce((latest, current) => (current > latest ? current : latest), dates[0]);
  const days = Number(period);
  const fromDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() - days + 1);
  const untilDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() + 1);

  return rows.filter((row) => {
    const date = parseDate(row[dateColumn]);
    return date ? date >= fromDate && date < untilDate : false;
  });
}

function buildChartSeries(data: DashboardData, filters: FilterState, chartKind: ChartKind) {
  const lineColumn = columnByPattern(data.columns, [/linha|line|setor|area/]);
  const equipmentColumn = columnByPattern(data.columns, [/equipamento|equipment|maquina|máquina|equipe|equip/]);
  const observationColumn = columnByPattern(data.columns, [/observa|falha|causa|motivo|defeito|incidente|problema|status|obs|descricao|comentario/]);
  const dateColumn = columnByPattern(data.columns, [/data|date|dia|mes|inicio|dt|data_hora|created/]);
  const valueColumn = columnByPattern(data.columns, [/valor|quantidade|total|tempo|minuto|consumo|emissao|energia|agua|value|amount|qtde|qtd|volume|resultado/]);

  if (!dateColumn && !valueColumn && !lineColumn && !equipmentColumn && !observationColumn) {
    return { chartData: [] as ChartEntry[], summary: "Sem dados suficientes para gerar gráficos." };
  }

  const metricColumn = valueColumn || "__count__";
  const rowsInRange = getPeriodRows(data.rows, dateColumn, filters.period);
  const groupColumn = filters.dimension || observationColumn || lineColumn || equipmentColumn || dateColumn || metricColumn;
  const filteredRows = rowsInRange.filter((row) => !filters.category || toLabel(row[filters.filterColumn]) === filters.category);

  const grouped = new Map<string, number>();
  filteredRows.forEach((row) => {
    const rawLabel = groupColumn ? toLabel(row[groupColumn]) : "Dados";
    const groupedDate = groupColumn === dateColumn ? parseDate(row[groupColumn]) : null;
    const label = groupedDate ? groupedDate.toLocaleDateString("pt-BR") : rawLabel;
    const numeric = metricColumn === "__count__" ? 1 : normalizeValue(row[metricColumn]);
    if (groupColumn && String(row[groupColumn] ?? "").trim() === "" && metricColumn !== "__count__") {
      return;
    }
    grouped.set(label, (grouped.get(label) || 0) + numeric);
  });

  const entries = Array.from(grouped, ([name, value]) => ({ name, value })).sort((first, second) => {
    if (groupColumn === dateColumn) return (parseDate(first.name)?.getTime() || 0) - (parseDate(second.name)?.getTime() || 0);
    if (chartKind === "linha") return first.name.localeCompare(second.name, "pt-BR");
    return second.value - first.value;
  });
  const totalValue = entries.reduce((sum, item) => sum + item.value, 0);

  if (!entries.length) {
    return { chartData: [], summary: "Sem dados para o filtro selecionado." };
  }

  const visibleEntries = entries.slice(0, 8);
  const remainder = entries.slice(8);
  const chartData = remainder.length > 0
    ? [...visibleEntries, { name: "Outros", value: remainder.reduce((sum, item) => sum + item.value, 0) }]
    : visibleEntries;

  let accumulated = 0;
  const paretoData = chartData.map((item) => {
    accumulated += totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    return { ...item, accumulated: Math.min(accumulated, 100) };
  });

  return {
    chartData: chartKind === "pareto" ? paretoData : chartData,
    summary: `${chartData[0]?.name ?? "Categoria"} concentra ${totalValue > 0 ? ((chartData[0]?.value ?? 0) / totalValue * 100).toFixed(1) : "0,0"}% dos registros.`,
  };
}

export default function GraphicsPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [chartKind, setChartKind] = useState<ChartKind>("pareto");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ period: "all", dimension: "", filterColumn: "", category: "" });
  const [draftFilters, setDraftFilters] = useState<FilterState>({ period: "all", dimension: "", filterColumn: "", category: "" });

  useEffect(() => {
    fetch("/api/dashboard-data")
      .then(async (response) => {
        const payload = await response.json() as { data?: DashboardData | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
        setDashboardData(payload.data || null);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados."));
  }, []);

  const dimensions = useMemo(() => dashboardData?.columns.filter((column) =>
    /linha|line|setor|area|equip|maquina|observa|falha|causa|motivo|defeito|incidente|problema|status|obs|descricao|comentario|data|date|dia|mes/i.test(column),
  ) || [], [dashboardData]);
  const selectedDimension = filters.dimension || dimensions[0] || dashboardData?.columns[0] || "";
  const selectedFilterColumn = draftFilters.filterColumn || dimensions[1] || dimensions[0] || "";
  const categories = useMemo(() => dashboardData && selectedFilterColumn
    ? Array.from(new Set(dashboardData.rows.map((row) => toLabel(row[selectedFilterColumn])).filter((label) => label !== "Sem dado"))).sort()
    : [], [dashboardData, selectedFilterColumn]);
  const activeFilterCount = Number(filters.period !== "all") + Number(!!filters.category);

  const chart = useMemo(() => {
    if (!dashboardData) return { chartData: [] as ChartEntry[], summary: "Aguardando dados." };
    return buildChartSeries(dashboardData, { ...filters, dimension: selectedDimension }, chartKind);
  }, [dashboardData, filters, selectedDimension, chartKind]);

  const clearFilters = () => {
    const cleared: FilterState = { period: "all", dimension: dimensions[0] || "", filterColumn: dimensions[1] || dimensions[0] || "", category: "" };
    setFilters(cleared);
    setDraftFilters(cleared);
  };

  const totalSum = chart.chartData.reduce((sum, item) => sum + item.value, 0);

  if (!dashboardData || !chart.chartData.length) {
    return <EmptyDashboardPage message={loadError || "Importe uma planilha para gerar gráficos automáticos por observações, linhas, equipamentos e datas."} />;
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg analysis-dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h1>Análises</h1>
          <p className="page-subtitle">Gráficos dinâmicos por dados da planilha</p>
        </div>
      </header>

      <section className="dashboard-chart-card pareto-card" aria-labelledby="graphics-title">
        <AnalysisTabs active="graficos" />

        <div className="chart-filter-panel">
          <button className="chart-filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            <span aria-hidden="true">☷</span> Filtros {activeFilterCount > 0 && <span className="chart-filter-count">{activeFilterCount}</span>}
            <span className="chart-filter-chevron" aria-hidden="true">{filtersOpen ? "⌃" : "⌄"}</span>
          </button>
          {filtersOpen && <div className="chart-filter-drawer" aria-label="Filtros dos gráficos">
            <label>Período
              <select value={draftFilters.period} onChange={(event) => setDraftFilters({ ...draftFilters, period: event.target.value as PeriodFilter })}>
                <option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
              </select>
            </label>
            <label>Analisar por
              <select value={draftFilters.dimension || dimensions[0] || ""} onChange={(event) => setDraftFilters({ ...draftFilters, dimension: event.target.value, category: "" })}>
                {dimensions.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
            <label>Filtrar por
              <select value={selectedFilterColumn} onChange={(event) => setDraftFilters({ ...draftFilters, filterColumn: event.target.value, category: "" })}>
                {dimensions.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
            <label>Categoria
              <select value={draftFilters.category} onChange={(event) => setDraftFilters({ ...draftFilters, category: event.target.value })}>
                <option value="">Todas</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <div className="chart-filter-actions">
              <button type="button" onClick={clearFilters}>Limpar</button>
              <button type="button" onClick={() => { setFilters({ ...draftFilters, dimension: draftFilters.dimension || dimensions[0] || "", filterColumn: selectedFilterColumn }); setFiltersOpen(false); }}>Aplicar filtros</button>
            </div>
          </div>}
        </div>

        <div className="chart-kind-bar" aria-label="Tipos de gráfico">
          {chartKinds.map((kind) => (
            <button
              key={kind.value}
              type="button"
              className={`chart-type-button${chartKind === kind.value ? " chart-type-button-active" : ""}`}
              onClick={() => setChartKind(kind.value)}
            >
              {kind.label}
            </button>
          ))}
        </div>

        <div className="chart-heading">
          <div>
            <p className="empty-state-kicker">GRÁFICOS DINÂMICOS</p>
            <h2 id="graphics-title">{chartKinds.find((kind) => kind.value === chartKind)?.label}</h2>
            <p>{chart.summary}</p>
          </div>
        </div>

        <div className="chart-container pareto-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            {chartKind === "pizza" ? (
              <PieChart>
                <Pie data={chart.chartData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={120} paddingAngle={2}>
                  {chart.chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Total"]} />
                <Legend />
              </PieChart>
            ) : chartKind === "linha" ? (
              <ComposedChart data={chart.chartData} margin={{ top: 16, right: 18, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#eadbd7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={70} tick={{ fill: "#806d68", fontSize: 10 }} />
                <YAxis tick={{ fill: "#806d68", fontSize: 11 }} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Valor"]} />
                <Line type="monotone" dataKey="value" stroke="#c9232b" strokeWidth={3} dot={{ fill: "#c9232b", r: 4 }} />
              </ComposedChart>
            ) : chartKind === "barras" ? (
              <BarChart data={chart.chartData} margin={{ top: 16, right: 18, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#eadbd7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={70} tick={{ fill: "#806d68", fontSize: 10 }} />
                <YAxis tick={{ fill: "#806d68", fontSize: 11 }} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Valor"]} />
                <Legend />
                <Bar dataKey="value" name="Valor" radius={[5, 5, 0, 0]} fill="#c9232b">
                  {chart.chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-bar-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <ComposedChart data={chart.chartData} margin={{ top: 16, right: 18, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#eadbd7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={70} tick={{ fill: "#806d68", fontSize: 10 }} />
                <YAxis yAxisId="value" tick={{ fill: "#806d68", fontSize: 11 }} />
                <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${Math.round(Number(value))}%`} tick={{ fill: "#c9232b", fontSize: 11 }} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Valor"]} />
                <Legend />
                <Bar yAxisId="value" dataKey="value" name="Valor" fill="#8f1820" radius={[5, 5, 0, 0]} />
                <Line yAxisId="percent" dataKey="accumulated" name="Acumulado (%)" type="monotone" stroke="#c9232b" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", stroke: "#c9232b", strokeWidth: 2 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="pareto-summary">
          <span><strong>{chart.chartData.length}</strong> categorias exibidas</span>
          <span><strong>{Number(totalSum).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong> total do filtro</span>
        </div>
      </section>
    </div>
  );
}
