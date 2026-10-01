"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

type IconName = "chart" | "file" | "table";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
  { href: "/graficos", label: "Gráficos", icon: "chart" },
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
          <Image src="/Coca-Cola-circular.png" alt="Coca-Cola" width={82} height={82} priority />
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
