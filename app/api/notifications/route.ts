import { actor } from "@/lib/access-context";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { userSelect } from "@/lib/queries";
import { route } from "@/lib/api-helpers";

export const GET = route(async () => {
  const user = await requireUser();
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: { select: userSelect },
        task: { select: { id: true, name: true, listId: true } },
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const visible=notifications.filter(n=>!n.task||actor().access.can("TASK",n.task.id));
  return NextResponse.json({ notifications:visible, unread:actor().access.admin?unread:visible.filter(n=>!n.read).length });
});
