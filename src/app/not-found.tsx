
export default function NotFound() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
  
        <h2 className="text-2xl font-semibold text-gray-800">
          Página não encontrada
        </h2>
  
        <p className="text-gray-600">
          A página que você está procurando não existe ou foi movida.
        </p>
  
        <a
          href="/painel"
          className="rounded-lg bg-vinho px-5 py-3 font-medium text-white transition hover:opacity-90"
        >
          Voltar ao painel
        </a>
      </main>
    )
  }