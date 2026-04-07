import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ssoUrl: process.env.SSO_URL || '',
  });
}
