import type {
  LocationBusinessHoursPeriodDto,
  LocationDto,
} from "@/types/locations";

export type OpenStatus =
  | { readonly kind: "open"; readonly closesAtLabel: string }
  | {
      readonly kind: "closed";
      readonly opensAtLabel: string | null;
      readonly opensDayLabel: string | null;
    }
  | { readonly kind: "unknown" };

type WeekdayCode = LocationBusinessHoursPeriodDto["dayOfWeek"];

const WEEKDAY_ORDER: readonly WeekdayCode[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

const SHORT_WEEKDAY_LABEL: Record<WeekdayCode, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

// Intl "short" weekday output (en-US) mapped back to the DTO's day codes.
const INTL_WEEKDAY_TO_CODE: Record<string, WeekdayCode> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

const SECONDS_PER_DAY = 24 * 60 * 60;

const UNKNOWN: OpenStatus = { kind: "unknown" };

interface LocalNow {
  readonly dayIndex: number;
  readonly seconds: number;
}

/** Parses a partial-time string ("HH:MM" or "HH:MM:SS") into seconds-of-day. */
function parseLocalTimeToSeconds(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

/** Resolves the location's current local weekday and time via Intl only. */
function getLocalNow(now: Date, timeZone: string): LocalNow | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    // Invalid IANA timezone.
    return null;
  }

  const lookup = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((part) => part.type === type)?.value;

  const weekday = lookup("weekday");
  const hour = lookup("hour");
  const minute = lookup("minute");
  const second = lookup("second");

  if (
    weekday === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return null;
  }

  const dayIndex = WEEKDAY_ORDER.indexOf(INTL_WEEKDAY_TO_CODE[weekday]);
  if (dayIndex < 0) {
    return null;
  }

  return {
    dayIndex,
    seconds: Number(hour) * 3600 + Number(minute) * 60 + Number(second),
  };
}

function formatTimeLabel(secondsOfDay: number): string {
  const totalMinutes = Math.floor(secondsOfDay / 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

interface ParsedPeriod {
  readonly dayIndex: number;
  readonly start: number;
  readonly end: number;
}

function parsePeriods(
  periods: readonly LocationBusinessHoursPeriodDto[],
): ParsedPeriod[] {
  return periods.flatMap((period) => {
    const dayIndex = WEEKDAY_ORDER.indexOf(period.dayOfWeek);
    const start = parseLocalTimeToSeconds(period.startLocalTime);
    const end = parseLocalTimeToSeconds(period.endLocalTime);

    if (dayIndex < 0 || start === null || end === null) {
      return [];
    }

    return [{ dayIndex, start, end }];
  });
}

/** Returns the end time when `local` falls inside the period, otherwise null. */
function openEndSeconds(period: ParsedPeriod, local: LocalNow): number | null {
  const isOvernight = period.end <= period.start;

  if (!isOvernight) {
    if (
      local.dayIndex === period.dayIndex &&
      local.seconds >= period.start &&
      local.seconds < period.end
    ) {
      return period.end;
    }
    return null;
  }

  // Overnight: open from start until midnight on its day...
  if (local.dayIndex === period.dayIndex && local.seconds >= period.start) {
    return period.end;
  }
  // ...and from midnight until end on the following day.
  const nextDayIndex = (period.dayIndex + 1) % WEEKDAY_ORDER.length;
  if (local.dayIndex === nextDayIndex && local.seconds < period.end) {
    return period.end;
  }

  return null;
}

interface NextOpening {
  readonly dayIndex: number;
  readonly start: number;
  readonly deltaSeconds: number;
}

/** Finds the soonest upcoming period start within the next 7 days. */
function findNextOpening(
  periods: readonly ParsedPeriod[],
  local: LocalNow,
): NextOpening | null {
  let best: NextOpening | null = null;

  for (const period of periods) {
    const dayOffset =
      (period.dayIndex - local.dayIndex + WEEKDAY_ORDER.length) %
      WEEKDAY_ORDER.length;
    let deltaSeconds = dayOffset * SECONDS_PER_DAY + period.start - local.seconds;
    if (deltaSeconds <= 0) {
      // Already passed today; the next occurrence is a week away.
      deltaSeconds += WEEKDAY_ORDER.length * SECONDS_PER_DAY;
    }

    if (best === null || deltaSeconds < best.deltaSeconds) {
      best = { dayIndex: period.dayIndex, start: period.start, deltaSeconds };
    }
  }

  return best;
}

export function getOpenStatus(location: LocationDto, now?: Date): OpenStatus {
  const { businessHours, timezone } = location;
  if (!businessHours || businessHours.length === 0 || timezone === null) {
    return UNKNOWN;
  }

  const local = getLocalNow(now ?? new Date(), timezone);
  if (local === null) {
    return UNKNOWN;
  }

  const periods = parsePeriods(businessHours);
  if (periods.length === 0) {
    return UNKNOWN;
  }

  for (const period of periods) {
    const end = openEndSeconds(period, local);
    if (end !== null) {
      return { kind: "open", closesAtLabel: formatTimeLabel(end) };
    }
  }

  const next = findNextOpening(periods, local);
  if (next === null) {
    return { kind: "closed", opensAtLabel: null, opensDayLabel: null };
  }

  const opensToday = next.deltaSeconds < SECONDS_PER_DAY - local.seconds;

  return {
    kind: "closed",
    opensAtLabel: formatTimeLabel(next.start),
    opensDayLabel: opensToday
      ? null
      : SHORT_WEEKDAY_LABEL[WEEKDAY_ORDER[next.dayIndex]],
  };
}
