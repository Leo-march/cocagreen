"use client"

import Brand from "@/components/ui/Brand"
import Button from "@/components/ui/Button"
import Icon from "@/components/ui/Icon"
import Modal from "@/components/ui/Modal"
import Select from "@/components/ui/Select"
import { navigation, notificationIcons } from "@/config/navigation"
import { useApp } from "@/context/AppContext"
import { type Role } from "@/types/maintenance"
import { trapFocus } from "@/utils/focus"
import {
  Bell,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ExternalLink,
  Factory,
  LogOut,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    prototype,
    authenticated,
    setAuthenticated,
    role,
    setRole,
    failures,
    setAnalysisFiltersOpen,
  } = useApp()

  const router = useRouter()
  const pathname = usePathname()

  const [notifications, setNotifications] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [help, setHelp] = useState(false)
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")

    const update = () => {
      setDesktop(media.matches)

      if (media.matches) {
        setMobile(false)
      }
    }

    update()

    media.addEventListener("change", update)

    return () => {
      media.removeEventListener("change", update)
    }
  }, [])

  /*
   * Foco e título da página.
   */
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      const heading = document
        .getElementById("conteudo-principal")
        ?.querySelector<HTMLElement>("h1")

      if (heading) {
        heading.tabIndex = -1

        heading.focus({
          preventScroll: true,
        })

        document.title = `${heading.textContent} | Manutenção Industrial · Marília`
      }

      window.scrollTo({
        top: 0,
        behavior: "instant",
      })
    })

    return () => {
      cancelAnimationFrame(timer)
    }
  }, [pathname])

  /*
   * Controle de foco do menu mobile.
   */
  useEffect(() => {
    if (desktop || !mobile) return

    const previous = document.activeElement as HTMLElement | null
    const sidebar = document.getElementById("kof-sidebar")
    const content = document.getElementById("kof-content")

    if (content) {
      content.inert = true
    }

    sidebar?.querySelector<HTMLElement>("a")?.focus()

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false)
        return
      }

      if (sidebar) {
        trapFocus(event, sidebar)
      }
    }

    document.addEventListener("keydown", handler)

    return () => {
      if (content) {
        content.inert = false
      }

      document.removeEventListener("keydown", handler)

      if (previous?.isConnected) {
        previous.focus()
      }
    }
  }, [mobile, desktop])

  /*
   * Controle de teclado das notificações.
   */
  useEffect(() => {
    if (!notifications) return

    const timer = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("#notification-panel a")
        ?.focus()
    })

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotifications(false)

        document
          .getElementById("notification-trigger")
          ?.focus()
      }
    }

    document.addEventListener("keydown", handler)

    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener("keydown", handler)
    }
  }, [notifications])

  const current = navigation.find((item) =>
    pathname.startsWith(item.path),
  )

  const navigateTo = (path: string) => {
    router.push(path)
  }

  const logout = () => {
    setAuthenticated(false)
    router.replace("/painel")
  }

  return (
    <div className="min-h-screen">
      {/* Skip link */}
      <a
        href="#conteudo-principal"
        className="sr-only z-[100] rounded-lg bg-white p-4 text-sm font-semibold text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo principal
      </a>

      {/* Overlay mobile */}
      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobile(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        id="kof-sidebar"
        inert={!desktop && !mobile ? true : undefined}
        role={!desktop && mobile ? "dialog" : "complementary"}
        aria-modal={!desktop && mobile ? true : undefined}
        aria-label="Navegação principal da manutenção"
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col overflow-y-auto border-r border-border bg-white transition-transform lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand */}
        <Link
          href="/painel"
          onClick={() => setMobile(false)}
          className="flex h-[92px] shrink-0 items-center gap-3 px-6"
        >
          <Brand />

          <div>
            <span className="block text-[15px] font-bold">
              Manutenção
            </span>

            <span className="text-[11px] text-muted-foreground">
              Unidade Marília
            </span>
          </div>
        </Link>

        {/* Unidade */}
        <div className="px-5 pb-4 pt-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600">
              <Icon icon={Factory} size={16} />
            </span>

            <div className="flex-1">
              <p className="text-xs font-semibold">
                Unidade Marília
              </p>

              <p className="text-[10px] text-muted-foreground">
                São Paulo, Brasil
              </p>
            </div>

            <ShieldCheck
              size={14}
              className="text-emerald-700"
            />
          </div>
        </div>

        {/* Operação */}
        <p className="px-7 pb-2 pt-3 text-[10px] font-semibold tracking-[0.13em] text-[#596270]">
          OPERAÇÃO
        </p>

        <nav
          aria-label="Módulos de operação"
          className="space-y-2 px-3"
        >
          {navigation
            .filter((item) => item.section === "operacao")
            .map((item) => {
              const isActive =
                pathname === item.path ||
                pathname.startsWith(`${item.path}/`)

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobile(false)}
                  className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all ${isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  <Icon icon={item.icon} size={18} />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {item.badge && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${item.path === "/classificacao"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {item.path === "/classificacao"
                        ? failures.filter(
                          (failure) => !failure.approved,
                        ).length
                        : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
        </nav>

        {/* Filtros */}
        {current?.path === "/analises" && (
          <button
            type="button"
            onClick={() => {
              setAnalysisFiltersOpen(true)
              setMobile(false)
            }}
            className="mx-6 mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold text-gray-600 transition hover:border-ring hover:bg-accent hover:text-accent-foreground"
          >
            <SlidersHorizontal size={15} />

            Filtros da análise

            <ChevronRight
              size={13}
              className="ml-auto"
            />
          </button>
        )}

        {/* Administração */}
        <p className="px-7 pb-2 pt-8 text-[10px] font-semibold tracking-[0.13em] text-[#596270]">
          ADMINISTRAÇÃO
        </p>

        <nav
          aria-label="Módulos de administração"
          className="space-y-2 px-3"
        >
          {navigation
            .filter(
              (item) => item.section === "administracao",
            )
            .map((item) => {
              const isActive =
                pathname === item.path ||
                pathname.startsWith(`${item.path}/`)

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobile(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition ${isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  <Icon icon={item.icon} />

                  {item.label}
                </Link>
              )
            })}
        </nav>

        {/* Perfil mobile */}
        <div className="mx-5 mt-4 sm:hidden">
          <Select
            label="Perfil de visualização"
            value={role}
            onChange={(value) => {
              const selectedRole = value as Role

              if (selectedRole === "Analista") {
                router.push("/classificacao/login")
                return
              }

              setRole(selectedRole)
            }}
            options={[
              "Analista",
              "Coordenação",
              "Gerência",
            ]}
          />
        </div>

        {/* Rodapé sidebar */}
        <div className="mt-auto px-5 pb-4 pt-8">
          <button
            type="button"
            onClick={() => {
              setMobile(false)
              setHelp(true)
            }}
            className="mt-3 flex min-h-10 w-full items-center gap-3 px-2 text-xs text-[#596270]"
          >
            <CircleHelp size={17} />

            Central de ajuda

            <ExternalLink
              size={12}
              className="ml-auto"
            />
          </button>
        </div>

        {/* Usuário */}
        <div className="flex items-center gap-3 border-t border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-avatar-background text-xs font-bold text-avatar-foreground">
            TA
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold">
              Talita Almeida
            </p>

            <p className="text-[11px] text-muted-foreground">
              {role} de manutenção
            </p>
          </div>

          <button
            type="button"
            title="Sair"
            aria-label="Sair da conta"
            onClick={logout}
            className="rounded-md p-2 text-[#596270] hover:bg-gray-50 hover:text-accent-foreground"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div
        id="kof-content"
        className="min-w-0 lg:ml-[248px]"
      >
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-border bg-white/95 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setMobile(true)}
              className="p-2 lg:hidden"
              aria-label="Abrir navegação"
            >
              <Menu size={20} />
            </button>

            <span className="hidden text-[#596270] sm:block">
              Manutenção
            </span>

            <ChevronRight
              size={13}
              className="hidden text-[#596270] sm:block"
            />

            <span className="font-medium text-gray-600">
              {current?.label || "Página não encontrada"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* SAP */}
            <span className="mr-1 hidden items-center gap-1.5 text-[11px] text-[#596270] xl:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />

              SAP sincronizado às 08:32
            </span>

            {/* Perfil */}
            <div className="hidden items-center gap-2 border-l border-border pl-4 sm:flex">
              <label
                htmlFor="header-profile"
                className="text-xs text-[#596270]"
              >
                Perfil
                <span className="sr-only">
                  {" "}
                  de visualização
                </span>
              </label>

              <select
                id="header-profile"
                value={role}
                onChange={(event) => {
                  const selectedRole = event.target.value as Role

                  if (selectedRole === "Analista") {
                    router.push("/classificacao/login")
                    return
                  }

                  setRole(selectedRole)
                }}
                className="rounded-md bg-gray-50 px-2 py-1.5 text-xs font-medium"
              >
                {[
                  "Analista",
                  "Coordenação",
                  "Gerência",
                ].map((profile) => (
                  <option
                    key={profile}
                    value={profile}
                  >
                    {profile}
                  </option>
                ))}
              </select>
            </div>

            {/* Notificações */}
            <button
              type="button"
              onClick={() =>
                setNotifications((value) => !value)
              }
              className="relative rounded-lg p-2.5 text-gray-600 hover:bg-gray-50"
              aria-label="Notificações"
              id="notification-trigger"
              aria-expanded={notifications}
              aria-controls="notification-panel"
            >
              <Bell size={19} />

              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>

            {/* Avatar */}
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-avatar-background text-[11px] font-semibold text-avatar-foreground sm:flex">
              TA
            </div>
          </div>
        </header>

        {/* Notificações */}
        <AnimatePresence>
          {notifications && (
            <motion.div
              id="notification-panel"
              role="region"
              aria-label="Notificações da manutenção"
              initial={{
                opacity: 0,
                y: -8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -8,
              }}
              className="fixed right-5 top-[62px] z-40 w-[360px] max-w-[calc(100vw-40px)] rounded-xl border border-border bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">
                  Suas notificações
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setNotifications(false)

                    document
                      .getElementById(
                        "notification-trigger",
                      )
                      ?.focus()
                  }}
                  aria-label="Fechar notificações"
                  className="p-2"
                >
                  <X size={16} />
                </button>
              </div>

              {prototype.views.notifications.map(
                (notice) => (
                  <Link
                    key={notice.text}
                    href={notice.path}
                    onClick={() =>
                      setNotifications(false)
                    }
                    className="flex gap-3 border-t border-border py-3 hover:bg-gray-50"
                  >
                    <Icon
                      icon={
                        notificationIcons[
                        notice.icon
                        ]
                      }
                      className="mt-1 shrink-0 text-accent-foreground"
                    />

                    <div>
                      <p className="text-sm font-medium">
                        {notice.text}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {notice.detail}
                      </p>
                    </div>
                  </Link>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Página */}
        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] p-5 pb-12 lg:p-8"
        >
          <motion.div
            key={pathname}
            initial={{
              opacity: 0,
              y: 7,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.25,
            }}
          >
            {children}
          </motion.div>

          {/* Footer */}
          <footer className="mt-9 flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-[10px] text-[#596270]">
            <span>
              Manutenção Industrial · Unidade Marília
            </span>

            <span>
              Protótipo · Dados ilustrativos · Atualizado em
              30/09/2026
            </span>
          </footer>
        </main>
      </div>

      {/* Central de ajuda */}
      {help && (
        <Modal
          title="Central de ajuda"
          onClose={() => setHelp(false)}
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Explore as telas pela navegação lateral. Use o
            seletor de perfil para comparar a edição do
            Analista com a visualização de Coordenação e
            Gerência.
          </p>

          <div className="mt-5 rounded-lg bg-accent p-4 text-sm text-accent-foreground">
            Dados demonstrativos. As sugestões de IA sempre
            precisam da aprovação de um analista.
          </div>

          <p className="mb-3 mt-6 text-xs font-semibold text-gray-600">
            Revisar estados de apoio
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              icon={CircleAlert}
              onClick={() => {
                setHelp(false)
                navigateTo("/404")
              }}
            >
              Erro 404
            </Button>
          </div>

          <Button
            className="mt-6"
            onClick={() => setHelp(false)}
          >
            Entendido
          </Button>
        </Modal>
      )}
    </div>
  )
}