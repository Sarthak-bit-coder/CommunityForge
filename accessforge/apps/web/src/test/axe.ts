import axe from "axe-core";

// Rules axe can't evaluate in jsdom (no layout or computed colors); contrast is set by design tokens.
const JSDOM_UNSUPPORTED_RULES = { "color-contrast": { enabled: false } };

export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, { rules: JSDOM_UNSUPPORTED_RULES });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
