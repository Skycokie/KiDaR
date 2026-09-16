import { Account, Client, Databases, Storage, Users } from "node-appwrite";
import { cookies } from "next/headers";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  SESSION_COOKIE
} from "./config";

export function createAdminClient() {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) throw new Error("APPWRITE_API_KEY is required");

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(apiKey);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
    users: new Users(client)
  };
}

export function createSessionClient(sessionSecret?: string) {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

  const secret = sessionSecret ?? cookies().get(SESSION_COOKIE)?.value;
  if (!secret) throw new Error("No Appwrite session");

  client.setSession(secret);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client)
  };
}

export async function getLoggedInUser() {
  try {
    const { account } = createSessionClient();
    return await account.get();
  } catch {
    return null;
  }
}
