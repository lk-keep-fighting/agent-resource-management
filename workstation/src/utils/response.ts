import type { ApiResponse } from "../types.ts";

export function ok<T>(data: T, msg = "操作成功"): ApiResponse<T> {
  return { ok: true, data, msg };
}

export function fail(msg: string, data: null = null): ApiResponse<null> {
  return { ok: false, data, msg };
}