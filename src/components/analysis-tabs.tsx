import Link from "next/link";

type AnalysisTab = "pareto" | "jackknife" | "graficos";

const tabs: { id: AnalysisTab; href: string; label: string }[] = [
  { id: "pareto", href: "/dashboard", label: "Pareto" },
  { id: "jackknife", href: "/jackknife", label: "Jack–Knife" },
  { id: "graficos", href: "/graficos", label: "Outros Gráficos" },
];

export function AnalysisTabs({ active }: { active: AnalysisTab }) {
  return (
    <nav className="analysis-tabs" aria-label="Tipo de análise">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`analysis-tab${active === tab.id ? " analysis-tab-active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}