/** Dark backgrounds keep white initials legible. Saved on User, shared by every view. */
export const userColors = ["#5b4bb7", "#b33b55", "#18705c", "#a04b13", "#2368a2", "#843f99", "#586524", "#b03925", "#14717d", "#805346", "#384ca6", "#9a386f", "#276f38", "#8b5e12", "#4d5c72", "#694db2", "#9a422f", "#116b91", "#735c26", "#674964"] as const;
export function availableUserColor(used: Iterable<string>): string {
  const taken = new Set([...used].map(c => c.toLowerCase()));
  const first = userColors.find(c => !taken.has(c));
  if (first) return first;
  for (let i = 0; ; i++) {
    const c = `hsl(${(i * 137) % 360} 60% ${28 + Math.floor(i / 360) % 8}%)`;
    if (!taken.has(c)) return c;
  }
}
export async function nextUserColor(db: D1Database): Promise<string> {
  const rows = await db.prepare("SELECT color FROM User").all<{color:string}>();
  return availableUserColor(rows.results.map(u => u.color));
}
