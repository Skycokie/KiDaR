export class PublicStorageConfigError extends Error {
  readonly code = "PUBLIC_STORAGE_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "PublicStorageConfigError";
  }
}
