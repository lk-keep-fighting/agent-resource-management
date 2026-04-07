import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo } from '@/lib/sso-client';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const result = await getUserInfo(token);
  return NextResponse.json(result);
}
