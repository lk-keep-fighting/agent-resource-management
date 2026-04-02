import 'dotenv/config';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `mysql://${process.env.DB_USER || 'root'}:${(process.env.DB_PASSWORD || '').replace('#', '%23').replace('$', '%24')}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'agent_skill_system'}`,
    },
  },
});

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createUser(name: string, email: string) {
  const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);
  const apiKeyHash = hashApiKey(apiKey);
  const id = uuidv4();

  await prisma.user.create({
    data: {
      id,
      name,
      email,
      apiKeyHash,
    },
  });

  console.log('User created successfully!');
  console.log('---');
  console.log(`ID: ${id}`);
  console.log(`Name: ${name}`);
  console.log(`Email: ${email}`);
  console.log(`API Key: ${apiKey}`);
  console.log('---');
  console.log('保存好 API Key，它不会再次显示！');
}

createUser('admin', 'admin@example.com');
