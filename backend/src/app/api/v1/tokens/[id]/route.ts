import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** PATCH /api/v1/tokens/:id — 改 name 或 expiresAt */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const body = await request.json().catch(() => ({}));
  const updated = await prisma.userToken.updateMany({
    where: { id: params.id, userId: user.id, revokedAt: null },
    data: {
      ...(body.name ? { name: String(body.name) } : {}),
      ...(body.expiresAt !== undefined
        ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
        : {}),
    },
  });
  if (updated.count === 0) return errorResponse('token 不存在或已撤销', 404);
  return successResponse({}, '已更新');
}

/** DELETE /api/v1/tokens/:id — 软删除（设置 revokedAt） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const updated = await prisma.userToken.updateMany({
    where: { id: params.id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (updated.count === 0) return errorResponse('token 不存在或已撤销', 404);
  return successResponse({}, '已撤销');
}