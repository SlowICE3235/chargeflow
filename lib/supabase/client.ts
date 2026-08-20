import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === "undefined") {
    // Durante o build (SSR/prerender), retorna um mock seguro
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ error: null }),
        signUp: async () => ({ error: null, data: { user: null } }),
        signInWithOAuth: async () => ({ error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }),
        insert: async () => ({ error: null }),
        update: async () => ({ eq: async () => ({ error: null }) }),
      }),
    } as any;
  }

  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
    }
    client = createBrowserClient(url, key);
  }
  return client;
}
