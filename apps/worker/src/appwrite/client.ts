import { Client, Databases, Storage } from "node-appwrite";

export function createWorkerAppwrite() {
  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    "https://fra.cloud.appwrite.io/v1";
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error("APPWRITE_API_KEY and Appwrite project id are required for the worker");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    client,
    databases: new Databases(client),
    storage: new Storage(client),
    databaseId: process.env.APPWRITE_DATABASE_ID || "kidar",
    jobsCollection: process.env.APPWRITE_JOBS_COLLECTION || "jobs",
    projectsCollection: process.env.APPWRITE_PROJECTS_COLLECTION || "projects",
    sourceBucket: process.env.APPWRITE_SOURCE_BUCKET || "source-drawings"
  };
}
