import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import type { Id } from "../../../convex/_generated/dataModel"

interface ChatInputProps {
  sessionId: Id<"sessions">
  members: Array<{
    _id: string
    displayName: string
    userId: string
    role: string
  }>
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
          <Button
            size="xs"
            variant={!whisperTarget ? "default" : "ghost"}
            onClick={() => setWhisperTarget(null)}
            className="cursor-pointer text-xs"
          >
            Public
          </Button>
          {otherMembers.map((m) => (
            <Button
              key={m.userId}
              size="xs"
              variant={whisperTarget === m.userId ? "default" : "ghost"}
              onClick={() => setWhisperTarget(m.userId)}
              className={`cursor-pointer text-xs ${
                whisperTarget === m.userId
                  ? "bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon)]/90"
                  : ""
              }`}
            >
              @ {m.displayName}
            </Button>
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
