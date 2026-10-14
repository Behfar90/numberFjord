"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import { SourceLine } from "@/components/charts/source-line";
import { Visual } from "@/components/charts/visual";
import { Button } from "@/components/ui/button";
import type { AgentUIMessage } from "@/lib/agent/agent";

import { Markdown } from "./markdown";
import { answerSources } from "./answer-sources";
import { isToolPart } from "./tool-label";
import { Trace } from "./trace";

const EXAMPLES = [
  "How many people live in Oslo?",
  "How has the consumer price index changed in the last 12 months?",
  "Hvor mange elbiler ble registrert i fjor?",
];

export function Chat() {
  const { messages, sendMessage, status, error, regenerate, stop } =
    useChat<AgentUIMessage>();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">Try asking:</p>
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              variant="outline"
              className="h-auto justify-start py-2 text-left whitespace-normal"
              onClick={() => send(example)}
            >
              {example}
            </Button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-6" aria-live="polite">
        {messages.map((message) => {
          const toolParts = message.parts.filter(isToolPart);
          const sources = answerSources(toolParts);
          return (
            <li
              key={message.id}
              className={
                message.role === "user"
                  ? "bg-muted self-end rounded-lg px-3 py-2"
                  : "flex flex-col gap-2"
              }
            >
              {toolParts.length > 0 && <Trace parts={toolParts} />}
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return message.role === "user" ? (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ) : (
                    <Markdown key={i} streaming={part.state === "streaming"}>
                      {part.text}
                    </Markdown>
                  );
                }
                if (
                  part.type === "tool-showVisual" &&
                  part.state === "output-available"
                ) {
                  return <Visual key={part.toolCallId} data={part.output} />;
                }
                return null;
              })}
              {sources.length > 0 && (
                <footer className="text-muted-foreground flex flex-col gap-1 border-t pt-2 text-xs">
                  <p className="font-medium">
                    {sources.length === 1 ? "Source" : "Sources"}
                  </p>
                  {sources.map((source) => (
                    <SourceLine key={source.tableId} source={source} />
                  ))}
                </footer>
              )}
            </li>
          );
        })}
      </ol>

      {status === "submitted" && (
        <p className="text-muted-foreground text-sm">Thinking…</p>
      )}

      {error && (
        <div
          role="alert"
          className="border-destructive/40 flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-sm"
        >
          <span>{error.message}</span>
          <Button variant="outline" size="sm" onClick={() => regenerate()}>
            Retry
          </Button>
        </div>
      )}

      <form
        className="bg-background sticky bottom-0 mt-auto flex gap-2 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="question" className="sr-only">
          Ask a question about Norway
        </label>
        <input
          id="question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about Norway…"
          autoComplete="off"
          className="border-input bg-background focus-visible:ring-ring/50 h-9 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            Ask
          </Button>
        )}
      </form>
    </div>
  );
}
