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

export interface ChatStats {
  firstMessage: { sender: string; content: string; timestamp: Date } | null;
  firstSparkResponseTimeMin: number | null;
  marathonDate: { date: string; count: number } | null;
  participantStats: Record<string, { 
    messageCount: number; 
    wordCount: number;
    initiatorCount: number;
    avgResponseTimeMin: number;
    doubleTexts: number;
    linkShares: number;
    apologies: number;
    swears: number;
    sweetWords: number;
    spicyWords: number;
    gratitude: number;
    lateNightMessages: number;
    ghostingCount: number;
    voiceNotes: number;
    topEmojis: { emoji: string; count: number }[];
  }>;
  timeline: { date: string; counts: Record<string, number> }[];
  hourlyHeatmap: { hour: string; counts: Record<string, number> }[];
}

export function generateChatStats(messages: ParsedMessage[]): ChatStats {
  const participantStats: Record<string, { 
    messageCount: number; 
    wordCount: number;
    initiatorCount: number;
    sumResponseTimeMs: number;
    responseCount: number;
    avgResponseTimeMin: number;
    doubleTexts: number;
    linkShares: number;
    apologies: number;
    swears: number;
    sweetWords: number;
    spicyWords: number;
    gratitude: number;
    lateNightMessages: number;
    ghostingCount: number;
    voiceNotes: number;
    emojiCounts: Record<string, number>;
    topEmojis: { emoji: string; count: number }[];
  }> = {};
  
  const timelineMap = new Map<string, Record<string, number>>();
  const hourlyMap = new Map<string, Record<string, number>>();
  
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i.toString().padStart(2, '0'), {});
  }

  let prevMsg: ParsedMessage | null = null;
  let consecutiveMessages = 0;
  
  let firstMessage: { sender: string; content: string; timestamp: Date } | null = null;
  
  // Basic regex matchers
  const urlRegex = /https?:\/\/[^\s]+/i;
  const apologyRegex = /\b(sorry|my bad|apologies|whoops|soz|mb)\b/gi;
  const swearRegex = /\b(fuck|shit|bitch|damn|ass|crap|hell|wtf|lmao|lmfao|idiot)\b/gi;
  const sweetRegex = /\b(love|miss|cute|sweet|beautiful|handsome|gorgeous|perfect|baby|babe|honey|darling)\b/gi;
  const spicyRegex = /\b(hate|mad|annoying|angry|upset|stupid|dumb|shut up|ugh)\b/gi;
  const gratitudeRegex = /\b(thanks|thank you|thx|tysm|ty|appreciate)\b/gi;
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  
  let firstSparkResponseTimeMin: number | null = null;
  const dailyCounts = new Map<string, number>();

  for (const m of messages) {
    if (!m.sender || !m.timestamp || isNaN(m.timestamp.getTime())) continue;
    
    if (!firstMessage) {
      firstMessage = { sender: m.sender, content: m.content, timestamp: m.timestamp };
    }
    
    // Stats per participant
    if (!participantStats[m.sender]) {
      participantStats[m.sender] = { 
        messageCount: 0, 
        wordCount: 0, 
        initiatorCount: 0, 
        sumResponseTimeMs: 0, 
        responseCount: 0, 
        avgResponseTimeMin: 0,
        doubleTexts: 0,
        linkShares: 0,
        apologies: 0,
        swears: 0,
        sweetWords: 0,
        spicyWords: 0,
        gratitude: 0,
        lateNightMessages: 0,
        ghostingCount: 0,
        voiceNotes: 0,
        emojiCounts: {},
        topEmojis: []
      };
    }
    
    const participant = participantStats[m.sender];
    participant.messageCount++;
    participant.wordCount += m.content.split(/\s+/).filter(Boolean).length;
    
    if (urlRegex.test(m.content)) participant.linkShares++;
    
    // Voice notes logic
    if (m.isMedia && (m.content.toLowerCase().includes("audio") || m.content.toLowerCase().includes(".opus"))) {
      participant.voiceNotes++;
    }

    // Keyword matching
    const apologyMatches = m.content.match(apologyRegex);
    if (apologyMatches) participant.apologies += apologyMatches.length;
    
    const swearMatches = m.content.match(swearRegex);
    if (swearMatches) participant.swears += swearMatches.length;
    
    const sweetMatches = m.content.match(sweetRegex);
    if (sweetMatches) participant.sweetWords += sweetMatches.length;
    
    const spicyMatches = m.content.match(spicyRegex);
    if (spicyMatches) participant.spicyWords += spicyMatches.length;
    
    const gratitudeMatches = m.content.match(gratitudeRegex);
    if (gratitudeMatches) participant.gratitude += gratitudeMatches.length;
    
    // Emoji parsing
    const emojiMatches = m.content.match(emojiRegex);
    if (emojiMatches) {
      emojiMatches.forEach(emoji => {
        participant.emojiCounts[emoji] = (participant.emojiCounts[emoji] || 0) + 1;
      });
    }

    // Late night parsing (00:00 to 04:59)
    const currentHour = m.timestamp.getHours();
    if (currentHour >= 0 && currentHour < 5) {
      participant.lateNightMessages++;
    }

    // Daily counting for Marathon Date
    const dayKey = `${m.timestamp.getFullYear()}-${String(m.timestamp.getMonth() + 1).padStart(2, '0')}-${String(m.timestamp.getDate()).padStart(2, '0')}`;
    dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);

    // Timeline grouping
    const monthKey = `${m.timestamp.getFullYear()}-${String(m.timestamp.getMonth() + 1).padStart(2, '0')}`;
    let monthData = timelineMap.get(monthKey);
    if (!monthData) {
      monthData = {};
      timelineMap.set(monthKey, monthData);
    }
    monthData[m.sender] = (monthData[m.sender] || 0) + 1;
    
    // Hourly grouping
    const hourKey = String(m.timestamp.getHours()).padStart(2, '0');
    let hourData = hourlyMap.get(hourKey)!;
    hourData[m.sender] = (hourData[m.sender] || 0) + 1;
    
    // Gap tracking & Double Texting
    if (prevMsg) {
      if (prevMsg.sender === m.sender) {
        consecutiveMessages++;
        if (consecutiveMessages === 3) { // Tripled texted or more!
          participant.doubleTexts++;
        }
      } else {
        consecutiveMessages = 1; // reset when alternate sender
      }
      
      const gapMs = m.timestamp.getTime() - prevMsg.timestamp.getTime();
      const gapHours = gapMs / (1000 * 60 * 60);
      
      // Simplified ghosting tracking > 24h gap
      if (gapHours >= 24 && prevMsg.sender !== m.sender) {
        participant.ghostingCount++;
      }
      
      // Keep track of first spark
      if (prevMsg.sender !== m.sender && firstSparkResponseTimeMin === null) {
         firstSparkResponseTimeMin = gapMs / (1000 * 60); // in minutes
      }

      if (gapHours >= 12) {
        participant.initiatorCount++;
      } else if (m.sender !== prevMsg.sender && gapMs > 0) {
        participant.sumResponseTimeMs += gapMs;
        participant.responseCount++;
      }
    } else {
      participant.initiatorCount++;
      consecutiveMessages = 1;
    }
    
    prevMsg = m;
  }
  
  for (const p of Object.keys(participantStats)) {
    const s = participantStats[p];
    if (s.responseCount > 0) {
      s.avgResponseTimeMin = (s.sumResponseTimeMs / s.responseCount) / (1000 * 60);
    }
    
    // Sort emojis and get top 3
    s.topEmojis = Object.entries(s.emojiCounts)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([date, counts]) => ({ date, counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
    
  const hourlyHeatmap = Array.from(hourlyMap.entries())
    .map(([hour, counts]) => ({ hour, counts }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // Find Marathon Date
  let marathonDate: { date: string; count: number } | null = null;
  let maxDaily = 0;
  for (const [date, count] of dailyCounts.entries()) {
    if (count > maxDaily) {
      maxDaily = count;
      marathonDate = { date, count };
    }
  }

  return { 
    firstMessage, 
    firstSparkResponseTimeMin,
    marathonDate,
    participantStats: participantStats as any, 
    timeline, 
    hourlyHeatmap 
  };
}

// Basic fallback parser if not WhatsApp
export function parseGenericChat(text: string): ParseResult {
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      const data = JSON.parse(text);
      // Rough Instagram DM format handling
      const messagesArr = Array.isArray(data) ? data : data.messages || [];
      const messages: ParsedMessage[] = [];
      const participantSet = new Set<string>();
      
      for (const msg of messagesArr) {
        if (!msg) continue;
        const sender = msg.sender_name || msg.author || msg.sender;
        const content = msg.content || msg.text || msg.body;
        const ts = msg.timestamp_ms ? new Date(msg.timestamp_ms) : (msg.timestamp ? new Date(msg.timestamp) : null);
        
        if (sender && content && ts && !isNaN(ts.getTime())) {
          messages.push({
            timestamp: ts,
            sender: String(sender),
            content: String(content),
            isMedia: !!msg.photos || !!msg.videos,
          });
          participantSet.add(String(sender));
        }
      }
      
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return {
        messages,
        participants: Array.from(participantSet),
        startDate: messages[0]?.timestamp,
        endDate: messages[messages.length - 1]?.timestamp,
      };
    } catch(e) { /* ignore JSON error and fall through */ }
  }

  // Attempt to parse WhatsApp normally
  return parseWhatsAppChat(text);
}
