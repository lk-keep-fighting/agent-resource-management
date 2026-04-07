import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo } from '@/lib/sso-client';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  const { valid, user } = await getUserInfo(token);
  if (!valid || !user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
