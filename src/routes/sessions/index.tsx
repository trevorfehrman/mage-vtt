import { createFileRoute, redirect } from "@tanstack/react-router"
import { SessionList } from "#/components/sessions/SessionList"
import { CreateSessionDialog } from "#/components/sessions/CreateSessionDialog"
import { JoinSessionDialog } from "#/components/sessions/JoinSessionDialog"

export const Route = createFileRoute("/sessions/")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
  component: SessionsPage,
})

function SessionsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="display-title text-2xl font-bold">Sessions</h1>
        <div className="flex gap-2">
          <JoinSessionDialog />
          <CreateSessionDialog />
        </div>
      </div>
      <SessionList />
    </main>
  )
}
