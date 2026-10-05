import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";

type ImportedRow = Record<string, unknown>;
const FALLBACK_IMPORT_TABLE_NAME = "import_dados";
const PREDICTION_FEEDBACK_TABLE = "failure_prediction_feedback";
const FAILURE_CLASSIFICATION_CATEGORIES_TABLE = "failure_classification_categories";
const AI_PREDICTION_COLUMN = "classificacao_pela_ia";
const AI_CONFIDENCE_COLUMN = "confianca_classificacao_ia";
const REVIEWED_CLASSIFICATION_COLUMN = "classificacao_validada";
const CLASSIFICATION_APPROVED_COLUMN = "classificacao_ia_aprovada";

export type ImportedPrediction = {
  id: string;
  label: string;
  confidence: number;
};

export type PredictionFeedbackInput = {
  observation: string;
  predictedLabel: string;
  reviewedLabel: string;
  confidence: number | null;
  sourceFile: string;
  createdBy: string;
};

export type PredictionFeedbackRow = {
  id: number;
  observation: string;
  predicted_label: string;
  reviewed_label: string;
  confidence: number | null;
  source_file: string;
  status: "pending" | "approved" | "rejected";
  created_by: string;
  created_at: string;
};

function normalizeFeedbackValue(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function normalizeFeedbackObservation(value: string) {
  return value
    .normalize("NFKC")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .toLocaleLowerCase("pt-BR")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/[^\p{L}\p{N}_\s+#./-]/gu, " ")
    .replace(/(?<![\p{L}\p{N}_])[+#./-]+|[+#./-]+(?![\p{L}\p{N}_])/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashFeedbackObservation(value: string) {
  return createHash("sha256").update(normalizeFeedbackObservation(value)).digest("hex");
}

const identifier = (value: string) =>
  `\`${value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1") || "coluna"}\``;

function normalizeImportedColumn(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getConfig() {
  const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER"] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Configure as variáveis ${missing.join(", ")} no arquivo .env.local.`);
  }

  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3307),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || "root",
  };
}

export async function getUnpredictedLatestImportedRows() {
  const pool = mysql.createPool(getConfig());

  try {
    const [tables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME DESC
       LIMIT 1`,
    );
    const tableName = tables[0]?.table_name;
    if (!tableName) return null;

    const [columnRows] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName],
    );
    const columns = columnRows.map(({ column_name }) => column_name);
    const normalizedColumns = columns.map((column) => ({
      column,
      normalized: normalizeImportedColumn(column),
    }));
    const observationColumn = normalizedColumns.find(({ normalized }) =>
      ["observacao", "observacoes", "observation", "observations"].includes(normalized),
    )?.column ?? normalizedColumns.find(({ normalized }) =>
      /^(observacao|observacoes|observation|observations)(?:(?:da|de)?parada)?$/.test(normalized),
    )?.column;
    if (!observationColumn) {
      throw new Error("A tabela importada não contém uma coluna de observações reconhecida.");
    }

    const existingColumns = new Set(columns);
    if (!existingColumns.has(AI_PREDICTION_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)}
         ADD COLUMN ${identifier(AI_PREDICTION_COLUMN)} TEXT NULL AFTER ${identifier(observationColumn)}`,
      );
    }
    if (!existingColumns.has(AI_CONFIDENCE_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)}
         ADD COLUMN ${identifier(AI_CONFIDENCE_COLUMN)} DECIMAL(7,6) NULL AFTER ${identifier(AI_PREDICTION_COLUMN)}`,
      );
    }
    if (!existingColumns.has(REVIEWED_CLASSIFICATION_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)}
         ADD COLUMN ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} TEXT NULL AFTER ${identifier(AI_CONFIDENCE_COLUMN)}`,
      );
    }
    if (!existingColumns.has(CLASSIFICATION_APPROVED_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)}
         ADD COLUMN ${identifier(CLASSIFICATION_APPROVED_COLUMN)} TINYINT(1) NOT NULL DEFAULT 0 AFTER ${identifier(REVIEWED_CLASSIFICATION_COLUMN)}`,
      );
    }
    await pool.query(
      `UPDATE ${identifier(tableName)}
       SET ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} = ${identifier(AI_PREDICTION_COLUMN)},
           ${identifier(CLASSIFICATION_APPROVED_COLUMN)} = 1
       WHERE ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} IS NULL
         AND ${identifier(CLASSIFICATION_APPROVED_COLUMN)} = 0
         AND ${identifier(AI_PREDICTION_COLUMN)} IS NOT NULL
         AND ${identifier(AI_CONFIDENCE_COLUMN)} > 0.9`,
    );

    const [rows] = await pool.query<
      (RowDataPacket & { id: string | number; observation: string | null })[]
    >(
      `SELECT \`id\`, ${identifier(observationColumn)} AS observation
       FROM ${identifier(tableName)}
       WHERE ${identifier(AI_PREDICTION_COLUMN)} IS NULL
         AND ${identifier(observationColumn)} IS NOT NULL
         AND TRIM(${identifier(observationColumn)}) <> ''`,
    );

    return {
      tableName,
      rows: rows.map((row) => ({
        id: String(row.id),
        observation: String(row.observation ?? ""),
      })),
    };
  } finally {
    await pool.end();
  }
}

