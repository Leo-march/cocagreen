"use client"

import SimpleTable from "@/components/tables/SimpleTable"
import Badge from "@/components/ui/Badge"
import CardHeader from "@/components/ui/CardHeader"
import Kpi from "@/components/ui/Kpi"
import SectionHeader from "@/components/ui/SectionHeader"
import Tabs from "@/components/ui/Tabs"
import { cardClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { getAssetUrl } from "@/utils/assets"
import { tabButtonId, tabPanelId } from "@/utils/tabs"
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Wrench,
} from "lucide-react"
import { use, useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

type MachineDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default function MachineDetailPage({
  params,
}: MachineDetailPageProps) {
  const { id } = use(params)

  const { prototype, machines, notify } = useApp()
  const technical = prototype.views.machineTechnicalData

  const [tab, setTab] = useState("Peças trocadas")

  const machine = machines.find((item) => item.id === id)

  if (!machine) {
    notFound()
  }

  return (
    <>
      <Link
        href="/maquinas"
        className="mb-5 inline-flex items-center gap-2 text-xs text-[#596270]"
      >
        <ArrowLeft size={15} />
        Voltar para máquinas
      </Link>

      <SectionHeader
        title={machine.name}
        subtitle={`${machine.code} · ${machine.sector} · ${machine.line}`}
      />

      <div className="mb-6 flex gap-3">
        <Badge status={machine.status} />
        <Badge status={machine.critical} critical />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Horas de operação"
          value={prototype.views.machineOperatingHours}
          suffix="h"
          icon={Clock3}
        />

        <Kpi
          title="MTBF"
          value={prototype.views.machineMtbf}
          suffix="h"
          icon={Activity}
        />

        <Kpi
          title="Falhas no ano"
          value={prototype.views.machineAnnualFailures}
          icon={CircleAlert}
        />

        <div className={`${cardClass} p-5`}>
          <p className="text-sm text-muted-foreground">
            Próxima preventiva
          </p>

          <p className="mt-6 text-[26px] font-semibold">
            {technical.preventiveDate}
          </p>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-800">
            <Clock3 size={13} />
            {technical.preventiveCountdown}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <section
          aria-label="Dados técnicos"
          className={`${cardClass} overflow-hidden`}
        >
          <img
            src={getAssetUrl(machine.photo)}
            alt={machine.name}
            className="h-52 w-full object-cover"
          />

          <div className="p-6">
            <CardHeader
              title="Dados técnicos"
              subtitle="Informações do cadastro do equipamento"
            />

            <dl className="mt-5 grid grid-cols-2 gap-y-5">
              {[
                ["Fabricante", technical.manufacturer],
                ["Modelo", technical.model],
                ["Ano", technical.year],
                ["Setor", machine.sector],
                ["Localização", `${machine.line} · ${technical.location}`],
                ["Código SAP", technical.sapCode],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">
                    {label}
                  </dt>

                  <dd className="mt-1 text-sm font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          aria-label="Histórico de manutenção"
          className={`${cardClass} p-6`}
        >
          <CardHeader
            title="Histórico de manutenção"
            subtitle="Rastreabilidade de cada intervenção"
          />

          <div className="mt-7">
            {prototype.views.maintenanceTimeline.map((event, index) => (
              <div
                key={event.date}
                className="relative flex gap-4 pb-7"
              >
                {index < 3 && (
                  <div className="absolute bottom-0 left-4 top-8 w-px bg-border" />
                )}

                <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Wrench size={14} />
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">
                      {event.type}
                    </h3>

                    <span className="text-[10px] text-[#596270]">
                      {event.date}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-600">
                    {event.desc}
                  </p>

                  <p className="mt-1 text-[10px] text-[#596270]">
                    {event.tech}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section
        aria-label="Detalhes e registros da máquina"
        className={`${cardClass} mt-6 p-6`}
      >
        <Tabs
          tabs={["Peças trocadas", "Documentos", "Falhas"]}
          active={tab}
          onChange={setTab}
        />

        <div
          role="tabpanel"
          id={tabPanelId("Peças trocadas")}
          aria-labelledby={tabButtonId("Peças trocadas", tab)}
          tabIndex={0}
          className="mt-5"
        >
          {tab === "Peças trocadas" ? (
            <SimpleTable
              headings={["Peça", "Código", "Quantidade", "Data"]}
              rows={prototype.views.replacedParts}
            />
          ) : tab === "Documentos" ? (
            <div className="flex flex-wrap gap-4">
              {prototype.views.machineDocuments.map((doc) => (
                <button
                  key={doc}
                  onClick={() =>
                    notify(
                      `${doc}: documento ilustrativo do protótipo.`,
                    )
                  }
                  className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm hover:bg-gray-50"
                >
                  <FileText
                    size={20}
                    className="text-accent-foreground"
                  />

                  {doc}

                  <ExternalLink
                    size={14}
                    className="text-[#596270]"
                  />
                </button>
              ))}
            </div>
          ) : (
            <SimpleTable
              headings={["Data", "Descrição", "Parada", "Criticidade"]}
              rows={prototype.views.machineFailures}
            />
          )}
        </div>
      </section>
    </>
  )
}

