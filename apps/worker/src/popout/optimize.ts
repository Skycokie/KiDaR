import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld } from "@gltf-transform/functions";

export type OptimizeReport = {
  operations: string[];
  rawBytes: number;
  optimizedBytes: number;
};

/**
 * Optimize with transforms available without optional encoders.
 * Skips Draco/WebP/meshopt — those need encoders not installed in this repo.
 */
export async function optimizeGlb(raw: Uint8Array): Promise<{
  bytes: Uint8Array;
  report: OptimizeReport;
}> {
  const operations = ["dedup", "weld", "prune"];
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(raw);
  await document.transform(dedup(), weld(), prune());
  const optimized = await io.writeBinary(document);
  return {
    bytes: optimized,
    report: {
      operations,
      rawBytes: raw.byteLength,
      optimizedBytes: optimized.byteLength
    }
  };
}