export async function saveLatestImportedPredictions(
  tableName: string,
  predictions: ImportedPrediction[],
) {
  const pool = mysql.createPool(getConfig());

  try {
    for (let start = 0; start < predictions.length; start += 200) {
      const batch = predictions.slice(start, start + 200);
      const labelCases = batch.map(() => "WHEN ? THEN ?").join(" ");
      const confidenceCases = batch.map(() => "WHEN ? THEN ?").join(" ");
      const ids = batch.map(({ id }) => id);
      await pool.execute<ResultSetHeader>(
        `UPDATE ${identifier(tableName)}
         SET ${identifier(AI_PREDICTION_COLUMN)} = CASE id ${labelCases} ELSE ${identifier(AI_PREDICTION_COLUMN)} END,
             ${identifier(AI_CONFIDENCE_COLUMN)} = CASE id ${confidenceCases} ELSE ${identifier(AI_CONFIDENCE_COLUMN)} END,
             ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} = CASE id ${batch.map(() => "WHEN ? THEN IF(? > 0.9, ?, NULL)").join(" ")} ELSE ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} END,
             ${identifier(CLASSIFICATION_APPROVED_COLUMN)} = CASE id ${batch.map(() => "WHEN ? THEN IF(? > 0.9, 1, 0)").join(" ")} ELSE ${identifier(CLASSIFICATION_APPROVED_COLUMN)} END
         WHERE id IN (${ids.map(() => "?").join(", ")})
           AND ${identifier(AI_PREDICTION_COLUMN)} IS NULL`,
        [
          ...batch.flatMap(({ id, label }) => [id, label]),
          ...batch.flatMap(({ id, confidence }) => [id, confidence]),
          ...batch.flatMap(({ id, confidence, label }) => [id, confidence, label]),
          ...batch.flatMap(({ id, confidence }) => [id, confidence]),
          ...ids,
        ],
      );
    }
  } finally {
    await pool.end();
  }
}

export async function saveImportedClassification(id: string, classification: string, approved: boolean) {
  const pool = mysql.createPool(getConfig());

  try {
    const [tables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME DESC
       LIMIT 1`,
    );
    const tableName = tables[0]?.table_name;
    if (!tableName) throw new Error("Não há tabela importada para salvar a classificação.");

    const [columns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    const existingColumns = new Set(columns.map(({ column_name }) => column_name));
    if (!existingColumns.has(REVIEWED_CLASSIFICATION_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)} ADD COLUMN ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} TEXT NULL`,
      );
    }
    if (!existingColumns.has(CLASSIFICATION_APPROVED_COLUMN)) {
      await pool.query(
        `ALTER TABLE ${identifier(tableName)} ADD COLUMN ${identifier(CLASSIFICATION_APPROVED_COLUMN)} TINYINT(1) NOT NULL DEFAULT 0`,
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE ${identifier(tableName)}
       SET ${identifier(REVIEWED_CLASSIFICATION_COLUMN)} = ?,
           ${identifier(CLASSIFICATION_APPROVED_COLUMN)} = ?
       WHERE id = ?`,
      [classification || null, approved ? 1 : 0, id],
    );
    if (result.affectedRows === 0) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${identifier(tableName)} WHERE id = ? LIMIT 1`,
        [id],
      );
      if (rows.length === 0) throw new Error("O registro não existe mais na tabela importada.");
    }
  } finally {
    await pool.end();
  }
}

