"use client"

import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import CardHeader from "@/components/ui/CardHeader"
import Empty from "@/components/ui/Empty"
import Field from "@/components/ui/Field"
import Icon from "@/components/ui/Icon"
import Kpi from "@/components/ui/Kpi"
import Modal from "@/components/ui/Modal"
import SectionHeader from "@/components/ui/SectionHeader"
import Select from "@/components/ui/Select"
import Tabs from "@/components/ui/Tabs"
import { cardClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import type { Failure } from "@/types/maintenance"
import { tabButtonId, tabPanelId } from "@/utils/tabs"
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  History,
  LockKeyhole,
  LogIn,
  Pencil,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"

export default function ClassificationPage() {
  const { prototype } = useApp()

  const {
    role,
    authenticated,
    machines,
    failures,
    setFailures,
    history,
    setHistory,
    notify,
  } = useApp()

  const [day, setDay] = useState("")
  const [year, setYear] = useState("2026")
  const [machine, setMachine] = useState("Todas as máquinas")
  const [line, setLine] = useState("Todas as linhas")
  const [shift, setShift] = useState("Todos os turnos")
  const [tab, setTab] = useState("Pendentes")
  const [editing, setEditing] = useState<Failure | null>(null)
  const [note, setNote] = useState("")
  const [critical, setCritical] = useState("A")
  const [batch, setBatch] = useState(false)

  const canEdit = authenticated && role === "Analista"

  useEffect(() => {
    if (!canEdit) {
      setEditing(null)
      setBatch(false)
      setNote("")
    }
  }, [canEdit])

  const filtered = failures.filter(
    (failure) =>
      (!day || failure.date === day.split("-").reverse().join("/")) &&
      failure.date.endsWith(year) &&
      (machine === "Todas as máquinas" || failure.machine === machine) &&
      (line === "Todas as linhas" || failure.line === line) &&
      (shift === "Todos os turnos" || failure.shift === shift) &&
      (!authenticated ||
        (tab === "Pendentes" ? !failure.approved : failure.approved)),
  )

  const confident = filtered.filter(
    (failure) => failure.confidence >= 95 && !failure.approved,
  )

  const approve = (ids: number[]) => {
    if (!canEdit) return

    setFailures((previous) =>
      previous.map((failure) =>
        ids.includes(failure.id)
          ? { ...failure, approved: true }
          : failure,
      ),
    )

    setHistory((previous) => [
      ...ids.map(
        (id) =>
          `Talita Almeida · 30/09/2026 às 09:42 · ${
            failures.find((failure) => failure.id === id)?.machine
          }: sugestão ${
            failures.find((failure) => failure.id === id)?.critical
          } → classificação aprovada pelo analista.`,
      ),
      ...previous,
    ])

    notify(
      `${ids.length} ${
        ids.length === 1
          ? "classificação aprovada"
          : "classificações aprovadas"
      }. Decisão humana registrada.`,
    )

    setBatch(false)
  }

  const reclassify = (id: number, value: string) => {
    if (!canEdit) return

    const previous = failures.find((failure) => failure.id === id)

    setFailures((items) =>
      items.map((failure) =>
        failure.id === id
          ? { ...failure, critical: value }
          : failure,
      ),
    )

    setHistory((items) => [
      `Talita Almeida · 30/09/2026 às 09:40 · ${
        previous?.machine
      }: ${previous?.critical} → ${value}. Reclassificação manual.`,
      ...items,
    ])

    notify(
      "Reclassificação registrada. A falha ainda precisa ser aprovada.",
    )
  }

  return (
    <>
      <SectionHeader
        title="Classificação de Falhas"
        subtitle="A inteligência sugere. A sua experiência decide."
        action={
          authenticated ? (
            <div className="flex items-center gap-2 text-xs">
              <Eye size={16} className="text-[#596270]" />
              <span>
                Visualizando como: <strong>{role}</strong>
              </span>
            </div>
          ) : null
        }
      />

      <div
        className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
          canEdit
            ? "border-brand-soft bg-accent/60"
            : "border-blue-100 bg-blue-50/60"
        }`}
      >
        <Icon
          icon={
            !authenticated
              ? LockKeyhole
              : canEdit
                ? ShieldCheck
                : Eye
          }
          className={`mt-0.5 shrink-0 ${
            canEdit
              ? "text-accent-foreground"
              : "text-blue-700"
          }`}
        />

        <div>
          <p className="text-xs font-semibold">
            {!authenticated
              ? "Faça login para acessar as informações restritas"
              : canEdit
                ? "Aprovação humana obrigatória em todas as classificações"
                : "Modo de visualização · sem permissão de edição"}
          </p>

          <p className="mt-1 text-xs text-gray-600">
            {!authenticated
              ? "Sem login, classificações, sugestões da IA e ordens dos chamados ficam ocultas. Aprovação e edição exigem perfil Analista autenticado."
              : canEdit
                ? "Não há margem de erro aceitável. Confira o impacto na produção antes de confirmar uma sugestão da IA."
                : "Coordenação e Gerência acompanham os dados. Somente analistas podem editar, reclassificar e aprovar falhas."}
          </p>
        </div>
      </div>

      {authenticated && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Kpi
            title="Classificadas no mês"
            value={
              prototype.views.classifiedBaseline +
              failures.filter(
                (failure) => failure.approved,
              ).length
            }
            icon={Tags}
          />

          <Kpi
            title="Pendentes de aprovação"
            value={
              failures.filter(
                (failure) => !failure.approved,
              ).length
            }
            icon={Clock3}
            color="#da291c"
          />

          <Kpi
            title="Aprovadas sem alteração"
            value={
              prototype.views.classificationApprovedUnchanged
            }
            decimals={1}
            suffix="%"
            icon={CheckCircle2}
          />
        </div>
      )}

      <div
        className={`${cardClass} mb-6 grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5`}
      >
        <Field
          label="Dia"
          name="day"
          type="date"
          required={false}
          value={day}
          onChange={setDay}
        />

        <Select
          label="Ano"
          value={year}
          onChange={setYear}
          options={["2026", "2025", "2024"]}
        />

        <Select
          label="Máquina"
          value={machine}
          onChange={setMachine}
          options={[
            "Todas as máquinas",
            ...machines.map((item) => item.name),
          ]}
        />

        <Select
          label="Linha"
          value={line}
          onChange={setLine}
          options={[
            "Todas as linhas",
            "Linha 1",
            "Linha 2",
            "Linha 3",
          ]}
        />

        <Select
          label="Turno"
          value={shift}
          onChange={setShift}
          options={[
            "Todos os turnos",
            "1º turno",
            "2º turno",
            "3º turno",
          ]}
        />
      </div>

      <section
        aria-label="Revisão das classificações de falhas"
        className={`${cardClass} overflow-hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          {authenticated ? (
            <Tabs
              tabs={["Pendentes", "Aprovadas"]}
              active={tab}
              onChange={setTab}
            />
          ) : (
            <h2 className="text-sm font-semibold">
              Chamados de manutenção
            </h2>
          )}

          {canEdit && tab === "Pendentes" && (
            <Button
              variant="secondary"
              icon={CheckCircle2}
              disabled={!confident.length}
              onClick={() => setBatch(true)}
            >
              Aprovar alta confiança ({confident.length})
            </Button>
          )}
        </div>

        <div
          role={authenticated ? "tabpanel" : "region"}
          id={
            authenticated
              ? tabPanelId("Pendentes")
              : undefined
          }
          aria-labelledby={
            authenticated
              ? tabButtonId("Pendentes", tab)
              : undefined
          }
          aria-label={
            !authenticated
              ? "Chamados de manutenção"
              : undefined
          }
          tabIndex={0}
          className="overflow-x-auto rounded-md"
        >
          <table className="w-full min-w-[1180px] text-left text-xs">
            <caption className="sr-only">
              {authenticated
                ? `Falhas ${tab.toLowerCase()} e classificação revisada pelo analista`
                : "Chamados de manutenção com informações restritas"}
            </caption>

            <thead className="border-y border-border bg-gray-50 text-[10px] text-[#596270]">
              <tr>
                {[
                  "DATA / TURNO",
                  "MÁQUINA / LINHA",
                  "ORDEM DO CHAMADO",
                  "PARADA",
                  "DESCRIÇÃO",
                  "SUGESTÃO DA IA",
                  ...(canEdit
                    ? ["CLASSIFICAÇÃO", "AÇÕES"]
                    : ["CLASSIFICAÇÃO"]),
                ].map((heading) => (
                  <th
                    scope="col"
                    key={heading}
                    className="px-4 py-3 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filtered.map((failure) => (
                <tr
                  key={failure.id}
                  className="transition hover:bg-gray-50/70"
                >
                  <td className="whitespace-nowrap px-4 py-5">
                    <p className="font-medium">
                      {failure.date}
                    </p>
                    <p className="mt-1 text-[#596270]">
                      {failure.shift}
                    </p>
                  </td>

                  <td className="px-4 py-5">
                    <p className="font-semibold">
                      {failure.machine}
                    </p>
                    <p className="mt-1 text-[#596270]">
                      {failure.line}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-5 font-semibold">
                    {authenticated ? (
                      `#${failure.callOrder}`
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-normal text-gray-600">
                        <LockKeyhole size={13} />
                        Login necessário
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-5 font-semibold">
                    {failure.minutes} min
                  </td>

                  <td className="max-w-52 px-4 py-5">
                    <p className="leading-relaxed text-gray-600">
                      {failure.description}
                    </p>

                    {authenticated && failure.note && (
                      <p className="mt-2 flex items-start gap-1 text-[10px] text-[#596270]">
                        <FileText
                          size={12}
                          className="shrink-0"
                        />
                        {failure.note}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-5">
                    {authenticated ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Sparkles
                            size={13}
                            className="text-accent-foreground"
                          />

                          <Badge
                            status={
                              prototype.failures.find(
                                (item) =>
                                  item.id === failure.id,
                              )?.critical ||
                              failure.critical
                            }
                            critical
                          />
                        </div>

                        <span
                          className={`mt-2 block text-[10px] ${
                            failure.confidence >= 95
                              ? "text-emerald-800"
                              : "text-amber-800"
                          }`}
                        >
                          {failure.confidence}% de confiança
                          {failure.confidence < 90
                            ? " · revisar"
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <LockKeyhole size={13} />
                        Login necessário
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-5">
                    {!authenticated ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <LockKeyhole size={13} />
                        Login necessário
                      </span>
                    ) : canEdit && !failure.approved ? (
                      <select
                        aria-label={`Reclassificar ${failure.machine}`}
                        value={failure.critical}
                        onChange={(event) =>
                          reclassify(
                            failure.id,
                            event.target.value,
                          )
                        }
                        className="h-10 rounded-lg border border-input bg-white px-3 font-semibold"
                      >
                        {["A", "B", "C"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge
                        status={failure.critical}
                        critical
                      />
                    )}
                  </td>

                  {canEdit && (
                    <td className="px-4 py-5">
                      {failure.approved ? (
                        <Badge status="Aprovada" />
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            className="px-3 text-xs"
                            icon={Check}
                            onClick={() =>
                              approve([failure.id])
                            }
                          >
                            Aprovar
                          </Button>

                          <Button
                            variant="secondary"
                            icon={Pencil}
                            ariaLabel={`Editar ${failure.machine}`}
                            onClick={() => {
                              setEditing(failure)
                              setNote(failure.note)
                              setCritical(failure.critical)
                            }}
                            className="px-3 text-xs"
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <Empty
            title={
              !authenticated
                ? "Nenhum chamado neste filtro"
                : tab === "Pendentes"
                  ? "Tudo revisado por aqui"
                  : "Nenhuma classificação aprovada neste filtro"
            }
            description="Altere os filtros para consultar outras falhas."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setDay("")
                  setYear("2026")
                  setMachine("Todas as máquinas")
                  setLine("Todas as linhas")
                  setShift("Todos os turnos")
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        )}

        {authenticated && (
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-4 text-[10px] text-gray-600">
            <span className="font-semibold">
              Critério de criticidade:
            </span>

            <span>
              <b className="text-red-700">A</b> · Parada geral da
              produção
            </span>

            <span>
              <b className="text-amber-800">B</b> · Impacto
              intermediário
            </span>

            <span>
              <b className="text-emerald-800">C</b> · Apenas
              equipamento parado
            </span>
          </div>
        )}
      </section>

      {authenticated && (
        <section
          aria-label="Histórico de alterações"
          className={`${cardClass} mt-6 p-5`}
        >
          <CardHeader
            title="Histórico de alterações"
            subtitle="Cada decisão é registrada e pode ser auditada."
            action={
              <History
                size={18}
                className="text-[#596270]"
              />
            }
          />

          <div className="mt-4 space-y-3">
            {history.map((entry, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                {entry}
              </div>
            ))}
          </div>
        </section>
      )}

      {editing && canEdit && (
        <Modal
          title="Revisar classificação"
          onClose={() => setEditing(null)}
        >
          <p className="mb-5 text-sm font-semibold">
            {editing.machine} · {editing.minutes} min
          </p>

          <p className="mb-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            {editing.description}
          </p>

          <Select
            label="Criticidade final"
            value={critical}
            onChange={setCritical}
            options={["A", "B", "C"]}
          />

          <label
            htmlFor="field-103575"
            className="mt-5 block text-xs font-semibold"
          >
            Observações do analista

            <textarea
              id="field-103575"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              className="mt-2 min-h-28 w-full rounded-lg border border-input p-3 text-sm"
              placeholder="Registre o contexto e a justificativa da classificação..."
            />
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>

            <Button
              onClick={() => {
                if (!canEdit) return

                setFailures((previous) =>
                  previous.map((failure) =>
                    failure.id === editing.id
                      ? {
                          ...failure,
                          critical,
                          note,
                        }
                      : failure,
                  ),
                )

                setHistory((previous) => [
                  `Talita Almeida · 30/09/2026 às 09:45 · ${editing.machine}: ${editing.critical} → ${critical}. Observação: ${
                    note || "sem observação"
                  }`,
                  ...previous,
                ])

                setEditing(null)

                notify(
                  "Revisão salva. A classificação ainda precisa de aprovação.",
                )
              }}
            >
              Salvar revisão
            </Button>
          </div>
        </Modal>
      )}

      {batch && canEdit && (
        <Modal
          title={`Aprovar ${confident.length} classificações de alta confiança?`}
          onClose={() => setBatch(false)}
        >
          <p className="text-sm leading-relaxed text-gray-600">
            As sugestões têm confiança igual ou superior a 95%.
            A confiança estatística não elimina a revisão humana:
            confirme que você verificou cada falha e o impacto na
            produção.
          </p>

          <div className="my-5 space-y-2">
            {confident.map((failure) => (
              <div
                key={failure.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm"
              >
                <span>{failure.machine}</span>

                <Badge
                  status={failure.critical}
                  critical
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setBatch(false)}
            >
              Cancelar
            </Button>

            <Button
              icon={Check}
              onClick={() =>
                approve(
                  confident.map((failure) => failure.id),
                )
              }
            >
              Revisei e aprovo
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}