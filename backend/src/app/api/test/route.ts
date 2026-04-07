import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    SSO_URL: process.env.SSO_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
}
