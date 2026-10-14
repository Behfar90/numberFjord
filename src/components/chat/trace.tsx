import { Check, LoaderCircle, X } from "lucide-react";

import { toolLabel, type ToolPart } from "./tool-label";
import {
  stepDetails,
  stepStatus,
  traceSummary,
  type StepStatus,
} from "./trace-steps";

export function Trace({ parts }: { parts: ToolPart[] }) {
  return (
    <details className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-mono">
        {traceSummary(parts)}
      </summary>
      <ol className="mt-3 flex flex-col gap-3">
        {parts.map((part) => (
          <TraceStep key={part.toolCallId} part={part} />
        ))}
      </ol>
    </details>
  );
}

function TraceStep({ part }: { part: ToolPart }) {
  const status = stepStatus(part);
  const { lines, link } = stepDetails(part);

  return (
    <li className="flex gap-2">
      <StatusIcon status={status} />
      <div className="flex min-w-0 flex-col gap-1">
        <p
          className={
            status === "error" ? "text-destructive" : "text-foreground"
          }
        >
          {toolLabel(part)}
        </p>
        {lines.length > 0 && (
          <ul className="flex flex-col gap-0.5 wrap-break-word">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="w-fit underline underline-offset-2"
          >
            {link.label}
          </a>
        )}
      </div>
    </li>
  );
}

const STATUS_TEXT: Record<StepStatus, string> = {
  running: "Running",
  done: "Done",
  error: "Failed",
};

function StatusIcon({ status }: { status: StepStatus }) {
  const className = "mt-0.5 size-3.5 shrink-0";
  return (
    <>
      {status === "running" && (
        <LoaderCircle aria-hidden className={`${className} animate-spin`} />
      )}
      {status === "done" && <Check aria-hidden className={className} />}
      {status === "error" && (
        <X aria-hidden className={`${className} text-destructive`} />
      )}
      <span className="sr-only">{STATUS_TEXT[status]}:</span>
    </>
  );
}
