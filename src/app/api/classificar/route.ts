// app/api/classificar/route.ts  (Next.js App Router)
// Variáveis no .env.local:
//   CLASSIFICADOR_URL=http://127.0.0.1:8000
//   CLASSIFICADOR_API_KEY=troque-esta-chave

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { texto, maquina } = await req.json();

  if (typeof texto !== "string" || texto.trim() === "") {
    return NextResponse.json({ erro: "Texto obrigatório" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${process.env.CLASSIFICADOR_URL}/classificar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLASSIFICADOR_API_KEY ?? "",
      },
      body: JSON.stringify({ texto, maquina }),
      cache: "no-store",
    });

    if (!resp.ok) {
      return NextResponse.json({ erro: "Falha no classificador" }, { status: 502 });
    }
    return NextResponse.json(await resp.json());
  } catch {
    return NextResponse.json({ erro: "Classificador indisponível" }, { status: 503 });
  }
}
