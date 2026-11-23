import type { CSSProperties } from "react";

// Page title whose words tumble into place one after another (CSS only, see af-word in
// globals.css). Screen readers get the plain sentence; the animated words are hidden from them.
export function KineticTitle({ text }: { readonly text: string }) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className="af-word"
            style={{ "--i": index } as CSSProperties}
          >
            {word}
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </>
  );
}
