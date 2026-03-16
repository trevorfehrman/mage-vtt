import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { authClient } from "#/lib/auth-client"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const { isAuthenticated } = useRouteContext({ from: "/" })
  const user = useQuery(api.auth.getCurrentUser)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Mage VTT</h1>

      {isAuthenticated && user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg">
            Welcome, <span className="font-semibold">{user.name}</span>
          </p>
          {user.image && (
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="h-16 w-16 rounded-full"
            />
          )}
          <p className="text-sm text-neutral-400">{user.email}</p>
          <button
            onClick={() => authClient.signOut().then(() => window.location.reload())}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-neutral-400">Sign in to start playing</p>
          <button
            onClick={() => authClient.signIn.social({ provider: "google" })}
            className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-neutral-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </div>
      )}
    </main>
  )
}
