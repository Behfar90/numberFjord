"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { VisualData } from "@/lib/charts/schema";

import { VisualChart } from "./visual-chart";
import { chartToTable, describeFixed } from "./visual-data";
import { VisualTable } from "./visual-table";

export function Visual({ data }: { data: VisualData }) {
  const [showTable, setShowTable] = useState(false);
  const fixed = describeFixed(data.fixed);
  const { source } = data;

  return (
    <figure className="flex flex-col gap-3 rounded-lg border p-4">
      <figcaption>
        <p className="font-medium">{data.title}</p>
        {fixed && <p className="text-muted-foreground text-xs">{fixed}</p>}
      </figcaption>

      {data.kind === "table" ? (
        <VisualTable columns={data.columns} rows={data.rows} />
      ) : showTable ? (
        <VisualTable {...chartToTable(data)} />
      ) : (
        <VisualChart chart={data} />
      )}

      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        <p>
          Source: Statistics Norway,{" "}
          <a
            href={source.tableUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            table {source.tableId}
          </a>{" "}
          · {source.license}
        </p>
        {data.kind === "chart" && (
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={showTable}
            onClick={() => setShowTable(!showTable)}
          >
            {showTable ? "Show chart" : "Show table"}
          </Button>
        )}
      </div>
    </figure>
  );
}
