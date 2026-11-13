/** SVG geometry for the DSCR gauge (display only, not financial math). Inputs are ratios ×10,000. */
const LO = 5_000;
const HI = 17_500;

const angle = (v: number) => Math.PI * (1 - (Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO));
const pt = (v: number, r: number) => [100 + r * Math.cos(angle(v)), 100 - r * Math.sin(angle(v))] as const;
const arc = (a: number, b: number, r: number) => {
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(b, r);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export function gaugeGeometry(dscrRatio: number | null, minRatio: number, strongRatio: number) {
  const v = dscrRatio ?? HI;
  const [nx, ny] = pt(v, 64);
  const [mx, my] = pt(minRatio, 98);
  return {
    track: arc(LO, HI, 80),
    bad: arc(LO, minRatio, 80),
    mid: arc(minRatio, strongRatio, 80),
    good: arc(strongRatio, HI, 80),
    needle: { x: nx.toFixed(2), y: ny.toFixed(2) },
    minLabel: { x: mx.toFixed(2), y: my.toFixed(2) },
  };
}
