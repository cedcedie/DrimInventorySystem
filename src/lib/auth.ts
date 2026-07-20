import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { checkRateLimit } from "@/lib/rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
