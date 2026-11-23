// Barriers a visitor is watching, kept only in this browser. Nothing is sent to the server
// and no alerts exist yet, so the UI must never imply notifications.
export const WATCHED_STORAGE_KEY = "accessforge:watched-barriers";

function readWatched(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(WATCHED_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Corrupt or blocked storage reads as "nothing watched"; writes report their own failure.
    return [];
  }
}

export function isWatched(id: string): boolean {
  return readWatched().includes(id);
}

/** Returns false when the browser refuses to save (private mode, quota, blocked storage). */
export function setWatched(id: string, watching: boolean): boolean {
  const others = readWatched().filter((watchedId) => watchedId !== id);
  try {
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(watching ? [...others, id] : others));
    return true;
  } catch {
    return false;
  }
}
