import { Decimal } from 'decimal.js';

export function toDecimalString(val: string | number | Decimal | null | undefined, defaultValue = '0.00'): string {
  if (val === null || val === undefined || val === '') {
    return defaultValue;
  }
  try {
    return new Decimal(val).toFixed(2);
  } catch {
    return defaultValue;
  }
}

export function sumDecimals(values: Array<string | number | Decimal | null | undefined>): string {
  let total = new Decimal(0);
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') {
      try {
        total = total.plus(new Decimal(v));
      } catch {
        // ignore invalid values
      }
    }
  }
  return total.toFixed(2);
}

export function isGreaterThan(a: string | Decimal, b: string | Decimal): boolean {
  return new Decimal(a).greaterThan(new Decimal(b));
}

export function isLessThan(a: string | Decimal, b: string | Decimal): boolean {
  return new Decimal(a).lessThan(new Decimal(b));
}

export function subtractDecimals(a: string | Decimal, b: string | Decimal): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed(2);
}
