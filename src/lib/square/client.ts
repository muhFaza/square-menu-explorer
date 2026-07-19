import "server-only";

import { SquareClient, SquareEnvironment } from "square";

import {
  getServerEnvironment,
  type ServerEnvironment,
  type SquareEnvironmentName,
} from "@/lib/config/env";

export function mapSquareEnvironment(
  environment: SquareEnvironmentName,
): (typeof SquareEnvironment)["Sandbox" | "Production"] {
  return environment === "sandbox"
    ? SquareEnvironment.Sandbox
    : SquareEnvironment.Production;
}

export function createSquareClient(config: ServerEnvironment): SquareClient {
  return new SquareClient({
    token: config.squareAccessToken,
    environment: mapSquareEnvironment(config.squareEnvironment),
  });
}

export function getSquareClient(): SquareClient {
  return createSquareClient(getServerEnvironment());
}
