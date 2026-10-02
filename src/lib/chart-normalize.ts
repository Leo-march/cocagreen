export function parseChartDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value ?? "").trim();
  if (!text) return null;

  const brazilian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (brazilian) {
    const date = new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]), Number(brazilian[4] || 0), Number(brazilian[5] || 0), Number(brazilian[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseChartNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return 0;
  const brazilianThousands = /^-?\d{1,3}(\.\d{3})+$/.test(text);
  const normalized = text.includes(",") || brazilianThousands
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}
