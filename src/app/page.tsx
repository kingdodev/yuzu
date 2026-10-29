export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-9 w-9 rounded-full bg-accent shadow-[inset_-4px_-4px_0_rgba(0,0,0,0.08)]"
          />
          <h1 className="text-3xl font-semibold tracking-tight">Yuzu</h1>
        </div>
        <p className="text-lg leading-relaxed text-muted">
          Klantenservice voor vier webshops in één inbox, met een AI-assistent
          die de eenvoudige vragen voorbereidt.
        </p>
        <p className="mt-8 text-sm text-muted">
          In aanbouw. De inbox verschijnt hier zodra inloggen en e-mail
          gekoppeld zijn.
        </p>
      </div>
    </main>
  );
}
