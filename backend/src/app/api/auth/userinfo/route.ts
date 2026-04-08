import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 });
  }
  return NextResponse.json({ 
    valid: true, 
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
  });
}
