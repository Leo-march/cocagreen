"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Machine = {
  name: string;
  lines: string[];
};

export default function MachinesPage() {
  const [search, setSearch] = useState("");
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [draftLines, setDraftLines] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMachines() {
      try {
        const response = await fetch("/api/maquinas", { signal: controller.signal });
        const payload = (await response.json()) as { machines?: Machine[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar as máquinas.");
        }
        if (!Array.isArray(payload.machines)) {
          throw new Error("A resposta da consulta de máquinas está inválida.");
        }
        setMachines(payload.machines);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as máquinas.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadMachines();
    return () => controller.abort();
  }, []);

  const availableLines = useMemo(
    () => Array.from(new Set(machines.flatMap((machine) => machine.lines))).sort(
      (first, second) => first.localeCompare(second, "pt-BR", { numeric: true }),
    ),
    [machines],
  );

  const filteredMachines = useMemo(() => machines.filter((machine) => {
    const searchValue = `${machine.name} ${machine.lines.join(" ")}`.toLowerCase();
    const matchesSearch = searchValue.includes(search.trim().toLowerCase());
    const matchesLines = selectedLines.length === 0
      || selectedLines.some((line) => machine.lines.includes(line));
    return matchesSearch && matchesLines;
  }), [machines, search, selectedLines]);
  const hasActiveFilter = search.trim() !== "" || selectedLines.length > 0;
  const visibleMachines = hasActiveFilter ? filteredMachines : filteredMachines.slice(0, 15);

  function openFilters() {
    setDraftLines(selectedLines);
    setIsFilterOpen(true);
  }

  function toggleDraftLine(line: string) {
    setDraftLines((current) =>
      current.includes(line) ? current.filter((item) => item !== line) : [...current, line],
    );
  }

  function clearFilters() {
    setDraftLines([]);
    setSelectedLines([]);
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg machines-page">
      <section className="machines-toolbar" aria-label="Buscar e filtrar máquinas">
        <label className="machine-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome do equipamento..." aria-label="Buscar nome do equipamento" />
        </label>
        <button
          type="button"
          className={`machine-filter-trigger${selectedLines.length ? " machine-filter-trigger-active" : ""}`}
          aria-expanded={isFilterOpen}
          aria-controls="machine-filter-panel"
          onClick={openFilters}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M7 12h10m-7 6h4" />
          </svg>
          <span>{selectedLines.length ? `${selectedLines.length} linhas` : "Todas as linhas"}</span>
          <span className={`machine-filter-chevron${isFilterOpen ? " machine-filter-chevron-open" : ""}`} aria-hidden="true" />
        </button>
        <span className="machines-count">
          {isLoading
            ? "Carregando..."
            : !hasActiveFilter && filteredMachines.length > visibleMachines.length
              ? `${visibleMachines.length} de ${filteredMachines.length} equipamentos`
              : `${filteredMachines.length} equipamentos`}
        </span>
      </section>

      {isFilterOpen && (
        <div className="machine-filter-backdrop" onClick={() => setIsFilterOpen(false)}>
          <section
            id="machine-filter-panel"
            className="machine-filter-panel"
            aria-labelledby="machine-filter-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="machine-filter-heading">
              <button
                type="button"
                className="machine-filter-close"
                aria-label="Fechar filtros"
                onClick={() => setIsFilterOpen(false)}
              >
                ×
              </button>
              <h2 id="machine-filter-title">Filtros</h2>
            </header>
            <div className="machine-filter-content">
              <fieldset className="machine-line-filter">
                <legend>Linha</legend>
                {availableLines.length ? (
                  <div className="machine-line-options">
                    {availableLines.map((line) => (
                      <button
                        type="button"
                        key={line}
                        className={`machine-line-option${draftLines.includes(line) ? " machine-line-option-selected" : ""}`}
                        aria-pressed={draftLines.includes(line)}
                        onClick={() => toggleDraftLine(line)}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="machine-filter-empty">Nenhuma linha disponível para filtrar.</p>
                )}
              </fieldset>
            </div>
            <footer className="machine-filter-actions">
              <button type="button" className="machine-filter-clear" onClick={clearFilters}>Limpar</button>
              <button
                type="button"
                className="machine-filter-apply"
                onClick={() => {
                  setSelectedLines(draftLines);
                  setIsFilterOpen(false);
                }}
              >
                Filtrar
              </button>
            </footer>
          </section>
        </div>
      )}

      {error && <p className="machines-empty" role="alert">{error}</p>}

      <section className="machines-grid" aria-label="Máquinas cadastradas">
        {!isLoading && !error && visibleMachines.map((machine) => (
          <article className="machine-card" key={machine.name}>
            <div className="machine-image">
              <Image src="/maquina-exemplo.jpg" alt={`Imagem da ${machine.name}`} fill sizes="(max-width: 700px) 100vw, 33vw" />
            </div>
            <div className="machine-card-body">
              <span className="machine-card-meta">
                {machine.lines.length ? machine.lines.join(" · ") : "Linha não informada"}
              </span>
              <h2>{machine.name}</h2>
              <p>Equipamento cadastrado na operação</p>
              <Link className="machine-details" href={`/maquinas/${encodeURIComponent(machine.name)}`}>
                Ver detalhes <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </section>

      {!isLoading && !error && filteredMachines.length === 0 && (
        <p className="machines-empty">
          {machines.length
            ? "Nenhuma máquina corresponde à busca e aos filtros selecionados."
            : "Nenhuma chave da parada foi encontrada nos dados importados."}
        </p>
      )}
    </div>
  );
}
