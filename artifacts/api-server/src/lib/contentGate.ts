/** Public catalog responses expose this many characters of prompt body. */
export const CONTENT_PREVIEW_CHARS = 120;
/** Max length of a gated REST preview (120 chars + ellipsis). */
export const GATED_CONTENT_MAX_LENGTH = CONTENT_PREVIEW_CHARS + 1;

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

/** Contract for anonymous/unpurchased catalog payloads (GET /api/prompts). */
export function assertAnonymousPromptListGated(body: {
  prompts: Array<{ content: string; isGated: boolean }>;
}): void {
  if (!Array.isArray(body.prompts)) {
    throw new Error("expected prompts array");
  }
  for (const prompt of body.prompts) {
    if (prompt.isGated !== true) {
      throw new Error("expected isGated: true for anonymous catalog items");
    }
    if (prompt.content.length > GATED_CONTENT_MAX_LENGTH) {
      throw new Error(
        `anonymous content length ${prompt.content.length} exceeds ${GATED_CONTENT_MAX_LENGTH}`,
      );
    }
  }
}
