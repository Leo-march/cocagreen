import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = body?.username?.trim().toLowerCase();
  const password = body?.password;

  if (username !== "talita" || password !== "1234") {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a sessão.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
