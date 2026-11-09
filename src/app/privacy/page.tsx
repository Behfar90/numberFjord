import type { Metadata } from "next";
import Link from "next/link";

import { MAX_MESSAGES } from "@/lib/agent/chat";
import { agentModel } from "@/lib/agent/model";
import { CHAT_LIMITS } from "@/lib/agent/rate-limit";

export const metadata: Metadata = {
  title: "Privacy · Numberfjord",
  description: "What Numberfjord does with your questions and what it stores.",
};

const REPO_URL = "https://github.com/Behfar90/numberfjord";
const linkClass = "underline underline-offset-2";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10 pb-8 text-sm leading-6">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-muted-foreground text-xs">
          ← Numberfjord
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-muted-foreground">Last updated 9 November 2026</p>
      </header>

      <p>
        <strong>In short:</strong> no accounts, no cookies, no analytics or
        tracking. Your conversation is not saved on our servers. To answer a
        question, its text is sent to an AI model.
      </p>

      <Section title="What happens to your questions">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            When you ask something, the conversation so far (up to{" "}
            {MAX_MESSAGES} messages) goes to our server and on to an AI model
            through Vercel AI Gateway. The model in use is{" "}
            <code>{agentModel}</code>; this can change. Vercel and the model
            provider process the text under their own terms, so please
            don&apos;t put personal information in your questions.
          </li>
          <li>
            The conversation only lives in your browser tab. Reloading the page
            clears it, and we don&apos;t keep a copy.
          </li>
          <li>
            The model turns your question into search keywords and table queries
            for Statistics Norway&apos;s public API. Those requests come from
            our server, so Statistics Norway does not see your IP address.
          </li>
        </ul>
      </Section>

      <Section title="What we store">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">What</th>
                <th className="py-2 pr-4 font-medium">Why</th>
                <th className="py-2 font-medium">How long</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b">
                <td className="py-2 pr-4">A hash of your IP address</td>
                <td className="py-2 pr-4">
                  Rate limiting: {CHAT_LIMITS.perMinute} questions a minute and{" "}
                  {CHAT_LIMITS.perDay} a day
                </td>
                <td className="py-2">Deleted automatically within 2 days</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">
                  Responses from Statistics Norway&apos;s API, stored under the
                  request address (which includes the model&apos;s search
                  keywords)
                </td>
                <td className="py-2 pr-4">
                  Faster answers, fewer requests to Statistics Norway, and a
                  fallback when its API is down
                </td>
                <td className="py-2">
                  Until Statistics Norway&apos;s next update, then up to 7 more
                  days
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Both are kept in an Upstash Redis database in the United States. The
          IP hash means your address is never stored as is, but it is not fully
          anonymous: someone with access to the database could work it out by
          trying every possible address.
        </p>
      </Section>

      <Section title="Hosting and logs">
        <p>
          The site runs on Vercel in the United States. Like any web host,
          Vercel keeps short-lived request logs (IP address, page, time and
          status). Our code does not log your questions or the answers.
        </p>
      </Section>

      <Section title="Cookies and tracking">
        <p>
          None. There are no cookies, analytics, ads or third-party tracking
          scripts. Fonts are served from this site, not from Google.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Nothing we store is linked to who you are, so there is usually nothing
          to look up or delete. If you have a question about privacy,{" "}
          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
