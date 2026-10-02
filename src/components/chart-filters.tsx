"use client";

import { useEffect, useState } from "react";

export type ChartFilterGroup = {
  id: string;
  label: string;
  help?: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
  defaultValue?: string[];
  selectAllLabel?: string;
  resetOnChange?: string[];
};

export type ChartFilterValues = Record<string, string[]>;

type ChartFiltersProps = {
  groups: ChartFilterGroup[];
  value: ChartFilterValues;
  onApply: (value: ChartFilterValues) => void;
  onDraftChange?: (value: ChartFilterValues) => void;
};

const sameValues = (first: string[], second: string[]) =>
  first.length === second.length && first.every((value) => second.includes(value));

export function ChartFilters({ groups, value, onApply, onDraftChange }: ChartFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChartFilterValues>(value);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const activeCount = groups.filter((group) =>
    !sameValues(value[group.id] || [], group.defaultValue || []),
  ).length;

  const openFilters = () => {
    setDraft(value);
    onDraftChange?.(value);
    setOpen(true);
  };

  const updateDraft = (next: ChartFilterValues) => {
    setDraft(next);
    onDraftChange?.(next);
  };

  const clear = () => {
    updateDraft(Object.fromEntries(groups.map((group) => [group.id, group.defaultValue || []])));
  };

  const toggle = (group: ChartFilterGroup, optionValue: string) => {
    const selected = draft[group.id] || group.defaultValue || [];
    const next = group.multiple
      ? selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue]
      : [optionValue];
    const nextDraft = { ...draft, [group.id]: next };
    group.resetOnChange?.forEach((id) => {
      const resetGroup = groups.find((candidate) => candidate.id === id);
      nextDraft[id] = resetGroup?.defaultValue || [];
    });
    updateDraft(nextDraft);
  };

  const selectAll = (group: ChartFilterGroup) => {
    const allValues = group.options.map((option) => option.value);
    const selected = draft[group.id] || [];
    updateDraft({
      ...draft,
      [group.id]: sameValues(selected, allValues) ? [] : allValues,
    });
  };

  return (
    <div className="chart-filter-panel">
      <button className="chart-filter-toggle" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={openFilters}>
        <span className="chart-filter-icon" aria-hidden="true"><i /><i /><i /></span>
        Filtros
        {activeCount > 0 && <span className="chart-filter-count">{activeCount}</span>}
        <span className="chart-filter-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="chart-filter-drawer" role="dialog" aria-modal="true" aria-label="Filtros dos gráficos">
          <header className="chart-filter-drawer-header">
            <div><h2>Filtros</h2><span>Escolha as opções e aplique para atualizar os gráficos.</span></div>
            <button type="button" aria-label="Fechar filtros" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="chart-filter-groups">
            {groups.map((group) => {
              const selected = draft[group.id] || group.defaultValue || [];
              const isAllSelected = group.options.length > 0 && sameValues(selected, group.options.map((option) => option.value));
              return (
                <section className="chart-filter-group-section" key={group.id}>
                  <div className="chart-filter-group-heading">
                    <div><h3>{group.label}</h3>{group.help && <p>{group.help}</p>}</div>
                    {group.multiple && group.options.length > 1 && (
                      <button type="button" className="chart-filter-select-all" onClick={() => selectAll(group)}>
                        {isAllSelected ? "Desmarcar todas" : group.selectAllLabel || "Selecionar todas"}
                      </button>
                    )}
                  </div>
                  <div className="chart-filter-chips" role="group" aria-label={group.label}>
                    {group.options.map((option) => {
                      const isSelected = selected.includes(option.value);
                      return (
                        <button key={option.value} type="button" className={`chart-filter-chip${isSelected ? " chart-filter-chip-active" : ""}`} aria-pressed={isSelected} onClick={() => toggle(group, option.value)}>
                          {option.label}
                        </button>
                      );
                    })}
                    {!group.options.length && <span className="chart-filter-no-categories">Sem opções disponíveis</span>}
                  </div>
                </section>
              );
            })}
          </div>
          <footer className="chart-filter-actions">
            <button type="button" onClick={clear}>Limpar</button>
            <button type="button" onClick={() => { onApply(draft); setOpen(false); }}>Filtrar</button>
          </footer>
        </div>
      )}
    </div>
  );
}
