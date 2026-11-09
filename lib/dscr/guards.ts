/** Input guards. All public math functions validate their inputs. */

export function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0 (got ${value})`);
  }
}

export function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number > 0 (got ${value})`);
  }
}

export function assertRatio(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1 (got ${value})`);
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round(n: number, step = 1): number {
  return Math.round(n / step) * step;
}

export function floorTo(n: number, step: number): number {
  return Math.floor(n / step + 1e-9) * step;
}

export function ceilTo(n: number, step: number): number {
  return Math.ceil(n / step - 1e-9) * step;
}
