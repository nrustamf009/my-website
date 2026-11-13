/** Coverage meter geometry (chart layout, not money math): DSCR ratio → position on a 0.50–1.60 scale. */
export const METER_MIN = 5_000;
export const METER_MAX = 16_000;

export function meterPosition(value: number | null): number {
  if (value === null) return 1;
  return Math.min(1, Math.max(0, (value - METER_MIN) / (METER_MAX - METER_MIN)));
}

/** Point on the gauge arc (180°, left to right) for a 0..1 position. viewBox 310×160, center (155, 150), radius 125. */
export function arcPoint(pos: number, radius = 125, cx = 155, cy = 150) {
  const a = Math.PI * (1 - pos);
  return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
}

export function arcPath(from: number, to: number, radius = 125) {
  const p1 = arcPoint(from, radius);
  const p2 = arcPoint(to, radius);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

/** CSS percentage for a meter position ("45.5%"). */
export const toPercent = (pos: number) => `${(pos * 100).toFixed(2)}%`;
export const meterPercent = (value: number | null) => toPercent(meterPosition(value));
