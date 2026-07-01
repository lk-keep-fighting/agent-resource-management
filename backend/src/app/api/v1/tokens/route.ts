import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticate, generatePAT, hashPAT } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens — 列出当前用户的所有 PAT */
export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const rows = await prisma.userToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, expiresAt: true, lastUsedAt: true, createdAt: true,
    },
  });
  return successResponse({ tokens: rows });
}

/** POST /api/v1/tokens — 创建一个新 PAT
 *  body: { name: string, expiresAt?: ISO string }
 *  返回明文 PAT（仅此一次），调用方负责展示给用户
 */
export async function POST(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) return errorResponse('name 必填');

  const pat = generatePAT();
  const row = await prisma.userToken.create({
    data: {
      userId: user.id,
      name,
      tokenHash: hashPAT(pat),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    select: { id: true, name: true, expiresAt: true, createdAt: true },
  });

  // data 同时返回明文 token（仅此一次出现）
  return successResponse({ ...row, token: pat }, '已创建；请妥善保存，关闭后无法再次查看');
}