async function ensureFailureClassificationCategoriesTable(pool: ReturnType<typeof mysql.createPool>) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${identifier(FAILURE_CLASSIFICATION_CATEGORIES_TABLE)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      category VARCHAR(512) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_failure_classification_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function getFailureClassificationCategories() {
  const pool = mysql.createPool(getConfig());

  try {
    await ensureFailureClassificationCategoriesTable(pool);
    const [rows] = await pool.query<(RowDataPacket & { category: string })[]>(
      `SELECT category
       FROM ${identifier(FAILURE_CLASSIFICATION_CATEGORIES_TABLE)}
       ORDER BY category`,
    );
    return rows.map(({ category }) => category);
  } finally {
    await pool.end();
  }
}

export async function saveFailureClassificationCategory(category: string) {
  const pool = mysql.createPool(getConfig());

  try {
    await ensureFailureClassificationCategoriesTable(pool);
    await pool.execute(
      `INSERT INTO ${identifier(FAILURE_CLASSIFICATION_CATEGORIES_TABLE)} (category)
       VALUES (?)
       ON DUPLICATE KEY UPDATE category = VALUES(category)`,
      [category],
    );
    const [rows] = await pool.execute<(RowDataPacket & { category: string })[]>(
      `SELECT category
       FROM ${identifier(FAILURE_CLASSIFICATION_CATEGORIES_TABLE)}
       WHERE category = ?
       LIMIT 1`,
      [category],
    );
    const savedCategory = rows[0]?.category;
    if (!savedCategory) throw new Error("Não foi possível recuperar a falha adicionada.");
    return savedCategory;
  } finally {
    await pool.end();
  }
}

async function ensurePredictionFeedbackTable(pool: ReturnType<typeof mysql.createPool>) {
  const connection = await pool.getConnection();
  const lockName = "cocagreen_prediction_feedback_schema";
  try {
    const [locks] = await connection.query<(RowDataPacket & { acquired: number | null })[]>(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [lockName],
    );
    if (Number(locks[0]?.acquired) !== 1) {
      throw new Error("Não foi possível bloquear a migração da fila de revisões no MySQL.");
    }

    try {
      await connection.query(
        `CREATE TABLE IF NOT EXISTS ${identifier(PREDICTION_FEEDBACK_TABLE)} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          observation LONGTEXT NOT NULL,
          predicted_label VARCHAR(512) NOT NULL,
          reviewed_label VARCHAR(512) NOT NULL,
          confidence DECIMAL(7,6) NULL,
          source_file VARCHAR(255) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          fingerprint CHAR(64) NOT NULL,
          observation_fingerprint CHAR(64) NOT NULL,
          approved_observation_fingerprint CHAR(64) NULL,
          created_by VARCHAR(191) NOT NULL,
          reviewed_by VARCHAR(191) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reviewed_at TIMESTAMP NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_failure_feedback_fingerprint (fingerprint),
          UNIQUE KEY uq_failure_feedback_approved_observation (approved_observation_fingerprint),
          KEY ix_failure_feedback_observation (status, observation_fingerprint),
          KEY ix_failure_feedback_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      const [columnRows] = await connection.query<
        (RowDataPacket & { COLUMN_NAME: string; IS_NULLABLE: string })[]
      >(
        `SELECT COLUMN_NAME, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [PREDICTION_FEEDBACK_TABLE],
      );
      const columns = new Set(columnRows.map((row) => row.COLUMN_NAME));
      const observationIsNullable = columnRows.find(
        (row) => row.COLUMN_NAME === "observation_fingerprint",
      )?.IS_NULLABLE === "YES";
      const observationNeedsMigration = !columns.has("observation_fingerprint") || observationIsNullable;
      const approvedNeedsMigration = !columns.has("approved_observation_fingerprint");
      if (!columns.has("observation_fingerprint")) {
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ADD COLUMN observation_fingerprint CHAR(64) NULL`,
        );
      }
      if (!columns.has("approved_observation_fingerprint")) {
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ADD COLUMN approved_observation_fingerprint CHAR(64) NULL`,
        );
      }

      if (observationNeedsMigration || approvedNeedsMigration) {
        const [feedbackRows] = await connection.query<
          (RowDataPacket & { id: number | string; observation: string })[]
        >(
          `SELECT id, observation
           FROM ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ${columns.has("observation_fingerprint") ? "WHERE observation_fingerprint IS NULL" : ""}`,
        );
        for (let start = 0; start < feedbackRows.length; start += 200) {
          const batch = feedbackRows.slice(start, start + 200);
          const cases = batch.map(() => "WHEN ? THEN ?").join(" ");
          const ids = batch.map((row) => row.id);
          const values = batch.flatMap((row) => [row.id, hashFeedbackObservation(row.observation)]);
          await connection.execute(
            `UPDATE ${identifier(PREDICTION_FEEDBACK_TABLE)}
             SET observation_fingerprint = CASE id ${cases} ELSE observation_fingerprint END
             WHERE id IN (${ids.map(() => "?").join(", ")})`,
            [...values, ...ids],
          );
        }
      }

      if (observationNeedsMigration) {
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           MODIFY COLUMN observation_fingerprint CHAR(64) NOT NULL`,
        );
      }
      await connection.query(
        `UPDATE ${identifier(PREDICTION_FEEDBACK_TABLE)}
         SET approved_observation_fingerprint = observation_fingerprint
         WHERE status = 'approved' AND approved_observation_fingerprint IS NULL`,
      );

      const [indexRows] = await connection.query<(RowDataPacket & { INDEX_NAME: string })[]>(
        `SELECT INDEX_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [PREDICTION_FEEDBACK_TABLE],
      );
      const indexes = new Set(indexRows.map((row) => row.INDEX_NAME));
      if (!indexes.has("uq_failure_feedback_approved_observation")) {
        const [conflicts] = await connection.query<RowDataPacket[]>(
          `SELECT observation_fingerprint, COUNT(*) AS occurrences
           FROM ${identifier(PREDICTION_FEEDBACK_TABLE)}
           WHERE status = 'approved'
           GROUP BY observation_fingerprint
           HAVING COUNT(*) > 1
           LIMIT 1`,
        );
        if (conflicts.length > 0) {
          throw new Error(
            "A fila existente contém várias correções aprovadas para a mesma observação; resolva as duplicidades antes da migração.",
          );
        }
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ADD UNIQUE KEY uq_failure_feedback_approved_observation (approved_observation_fingerprint)`,
        );
      }
      if (!indexes.has("ix_failure_feedback_observation")) {
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ADD KEY ix_failure_feedback_observation (status, observation_fingerprint)`,
        );
      }
      if (!indexes.has("ix_failure_feedback_status_created")) {
        await connection.query(
          `ALTER TABLE ${identifier(PREDICTION_FEEDBACK_TABLE)}
           ADD KEY ix_failure_feedback_status_created (status, created_at)`,
        );
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
    }
  } finally {
    connection.release();
  }
}

