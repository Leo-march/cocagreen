import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  listPredictionFeedback,
  reviewPredictionFeedback,
  submitPredictionFeedback,
  type PredictionFeedbackInput,
} from "@/lib/mysql";
import { getAdminSession } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const observationHeaders = new Set(["observacao", "observacoes", "observation", "observations"]);
const reviewedLabelHeaders = new Set([
  "classificacaorevisada",
  "classificacaocorrigida",
  "rotulorevisado",
  "revisao",
  "reviewedlabel",
]);

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readConfidence(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(",", ".");
  const percentage = text.endsWith("%");
  const parsed = Number(percentage ? text.slice(0, -1) : text);
  if (!Number.isFinite(parsed)) return null;
  const normalized = percentage || parsed > 1 ? parsed / 100 : parsed;
  return normalized >= 0 && normalized <= 1 ? normalized : null;
}

function requireAdmin(request: Request) {
  try {
    const username = getAdminSession(request);
    return username
      ? { username }
      : { response: NextResponse.json({ error: "Ação restrita ao acesso administrativo." }, { status: 403 }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível validar a sessão administrativa.";
    return { response: NextResponse.json({ error: message }, { status: 503 }) };
  }
}

export async function GET(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;

  try {
    const rows = await listPredictionFeedback("pending");
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar a fila de revisão.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "O envio não contém um formulário válido." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma planilha com as correções revisadas." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx de até 10 MB." }, { status: 400 });
  }

  const feedback: PredictionFeedbackInput[] = [];
  try {
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const headers = Object.keys(rows[0] ?? {});
      const observationColumn = headers.find((header) => observationHeaders.has(normalizeHeader(header)));
      const reviewedLabelColumn = headers.find((header) => reviewedLabelHeaders.has(normalizeHeader(header)));
      const predictedColumn = headers.find((header) => normalizeHeader(header) === "classificacaoprevista");
      const confidenceColumn = headers.find((header) => normalizeHeader(header).startsWith("confiancadapredicao"));
      if (!observationColumn || !reviewedLabelColumn) {
        return NextResponse.json({
          error: `A aba '${sheetName}' precisa conter 'Observações' e 'Classificação revisada'.`,
        }, { status: 400 });
      }

      rows.forEach((row, rowIndex) => {
        const observation = String(row[observationColumn] ?? "").trim();
        const reviewedLabel = String(row[reviewedLabelColumn] ?? "").trim();
        if (!observation && !reviewedLabel) return;
        if (!observation || !reviewedLabel) {
          throw new Error(`Aba '${sheetName}', linha ${rowIndex + 2}: observação e classificação revisada são obrigatórias.`);
        }
        feedback.push({
          observation,
          predictedLabel: predictedColumn ? String(row[predictedColumn] ?? "").trim() : "",
          reviewedLabel,
          confidence: confidenceColumn ? readConfidence(row[confidenceColumn]) : null,
          sourceFile: file.name.slice(0, 255),
          createdBy: access.username,
        });
      });
    }

    if (feedback.length === 0) {
      return NextResponse.json({ error: "A planilha não contém correções preenchidas." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar as correções.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await submitPredictionFeedback(feedback);
    return NextResponse.json({
      ...result,
      duplicateRows: result.submittedRows - result.insertedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar as correções no banco de dados.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;

  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json() as { id?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: "Informe o identificador e a decisão de revisão." }, { status: 400 });
  }
  if (
    typeof body.id !== "number"
    || !Number.isSafeInteger(body.id)
    || (body.status !== "approved" && body.status !== "rejected")
  ) {
    return NextResponse.json({ error: "Identificador ou decisão de revisão inválidos." }, { status: 400 });
  }

  try {
    const result = await reviewPredictionFeedback(body.id, body.status, access.username);
    if (result.conflict) {
      return NextResponse.json({
        error: "Já existe uma correção aprovada para esta observação; rejeite a duplicata ou revise o conflito.",
      }, { status: 409 });
    }
    if (!result.updated) return NextResponse.json({ error: "A revisão não existe ou já foi processada." }, { status: 409 });
    return NextResponse.json({ success: true, trainingWillRefresh: body.status === "approved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a revisão.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
