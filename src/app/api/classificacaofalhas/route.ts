import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  getLatestImportedTable,
  getFailureClassificationCategories,
  getUnpredictedLatestImportedRows,
  saveImportedClassification,
  saveFailureClassificationCategory,
  saveLatestImportedPredictions,
  type ImportedPrediction,
} from "@/lib/mysql";
import { ensureFailureModel, modelPath, runPythonScript } from "@/lib/failure-classifier";
import { getAdminSession } from "@/lib/server-auth";

export const runtime = "nodejs";

let databasePredictionPromise: Promise<void> | null = null;

function parsePredictions(value: unknown): ImportedPrediction[] {
  if (!Array.isArray(value)) {
    throw new Error("O classificador retornou um formato de previsões inválido.");
  }

  return value.map((entry) => {
    if (
      typeof entry !== "object"
      || entry === null
      || !("id" in entry)
      || !("label" in entry)
      || !("confidence" in entry)
      || typeof entry.id !== "string"
      || typeof entry.label !== "string"
      || typeof entry.confidence !== "number"
      || !Number.isFinite(entry.confidence)
      || entry.confidence < 0
      || entry.confidence > 1
    ) {
      throw new Error("O classificador retornou uma previsão inválida.");
    }
    return {
      id: entry.id,
      label: entry.label,
      confidence: entry.confidence,
    };
  });
}

async function classifyUnpredictedDatabaseRows() {
  const unpredicted = await getUnpredictedLatestImportedRows();
  if (!unpredicted || unpredicted.rows.length === 0) return;

  await ensureFailureModel();
  const temporaryDirectory = join(tmpdir(), `cocagreen-classificacao-db-${randomUUID()}`);
  const inputPath = join(temporaryDirectory, "observacoes.json");
  const outputPath = join(temporaryDirectory, "predicoes.json");

  try {
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(inputPath, JSON.stringify(unpredicted.rows), "utf8");
    await runPythonScript("predict_database_observations.py", [
      "--input", inputPath,
      "--output", outputPath,
      "--model", modelPath,
    ]);
    const predictions = parsePredictions(JSON.parse(await readFile(outputPath, "utf8")) as unknown);
    await saveLatestImportedPredictions(unpredicted.tableName, predictions);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function ensureDatabasePredictions() {
  if (!databasePredictionPromise) {
    databasePredictionPromise = classifyUnpredictedDatabaseRows();
  }
  const activePromise = databasePredictionPromise;
  try {
    await activePromise;
  } finally {
    if (databasePredictionPromise === activePromise) databasePredictionPromise = null;
  }
}

export async function GET(request: Request) {
  try {
    if (getAdminSession(request)) await ensureDatabasePredictions();
    const [data, customCategories] = await Promise.all([
      getLatestImportedTable(),
      getFailureClassificationCategories(),
    ]);
    return NextResponse.json({ data, customCategories });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Não foi possível classificar as observações da tabela importada.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let username: string | null;
  try {
    username = getAdminSession(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível validar a sessão administrativa.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!username) {
    return NextResponse.json({ error: "Ação restrita ao acesso administrativo." }, { status: 403 });
  }

  let body: { category?: unknown };
  try {
    body = await request.json() as { category?: unknown };
  } catch {
    return NextResponse.json({ error: "Informe o nome da nova falha." }, { status: 400 });
  }
  if (
    typeof body.category !== "string"
    || !body.category.trim()
    || body.category.trim().length > 512
  ) {
    return NextResponse.json({ error: "O nome da falha deve ter entre 1 e 512 caracteres." }, { status: 400 });
  }

  try {
    const category = await saveFailureClassificationCategory(body.category.trim());
    return NextResponse.json({ category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a nova falha.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let username: string | null;
  try {
    username = getAdminSession(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível validar a sessão administrativa.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!username) {
    return NextResponse.json({ error: "Ação restrita ao acesso administrativo." }, { status: 403 });
  }

  let body: { id?: unknown; classification?: unknown; approved?: unknown };
  try {
    body = await request.json() as { id?: unknown; classification?: unknown; approved?: unknown };
  } catch {
    return NextResponse.json({ error: "Informe o registro e a classificação para aprovar." }, { status: 400 });
  }
  if (
    typeof body.id !== "string"
    || !/^\d+$/.test(body.id)
    || typeof body.classification !== "string"
    || body.classification.length > 512
    || typeof body.approved !== "boolean"
  ) {
    return NextResponse.json({ error: "Registro ou classificação inválidos." }, { status: 400 });
  }

  try {
    await saveImportedClassification(body.id, body.classification.trim(), body.approved);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a classificação no banco de dados.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
