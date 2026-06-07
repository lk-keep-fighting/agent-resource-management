import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import {
  fetchExternalSources,
  createExternalSource,
} from '@/lib/knowledge-source';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = await fetchExternalSources();
    return successResponse(sources, '获取成功');
  } catch (err) {
    console.error('Get external sources error:', err);
    return errorResponse('获取失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请输入配置名称');
    }

    if (!endpoint || typeof endpoint !== 'string' || endpoint.trim().length === 0) {
      return errorResponse('请输入 API 端点地址');
    }

    const source = await createExternalSource(
      {
        name: name.trim(),
        description,
        endpoint: endpoint.trim(),
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
      },
      user.id
    );

    return successResponse(source, '创建成功');
  } catch (err: any) {
    console.error('Create external source error:', err);
    if (err?.code === 'P2002') {
      return errorResponse('配置名称已存在');
    }
    return errorResponse(`创建失败: ${err?.message || String(err)}`);
  }
}