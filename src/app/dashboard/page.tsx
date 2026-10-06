"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

type Occurrence = {
  date: Date;
  equipment: string;
  cause: string;
  category: string;
  minutes: number | null;
};

type CauseTotal = {
  name: string;
  minutes: number;
  percentage: number;
};

type DashboardSummary = {
  month: Date;
  causeGroupLabel: string;
  assetLabel: string;
  assetSingular: string;
  hasAssets: boolean;
  hasMinutes: boolean;
  occurrences: Occurrence[];
  daily: { label: string; count: number }[];
  causes: CauseTotal[];
  totalMinutes: number | null;
  averageMinutes: number | null;
  affectedEquipment: number;
  recent: Occurrence[];
};

const causeColors = ["#8f1820", "#c9232b", "#d45d61", "#d6928d", "#e7aaa2", "#806d68"];

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function findPopulatedColumn(data: DashboardData, pattern: RegExp) {
  return data.columns.find((column) =>
    pattern.test(normalizeText(column))
    && data.rows.some((row) => String(row[column] ?? "").trim() !== ""),
  );
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;

  const brazilianDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brazilianDate) {
    const date = new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4,6}(?:[.,]\d+)?$/.test(text)) {
    const serial = Number(text.replace(",", "."));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMinutes(value: unknown): number | null {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const minutes = Number(normalized);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildSummary(data: DashboardData): DashboardSummary | null {
  const dateColumn = findPopulatedColumn(data, /data|date|inicio|abertura|ocorrencia/);
  if (!dateColumn) return null;

  const minutesColumn = findPopulatedColumn(data, /minuto.*parada|total.*minuto|tempo|minute|duration|duracao/)
    ?? findPopulatedColumn(data, /minuto/);
  const equipmentColumn = findPopulatedColumn(data, /equipamento|equipment|maquina|machine|descripcion.*equipo|equipo_padre|tecnica.*tag/);
  const lineColumn = findPopulatedColumn(data, /linha|line/);
  const assetColumn = equipmentColumn ?? lineColumn;
  const causeColumn = findPopulatedColumn(data, /chave.*parada|subchave|observa|failure|cause|causa|motivo|defeito|falha/)
    ?? findPopulatedColumn(data, /tipo.*parada/);

  const allOccurrences = data.rows.flatMap((row) => {
    const date = parseDate(row[dateColumn]);
    if (!date) return [];
    const equipment = String(assetColumn ? row[assetColumn] ?? "" : "").trim();
    const cause = String(causeColumn ? row[causeColumn] ?? "" : "").trim();
    const normalizedCause = cause || "Causa não informada";
    return [{
      date,
      equipment: equipment || (equipmentColumn
        ? "Equipamento não informado"
        : lineColumn ? "Linha não informada" : "Ativo não informado"),
      cause: normalizedCause,
      category: causeColumn ? normalizedCause : equipment || "Categoria não informada",
      minutes: minutesColumn ? parseMinutes(row[minutesColumn]) : null,
    }];
  });

  if (!allOccurrences.length) return null;

  const latestDate = allOccurrences.reduce(
    (latest, occurrence) => occurrence.date > latest ? occurrence.date : latest,
    allOccurrences[0].date,
  );
  const month = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
  const occurrences = allOccurrences.sort((first, second) => second.date.getTime() - first.date.getTime());
  const totalMinutesValues = occurrences.flatMap(({ minutes }) => minutes === null ? [] : [minutes]);
  const totalMinutes = totalMinutesValues.length
    ? totalMinutesValues.reduce((sum, minutes) => sum + minutes, 0)
    : null;
  const averageMinutes = totalMinutesValues.length
    ? totalMinutesValues.reduce((sum, minutes) => sum + minutes, 0) / totalMinutesValues.length
    : null;
  const latestMonthDate = occurrences[0]?.date ?? latestDate;
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latestMonthDate.getFullYear(), latestMonthDate.getMonth(), latestMonthDate.getDate() - 6 + index);
    const count = allOccurrences.filter((occurrence) => getDayKey(occurrence.date) === getDayKey(date)).length;
    return {
      label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", ""),
      count,
    };
  });
  const causeMinutes = new Map<string, number>();
  occurrences.forEach(({ category, minutes }) => {
    if (minutes !== null && minutes > 0) {
      causeMinutes.set(category, (causeMinutes.get(category) ?? 0) + minutes);
    }
  });
  const causeTotals = Array.from(causeMinutes, ([name, minutes]) => ({ name, minutes }))
    .sort((first, second) => second.minutes - first.minutes);
  const topCauses = causeTotals.slice(0, 5);
  const otherMinutes = causeTotals.slice(5).reduce((sum, cause) => sum + cause.minutes, 0);
  if (otherMinutes > 0) topCauses.push({ name: "Outras causas", minutes: otherMinutes });
  const causeGrandTotal = causeTotals.reduce((sum, cause) => sum + cause.minutes, 0);
  const causes = topCauses.map((cause) => ({
    ...cause,
    percentage: causeGrandTotal ? (cause.minutes / causeGrandTotal) * 100 : 0,
  }));
  const affectedEquipment = new Set(
    occurrences
      .filter(({ minutes }) => minutes === null || minutes > 0)
      .map(({ equipment }) => equipment)
      .filter((equipment) => equipment !== "Equipamento não informado" && equipment !== "Linha não informada" && equipment !== "Ativo não informado"),
  ).size;

  return {
    month,
    causeGroupLabel: causeColumn ? "causa" : equipmentColumn ? "equipamento" : lineColumn ? "linha" : "categoria",
    assetLabel: equipmentColumn ? "Equipamentos afetados" : lineColumn ? "Linhas afetadas" : "Ativos afetados",
    assetSingular: equipmentColumn ? "Equipamento" : lineColumn ? "Linha" : "Ativo",
    hasAssets: Boolean(assetColumn),
    hasMinutes: Boolean(minutesColumn),
    occurrences,
    daily,
    causes,
    totalMinutes,
    averageMinutes,
    affectedEquipment,
    recent: occurrences.slice(0, 5),
  };
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) return "—";
  const roundedMinutes = Math.round(minutes);
  if (roundedMinutes < 60) return `${roundedMinutes.toLocaleString("pt-BR")} min`;
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard-data", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: DashboardData | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
        setDashboardData(payload.data ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const lineColumn = dashboardData ? findPopulatedColumn(dashboardData, /linha|line/) : undefined;
  const dateColumn = dashboardData ? findPopulatedColumn(dashboardData, /data|date|inicio|abertura|ocorrencia/) : undefined;
  const lineOptions = useMemo(
    () => dashboardData && lineColumn
      ? Array.from(new Set(dashboardData.rows.map((row) => String(row[lineColumn] ?? "").trim()).filter(Boolean))).sort()
      : [],
    [dashboardData, lineColumn],
  );
  const filteredData = useMemo(() => {
    if (!dashboardData || !dateColumn) return dashboardData;
    const dates = dashboardData.rows.map((row) => parseDate(row[dateColumn])).filter((date): date is Date => date !== null);
    const latestDate = dates.reduce<Date | null>((latest, date) => !latest || date > latest ? date : latest, null);
    if (!latestDate) return dashboardData;
    const periodDays = selectedPeriod === "week" ? 7 : 30;
    const startDate = selectedPeriod === "month"
      ? new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
      : new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() - periodDays + 1);
    return {
      ...dashboardData,
      rows: dashboardData.rows.filter((row) => {
        const date = parseDate(row[dateColumn]);
        const matchesLine = selectedLine === "all" || String(row[lineColumn ?? ""] ?? "").trim() === selectedLine;
        return matchesLine && date !== null && date >= startDate && date <= latestDate;
      }),
    };
  }, [dashboardData, dateColumn, lineColumn, selectedLine, selectedPeriod]);
  const summary = useMemo(
    () => filteredData ? buildSummary(filteredData) : null,
    [filteredData],
  );

  return (
    <div className="dashboard-page dashboard-with-brand-bg ops-dashboard-page">
      <header className="ops-dashboard-header">
        <div>
          <h1>Painel de Manutenção</h1>
          <p className="page-subtitle">
            {summary
              ? `Visão geral da operação · ${summary.month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
              : "Visão geral de falhas e tempo de parada."}
          </p>
        </div>
        <div className="ops-dashboard-filters" aria-label="Filtros do painel">
          <label>
            <span className="visually-hidden">Linha</span>
            <select value={selectedLine} onChange={(event) => setSelectedLine(event.target.value)}>
              <option value="all">Todas as linhas</option>
              {lineOptions.map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Período</span>
            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value as "week" | "month")}>
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
            </select>
          </label>
        </div>
      </header>

      {isLoading ? (
        <div className="ops-dashboard-message" role="status">Carregando dados da operação...</div>
      ) : loadError ? (
        <div className="ops-dashboard-message ops-dashboard-error" role="alert">
          <p>Não foi possível carregar os indicadores. {loadError}</p>
          <Link href="/tabelas">Consultar dados</Link>
        </div>
      ) : !dashboardData || !dashboardData.rows.length ? (
        <div className="ops-dashboard-message">
          <h2>Sem dados de operação</h2>
          <p>Importe uma planilha para acompanhar falhas, tempos de parada e equipamentos afetados.</p>
          <Link href="/inserirdados" className="button button-primary">Importar planilha</Link>
        </div>
      ) : !summary || !summary.occurrences.length ? (
        <div className="ops-dashboard-message">
          <h2>{summary ? "Sem ocorrências neste período" : "Não foi possível identificar as datas"}</h2>
          <p>{summary
            ? "Altere os filtros para consultar outro recorte da operação."
            : "Confira se a planilha contém uma coluna de data reconhecível para gerar os indicadores."}</p>
          <Link href="/tabelas">Conferir registros</Link>
        </div>
      ) : (
        <DashboardContent summary={summary} />
      )}
    </div>
  );
}

function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    {
      label: "Ocorrências no mês",
      value: summary.occurrences.length.toLocaleString("pt-BR"),
      detail: "registros no período",
      tone: "red",
    },
    {
      label: "Tempo parado",
      value: summary.hasMinutes ? formatMinutes(summary.totalMinutes) : "—",
      detail: summary.hasMinutes ? "total registrado" : "coluna de tempo não identificada",
      tone: "brown",
    },
    {
      label: "Tempo médio por ocorrência",
      value: summary.hasMinutes ? formatMinutes(summary.averageMinutes) : "—",
      detail: "média no mês",
      tone: "pink",
    },
    {
      label: summary.assetLabel,
      value: summary.hasAssets ? summary.affectedEquipment.toLocaleString("pt-BR") : "—",
      detail: summary.hasAssets ? "com registros no mês" : "coluna de ativo não identificada",
      tone: "orange",
    },
  ];

  return (
    <>
      <section className="ops-metrics" aria-label="Indicadores do mês">
        {metrics.map((metric) => (
          <article className={`ops-metric-card ops-metric-${metric.tone}`} key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      <div className="ops-dashboard-grid">
        <div className="ops-dashboard-main">
          <section className="ops-panel ops-trends-panel" aria-labelledby="daily-failures-title">
            <div className="ops-panel-heading">
              <div>
                <p className="ops-panel-kicker">ÚLTIMOS 7 DIAS ATÉ O REGISTRO MAIS RECENTE</p>
                <h2 id="daily-failures-title">Ocorrências por dia</h2>
              </div>
              <span className="ops-panel-total">{summary.occurrences.length.toLocaleString("pt-BR")} no mês</span>
            </div>

            <div className="ops-charts-row">
              <div className="ops-daily-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.daily} margin={{ top: 12, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#f0e6e2" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#806d68", fontSize: 11 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#a0918d", fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "#fbf1ef" }}
                      formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Ocorrências"]}
                    />
                    <Bar dataKey="count" name="Ocorrências" fill="#c95b58" radius={[5, 5, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="ops-cause-chart-wrap">
                <h3>Tempo parado por {summary.causeGroupLabel}</h3>
                {summary.causes.length ? (
                  <div className="ops-cause-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.causes}
                          dataKey="minutes"
                          nameKey="name"
                          innerRadius="63%"
                          outerRadius="90%"
                          paddingAngle={3}
                          stroke="#fff"
                          strokeWidth={3}
                        >
                          {summary.causes.map((cause, index) => (
                            <Cell key={cause.name} fill={causeColors[index % causeColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [formatMinutes(Number(value)), "Tempo parado"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ops-donut-center" aria-hidden="true">
                      <strong>{formatMinutes(summary.totalMinutes)}</strong>
                      <span>no mês</span>
                    </div>
                  </div>
                ) : (
                  <p className="ops-chart-empty">Sem tempos registrados para comparar as causas.</p>
                )}
              </div>
            </div>
          </section>

          <section className="ops-panel ops-recent-panel" aria-labelledby="recent-occurrences-title">
            <div className="ops-panel-heading">
              <div>
                <p className="ops-panel-kicker">ACOMPANHAMENTO</p>
                <h2 id="recent-occurrences-title">Ocorrências recentes</h2>
              </div>
              <Link href="/tabelas" className="ops-panel-link">Ver registros <span aria-hidden="true">→</span></Link>
            </div>

            {summary.recent.length ? (
              <div className="ops-table-scroll">
                <table className="ops-events-table">
                  <thead>
                    <tr><th>Data</th><th>{summary.assetSingular}</th><th>Causa registrada</th><th>Tempo parado</th></tr>
                  </thead>
                  <tbody>
                    {summary.recent.map((occurrence, index) => (
                      <tr key={`${occurrence.date.toISOString()}-${occurrence.equipment}-${index}`}>
                        <td><strong>{formatDate(occurrence.date)}</strong><span>{formatTime(occurrence.date)}</span></td>
                        <td>{occurrence.equipment}</td>
                        <td>{occurrence.cause}</td>
                        <td>{formatMinutes(occurrence.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="ops-chart-empty">Nenhuma ocorrência registrada neste mês.</p>}
          </section>
        </div>

        <aside className="ops-dashboard-aside">
          <section className="ops-panel ops-causes-panel" aria-labelledby="causes-ranking-title">
            <div className="ops-panel-heading">
              <div>
                <p className="ops-panel-kicker">DISTRIBUIÇÃO NO MÊS</p>
                <h2 id="causes-ranking-title">
                  {summary.causeGroupLabel === "causa"
                    ? "Principais causas"
                    : summary.causeGroupLabel === "equipamento"
                      ? "Maiores paradas por equipamento"
                      : summary.causeGroupLabel === "linha"
                        ? "Maiores paradas por linha"
                        : "Categorias de parada"}
                </h2>
              </div>
            </div>
            {summary.causes.length ? (
              <ol className="ops-cause-list">
                {summary.causes.map((cause, index) => (
                  <li key={cause.name}>
                    <div className="ops-cause-label">
                      <span title={cause.name}>{cause.name}</span>
                      <strong>{cause.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</strong>
                    </div>
                    <div className="ops-cause-track">
                      <span style={{ width: `${cause.percentage}%`, backgroundColor: causeColors[index % causeColors.length] }} />
                    </div>
                    <small>{formatMinutes(cause.minutes)} registrados</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ops-chart-empty">Importe tempos de parada para ver a distribuição por causa.</p>
            )}
          </section>

          <section className="ops-panel ops-note-panel" aria-label="Definição dos indicadores">
            <p>Como ler estes indicadores</p>
            <span>O painel resume o mês mais recente presente nos registros importados. O tempo médio considera apenas linhas com duração numérica informada.</span>
          </section>
        </aside>
      </div>
    </>
  );
}
