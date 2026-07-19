// Next's standalone output ships server.js plus a trimmed node_modules, but it
// deliberately leaves static assets out of the bundle. The Dockerfile copies
// them in as a separate layer; this mirrors that step so `pnpm start` and the
// E2E suite serve the same artifact production does, rather than `next start`,
// which Next warns is not compatible with `output: "standalone"`.
import { access, cp } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

const exists = async (path) => access(path).then(() => true, () => false);

if (!(await exists(standalone))) {
  throw new Error(
    "Missing .next/standalone. Run `pnpm build` before starting the server.",
  );
}

await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});

// `public/` is optional; this project has no static assets there today.
if (await exists(join(root, "public"))) {
  await cp(join(root, "public"), join(standalone, "public"), {
    recursive: true,
  });
}
