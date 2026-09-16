/**
 * Ambient typings for MindAR OfflineCompiler ESM entry used by the worker.
 * The package ships JS under src/ without complete TS declarations for this path.
 */
declare module "mind-ar/src/image-target/offline-compiler.js" {
  export class OfflineCompiler {
    compileImageTargets(
      images: unknown[],
      progressCallback: (percent: number) => void
    ): Promise<unknown>;
    exportData(): Uint8Array;
    importData(buffer: ArrayBuffer | Uint8Array): unknown[];
  }
}
