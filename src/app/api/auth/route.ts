import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createAdminSession,
  getAdminSession,
  getSessionCookie,
  ADMIN_USERNAME,
  matchesAdminCredentials,
} from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const username = getAdminSession(request);
    if (!username) return NextResponse.json({ error: "Sessão administrativa inválida." }, { status: 401 });
    return NextResponse.json({ username });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível validar a sessão.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let credentials: { username?: unknown; password?: unknown };
  try {
    credentials = await request.json() as { username?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Informe usuário e senha válidos." }, { status: 400 });
  }

  if (typeof credentials.username !== "string" || typeof credentials.password !== "string") {
    return NextResponse.json({ error: "Informe usuário e senha válidos." }, { status: 400 });
  }

  try {
    if (!matchesAdminCredentials(credentials.username.trim(), credentials.password)) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }
    const response = NextResponse.json({ username: ADMIN_USERNAME });
    response.headers.set("Set-Cookie", getSessionCookie(createAdminSession()));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a sessão.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
