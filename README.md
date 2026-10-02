# Numberfjord

**Live:** [number-fjord.vercel.app](https://number-fjord.vercel.app/)

Ask questions about Norway and get answers built from live official statistics.
Numberfjord is an AI agent that searches [Statistics Norway](https://www.ssb.no/en)'s open
API (PxWebApi v2), picks the right table, queries it, and answers with interactive charts
and tables. Every answer shows the agent's steps and cites the source table for every
number, so you can check the data yourself.

> **Status:** early development. The typed SSB API client is built and tested; the agent
> and chat UI come next.

## Planned features

- Natural-language questions answered with live SSB data – never invented numbers
- Interactive charts and tables, generated per answer
- Visible agent trace: which tables were searched, inspected and queried
- Source line on every chart: table number, link to ssb.no, CC BY 4.0, and a note when
  data was transformed
- Evaluation suite measuring table choice, numeric accuracy and refusals

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS + shadcn/ui · Vercel AI SDK + Zod ·
Recharts · Vitest · deployed on Vercel

## Getting started

Requires Node.js 22 (see `.nvmrc`) and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other commands:

```bash
pnpm lint          # ESLint
pnpm typecheck     # type check
pnpm test          # unit tests (Vitest, run once)
pnpm test:watch    # unit tests in watch mode
pnpm fixtures:ssb  # re-record SSB API fixtures (calls the live API)
```

## Data and attribution

Data comes from Statistics Norway (SSB) and is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Numberfjord is an independent
project and is not affiliated with Statistics Norway.

## License

[MIT](LICENSE)
