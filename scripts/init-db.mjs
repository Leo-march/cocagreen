import mysql from 'mysql2/promise';

const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3308),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'cocagreen',
};

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`);
    console.log(`Banco '${config.database}' pronto.`);
  } finally {
    await connection.end();
  }
}

async function ensureTable() {
  const pool = mysql.createPool(config);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_dados (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Tabela 'import_dados' pronta.");
  } finally {
    await pool.end();
  }
}

async function main() {
  await ensureDatabase();
  await ensureTable();
}

main().catch((error) => {
  console.error('Erro ao inicializar o banco:', error.message);
  process.exit(1);
});
