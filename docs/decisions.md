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
