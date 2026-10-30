"use client";

import { Languages } from "lucide-react";
import { useState } from "react";

/** Toont standaard de Nederlandse vertaling, met één klik het origineel. */
export function TranslatedText({
  original,
  translation,
  languageName,
}: {
  original: string;
  translation: string | null;
  languageName: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  if (!translation) return <Body text={original} />;
  return (
    <div>
      <Body text={showOriginal ? original : translation} />
      <button
        type="button"
        onClick={() => setShowOriginal((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <Languages className="h-3.5 w-3.5" aria-hidden />
        {showOriginal
          ? "Toon vertaling"
          : `Vertaald uit het ${languageName}. Toon origineel`}
      </button>
    </div>
  );
}

export function Body({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.6]">
      {linkify(text)}
    </div>
  );
}

/** Maakt URL's klikbaar; alles anders blijft platte tekst (nooit HTML uit een mail). */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-link underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
