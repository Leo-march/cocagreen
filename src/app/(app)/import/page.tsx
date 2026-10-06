"use client"

import SimpleTable from "@/components/tables/SimpleTable"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import CardHeader from "@/components/ui/CardHeader"
import Modal from "@/components/ui/Modal"
import SectionHeader from "@/components/ui/SectionHeader"
import { cardClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { type ImportRow } from "@/types/maintenance"
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Upload,
} from "lucide-react"
import { motion } from "motion/react"
import { useRef, useState } from "react"

export default function ImportsPage() {
  const { prototype } = useApp()

  const { role, notify } = useApp()
  const fileInput = useRef<HTMLInputElement>(null)
  const demoImport = prototype.imports
  const [rows, setRows] = useState<ImportRow[]>([])
  const [filename, setFilename] = useState("")
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [corrected, setCorrected] = useState(false)
  const [imported, setImported] = useState(false)
  const [review, setReview] = useState(false)
  const [error, setError] = useState("")

  const errors =
    demo && !corrected
      ? prototype.views.importSummary.issues
      : rows.filter((row) => row.error).length

  const total = demo ? prototype.views.importSummary.total : rows.length

  const read = async (file?: File) => {
    if (!file || role !== "Analista") return

    setError("")
    setImported(false)
    setCorrected(false)
    setDemo(false)

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase()

    if (![".xlsx", ".xls", ".xld"].includes(extension)) {
      setError(
        "Formato inválido. Envie um arquivo Excel .xlsx, .xls ou .xld.",
      )
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "O arquivo excede 10 MB. Exporte um período menor e tente novamente.",
      )
      return
    }

    setLoading(true)
    setFilename(file.name)
    setRows([])

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/importar-excel", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível importar o arquivo.",
        )
      }

      const previewRows: ImportRow[] = []

      for (const preview of result.previews ?? []) {
        for (const row of preview.rows ?? []) {
          previewRows.push({
            machine:
              row.maquina ??
              row.machine ??
              row.Máquina ??
              "",
            date:
              row.data ??
              row.date ??
              "",
            minutes: String(
              row.minutos ??
              row.minutes ??
              0,
            ),
            line:
              row.linha ??
              row.line ??
              "",
            error: "",
          })
        }
      }

      setRows(previewRows)

      notify(
        `Arquivo ${file.name} importado com sucesso.`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível importar o arquivo.",
      )
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SectionHeader
        title="Importação de Dados"
        subtitle="Conecte o histórico do SAP à sua gestão de manutenção."
        action={
          <span className="flex items-center gap-2 text-xs text-[#596270]">
            <Database size={16} />
            Fonte de dados: SAP
          </span>
        }
      />

      <section
        aria-label="Importar arquivo exportado do SAP"
        className={`${cardClass} p-6`}
      >
        <CardHeader
          title="Importar arquivo exportado do SAP"
          subtitle="Validação antes da importação. Nenhuma inconsistência passa despercebida."
        />

        {role === "Analista" ? (
          <>
            <div
              role="group"
              aria-label="Selecionar arquivo SAP para conferência"
              onDragOver={(event) => {
                event.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDrag(false)
                read(event.dataTransfer.files[0])
              }}
              className={`mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${drag
                  ? "border-primary bg-accent"
                  : "border-input bg-gray-50/50 hover:border-ring hover:bg-accent/30"
                }`}
            >
              <span className="mb-4 rounded-xl bg-white p-4 text-accent-foreground shadow-sm">
                {loading ? (
                  <LoaderCircle size={28} className="animate-spin" />
                ) : (
                  <Upload size={28} />
                )}
              </span>

              <span className="text-base font-semibold">
                {loading
                  ? "Conferindo o arquivo..."
                  : "Arraste o arquivo para cá"}
              </span>

              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => fileInput.current?.click()}
              >
                Selecionar arquivo SAP
              </Button>

              <span className="mt-4 text-xs text-[#596270]">
                Excel de até 10 MB · .xlsx, .xls ou .xld
              </span>

              <input
                ref={fileInput}
                id="field-174827"
                aria-label="Selecionar arquivo SAP"
                className="hidden"
                type="file"
                accept=".xlsx,.xls,.xld"
                onChange={(event) => read(event.target.files?.[0])}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#596270]">
                Colunas esperadas: maquina, data, minutos e linha.
              </p>

              <Button
                variant="ghost"
                icon={FileText}
                onClick={() => {
                  setRows(demoImport)
                  setFilename("SAP_Manutencao_Setembro_2026.xlsx")
                  setDemo(true)
                  setCorrected(false)
                  setImported(false)
                  setError("")
                }}
              >
                Carregar exemplo SAP
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-lg bg-blue-50 p-5 text-sm text-blue-900">
            <Eye size={18} className="mr-2 inline" />
            Importação disponível apenas para analistas. Você pode consultar os
            dados já importados.
          </div>
        )}

        {error && (
          <div
            role="status"
            className="mt-4 flex gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800"
          >
            <CircleAlert size={18} className="shrink-0" />
            {error}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <motion.section
          aria-label="Prévia e conferência dos dados"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardClass} mt-6 overflow-hidden`}
        >
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardHeader
                title="Prévia e conferência dos dados"
                subtitle={`${filename}${demo ? " · arquivo de demonstração" : ""
                  }`}
              />

              <Badge
                status={
                  imported ? "Importado" : errors ? "Atenção" : "Aprovada"
                }
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-semibold">
                  {total.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-[#596270]">Linhas lidas</p>
              </div>

              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-2xl font-semibold text-emerald-900">
                  {(
                    total -
                    errors -
                    (demo && corrected ? 8 : 0)
                  ).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-emerald-900">
                  Linhas válidas
                </p>
              </div>

              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-2xl font-semibold text-red-800">
                  {errors}
                </p>
                <p className="mt-1 text-xs text-red-800">
                  Com inconsistência
                </p>
              </div>
            </div>
          </div>

          <SimpleTable
            headings={["Máquina", "Data", "Parada", "Linha", "Validação"]}
            rows={rows.slice(0, 8).map((row) => [
              row.machine || "—",
              row.date,
              `${row.minutes} min`,
              row.line,
              row.error ? (
                <span className="flex items-center gap-1 text-red-800">
                  <CircleAlert size={13} />
                  {row.error}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-800">
                  <CheckCircle2 size={13} />
                  Válido
                </span>
              ),
            ])}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-6">
            <p className="max-w-md text-xs leading-relaxed text-[#596270]">
              {imported
                ? "Dados conferidos e importação simulada concluída. Nenhuma alteração no SAP."
                : errors
                  ? "Importação bloqueada até a revisão de todas as inconsistências. Nenhuma margem de erro é aceitável."
                  : "Todos os registros foram validados. A importação será simulada no protótipo."}
            </p>

            {role === "Analista" && (
              <div className="flex gap-2">
                {errors > 0 && demo && (
                  <Button
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => setReview(true)}
                  >
                    Revisar inconsistências
                  </Button>
                )}

                <Button
                  icon={Check}
                  disabled={errors > 0 || imported}
                  onClick={() => {
                    setImported(true)
                    notify(
                      "Importação simulada concluída. Todos os registros foram conferidos.",
                    )
                  }}
                >
                  {imported ? "Importação concluída" : "Confirmar importação"}
                </Button>
              </div>
            )}
          </div>
        </motion.section>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-white p-4">
        <ShieldCheck size={20} className="shrink-0 text-emerald-800" />

        <p className="text-xs leading-relaxed text-gray-600">
          A conferência identifica linhas duplicadas, campos obrigatórios
          vazios, datas inválidas e valores inconsistentes. O SAP continua sendo
          a fonte oficial. Dados projetados pela IA nunca substituem os dados
          realizados.
        </p>
      </div>

      {review && (
        <Modal
          title="Revisar inconsistências do exemplo"
          onClose={() => setReview(false)}
        >
          <p className="text-sm leading-relaxed text-gray-600">
            No cenário de demonstração, 8 linhas duplicadas serão removidas, 3
            campos vazios serão preenchidos e 1 data será corrigida com base na
            fonte SAP. Confira antes de confirmar.
          </p>

          <div className="my-5 rounded-lg bg-gray-50 p-4 text-xs leading-7">
            Máquina em branco → Esteira transportadora
            <br />
            31/09/2026 → 30/09/2026
            <br />
            Duplicatas → manter somente o registro original
          </div>

          <Button
            onClick={() => {
              setRows(
                demoImport
                  .filter((row) => row.error !== "Linha duplicada")
                  .map((row) => ({
                    ...row,
                    machine: row.machine || "Esteira transportadora",
                    date:
                      row.date === "31/09/2026"
                        ? "30/09/2026"
                        : row.date,
                    error: "",
                  })),
              )

              setCorrected(true)
              setReview(false)

              notify(
                "Conferência simulada concluída. Registros inconsistentes revisados.",
              )
            }}
          >
            Confirmar revisão do exemplo
          </Button>
        </Modal>
      )}
    </>
  )
}