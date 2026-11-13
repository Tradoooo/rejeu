import { defineConfig } from "vitest/config";

// Les propriétés fast-check tournent avec la même graine que la CI
// (REJEU_SEED) : un contre-exemple doit être reproductible à l'identique.
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ["default"],
  },
});
