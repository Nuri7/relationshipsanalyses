import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { Search, X, ChevronUp, ChevronDown, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ParsedMessage } from "@/lib/chatParser";

interface ChatBubbleViewerProps {
  messages: ParsedMessage[];
  participants: string[];
  chatName: string;
  /** If provided, used as the "owner" (right-side bubbles). Otherwise asks the user. */
  owner?: string;
}

const SYSTEM_INDICATORS = [
  "Messages and calls are end-to-end encrypted",
  "created group",
  "added",
  "removed",
  "changed the subject",
  "changed the group",
  "left",
  "joined using",
  "security code changed",
  "disappearing messages",
];

function isSystemMessage(msg: ParsedMessage): boolean {
  return SYSTEM_INDICATORS.some(
    (ind) =>
      msg.sender.includes(ind) || msg.content.includes(ind)
  );
}

export default function ChatBubbleViewer({
  messages,
  participants,
  chatName,
  owner: initialOwner,
}: ChatBubbleViewerProps) {
  const [owner, setOwner] = useState<string | null>(initialOwner ?? null);
  const [search, setSearch] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Show "who are you" dialog if no owner set
  const showOwnerDialog = owner === null && participants.length > 0;

  // Reset search state when owner changes
  useEffect(() => {
    setSearch("");
    setCurrentMatchIndex(0);
  }, [owner]);

  const messagesWithFormatting = useMemo(() => {
    let lastDate: Date | null = null;
    let matchCount = 0;
    matchRefs.current = [];

    const result = messages.map((msg, index) => {
      const msgDate = new Date(msg.timestamp);
      let showDateSeparator = false;
      let dateString = "";

      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        showDateSeparator = true;
        if (isToday(msgDate)) {
          dateString = "TODAY";
        } else if (isYesterday(msgDate)) {
          dateString = "YESTERDAY";
        } else {
          dateString = format(msgDate, "dd/MM/yyyy");
        }
      }
      lastDate = msgDate;

      const isOwner = msg.sender === owner;
      const system = isSystemMessage(msg);
      const showAuthor =
        !isOwner &&
        !system &&
        (index === 0 ||
          messages[index - 1].sender !== msg.sender ||
          showDateSeparator);

      const searchLower = search.toLowerCase();
      const isMatch =
        !!searchLower &&
        !!msg.content &&
        msg.content.toLowerCase().includes(searchLower);

      let localMatchIndex = -1;
      if (isMatch) {
        localMatchIndex = matchCount;
        matchCount++;
      }

      return {
        ...msg,
        msgDate,
        showDateSeparator,
        dateString,
        isOwner,
        system,
        showAuthor,
        isMatch,
        localMatchIndex,
      };
    });

    return { messages: result, totalMatches: matchCount };
  }, [messages, search, owner]);

  // Scroll to current match
  useEffect(() => {
    if (
      messagesWithFormatting.totalMatches > 0 &&
      matchRefs.current[currentMatchIndex]
    ) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentMatchIndex, messagesWithFormatting.totalMatches]);

  const handleNextMatch = useCallback(() => {
    setCurrentMatchIndex(
      (prev) => (prev + 1) % messagesWithFormatting.totalMatches
    );
  }, [messagesWithFormatting.totalMatches]);

  const handlePrevMatch = useCallback(() => {
    setCurrentMatchIndex(
      (prev) =>
        (prev - 1 + messagesWithFormatting.totalMatches) %
        messagesWithFormatting.totalMatches
    );
  }, [messagesWithFormatting.totalMatches]);

  // Keyboard shortcut: Enter = next, Shift+Enter = prev
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && search && messagesWithFormatting.totalMatches > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevMatch();
        } else {
          handleNextMatch();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search, messagesWithFormatting.totalMatches, handleNextMatch, handlePrevMatch]);

  const exportChatToHTML = () => {
    if (!chatContainerRef.current) return;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Export - ${chatName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0b141a; color: #e9edef; font-family: system-ui, -apple-system, sans-serif; padding: 16px; }
    .msg { max-width: 75%; padding: 6px 8px 18px; border-radius: 8px; margin-bottom: 4px; position: relative; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
    .msg-out { background: #005c4b; margin-left: auto; border-top-right-radius: 0; }
    .msg-in { background: #202c33; margin-right: auto; border-top-left-radius: 0; }
    .msg-sys { background: #182229; color: #8696a0; text-align: center; margin: 8px auto; max-width: 80%; font-size: 12px; padding: 4px 12px; border-radius: 8px; }
    .msg-time { position: absolute; bottom: 2px; right: 8px; font-size: 10px; color: rgba(255,255,255,0.5); }
    .msg-author { font-size: 13px; color: #00a884; font-weight: 500; margin-bottom: 2px; }
    .date-sep { text-align: center; margin: 16px 0 8px; }
    .date-sep span { background: #182229; color: #8696a0; font-size: 12px; padding: 4px 12px; border-radius: 8px; text-transform: uppercase; }
    .container { max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body><div class="container">${chatContainerRef.current.innerHTML}</div></body>
</html>`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${chatName.replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-whatsapp-border bg-whatsapp-bg" style={{ height: "70vh" }}>
      {/* Owner picker dialog */}
      <Dialog open={showOwnerDialog}>
        <DialogContent className="sm:max-w-md bg-whatsapp-panel border-whatsapp-border text-whatsapp-text">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text">Who are you?</DialogTitle>
            <DialogDescription className="text-whatsapp-muted">
              Select your name so your messages appear on the right (green bubbles).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {participants.map((p) => (
              <Button
                key={p}
                variant="outline"
                className="w-full justify-start text-left truncate border-whatsapp-border text-whatsapp-text hover:bg-whatsapp-outgoing hover:text-whatsapp-text"
                onClick={() => setOwner(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2 bg-whatsapp-panel border-b border-whatsapp-border/60 shrink-0 z-10">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-whatsapp-border flex items-center justify-center text-whatsapp-text text-sm font-semibold shrink-0">
          {chatName.substring(0, 2).toUpperCase()}
        </div>
        {/* Title */}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-whatsapp-text text-sm truncate">{chatName}</h2>
          <p className="text-[11px] text-whatsapp-muted truncate">
            {participants.join(", ")}
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs sm:max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-whatsapp-muted" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentMatchIndex(0); }}
              placeholder="Search..."
              className="pl-8 h-8 bg-whatsapp-bg border-none rounded-lg text-xs text-whatsapp-text placeholder:text-whatsapp-muted focus-visible:ring-1 focus-visible:ring-whatsapp-highlight"
            />
            {search && (
              <X
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-whatsapp-muted cursor-pointer hover:text-whatsapp-text"
                onClick={() => setSearch("")}
              />
            )}
          </div>
          {search && (
            <div className="flex items-center gap-1 text-xs text-whatsapp-muted whitespace-nowrap">
              <span>
                {messagesWithFormatting.totalMatches > 0
                  ? `${currentMatchIndex + 1}/${messagesWithFormatting.totalMatches}`
                  : "0"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-border"
                onClick={handlePrevMatch}
                disabled={messagesWithFormatting.totalMatches === 0}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-border"
                onClick={handleNextMatch}
                disabled={messagesWithFormatting.totalMatches === 0}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Export */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-border shrink-0 hidden sm:flex"
          onClick={exportChatToHTML}
          title="Export as HTML"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 w-full relative" ref={scrollAreaRef}>
        {/* Subtle wallpaper pattern */}
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M0 20h40M20 0v40\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'url(%23p)\' width=\'200\' height=\'200\'/%3E%3C/svg%3E")',
            backgroundRepeat: "repeat",
          }}
        />

        <div
          className="flex flex-col p-3 sm:p-4 w-full mx-auto max-w-3xl relative z-[1]"
          ref={chatContainerRef}
        >
          {messagesWithFormatting.messages.map((msg, idx) => (
            <div key={idx} className="flex flex-col w-full">
              {/* Date separator */}
              {msg.showDateSeparator && (
                <div className="flex justify-center my-3">
                  <span className="bg-[#182229] text-whatsapp-muted text-[11px] uppercase px-3 py-1 rounded-lg shadow-sm">
                    {msg.dateString}
                  </span>
                </div>
              )}

              {/* System message */}
              {msg.system ? (
                <div className="flex justify-center my-1.5">
                  <span className="bg-[#182229] text-whatsapp-muted text-[11px] px-3 py-1 rounded-lg text-center max-w-[85%] shadow-sm">
                    {msg.content}
                  </span>
                </div>
              ) : (
                /* Normal message bubble */
                <div
                  className={cn(
                    "flex w-full mb-0.5",
                    msg.isOwner ? "justify-end" : "justify-start",
                    msg.showAuthor && "mt-1.5"
                  )}
                  ref={(el) => {
                    if (msg.isMatch) {
                      matchRefs.current[msg.localMatchIndex] = el;
                    }
                  }}
                >
                  <div
                    className={cn(
                      "max-w-[80%] sm:max-w-[75%] rounded-lg px-2 pt-1 pb-[18px] shadow relative",
                      msg.isOwner
                        ? "bg-whatsapp-outgoing rounded-tr-none"
                        : "bg-whatsapp-incoming rounded-tl-none",
                      msg.isMatch &&
                        msg.localMatchIndex === currentMatchIndex &&
                        "ring-2 ring-whatsapp-highlight !bg-whatsapp-highlight/20"
                    )}
                  >
                    {/* Author name */}
                    {msg.showAuthor && !msg.isOwner && (
                      <span className="text-[13px] text-whatsapp-highlight font-medium block truncate pr-8">
                        {msg.sender}
                      </span>
                    )}

                    {/* Content */}
                    <div className="text-[14px] text-whatsapp-text whitespace-pre-wrap break-words leading-snug">
                      {msg.isMatch && search ? (
                        <>
                          {msg.content
                            .split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"))
                            .map((part, i) =>
                              part.toLowerCase() === search.toLowerCase() ? (
                                <span
                                  key={i}
                                  className="bg-whatsapp-highlight/40 text-white rounded px-0.5"
                                >
                                  {part}
                                </span>
                              ) : (
                                part
                              )
                            )}
                        </>
                      ) : (
                        msg.content
                      )}
                      {/* Spacer for timestamp */}
                      <span className="inline-block w-12" />
                    </div>

                    {/* Timestamp */}
                    <span className="absolute bottom-1 right-2 text-[10px] text-whatsapp-muted/80 whitespace-nowrap">
                      {format(msg.msgDate, "HH:mm")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
