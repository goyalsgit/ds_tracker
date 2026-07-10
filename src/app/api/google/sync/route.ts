import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getCalendarClient, getGoogleOAuthClient } from "@/lib/googleOAuth";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: tokenRow, error: tokenError } = await supabaseServer
    .from("google_tokens")
    .select("access_token, refresh_token, expiry_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return Response.json({ error: "Google Calendar not connected." }, { status: 409 });
  }

  const oauthClient = getGoogleOAuthClient();
  oauthClient.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date ?? undefined,
  });

  const now = Date.now();
  if (tokenRow.expiry_date && tokenRow.expiry_date < now) {
    const refreshed = await oauthClient.getAccessToken();
    const credentials = oauthClient.credentials;
    await supabaseServer.from("google_tokens").upsert(
      {
        user_id: userId,
        access_token: credentials.access_token ?? null,
        refresh_token: credentials.refresh_token ?? tokenRow.refresh_token,
        expiry_date: credentials.expiry_date ?? tokenRow.expiry_date,
      },
      { onConflict: "user_id" }
    );
    if (refreshed?.token) {
      oauthClient.setCredentials({ access_token: refreshed.token });
    }
  }

  const calendar = getCalendarClient({
    access_token: oauthClient.credentials.access_token,
    refresh_token: oauthClient.credentials.refresh_token,
    expiry_date: oauthClient.credentials.expiry_date,
  });

  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + 7);

  // Get this user's solve IDs first so we only sync their revisions
  const { data: userSolves } = await supabaseServer
    .from("solves")
    .select("id")
    .eq("user_id", userId);

  const userSolveIds = (userSolves ?? []).map((s) => s.id);
  if (userSolveIds.length === 0) {
    return Response.json({ created: 0 });
  }

  const { data: revisions, error: revisionsError } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on")
    .gte("due_on", toDateString(today))
    .lte("due_on", toDateString(endDate))
    .eq("status", "scheduled")
    .in("solve_id", userSolveIds);

  if (revisionsError) {
    return Response.json({ error: "Failed to load revisions." }, { status: 500 });
  }

  if (!revisions || revisions.length === 0) {
    return Response.json({ created: 0 });
  }

  const revisionIds = revisions.map((rev) => rev.id);
  const { data: existingEvents } = await supabaseServer
    .from("calendar_events")
    .select("revision_id")
    .in("revision_id", revisionIds);

  const existingSet = new Set(existingEvents?.map((event) => event.revision_id));
  const revisionsToCreate = revisions.filter((rev) => !existingSet.has(rev.id));

  if (revisionsToCreate.length === 0) {
    return Response.json({ created: 0 });
  }

  const solveIds = revisionsToCreate.map((rev) => rev.solve_id);
  const { data: solves } = await supabaseServer
    .from("solves")
    .select("id, question_id")
    .in("id", solveIds);

  const questionIds = solves?.map((solve) => solve.question_id) ?? [];
  const { data: questions } = await supabaseServer
    .from("questions")
    .select("id, title, source_url")
    .in("id", questionIds);

  const solveMap = new Map(solves?.map((solve) => [solve.id, solve]) ?? []);
  const questionMap = new Map(questions?.map((q) => [q.id, q]) ?? []);

  let created = 0;

  for (const revision of revisionsToCreate) {
    const solve = solveMap.get(revision.solve_id);
    const question = solve ? questionMap.get(solve.question_id) : null;
    const title = question?.title ?? "Revision";
    const dueOn = revision.due_on;

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Revision: ${title} (Stage ${revision.stage})`,
        description: question?.source_url ?? undefined,
        start: { date: dueOn },
        end: { date: dueOn },
      },
    });

    await supabaseServer.from("calendar_events").insert({
      revision_id: revision.id,
      provider: "google",
      external_id: event.data.id ?? null,
      event_link: event.data.htmlLink ?? null,
    });

    created += 1;
  }

  return Response.json({ created });
}
