// WhatsApp chat parser - supports common export formats

export interface ParsedMessage {
  timestamp: Date;
  sender: string;
  content: string;
  isMedia: boolean;
  mediaFilename?: string;
}

export interface ParseResult {
  messages: ParsedMessage[];
  participants: string[];
  startDate?: Date;
  endDate?: Date;
}

// Common WhatsApp patterns:
// [1/1/24, 10:00:00 AM] Person: message
// 1/1/24, 10:00 AM - Person: message
// 01/01/2024, 10:00 - Person: message
const WHATSAPP_PATTERNS = [
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]?\s*[-–]\s*(.+?):\s(.+)$/,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[-–]\s*(.+?):\s(.+)$/,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s+(.+?):\s(.+)$/,
];

const MEDIA_INDICATORS = [
  "<Media omitted>",
  "image omitted",
  "video omitted",
  "audio omitted",
  "sticker omitted",
  "GIF omitted",
  "document omitted",
];

export function parseWhatsAppChat(text: string): ParseResult {
  const lines = text.split("\n");
  const messages: ParsedMessage[] = [];
  const participantSet = new Set<string>();
  let currentMessage: ParsedMessage | null = null;

  for (const line of lines) {
    let matched = false;

    for (const pattern of WHATSAPP_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const [, datePart, timePart, sender, content] = match;

        // Skip system messages
        if (sender.includes("Messages and calls are end-to-end encrypted") ||
            sender.includes("created group") ||
            sender.includes("added") ||
            sender.includes("changed the subject")) {
          matched = true;
          break;
        }

        const isMedia = MEDIA_INDICATORS.some((ind) => content.includes(ind));
        const mediaMatch = content.match(/(.+\.(jpg|jpeg|png|gif|webp|mp4|opus|pdf))/i);

        const timestamp = parseTimestamp(datePart, timePart);

        currentMessage = {
          timestamp,
          sender: sender.trim(),
          content: content.trim(),
          isMedia,
          mediaFilename: mediaMatch ? mediaMatch[1] : undefined,
        };

        messages.push(currentMessage);
        participantSet.add(sender.trim());
        matched = true;
        break;
      }
    }

    // Continuation of previous message
    if (!matched && currentMessage && line.trim()) {
      currentMessage.content += "\n" + line.trim();
    }
  }

  const participants = Array.from(participantSet);
  const startDate = messages.length > 0 ? messages[0].timestamp : undefined;
  const endDate = messages.length > 0 ? messages[messages.length - 1].timestamp : undefined;

  return { messages, participants, startDate, endDate };
}

function parseTimestamp(datePart: string, timePart: string): Date {
  try {
    const dateStr = `${datePart} ${timePart}`;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Try manual parsing for DD/MM/YYYY format
    const [day, month, year] = datePart.split("/").map(Number);
    const fullYear = year < 100 ? 2000 + year : year;
    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[4];
      if (ampm) {
        if (ampm.toLowerCase() === "pm" && hours !== 12) hours += 12;
        if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;
      }
      return new Date(fullYear, month - 1, day, hours, minutes);
    }

    return new Date();
  } catch {
    return new Date();
  }
}

export function formatChatForAI(messages: ParsedMessage[]): string {
  return messages
    .map((m) => `[${m.timestamp.toLocaleString()}] ${m.sender}: ${m.isMedia ? "[media]" : m.content}`)
    .join("\n");
}
