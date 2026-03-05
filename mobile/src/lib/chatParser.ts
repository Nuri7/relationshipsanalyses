// WhatsApp chat parser – identical logic to the web version (pure TypeScript, no browser APIs)

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

const WHATSAPP_PATTERNS = [
  /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\]\s+(.+?):\s(.+)$/,
  /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\]\s*[-–]\s*(.+?):\s(.+)$/,
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\s*[-–]\s*(.+?):\s(.+)$/,
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?)\s*[-–]\s*(.+?):\s(.+)$/,
];

const SYSTEM_MESSAGE_INDICATORS = [
  'Messages and calls are end-to-end encrypted',
  'created group', 'added', 'removed', 'changed the subject',
  'changed the group', 'changed this group', 'left', 'joined using',
  'security code changed', 'were added', 'was removed', 'disappearing messages',
];

const MEDIA_INDICATORS = [
  '<Media omitted>', '<media omitted>', 'image omitted', 'video omitted',
  'audio omitted', 'sticker omitted', 'GIF omitted', 'document omitted',
  '<attached:', '‎image omitted', '‎video omitted', '‎sticker omitted',
];

export function parseWhatsAppChat(text: string): ParseResult {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleanText = normalizedText
    .replace(/^\uFEFF/, '')
    .replace(/\u200E/g, '')
    .replace(/\u200F/g, '')
    .replace(/\u202A/g, '')
    .replace(/\u202C/g, '');

  const lines = cleanText.split('\n');
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

        if (SYSTEM_MESSAGE_INDICATORS.some(ind => trimmedSender.includes(ind) || content.includes(ind))) {
          matched = true;
          break;
        }

        const isMedia = MEDIA_INDICATORS.some(ind => content.toLowerCase().includes(ind.toLowerCase()));
        const mediaMatch = content.match(/(.+\.(jpg|jpeg|png|gif|webp|mp4|opus|pdf|mp3|aac|m4a|3gp))/i);

        currentMessage = {
          timestamp: parseTimestamp(datePart, timePart),
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

    if (!matched && currentMessage && line.trim()) {
      currentMessage.content += '\n' + line.trim();
    }
  }

  const participants = Array.from(participantSet);
  return {
    messages,
    participants,
    startDate: messages.length > 0 ? messages[0].timestamp : undefined,
    endDate: messages.length > 0 ? messages[messages.length - 1].timestamp : undefined,
  };
}

function parseTimestamp(datePart: string, timePart: string): Date {
  try {
    const normalizedDate = datePart.replace(/[.\-]/g, '/');
    const normalizedTime = timePart.replace(/\./g, ':').replace(/\s+/g, ' ').trim();

    const dateStr = `${normalizedDate} ${normalizedTime}`;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

    const parts = normalizedDate.split('/').map(Number);
    if (parts.length !== 3) return new Date();

    let [p1, p2, year] = parts;
    const fullYear = year < 100 ? 2000 + year : year;

    let day: number, month: number;
    if (p1 > 12) { day = p1; month = p2; }
    else if (p2 > 12) { day = p2; month = p1; }
    else { day = p1; month = p2; }

    const timeMatch = normalizedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[4];
      if (ampm) {
        const lower = ampm.toLowerCase().replace(/\./g, '');
        if (lower === 'pm' && hours !== 12) hours += 12;
        if (lower === 'am' && hours === 12) hours = 0;
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
    .map(m => `[${m.timestamp.toLocaleString()}] ${m.sender}: ${m.isMedia ? '[media]' : m.content}`)
    .join('\n');
}
