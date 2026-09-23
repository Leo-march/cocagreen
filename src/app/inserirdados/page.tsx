import Image from "next/image";

export default function InsertDataPage() {
  return (
    <div className="dashboard-page dashboard-with-brand-bg">
      <header className="page-header">
        <div>
          <p className="eyebrow">DADOS</p>
          <h1>Inserir dados</h1>
          <p className="page-subtitle">Adicione as informações da sua operação.</p>
        </div>
      </header>
      <section className="dashboard-card insert-placeholder" aria-labelledby="insert-title">
        <div className="insert-content">
          <div className="insert-placeholder-icon" aria-hidden="true">＋</div>
          <h2 id="insert-title">Área de inserção de dados</h2>
          <p>O formulário estará disponível aqui para alimentar seus indicadores.</p>
        </div>
        <div className="insert-visual">
          <Image src="/identidade_coca-2.jpg" alt="Ilustração de uma garrafa Coca-Cola" fill sizes="240px" />
        </div>
      </section>
    </div>
  );
}
