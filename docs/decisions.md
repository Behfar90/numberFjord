# Decisions

Design choices that aren't obvious from the code, with the trade-offs we accepted. Add
an entry when a choice rules out an alternative someone might later reach for.

## 1. Charts reference stored query results, not model-written numbers

_October 2026, week 3_

**Context.** The agent must never invent numbers, and every chart shows an SSB source
line with "CC BY 4.0". If the model wrote chart values itself, a typo or hallucination
would appear under a real source line.

**Decision.** `queryTable` stores each result on the server and returns a `resultId`
(its tool call id). `showVisual` takes that id plus a spec that only names columns
(chart type, title, x, series). The server fills in values and source from the stored
result (`src/lib/charts/build.ts`).

**Trade-off.** Results live in a `Map` inside `createPxTools`, and a new agent is
created per request, so they only last for one answer. A follow-up like "show that as a
bar chart" fails with an error telling the model to call `queryTable` again, which costs
one extra SSB request.

**Rejected: reading results from the chat history.** It would avoid the extra request,
but the history comes from the browser. A client could send a fake query result and the
server would draw made-up numbers under a real source line.

**Revisit** in week 7 (follow-ups). A server-side store keyed by conversation (e.g.
Redis from week 4) would keep the guarantee and avoid the extra query.

## 2. Sources come from query results; only text can contain transformed numbers

_October 2026, week 3_

**Context.** CC BY 4.0 requires attribution and a note when data was changed. The model
is told to cite its tables, but a prompt is not a guarantee.

**Decision.** Every chart and table carries its own source line, and every answer ends
with a sources footer built from its `queryTable` results (`answerSources`), so the
attribution is there even if the model forgets it. Charts and tables only ever show
values exactly as SSB returned them, so they need no "transformed" note. Calculations
(changes, percentages, sums) only appear in the answer text, where the system prompt
requires the model to say it calculated them and show how.

**Revisit** if a chart ever shows derived values (e.g. percentage change or an index):
add a `transformation` note to `ChartData` and show it in the source line.

## 3. SSB responses are cached until the next publish time, not for a fixed TTL

_November 2026, week 4_

**Context.** SSB allows 30 requests per minute, and one answer can take several calls
(search, metadata, query). Popular questions repeat the same requests. SSB changes data
at fixed times: new statistics at 08:00 and metadata updates at 05:00 and 11:30, Oslo
time.

**Decision.** `ssbFetch` caches each successful response in Upstash Redis, keyed by the
full request URL, until the next of those times (`secondsUntilNextRefresh` in
`src/lib/ssb/cache.ts`). The times live in `SSB_CONFIG`, so the generic client stays
source-agnostic. Errors are never cached, cached values are validated against the schema
again on read, and a failing cache counts as a miss, so Redis can never break an answer.
Without Redis credentials (tests, CI, local runs) the client runs uncached.

**Trade-off.** Search results and metadata that don't change at a refresh time still
expire, so the first request after each refresh goes to SSB. Three refreshes a day make
this cheap. A table published outside the schedule would be stale until the next refresh.

**Rejected: a fixed TTL.** A short TTL wastes requests on data that only changes at
08:00. A long one serves yesterday's figures right after a release, under a source line
that says they're current.

**Rejected: Next.js fetch caching.** It ties the client to Next.js and can't express
"until the next publish time" without the same logic, and the client is meant to run in
the eval runner too.
