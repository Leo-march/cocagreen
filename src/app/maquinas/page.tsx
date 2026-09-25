"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Machine = {
  name: string;
  code: string;
  sector: string;
  status: "Operando" | "Em manutenção";
  maintenance: string;
};

const machines: Machine[] = [
  { name: "Prensa Hidráulica 02", code: "PHD02", sector: "Produção", status: "Operando", maintenance: "12/09/2026" },
  { name: "Esteira Transportadora 01", code: "EST01", sector: "Logística", status: "Operando", maintenance: "03/09/2026" },
  { name: "Compressor de Ar 03", code: "CAR03", sector: "Utilidades", status: "Em manutenção", maintenance: "18/08/2026" },
  { name: "Torno CNC 04", code: "TCN04", sector: "Usinagem", status: "Operando", maintenance: "09/09/2026" },
  { name: "Serra 05", code: "SER05", sector: "Corte", status: "Operando", maintenance: "20/09/2026" },
  { name: "Empacotadora 06", code: "EMP06", sector: "Embalagem", status: "Operando", maintenance: "22/09/2026" },
];

export default function MachinesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");

  const filteredMachines = useMemo(() => machines.filter((machine) => {
    const searchValue = `${machine.name} ${machine.code}`.toLowerCase();
    return searchValue.includes(search.toLowerCase()) && (status === "Todos" || machine.status === status);
  }), [search, status]);

  return (
    <div className="dashboard-page dashboard-with-brand-bg machines-page">
      <header className="machines-header">
        <div>
          <p className="eyebrow">GESTÃO DA OPERAÇÃO</p>
          <h1>Máquinas</h1>
          <p className="machines-count">{filteredMachines.length} máquinas cadastradas</p>
        </div>
        <div className="machines-actions">
          <label className="machine-search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar máquina ou código" aria-label="Buscar máquina ou código" />
          </label>
          <button type="button" className="machine-add-button">+ Nova máquina</button>
        </div>
      </header>

      <div className="machine-filters" aria-label="Filtros de máquinas">
        <button type="button" className={status === "Todos" ? "machine-filter-active" : ""} onClick={() => setStatus("Todos")}>Setor: Todos</button>
        <button type="button" className={status === "Operando" ? "machine-filter-active" : ""} onClick={() => setStatus("Operando")}>Status: Operando</button>
        <button type="button" className={status === "Em manutenção" ? "machine-filter-active" : ""} onClick={() => setStatus("Em manutenção")}>Status: Manutenção</button>
      </div>

      <section className="machines-grid" aria-label="Máquinas cadastradas">
        {filteredMachines.map((machine) => (
          <article className="machine-card" key={machine.code}>
            <div className="machine-image">
              <Image src="/maquina-exemplo.jpg" alt={`Imagem da ${machine.name}`} fill sizes="(max-width: 700px) 100vw, 33vw" />
            </div>
            <div className="machine-card-body">
              <h2>{machine.name}</h2>
              <p><strong>Setor:</strong> {machine.sector}</p>
              <p className="machine-status-row"><strong>Estado:</strong> <span className={`machine-status ${machine.status === "Operando" ? "machine-status-online" : "machine-status-maintenance"}`}>{machine.status}</span></p>
              <p><strong>Última manutenção:</strong> {machine.maintenance}</p>
              <button type="button" className="machine-details">Ver detalhes <span aria-hidden="true">→</span></button>
            </div>
          </article>
        ))}
      </section>

      {filteredMachines.length === 0 && <p className="machines-empty">Nenhuma máquina corresponde aos filtros selecionados.</p>}
    </div>
  );
}
