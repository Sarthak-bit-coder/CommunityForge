export const INPUT_CLASS =
  "mt-1 block min-h-11 w-full rounded-md border border-muted bg-surface px-3 py-2 text-ink";

export function FieldError({ id, error }: { readonly id: string; readonly error?: string }) {
  return error ? (
    <p id={id} className="mt-1 font-medium text-warning">
      {error}
    </p>
  ) : null;
}
