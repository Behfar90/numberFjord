import type { Source } from "@/lib/charts/schema";

import { staleLabel } from "./source-line-text";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

const linkClass = "underline underline-offset-2";

export function SourceLine({ source }: { source: Source }) {
  return (
    <p>
      {source.name},{" "}
      <a
        href={source.tableUrl}
        target="_blank"
        rel="noreferrer"
        className={linkClass}
      >
        table {source.tableId}
      </a>
      : {source.tableTitle} · updated {source.updated} ·{" "}
      <a
        href={LICENSE_URL}
        target="_blank"
        rel="noreferrer"
        className={linkClass}
      >
        {source.license}
      </a>
      {source.staleSince && (
        <>
          {" "}
          · <strong>{staleLabel(source.staleSince, source.name)}</strong>
        </>
      )}
    </p>
  );
}
