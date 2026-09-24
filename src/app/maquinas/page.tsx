import Link from "next/link";
import Image from "next/image";

export default function TablesPage() {
  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Tabelas</h1>
          <p className="page-subtitle">Consulte os dados inseridos na sua operação.</p>
        </div>
        <Link href="/inserirdados" className="button button-primary">
          Inserir dados
        </Link>
      </header>

      <section className="dashboard-card table-empty-state" aria-labelledby="empty-tables-title">
        <div className="table-visual">
          <Image
            src="/identidade_coca-2.jpg"
            alt="Ilustração de uma garrafa Coca-Cola"
            fill
            sizes="220px"
          />
        </div>
        <div className="empty-state-copy">
          <p className="empty-state-kicker">Nenhum registro encontrado</p>
          <h2 id="empty-tables-title">Ainda não existem dados inseridos</h2>
          <p>
            Quando você inserir dados, eles aparecerão aqui em formato de tabela
            para consulta e acompanhamento.
          </p>
          <Link href="/inserirdados" className="button button-secondary">
            Voltar para inserir dados <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
