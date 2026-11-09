export interface CacheStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface ResponseCache {
  store: CacheStore;
  // Local "HH:MM" times when the source may publish new data or metadata.
  refreshTimes: string[];
  timeZone: string;
}

export function createMemoryStore(): CacheStore {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
    },
  };
}

export function secondsUntilNextRefresh(
  now: Date,
  refreshTimes: string[],
  timeZone: string,
): number {
  const { year, month, day } = zonedParts(now.getTime(), timeZone);
  let next = Infinity;
  for (const dayOffset of [0, 1]) {
    for (const time of refreshTimes) {
      const [hour, minute] = time.split(":").map(Number);
      const instant = zonedToUtc(
        year,
        month,
        day + dayOffset,
        hour,
        minute,
        timeZone,
      );
      if (instant > now.getTime()) next = Math.min(next, instant);
    }
  }
  if (!Number.isFinite(next)) {
    throw new Error("refreshTimes must contain at least one HH:MM time");
  }
  return Math.ceil((next - now.getTime()) / 1_000);
}

function zonedParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant / 1_000) * 1_000;
}

// Wall-clock time in a zone → UTC epoch ms. The second pass corrects the
// guess when the offset differs on either side of a DST switch.
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - offsetMs(wall, timeZone);
  return wall - offsetMs(guess, timeZone);
}
