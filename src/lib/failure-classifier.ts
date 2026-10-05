import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getApprovedPredictionFeedback } from "@/lib/mysql";

export type TrainingMetrics = {
  sources: Record<string, {
    input_rows: number;
    missing_rows: number;
    empty_after_text_cleaning: number;
    rows_superseded_by_approved_feedback: number;
    duplicate_rows_removed: number;
    usable_training_rows: number;
  }>;
  duplicate_rows_removed: number;
  discarded_missing_observation_or_label: number;
  historical_rows_superseded_by_approved_feedback: number;
  approved_feedback_rows: number;
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
  selected_algorithm: string;
  selected_parameters: Record<string, string | number>;
  model_comparison: {
    algorithm: string;
    best_parameters: Record<string, string | number>;
    cv_accuracy_mean: number;
    cv_accuracy_std: number;
    cv_precision_macro_mean: number;
    cv_precision_macro_std: number;
    cv_recall_macro_mean: number;
    cv_recall_macro_std: number;
    cv_f1_macro_mean: number;
    cv_f1_macro_std: number;
    cv_f1_weighted_mean: number;
    cv_f1_weighted_std: number;
    train_f1_macro_mean: number;
    train_validation_f1_gap: number;
  }[];
  train_rows: number;
  test_rows: number;
  train_proportion: number;
  test_actual_proportion: number;
  classes_with_one_record: number;
  classes_with_fewer_than_three_records: number;
  classes_with_fewer_than_five_records: number;
  near_duplicate_pairs_reviewed: number;
  similar_label_pairs_reviewed: number;
  confidence_review_threshold: number;
  top_confusions: {
    classificacao_real: string;
    classificacao_prevista: string;
    ocorrencias: number;
  }[];
  metrics_by_source: {
    origem: string;
    amostras_teste: number;
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    weighted_precision: number;
    weighted_recall: number;
    weighted_f1: number;
  }[];
  difficult_classes: {
    classificacao: string;
    f1: number;
    recall: number;
    support: number;
  }[];
  promotion_status: string;
  active_model_comparable: boolean;
  active_model: {
    algorithm: string | null;
    accuracy: number | null;
    macro_f1: number | null;
    weighted_f1: number | null;
  };
  previous_active_metrics: {
    algorithm: string | null;
    accuracy: number | null;
    macro_f1: number | null;
    weighted_f1: number | null;
  };
  training_version: number;
  model_history: {
    training_version: number;
    trained_at: string;
    algorithm: string;
    parameters: Record<string, string | number>;
    accuracy: number;
    macro_f1: number;
    weighted_f1: number;
    cv_macro_f1_mean: number | null;
    cv_macro_f1_std: number | null;
    promotion_status: string;
  }[];
};

const scriptsDirectory = join(process.cwd(), "scripts");
const trainingDataDirectory = join(scriptsDirectory, "planilhas treinamento");
const outputDirectory = join(scriptsDirectory, "resultado_modelo_falhas");
const modelPath = join(outputDirectory, "modelo_classificacao_apontamentos.joblib");
const candidateModelPath = join(outputDirectory, "modelo_classificacao_candidato.joblib");
const metricsPath = join(outputDirectory, "metricas.json");
const modelHistoryPath = join(outputDirectory, "historico_modelos.json");
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

function fingerprintFeedback(rows: Awaited<ReturnType<typeof getApprovedPredictionFeedback>>) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function trainModel(
  approvedFeedback: Awaited<ReturnType<typeof getApprovedPredictionFeedback>>,
  feedbackFingerprint: string,
): Promise<TrainingMetrics> {
  const temporaryDirectory = join(tmpdir(), `cocagreen-feedback-${randomUUID()}`);
  const feedbackPath = join(temporaryDirectory, "approved-feedback.json");
  try {
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(feedbackPath, JSON.stringify(approvedFeedback), "utf8");
    await runPythonScript("train_failure_classifier.py", [
      "--output-dir", outputDirectory,
      "--feedback-file", feedbackPath,
      "--feedback-fingerprint", feedbackFingerprint,
    ]);
    return readMetrics();
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function ensureFailureModel(forceTraining = false) {
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    let isOutdated = forceTraining;
    const approvedFeedback = await getApprovedPredictionFeedback();
    const feedbackFingerprint = fingerprintFeedback(approvedFeedback);
    try {
      const [modelStats, candidateStats, metrics, jundiaiContents, mariliaContents] = await Promise.all([
        stat(modelPath),
        stat(candidateModelPath),
        readMetrics(),
        readFile(jundiaiTrainingFile),
        readFile(mariliaTrainingFile),
      ]);
      const sourceFingerprints = {
        "apontamentos Jundiai.xlsx": createHash("sha256").update(jundiaiContents).digest("hex"),
        "Classificação dos Apontamentos - Marília.xlsx": createHash("sha256").update(mariliaContents).digest("hex"),
        correcoes_aprovadas: feedbackFingerprint,
      };
      if (
        !modelStats.isFile()
        || !candidateStats.isFile()
        || metrics.model_version !== 4
        || !metrics.sources
        || !Number.isFinite(metrics.production_training_rows)
        || !metrics.source_fingerprints
        || Object.entries(sourceFingerprints).some(
          ([name, fingerprint]) => metrics.source_fingerprints[name] !== fingerprint,
        )
      ) {
        isOutdated = true;
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      isOutdated = true;
    }

    if (isOutdated) return trainModel(approvedFeedback, feedbackFingerprint);
    return readMetrics();
  })();

  try {
    return await trainingPromise;
  } finally {
    trainingPromise = null;
  }
}

export async function promoteFailureModelCandidate() {
  const metrics = await ensureFailureModel();
  await copyFile(candidateModelPath, modelPath);
  const promotedMetrics: TrainingMetrics = {
    ...metrics,
    promotion_status: "manually_promoted",
    active_model: {
      algorithm: metrics.selected_algorithm,
      accuracy: metrics.accuracy,
      macro_f1: metrics.macro_f1,
      weighted_f1: metrics.weighted_f1,
    },
  };
  const modelHistory = promotedMetrics.model_history.map((entry) => (
    entry.training_version === promotedMetrics.training_version
      ? { ...entry, promotion_status: "manually_promoted" }
      : entry
  ));
  promotedMetrics.model_history = modelHistory;
  await writeFile(modelHistoryPath, JSON.stringify(modelHistory, null, 2), "utf8");
  await writeFile(metricsPath, JSON.stringify(promotedMetrics, null, 2), "utf8");
  return promotedMetrics;
}

export { candidateModelPath, modelPath };
