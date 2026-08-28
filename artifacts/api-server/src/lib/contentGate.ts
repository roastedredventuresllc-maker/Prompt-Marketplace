/** Public catalog responses expose this many characters of prompt body. */
export const CONTENT_PREVIEW_CHARS = 120;

/** Returns a short teaser for gated prompt bodies. */
export function truncateContent(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  const snippet = trimmed.slice(0, CONTENT_PREVIEW_CHARS);
  return snippet.length < trimmed.length ? snippet + "…" : snippet;
}

/** Replace full `content` with a preview when the caller does not have access. */
export function applyContentGate<T extends { content: string }>(
  prompt: T,
  hasAccess: boolean,
): T & { isGated: boolean } {
  if (hasAccess) return { ...prompt, isGated: false };
  return { ...prompt, content: truncateContent(prompt.content), isGated: true };
}
