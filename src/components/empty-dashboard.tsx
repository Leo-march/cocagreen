type EmptyDashboardPageProps = {
  message?: string;
};

export function EmptyDashboardPage({ message = "Não há dados para exibir." }: EmptyDashboardPageProps) {
  return (
    <div className="empty-dashboard-page" aria-live="polite">
      <div className="empty-dashboard-card">
        <p className="empty-state-kicker">DASHBOARD VAZIO</p>
        <h2>Nenhum dado importado</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
