import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import {
  fetchExternalSourceById,
  updateExternalSource,
  deleteExternalSource,
} from '@/lib/knowledge-source';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const source = await fetchExternalSourceById(id);
    if (!source) {
      return errorResponse('配置不存在', 404);
    }
    return successResponse(source, '获取成功');
  } catch (err) {
    console.error('Get external source error:', err);
    return errorResponse('获取失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const existing = await fetchExternalSourceById(id);
    if (!existing) {
      return errorResponse('配置不存在', 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('请求格式错误，请检查 JSON 格式');
    }

    const {
      name,
      description,
      status,
      endpoint,
      authType,
      authHeader,
      authValue,
      idField,
      titleField,
      contentField,
      descField,
      updatedField,
      contentType,
      method,
      headers,
    } = body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return errorResponse('配置名称不能为空');
    }

    if (endpoint !== undefined && (typeof endpoint !== 'string' || endpoint.trim().length === 0)) {
      return errorResponse('API 端点地址不能为空');
    }

    const source = await updateExternalSource(id, {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(endpoint !== undefined && { endpoint: endpoint.trim() }),
      ...(authType !== undefined && { authType }),
      ...(authHeader !== undefined && { authHeader }),
      ...(authValue !== undefined && { authValue }),
      ...(idField !== undefined && { idField }),
      ...(titleField !== undefined && { titleField }),
      ...(contentField !== undefined && { contentField }),
      ...(descField !== undefined && { descField }),
      ...(updatedField !== undefined && { updatedField }),
      ...(contentType !== undefined && { contentType }),
      ...(method !== undefined && { method }),
      ...(headers !== undefined && { headers }),
    });

    return successResponse(source, '更新成功');
  } catch (err: any) {
    console.error('Update external source error:', err);
    if (err?.code === 'P2002') {
      return errorResponse('配置名称已存在');
    }
    return errorResponse(`更新失败: ${err?.message || String(err)}`);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const existing = await fetchExternalSourceById(id);
    if (!existing) {
      return errorResponse('配置不存在', 404);
    }

    const deleted = await deleteExternalSource(id);
    if (!deleted) {
      return errorResponse('删除失败');
    }

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete external source error:', err);
    return errorResponse('删除失败');
  }
}