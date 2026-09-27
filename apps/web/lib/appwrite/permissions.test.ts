import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ownerReadOnlyPermissions } from "./permissions";

const read = (file: string) => readFileSync(join(__dirname, file), "utf8");

describe("appwrite owner permissions", () => {
  it("grants the owner read access only", () => {
    expect(ownerReadOnlyPermissions("user123")).toEqual(['read("user:user123")']);
  });

  it("never grants users update or delete on documents or files", () => {
    for (const file of ["db.ts", "jobs.ts", "storage.ts"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/Permission\.(update|delete|write)\(/);
    }
  });

  it("writes documents and files with the admin client only", () => {
    const db = read("db.ts");
    const storage = read("storage.ts");
    const writeCall = /(createDocument|updateDocument|deleteDocument|createFile|deleteFile)\(/;
    for (const [name, source] of [
      ["db.ts", db],
      ["storage.ts", storage]
    ] as const) {
      for (const block of source.split(/\nexport async function |\nasync function /).slice(1)) {
        if (!writeCall.test(block)) continue;
        expect(block, `${name}: ${block.slice(0, 40)}`).toContain("createAdminClient()");
        expect(block, `${name}: ${block.slice(0, 40)}`).not.toContain("createSessionClient(");
      }
    }
  });
});
