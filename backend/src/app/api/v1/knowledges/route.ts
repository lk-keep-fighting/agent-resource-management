import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api-response';
import { fetchKnowledges } from '@/lib/knowledge';
import type { KnowledgeListResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);

    const result = await fetchKnowledges({
      keyword,
      page: pageNum,
      pageSize,
    });

    const response: KnowledgeListResponse = {
      knowledges: result.knowledges || [],
      total: result.total || 0,
      page: result.page || pageNum,
      pageSize: result.pageSize || pageSize,
    };

    return successResponse(response, '获取成功');
  } catch (err) {
    console.error('Get knowledges error:', err);
    const response: KnowledgeListResponse = {
      knowledges: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
    return successResponse(response, '知识服务不可用');
  }
}