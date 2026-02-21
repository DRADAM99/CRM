import { redirect } from "next/navigation";

export async function GET() {
  const botLink = process.env.CHATFUEL_BOT_LINK;
  if (!botLink) {
    return new Response("Bot link not configured", { status: 503 });
  }
  redirect(botLink);
}
