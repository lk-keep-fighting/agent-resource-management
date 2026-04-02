import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

export function success<T>(data: T, msg = '操作成功'): ApiResponse<T> {
  return {
    ok: true,
    data,
    msg,
  };
}

export function error(msg: string): ApiResponse<null> {
  return {
    ok: false,
    data: null,
    msg,
  };
}

export function successResponse<T>(data: T, msg = '操作成功') {
  return NextResponse.json(success(data, msg));
}

export function errorResponse(msg: string, status = 400) {
  return NextResponse.json(error(msg), { status });
}