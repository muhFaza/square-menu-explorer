import "server-only";

import { ConfigurationError } from "@/lib/errors/application-error";

export type SquareEnvironmentName = "sandbox" | "production";

export interface ServerEnvironment {
  readonly squareAccessToken: string;
  readonly squareEnvironment: SquareEnvironmentName;
  readonly port: number;
  readonly squareApplicationId?: string;
}

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function requiredTrimmedValue(
  source: EnvironmentSource,
  variableName: string,
  issues: string[],
): string | undefined {
  const value = source[variableName]?.trim();

  if (!value) {
    issues.push(`${variableName} must be a non-empty string`);
    return undefined;
  }

  return value;
}

function parseSquareEnvironment(
  source: EnvironmentSource,
  issues: string[],
): SquareEnvironmentName | undefined {
  const value = requiredTrimmedValue(source, "SQUARE_ENVIRONMENT", issues);

  if (value !== "sandbox" && value !== "production") {
    if (value) {
      issues.push("SQUARE_ENVIRONMENT must be either sandbox or production");
    }
    return undefined;
  }

  return value;
}

function parsePort(
  source: EnvironmentSource,
  issues: string[],
): number | undefined {
  const value = requiredTrimmedValue(source, "PORT", issues);

  if (!value) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    issues.push("PORT must be an integer between 1 and 65535");
    return undefined;
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    issues.push("PORT must be an integer between 1 and 65535");
    return undefined;
  }

  return port;
}

/** Pure parser: callers can validate fake sources without mutating process.env. */
export function parseServerEnvironment(
  source: EnvironmentSource,
): Readonly<ServerEnvironment> {
  const issues: string[] = [];
  const squareAccessToken = requiredTrimmedValue(
    source,
    "SQUARE_ACCESS_TOKEN",
    issues,
  );
  const squareEnvironment = parseSquareEnvironment(source, issues);
  const port = parsePort(source, issues);
  const squareApplicationId = source.SQUARE_APPLICATION_ID?.trim() || undefined;

  if (!squareAccessToken || !squareEnvironment || !port || issues.length > 0) {
    throw new ConfigurationError(
      `Invalid server environment: ${issues.join("; ")}`,
    );
  }

  return Object.freeze({
    squareAccessToken,
    squareEnvironment,
    port,
    ...(squareApplicationId ? { squareApplicationId } : {}),
  });
}

/** Reads process.env only at call time so imports remain side-effect free. */
export function getServerEnvironment(): Readonly<ServerEnvironment> {
  return parseServerEnvironment(process.env);
}
