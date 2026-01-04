// src/worker.ts
// Telegram Bot - Cloudflare Worker
// Bridges Telegram messages to notes-api

import { Hono } from "hono";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  NOTES_API_URL: string;
  AUDIO_PROXY_URL: string;
  AUDIO_PROXY_KEY?: string;
  WEBHOOK_SECRET?: string;
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
  audio?: TelegramAudio;
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

interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface STTWebhookPayload {
  jobId: string;
  type: "stt";
  status: "completed" | "failed";
  result?: string;
  error?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "telegram-bot" });
});

// Webhook callback from audio-proxy when STT completes
app.post("/stt-callback", async (c) => {
  const payload = await c.req.json() as STTWebhookPayload & {
    metadata?: { chatId: number; userId: string }
  };

  const chatId = payload.metadata?.chatId;
  const userId = payload.metadata?.userId;

  if (!chatId || !userId) {
    console.error("STT callback missing metadata:", payload);
    return c.json({ ok: false, error: "missing metadata" }, 400);
  }

  if (payload.status === "failed") {
    console.error(`STT failed for job ${payload.jobId}:`, payload.error);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      chatId,
      "Could not transcribe voice message."
    );
    return c.json({ ok: true });
  }

  if (payload.status === "completed" && payload.result) {
    const transcript = payload.result;

    // Save transcript as note
    const noteResponse = await fetch(`${c.env.NOTES_API_URL}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        content: transcript,
        source: "voice",
      }),
    });

    if (!noteResponse.ok) {
      console.error(`Notes API error: ${noteResponse.status}`);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, "Failed to save note.");
      return c.json({ ok: true });
    }

    // Send confirmation with transcript preview
    const preview = transcript.length > 100 ? transcript.slice(0, 100) + "..." : transcript;
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, `✓ "${preview}"`);
  }

  return c.json({ ok: true });
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
      "Welcome to Memento! Send me text or voice messages and I'll save them as notes."
    );
    return c.json({ ok: true });
  }

  // Handle voice messages
  if (message.voice || message.audio) {
    const fileId = message.voice?.file_id || message.audio?.file_id;
    const duration = message.voice?.duration || message.audio?.duration || 0;

    if (!fileId) {
      return c.json({ ok: true });
    }

    console.log(`Voice/audio message received from ${userId}, duration: ${duration}s`);

    try {
      // Get file URL from Telegram
      const fileUrl = await getTelegramFileUrl(c.env.TELEGRAM_BOT_TOKEN, fileId);

      if (!fileUrl) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, "Failed to process voice message.");
        return c.json({ ok: true });
      }

      // Build webhook URL for callback
      const webhookUrl = new URL("/stt-callback", c.req.url).toString();

      // Send to audio-proxy for transcription with webhook callback
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (c.env.AUDIO_PROXY_KEY) {
        headers["X-API-Key"] = c.env.AUDIO_PROXY_KEY;
      }

      const sttResponse = await fetch(`${c.env.AUDIO_PROXY_URL}/stt`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          audioUrl: fileUrl,
          webhookUrl: webhookUrl,
          metadata: { chatId, userId },
        }),
      });

      if (!sttResponse.ok) {
        const errorText = await sttResponse.text();
        console.error(`STT API error: ${sttResponse.status} - ${errorText}`);
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, "Failed to process voice message.");
        return c.json({ ok: true });
      }

      // Return immediately - audio-proxy will callback when done
      // No confirmation message here - we'll send it in the callback

    } catch (error) {
      console.error("Error processing voice message:", error);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, "Something went wrong. Please try again.");
    }

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

      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, "✓");
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

// Get file URL from Telegram
async function getTelegramFileUrl(token: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await response.json() as { ok: boolean; result?: TelegramFile };

    if (!data.ok || !data.result?.file_path) {
      return null;
    }

    return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
  } catch (error) {
    console.error("Error getting Telegram file:", error);
    return null;
  }
}

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
