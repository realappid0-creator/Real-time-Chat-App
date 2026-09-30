import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { count, desc, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  messagesTable as chatMessagesTable,
  conversationMembersTable,
  conversationsTable,
  db,
  usersTable,
} from "@workspace/db";
import { AdminLoginBody } from "@workspace/api-zod";
import { ensureSeedData } from "./chat";

const adminRouter: IRouter = Router();
const ADMIN_COOKIE = "nexchat_admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AdminSession = {
  username: string;
  expiresAt: number;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signingSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for admin sessions");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function createSession(username: string) {
  const session: AdminSession = {
    username,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function cookieValue(req: Request) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const cookie = cookies.find((item) => item.trim().startsWith(`${ADMIN_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(ADMIN_COOKIE.length + 1)) : null;
}

function readSession(req: Request): AdminSession | null {
  const token = cookieValue(req);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
    const configuredUsername = process.env.NEXCHAT_ADMIN_USERNAME;
    if (
      !configuredUsername ||
      typeof session.username !== "string" ||
      !safeEqual(session.username, configuredUsername) ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!readSession(req)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

function serializeAdminUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    avatarColor: user.avatarColor,
    role: user.role,
    email: user.email,
    dateOfBirth: user.dateOfBirth,
    needsOnboarding: !user.dateOfBirth,
    status: user.status,
    lastSeen: user.lastSeen?.toISOString() ?? null,
  };
}

adminRouter.post("/admin/login", async (req, res, next) => {
  try {
    const configuredUsername = process.env.NEXCHAT_ADMIN_USERNAME;
    const configuredPassword = process.env.NEXCHAT_ADMIN_PASSWORD;
    if (!configuredUsername || !configuredPassword) {
      res.status(503).json({ error: "Admin authentication is not configured" });
      return;
    }

    const input = AdminLoginBody.parse(req.body);
    if (
      !safeEqual(input.username, configuredUsername) ||
      !safeEqual(input.password, configuredPassword)
    ) {
      res.status(401).json({ error: "Invalid admin credentials" });
      return;
    }

    res.cookie(ADMIN_COOKIE, createSession(configuredUsername), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_SESSION_TTL_MS,
      path: "/api/admin",
    });
    res.json({ authenticated: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", path: "/api/admin" });
  res.json({ authenticated: false });
});

adminRouter.get("/admin/session", (req, res) => {
  res.json({ authenticated: Boolean(readSession(req)) });
});

adminRouter.use("/admin", requireAdmin);

adminRouter.get("/admin/overview", async (_req, res, next) => {
  try {
    await ensureSeedData();
    const [[{ userCount }], [{ conversationCount }], [{ messageCount }]] = await Promise.all([
      db.select({ userCount: count() }).from(usersTable),
      db.select({ conversationCount: count() }).from(conversationsTable),
      db.select({ messageCount: count() }).from(chatMessagesTable),
    ]);
    const recentRows = await db
      .select({
        message: chatMessagesTable,
        sender: usersTable,
        conversation: conversationsTable,
      })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(usersTable.id, chatMessagesTable.senderId))
      .innerJoin(
        conversationsTable,
        eq(conversationsTable.id, chatMessagesTable.conversationId),
      )
      .orderBy(desc(chatMessagesTable.sentAt))
      .limit(12);

    res.json({
      userCount: Number(userCount),
      conversationCount: Number(conversationCount),
      messageCount: Number(messageCount),
      recentMessages: recentRows.map(({ message, sender, conversation }) => ({
        id: message.id,
        body: message.body,
        sentAt: message.sentAt.toISOString(),
        senderName: sender.name,
        conversationName: conversation.name,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/users", async (_req, res, next) => {
  try {
    await ensureSeedData();
    const users = await db.select().from(usersTable).orderBy(usersTable.name);
    res.json(users.map(serializeAdminUser));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/conversations", async (_req, res, next) => {
  try {
    await ensureSeedData();
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.name);
    const payload = await Promise.all(
      conversations.map(async (conversation) => {
        const [{ memberCount }] = await db
          .select({ memberCount: count() })
          .from(conversationMembersTable)
          .where(eq(conversationMembersTable.conversationId, conversation.id));
        const [latest] = await db
          .select({ message: chatMessagesTable })
          .from(chatMessagesTable)
          .where(eq(chatMessagesTable.conversationId, conversation.id))
          .orderBy(desc(chatMessagesTable.sentAt))
          .limit(1);
        return {
          id: conversation.id,
          name: conversation.name,
          kind: conversation.kind,
          avatarColor: conversation.avatarColor,
          memberCount: Number(memberCount),
          pinned: conversation.pinned,
          muted: conversation.muted,
          lastMessageAt: latest?.message.sentAt.toISOString() ?? null,
          lastMessageBody: latest?.message.body ?? null,
        };
      }),
    );
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default adminRouter;