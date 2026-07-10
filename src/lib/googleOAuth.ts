import { google } from "googleapis";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ??
    process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string) {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function getCalendarClient(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const client = getGoogleOAuthClient();
  client.setCredentials(tokens);
  return google.calendar({ version: "v3", auth: client });
}
