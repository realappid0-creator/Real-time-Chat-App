import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, ilike, inArray, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { clerkClient, getAuth } from "@clerk/express";
import webPush, { type PushSubscription as WebPushSubscription } from "web-push";
import { z } from "zod/v4";
import {
  messagesTable as chatMessagesTable,
  conversationMembersTable,
  conversationsTable,
  db,
  pushSubscriptionsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateConversationBody,
  ListUsersQueryParams,
  SendMessageBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const chatRouter: IRouter = Router();
const creatorMembership = alias(conversationMembersTable, "creator_membership");
const recipientMembership = alias(conversationMembersTable, "recipient_membership");
type AuthenticatedRequest = Request & { authUserId: string };
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);
const PushSubscriptionInput = z.object({
  endpoint: z.string().url().max(2048).refine((endpoint) => {
    const { hostname, protocol } = new URL(endpoint);
    return (
      protocol === "https:" &&
      (hostname === "fcm.googleapis.com" ||
        hostname.endsWith(".push.services.mozilla.com") ||
        hostname === "web.push.apple.com" ||
        hostname.endsWith(".notify.windows.com"))
    );
  }, "Unsupported push service endpoint."),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});
const PushSubscriptionEndpointInput = z.object({
  endpoint: PushSubscriptionInput.shape.endpoint,
});

if (vapidSubject && vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  logger.warn(
    "Web Push is not configured; set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT",
  );
}

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
  if (process.env.NODE_ENV === "production") return;

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

async function sendMessagePushNotifications(
  conversationId: string,
  senderId: string,
  senderName: string,
) {
  if (!pushConfigured) {
    return;
  }

  try {
    const recipients = await db
      .select({ userId: conversationMembersTable.userId })
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          ne(conversationMembersTable.userId, senderId),
        ),
      );
    const recipientIds = recipients.map(({ userId }) => userId);
    if (recipientIds.length === 0) return;

    const subscriptions = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.userId, recipientIds));
    const results = await Promise.allSettled(
      subscriptions.map((subscription) => {
        const pushSubscription: WebPushSubscription = {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        };
        return webPush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: senderName,
            body: "Sent you a message",
            url: "./",
          }),
        );
      }),
    );

    const expiredEndpoints: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") continue;
      const statusCode =
        typeof result.reason === "object" &&
        result.reason !== null &&
        "statusCode" in result.reason
          ? result.reason.statusCode
          : undefined;
      logger.warn(
        { statusCode },
        "Failed to send a Web Push message notification",
      );
      if (statusCode === 404 || statusCode === 410) {
        const failedIndex = results.indexOf(result);
        const expired = subscriptions[failedIndex];
        if (expired) expiredEndpoints.push(expired.endpoint);
      }
    }

    if (expiredEndpoints.length > 0) {
      await db
        .delete(pushSubscriptionsTable)
        .where(inArray(pushSubscriptionsTable.endpoint, expiredEndpoints));
    }
  } catch (error) {
    logger.error({ err: error }, "Could not deliver message push notifications");
  }
}

async function conversationPayload(
  conversation: typeof conversationsTable.$inferSelect,
  viewerId: string,
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
  const otherParticipants = users.filter((user) => user.id !== viewerId);

  return {
    id: conversation.id,
    name:
      conversation.kind === "direct"
        ? otherParticipants[0]?.name ?? conversation.name
        : conversation.name,
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

chatRouter.get("/push/vapid-public-key", (_req, res) => {
  if (!pushConfigured || !vapidPublicKey) {
    res.status(503).json({ error: "Web Push is not configured on the server." });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
});

chatRouter.put("/push/subscriptions", async (req, res, next) => {
  try {
    const user = await ensureCurrentUser(req);
    if (!pushConfigured) {
      res.status(503).json({ error: "Web Push is not configured on the server." });
      return;
    }
    const input = PushSubscriptionInput.parse(req.body);
    await db
      .insert(pushSubscriptionsTable)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId: user.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

chatRouter.delete("/push/subscriptions", async (req, res, next) => {
  try {
    const user = await ensureCurrentUser(req);
    const input = PushSubscriptionEndpointInput.parse(req.body);
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, user.id),
          eq(pushSubscriptionsTable.endpoint, input.endpoint),
        ),
      );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/users", async (req, res, next) => {
  try {
    const currentUser = await ensureCurrentUser(req);
    await ensureSeedData();
    const parsed = ListUsersQueryParams.parse(req.query);
    const conditions = [
      ne(usersTable.id, currentUser.id),
      ...(parsed.search ? [ilike(usersTable.name, `%${parsed.search}%`)] : []),
      ...(process.env.NODE_ENV === "production"
        ? [notInArray(usersTable.id, seedUsers.map((user) => user.id))]
        : []),
    ];
    const users = await db
      .select()
      .from(usersTable)
      .where(and(...conditions));
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
        conversationPayload(conversation, req.authUserId),
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
    const creatorId = authenticatedUserId(req);
    const [recipientId] = input.participantIds;
    if (
      input.kind === "group" ||
      input.participantIds.length !== 1 ||
      !recipientId ||
      recipientId === creatorId
    ) {
      res.status(400).json({ error: "Choose exactly one other user to start a direct conversation." });
      return;
    }

    const [recipient] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, recipientId))
      .limit(1);
    if (!recipient) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const pairKey = [creatorId, recipientId].sort().join(":");
    const { conversation, created } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`);
      const [existing] = await tx
        .select({ conversation: conversationsTable })
        .from(conversationsTable)
        .innerJoin(
          creatorMembership,
          and(
            eq(creatorMembership.conversationId, conversationsTable.id),
            eq(creatorMembership.userId, creatorId),
          ),
        )
        .innerJoin(
          recipientMembership,
          and(
            eq(recipientMembership.conversationId, conversationsTable.id),
            eq(recipientMembership.userId, recipientId),
          ),
        )
        .where(eq(conversationsTable.kind, "direct"))
        .limit(1);
      if (existing) return { conversation: existing.conversation, created: false };

      const newConversation = {
        id: crypto.randomUUID(),
        name: recipient.name,
        kind: "direct",
        avatarColor: recipient.avatarColor,
        pinned: false,
        muted: false,
      };
      await tx.insert(conversationsTable).values(newConversation);
      await tx.insert(conversationMembersTable).values([
        { conversationId: newConversation.id, userId: creatorId },
        { conversationId: newConversation.id, userId: recipientId },
      ]);
      return { conversation: newConversation, created: true };
    });

    res
      .status(created ? 201 : 200)
      .json(await conversationPayload(conversation, creatorId));
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const userId = authenticatedUserId(req);
    const [membership] = await db
      .select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, req.params.conversationId),
          eq(conversationMembersTable.userId, userId),
        ),
      )
      .limit(1);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
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
    const userId = authenticatedUserId(req);
    const [membership] = await db
      .select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, req.params.conversationId),
          eq(conversationMembersTable.userId, userId),
        ),
      )
      .limit(1);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    const input = SendMessageBody.parse(req.body);
    const message = {
      id: crypto.randomUUID(),
      conversationId: req.params.conversationId,
      senderId: userId,
      body: input.body.trim(),
      sentAt: new Date(),
      status: "sent",
      replyTo: null,
    };
    await db.insert(chatMessagesTable).values(message);
    const [sender] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    await sendMessagePushNotifications(
      req.params.conversationId,
      userId,
      sender?.name ?? "Someone",
    );
    res.status(201).json(serializeMessage(message, sender));
  } catch (error) {
    next(error);
  }
});

export default chatRouter;