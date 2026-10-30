import type { ReactNode } from "react";
import { YuzuMark } from "./ui";

/** Kader voor de inlogpagina's: logo en een kaart in het midden. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-full items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <YuzuMark size={30} />
          <span className="text-[20px] font-semibold tracking-[-0.01em]">Yuzu</span>
        </div>
        <section className="rounded-xl bg-panel p-6 shadow-card">
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.01em]">{title}</h1>
          {description && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{description}</p>
          )}
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
