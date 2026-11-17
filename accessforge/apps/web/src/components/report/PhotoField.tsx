"use client";

import { useEffect, useRef, useState } from "react";
import { photoError, PHOTO_TYPES } from "@/lib/report";
import { FieldError, INPUT_CLASS } from "./ReportField";

type Props = {
  readonly error?: string;
  readonly onError: (error: string | undefined) => void;
};

export function PhotoField({ error, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  function choose(file: File | undefined) {
    setPreview(null);
    const error = photoError(file);
    onError(error);
    if (!file || error) return;
    try {
      setPreview({ url: URL.createObjectURL(file), name: file.name });
    } catch {
      onError("This photo could not be previewed. Choose another file.");
    }
  }
  function remove() {
    setPreview(null);
    onError(undefined);
    if (input.current) input.current.value = "";
    input.current?.focus();
  }
  return (
    <div>
      <label htmlFor="report-photo" className="font-medium text-ink">
        Photo (optional)
      </label>
      <p id="photo-help" className="mt-1 text-sm text-muted">
        JPEG, PNG, or WebP; up to 5 MiB. Previewed only on this device, never uploaded. Avoid faces,
        addresses, and other personal information.
      </p>
      <input
        ref={input}
        id="report-photo"
        type="file"
        accept={PHOTO_TYPES.join(",")}
        onChange={(event) => choose(event.target.files?.[0])}
        className={INPUT_CLASS}
        aria-invalid={Boolean(error)}
        aria-describedby={`photo-help${error ? " report-photo-error" : ""}`}
      />
      <FieldError id="report-photo-error" error={error} />
      {preview ? (
        <figure className="mt-3">
          {/* A local object URL is not compatible with Next's image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={preview.url}
            src={preview.url}
            alt="Preview of selected photo"
            className="max-h-64 max-w-full rounded-md object-contain"
            onError={() => {
              setPreview(null);
              onError("This file could not be opened as a photo. Choose another file.");
            }}
          />
          <figcaption className="mt-1 break-all text-sm text-muted">{preview.name}</figcaption>
        </figure>
      ) : null}
      {preview || error ? (
        <button
          type="button"
          onClick={remove}
          className="mt-2 min-h-11 rounded-md border border-muted px-4 text-ink"
        >
          Remove photo
        </button>
      ) : null}
    </div>
  );
}
