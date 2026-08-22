import { parseISO, isValid, isBefore, isAfter, isEqual } from 'date-fns';

export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = parseISO(dateStr);
  return isValid(d);
}

export function isDateWithinRange(targetDate: string, startDate: string, endDate: string): boolean {
  const target = parseISO(targetDate);
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (!isValid(target) || !isValid(start) || !isValid(end)) return false;

  return (
    (isAfter(target, start) || isEqual(target, start)) &&
    (isBefore(target, end) || isEqual(target, end))
  );
}

export function isRangeWithinRange(
  subStart: string,
  subEnd: string,
  parentStart: string,
  parentEnd: string
): boolean {
  return (
    isDateWithinRange(subStart, parentStart, parentEnd) &&
    isDateWithinRange(subEnd, parentStart, parentEnd) &&
    !isBefore(parseISO(subEnd), parseISO(subStart))
  );
}
