"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type IconName = "dashboard" | "chart" | "search" | "file" | "table";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/graficos", label: "Gráficos", icon: "chart" },
  { href: "/pareto", label: "Análise", icon: "search" },
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

  if (name === "chart") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect {...common} x="5" y="5" width="22" height="22" rx="2" />
        <path {...common} d="M5 12h22M5 19h22M12 5v22M20 5v22" />
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

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect {...common} x="5" y="5" width="22" height="22" rx="2" />
      <path {...common} d="M5 12h22M5 19h22M12 5v22M20 5v22" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}
