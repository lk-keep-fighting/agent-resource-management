import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

interface FeedbackPayload {
  rating?: number;
  isHelpful?: boolean;
  comment?: string;
  tags?: string[];
  version?: string;
  externalRunId?: string;
  source?: string;
}

const VALID_RATINGS = new Set([1, 2, 3, 4, 5]);

/**
 * 提交 Skill 反馈
 * POST /api/v1/skills/:name/feedback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const body = (await request.json().catch(() => ({}))) as FeedbackPayload;

    // ARM 的 skill 用 name 作为对外唯一标识
    const skill = await prisma.skill.findFirst({ where: { name } });
    if (!skill) return errorResponse("Skill不存在", 404);

    if (body.rating !== undefined && body.rating !== null && !VALID_RATINGS.has(body.rating)) {
      return errorResponse("rating 必须是 1-5");
    }

    const where = body.externalRunId
      ? { externalRunId: body.externalRunId }
      : { id: "__never_match__" };

    // 找到作者（feedback_to）
    const feedbackTo = skill.publishedBy;

    const fb = await prisma.skillFeedback.upsert({
      where,
      create: {
        skillId: skill.id,
        skillVersion: body.version ?? skill.fileHash?.slice(0, 16),
        rating: body.rating ?? null,
        isHelpful: body.isHelpful ?? null,
        comment: body.comment ?? null,
        tagsJson: body.tags ? (body.tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        source: body.source ?? "agent-workstation",
        externalRunId: body.externalRunId ?? null,
        feedbackTo,
      },
      update: {
        rating: body.rating ?? undefined,
        isHelpful: body.isHelpful ?? undefined,
        comment: body.comment ?? undefined,
        tagsJson: body.tags ? (body.tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // 通知作者（v1 简化：低分才推）
    if (feedbackTo && body.rating !== undefined && body.rating !== null && body.rating <= 3) {
      await prisma.notification.create({
        data: {
          userId: feedbackTo,
          type: "skill_feedback",
          refId: skill.id,
          refName: skill.name,
          title: `Skill "${skill.name}" 收到 ${body.rating} 星评价`,
          body: body.comment ?? null,
          metaJson: { rating: body.rating, isHelpful: body.isHelpful, runId: body.externalRunId },
        },
      });
    }

    return successResponse(
      {
        id: fb.id,
        skillId: fb.skillId,
        rating: fb.rating,
        isHelpful: fb.isHelpful,
        comment: fb.comment,
        tags: (fb.tagsJson as string[] | null) ?? null,
        createdAt: fb.createdAt.toISOString(),
      },
      "反馈已记录",
    );
  } catch (err) {
    console.error("Create skill feedback error:", err);
    return errorResponse("提交反馈失败");
  }
}

/**
 * 列出 Skill 反馈
 * GET /api/v1/skills/:id/feedback
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 200);

    const skill = await prisma.skill.findFirst({ where: { name } });
    if (!skill) return errorResponse("Skill不存在", 404);

    const items = await prisma.skillFeedback.findMany({
      where: { skillId: skill.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const ratings = items.map((i) => i.rating).filter((r): r is number => typeof r === "number");
    const avg =
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    return successResponse({
      total: items.length,
      avgRating: avg,
      helpfulCount: items.filter((i) => i.isHelpful === true).length,
      unhelpfulCount: items.filter((i) => i.isHelpful === false).length,
      items: items.map((i) => ({
        id: i.id,
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
    console.error("List skill feedbacks error:", err);
    return errorResponse("获取反馈失败");
  }
}