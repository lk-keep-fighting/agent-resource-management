import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12#$qwER',
  database: 'agent_skill_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createUser(name: string, email: string) {
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);
  const apiKeyHash = hashApiKey(apiKey);
  const id = uuidv4();

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      'INSERT INTO users (id, name, email, api_key_hash, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, name, email, apiKeyHash]
    );
    console.log('User created successfully!');
    console.log('---');
    console.log(`ID: ${id}`);
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`API Key: ${apiKey}`);
    console.log('---');
    console.log('保存好 API Key，它不会再次显示！');
  } finally {
    connection.release();
  }
  await pool.end();
}

createUser('admin', 'admin@example.com');