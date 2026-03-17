import { useState } from "react"
import { useMutation } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { api } from "../../../convex/_generated/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"

export function JoinSessionDialog() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const joinSession = useMutation(api.sessions.join)
  const navigate = useNavigate()

  const handleJoin = async () => {
    if (!code.trim()) return
    setError("")
    try {
      const sessionId = await joinSession({ inviteCode: code.trim().toUpperCase() })
      setOpen(false)
      setCode("")
      navigate({ to: "/sessions/$sessionId", params: { sessionId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join session")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Join Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a session</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              placeholder="ABCD-EF23"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={handleJoin} disabled={!code.trim()}>
            Join
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
