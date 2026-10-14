export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(bag.hour);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedDayRange(now: Date, timeZone: string) {
  const parts = zonedParts(now, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const start = new Date(utcGuess - offsetMs(new Date(utcGuess), timeZone));
  const nextGuess = Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0);
  const end = new Date(nextGuess - offsetMs(new Date(nextGuess), timeZone));
  return { start, end, label: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` };
}

export function shiftZonedDay(date: Date, timeZone: string, days: number) {
  const parts = zonedParts(date, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second);
  return new Date(utcGuess - offsetMs(new Date(utcGuess), timeZone));
}

export function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date >= start && date < end;
}
