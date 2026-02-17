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

// Broad set of WhatsApp patterns covering many locale variants:
// [DD/MM/YYYY, HH:MM:SS] Sender: msg
// [DD/MM/YY, HH:MM:SS AM] Sender: msg
// DD/MM/YYYY, HH:MM - Sender: msg
// DD-MM-YYYY HH:MM - Sender: msg
// DD.MM.YYYY, HH:MM - Sender: msg
// [DD.MM.YY, HH:MM:SS] Sender: msg
const WHATSAPP_PATTERNS = [
  // [date, time] Sender: message (with brackets)
  /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\]\s+(.+?):\s(.+)$/,
  // [date, time] - Sender: message
  /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\]\s*[-–]\s*(.+?):\s(.+)$/,
  // date, time - Sender: message (no brackets)
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\s*[-–]\s*(.+?):\s(.+)$/,
  // date time - Sender: message (no comma between date and time)
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\s*[-–]\s*(.+?):\s(.+)$/,
];

const SYSTEM_MESSAGE_INDICATORS = [
  "Messages and calls are end-to-end encrypted",
  "created group",
  "added",
  "removed",
  "changed the subject",
  "changed the group",
  "changed this group",
  "left",
  "joined using",
  "security code changed",
  "were added",
  "was removed",
  "disappearing messages",
];

const MEDIA_INDICATORS = [
  "<Media omitted>",
  "<media omitted>",
  "image omitted",
  "video omitted",
  "audio omitted",
  "sticker omitted",
  "GIF omitted",
  "document omitted",
  "<attached:",
  "‎image omitted",
  "‎video omitted",
  "‎sticker omitted",
];

export function parseWhatsAppChat(text: string): ParseResult {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Remove BOM and zero-width characters
  const cleanText = normalizedText.replace(/^\uFEFF/, "").replace(/\u200E/g, "").replace(/\u200F/g, "").replace(/\u202A/g, "").replace(/\u202C/g, "");
  
  const lines = cleanText.split("\n");
  const messages: ParsedMessage[] = [];
  const participantSet = new Set<string>();
  let currentMessage: ParsedMessage | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    
    let matched = false;

    for (const pattern of WHATSAPP_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const [, datePart, timePart, sender, content] = match;
        const trimmedSender = sender.trim();

        // Skip system messages
        if (SYSTEM_MESSAGE_INDICATORS.some((ind) => trimmedSender.includes(ind) || content.includes(ind))) {
          matched = true;
          break;
        }

        const isMedia = MEDIA_INDICATORS.some((ind) => content.toLowerCase().includes(ind.toLowerCase()));
        const mediaMatch = content.match(/(.+\.(jpg|jpeg|png|gif|webp|mp4|opus|pdf|mp3|aac|m4a|3gp))/i);

        const timestamp = parseTimestamp(datePart, timePart);

        currentMessage = {
          timestamp,
          sender: trimmedSender,
          content: content.trim(),
          isMedia,
          mediaFilename: mediaMatch ? mediaMatch[1] : undefined,
        };

        messages.push(currentMessage);
        participantSet.add(trimmedSender);
        matched = true;
        break;
      }
    }

    // Continuation of previous message (multi-line messages)
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
    // Normalize separators: replace dots and dashes with slashes in date
    const normalizedDate = datePart.replace(/[.\-]/g, "/");
    // Normalize time: replace dots with colons
    const normalizedTime = timePart.replace(/\./g, ":").replace(/\s+/g, " ").trim();

    // Try native Date parsing first
    const dateStr = `${normalizedDate} ${normalizedTime}`;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

    // Manual parsing for DD/MM/YYYY or DD/MM/YY format
    const parts = normalizedDate.split("/").map(Number);
    if (parts.length !== 3) return new Date();
    
    let [p1, p2, year] = parts;
    const fullYear = year < 100 ? 2000 + year : year;
    
    // Determine if DD/MM or MM/DD by checking if p1 > 12 (must be day)
    let day: number, month: number;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      day = p2;
      month = p1;
    } else {
      // Ambiguous — assume DD/MM (most common in WhatsApp exports)
      day = p1;
      month = p2;
    }

    const timeMatch = normalizedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[4];
      if (ampm) {
        const lower = ampm.toLowerCase().replace(/\./g, "");
        if (lower === "pm" && hours !== 12) hours += 12;
        if (lower === "am" && hours === 12) hours = 0;
      }
      return new Date(fullYear, month - 1, day, hours, minutes);
    }

    return new Date(fullYear, month - 1, day);
  } catch {
    return new Date();
  }
}

export function formatChatForAI(messages: ParsedMessage[]): string {
  return messages
    .map((m) => `[${m.timestamp.toLocaleString()}] ${m.sender}: ${m.isMedia ? "[media]" : m.content}`)
    .join("\n");
}
