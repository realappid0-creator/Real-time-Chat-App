import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("chat_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  avatarColor: text("avatar_color").notNull().default("violet"),
  role: text("role").notNull().default("Member"),
  email: text("email"),
  dateOfBirth: text("date_of_birth"),
  status: text("status").notNull().default("offline"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
}).enableRLS();

export const conversationsTable = pgTable("chat_conversations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("direct"),
  avatarColor: text("avatar_color").notNull().default("violet"),
  pinned: boolean("pinned").notNull().default(false),
  muted: boolean("muted").notNull().default(false),
}).enableRLS();

export const conversationMembersTable = pgTable(
  "chat_conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  }),
).enableRLS();

export const messagesTable = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => usersTable.id),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("sent"),
  replyTo: text("reply_to"),
}).enableRLS();

export const pushSubscriptionsTable = pgTable(
  "chat_push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    endpointUnique: uniqueIndex("chat_push_subscriptions_endpoint_unique").on(
      table.endpoint,
    ),
    userIdIndex: index("chat_push_subscriptions_user_id_idx").on(table.userId),
  }),
).enableRLS();

export const insertUserSchema = createInsertSchema(usersTable);
export const insertConversationSchema = createInsertSchema(
  conversationsTable,
);
export const insertConversationMemberSchema = createInsertSchema(
  conversationMembersTable,
);
export const insertMessageSchema = createInsertSchema(messagesTable);
export const insertPushSubscriptionSchema = createInsertSchema(
  pushSubscriptionsTable,
);

export type ChatUser = typeof usersTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationMember = typeof conversationMembersTable.$inferSelect;
export type ChatMessage = typeof messagesTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertChatUser = z.infer<typeof insertUserSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertConversationMember = z.infer<
  typeof insertConversationMemberSchema
>;
export type InsertChatMessage = z.infer<typeof insertMessageSchema>;
export type InsertPushSubscription = z.infer<
  typeof insertPushSubscriptionSchema
>;