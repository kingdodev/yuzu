"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/domain/attachments";
import {
  cancelAttachmentUpload,
  startAttachmentUpload,
} from "@/server/actions/attachments";
import type { UploadTarget } from "@/integrations/storage/types";

export type PickerState = { ids: string[]; busy: boolean };

type Item = {
  key: string;
  name: string;
  size: number;
  state: "uploading" | "done" | "error";
  progress: number;
  id?: string;
  error?: string;
  abort?: () => void;
};

/** Stuur het bestand rechtstreeks naar de opslag, met voortgang. */
function upload(
  target: UploadTarget,
  file: File,
  onProgress: (fraction: number) => void,
): { done: Promise<void>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const done = new Promise<void>((resolve, reject) => {
    xhr.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload mislukt (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload mislukt, controleer je verbinding"));
    xhr.onabort = () => reject(new Error("Geannuleerd"));
    xhr.send(file);
  });
  return { done, abort: () => xhr.abort() };
}

/**
 * Knop "Bijlage" plus de lijst met gekozen bestanden. Uploadt meteen bij
 * kiezen; het bericht kan pas weg als alles binnen is.
 */
export function AttachmentPicker({
  onChange,
  disabled = false,
}: {
  onChange: (state: PickerState) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const report = useRef(onChange);
  useEffect(() => {
    report.current = onChange;
  });
  useEffect(() => {
    report.current({
      ids: items.filter((i) => i.state === "done" && i.id).map((i) => i.id!),
      busy: items.some((i) => i.state === "uploading"),
    });
  }, [items]);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function add(file: File) {
    const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
    const item: Item = {
      key,
      name: file.name,
      size: file.size,
      state: "uploading",
      progress: 0,
    };
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setItems((list) => [
        ...list,
        {
          ...item,
          state: "error",
          error: `Te groot, maximaal ${formatBytes(MAX_ATTACHMENT_BYTES)}`,
        },
      ]);
      return;
    }
    setItems((list) => [...list, item]);

    const started = await startAttachmentUpload({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
    if (!started.ok) {
      update(key, { state: "error", error: started.error });
      return;
    }
    const { done, abort } = upload(started.upload, file, (p) =>
      update(key, { progress: p }),
    );
    update(key, { id: started.id, abort });
    try {
      await done;
      update(key, { state: "done", progress: 1, abort: undefined });
    } catch (e) {
      void cancelAttachmentUpload(started.id);
      update(key, {
        state: "error",
        error: e instanceof Error ? e.message : "Upload mislukt",
        id: undefined,
      });
    }
  }

  function remove(item: Item) {
    item.abort?.();
    if (item.id) void cancelAttachmentUpload(item.id);
    setItems((list) => list.filter((i) => i.key !== item.key));
  }

  const count = items.filter((i) => i.state !== "error").length;
  const full = count >= MAX_ATTACHMENTS_PER_MESSAGE;

  return (
    <div className="contents">
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(
            0,
            MAX_ATTACHMENTS_PER_MESSAGE - count,
          );
          e.target.value = "";
          for (const f of files) void add(f);
        }}
      />
      <button
        type="button"
        className="btn btn-quiet"
        disabled={disabled || full}
        onClick={() => input.current?.click()}
        title={full ? `Maximaal ${MAX_ATTACHMENTS_PER_MESSAGE} bijlagen` : undefined}
      >
        <Paperclip className="h-4 w-4" aria-hidden />
        Bijlage
      </button>
      {items.length > 0 && (
        <ul className="order-first flex basis-full flex-wrap gap-2" aria-label="Bijlagen">
          {items.map((i) => (
            <li
              key={i.key}
              className={`flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] ${
                i.state === "error"
                  ? "border-alert/50 text-alert"
                  : "border-line bg-panel"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 max-w-[220px] truncate">{i.name}</span>
              <span className="shrink-0 text-[12.5px] text-muted" aria-live="polite">
                {i.state === "uploading"
                  ? `${Math.round(i.progress * 100)}%`
                  : i.state === "error"
                    ? i.error?.replace(`${i.name}: `, "")
                    : formatBytes(i.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="-mr-1 rounded p-0.5 text-muted hover:bg-hover hover:text-ink"
                aria-label={`${i.name} weghalen`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
