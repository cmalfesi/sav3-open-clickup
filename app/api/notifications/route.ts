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
      take: 200,
      include: {
        actor: { select: userSelect },
        task: { select: { id: true, name: true, listId: true } },
      },
    }),
    prisma.notification.groupBy({by:['taskId'],where:{userId:user.id,read:false},_count:{_all:true}}),
  ]);
  const visible=notifications.filter(n=>!n.task||actor().access.can("TASK",n.task.id));
  return NextResponse.json({ notifications:visible, unread:unread.filter(n=>!n.taskId||actor().access.can('TASK',n.taskId)).reduce((sum,n)=>sum+n._count._all,0) });
});
