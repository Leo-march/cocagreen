import { NextResponse } from "next/server";
import { getImportedTablePage } from "@/lib/mysql";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;

  try {
    return NextResponse.json({ data: await getImportedTablePage(page, 100) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar a tabela.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