export async function submitPredictionFeedback(rows: PredictionFeedbackInput[]) {
  const pool = mysql.createPool(getConfig());

  try {
    await ensurePredictionFeedbackTable(pool);
    let insertedRows = 0;
    for (let start = 0; start < rows.length; start += 200) {
      const batch = rows.slice(start, start + 200);
      const values = batch.map((row) => {
        const normalizedObservation = normalizeFeedbackObservation(row.observation);
        const normalizedLabel = normalizeFeedbackValue(row.reviewedLabel);
        const fingerprint = createHash("sha256")
          .update(`${normalizedObservation}\u0000${normalizedLabel}`)
          .digest("hex");
        return [
          row.observation,
          row.predictedLabel,
          row.reviewedLabel,
          row.confidence,
          row.sourceFile,
          fingerprint,
          hashFeedbackObservation(row.observation),
          row.createdBy,
        ];
      });
      const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO ${identifier(PREDICTION_FEEDBACK_TABLE)}
          (observation, predicted_label, reviewed_label, confidence, source_file, fingerprint,
           observation_fingerprint, created_by)
         VALUES ${placeholders}`,
        values.flat(),
      );
      insertedRows += result.affectedRows;
    }
    return { insertedRows, submittedRows: rows.length };
  } finally {
    await pool.end();
  }
}

export async function listPredictionFeedback(status: "pending" | "approved" | "rejected" = "pending") {
  const pool = mysql.createPool(getConfig());

  try {
    await ensurePredictionFeedbackTable(pool);
    const [rows] = await pool.execute<
      (RowDataPacket & PredictionFeedbackRow)[]
    >(
      `SELECT id, observation, predicted_label, reviewed_label, confidence, source_file,
              status, created_by, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM ${identifier(PREDICTION_FEEDBACK_TABLE)}
       WHERE status = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 500`,
      [status],
    );
    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      confidence: row.confidence === null ? null : Number(row.confidence),
    }));
  } finally {
    await pool.end();
  }
}

export async function reviewPredictionFeedback(
  id: number,
  status: "approved" | "rejected",
  reviewedBy: string,
) {
  const pool = mysql.createPool(getConfig());

  try {
    await ensurePredictionFeedbackTable(pool);
    const [pending] = await pool.execute<
      (RowDataPacket & { observation_fingerprint: string })[]
    >(
      `SELECT observation_fingerprint
       FROM ${identifier(PREDICTION_FEEDBACK_TABLE)}
       WHERE id = ? AND status = 'pending'`,
      [id],
    );
    if (!pending[0]) return { updated: false, conflict: false };

    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${identifier(PREDICTION_FEEDBACK_TABLE)}
         SET status = ?,
             approved_observation_fingerprint = CASE WHEN ? = 'approved' THEN observation_fingerprint ELSE NULL END,
             reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending'`,
        [status, status, reviewedBy, id],
      );
      return { updated: result.affectedRows === 1, conflict: false };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
        return { updated: false, conflict: true };
      }
      throw error;
    }
  } finally {
    await pool.end();
  }
}

