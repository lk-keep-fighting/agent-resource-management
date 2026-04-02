import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
    msg: '健康检查通过',
  });
}