import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server-auth";

export const runtime = "nodejs";

const reports = new Map([
  ["class-metrics", "metricas_por_classe.csv"],
  ["confusion-matrix", "matriz_confusao.csv"],
  ["test-errors", "erros_teste.csv"],
  ["similar-observations", "observacoes_semelhantes.csv"],
  ["similar-labels", "classificacoes_semelhantes.csv"],
  ["error-terms", "termos_frequentes_em_erros.csv"],
]);

export async function GET(request: Request) {
  try {
    if (!getAdminSession(request)) {
      return NextResponse.json({ error: "Relatórios detalhados restritos ao acesso administrativo." }, { status: 403 });
    }
    const reportKey = new URL(request.url).searchParams.get("file") ?? "";
    const filename = reports.get(reportKey);
    if (!filename) {
      return NextResponse.json({ error: "Relatório solicitado inválido." }, { status: 400 });
    }

    const content = await readFile(join(
      process.cwd(),
      "scripts",
      "resultado_modelo_falhas",
      filename,
    ));
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "O relatório ainda não foi gerado." }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Não foi possível carregar o relatório.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
