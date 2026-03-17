import { createAuthClient } from "better-auth/react"
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins"

// Only include crossDomainClient when there's an OTT to exchange.
// On production, normal cookies work and crossDomainClient breaks them
// by setting credentials: "omit" on all requests.
const plugins = typeof window !== "undefined" && window.location.search.includes("ott=")
  ? [convexClient(), crossDomainClient()]
  : [convexClient()]

export const authClient = createAuthClient({ plugins })
