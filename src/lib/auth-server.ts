import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl: process.env.CONVEX_URL!,
    convexSiteUrl: process.env.CONVEX_SITE_URL!,
  })
