"use client"

import AccessibleForm from "@/components/ui/AccessibleForm"
import Brand from "@/components/ui/Brand"
import Button from "@/components/ui/Button"
import Icon from "@/components/ui/Icon"
import { inputClass } from "@/config/styles"
import { ArrowRight, CircleHelp, LoaderCircle, ShieldCheck } from "lucide-react"
import { motion } from "motion/react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function Login() {
    const router = useRouter()

    const [loading, setLoading] = useState(false)

    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Nome temporário para o protótipo
    const demoName = "Usuário"

    useEffect(() => {
        document.title = "Entrar | Manutenção Industrial · Marília"
    }, [])

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current)
            }
        }
    }, [])

    const enter = (event: React.FormEvent) => {
        event.preventDefault()

        if (loading) return

        setLoading(true)

        timer.current = setTimeout(() => {
            router.push("/dashboard")
        }, 850)
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
                        Bem-vinda, {demoName}.
                    </h1>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Entre para acompanhar a saúde da sua operação.
                    </p>

                </div>

                <AccessibleForm
                    onSubmit={enter}
                    className="mt-7 space-y-5"
                >

                    <label
                        htmlFor="username"
                        className="block text-sm font-semibold"
                    >
                        Usuário

                        <input
                            id="username"
                            className={inputClass + " mt-2 bg-gray-50"}
                            value={demoName}
                            readOnly
                            autoComplete="username"
                        />
                    </label>

                    <label
                        htmlFor="password"
                        className="block text-sm font-semibold"
                    >
                        Senha

                        <input
                            id="password"
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
                                Entrar como {demoName}

                                <ArrowRight size={17} />
                            </>
                        )}
                    </Button>

                </AccessibleForm>

                <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-muted-foreground">

                    <Icon
                        icon={CircleHelp}
                        size={16}
                        className="mt-0.5 shrink-0"
                    />

                    <p>
                        Protótipo com dados ilustrativos. Não é necessário usar uma senha
                        real.
                    </p>

                </div>

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