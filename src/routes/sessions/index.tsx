import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react"
import { SessionList } from "#/components/sessions/SessionList"
import { CreateSessionDialog } from "#/components/sessions/CreateSessionDialog"
import { JoinSessionDialog } from "#/components/sessions/JoinSessionDialog"

export const Route = createFileRoute("/sessions/")({
  beforeLoad: ({ context }) => {
    // On preview deploys with crossDomain OTT flow, the server doesn't
    // know about the session yet on the first load. Only redirect if
    // we're sure there's no pending OTT exchange.
    if (!context.isAuthenticated && typeof window === "undefined") {
      // Server-side: skip redirect, let client handle auth
      return
    }
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
  component: SessionsPage,
})

function SessionsPage() {
  return (
    <>
      <Authenticated>
        <SessionsContent />
      </Authenticated>
      <Unauthenticated>
        <AuthRedirect />
      </Unauthenticated>
    </>
  )
}

function AuthRedirect() {
  const navigate = useNavigate()
  const { isLoading } = useConvexAuth()

  useEffect(() => {
    // Wait until Convex has finished checking auth, then redirect if
    // still not authenticated (i.e. user navigated here without signing in)
    if (!isLoading) {
      navigate({ to: "/" })
    }
  }, [isLoading, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
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
