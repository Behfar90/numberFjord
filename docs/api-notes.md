# PxWebApi v2 notes

Places where SSB's API tripped up the client or the agent, with our workaround. Raw
material for API feedback to SSB and the launch write-up. Add an entry when something
costs a retry, a workaround or a surprise; note the date and how it was observed.

## Oversized queries return 400, not 403

_Observed week 1, recorded in `__fixtures__/error-too-many-cells.json`_

A query over the cell limit returns `400 Parameter error` with title "Too many cells
selected". The documentation led us to expect `403`. A client has to match the error
title to tell "query too large" apart from other parameter errors.

**Workaround:** `src/lib/ssb/errors.ts` maps this 400 to `SsbTooLargeError`, and the
client counts cells before sending, so it rarely reaches the API.

**Feedback idea:** a distinct status or a machine-readable error `type` for the cell
limit.

## Table labels repeat the table id

_Observed week 2 (search) and week 3 (data responses)_

Labels come as `"05212: Population in densely and sparsely populated areas…"`, in both
search results and the JSON-stat dataset `label`. Every client that shows a title has
to strip the prefix.

**Workaround:** `stripTableId` in `src/lib/agent/tools.ts` removes it from search
results and data responses.

## Large dimensions come back in full

_Observed week 2, table 07459_

The region dimension of table 07459 has 994 values, and the metadata response always
includes all of them. That is far too much to give a model, and there's no way to ask
for just the values matching "Oslo". (Not yet checked whether the API has a filter for
this.)

**Workaround:** `summarizeMetadata` shows only examples for dimensions over 40 values;
the agent passes `search` terms and we filter the codes ourselves.

## Search needs several attempts for simple questions

_Observed 2026-10-14, "How has the population of Oslo changed over the last 5 years?"_

The agent called `searchTables` three times and `getTableMetadata` twice before
querying table 05212. The first results didn't lead to a table with Oslo by year.

**To investigate:** which queries it tried and what came back, so the feedback can name
concrete search terms. The week 6 evals will show how common this is.
