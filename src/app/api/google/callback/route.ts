import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/googleOAuth";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?calendar=error", request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gc_state")?.value;
  const userId = cookieStore.get("gc_uid")?.value;

  if (!expectedState || !userId || expectedState !== state) {
    return NextResponse.redirect(new URL("/?calendar=error", request.url));
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const supabaseServer = getSupabaseServer();

    await supabaseServer.from("google_tokens").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        scope: tokens.scope ?? null,
        token_type: tokens.token_type ?? null,
        expiry_date: tokens.expiry_date ?? null,
      },
      { onConflict: "user_id" }
    );

    cookieStore.delete("gc_state");
    cookieStore.delete("gc_uid");

    return NextResponse.redirect(new URL("/?calendar=connected", request.url));
  } catch (error) {
    return NextResponse.redirect(new URL("/?calendar=error", request.url));
  }
}
