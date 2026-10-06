"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalysisTabs } from "@/components/analysis-tabs";
import { emptyAnalysisFilters, filterAnalysisDataset, type AnalysisFilters } from "@/lib/analysis-filters";

type DashboardData = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

function findEquipmentColumn(columns: string[]) {
  return columns.find((column) => /equipamento|chave.*parada|falha|equipment/.test(column.toLowerCase()));
}

function findMinutesColumn(columns: string[]) {
  return columns.find((column) => /minuto.*parada|total.*minuto|tempo|minute|duration/.test(column.toLowerCase()));
}

function getDateValue(value: unknown) {
  const parsed = new Date(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildParetoData(data: DashboardData, selectedLine: string) {
  const lineColumn = data.columns.find((column) => /linha|line/.test(column.toLowerCase()));
  const equipmentColumn = findEquipmentColumn(data.columns);
  const minutesColumn = findMinutesColumn(data.columns);
  const dateColumn = data.columns.find((column) => /data|date|inicio|início/.test(column.toLowerCase()));
  if (!lineColumn || !equipmentColumn || !minutesColumn || !dateColumn) {
    return { data: [], lineColumn, equipmentColumn, minutesColumn };
  }

  const grouped = new Map<string, { minutes: number; occurrences: number }>();
  data.rows.forEach((row) => {
    const line = String(row[lineColumn] ?? "").trim();
    const equipment = String(row[equipmentColumn] ?? "").trim();
    const rowDate = getDateValue(row[dateColumn]);
    const minutes = Number(String(row[minutesColumn] ?? "").replace(",", "."));
    if (line && equipment && rowDate && !Number.isNaN(minutes)) {
      const label = selectedLine === "all" ? line : `${line} — ${equipment}`;
      const current = grouped.get(label) || { minutes: 0, occurrences: 0 };
      grouped.set(label, { minutes: current.minutes + minutes, occurrences: current.occurrences + 1 });
    }
  });

  const sorted = Array.from(grouped, ([label, values]) => ({ label, ...values }))
    .sort((first, second) => second.minutes - first.minutes);
  const visible = sorted.slice(0, 12);
  const otherMinutes = sorted.slice(12).reduce((sum, item) => sum + item.minutes, 0);
  const otherOccurrences = sorted.slice(12).reduce((sum, item) => sum + item.occurrences, 0);
  if (otherMinutes > 0) visible.push({ label: "Outros equipamentos", minutes: otherMinutes, occurrences: otherOccurrences });
  const total = sorted.reduce((sum, item) => sum + item.minutes, 0);
  const totalOccurrences = sorted.reduce((sum, item) => sum + item.occurrences, 0);
  let accumulated = 0;

  return {
    data: visible.map((item) => {
      accumulated += item.minutes;
      return {
        ...item,
        percentage: totalOccurrences ? (item.occurrences / totalOccurrences) * 100 : 0,
        accumulated: total ? (accumulated / total) * 100 : 0,
      };
    }),
    lineColumn,
    equipmentColumn,
    minutesColumn,
    dateColumn,
  };
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [analysisFilters, setAnalysisFilters] = useState<AnalysisFilters>(emptyAnalysisFilters);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dashboard-data")
      .then(async (response) => {
        const payload = await response.json() as { data?: DashboardData | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o dashboard.");
        setDashboardData(payload.data || null);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados."));
  }, []);

  const filteredData = useMemo(
    () => filterAnalysisDataset(dashboardData, analysisFilters),
    [dashboardData, analysisFilters],
  );
  const chart = useMemo(
    () => filteredData
      ? buildParetoData(filteredData, analysisFilters.line)
      : { data: [], lineColumn: undefined, equipmentColumn: undefined, minutesColumn: undefined },
    [filteredData, analysisFilters.line],
  );
  const hasChart = chart.data.length > 0;

  async function exportParetoPdf() {
    const chartElement = chartContainerRef.current;
    if (!chartElement) return;

    setPdfError("");
    setIsExportingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(chartElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const margin = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - 34;
      const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const imageWidth = canvas.width * scale;
      const imageHeight = canvas.height * scale;

      pdf.setFontSize(16);
      pdf.text("Pareto de falhas", margin, 14);
      pdf.setFontSize(9);
      pdf.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, margin, 20);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, 26, imageWidth, imageHeight);
      pdf.save(`pareto-falhas-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setPdfError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  if (!hasChart) {
    return (
      <div className="dashboard-page dashboard-with-brand-bg analysis-dashboard-page">
        <header className="page-header">
          <div>
            <h1>Análises de Manutenção</h1>
            <p className="page-subtitle">Transforme o histórico da operação em decisões mais precisas.</p>
          </div>
          <div className="analysis-page-actions">
            <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
            <button type="button" className="button button-secondary" disabled>
              Exportar PDF
            </button>
          </div>
        </header>
        <section className="dashboard-chart-card pareto-card">
          <AnalysisTabs active="pareto" data={dashboardData} filters={analysisFilters} onApplyFilters={setAnalysisFilters} />
          <div className="jackknife-empty" role={loadError ? "alert" : "status"}>
            {loadError || "Nenhum resultado encontrado para os filtros selecionados."}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg analysis-dashboard-page">
      <header className="page-header">
        <div>
          <h1>Análises de Manutenção</h1>
          <p className="page-subtitle">Transforme o histórico da operação em decisões mais precisas.</p>
        </div>
        <div className="analysis-page-actions">
          <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void exportParetoPdf()}
            disabled={isExportingPdf}
          >
            {isExportingPdf ? "Gerando PDF..." : "Exportar PDF"}
          </button>
        </div>
      </header>
      {pdfError && <p className="pdf-export-error" role="alert">{pdfError}</p>}

      <section className="dashboard-chart-card pareto-card" aria-labelledby="chart-title">
          <AnalysisTabs active="pareto" data={dashboardData} filters={analysisFilters} onApplyFilters={setAnalysisFilters} />
          <div className="chart-heading">
            <div>
              <p className="empty-state-kicker">ANÁLISE DE FALHAS</p>
              <h2 id="chart-title">Pareto de falhas</h2>
              <p>Tempo em minutos por linha e equipamento, com percentual acumulado.</p>
            </div>
            <Link href="/tabelas" className="button button-secondary">Ver tabela</Link>
          </div>
          <div className="pareto-layout">
            <div className="chart-container pareto-chart-container" ref={chartContainerRef}>
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
                  <thead><tr><th>Causa</th><th>Ocorr.</th><th>% acum.</th></tr></thead>
                  <tbody>{chart.data.slice(0, 7).map((item) => (
                    <tr key={item.label}><td title={item.label}>{item.label}</td><td>{item.occurrences}</td><td>{item.accumulated.toFixed(0)}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </aside>
          </div>
          <div className="pareto-summary">
            <span><strong>{groupedEquipmentCount(chart.data)}</strong> grupos exibidos</span>
            <span><strong>{chart.data[0]?.label}</strong> concentra {chart.data[0]?.accumulated.toFixed(1)}% do tempo</span>
          </div>
      </section>
    </div>
  );
}

function groupedEquipmentCount(chartData: Array<{ label: string }>) {
  return chartData.length > 12 ? chartData.length - 1 : chartData.length;
}
