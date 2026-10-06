"use client"

import Link from "next/link"
import {
  ArrowRight,
  CircleAlert,
  Cog,
  Search,
} from "lucide-react"
import { useState } from "react"

import Badge from "@/components/ui/Badge"
import CardHeader from "@/components/ui/CardHeader"
import Kpi from "@/components/ui/Kpi"
import SectionHeader from "@/components/ui/SectionHeader"
import { cardClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { getAssetUrl } from "@/utils/assets"

export default function MachinesPage() {
  const { machines } = useApp()

  const [search, setSearch] = useState("")

  const filteredMachines = machines.filter((machine) => {
    const value = search.toLowerCase()

    return (
      machine.name.toLowerCase().includes(value) ||
      machine.code.toLowerCase().includes(value) ||
      machine.sector.toLowerCase().includes(value) ||
      machine.line.toLowerCase().includes(value)
    )
  })

  const totalMachines = machines.length

  const stoppedMachines = machines.filter(
    (machine) => machine.status === "Parada"
  ).length

  const criticalMachines = machines.filter(
    (machine) => machine.critical === "Crítica"
  ).length

  return (
    <>
      <SectionHeader
        title="Máquinas"
        subtitle="Cadastro e acompanhamento dos equipamentos"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi
          title="Total de máquinas"
          value={totalMachines}
          icon={Cog}
        />

        <Kpi
          title="Máquinas paradas"
          value={stoppedMachines}
          icon={CircleAlert}
        />

        <Kpi
          title="Máquinas críticas"
          value={criticalMachines}
          icon={CircleAlert}
        />
      </div>

      <section className={`${cardClass} p-6`}>
        <CardHeader
          title="Equipamentos cadastrados"
          subtitle="Selecione uma máquina para consultar seus detalhes"
        />

        <div className="relative mt-5">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#596270]"
          />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar máquina..."
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMachines.map((machine) => (
            <Link
              key={machine.id}
              href={`/maquinas/${machine.id}`}
              className="group overflow-hidden rounded-xl border border-border bg-white transition hover:shadow-md"
            >
              <img
                src={getAssetUrl(machine.photo)}
                alt={machine.name}
                className="h-44 w-full object-cover"
              />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {machine.name}
                    </h3>

                    <p className="mt-1 text-xs text-[#596270]">
                      {machine.code}
                    </p>
                  </div>

                  <ArrowRight
                    size={17}
                    className="shrink-0 text-[#596270] transition group-hover:translate-x-1"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge status={machine.status} />
                  <Badge
                    status={machine.critical}
                    critical
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[#596270]">Setor</p>
                    <p className="mt-1 font-medium">
                      {machine.sector}
                    </p>
                  </div>

                  <div>
                    <p className="text-[#596270]">Linha</p>
                    <p className="mt-1 font-medium">
                      {machine.line}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredMachines.length === 0 && (
          <div className="py-10 text-center text-sm text-[#596270]">
            Nenhuma máquina encontrada.
          </div>
        )}
      </section>
    </>
  )
}