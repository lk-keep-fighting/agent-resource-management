import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { success, error } from '../lib/formatter';

async function ensureClient(): Promise<{ client: ApiClient; serverUrl: string }> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }
  return { client: new ApiClient(config.serverUrl, config.token), serverUrl: config.serverUrl };
}

export async function listTokens(): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const headers = { Authorization: `Bearer ${client.getToken() ?? ''}` };
  const res = await fetch(`${serverUrl}/api/v1/tokens`, { headers });
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  console.table(j.data.tokens.map((t: any) => ({
    id: t.id,
    name: t.name,
    created: t.createdAt,
    lastUsed: t.lastUsedAt ?? '(never)',
    expires: t.expiresAt ?? '(never)',
  })));
  success('完成');
}

export async function createToken(name: string, expiresAt?: string): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${client.getToken() ?? ''}`,
  };
  const res = await fetch(`${serverUrl}/api/v1/tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, expiresAt }),
  });
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  success('Token 已创建（仅此一次展示，请妥善保存）：');
  console.log(j.data.token);
}

export async function revokeToken(id: string): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const headers = { Authorization: `Bearer ${client.getToken() ?? ''}` };
  const res = await fetch(`${serverUrl}/api/v1/tokens/${id}`, {
    method: 'DELETE',
    headers,
  });
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  success(`已撤销 ${id}`);
}
