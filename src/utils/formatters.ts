export function createProgressBar(current: number, max: number, length: number = 15): string {
  const progress = Math.min(Math.floor((current / max) * length), length);
  const filled = '▰'.repeat(progress);
  const empty = '▱'.repeat(length - progress);
  return filled + empty;
}
