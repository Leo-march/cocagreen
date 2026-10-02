"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Machine = {
  name: string;
  lines: string[];
};

export default function MachinesPage() {
  const [search, setSearch] = useState("");
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

  const filteredMachines = useMemo(() => machines.filter((machine) => {
    const searchValue = `${machine.name} ${machine.lines.join(" ")}`.toLowerCase();
    return searchValue.includes(search.trim().toLowerCase());
  }), [machines, search]);

  return (
    <div className="dashboard-page dashboard-with-brand-bg machines-page">
      <header className="machines-header">
        <div>
          <p className="eyebrow">GESTÃO DA OPERAÇÃO</p>
          <h1>Máquinas</h1>
          <p className="machines-count">
            {isLoading ? "Carregando máquinas..." : `${filteredMachines.length} máquinas encontradas`}
          </p>
        </div>
        <div className="machines-actions">
          <label className="machine-search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar máquina ou linha" aria-label="Buscar máquina ou linha" />
          </label>
        </div>
      </header>

      {error && <p className="machines-empty" role="alert">{error}</p>}

      <section className="machines-grid" aria-label="Máquinas cadastradas">
        {!isLoading && !error && filteredMachines.map((machine) => (
          <article className="machine-card" key={machine.name}>
            <div className="machine-image">
              <Image src="/maquina-exemplo.jpg" alt={`Imagem da ${machine.name}`} fill sizes="(max-width: 700px) 100vw, 33vw" />
            </div>
            <div className="machine-card-body">
              <h2>{machine.name}</h2>
              <p><strong>Linha:</strong> {machine.lines.length ? machine.lines.join(", ") : "Não informada"}</p>
            </div>
          </article>
        ))}
      </section>

      {!isLoading && !error && filteredMachines.length === 0 && (
        <p className="machines-empty">
          {machines.length
            ? "Nenhuma máquina corresponde à busca."
            : "Nenhuma chave da parada foi encontrada nos dados importados."}
        </p>
      )}
    </div>
  );
}
