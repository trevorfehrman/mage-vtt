import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { ScrollArea } from "#/components/ui/scroll-area"
import type { Id } from "../../../convex/_generated/dataModel"

interface ChatPanelProps {
  sessionId: Id<"sessions">
  members: Array<{ _id: string; displayName: string; userId: string; role: string }>
  currentUserId: string
}

export function ChatPanel({ sessionId, members, currentUserId }: ChatPanelProps) {
  const messages = useQuery(api.messages.list, { sessionId })
  const sendMessage = useMutation(api.messages.send)
  const [text, setText] = useState("")
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  const handleSend = async () => {
    if (!text.trim()) return
    await sendMessage({
      sessionId,
      text: text.trim(),
      ...(whisperTarget
        ? { visibilityType: "whisper" as const, whisperTargetId: whisperTarget }
        : { visibilityType: "public" as const }),
    })
    setText("")
  }

  // Show messages in chronological order (query returns desc)
  const sorted = messages ? [...messages].reverse() : []

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)]">
          Chat
        </h2>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="grid gap-1.5">
          {sorted.map((msg) => (
            <div key={msg._id}>
              {msg.visibilityType === "system" ? (
                <p className="text-muted-foreground text-center text-xs italic">
                  {msg.text}
                </p>
              ) : (
                <div
                  className={`text-sm ${
                    msg.visibilityType === "whisper"
                      ? "italic text-[var(--lagoon-deep)]"
                      : ""
                  }`}
                >
                  <span className="font-semibold">{msg.senderName}</span>
                  {msg.visibilityType === "whisper" && (
                    <span className="text-muted-foreground text-xs"> (whisper)</span>
                  )}
                  <span className="text-muted-foreground">: </span>
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-[var(--line)] p-2">
        {otherMembers.length > 0 && (
          <div className="mb-1.5 flex gap-1">
            <button
              onClick={() => setWhisperTarget(null)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                !whisperTarget
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Public
            </button>
            {otherMembers.map((m) => (
              <button
                key={m.userId}
                onClick={() => setWhisperTarget(m.userId)}
                className={`rounded px-2 py-0.5 text-[10px] ${
                  whisperTarget === m.userId
                    ? "bg-[var(--lagoon)] text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                @ {m.displayName}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <Input
            placeholder={whisperTarget ? "Whisper..." : "Message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleSend} disabled={!text.trim()} className="h-8">
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
