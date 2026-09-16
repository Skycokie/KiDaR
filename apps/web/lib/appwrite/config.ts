export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6aaa61b4000e4035f26e";

export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? "kidar";
export const APPWRITE_PROFILES_COLLECTION =
  process.env.APPWRITE_PROFILES_COLLECTION ?? "profiles";
export const APPWRITE_PROJECTS_COLLECTION =
  process.env.APPWRITE_PROJECTS_COLLECTION ?? "projects";
export const APPWRITE_JOBS_COLLECTION = process.env.APPWRITE_JOBS_COLLECTION ?? "jobs";
export const APPWRITE_SCAN_EVENTS_COLLECTION =
  process.env.APPWRITE_SCAN_EVENTS_COLLECTION ?? "scan_events";

export const APPWRITE_SOURCE_BUCKET =
  process.env.APPWRITE_SOURCE_BUCKET ?? "source-drawings";
// Free plan allows one bucket — reuse the source bucket for studio assets.
export const APPWRITE_ASSETS_BUCKET =
  process.env.APPWRITE_ASSETS_BUCKET ?? APPWRITE_SOURCE_BUCKET;

export const SESSION_COOKIE = `a_session_${APPWRITE_PROJECT_ID}`;
