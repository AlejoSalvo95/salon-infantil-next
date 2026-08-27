import { createClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(key: string) {
  return key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
}

function apiKeyOnlyFetch(apiKey: string): typeof fetch {
  return async (input, init) => {
    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(requestHeaders);

    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }

    // New Supabase API keys are opaque strings, not JWTs. Sending one as a
    // Bearer token makes the gateway try to validate it as a JWT.
    headers.delete("authorization");
    headers.set("apikey", apiKey);

    return fetch(input, { ...init, headers });
  };
}

function createServerClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(isNewSupabaseApiKey(key)
      ? { global: { fetch: apiKeyOnlyFetch(key) } }
      : {}),
  });
}

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Check .env.local.");
  return createServerClient(url, key);
}

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase Admin is not configured. Check .env.local.");
  return createServerClient(url, key);
}
