import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { Authenticated, Unauthenticated, AuthLoading, useConvexAuth } from "convex/react"
import { SessionList } from "#/components/sessions/SessionList"
import { CreateSessionDialog } from "#/components/sessions/CreateSessionDialog"
import { JoinSessionDialog } from "#/components/sessions/JoinSessionDialog"

export const Route = createFileRoute("/sessions/")({
  component: SessionsPage,
})

function SessionsPage() {
  return (
    <>
      <AuthLoading>
        <Loading />
      </AuthLoading>
      <Authenticated>
        <SessionsContent />
      </Authenticated>
      <Unauthenticated>
        <AuthRedirect />
      </Unauthenticated>
    </>
  )
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
}

function AuthRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: "/" })
  }, [navigate])

  return <Loading />
}

function SessionsContent() {
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
