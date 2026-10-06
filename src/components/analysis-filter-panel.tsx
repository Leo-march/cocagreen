"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  analysisMonths,
  type AnalysisDataset,
  type AnalysisFilters,
  type CriticalityGrade,
  emptyAnalysisFilters,
  getAnalysisFilterOptions,
} from "@/lib/analysis-filters";

type SavedAnalysisFilter = {
  id: string;
  label: string;
  filters: AnalysisFilters;
};

const SAVED_FILTERS_KEY = "cocagreen:analysis-filters";
const SAVED_FILTERS_EVENT = "cocagreen:analysis-filters-change";

function subscribeToSavedFilters(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(SAVED_FILTERS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SAVED_FILTERS_EVENT, callback);
  };
}

function getSavedFiltersSnapshot() {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(SAVED_FILTERS_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function saveFilters(filters: SavedAnalysisFilter[]) {
  window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
  window.dispatchEvent(new Event(SAVED_FILTERS_EVENT));
}

function labelForFilters(filters: AnalysisFilters) {
  const parts: string[] = [];
  if (filters.month !== "all") parts.push(analysisMonths[Number(filters.month) - 1]);
  if (filters.year !== "all") parts.push(filters.year);
  if (filters.machine !== "all") parts.push(filters.machine);
  if (filters.line !== "all") parts.push(`Linha ${filters.line}`);
  if (filters.shift !== "all") parts.push(`Turno ${filters.shift}`);
  if (filters.criticality.length) parts.push(`Criticidade ${filters.criticality.join(", ")}`);
  return parts.join(" · ") || "Todos os dados";
}

export function AnalysisFilterPanel({
  data,
  filters,
  onApply,
}: {
  data: AnalysisDataset | null;
  filters: AnalysisFilters;
  onApply: (filters: AnalysisFilters) => void;
}) {
  const options = useMemo(() => getAnalysisFilterOptions(data), [data]);
  const [draft, setDraft] = useState(filters);
  const [isOpen, setIsOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const savedSnapshot = useSyncExternalStore(subscribeToSavedFilters, getSavedFiltersSnapshot, () => "[]");
  const savedFilters = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(savedSnapshot);
      return Array.isArray(parsed) ? parsed as SavedAnalysisFilter[] : [];
    } catch {
      return [];
    }
  }, [savedSnapshot]);
  const selectedCount = Number(filters.month !== "all")
    + Number(filters.year !== "all")
    + Number(filters.machine !== "all")
    + Number(filters.line !== "all")
    + Number(filters.shift !== "all")
    + filters.criticality.length;

  function updateDraft<Key extends keyof AnalysisFilters>(key: Key, value: AnalysisFilters[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleCriticality(grade: CriticalityGrade) {
    updateDraft(
      "criticality",
      draft.criticality.includes(grade)
        ? draft.criticality.filter((selected) => selected !== grade)
        : [...draft.criticality, grade],
    );
  }

  function saveCurrentFilter() {
    const preset: SavedAnalysisFilter = {
      id: crypto.randomUUID(),
      label: labelForFilters(draft),
      filters: draft,
    };
    saveFilters([...savedFilters, preset].slice(-8));
  }

  function applySavedFilter(preset: SavedAnalysisFilter) {
    setDraft(preset.filters);
  }

  function closePanel() {
    setIsOpen(false);
    toggleButtonRef.current?.focus();
  }

  return (
    <section
      className="analysis-filter-area"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) closePanel();
      }}
    >
      <button
        ref={toggleButtonRef}
        type="button"
        className={`analysis-filter-toggle${isOpen ? " is-open" : ""}`}
        aria-expanded={isOpen}
        aria-controls="analysis-filter-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h5m4 0h7M4 12h9m4 0h3M4 17h2m4 0h10" />
          <circle cx="11" cy="7" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
        <span>Filtros da análise</span>
        {selectedCount > 0 && <span className="analysis-filter-count">{selectedCount}</span>}
        <span className="analysis-filter-chevron" aria-hidden="true">›</span>
      </button>

      <div
        id="analysis-filter-panel"
        className={`analysis-filter-panel${isOpen ? " is-open" : ""}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="analysis-filter-panel-heading">
          <div>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h5m4 0h7M4 12h9m4 0h3M4 17h2m4 0h10" />
              <circle cx="11" cy="7" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
            <h2>Filtros da análise</h2>
          </div>
          <button type="button" className="analysis-filter-close" aria-label="Fechar filtros" onClick={closePanel}>
            ×
          </button>
        </div>

        <div className="analysis-filter-fields">
          <label>
            <span>Período</span>
            <select value={draft.month} onChange={(event) => updateDraft("month", event.target.value)}>
              <option value="all">Todos os meses</option>
              {options.months.map((month) => (
                <option key={month} value={month}>{analysisMonths[Number(month) - 1]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Ano</span>
            <select value={draft.year} onChange={(event) => updateDraft("year", event.target.value)}>
              <option value="all">Todos os anos</option>
              {options.years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="analysis-filter-field-wide">
            <span>Máquina</span>
            <select value={draft.machine} onChange={(event) => updateDraft("machine", event.target.value)}>
              <option value="all">Todas as máquinas</option>
              {options.machines.map((machine) => <option key={machine} value={machine}>{machine}</option>)}
            </select>
          </label>
          <label className="analysis-filter-field-wide">
            <span>Linha</span>
            <select value={draft.line} onChange={(event) => updateDraft("line", event.target.value)}>
              <option value="all">Todas as linhas</option>
              {options.lines.map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
          </label>
          <label className="analysis-filter-field-wide">
            <span>Turno</span>
            <select value={draft.shift} onChange={(event) => updateDraft("shift", event.target.value)}>
              <option value="all">Todos os turnos</option>
              {options.shifts.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="analysis-criticality-field">
          <legend>Criticidade</legend>
          <div>
            {(["A", "B", "C"] as CriticalityGrade[]).map((grade) => (
              <button
                key={grade}
                type="button"
                className={draft.criticality.includes(grade) ? "selected" : ""}
                aria-pressed={draft.criticality.includes(grade)}
                onClick={() => toggleCriticality(grade)}
              >
                <span aria-hidden="true">{draft.criticality.includes(grade) ? "✓" : ""}</span>{grade}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" className="analysis-save-filter" onClick={saveCurrentFilter}>
          <span aria-hidden="true">＋</span> Salvar filtro atual
        </button>

        <div className="analysis-saved-filters">
          <h3>Meus filtros salvos</h3>
          {savedFilters.length ? savedFilters.map((preset) => (
            <button type="button" key={preset.id} onClick={() => applySavedFilter(preset)}>
              <span>{preset.label}</span><span aria-hidden="true">›</span>
            </button>
          )) : <p>Nenhum filtro salvo</p>}
        </div>

        <div className="analysis-filter-actions">
          <button type="button" className="analysis-filter-clear" onClick={() => setDraft({ ...emptyAnalysisFilters, criticality: [] })}>
            Limpar
          </button>
          <button
            type="button"
            className="analysis-filter-apply"
            onClick={() => {
              onApply(draft);
              closePanel();
            }}
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </section>
  );
}