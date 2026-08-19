export function describe(facts: Record<string, unknown>): string {
  return Object.entries(facts)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
}
