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

/** Same gating used by list, trending, and nested library prompt payloads. */
export function gatePromptCollection<T extends { id: number; content: string }>(
  prompts: T[],
  accessibleIds: ReadonlySet<number>,
): Array<T & { isGated: boolean }> {
  return prompts.map((p) => applyContentGate(p, accessibleIds.has(p.id)));
}

/** Copy UI must fail closed unless the API marked the body as ungated. */
export function mayCopyPromptContent(isGated: boolean | undefined): boolean {
  return isGated === false;
}

/**
 * Buying or owning a collection must not unlock other people's prompt bodies.
 * A library purchase/membership only covers prompts authored by that library's creator.
 */
export function libraryMembershipUnlocksPrompt(
  promptAuthorUsername: string,
  libraryAuthorUsername: string,
): boolean {
  return promptAuthorUsername === libraryAuthorUsername;
}

/** Contract for anonymous/unpurchased catalog payloads. */
export function assertAnonymousCatalogGated(
  prompts: Array<{ content: string; isGated: boolean }>,
): void {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error("expected a non-empty prompts array");
  }
  for (const prompt of prompts) {
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

/** @deprecated use assertAnonymousCatalogGated */
export function assertAnonymousPromptListGated(body: {
  prompts: Array<{ content: string; isGated: boolean }>;
}): void {
  assertAnonymousCatalogGated(body.prompts);
}
