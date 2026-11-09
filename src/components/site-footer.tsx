import Link from "next/link";

const linkClass = "underline underline-offset-2";

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground mx-auto w-full max-w-2xl px-4 pt-2 pb-8 text-xs">
      <p>
        Numberfjord is an independent project and is not affiliated with,
        endorsed by or speaking for Statistics Norway (SSB).
      </p>
      <p>
        Data:{" "}
        <a
          href="https://www.ssb.no/en"
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          Statistics Norway
        </a>
        , licensed under{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          CC BY 4.0
        </a>
        . Values in charts and tables are shown as published; calculations in
        answer text are marked as such.
      </p>
      <p>
        <Link href="/privacy" className={linkClass}>
          Privacy
        </Link>
      </p>
    </footer>
  );
}
