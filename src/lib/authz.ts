import type { Division, Team, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireLeader() {
  const user = await requireUser();
  if (user.role === "MEMBER") {
    redirect("/dashboard");
  }
  return user;
}

export function canManageScope(
  user: { role: UserRole; division: Division; team: Team },
  target: { division: Division; team?: Team | null },
) {
  if (user.role === "ADMIN") {
    return true;
  }
  if (user.role !== "LEADER") {
    return false;
  }
  if (target.division === "GENERAL") {
    return true;
  }
  if (user.division !== target.division) {
    return false;
  }
  return !target.team || target.team === "GENERAL" || target.team === user.team;
}

export function canSeeAssignment(
  user: { division: Division; team: Team },
  assignment: { division: Division; team: Team },
) {
  return (
    assignment.division === user.division &&
    (assignment.team === "GENERAL" || assignment.team === user.team)
  );
}
