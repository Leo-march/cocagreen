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
import { ChartFilters, type ChartFilterGroup, type ChartFilterValues } from "@/components/chart-filters";
import { EmptyDashboardPage } from "@/components/empty-dashboard";
import { SupplementalCharts, type ChartType } from "@/components/supplemental-charts";
import { parseChartDate, parseChartNumber } from "@/lib/chart-normalize";

type DashboardData = {
  columns: string[];
  rows: Record<string, unknown>[];
};

type ChartKind = "pizza" | "barras" | "linha" | ChartType;
type PeriodFilter = "all" | "7" | "30" | "90";
type FilterState = { period: PeriodFilter; dimension: string; filterColumn: string; categories: string[] };

type ChartEntry = { name: string; value: number };

const chartKinds: { value: ChartKind; label: string }[] = [
  { value: "pizza", label: "Pizza" },
  { value: "barras", label: "Barras" },
  { value: "linha", label: "Linha" },
  { value: "criticality", label: "Criticidade" },
  { value: "projection", label: "Projeção" },
  { value: "waterfall", label: "Cascata de paradas" },
];

const palette = ["#c9232b", "#8f1820", "#d6928d", "#806d68", "#4b2b25", "#e8b1a9", "#b34953", "#f3c6c0", "#9b4735", "#c37d77"];
const isBasicChart = (kind: ChartKind): kind is "pizza" | "barras" | "linha" => kind === "pizza" || kind === "barras" || kind === "linha";

const columnByPattern = (columns: string[], patterns: RegExp[]) =>
  columns.find((column) => patterns.some((pattern) => pattern.test(column.toLowerCase())));

function parseDate(value: unknown) {
  return parseChartDate(value);
}

function normalizeValue(value: unknown) {
  return parseChartNumber(value);
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
  const filteredRows = rowsInRange.filter((row) => !filters.categories.length || filters.categories.includes(toLabel(row[filters.filterColumn])));

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

  return {
    chartData,
    summary: `${chartData[0]?.name ?? "Categoria"} concentra ${totalValue > 0 ? ((chartData[0]?.value ?? 0) / totalValue * 100).toFixed(1) : "0,0"}% dos registros.`,
  };
}

export default function GraphicsPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [chartKind, setChartKind] = useState<ChartKind>("pizza");
  const [filters, setFilters] = useState<FilterState>({ period: "all", dimension: "", filterColumn: "", categories: [] });
  const [draftCategoryColumn, setDraftCategoryColumn] = useState("");

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
  const dimensionOptions = dimensions.length ? dimensions : dashboardData?.columns.slice(0, 1) || [];
  const defaultGroupColumn = dimensionOptions[0] || "";
  const defaultFilterColumn = dimensionOptions[1] || dimensionOptions[0] || "";
  const filterOptions = (column: string) => dashboardData && column
    ? Array.from(new Set(dashboardData.rows.map((row) => toLabel(row[column])).filter((label) => label !== "Sem dado"))).sort()
    : [];
  const groups: ChartFilterGroup[] = [
    { id: "period", label: "Período", options: [{ value: "all", label: "Todo o período" }, { value: "7", label: "Últimos 7 dias" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }], defaultValue: ["all"] },
    { id: "dimension", label: "Agrupar gráfico por", help: "Define o que cada barra, fatia ou ponto representa.", options: dimensionOptions.map((column) => ({ value: column, label: column })), defaultValue: [defaultGroupColumn] },
    { id: "filterColumn", label: "Restringir dados por", help: "Define quais linhas entram. Para comparar categorias, escolha uma coluna diferente da usada para agrupar.", options: dimensionOptions.map((column) => ({ value: column, label: column })), defaultValue: [defaultFilterColumn], resetOnChange: ["categories"] },
    { id: "categories", label: `Categorias em ${draftCategoryColumn || defaultFilterColumn}`, help: "Selecione uma ou mais opções. Sem seleção, todas entram na análise.", options: filterOptions(draftCategoryColumn || defaultFilterColumn).map((label) => ({ value: label, label })), multiple: true, selectAllLabel: "Selecionar todas" },
  ];

  const chart = useMemo(() => {
    if (!dashboardData) return { chartData: [] as ChartEntry[], summary: "Aguardando dados." };
    return buildChartSeries(dashboardData, { ...filters, dimension: selectedDimension }, isBasicChart(chartKind) ? chartKind : "pizza");
  }, [dashboardData, filters, selectedDimension, chartKind]);

  const totalSum = chart.chartData.reduce((sum, item) => sum + item.value, 0);

  if (!dashboardData) {
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

        {isBasicChart(chartKind) && <ChartFilters
          groups={groups}
          value={{ period: [filters.period], dimension: [selectedDimension], filterColumn: [filters.filterColumn || defaultFilterColumn], categories: filters.categories }}
          onDraftChange={(next) => setDraftCategoryColumn(next.filterColumn?.[0] || defaultFilterColumn)}
          onApply={(next: ChartFilterValues) => {
            const filterColumn = next.filterColumn?.[0] || defaultFilterColumn;
            const validCategories = new Set(filterOptions(filterColumn));
            setFilters({
              period: (next.period?.[0] || "all") as PeriodFilter,
              dimension: next.dimension?.[0] || defaultGroupColumn,
              filterColumn,
              categories: (next.categories || []).filter((category) => validCategories.has(category)),
            });
            setDraftCategoryColumn(filterColumn);
          }}
        />}
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

        {!isBasicChart(chartKind) && <SupplementalCharts chartType={chartKind} />}

        {isBasicChart(chartKind) && <>
        <div className="chart-heading">
          <div>
            <p className="empty-state-kicker">GRÁFICOS DINÂMICOS</p>
            <h2 id="graphics-title">{chartKinds.find((kind) => kind.value === chartKind)?.label}</h2>
            <p>{chart.summary}</p>
          </div>
        </div>

        {chart.chartData.length ? <div className="chart-container pareto-chart-container">
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
            ) : null}
          </ResponsiveContainer>
        </div> : <div className="chart-empty-message" role="status">{chart.summary}. Ajuste ou limpe os filtros para ver mais resultados.</div>}

        {chart.chartData.length > 0 && <div className="pareto-summary">
          <span><strong>{chart.chartData.length}</strong> categorias exibidas</span>
          <span><strong>{Number(totalSum).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong> total do filtro</span>
        </div>}
        </>}
      </section>
    </div>
  );
}
