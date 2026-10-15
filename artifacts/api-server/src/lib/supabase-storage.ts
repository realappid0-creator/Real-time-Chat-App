import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | undefined;

export class SupabaseStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseStorageConfigurationError";
  }
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SupabaseStorageConfigurationError(
      `${name} must be configured to use Supabase Storage attachments.`,
    );
  }
  return value;
}

export function isSupabaseStorageConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getSupabaseStorage() {
  const url = requiredEnvironmentValue("SUPABASE_URL");
  const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "chat-media";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseStorageConfigurationError(
      "SUPABASE_URL must be a valid URL.",
    );
  }
  if (
    !["https:", "http:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new SupabaseStorageConfigurationError(
      "SUPABASE_URL must be an HTTP(S) URL without embedded credentials.",
    );
  }

  client ??= createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { client, bucket };
}
