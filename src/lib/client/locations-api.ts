import type { LocationDto, LocationsResponse } from "@/types/locations";

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

// Same-repo backend, so only the top-level envelope is checked before typing.
function hasLocationsArray(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { locations?: unknown }).locations)
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

  if (!hasLocationsArray(body)) {
    throw new LocationsApiError();
  }

  return (body as LocationsResponse).locations;
}
