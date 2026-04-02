import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agent_skill_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query<T>(sql: string, params?: (string | number | boolean | null)[]): Promise<T> {
  const [rows] = await pool.query(sql, params as (string | number | boolean | null)[]);
  return rows as T;
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;