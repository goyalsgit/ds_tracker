import { getSupabaseServer } from "@/lib/supabaseServer";

export type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string };
};

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function getAuthUserFromRequest(request: Request): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user as AuthUser;
}
