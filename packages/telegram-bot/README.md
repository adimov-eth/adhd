# Telegram Bot

Bridges Telegram messages to the notes-api.

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token

2. Install dependencies:
```bash
npm install
```

3. Set the bot token:
```bash
npm run secret:set:token
# paste your token when prompted
```

4. Deploy:
```bash
npm run deploy
```

5. Set the webhook (replace with your worker URL and token):
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://telegram-bot.<your-subdomain>.workers.dev/webhook"
```

## Usage

- Send `/start` to get a welcome message
- Send any text message to save it as a note
- Voice messages are logged but not processed yet (transcription coming later)

## Environment Variables

- `NOTES_API_URL` - URL of the notes-api worker (set in wrangler.toml)
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather (set via wrangler secret)
