import Button from "@/components/ui/Button"

export default function BootstrapState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div role="status" className="text-center text-sm text-muted-foreground">
        {error || "Carregando os dados da unidade..."}
        {error && (
          <Button className="mt-4" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </main>
  )
}
