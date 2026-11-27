"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "@/components/motion/motion-tokens";
import { photoError, PHOTO_ACCEPT } from "@/lib/report";
import { FieldError } from "./ReportField";

type Props = {
  readonly error?: string;
  readonly onError: (error: string | undefined) => void;
  readonly onPhotoChange: (hasPhoto: boolean) => void;
};

type Preview = { url: string; name: string };

const PREVIEW_START_SCALE = 0.96;

export function PhotoField({ error, onError, onPhotoChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreviewState] = useState<Preview | null>(null);
  function setPreview(next: Preview | null) {
    setPreviewState(next);
    onPhotoChange(next !== null);
  }
  const [isDragging, setIsDragging] = useState(false);
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
  // Dropping is a shortcut for pointer users; the file input stays the accessible way in.
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    choose(event.dataTransfer.files[0]);
  }
  return (
    <div>
      <label htmlFor="report-photo" className="font-medium text-ink">
        Photo (optional)
      </label>
      <p id="photo-help" className="mt-1 text-sm text-muted">
        Any photo format your browser can open; up to 5 MiB. Previewed only on this device, never
        uploaded. Avoid faces, addresses, and other personal information.
      </p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={drop}
        className={`mt-2 flex flex-col items-start gap-3 rounded-xl border-2 border-dashed p-4 transition-colors duration-150 sm:flex-row sm:items-center ${
          isDragging
            ? "border-accent bg-accent-soft"
            : error
              ? "border-warning bg-surface"
              : "border-control bg-surface"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-6 shrink-0 transition-transform duration-150 ${isDragging ? "-translate-y-0.5 text-accent" : "text-muted"}`}
        >
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3M12 4v11M7.5 8.5 12 4l4.5 4.5" />
        </svg>
        <input
          ref={input}
          id="report-photo"
          type="file"
          accept={PHOTO_ACCEPT}
          onChange={(event) => choose(event.target.files?.[0])}
          className="min-h-11 max-w-full text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-control file:bg-surface file:px-4 file:font-semibold file:text-ink hover:file:border-ink"
          aria-invalid={Boolean(error)}
          aria-describedby={`photo-help${error ? " report-photo-error" : ""}`}
        />
        <span aria-hidden="true" className="text-sm text-muted">
          or drop a photo here
        </span>
      </div>
      <FieldError id="report-photo-error" error={error} />
      {/* Entrance only: a removed photo leaves at once, so its revoked URL is never shown. */}
      {preview ? (
        <m.figure
          key={preview.url}
          className="mt-3"
          initial={{ opacity: 0, scale: PREVIEW_START_SCALE }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION_DURATION_S.interactive, ease: MOTION_EASE_ENTER }}
        >
          {/* A local object URL is not compatible with Next's image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Preview of selected photo"
            className="max-h-64 max-w-full rounded-xl object-contain shadow-card"
            onError={() => {
              setPreview(null);
              onError("This file could not be opened as a photo. Choose another file.");
            }}
          />
          <figcaption className="mt-1 text-sm break-all text-muted">{preview.name}</figcaption>
        </m.figure>
      ) : null}
      {preview || error ? (
        <button type="button" onClick={remove} className="af-button-secondary mt-2">
          Remove photo
        </button>
      ) : null}
    </div>
  );
}
