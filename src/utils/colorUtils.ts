export function shiftColor(hex: string, amount: number): string {
  const rgb = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((rgb >> 16) & 0xff) + amount);
  const g = Math.min(255, ((rgb >> 8) & 0xff) + amount);
  const b = Math.min(255, (rgb & 0xff) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
