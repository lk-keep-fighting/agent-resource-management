import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

/**
 * 批量取多个 Agent 的反馈聚合
 *
 * POST /api/v1/agents/batch-summary
 * body: { agentIds: string[] }
 * resp: { summaries: Record<agentId, { total, avgRating, helpfulCount, unhelpfulCount }> }
 *
 * 性能考虑：
 *  - 1 次 Prisma 查询（WHERE agentId IN (...)），不再 N+1
 *  - 内存里按 agentId 分组聚合
 *  - 单次请求最多 200 个 ID
 */
const MAX_IDS = 200;

interface BatchSummaryRequest {
  agentIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as BatchSummaryRequest | null;
    if (!body || !Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return errorResponse("agentIds 不能为空");
    }
    // 去重 + 限长
    const ids = Array.from(new Set(body.agentIds));
    if (ids.length > MAX_IDS) {
      return errorResponse(`agentIds 数量不能超过 ${MAX_IDS}`);
    }

    // 单次查询：所有 agent 的 feedback（只取聚合需要的字段）
    const feedbacks = await prisma.agentFeedback.findMany({
      where: { agentId: { in: ids } },
      select: { agentId: true, rating: true, isHelpful: true },
    });

    // 聚合
    type Agg = { total: number; sum: number; count: number; helpful: number; unhelpful: number };
    const aggs: Record<string, Agg> = {};
    for (const id of ids) {
      aggs[id] = { total: 0, sum: 0, count: 0, helpful: 0, unhelpful: 0 };
    }
    for (const f of feedbacks) {
      const a = aggs[f.agentId];
      if (!a) continue;
      a.total += 1;
      if (typeof f.rating === "number") {
        a.sum += f.rating;
        a.count += 1;
      }
      if (f.isHelpful === true) a.helpful += 1;
      else if (f.isHelpful === false) a.unhelpful += 1;
    }

    const summaries: Record<
      string,
      { total: number; avgRating: number | null; helpfulCount: number; unhelpfulCount: number }
    > = {};
    for (const id of ids) {
      const a = aggs[id];
      summaries[id] = {
        total: a.total,
        avgRating: a.count === 0 ? null : Math.round((a.sum / a.count) * 10) / 10,
        helpfulCount: a.helpful,
        unhelpfulCount: a.unhelpful,
      };
    }

    return successResponse({ summaries });
  } catch (err) {
    console.error("Batch agent summary error:", err);
    return errorResponse("获取失败");
  }
}
