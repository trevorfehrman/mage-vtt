import type { ConvexHttpClient } from "convex/browser"
import type OpenAI from "openai"
import { Cause, Config, Effect, Exit, Schedule, Schema } from "effect"

/**
 * The shared script runtime (issue #38): what the data-pipeline scripts have
 * in common — Config-validated env, Schema-decoded JSON inputs, a capped
 * exponential retry for network calls, one embed-and-upload path, one
 * `bunx convex run` spawn helper, and a runMain-style entry that exits
 * nonzero with a legible cause. The regex-heavy extraction/chunking scripts
 * stay imperative on purpose — Effect adds nothing to text munging.
 */

// --- Env (validated before any work starts) ---

/** The Convex deployment every uploading script talks to. */
export const convexEnv = Config.all({
  convexUrl: Config.string("VITE_CONVEX_URL"),
})

/** The embedding scripts additionally hold the OpenAI key — redacted. */
export const embeddingEnv = Config.all({
  convexUrl: Config.string("VITE_CONVEX_URL"),
  openaiKey: Config.redacted("OPENAI_API_KEY"),
})

// --- Errors ---

/** A network call that kept failing through the retry policy. */
export class ApiCallFailed extends Schema.TaggedErrorClass<ApiCallFailed>()(
  "ApiCallFailed",
  { call: Schema.String, message: Schema.String },
) {}

/** A spawned CLI command that exited nonzero. */
export class CommandFailed extends Schema.TaggedErrorClass<CommandFailed>()(
  "CommandFailed",
  { command: Schema.String, exitCode: Schema.Number },
) {}

/** The script was invoked wrong; the message is the usage line. */
export class UsageError extends Schema.TaggedErrorClass<UsageError>()(
  "UsageError",
  { message: Schema.String },
) {}

// --- Retries ---

/** Transient API failures retry (exponential, capped) instead of asking a human to re-run. */
const transientRetry = Schedule.both(
  Schedule.exponential("500 millis"),
  Schedule.recurs(4),
)

/** A network call under the retry policy, failing typed once retries are spent. */
export const tryApi = <A>(call: string, run: () => Promise<A>) =>
  Effect.tryPromise(run).pipe(
    Effect.retry(transientRetry),
    Effect.mapError(
      (error) =>
        new ApiCallFailed({
          call,
          message: error instanceof Error ? error.message : String(error),
        }),
    ),
  )

// --- Inputs ---

/** A JSON file decoded through its schema — no `any` enters the pipeline. */
export const loadJson = <S extends Schema.Top>(path: string, schema: S) =>
  Effect.tryPromise(() => Bun.file(path).json() as Promise<unknown>).pipe(
    Effect.mapError(() => new UsageError({ message: `Cannot read JSON: ${path}` })),
    Effect.flatMap((raw) => Schema.decodeUnknownEffect(schema)(raw)),
  )

/** The rule-chunk shape both embedding scripts feed to `insertRuleChunk`. */
export const RuleChunk = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  chapter: Schema.String,
  section: Schema.String,
  contentType: Schema.String,
  pageStart: Schema.Number,
  pageEnd: Schema.Number,
  charCount: Schema.Number,
  source: Schema.String,
  domain: Schema.optionalKey(Schema.String),
})
export type RuleChunk = typeof RuleChunk.Type

// --- The one embed-and-upload path ---

const EMBED_BATCH_SIZE = 50 // OpenAI embedding batch size
const BATCH_CONCURRENCY = 4

/**
 * Embed chunks batch-wise and upload each to `insertRuleChunk` — the one
 * copy of the path both embedding scripts share. Batches run with bounded
 * concurrency; each OpenAI and Convex call retries transient failures.
 * `onBatchDone` is the resumability hook: it sees each completed batch
 * (called from concurrent batches, so keep it atomic — e.g. under a
 * semaphore when it writes a progress file).
 */
export const embedAndUploadChunks = Effect.fn("Scripts.embedAndUploadChunks")(
  function* (opts: {
    openai: OpenAI
    convex: ConvexHttpClient
    insertRuleChunk: Parameters<ConvexHttpClient["mutation"]>[0]
    chunks: ReadonlyArray<RuleChunk>
    label: string
    onBatchDone?: (batch: ReadonlyArray<RuleChunk>) => Effect.Effect<void>
  }) {
    const batches: Array<ReadonlyArray<RuleChunk>> = []
    for (let i = 0; i < opts.chunks.length; i += EMBED_BATCH_SIZE) {
      batches.push(opts.chunks.slice(i, i + EMBED_BATCH_SIZE))
    }
    console.log(`${opts.label}: ${opts.chunks.length} chunks in ${batches.length} batches`)

    yield* Effect.forEach(
      batches,
      (batch, index) =>
        Effect.gen(function* () {
          const response = yield* tryApi("openai.embeddings.create", () =>
            opts.openai.embeddings.create({
              model: "text-embedding-3-small",
              input: batch.map((c) => c.text),
            }),
          )
          const embeddings = response.data.map((d) => d.embedding)

          yield* Effect.forEach(batch, (chunk, j) =>
            tryApi("convex ingest:insertRuleChunk", () =>
              opts.convex.mutation(opts.insertRuleChunk, {
                chunkId: chunk.id,
                text: chunk.text,
                embedding: embeddings[j],
                chapter: chunk.chapter,
                section: chunk.section,
                contentType: chunk.contentType,
                pageStart: chunk.pageStart,
                pageEnd: chunk.pageEnd,
                source: chunk.source,
              }),
            ),
          )

          yield* opts.onBatchDone?.(batch) ?? Effect.void
          console.log(`  Batch ${index + 1}/${batches.length}: ✓ (${batch.length} chunks)`)
        }),
      { concurrency: BATCH_CONCURRENCY },
    )
  },
)

// --- CLI wrapper spawn helper ---

/**
 * `bunx convex run <fn> <args>` — the one spawn path the dev-side CLI
 * wrappers share, failing typed instead of scattering `process.exit`.
 * Returns the command's stdout, trimmed; stderr streams through.
 */
export const convexRun = Effect.fn("Scripts.convexRun")(function* (
  fn: string,
  args: unknown,
) {
  const proc = Bun.spawnSync(
    ["bunx", "convex", "run", fn, JSON.stringify(args)],
    { stdout: "pipe", stderr: "inherit" },
  )
  if (proc.exitCode !== 0) {
    return yield* new CommandFailed({
      command: `bunx convex run ${fn}`,
      exitCode: proc.exitCode ?? 1,
    })
  }
  return proc.stdout.toString().trim()
})

// --- Entry ---

/** runMain-style entry: success exits clean, any failure exits 1 with a legible cause. */
export const runScript = (program: Effect.Effect<void, unknown>): Promise<void> =>
  Effect.runPromiseExit(program).then((exit) => {
    if (Exit.isFailure(exit)) {
      const usage = exit.cause.reasons.find(
        (r) => r._tag === "Fail" && r.error instanceof UsageError,
      )
      if (usage && usage._tag === "Fail") {
        console.error((usage.error as UsageError).message)
      } else {
        console.error(Cause.pretty(exit.cause))
      }
      process.exit(1)
    }
  })
