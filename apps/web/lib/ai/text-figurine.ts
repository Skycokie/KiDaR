/**
 * Helpers for text-to-3D figurine enqueue (FIGURE_TEXT_3D_ENABLED).
 */

export const TEXT_FIGURINE_PROMPT_MAX = 240;

export function limitTextFigurinePrompt(input: string): string {
  return input.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, TEXT_FIGURINE_PROMPT_MAX);
}

export function isFigureText3dRequest(body: { mode?: unknown; prompt?: unknown }): boolean {
  return body.mode === "text" && typeof body.prompt === "string" && body.prompt.trim().length > 0;
}
