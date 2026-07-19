import type { Address, BusinessHours, Location } from "square";

import { ApplicationError } from "@/lib/errors/application-error";
import type {
  LocationAddressDto,
  LocationBusinessHoursPeriodDto,
  LocationDto,
} from "@/types/locations";

const BUSINESS_HOURS_DAYS: readonly LocationBusinessHoursPeriodDto["dayOfWeek"][] =
  ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function isBusinessHoursDay(
  value: string,
): value is LocationBusinessHoursPeriodDto["dayOfWeek"] {
  return (BUSINESS_HOURS_DAYS as readonly string[]).includes(value);
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredTrimmedLocationField(
  value: string | null | undefined,
  fieldName: "id" | "name",
  recordIndex: number,
): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new ApplicationError({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message: `Active Square location at index ${recordIndex} is missing ${fieldName}.`,
      publicMessage: "Location data is temporarily unavailable.",
    });
  }

  return trimmed;
}

function mapAddress(address: Address | undefined): LocationAddressDto | null {
  if (!address) {
    return null;
  }

  return {
    addressLine1: nullableTrimmed(address.addressLine1),
    addressLine2: nullableTrimmed(address.addressLine2),
    addressLine3: nullableTrimmed(address.addressLine3),
    locality: nullableTrimmed(address.locality),
    sublocality: nullableTrimmed(address.sublocality),
    administrativeDistrictLevel1: nullableTrimmed(
      address.administrativeDistrictLevel1,
    ),
    administrativeDistrictLevel2: nullableTrimmed(
      address.administrativeDistrictLevel2,
    ),
    postalCode: nullableTrimmed(address.postalCode),
    country: nullableTrimmed(address.country),
  };
}

function mapBusinessHours(
  businessHours: BusinessHours | undefined,
): readonly LocationBusinessHoursPeriodDto[] | null {
  const periods = businessHours?.periods;
  if (!periods) {
    return null;
  }

  const mapped = periods.flatMap((period) => {
    const dayOfWeek = period.dayOfWeek;
    const startLocalTime = nullableTrimmed(period.startLocalTime);
    const endLocalTime = nullableTrimmed(period.endLocalTime);

    if (
      !dayOfWeek ||
      !isBusinessHoursDay(dayOfWeek) ||
      !startLocalTime ||
      !endLocalTime
    ) {
      return [];
    }

    return [{ dayOfWeek, startLocalTime, endLocalTime }];
  });

  return mapped.length > 0 ? mapped : null;
}

/**
 * Keeps only active Square locations and converts them to the public contract.
 * The function is deterministic and performs no network, environment, or log work.
 */
export function mapActiveLocations(
  locations: readonly Location[],
): LocationDto[] {
  return locations.flatMap((location, recordIndex) => {
    if (location.status !== "ACTIVE") {
      return [];
    }

    return [
      {
        id: requiredTrimmedLocationField(location.id, "id", recordIndex),
        name: requiredTrimmedLocationField(location.name, "name", recordIndex),
        address: mapAddress(location.address),
        timezone: nullableTrimmed(location.timezone),
        businessHours: mapBusinessHours(location.businessHours),
        status: "ACTIVE" as const,
      },
    ];
  });
}
