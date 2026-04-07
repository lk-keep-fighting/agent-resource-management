import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ssoUrl: process.env.SSO_URL || '',
  });
}
