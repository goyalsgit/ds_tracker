import { cookies } from "next/headers";
import { getGoogleAuthUrl } from "@/lib/googleOAuth";
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const userId = await getOrCreateUserId(authUser);
    const state = crypto.randomUUID();

    const cookieStore = await cookies();
    cookieStore.set("gc_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    cookieStore.set("gc_uid", userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    const authUrl = getGoogleAuthUrl(state);
    return Response.json({ authUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
