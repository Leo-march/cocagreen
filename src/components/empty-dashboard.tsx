import Image from "next/image";
import Link from "next/link";

export function EmptyDashboardPage({ message }: { message?: string }) {
  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h1>Análises</h1>
          <p className="page-subtitle">Indicadores de manutenção e falhas</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">Inserir dados</Link>
      </header>

      <section className="dashboard-card" aria-labelledby="empty-dashboard-title">
        <div className="dashboard-visual">
          <Image src="/identidade_coca-1.jpg" alt="Garrafa Coca-Cola cercada por tampas vermelhas" fill sizes="(max-width: 700px) 100vw, 38vw" priority />
          <div className="dashboard-visual-caption">Seu impacto em um só lugar</div>
        </div>
        <div className="empty-state-copy">
          <p className="empty-state-kicker">Tudo pronto para começar</p>
          <h2 id="empty-dashboard-title">Ainda não existem dados para analisar</h2>
          <p>{message || "Insira uma planilha com as colunas de linha, equipamento e tempo em minutos para visualizar as análises."}</p>
          <Link href="/inserirdados" className="button button-secondary">Ir para inserção de dados <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </div>
  );
}