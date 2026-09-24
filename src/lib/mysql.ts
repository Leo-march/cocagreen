import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

type ImportedRow = Record<string, unknown>;

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
  const tableName = `import_${requestedTableName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase()
    .slice(0, 45)}_${Date.now()}`;
  const normalizedColumns = columns.map((column, index) => {
    const base = column
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase()
      .replace(/^(\d)/, "_$1");
    return base || `coluna_${index + 1}`;
  });
  const uniqueColumns = normalizedColumns.map((column, index) =>
    normalizedColumns.slice(0, index).includes(column) ? `${column}_${index + 1}` : column,
  );
  const pool = mysql.createPool(getConfig());

  try {
    const definitions = uniqueColumns.map((column) => `${identifier(column)} TEXT NULL`).join(", ");
    await pool.query(
      `CREATE TABLE ${identifier(tableName)} (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        ${definitions},
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

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

    const columnTables: string[] = [];
    for (let columnIndex = 0; columnIndex < uniqueColumns.length; columnIndex += 1) {
      const columnTable = uniqueColumns[columnIndex];
      columnTables.push(columnTable);
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ${identifier(columnTable)} (
          \`registro_id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`indice_linha\` INT UNSIGNED NOT NULL,
          \`valor\` TEXT NULL,
          \`criado_em\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`registro_id\`),
          INDEX (\`indice_linha\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      if (rows.length > 0) {
        const values = rows.map((row, rowIndex) => [
          rowIndex,
          row[columns[columnIndex]] === null || row[columns[columnIndex]] === undefined
            ? null
            : String(row[columns[columnIndex]]),
        ]);
        const placeholders = values.map(() => "(?, ?)").join(", ");
        await pool.query(
          `INSERT INTO ${identifier(columnTable)} (\`indice_linha\`, \`valor\`) VALUES ${placeholders}`,
          values.flat(),
        );
      }
    }

    return {
      tableName,
      tableNames: columnTables,
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
