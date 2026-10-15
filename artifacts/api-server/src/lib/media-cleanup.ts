import { and, inArray, lte, sql } from "drizzle-orm";
import {
  messageAttachmentsTable,
  db,
  messagesTable,
  uploadIntentsTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  getSupabaseStorage,
  isSupabaseStorageConfigured,
} from "./supabase-storage";

const cleanupIntervalMs = 60 * 60 * 1000;
const cleanupBatchSize = 100;

export async function cleanupExpiredMedia() {
  const { client, bucket } = getSupabaseStorage();
  const storage = client.storage.from(bucket);
  const now = new Date();
  let deletedAttachments = 0;
  let deletedUploadIntents = 0;

  const expiredAttachments = await db
    .select()
    .from(messageAttachmentsTable)
    .where(lte(messageAttachmentsTable.expiresAt, now))
    .limit(cleanupBatchSize);

  for (
    let offset = 0;
    offset < expiredAttachments.length;
    offset += cleanupBatchSize
  ) {
    const batch = expiredAttachments.slice(offset, offset + cleanupBatchSize);
    const { error } = await storage.remove(batch.map(({ objectKey }) => objectKey));
    if (error) throw error;

    await db.transaction(async (tx) => {
      const messageIds = [...new Set(batch.map(({ messageId }) => messageId))];
      await tx
        .update(messagesTable)
        .set({ body: "Image expired" })
        .where(
          and(
            inArray(messagesTable.id, messageIds),
            sql`btrim(${messagesTable.body}) = ''`,
          ),
        );
      await tx
        .delete(messageAttachmentsTable)
        .where(inArray(messageAttachmentsTable.id, batch.map(({ id }) => id)));
    });
    deletedAttachments += batch.length;
  }

  const expiredIntents = await db
    .select()
    .from(uploadIntentsTable)
    .where(lte(uploadIntentsTable.expiresAt, now))
    .limit(cleanupBatchSize);
  for (let offset = 0; offset < expiredIntents.length; offset += cleanupBatchSize) {
    const batch = expiredIntents.slice(offset, offset + cleanupBatchSize);
    const { error } = await storage.remove(batch.map(({ objectKey }) => objectKey));
    if (error) throw error;
    await db
      .delete(uploadIntentsTable)
      .where(inArray(uploadIntentsTable.id, batch.map(({ id }) => id)));
    deletedUploadIntents += batch.length;
  }

  return { deletedAttachments, deletedUploadIntents };
}

export function startMediaCleanupScheduler() {
  if (!isSupabaseStorageConfigured()) {
    logger.warn(
      "Media cleanup is not scheduled; configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
    return;
  }

  const run = () => {
    void cleanupExpiredMedia()
      .then(({ deletedAttachments, deletedUploadIntents }) => {
        if (deletedAttachments > 0 || deletedUploadIntents > 0) {
          logger.info(
            { deletedAttachments, deletedUploadIntents },
            "Expired Supabase media cleanup completed",
          );
        }
      })
      .catch((error) => {
        logger.error({ err: error }, "Expired Supabase media cleanup failed");
      });
  };

  run();
  const timer = setInterval(run, cleanupIntervalMs);
  timer.unref();
}
