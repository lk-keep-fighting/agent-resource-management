import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPAT } from '@/lib/auth';

/**
 * GET /api/auth/session
 *
 * 读取 `arm_pat` cookie（dashboard 登录后由 /api/auth/callback 种入），
 * 查 user_tokens 表，返回当前登录 user（或 null）。
 *
 * 返回的 user 形状由前端 useSession 决定，扁平 id/name/email/role 即可。
 */
export async function GET(_request: NextRequest) {
  const cookie = _request.cookies.get('arm_pat')?.value;
  if (!cookie || !cookie.startsWith('arm_pat_')) {
    return NextResponse.json({ user: null });
  }
  const tokenHash = hashPAT(cookie);
  const row = await prisma.userToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!row || row.revokedAt) return NextResponse.json({ user: null });
  if (row.expiresAt && row.expiresAt < new Date()) return NextResponse.json({ user: null });
  return NextResponse.json({ user: row.user });
}
