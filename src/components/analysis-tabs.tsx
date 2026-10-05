import Link from "next/link";

type AnalysisTab = "pareto" | "jackknife" | "other";

const tabs: { id: AnalysisTab; href: string; label: string }[] = [
  { id: "pareto", href: "/pareto", label: "Pareto" },
  { id: "jackknife", href: "/jackknife", label: "Jack–Knife" },
  { id: "other", href: "/outrosgraficos", label: "Outros gráficos" },
];

export function AnalysisTabs({ active }: { active: AnalysisTab }) {
  return (
    <nav className="analysis-tabs" aria-label="Tipo de análise">
      <Link href="/dashboard" className="analysis-tab" aria-label="Visão geral">Visão geral</Link>
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