export async function getApprovedPredictionFeedback() {
  const pool = mysql.createPool(getConfig());

  try {
    await ensurePredictionFeedbackTable(pool);
    const [rows] = await pool.query<
      (RowDataPacket & { id: number; observation: string; reviewed_label: string })[]
    >(
      `SELECT id, observation, reviewed_label
       FROM ${identifier(PREDICTION_FEEDBACK_TABLE)}
       WHERE status = 'approved'
       ORDER BY id ASC`,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      observation: row.observation,
      reviewed_label: row.reviewed_label,
    }));
  } finally {
    await pool.end();
  }
}

export async function saveImportedTable(
  requestedTableName: string,
  columns: string[],
  rows: ImportedRow[],
) {
  const normalizedColumns = columns.map((column, index) => {
    const base = column
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase()
      .replace(/^(\d)/, "_$1");
    return base || `coluna_${index + 1}`;
  });
  const usedColumnNames = new Set(["id", "created_at"]);
  const uniqueColumns = normalizedColumns.map((column) => {
    let name = column;
    let suffix = 2;
    while (usedColumnNames.has(name)) {
      name = `${column}_${suffix}`;
      suffix += 1;
    }
    usedColumnNames.add(name);
    return name;
  });
  const pool = mysql.createPool(getConfig());

  try {
    const [existingTables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME ASC
       LIMIT 1`,
    );
    const tableName = existingTables[0]?.table_name || FALLBACK_IMPORT_TABLE_NAME;

    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${identifier(tableName)} (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    const [existingColumns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    const existingColumnNames = new Set(existingColumns.map(({ column_name }) => column_name));
    for (const column of uniqueColumns) {
      if (!existingColumnNames.has(column)) {
        await pool.query(`ALTER TABLE ${identifier(tableName)} ADD COLUMN ${identifier(column)} TEXT NULL`);
      }
    }

    if (rows.length > 0) {
      const values = rows.map((row) => uniqueColumns.map((column, index) => {
        const sourceColumn = columns[index];
        const value = row[sourceColumn];
        return value === null || value === undefined ? null : String(value);
      }));
      const placeholders = values.map(() => `(${uniqueColumns.map(() => "?").join(", ")})`).join(", ");
      await pool.query<ResultSetHeader>(
        `INSERT INTO ${identifier(tableName)} (${uniqueColumns.map(identifier).join(", ")}) VALUES ${placeholders}`,
        values.flat(),
      );
    }

    return {
      tableName,
      columns: uniqueColumns,
      totalRows: rows.length,
    };
  } finally {
    await pool.end();
  }
}

export async function getLatestImportedTable() {
  const pool = mysql.createPool(getConfig());

  try {
    const [tables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME DESC
       LIMIT 1`,
    );
    const table = tables[0]?.table_name;
    if (!table) return null;

    const [rows] = await pool.query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT * FROM ${identifier(table)} ORDER BY id ASC LIMIT 1000`,
    );
    const [columns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME NOT IN ('id', 'created_at')
       ORDER BY ORDINAL_POSITION`,
      [table],
    );

    return {
      tableName: table,
      columns: columns.map(({ column_name }) => column_name),
      rows,
    };
  } finally {
    await pool.end();
  }
}

