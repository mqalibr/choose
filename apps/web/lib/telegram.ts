interface SendTelegramMessageInput {
  chatId: string;
  text: string;
}

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN env variable.");
  }
  return token;
}

export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<void> {
  const token = getTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
}
