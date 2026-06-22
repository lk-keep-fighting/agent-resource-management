import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/db";

/**
 * POST /api/v1/notifications/:id/read
 * 标记单条已读
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const n = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return successResponse({ id: n.id, isRead: n.isRead });
  } catch (err) {
    console.error("Mark read error:", err);
    return errorResponse("标记已读失败");
  }
}

/**
 * POST /api/v1/notifications/read-all?userId=xxx
 * 全部已读
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) return errorResponse("userId 必填", 400);
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return successResponse({ markedCount: result.count });
  } catch (err) {
    console.error("Mark all read error:", err);
    return errorResponse("批量标记失败");
  }
}