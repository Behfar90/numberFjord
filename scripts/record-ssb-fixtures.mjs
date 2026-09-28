// Records real SSB PxWebApi v2 responses into src/lib/ssb/__fixtures__/ for tests.
// Run with `pnpm fixtures:ssb`. Requests run sequentially with a pause between them
// to stay well under SSB's limit of 30 requests per minute.

import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "https://data.ssb.no/api/pxwebapi/v2";
const OUT_DIR = new URL("../src/lib/ssb/__fixtures__/", import.meta.url);
const PAUSE_MS = 2500;

const fixtures = [
  {
    file: "search-population.json",
    path: "/tables",
    params: { query: "population", pageSize: "5" },
  },
  {
    file: "metadata-07459.json",
    path: "/tables/07459/metadata",
    params: {},
  },
  {
    // Oslo, both sexes, three age groups, latest two years: 12 cells.
    file: "data-07459-oslo.json",
    path: "/tables/07459/data",
    params: {
      "valueCodes[Region]": "0301",
      "valueCodes[Kjonn]": "1,2",
      "valueCodes[Alder]": "*",
      "codelist[Alder]": "agg_TredeltGrupperingB2",
      "valueCodes[ContentsCode]": "Personer1",
      "valueCodes[Tid]": "top(2)",
    },
  },
  {
    file: "error-404.json",
    path: "/tables/99999/metadata",
    params: {},
    expectError: true,
  },
  {
    file: "error-too-many-cells.json",
    path: "/tables/07459/data",
    params: {
      "valueCodes[Region]": "*",
      "valueCodes[Kjonn]": "*",
      "valueCodes[Alder]": "*",
      "valueCodes[ContentsCode]": "*",
      "valueCodes[Tid]": "*",
    },
    expectError: true,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(OUT_DIR, { recursive: true });

for (const [i, fixture] of fixtures.entries()) {
  if (i > 0) await sleep(PAUSE_MS);

  const url = new URL(BASE_URL + fixture.path);
  url.search = new URLSearchParams({ lang: "en", ...fixture.params }).toString();

  const res = await fetch(url);
  const body = await res.json();

  if (res.ok === Boolean(fixture.expectError)) {
    throw new Error(`Unexpected ${res.status} for ${fixture.file}: ${url}`);
  }

  // Error fixtures keep the HTTP status next to the problem+json body.
  const content = fixture.expectError ? { status: res.status, body } : body;
  await writeFile(
    new URL(fixture.file, OUT_DIR),
    JSON.stringify(content, null, 2) + "\n",
  );
  console.log(`${res.status} ${fixture.file}`);
}
