import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

type ImportedRow = Record<string, unknown>;
const FALLBACK_IMPORT_TABLE_NAME = "import_dados";

const identifier = (value: string) =>
  `\`${value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1") || "coluna"}\``;

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
