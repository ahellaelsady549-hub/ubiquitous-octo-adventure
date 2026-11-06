export const angleDelta = (next: number, previous: number) => ((next - previous + 540) % 360) - 180;
export const wrapAngle = (angle: number) => ((angle % 360) + 360) % 360;

/** Project the current screen's top edge into the earth's horizontal plane. */
export function screenHeading(alpha: number, beta: number, gamma: number, screen: number): number | null {
  const rad = (v: number) => v * Math.PI / 180;
  const a = rad(alpha);
  const b = rad(beta);
  const g = rad(gamma);
  const s = rad(screen);
  const x = -Math.sin(s) * (Math.cos(a) * Math.cos(g) - Math.sin(a) * Math.sin(b) * Math.sin(g))
    - Math.cos(s) * Math.sin(a) * Math.cos(b);
  const y = -Math.sin(s) * (Math.sin(a) * Math.cos(g) + Math.cos(a) * Math.sin(b) * Math.sin(g))
    + Math.cos(s) * Math.cos(a) * Math.cos(b);
  if (Math.hypot(x, y) < 0.55) return null;
  return wrapAngle(Math.atan2(x, y) * 180 / Math.PI);
}