export async function getUniqueMachines() {
  const pool = mysql.createPool(getConfig());

  try {
    const [tables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME DESC
       LIMIT 1`,
    );
    const table = tables[0]?.table_name;
    if (!table) return [];

    const [columns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME NOT IN ('id', 'created_at')
       ORDER BY ORDINAL_POSITION`,
      [table],
    );
    const normalize = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const machineColumn = columns.find(({ column_name }) =>
      /chave.*parada|parada.*chave/.test(normalize(column_name)),
    )?.column_name;
    if (!machineColumn) {
      throw new Error("A tabela importada não possui uma coluna de chave da parada.");
    }
    const lineColumn = columns.find(({ column_name }) =>
      /linha|line/.test(normalize(column_name)),
    )?.column_name;
    const lineSelection = lineColumn
      ? `${identifier(lineColumn)} AS production_line`
      : "NULL AS production_line";
    const [rows] = await pool.query<
      (RowDataPacket & { machine_key: unknown; production_line: unknown })[]
    >(
      `SELECT ${identifier(machineColumn)} AS machine_key, ${lineSelection}
       FROM ${identifier(table)}
       WHERE ${identifier(machineColumn)} IS NOT NULL`,
    );

    const uniqueMachines = new Map<string, Set<string>>();
    for (const row of rows) {
      const name = String(row.machine_key ?? "").trim();
      if (!name) continue;

      const lines = uniqueMachines.get(name) ?? new Set<string>();
      const line = String(row.production_line ?? "").trim();
      if (line) lines.add(line);
      uniqueMachines.set(name, lines);
    }

    return Array.from(uniqueMachines, ([name, lines]) => ({
      name,
      lines: Array.from(lines).sort((first, second) => first.localeCompare(second, "pt-BR")),
    })).sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { numeric: true }));
  } finally {
    await pool.end();
  }
}

export async function getMachineStopDetails(machineName: string) {
  const pool = mysql.createPool(getConfig());

  try {
    const [tables] = await pool.query<(RowDataPacket & { table_name: string })[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'import\\_%'
       ORDER BY CREATE_TIME DESC
       LIMIT 1`,
    );
    const table = tables[0]?.table_name;
    if (!table) return [];

    const [columns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME NOT IN ('id', 'created_at')
       ORDER BY ORDINAL_POSITION`,
      [table],
    );
    const normalize = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const machineColumn = columns.find(({ column_name }) =>
      /chave.*parada|parada.*chave/.test(normalize(column_name)),
    )?.column_name;
    if (!machineColumn) {
      throw new Error("A tabela importada não possui uma coluna de chave da parada.");
    }

    const causeColumn = columns.find(({ column_name }) =>
      column_name !== machineColumn
      && /observa|subchave|chave_\d+|tipo.*parada|causa|motivo|defeito|falha|descricao/.test(normalize(column_name)),
    )?.column_name;
    const minutesColumn = columns.find(({ column_name }) =>
      /minut.*parada|total.*minuto|tempo|minute|duration|duracao/.test(normalize(column_name)),
    )?.column_name;
    const lineColumn = columns.find(({ column_name }) =>
      /linha|line/.test(normalize(column_name)),
    )?.column_name;
    const dateColumn = columns.find(({ column_name }) =>
      !/manutencao|maintenance/.test(normalize(column_name))
      && /data|date|inicio|abertura|ocorrencia/.test(normalize(column_name)),
    )?.column_name;
    const selectColumn = (column: string | undefined, alias: string) =>
      column ? `${identifier(column)} AS ${identifier(alias)}` : `NULL AS ${identifier(alias)}`;

    const [rows] = await pool.query<
      (RowDataPacket & {
        cause: unknown;
        minutes: unknown;
        line: unknown;
        occurred_at: unknown;
      })[]
    >(
      `SELECT
         ${selectColumn(causeColumn, "cause")},
         ${selectColumn(minutesColumn, "minutes")},
         ${selectColumn(lineColumn, "line")},
         ${selectColumn(dateColumn, "occurred_at")}
       FROM ${identifier(table)}
       WHERE ${identifier(machineColumn)} = ?`,
      [machineName],
    );

    return rows.map((row) => ({
      cause: row.cause === null || row.cause === undefined ? "" : String(row.cause).trim(),
      minutes: row.minutes === null || row.minutes === undefined ? "" : String(row.minutes).trim(),
      line: row.line === null || row.line === undefined ? "" : String(row.line).trim(),
      occurredAt: row.occurred_at === null || row.occurred_at === undefined
        ? ""
        : String(row.occurred_at).trim(),
    }));
  } finally {
    await pool.end();
  }
}
