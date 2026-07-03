# Video Chat Technology

What powers the video chat in the session view (today a `VideoPlaceholder` stub
in the left rail of `SessionLayout`). Research asset for the `video-chat-tech`
ticket. Scope: technology choice + fit/cost/effort. UI placement is settled
elsewhere (video = left rail; `layout-finalize`).

## Context that constrains the choice

- **Scale is tiny and fixed:** a home table, ~2–6 participants (`app-
  capabilities.md`). No large-audience / broadcast case.
- **Usage math (worst case):** 6 participants × ~4h weekly × ~4.3 sessions/mo ≈
  **6,000–7,200 participant-minutes/month**. This number decides the cost tier.
- **Infra already present:** Convex (real-time DB) + `@convex-dev/presence`
  already models **rooms + live participants** (`convex/presence.ts`, keyed by a
  room id). Better Auth for identity. TanStack Start **SSR**.
- **Build budget is the scarce resource:** the real product is the rules engine
  (character wizard, spellcasting, tick-combat, whiteboard — all still to build).
  Video should consume as little of that budget as possible.

## Options evaluated

| Option | Cost @ ~7k p-min/mo | Build effort | SSR/Convex fit | Verdict |
|---|---|---|---|---|
| **Daily** (SaaS SFU) | **$0** (free tier = 10k p-min/mo) | **Lowest** — prebuilt React SDK + iframe UI | client-only mount; room/token via Convex action | **Recommended** |
| **LiveKit Cloud** (SaaS SFU, OSS core) | ~$50/mo (free "Build" tier = 5k min, dev-only) | Low — first-class `@livekit/components-react` | same | Runner-up |
| **LiveKit self-hosted** (OSS SFU) | ~$0 vendor + server ops | High (infra ops) | same | Future, if lock-in bites |
| **Hand-rolled P2P mesh** (WebRTC + Convex signaling) | ~$0 (+ TURN) | **Highest** | Convex-native signaling (elegant) | Park as future cost-opt |
| **Twilio Video** | pay-as-you-go, pricier | Low | same | No edge here |
| **Agora** | free 10k min, then PAYG | Low | same | Scale/region-oriented; no benefit at 6 |

Notes on the ones people ask about:
- **Twilio is NOT dead.** The 2024 EOL announcement was **reversed** (Oct 2024) —
  Programmable Video remains a supported standalone product. So it's viable, but
  it offers no advantage over Daily/LiveKit at this scale.
- **P2P mesh is genuinely feasible at ≤6** and Convex would make signaling nearly
  free (exchange SDP/ICE through mutations on the existing presence room — no
  separate signaling server). But it's the classic WebRTC trap: a weekend demo,
  then weeks of `RTCPeerConnection` lifecycle, renegotiation, ICE/TURN,
  device-switching, reconnection, and mobile quirks. TURN (needed for ~10–20% of
  connections behind symmetric NAT) is cheap (Cloudflare/Metered free tiers or
  self-host coturn) but is more ops. Wrong place to spend build budget for MVP.

## Recommendation: **Daily** for the MVP

Rationale, in priority order:
1. **$0 at real usage.** A weekly home game (~7k participant-min/mo) sits **inside
   Daily's 10k-participant-min free tier**, which is production-usable — not a
   dev-only tier. LiveKit's free "Build" tier is 5k min and explicitly not for
   production, so this exact usage tips it into the $50/mo Ship plan. On cost at
   *this* scale, Daily wins.
2. **Lowest build effort.** `@daily-co/daily-react` hooks (or the prebuilt call
   iframe) replace the stub in an afternoon. Frees budget for the rules engine.
3. **Clean fit with the stack.** Video SDKs are browser-only (`getUserMedia`), so
   the video component mounts **client-only** in TanStack Start (lazy import /
   `typeof window` guard) — SSR is a non-issue since nothing video renders on the
   server. Room creation + short-lived **meeting tokens are minted in a Convex
   action** (Daily REST API), mirroring the existing server pattern
   (`runConvexEffect`) and Better Auth identity. The **video room keys off the
   same session room id the presence component already uses**, so presence and
   video share one room concept.

### When to revisit (documented triggers, not action now)
- **Usage grows past ~10k participant-min/mo** (bigger/more frequent tables) →
  compare Daily PAYG vs **LiveKit Cloud** (cheaper per-minute at higher volume).
- **Lock-in / cost aversion becomes a priority** → **LiveKit self-hosted** (OSS,
  Apache-2.0) or the **Convex-signaled P2P mesh** — the latter is the most
  on-brand (Convex-native, ~$0) but only worth it once the rules engine is done
  and video plumbing time is affordable.

## Integration sketch (for `/to-prd` → `/implement`, not this ticket)
1. `convex/video.ts` action: create/get a Daily room for `sessionId`, mint a
   per-user meeting token (via `runConvexEffect` + Daily REST). Reuse the
   presence room id.
2. Replace `VideoPlaceholder` with a client-only `<VideoStrip>` using
   `@daily-co/daily-react` (join with the token; tiles for 2–6; mute/cam toggles;
   the existing `SessionLayout` "Toggle video" control wires to join/leave).
3. Leave/cleanup on unmount; reconcile with presence disconnect.

## Sources
- [Twilio: Video Will Remain a Standalone Product](https://www.twilio.com/en-us/changelog/-twilio-video-will-remain-a-standalone-product) (EOL reversed)
- [Twilio Programmable Video End of Life Notice](https://help.twilio.com/articles/20950630029595-Programmable-Video-End-of-Life-Notice)
- [Daily — Video SDK pricing](https://www.daily.co/pricing/video-sdk/) (10k participant-min free tier)
- [LiveKit — Pricing](https://livekit.com/pricing) (Build tier: 5k WebRTC min, dev-only; Ship $50/mo)
- [Twilio Video Migration Guide 2026 — Vonage/Daily/LiveKit/Chime/self-hosted compared](https://www.forasoft.com/blog/article/twilio-video-migration-guide)
