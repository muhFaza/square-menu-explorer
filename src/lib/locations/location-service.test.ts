import type { Location } from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AsyncTtlCache } from "@/lib/cache/async-ttl-cache";
import type { LocationsResponse } from "@/types/locations";

import { listActiveLocations, type LocationsGateway } from "./location-service";

const LOCATION_ID = "LOCATION1";

function activeLocation(id = LOCATION_ID): Location {
  return { id, name: `Cafe ${id}`, status: "ACTIVE" };
}

function createCache() {
  return new AsyncTtlCache<LocationsResponse>();
}

describe("listActiveLocations", () => {
  it("maps active locations and serves the next call from cache", async () => {
    const listLocations = vi
      .fn<LocationsGateway["listLocations"]>()
      .mockResolvedValue([
        activeLocation(),
        { id: "CLOSED", name: "Closed", status: "INACTIVE" },
      ]);
    const cache = createCache();

    const first = await listActiveLocations({ listLocations }, cache);
    const second = await listActiveLocations({ listLocations }, cache);

    expect(first.locations).toHaveLength(1);
    expect(first.locations[0]?.id).toBe(LOCATION_ID);
    expect(second).toBe(first);
    expect(listLocations).toHaveBeenCalledOnce();
  });

  it("re-lists after the cache is invalidated", async () => {
    const listLocations = vi
      .fn<LocationsGateway["listLocations"]>()
      .mockResolvedValueOnce([activeLocation("FIRST")])
      .mockResolvedValueOnce([activeLocation("SECOND")]);
    const cache = createCache();

    const first = await listActiveLocations({ listLocations }, cache);
    cache.invalidateAll();
    const second = await listActiveLocations({ listLocations }, cache);

    expect(first.locations[0]?.id).toBe("FIRST");
    expect(second.locations[0]?.id).toBe("SECOND");
    expect(listLocations).toHaveBeenCalledTimes(2);
  });

  it("does not cache a gateway failure so the next call can recover", async () => {
    const listLocations = vi
      .fn<LocationsGateway["listLocations"]>()
      .mockRejectedValueOnce(new Error("fake-upstream"))
      .mockResolvedValueOnce([activeLocation()]);
    const cache = createCache();

    await expect(
      listActiveLocations({ listLocations }, cache),
    ).rejects.toThrow("fake-upstream");
    await expect(
      listActiveLocations({ listLocations }, cache),
    ).resolves.toMatchObject({ locations: [{ id: LOCATION_ID }] });
    expect(listLocations).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent calls into a single Square load", async () => {
    let resolveList!: (value: readonly Location[]) => void;
    const pending = new Promise<readonly Location[]>((resolve) => {
      resolveList = resolve;
    });
    const listLocations = vi.fn(() => pending);
    const cache = createCache();

    const firstRequest = listActiveLocations({ listLocations }, cache);
    const secondRequest = listActiveLocations({ listLocations }, cache);
    await Promise.resolve();

    expect(listLocations).toHaveBeenCalledOnce();
    resolveList([activeLocation()]);
    await expect(
      Promise.all([firstRequest, secondRequest]),
    ).resolves.toHaveLength(2);
  });
});
