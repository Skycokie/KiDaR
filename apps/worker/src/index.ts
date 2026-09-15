export interface AI3DProvider {
  generateModel(input: {
    imagePath: string;
  }): Promise<{ glbPath: string }>;
}

export function getOptionalAI3DProvider(): AI3DProvider | null {
  return process.env.AI3D_API_KEY ? null : null;
}

export async function runWorkerOnce(): Promise<void> {
  // M1 only establishes the worker boundary. Job processing arrives in M4.
}
