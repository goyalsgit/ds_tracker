import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { google } from "googleapis";

/**
 * POST /api/google/auto-sync
 * Automatically sync today's revisions to Google Calendar with reminders
 */
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  // Get Google tokens
  const { data: tokenRow } = await supabaseServer
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow || !tokenRow.refresh_token) {
    return Response.json(
      { error: "Google Calendar not connected. Connect first." },
      { status: 400 }
    );
  }

  // Setup OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Get today's revisions
  const today = new Date().toISOString().split("T")[0];
  
  const { data: solves } = await supabaseServer
    .from("solves")
    .select("id, question_id")
    .eq("user_id", userId);

  const solveIds = solves?.map((s) => s.id) ?? [];
  if (solveIds.length === 0) {
    return Response.json({ created: 0, message: "No problems to sync" });
  }

  const { data: revisions } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on, status")
    .eq("due_on", today)
    .eq("status", "scheduled")
    .in("solve_id", solveIds);

  if (!revisions || revisions.length === 0) {
    return Response.json({ created: 0, message: "No revisions due today" });
  }

  // Get question details
  const questionIds = solves?.map((s) => s.question_id) ?? [];
  const { data: questions } = await supabaseServer
    .from("questions")
    .select("id, title, source_url, difficulty, tags")
    .in("id", questionIds);

  const solveMap = new Map(solves?.map((s) => [s.id, s]) ?? []);
  const questionMap = new Map(questions?.map((q) => [q.id, q]) ?? []);

  let created = 0;
  const errors: string[] = [];

  for (const revision of revisions) {
    try {
      // Check if already synced
      const { data: existing } = await supabaseServer
        .from("calendar_events")
        .select("id")
        .eq("revision_id", revision.id)
        .maybeSingle();

      if (existing) continue; // Skip if already synced

      const solve = solveMap.get(revision.solve_id);
      const question = solve ? questionMap.get(solve.question_id) : null;

      if (!question) continue;

      const title = `🔄 DSA Revision: ${question.title}`;
      const description = `
Stage ${revision.stage} Revision
Difficulty: ${question.difficulty}
Topics: ${(question.tags as string[]).join(", ")}

${question.source_url ? `Problem Link: ${question.source_url}` : ""}

Complete this revision in your DSA Tracker dashboard.
      `.trim();

      // Create event at 9 AM with 30-minute reminder
      const startTime = new Date(revision.due_on + "T09:00:00");
      const endTime = new Date(revision.due_on + "T10:00:00");

      const event = {
        summary: title,
        description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "UTC",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup" as const, minutes: 30 }, // 30 min before
            { method: "email" as const, minutes: 60 }, // 1 hour before
          ],
        },
        colorId: "9", // Blue color for DSA revisions
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      // Save to database
      await supabaseServer.from("calendar_events").insert({
        revision_id: revision.id,
        provider: "google",
        external_id: response.data.id,
        event_link: response.data.htmlLink,
      });

      created++;
    } catch (error) {
      errors.push(`Failed to sync ${revision.id}: ${error}`);
    }
  }

  return Response.json({
    created,
    total: revisions.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Created ${created} calendar events with reminders`,
  });
}
