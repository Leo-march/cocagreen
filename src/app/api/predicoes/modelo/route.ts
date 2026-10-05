import { NextResponse } from "next/server";
import { ensureFailureModel, promoteFailureModelCandidate } from "@/lib/failure-classifier";
import { getAdminSession } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    if (!getAdminSession(request)) {
      return NextResponse.json({ error: "Ativação de modelos restrita ao acesso administrativo." }, { status: 403 });
    }

    const metrics = await ensureFailureModel();
    if (
      metrics.promotion_status !== "review_required"
      && metrics.promotion_status !== "not_consistently_better"
    ) {
      return NextResponse.json({ error: "Não há um modelo candidato aguardando aprovação manual." }, { status: 409 });
    }
    const promotedMetrics = await promoteFailureModelCandidate();
    return NextResponse.json({ metrics: promotedMetrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ativar o modelo candidato.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
