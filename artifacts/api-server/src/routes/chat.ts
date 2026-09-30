import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import {
  messagesTable as chatMessagesTable,
  conversationMembersTable,
  conversationsTable,
  db,
  usersTable,
} from "@workspace/db";
import {
  CreateConversationBody,
  ListUsersQueryParams,
  SendMessageBody,
  UpdateProfileBody,
} from "@workspace/api-zod";

const chatRouter: IRouter = Router();
type AuthenticatedRequest = Request & { authUserId: string };

const seedUsers = [
  {
    id: "me",
    name: "Maya Chen",
    initials: "MC",
    avatarColor: "violet",
    role: "Product designer",
    status: "online",
    lastSeen: new Date(),
  },
  {
    id: "nora",
    name: "Nora Patel",
    initials: "NP",
    avatarColor: "orange",
    role: "Research lead",
    status: "online",
    lastSeen: new Date(),
  },
  {
    id: "marcus",
    name: "Marcus Thompson",
    initials: "MT",
    avatarColor: "blue",
    role: "Engineering",
    status: "away",
    lastSeen: new Date(Date.now() - 1000 * 60 * 8),
  },
  {
    id: "jules",
    name: "Jules Williams",
    initials: "JW",
    avatarColor: "pink",
    role: "Marketing",
    status: "offline",
    lastSeen: new Date(Date.now() - 1000 * 60 * 42),
  },
  {
    id: "sprint",
    name: "Sprint planning",
    initials: "SP",
    avatarColor: "green",
    role: "Group",
    status: "online",
    lastSeen: new Date(),
  },
];

const seedConversations = [
  {
    id: "nora-thread",
    name: "Nora Patel",
    kind: "direct",
    avatarColor: "orange",
    pinned: true,
    muted: false,
  },
  {
    id: "sprint-room",
    name: "Sprint planning",
    kind: "group",
    avatarColor: "green",
    pinned: false,
    muted: false,
  },
  {
    id: "marcus-thread",
    name: "Marcus Thompson",
    kind: "direct",
    avatarColor: "blue",
    pinned: false,
    muted: true,
  },
  {
    id: "jules-thread",
    name: "Jules Williams",
    kind: "direct",
    avatarColor: "pink",
    pinned: false,
    muted: false,
  },
];

let seedPromise: Promise<void> | null = null;

async function seedDatabase() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable);
  if (existing.length > 0) return;

  await db.insert(usersTable).values(seedUsers);
  await db.insert(conversationsTable).values(seedConversations);
  await db.insert(conversationMembersTable).values([
    { conversationId: "nora-thread", userId: "me" },
    { conversationId: "nora-thread", userId: "nora" },
    { conversationId: "sprint-room", userId: "me" },
    { conversationId: "sprint-room", userId: "nora" },
    { conversationId: "sprint-room", userId: "marcus" },
    { conversationId: "sprint-room", userId: "jules" },
    { conversationId: "marcus-thread", userId: "me" },
    { conversationId: "marcus-thread", userId: "marcus" },
    { conversationId: "jules-thread", userId: "me" },
    { conversationId: "jules-thread", userId: "jules" },
  ]);
  await db.insert(chatMessagesTable).values([
    {
      id: "nora-1",
      conversationId: "nora-thread",
      senderId: "nora",
      body: "The first round of research notes is ready. I left the strongest patterns at the top.",
      sentAt: new Date(Date.now() - 1000 * 60 * 4),
      status: "read",
    },
    {
      id: "nora-2",
      conversationId: "nora-thread",
      senderId: "me",
      body: "Perfect. I’ll review them before our sync and pull together a few questions.",
      sentAt: new Date(Date.now() - 1000 * 60 * 2),
      status: "read",
    },
    {
      id: "sprint-1",
      conversationId: "sprint-room",
      senderId: "marcus",
      body: "Build is green again. I’m pushing the notification changes shortly.",
      sentAt: new Date(Date.now() - 1000 * 60 * 34),
      status: "read",
    },
    {
      id: "sprint-2",
      conversationId: "sprint-room",
      senderId: "jules",
      body: "I’ll share the launch copy in the thread when it’s ready.",
      sentAt: new Date(Date.now() - 1000 * 60 * 27),
      status: "delivered",
    },
    {
      id: "marcus-1",
      conversationId: "marcus-thread",
      senderId: "marcus",
      body: "Can you take a quick look at the new empty state?",
      sentAt: new Date(Date.now() - 1000 * 60 * 95),
      status: "delivered",
    },
    {
      id: "jules-1",
      conversationId: "jules-thread",
      senderId: "jules",
      body: "The photo options are in the shared folder now.",
      sentAt: new Date(Date.now() - 1000 * 60 * 180),
      status: "read",
    },
  ]);
}

export async function ensureSeedData() {
  if (seedPromise) return seedPromise;

  seedPromise = seedDatabase();
  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

function serializeUser(user: typeof usersTable.$inferSelect) {
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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as AuthenticatedRequest).authUserId = userId;
  next();
}

function authenticatedUserId(req: Request) {
  return (req as unknown as AuthenticatedRequest).authUserId;
}

async function ensureCurrentUser(req: Request) {
  await ensureSeedData();
  const userId = authenticatedUserId(req);
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (existing) return existing;

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email?.split("@")[0] ||
    "New member";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      name,
      initials,
      email,
      avatarColor: "violet",
      role: "Community member",
      status: "online",
      lastSeen: new Date(),
    })
    .returning();
  return created;
}

