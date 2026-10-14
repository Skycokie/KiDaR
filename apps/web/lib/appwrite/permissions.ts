import { Permission, Role } from "node-appwrite";

/**
 * Owner may only read. Every write goes through a server route that checks
 * ownership and then uses the admin client; otherwise a user could call
 * Appwrite directly with their session and edit plan, status, or job payloads.
 */
export function ownerReadOnlyPermissions(userId: string): string[] {
  return [Permission.read(Role.user(userId))];
}
