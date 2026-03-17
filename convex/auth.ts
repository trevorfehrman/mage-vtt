import { betterAuth } from "better-auth/minimal"
import { oAuthProxy } from "better-auth/plugins"
import { createClient } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import authConfig from "./auth.config"
import { components } from "./_generated/api"
import { query } from "./_generated/server"
import type { GenericCtx } from "@convex-dev/better-auth"
import type { DataModel } from "./_generated/dataModel"

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000",
    trustedOrigins: ["https://*.vercel.app", "http://localhost:3000"],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [
      convex({ authConfig }),
      oAuthProxy({
        productionURL: "https://mage-vtt.vercel.app",
      }),
    ],
  })
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
