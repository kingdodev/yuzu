import { Download, FileText } from "lucide-react";
import { formatBytes, servingFor } from "@/domain/attachments";

export type AttachmentItem = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  scanStatus: string;
};

/** Bijlagen bij een bericht: foto's als voorbeeld, de rest als bestand. */
export function AttachmentList({ items }: { items: readonly AttachmentItem[] }) {
  const visible = items.filter((a) => a.scanStatus !== "infected");
  if (visible.length === 0) return null;
  const images = visible.filter((a) => servingFor(a.filename, a.contentType).isImage);
  const files = visible.filter((a) => !servingFor(a.filename, a.contentType).isImage);
  return (
    <div className="mt-3 space-y-2" aria-label="Bijlagen">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((a) => (
            <li key={a.id}>
              <a
                href={`/bijlagen/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block w-fit"
                title={`${a.filename} (${formatBytes(a.sizeBytes)})`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- privébestand, geen optimalisatie */}
                <img
                  src={`/bijlagen/${a.id}`}
                  alt={a.filename}
                  loading="lazy"
                  className="h-28 w-auto max-w-[220px] rounded-lg border border-line bg-panel-sunk object-cover group-hover:opacity-90"
                />
                <span className="mt-1 block max-w-[220px] truncate text-[12.5px] text-muted">
                  {a.filename}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((a) => {
            const { inline } = servingFor(a.filename, a.contentType);
            return (
              <li key={a.id}>
                <a
                  href={`/bijlagen/${a.id}`}
                  {...(inline
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : { download: a.filename })}
                  className="flex max-w-[280px] items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[13.5px] hover:bg-hover"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 truncate">{a.filename}</span>
                  <span className="shrink-0 text-[12.5px] text-muted">
                    {formatBytes(a.sizeBytes)}
                  </span>
                  {!inline && (
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
