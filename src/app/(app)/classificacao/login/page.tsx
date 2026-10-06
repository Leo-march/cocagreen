"use client"

import AccessibleForm from "@/components/ui/AccessibleForm"
import Brand from "@/components/ui/Brand"
import Button from "@/components/ui/Button"
import Icon from "@/components/ui/Icon"
import { inputClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import type { Role } from "@/types/maintenance"
import {
  ArrowRight,
  CircleHelp,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"
import { motion } from "motion/react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ClassificationLoginPage() {
  const { authenticated, setAuthenticated, setRole, prototype } = useApp()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>("Analista")

  const [step, setStep] = useState<"credentials" | "verification">(
    "credentials",
  )

  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const codeInput = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.title =
      "Entrar na Classificação | Manutenção Industrial · Marília"
  }, [])

  useEffect(() => {
    if (authenticated) {
      router.replace("/classificacao")
    }
  }, [authenticated, router])

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (step === "verification") {
      codeInput.current?.focus()
    }
  }, [step])

  const completeLogin = () => {
    setRole(selectedRole)
    setAuthenticated(true)
    router.replace("/classificacao")
  }

  const enter = (event: React.FormEvent) => {
    event.preventDefault()

    if (loading) return

    setLoading(true)

    timer.current = setTimeout(() => {
      if (selectedRole === "Analista") {
        setLoading(false)
        setStep("verification")
      } else {
        completeLogin()
      }
    }, 850)
  }

  const verify = (event: React.FormEvent) => {
    event.preventDefault()

    if (loading) return

    if (code !== "123456") {
      setError("Código inválido. Neste protótipo, use 123456.")
      codeInput.current?.focus()
      return
    }

    setError("")
    setLoading(true)

    timer.current = setTimeout(completeLogin, 850)
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-5 py-20">
      <span className="absolute right-6 top-6 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground">
        Ambiente de demonstração
      </span>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] rounded-2xl border border-border bg-white p-7 shadow-[0_12px_48px_#1c253008] sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <Brand large />

          <p className="mt-4 text-sm font-semibold">
            Manutenção Industrial
          </p>

          <p className="mb-3 mt-8 text-[10px] font-semibold tracking-[0.16em] text-accent-foreground">
            GESTÃO DE MANUTENÇÃO INDUSTRIAL
          </p>

          <h1 className="text-[27px] font-semibold text-primary">
            {step === "verification"
              ? "Verificação em duas etapas"
              : "Entrar na Classificação"}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step === "verification"
              ? "Confirme seu acesso de Analista com o código de verificação."
              : "Entre para consultar classificações e ordens dos chamados. Somente analistas podem aprovar ou editar."}
          </p>
        </div>

        {step === "credentials" ? (
          <AccessibleForm
            key="credentials"
            onSubmit={enter}
            className="mt-7 space-y-5"
          >
            <label
              htmlFor="field-26199"
              className="block text-sm font-semibold"
            >
              Usuário

              <input
                id="field-26199"
                className={inputClass + " mt-2 bg-gray-50"}
                value={prototype.views.demoProfile.name}
                readOnly
                autoComplete="username"
              />
            </label>

            <label
              htmlFor="login-profile"
              className="block text-sm font-semibold"
            >
              Perfil de acesso

              <select
                id="login-profile"
                className={inputClass + " mt-2"}
                value={selectedRole}
                disabled={loading}
                onChange={(event) =>
                  setSelectedRole(event.target.value as Role)
                }
              >
                {["Analista", "Coordenação", "Gerência"].map((profile) => (
                  <option key={profile} value={profile}>
                    {profile}
                  </option>
                ))}
              </select>
            </label>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck
                size={16}
                className="shrink-0 text-accent-foreground"
              />

              {selectedRole === "Analista"
                ? "O perfil Analista exige verificação de dois fatores após a senha."
                : "Perfil de consulta: acesso sem a etapa de dois fatores."}
            </p>

            <label
              htmlFor="field-26476"
              className="block text-sm font-semibold"
            >
              Senha

              <input
                id="field-26476"
                className={inputClass + " mt-2"}
                type="password"
                defaultValue="demonstracao"
                autoComplete="current-password"
              />
            </label>

            <Button
              type="submit"
              className="w-full py-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar como {prototype.views.demoProfile.name}
                  <ArrowRight size={17} />
                </>
              )}
            </Button>
          </AccessibleForm>
        ) : (
          <AccessibleForm
            key="verification"
            onSubmit={verify}
            className="mt-7 space-y-5"
          >
            <div className="rounded-lg border border-brand-soft bg-accent p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold">
                {prototype.views.demoProfile.name} · Analista
              </p>

              <p id="login-code-hint" className="mt-2">
                Verificação simulada. Use o código{" "}
                <strong>123456</strong>.
                Nenhum código real é enviado.
              </p>
            </div>

            <label
              htmlFor="login-code"
              className="block text-sm font-semibold"
            >
              Código de verificação

              <input
                ref={codeInput}
                id="login-code"
                name="verification-code"
                className={
                  inputClass +
                  " mt-2 text-center text-xl tracking-[0.25em]"
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                readOnly={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={`login-code-hint${
                  error ? " login-code-error" : ""
                }`}
                placeholder="000000"
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6),
                  )
                  setError("")
                }}
              />
            </label>

            {error && (
              <p
                id="login-code-error"
                role="alert"
                className="text-xs font-semibold text-red-800"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full py-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  Verificar e entrar
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setCode("")
                setError("")
                setStep("credentials")
              }}
            >
              Voltar ao login
            </Button>
          </AccessibleForm>
        )}

        <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-muted-foreground">
          <Icon
            icon={CircleHelp}
            size={16}
            className="mt-0.5 shrink-0"
          />

          <p>
            Protótipo com dados ilustrativos. Não é necessário usar
            uma senha real. As demais áreas podem ser acessadas sem
            login.
          </p>
        </div>

        <Link
          href="/classificacao"
          className="mt-5 block text-center text-xs font-semibold text-accent-foreground"
        >
          Voltar à Classificação sem login
        </Link>
      </motion.div>

      <p className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck
          size={15}
          className="text-accent-foreground"
        />
        Decisões humanas. Dados confiáveis.
      </p>

      <p className="absolute bottom-6 px-4 text-center text-[10px] text-[#596270]">
        © 2026 Manutenção Industrial · Unidade Marília
      </p>
    </main>
  )
}