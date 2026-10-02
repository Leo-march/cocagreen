import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    username?: string;
    password?: string;
    confirmPassword?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Preencha os dados para continuar." }, { status: 400 });
  }
  if (body.username?.trim().toLowerCase() !== "talita" || body.password !== "1234") {
    return NextResponse.json({ error: "Use o usuário e a senha definidos para este acesso." }, { status: 400 });
  }
  if (body.confirmPassword !== body.password) {
    return NextResponse.json({ error: "A confirmação da senha não corresponde." }, { status: 400 });
  }

  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir o cadastro.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
