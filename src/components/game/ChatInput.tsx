import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import type { SessionMemberRow } from "#/domain/session"
import type { Id } from "../../../convex/_generated/dataModel"

interface ChatInputProps {
  sessionId: Id<"sessions">
  /** Decoded at the seam (issue #49): one shared row mirror, typed role. */
  members: ReadonlyArray<SessionMemberRow>
  currentUserId: string
}

export function ChatInput({
  sessionId,
  members,
  currentUserId,
}: ChatInputProps) {
  const sendMessage = useMutation(api.messages.send)
  const [text, setText] = useState("")
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null)

  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  const handleSend = async () => {
    if (!text.trim()) return
    await sendMessage({
      sessionId,
      text: text.trim(),
      ...(whisperTarget
        ? {
            visibilityType: "whisper" as const,
            whisperTargetId: whisperTarget,
          }
        : { visibilityType: "public" as const }),
    })
    setText("")
  }

  return (
    <div className="border-t border-[var(--line)] p-2 shrink-0">
      {otherMembers.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setWhisperTarget(null)}
            className={`mv-mini ${!whisperTarget ? "mv-mini-on" : ""}`}
          >
            Public
          </button>
          {otherMembers.map((m) => (
            <button
              key={m.userId}
              type="button"
              onClick={() => setWhisperTarget(m.userId)}
              className={`mv-mini ${whisperTarget === m.userId ? "mv-mini-on" : ""}`}
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
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim()}
          className="h-8 cursor-pointer"
        >
          Send
        </Button>
      </div>
    </div>
  )
}
