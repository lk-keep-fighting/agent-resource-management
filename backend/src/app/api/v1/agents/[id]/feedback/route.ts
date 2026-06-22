import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

interface FeedbackPayload {
  rating?: number;
  isHelpful?: boolean;
  comment?: string;
  tags?: string[];
  agentVersion?: string;
  externalRunId?: string;
  source?: string;
}

/**
 * 提交 Agent 反馈（工作站 Agent Workstation 上报）
 *
 * POST /api/v1/agents/:id/feedback
 *
 * 不需要鉴权 —— MVP 阶段工作站无用户体系，反馈直接归到 agentId 下。
 * 鉴权上线后此处再加 requireAuth。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as FeedbackPayload;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return errorResponse("Agent不存在", 404);
    }

    // 校验
    if (body.rating !== undefined && body.rating !== null) {
      if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
        return errorResponse("rating 必须是 1-5 的整数");
      }
    }
    if (body.comment && body.comment.length > 4000) {
      return errorResponse("comment 太长（最多 4000 字）");
    }

    // 同一外部 runId 只允许一条（unique），第二次提交则更新（按 v3 开闭原则可选；MVP 用 upsert 简化）
    const where = body.externalRunId
      ? { externalRunId: body.externalRunId }
      : { id: "__never_match__" };

    const feedback = await prisma.agentFeedback.upsert({
      where,
      create: {
        agentId: id,
        agentVersion: body.agentVersion ?? agent.version,
        rating: body.rating ?? null,
        isHelpful: body.isHelpful ?? null,
        comment: body.comment ?? null,
        tagsJson: body.tags ? (body.tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        source: body.source ?? "agent-workstation",
        externalRunId: body.externalRunId ?? null,
        feedbackTo: agent.createdBy,
      },
      update: {
        rating: body.rating ?? undefined,
        isHelpful: body.isHelpful ?? undefined,
        comment: body.comment ?? undefined,
        tagsJson: body.tags ? (body.tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // 通知作者：评分 ≤ 3 时推
    if (agent.createdBy && body.rating !== undefined && body.rating !== null && body.rating <= 3) {
      await prisma.notification.create({
        data: {
          userId: agent.createdBy,
          type: "agent_feedback",
          refId: id,
          refName: agent.name,
          title: `Agent "${agent.name}" 收到 ${body.rating} 星评价`,
          body: body.comment ?? null,
          metaJson: { rating: body.rating, isHelpful: body.isHelpful, runId: body.externalRunId },
        },
      });
    }

    return successResponse(
      {
        id: feedback.id,
        agentId: feedback.agentId,
        rating: feedback.rating,
        isHelpful: feedback.isHelpful,
        comment: feedback.comment,
        tags: (feedback.tagsJson as string[] | null) ?? null,
        createdAt: feedback.createdAt.toISOString(),
      },
      "反馈已记录",
    );
  } catch (err) {
    console.error("Create agent feedback error:", err);
    return errorResponse("提交反馈失败");
  }
}

/**
 * 列出 Agent 的反馈
 *
 * GET /api/v1/agents/:id/feedback?limit=50
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 200);

    const items = await prisma.agentFeedback.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const ratings = items.map((i) => i.rating).filter((r): r is number => typeof r === "number");
    const helpfulCount = items.filter((i) => i.isHelpful === true).length;
    const unhelpfulCount = items.filter((i) => i.isHelpful === false).length;
    const avgRating =
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;

    return successResponse({
      total: items.length,
      avgRating,
      helpfulCount,
      unhelpfulCount,
      items: items.map((i) => ({
        id: i.id,
        agentId: i.agentId,
        agentVersion: i.agentVersion,
        rating: i.rating,
        isHelpful: i.isHelpful,
        comment: i.comment,
        tags: (i.tagsJson as string[] | null) ?? null,
        source: i.source,
        externalRunId: i.externalRunId,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("List agent feedbacks error:", err);
    return errorResponse("获取反馈失败");
  }
}