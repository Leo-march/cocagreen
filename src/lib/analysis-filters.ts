export type CriticalityGrade = "A" | "B" | "C";

export type AnalysisFilters = {
  month: string;
  year: string;
  machine: string;
  line: string;
  shift: string;
  criticality: CriticalityGrade[];
};

export type AnalysisDataset = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export const emptyAnalysisFilters: AnalysisFilters = {
  month: "all",
  year: "all",
  machine: "all",
  line: "all",
  shift: "all",
  criticality: [],
};

export const analysisMonths = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function normalizeColumn(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function findColumn(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(normalizeColumn(column)));
}

function parseAnalysisDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  const brazilianDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brazilianDate) {
    return new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]));
  }
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
  const parsed = new Date(text.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCriticalityGrades(data: AnalysisDataset) {
  const equipmentColumn = findColumn(data.columns, /equipamento|equipment|maquina|machine|chave.*parada/);
  const lineColumn = findColumn(data.columns, /linha|line/);
  const failureColumn = findColumn(data.columns, /observa|subchave|chave_1|tipo.*parada|failure|cause|falha/);
  const minutesColumn = findColumn(data.columns, /minuto.*parada|total.*minuto|tempo|minute|duration|duracao/);
  const explicitColumn = findColumn(data.columns, /criticidade|criticality|classe/);

  if (explicitColumn) {
    return new Map(data.rows.map((row, index) => {
      const value = String(row[explicitColumn] ?? "").trim().toUpperCase();
      const grade = value.match(/(?:^|\b)(A|B|C)(?:\b|$)/)?.[1] as CriticalityGrade | undefined;
      return [String(index), grade];
    }));
  }

  if (!equipmentColumn || !failureColumn || !minutesColumn) return new Map<string, CriticalityGrade>();

  const groups = new Map<string, { frequency: number; totalMinutes: number; machines: Set<string> }>();
  data.rows.forEach((row) => {
    const equipment = String(row[equipmentColumn] ?? "").trim();
    const line = String(lineColumn ? row[lineColumn] ?? "" : "").trim();
    const failure = String(row[failureColumn] ?? "").trim();
    const minutesText = String(row[minutesColumn] ?? "").trim().replace(/\s/g, "");
    const minutes = Number(minutesText.includes(",") ? minutesText.replace(/\./g, "").replace(",", ".") : minutesText);
    if (!equipment || !failure || !Number.isFinite(minutes) || minutes <= 0) return;

    const key = `${equipment}\u001f${failure}`;
    const group = groups.get(key) ?? { frequency: 0, totalMinutes: 0, machines: new Set<string>() };
    group.frequency += 1;
    group.totalMinutes += minutes;
    group.machines.add(`${line}\u001f${equipment}`);
    groups.set(key, group);
  });

  const summaries = Array.from(groups, ([key, group]) => ({
    key,
    frequency: group.frequency,
    mttr: group.totalMinutes / group.machines.size,
  }));
  if (!summaries.length) return new Map<string, CriticalityGrade>();

  const averageFrequency = summaries.reduce((sum, group) => sum + group.frequency, 0) / summaries.length;
  const averageMttr = summaries.reduce((sum, group) => sum + group.mttr, 0) / summaries.length;
  const grades = new Map<string, CriticalityGrade>();
  summaries.forEach((group) => {
    const highFrequency = group.frequency >= averageFrequency;
    const highMttr = group.mttr >= averageMttr;
    const grade: CriticalityGrade = highFrequency && highMttr
      ? "A"
      : highFrequency || highMttr ? "B" : "C";
    grades.set(group.key, grade);
  });

  return new Map(data.rows.map((row, index) => {
    const equipment = String(row[equipmentColumn] ?? "").trim();
    const failure = String(row[failureColumn] ?? "").trim();
    return [String(index), grades.get(`${equipment}\u001f${failure}`)];
  }));
}

export function getAnalysisFilterOptions(data: AnalysisDataset | null) {
  if (!data) return { months: [] as string[], years: [] as string[], machines: [] as string[], lines: [] as string[], shifts: [] as string[] };

  const dateColumn = findColumn(data.columns, /data|date|inicio|abertura|ocorrencia/);
  const machineColumn = findColumn(data.columns, /equipamento|equipment|maquina|machine|chave.*parada/);
  const lineColumn = findColumn(data.columns, /linha|line/);
  const shiftColumn = findColumn(data.columns, /turno|shift/);
  const dates = data.rows.flatMap((row) => {
    const date = dateColumn ? parseAnalysisDate(row[dateColumn]) : null;
    return date ? [date] : [];
  });
  const distinctValues = (column: string | undefined) => column
    ? Array.from(new Set(data.rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean))).sort((first, second) => first.localeCompare(second, "pt-BR"))
    : [];

  return {
    months: Array.from(new Set(dates.map((date) => String(date.getMonth() + 1)))).sort((first, second) => Number(first) - Number(second)),
    years: Array.from(new Set(dates.map((date) => String(date.getFullYear())))).sort().reverse(),
    machines: distinctValues(machineColumn),
    lines: distinctValues(lineColumn),
    shifts: distinctValues(shiftColumn),
  };
}

export function filterAnalysisDataset<Data extends AnalysisDataset>(data: Data | null, filters: AnalysisFilters): Data | null {
  if (!data) return null;
  const dateColumn = findColumn(data.columns, /data|date|inicio|abertura|ocorrencia/);
  const machineColumn = findColumn(data.columns, /equipamento|equipment|maquina|machine|chave.*parada/);
  const lineColumn = findColumn(data.columns, /linha|line/);
  const shiftColumn = findColumn(data.columns, /turno|shift/);
  const equipmentColumn = findColumn(data.columns, /equipamento|equipment|maquina|machine|chave.*parada/);
  const failureColumn = findColumn(data.columns, /observa|subchave|chave_1|tipo.*parada|failure|cause|falha/);
  const criticalityGrades = filters.criticality.length ? getCriticalityGrades(data) : null;

  const rows = data.rows.filter((row, index) => {
    const date = dateColumn ? parseAnalysisDate(row[dateColumn]) : null;
    if (filters.month !== "all" && (!date || String(date.getMonth() + 1) !== filters.month)) return false;
    if (filters.year !== "all" && (!date || String(date.getFullYear()) !== filters.year)) return false;
    if (filters.machine !== "all" && String(machineColumn ? row[machineColumn] ?? "" : "").trim() !== filters.machine) return false;
    if (filters.line !== "all" && String(lineColumn ? row[lineColumn] ?? "" : "").trim() !== filters.line) return false;
    if (filters.shift !== "all" && String(shiftColumn ? row[shiftColumn] ?? "" : "").trim() !== filters.shift) return false;
    if (filters.criticality.length) {
      const grade = criticalityGrades?.get(String(index));
      if (!grade || !filters.criticality.includes(grade)) return false;
    }
    if (filters.machine !== "all" && !machineColumn) return false;
    if (filters.line !== "all" && !lineColumn) return false;
    if (filters.shift !== "all" && !shiftColumn) return false;
    if (filters.criticality.length && !findColumn(data.columns, /criticidade|criticality|classe/) && (!equipmentColumn || !failureColumn)) return false;
    return true;
  });

  return { ...data, rows };
}