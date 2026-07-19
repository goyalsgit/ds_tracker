import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    phone?: string;
    apiKey?: string;
    message?: string;
  };

  const phone = body.phone?.trim();
  const apiKey = body.apiKey?.trim();
  const message = body.message?.trim();

  if (!phone || !apiKey || !message) {
    return Response.json({ error: "phone, apiKey, and message are required." }, { status: 400 });
  }

  // CallMeBot free WhatsApp API
  // Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
  const encodedMessage = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    
    if (res.ok || text.includes("Message queued")) {
      return Response.json({ success: true, message: "WhatsApp message sent!" });
    } else {
      return Response.json({ error: `CallMeBot error: ${text}` }, { status: 502 });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Failed to send: ${errorMessage}` }, { status: 500 });
  }
}
