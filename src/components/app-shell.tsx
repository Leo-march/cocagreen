"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { clearLoggedInUser, getLoggedInUser, subscribeToAuthChanges } from "@/lib/client-auth";

type IconName = "dashboard" | "search" | "file" | "table" | "settings" | "classification";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/pareto", label: "Análise", icon: "search" },
  { href: "/classificacaofalhas", label: "Classificação", icon: "classification" },
  { href: "/inserirdados", label: "Inserir dados", icon: "file" },
  { href: "/tabelas", label: "Tabelas", icon: "table" },
];
const navigationWithInsertLast = [
  ...navigation.filter((item) => item.href !== "/inserirdados"),
  ...navigation.filter((item) => item.href === "/inserirdados"),
];

function NavigationIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.25,
  };

  if (name === "chart") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M5 25h6V17H5v8Zm9 0h6V10h-6v15Zm9 0h6V4h-6v21Z" />
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

  if (pathname === "/login" || pathname === "/cadastro") return children;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <Link href="/dashboard" className="sidebar-logo" aria-label="Ir para o dashboard">
          <Image
            src={loggedUser ? "/imagem-login.jpg" : "/Coca-Cola-circular.png"}
            alt={loggedUser ? `Usuário ${loggedUser}` : "Coca-Cola"}
            width={82}
            height={82}
            priority
          />
        </Link>

        <nav className="sidebar-nav">
          {navigationWithInsertLast.map((item) => {
            const isActive = pathname === item.href;
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
        </nav>
        <button className="sidebar-link sidebar-logout" type="button" onClick={logout} title="Sair">
          <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25">
            <path d="M19 5h7v22h-7M14 10l6 6-6 6M20 16H5" />
          </svg>
          <span>Sair</span>
        </button>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}
