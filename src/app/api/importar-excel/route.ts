import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { saveImportedTable } from "@/lib/mysql";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedExtensions = new Set([".xlsx", ".xld", ".xls"]);

async function runParser(filePath: string): Promise<string> {
  const projectPython = join(
    process.cwd(),
    process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python",
  );
  let pythonCommand = process.env.PYTHON_PATH || "python";
  if (!process.env.PYTHON_PATH) {
    try {
      await access(projectPython);
      pythonCommand = projectPython;
    } catch {
      // Use PATH when the project virtual environment is unavailable.
    }
  }
  const scriptPath = join(process.cwd(), "scripts", "parse_excel.py");

  return new Promise((resolve, reject) => {
    const parser = spawn(/*turbopackIgnore: true*/ pythonCommand, [scriptPath, filePath], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      windowsHide: true,
    });
    let output = "";
    let errorOutput = "";

    parser.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    parser.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });
    parser.on("error", (error) => reject(error));
    parser.on("close", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      const details = errorOutput.trim() || output.trim();
      reject(new Error(details || "Não foi possível processar a planilha."));
    });
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo Excel para importar." }, { status: 400 });
  }

  const extension = uploadedFile.name.slice(uploadedFile.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json({ error: "Envie um arquivo no formato .xlsx, .xld ou .xls." }, { status: 400 });
  }

  if (uploadedFile.size === 0 || uploadedFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "O arquivo deve ter entre 1 byte e 10 MB." }, { status: 400 });
  }

  const temporaryDirectory = join(tmpdir(), `cocagreen-${randomUUID()}`);
  const temporaryFile = join(temporaryDirectory, `upload${extension}`);

  try {
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(temporaryFile, Buffer.from(await uploadedFile.arrayBuffer()));
    const parserOutput = await runParser(temporaryFile);
    const result = JSON.parse(parserOutput) as {
      error?: string;
      sheet?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      totalRows?: number;
    };

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const persisted = await saveImportedTable(
      result.sheet || "planilha",
      result.columns || [],
      result.rows || [],
    );
    const previewRows = (result.rows || []).slice(0, 100).map((row) =>
      Object.fromEntries(
        persisted.columns.map((column, index) => [
          column,
          row[result.columns?.[index] || ""] ?? "",
        ]),
      ),
    );

    return NextResponse.json({
      ...result,
      ...persisted,
      rows: previewRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao importar a planilha.";
    const status = message.startsWith("Configure as variáveis") ? 503 : 500;
    return NextResponse.json(
      { error: `Não foi possível importar o Excel. ${message}` },
      { status },
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
