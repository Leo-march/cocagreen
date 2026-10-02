import { NextResponse } from "next/server";
import { getLatestImportedTable } from "@/lib/mysql";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const pareto = new URL(request.url).searchParams.get("view") === "pareto";
    const data = pareto
      ? await getLatestImportedTable({
          limit: 100000,
          include: ["linha", "line", "setor", "data", "date", "inicio", "minuto", "tempo", "duration", "chave", "parada", "subchave", "observ", "cause", "failure"],
        })
      : await getLatestImportedTable();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar os dados.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
