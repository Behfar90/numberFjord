import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Numberfjord</h1>
        <p className="text-muted-foreground text-sm">
          Ask about Norway. Answers use live data from Statistics Norway (CC BY
          4.0). Not affiliated with Statistics Norway.
        </p>
      </header>
      <Chat />
    </main>
  );
}
