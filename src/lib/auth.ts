import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { checkRateLimit } from "@/lib/rateLimit";

const ROLE_REFRESH_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.status = "ACTIVE";
        token.roleCheckedAt = Date.now();
        return token;
      }

      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      if (token.sub && Date.now() - checkedAt > ROLE_REFRESH_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, username: true, status: true, name: true },
        });

        token.roleCheckedAt = Date.now();

        if (!dbUser || dbUser.status !== "ACTIVE") {
          token.error = "Inactive";
          token.status = "INACTIVE";
          return token;
        }

        token.error = undefined;
        token.status = dbUser.status;
        token.role = dbUser.role;
        token.username = dbUser.username;
        if (dbUser.name) token.name = dbUser.name;
      }

      return token;
    },
    session: ({ session, token }) => {
      if (token.error === "Inactive") {
        // Strip user so middleware / layout treat the session as logged out.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        // NextAuth v5 beta's Credentials authorize() here only receives
        // `credentials` (no `req`), so we key per-account rather than per-IP.
        const rl = checkRateLimit(`login:${username}`, { limit: 5, windowMs: 60_000 });
        if (!rl.allowed) {
          throw new Error("Too many login attempts. Try again in a minute.");
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
});
