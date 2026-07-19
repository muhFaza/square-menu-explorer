import type {
  LocationAddressDto,
  LocationBusinessHoursPeriodDto,
  LocationDto,
  LocationsResponse,
} from "@/types/locations";

const addressKeys = [
  "addressLine1",
  "addressLine2",
  "addressLine3",
  "locality",
  "sublocality",
  "administrativeDistrictLevel1",
  "administrativeDistrictLevel2",
  "postalCode",
  "country",
] as const satisfies readonly (keyof LocationAddressDto)[];

const businessHoursDays = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const satisfies readonly LocationBusinessHoursPeriodDto["dayOfWeek"][];

type Fetcher = typeof fetch;

export interface FetchLocationsOptions {
  readonly fetcher?: Fetcher;
  readonly signal?: AbortSignal;
}

export class LocationsApiError extends Error {
  constructor() {
    super("Locations are unavailable right now.");
    this.name = "LocationsApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isLocationAddress(value: unknown): value is LocationAddressDto {
  return (
    isRecord(value) &&
    addressKeys.every((key) => isNullableString(value[key]))
  );
}

function isBusinessHoursPeriod(
  value: unknown,
): value is LocationBusinessHoursPeriodDto {
  return (
    isRecord(value) &&
    typeof value.dayOfWeek === "string" &&
    (businessHoursDays as readonly string[]).includes(value.dayOfWeek) &&
    typeof value.startLocalTime === "string" &&
    typeof value.endLocalTime === "string"
  );
}

function isBusinessHours(
  value: unknown,
): value is readonly LocationBusinessHoursPeriodDto[] | null {
  return (
    value === null ||
    (Array.isArray(value) && value.every(isBusinessHoursPeriod))
  );
}

function isLocation(value: unknown): value is LocationDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.status === "ACTIVE" &&
    (value.address === null || isLocationAddress(value.address)) &&
    isNullableString(value.timezone) &&
    isBusinessHours(value.businessHours)
  );
}

function isLocationsResponse(value: unknown): value is LocationsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocation)
  );
}

export async function fetchLocations({
  fetcher = fetch,
  signal,
}: FetchLocationsOptions = {}): Promise<readonly LocationDto[]> {
  const response = await fetcher("/api/locations", {
    headers: { accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new LocationsApiError();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LocationsApiError();
  }

  if (!isLocationsResponse(body)) {
    throw new LocationsApiError();
  }

  return body.locations;
}
