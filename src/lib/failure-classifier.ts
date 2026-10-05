import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type TrainingMetrics = {
  sources: Record<string, {
    input_rows: number;
    missing_rows: number;
    empty_after_text_cleaning: number;
    duplicate_rows_removed: number;
    usable_training_rows: number;
  }>;
  duplicate_rows_removed: number;
  discarded_missing_observation_or_label: number;
  usable_training_rows: number;
  production_training_rows: number;
  classes: number;
  model_version: number;
  source_fingerprints: Record<string, string>;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
};

const scriptsDirectory = join(process.cwd(), "scripts");
const trainingDataDirectory = join(scriptsDirectory, "planilhas treinamento");
const outputDirectory = join(scriptsDirectory, "resultado_modelo_falhas");
const modelPath = join(outputDirectory, "modelo_classificacao_apontamentos.joblib");
const metricsPath = join(outputDirectory, "metricas.json");
const jundiaiTrainingFile = join(trainingDataDirectory, "apontamentos Jundiai.xlsx");
const mariliaTrainingFile = join(trainingDataDirectory, "Classificação dos Apontamentos - Marília.xlsx");

let trainingPromise: Promise<TrainingMetrics> | null = null;

async function pythonCommand() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

  const projectPython = join(
    process.cwd(),
    process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python",
  );
  try {
    await access(projectPython);
    return projectPython;
  } catch {
    return "python";
  }
}

export async function runPythonScript(scriptName: string, args: string[]) {
  const command = await pythonCommand();
  const scriptPath = join(scriptsDirectory, scriptName);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ command, [scriptPath, ...args], {
      cwd: scriptsDirectory,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${scriptName} encerrou com código ${code}.`));
    });
  });
}

async function readMetrics() {
  return JSON.parse(await readFile(metricsPath, "utf8")) as TrainingMetrics;
}

async function trainModel(): Promise<TrainingMetrics> {
  await runPythonScript("train_failure_classifier.py", ["--output-dir", outputDirectory]);
  return readMetrics();
}

export async function ensureFailureModel(forceTraining = false) {
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    let isOutdated = forceTraining;
    try {
      const [
        modelStats,
        jundiaiStats,
        jundiaiContents,
        mariliaStats,
        mariliaContents,
        metrics,
      ] = await Promise.all([
        stat(modelPath),
        stat(jundiaiTrainingFile),
        readFile(jundiaiTrainingFile),
        stat(mariliaTrainingFile),
        readFile(mariliaTrainingFile),
        readMetrics(),
      ]);
      const sourceFingerprints = [
        {
          name: "apontamentos Jundiai.xlsx",
          mtimeMs: jundiaiStats.mtimeMs,
          fingerprint: createHash("sha256").update(jundiaiContents).digest("hex"),
        },
        {
          name: "Classificação dos Apontamentos - Marília.xlsx",
          mtimeMs: mariliaStats.mtimeMs,
          fingerprint: createHash("sha256").update(mariliaContents).digest("hex"),
        },
      ];
      if (
        metrics.model_version !== 2
        || !metrics.sources
        || !Number.isFinite(metrics.production_training_rows)
        || !metrics.source_fingerprints
        || sourceFingerprints.some((source) =>
          source.mtimeMs > modelStats.mtimeMs
          || metrics.source_fingerprints[source.name] !== source.fingerprint)
      ) {
        isOutdated = true;
      }
    } catch {
      isOutdated = true;
    }

    if (isOutdated) return trainModel();
    return readMetrics();
  })();

  try {
    return await trainingPromise;
  } finally {
    trainingPromise = null;
  }
}

export { modelPath };
