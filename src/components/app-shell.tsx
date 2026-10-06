"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { clearLoggedInUser, getLoggedInUser, getUserRole, subscribeToAuthChanges } from "@/lib/client-auth";

type IconName = "dashboard" | "search" | "file" | "table" | "settings" | "classification" | "prediction";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Painel principal", icon: "dashboard" },
  { href: "/maquinas", label: "Máquinas", icon: "settings" },
  { href: "/classificacaofalhas", label: "Classificação de falhas", icon: "classification" },
  { href: "/pareto", label: "Análises", icon: "search" },
  { href: "/predicoes", label: "Realizar nova predição", icon: "prediction" },
  { href: "/tabelas", label: "Tabelas", icon: "table" },
  { href: "/inserirdados", label: "Importação de dados", icon: "file" },
];

function NavigationIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.25,
  };

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M5 27h23" />
        <rect {...common} x="7" y="18" width="4" height="9" rx="1" />
        <rect {...common} x="14" y="12" width="4" height="15" rx="1" />
        <rect {...common} x="21" y="5" width="4" height="22" rx="1" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle {...common} cx="13.5" cy="13.5" r="8" />
        <path {...common} d="m19.5 19.5 7 7" />
      </svg>
    );
  }

  if (name === "file") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M9 3h10l6 6v19H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" />
        <path {...common} d="M19 3v7h6M11 16h10M11 21h10" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M13 4h6l1 4a9 9 0 0 1 2 1l3-2 4 4-2 3a9 9 0 0 1 1 2l4 1v6l-4 1a9 9 0 0 1-1 2l2 3-4 4-3-2a9 9 0 0 1-2 1l-1 4h-6l-1-4a9 9 0 0 1-2-1l-3 2-4-4 2-3a9 9 0 0 1-1-2l-4-1v-6l4-1a9 9 0 0 1 1-2L2 11l4-4 3 2a9 9 0 0 1 2-1l1-4Z" transform="translate(0 -1) scale(.9)" />
        <circle {...common} cx="16" cy="16" r="4" />
      </svg>
    );
  }

  if (name === "classification") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M8 5h16a2 2 0 0 1 2 2v19H6V7a2 2 0 0 1 2-2Z" />
        <path {...common} d="M11 12h3M17 12h4M11 18h3M17 18h4M11 24l2 2 4-4" />
      </svg>
    );
  }

  if (name === "prediction") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M16 4v15m0 0 6-6m-6 6-6-6M6 21v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect {...common} x="5" y="5" width="22" height="22" rx="2" />
      <path {...common} d="M5 12h22M5 19h22M12 5v22M20 5v22" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const loggedUser = useSyncExternalStore(subscribeToAuthChanges, getLoggedInUser, () => null);
  const userRole = useSyncExternalStore(subscribeToAuthChanges, getUserRole, () => "visitor");
  const [logoutError, setLogoutError] = useState("");
  const isAdmin = userRole === "admin";
  const operationNavigation = navigation.slice(0, 4);
  const adminNavigation = navigation.slice(4).filter(
    (item) => item.href !== "/inserirdados" || isAdmin,
  );
  const currentPage = navigation.find((item) => (
    item.href === pathname
    || (item.href === "/pareto" && ["/jackknife", "/outrosgraficos"].includes(pathname))
    || (item.href === "/maquinas" && pathname.startsWith("/maquinas/"))
  ));

  async function logOut() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível encerrar a sessão no servidor.");
      clearLoggedInUser();
      router.push("/login");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <Link href="/dashboard" className="sidebar-brand" aria-label="Ir para o painel principal">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 20V8.5L9 11V7l5 3V4h6v16H4Z" />
              <path d="M8 15v1m4-1v1m4-1v1m4-1v1" />
            </svg>
          </span>
          <span className="sidebar-brand-copy"><strong>Manutenção</strong><small>Unidade Marília</small></span>
        </Link>

        <div className="sidebar-unit">
          <span className="sidebar-unit-icon" aria-hidden="true"><NavigationIcon name="table" /></span>
          <span><strong>Unidade Marília</strong><small>São Paulo, Brasil</small></span>
          <svg className="sidebar-unit-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m12 3 7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
            <path d="m9 11 2 2 4-4" />
          </svg>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Operação</span>
          {operationNavigation.map((item) => {
            const isActive = item === currentPage;
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`sidebar-link${isActive ? " sidebar-link-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
              >
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {adminNavigation.length > 0 && (
            <>
              <span className="sidebar-section-label sidebar-section-label-admin">Administração</span>
              {adminNavigation.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={`sidebar-link${pathname === item.href ? " sidebar-link-active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                  title={item.label}
                >
                  <NavigationIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-help">
            <span aria-hidden="true">?</span><span>Central de ajuda</span><small aria-hidden="true">↗</small>
          </div>
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">{(loggedUser?.[0] ?? "V").toLocaleUpperCase("pt-BR")}</span>
            <div className="sidebar-user-copy">
              <strong>{loggedUser ?? "Visitante"}</strong>
              <span>{loggedUser ? (isAdmin ? "Administrador" : "Acesso autenticado") : "Acesso público"}</span>
            </div>
            {loggedUser && (
              <button type="button" className="sidebar-logout" onClick={() => void logOut()}>Sair</button>
            )}
            {logoutError && <span role="alert">{logoutError}</span>}
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <div className="app-breadcrumb">
            <span>Manutenção</span>
            <span aria-hidden="true">›</span>
            <strong>{currentPage?.label ?? "Análises"}</strong>
          </div>
          <div className="app-topbar-profile">
            <span>Perfil</span>
            <strong>{isAdmin ? "Administrador" : "Visitante"}</strong>
            <span className="app-topbar-avatar">{(loggedUser?.[0] ?? "V").toLocaleUpperCase("pt-BR")}</span>
          </div>
        </header>
        <main className="app-content-main">{children}</main>
      </div>
    </div>
  );
}
