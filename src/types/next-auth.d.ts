import type { DefaultSession } from "next-auth";
import type { Division, Team, UserRole, UserStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      division: Division;
      team: Team;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    status: UserStatus;
    division: Division;
    team: Team;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    status: UserStatus;
    division: Division;
    team: Team;
  }
}
