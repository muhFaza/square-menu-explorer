export interface LocationAddressDto {
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly locality: string | null;
  readonly sublocality: string | null;
  readonly administrativeDistrictLevel1: string | null;
  readonly administrativeDistrictLevel2: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
}

export const WEEKDAY_ORDER = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export type WeekdayCode = (typeof WEEKDAY_ORDER)[number];

export interface LocationBusinessHoursPeriodDto {
  readonly dayOfWeek: WeekdayCode;
  readonly startLocalTime: string; // "HH:MM" or "HH:MM:SS" as provided by Square
  readonly endLocalTime: string;
}

export interface LocationDto {
  readonly id: string;
  readonly name: string;
  readonly address: LocationAddressDto | null;
  readonly timezone: string | null;
  readonly businessHours: readonly LocationBusinessHoursPeriodDto[] | null;
  readonly status: "ACTIVE";
}

export interface LocationsResponse {
  readonly locations: readonly LocationDto[];
}
