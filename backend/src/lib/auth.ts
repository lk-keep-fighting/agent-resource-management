import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from './db';
import { errorResponse } from './api-response';
import type { User } from './types';

/**
 * 单一认证路径：任何带 `Authorization: Bearer arm_pat_...` 的请求
 * （或同域浏览器带 `arm_pat` cookie 的请求）都通过 PAT 哈希查表验证。
 *
 * 删掉的旧路径（v1）：
 *   - authenticateBySSO（CASDOOR cookie session）
 *   - authenticateByApiKey（sha256(apiKey) 查 apiKeyHash）
 *   - authenticateBySSOToken（JWT 跨域 Bearer）
 *
 * 注意：Prisma client 字段名是驼峰（tokenHash / revokedAt / expiresAt / lastUsedAt），
 * 即使 schema.prisma 里用 @map 映射到 snake_case 的 MySQL 列名。
 */
export async function authenticate(request: NextRequest): Promise<User | null> {
  const authz = request.headers.get('Authorization');
  const bearer = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
  const cookieToken = request.cookies.get('arm_pat')?.value;
  const token = bearer || cookieToken;
  if (!token || !token.startsWith('arm_pat_')) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await prisma.userToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // 异步更新 lastUsedAt，不阻塞主请求
  prisma.userToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ...row.user, createdAt: row.user.createdAt.toISOString() };
}

export async function requireAuth(
  request: NextRequest,
): Promise<{ user: User; request: NextRequest } | Response> {
  const user = await authenticate(request);
  if (!user) {
    return errorResponse('未授权', 401);
  }
  return { user, request };
}

/**
 * 生成一个新的 PAT。返回明文（调用方负责一次性展示给用户）。
 * 服务端只存 sha256(token)。
 */
export function generatePAT(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `arm_pat_${random}`;
}

export function hashPAT(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}