function serializeMessage(
  message: typeof chatMessagesTable.$inferSelect,
  sender: typeof usersTable.$inferSelect | undefined,
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: sender?.name ?? "Unknown",
    senderInitials: sender?.initials,
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    status: message.status,
    replyTo: null,
  };
}

async function conversationPayload(
  conversation: typeof conversationsTable.$inferSelect,
) {
  const members = await db
    .select({ user: usersTable })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, conversationMembersTable.userId))
    .where(eq(conversationMembersTable.conversationId, conversation.id));
  const users = members.map(({ user }) => user);
  const latestRows = await db
    .select({ message: chatMessagesTable, sender: usersTable })
    .from(chatMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, chatMessagesTable.senderId))
    .where(eq(chatMessagesTable.conversationId, conversation.id))
    .orderBy(desc(chatMessagesTable.sentAt))
    .limit(1);
  const lastMessage = latestRows[0]
    ? serializeMessage(latestRows[0].message, latestRows[0].sender)
    : null;

  return {
    id: conversation.id,
    name: conversation.name,
    kind: conversation.kind,
    avatarColor: conversation.avatarColor,
    participants: users.map(serializeUser),
    unreadCount: 0,
    pinned: conversation.pinned,
    muted: conversation.muted,
    lastMessage,
  };
}

chatRouter.use(requireAuth);

chatRouter.get("/profile", async (req, res, next) => {
  try {
    const user = await ensureCurrentUser(req);
    res.json(serializeUser(user));
  } catch (error) {
    next(error);
  }
});

chatRouter.put("/profile", async (req, res, next) => {
  try {
    const currentUser = await ensureCurrentUser(req);
    const input = UpdateProfileBody.parse(req.body);
    const [updated] = await db
      .update(usersTable)
      .set({
        name: input.name.trim(),
        initials: input.name
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        dateOfBirth: input.dateOfBirth,
        status: "online",
        lastSeen: new Date(),
      })
      .where(eq(usersTable.id, currentUser.id))
      .returning();
    res.json(serializeUser(updated));
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/users", async (req, res, next) => {
  try {
    await ensureSeedData();
    const parsed = ListUsersQueryParams.parse(req.query);
    const users = parsed.search
      ? await db
          .select()
          .from(usersTable)
          .where(ilike(usersTable.name, `%${parsed.search}%`))
      : await db.select().from(usersTable);
    res.json(users.map(serializeUser));
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/presence", async (_req, res, next) => {
  try {
    await ensureSeedData();
    const users = await db.select().from(usersTable);
    res.json(
      users.map((user) => ({
        userId: user.id,
        status: user.status,
        lastSeen: user.lastSeen?.toISOString() ?? null,
      })),
    );
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/conversations", async (_req, res, next) => {
  try {
    const req = _req as AuthenticatedRequest;
    await ensureCurrentUser(req);
    const conversations = await db
      .select()
      .from(conversationsTable)
      .innerJoin(
        conversationMembersTable,
        and(
          eq(conversationMembersTable.conversationId, conversationsTable.id),
          eq(conversationMembersTable.userId, req.authUserId),
        ),
      );
    const payload = await Promise.all(
      conversations.map(({ chat_conversations: conversation }) =>
        conversationPayload(conversation),
      ),
    );
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/conversations", async (req, res, next) => {
  try {
    await ensureCurrentUser(req);
    const input = CreateConversationBody.parse(req.body);
    const participantIds = Array.from(
      new Set([authenticatedUserId(req), ...input.participantIds]),
    );
    const users = await db.select().from(usersTable);
    const participants = users.filter((user) => participantIds.includes(user.id));
    const otherParticipants = participants.filter(
      (participant) => participant.id !== authenticatedUserId(req),
    );
    const kind = input.kind ?? (participantIds.length > 2 ? "group" : "direct");
    const conversation = {
      id: crypto.randomUUID(),
      name:
        input.name ||
        otherParticipants.map((participant) => participant.name).join(", "),
      kind,
      avatarColor: otherParticipants[0]?.avatarColor ?? "violet",
      pinned: false,
      muted: false,
    };
    await db.insert(conversationsTable).values(conversation);
    await db.insert(conversationMembersTable).values(
      participantIds.map((userId) => ({
        conversationId: conversation.id,
        userId,
      })),
    );
    res.status(201).json(await conversationPayload(conversation));
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    await ensureSeedData();
    const rows = await db
      .select({ message: chatMessagesTable, sender: usersTable })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(usersTable.id, chatMessagesTable.senderId))
      .where(eq(chatMessagesTable.conversationId, req.params.conversationId))
      .orderBy(chatMessagesTable.sentAt);
    res.json(rows.map(({ message, sender }) => serializeMessage(message, sender)));
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    await ensureCurrentUser(req);
    const input = SendMessageBody.parse(req.body);
    const message = {
      id: crypto.randomUUID(),
      conversationId: req.params.conversationId,
      senderId: authenticatedUserId(req),
      body: input.body.trim(),
      sentAt: new Date(),
      status: "sent",
      replyTo: null,
    };
    await db.insert(chatMessagesTable).values(message);
    const [sender] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, authenticatedUserId(req)))
      .limit(1);
    res.status(201).json(serializeMessage(message, sender));
  } catch (error) {
    next(error);
  }
});

export default chatRouter;