import { BARRIER_TYPES, type LngLat } from "./barriers";

export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReportDraft = {
  readonly type: string;
  readonly description: string;
  readonly latitude: string;
  readonly longitude: string;
};
export type ReportErrors = Partial<Record<keyof ReportDraft | "photo" | "severity", string>>;

function coordinate(value: string, limit: number): number | null {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function parseLocation(latitude: string, longitude: string): LngLat | null {
  const lat = coordinate(latitude, 90);
  const lng = coordinate(longitude, 180);
  return lat === null || lng === null ? null : { lat, lng };
}

export function validateReport(draft: ReportDraft): ReportErrors {
  const errors: ReportErrors = {};
  if (!BARRIER_TYPES.some((type) => type === draft.type)) errors.type = "Choose a barrier type.";
  if (!draft.description.trim()) errors.description = "Describe the barrier.";
  else if (draft.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Use no more than ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  if (coordinate(draft.latitude, 90) === null)
    errors.latitude = "Enter a latitude between -90 and 90.";
  if (coordinate(draft.longitude, 180) === null)
    errors.longitude = "Enter a longitude between -180 and 180.";
  return errors;
}

export function photoError(file: File | undefined): string | undefined {
  if (!file) return undefined;
  if (!PHOTO_TYPES.some((type) => type === file.type)) return "Choose a JPEG, PNG, or WebP photo.";
  if (file.size === 0) return "This photo is empty. Choose another file.";
  if (file.size > MAX_PHOTO_BYTES) return "Choose a photo no larger than 5 MiB.";
  return undefined;
}
