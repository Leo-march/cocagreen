import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import { ensureFailureModel, modelPath, runPythonScript } from "@/lib/failure-classifier";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedExtensions = new Set([".xlsx", ".xls"]);

export async function GET() {
  try {
    const metrics = await ensureFailureModel();
    return NextResponse.json({ metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível preparar o modelo de falhas.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    return NextResponse.json({ error: "Selecione uma planilha para classificar." }, { status: 400 });
  }

  const extension = extname(uploadedFile.name).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json({ error: "Envie uma planilha nos formatos .xlsx ou .xls." }, { status: 400 });
  }
  if (uploadedFile.size === 0 || uploadedFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "A planilha deve ter entre 1 byte e 10 MB." }, { status: 400 });
  }

  const temporaryDirectory = join(tmpdir(), `cocagreen-predicao-${randomUUID()}`);
  const inputPath = join(temporaryDirectory, `entrada${extension}`);
  const outputPath = join(temporaryDirectory, "predicoes.xlsx");

  try {
    await ensureFailureModel();
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(inputPath, Buffer.from(await uploadedFile.arrayBuffer()));
    await runPythonScript("predict_failure_classifier.py", [
      "--input", inputPath,
      "--output", outputPath,
      "--model", modelPath,
    ]);
    const workbook = await readFile(outputPath);
    const safeBaseName = uploadedFile.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="predicoes-${safeBaseName || "observacoes"}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível classificar a planilha.";
    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
