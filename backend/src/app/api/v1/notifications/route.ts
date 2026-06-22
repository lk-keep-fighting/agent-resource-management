import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/notifications?userId=xxx
 * GET /api/v1/notifications?userId=xxx&unreadOnly=true
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) return errorResponse("userId 必填", 400);
    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 200);

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return successResponse({
      unreadCount,
      total: items.length,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        refId: n.refId,
        refName: n.refName,
        title: n.title,
        body: n.body,
        meta: n.metaJson,
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("List notifications error:", err);
    return errorResponse("获取通知失败");
  }
}