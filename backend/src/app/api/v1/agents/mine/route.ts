import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/agents/mine?createdBy=xxx
 *
 * 返回我创建的 Agent 列表（按反馈聚合 + 收到的反馈数）
 *
 * MVP 不鉴权：通过 ?createdBy= 显式指定（真实环境用 SSO user.id）
 */
export async function GET(request: NextRequest) {
  try {
    const createdBy = request.nextUrl.searchParams.get("createdBy");
    if (!createdBy) {
      return errorResponse("createdBy 必填（MVP 模式）", 400);
    }

    const agents = await prisma.agent.findMany({
      where: { createdBy },
      orderBy: { updatedAt: "desc" },
    });

    // 聚合每个 agent 的反馈统计
    const agentIds = agents.map((a) => a.id);
    const feedbackRows = await prisma.agentFeedback.findMany({
      where: { agentId: { in: agentIds } },
      select: { agentId: true, rating: true, isHelpful: true, createdAt: true, comment: true, externalRunId: true, tagsJson: true },
    });

    // 按 agentId 分组
    const fbByAgent = new Map<string, typeof feedbackRows>();
    for (const r of feedbackRows) {
      const list = fbByAgent.get(r.agentId) ?? [];
      list.push(r);
      fbByAgent.set(r.agentId, list);
    }

    const data = agents.map((a) => {
      const fbs = fbByAgent.get(a.id) ?? [];
      const ratings = fbs.map((f) => f.rating).filter((r): r is number => typeof r === "number");
      const avg =
        ratings.length === 0
          ? null
          : Math.round((ratings.reduce((x, y) => x + y, 0) / ratings.length) * 10) / 10;
      const lowScore = fbs.filter((f) => typeof f.rating === "number" && f.rating <= 3).length;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        avatar: a.avatar ?? undefined,
        version: a.version,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        feedbackSummary: {
          total: fbs.length,
          avgRating: avg,
          lowScore,
          helpfulCount: fbs.filter((f) => f.isHelpful === true).length,
          unhelpfulCount: fbs.filter((f) => f.isHelpful === false).length,
        },
        // 最近 5 条反馈（用于快速预览）
        recentFeedbacks: fbs.slice(0, 5).map((f) => ({
          rating: f.rating,
          isHelpful: f.isHelpful,
          comment: f.comment,
          tags: (f.tagsJson as string[] | null) ?? null,
          externalRunId: f.externalRunId,
          createdAt: f.createdAt.toISOString(),
        })),
      };
    });

    return successResponse({ total: data.length, agents: data });
  } catch (err) {
    console.error("List my agents error:", err);
    return errorResponse("获取我的资产失败");
  }
}