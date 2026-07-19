import { ApplicationError } from "@/lib/errors/application-error";

const SQUARE_LOCATION_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;

function createBadRequestError(
  message: string,
  publicMessage: string,
): ApplicationError {
  return new ApplicationError({
    code: "BAD_REQUEST",
    statusCode: 400,
    message,
    publicMessage,
  });
}

/** Parses the one required Square location query value without guessing. */
export function parseLocationId(request: Request): string {
  const values = new URL(request.url).searchParams.getAll("location_id");

  if (values.length === 0) {
    throw createBadRequestError(
      "Catalog request is missing location_id.",
      "location_id is required.",
    );
  }

  if (values.length > 1) {
    throw createBadRequestError(
      "Catalog request contains duplicate location_id values.",
      "location_id must be provided exactly once.",
    );
  }

  const [locationId] = values;
  if (
    !locationId ||
    locationId.trim() !== locationId ||
    !SQUARE_LOCATION_ID_PATTERN.test(locationId)
  ) {
    throw createBadRequestError(
      "Catalog request contains a malformed location_id.",
      "location_id is invalid.",
    );
  }

  return locationId;
}
