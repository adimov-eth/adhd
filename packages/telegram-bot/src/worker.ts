// src/worker.ts
// Telegram Bot - Cloudflare Worker
// Bridges Telegram messages to notes-api

import { Hono } from "hono";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  NOTES_API_URL: string;
}

// Telegram types (minimal)
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "telegram-bot" });
});

// Telegram webhook endpoint
app.post("/webhook", async (c) => {
  const update: TelegramUpdate = await c.req.json();

  if (!update.message) {
    return c.json({ ok: true });
  }

  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from?.id?.toString();

  if (!userId) {
    return c.json({ ok: true });
  }

  // Handle /start command
  if (message.text?.startsWith("/start")) {
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      chatId,
      "Welcome to Notes! Send me any text message and I'll save it as a note. Voice messages coming soon."
    );
    return c.json({ ok: true });
  }

  // Handle voice messages
  if (message.voice) {
    console.log(`Voice message received from ${userId}, duration: ${message.voice.duration}s`);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      chatId,
      "Voice messages will be supported soon. For now, please send text."
    );
    return c.json({ ok: true });
  }

  // Handle text messages
  if (message.text) {
    try {
      const response = await fetch(`${c.env.NOTES_API_URL}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          content: message.text,
          source: "telegram",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Notes API error: ${response.status} - ${error}`);
        await sendTelegramMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Failed to save note. Please try again."
        );
        return c.json({ ok: true });
      }

      const result = await response.json() as { id: string; created_at: number };

      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        chatId,
        "✓ Saved"
      );
    } catch (error) {
      console.error("Error saving note:", error);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Something went wrong. Please try again."
      );
    }
  }

  return c.json({ ok: true });
});

// Send message via Telegram API
async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

export default app;
