import { getAuthUserFromRequest } from "@/lib/authServer";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    phone?: string;
    apiKey?: string;
    messages?: string[]; // support multiple messages
    message?: string; // single message fallback
  };

  const phone = body.phone?.trim();
  const apiKey = body.apiKey?.trim();
  const messages = body.messages || (body.message ? [body.message] : []);

  if (!phone || !apiKey || messages.length === 0) {
    return Response.json({ error: "phone, apiKey, and at least one message are required." }, { status: 400 });
  }

  // CallMeBot free WhatsApp API
  // Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
  const results: { success: boolean; error?: string }[] = [];

  for (const msg of messages) {
    // CallMeBot limit is ~1600 chars, truncate if needed
    const truncated = msg.length > 1500 ? msg.slice(0, 1500) + "\n...(truncated)" : msg;
    const encodedMessage = encodeURIComponent(truncated);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

    try {
      const res = await fetch(url);
      const text = await res.text();

      if (res.ok || text.includes("Message queued")) {
        results.push({ success: true });
      } else {
        results.push({ success: false, error: text });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({ success: false, error: errorMessage });
    }

    // CallMeBot rate limit: wait 2 seconds between messages
    if (messages.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  if (successCount === messages.length) {
    return Response.json({ success: true, message: `All ${successCount} messages sent!` });
  } else if (successCount > 0) {
    return Response.json({ success: true, message: `${successCount}/${messages.length} messages sent.` });
  } else {
    return Response.json({ error: `Failed to send: ${results[0]?.error || "Unknown error"}` }, { status: 502 });
  }
}
