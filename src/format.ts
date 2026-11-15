/** Fill named placeholders once. Values are literal text; unknown placeholders stay visible. */
export function formatText(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(params, key) ? String(params[key]) : match)
}
