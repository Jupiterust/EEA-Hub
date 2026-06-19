import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Division, Team, UserRole, UserStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  identifier: z.string().min(2),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Password",
      credentials: {
        identifier: { label: "账号或邮箱", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const { identifier, password } = parsed.data;
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ username: identifier }, { email: identifier }],
          },
        });

        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        const ok = await compare(password, user.passwordHash);
        if (!ok) {
          return null;
        }

        return {
          id: user.id,
          name: user.realName,
          email: user.email,
          role: user.role,
          status: user.status,
          division: user.division,
          team: user.team,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.status = user.status;
        token.division = user.division;
        token.team = user.team;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
        session.user.division = token.division as Division;
        session.user.team = token.team as Team;
      }
      return session;
    },
  },
});
