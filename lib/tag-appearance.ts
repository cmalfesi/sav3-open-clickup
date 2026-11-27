/** Imported tags used one neutral placeholder; give those a stable presentation color.
 * Configured hex colors remain authoritative. This never changes stored tag data.
 */
const importedPlaceholder = '#656f7d';
const palette = ['#6d28d9', '#ff9800', '#c4d72e', '#4f46e5', '#007f8b', '#d6336c', '#8a4b12', '#2563eb'];
export function tagAppearance(name: string, color: string) {
  let backgroundColor = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(backgroundColor)) backgroundColor = '#' + [...backgroundColor.slice(1)].map(c => c + c).join('');
  if (!/^#[0-9a-f]{6}$/.test(backgroundColor) || backgroundColor === importedPlaceholder) {
    let hash = 0;
    for (const char of name.trim().toLowerCase()) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
    backgroundColor = palette[hash % palette.length];
  }
  const rgb = [1, 3, 5].map(i => parseInt(backgroundColor.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  // Black or white, whichever has the higher WCAG contrast against the fill.
  return {backgroundColor, color: luminance > 0.179 ? '#000000' : '#ffffff'};
}
