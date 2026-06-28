import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { realName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, realName: true, avatarUrl: true },
    orderBy: { username: "asc" },
    take: 8,
  });

  return NextResponse.json(users);
}
