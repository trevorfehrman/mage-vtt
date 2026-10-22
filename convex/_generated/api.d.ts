/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as casts from "../casts.js";
import type * as characters from "../characters.js";
import type * as combats from "../combats.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_convexLive from "../lib/convexLive.js";
import type * as lib_dev from "../lib/dev.js";
import type * as lib_effect from "../lib/effect.js";
import type * as lib_enforce from "../lib/enforce.js";
import type * as messages from "../messages.js";
import type * as presence from "../presence.js";
import type * as rolls from "../rolls.js";
import type * as scenes from "../scenes.js";
import type * as search from "../search.js";
import type * as seat from "../seat.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  casts: typeof casts;
  characters: typeof characters;
  combats: typeof combats;
  http: typeof http;
  ingest: typeof ingest;
  "lib/auth": typeof lib_auth;
  "lib/convexLive": typeof lib_convexLive;
  "lib/dev": typeof lib_dev;
  "lib/effect": typeof lib_effect;
  "lib/enforce": typeof lib_enforce;
  messages: typeof messages;
  presence: typeof presence;
  rolls: typeof rolls;
  scenes: typeof scenes;
  search: typeof search;
  seat: typeof seat;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};
