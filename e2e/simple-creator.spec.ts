import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const photoFixture = resolve("e2e/fixtures/test-photo.jpg");

async function signIn(page: import("@playwright/test").Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kidar.local`;
  const response = await page.request.post("/api/auth/e2e-session", {
    data: { email }
  });
  expect(response.ok()).toBeTruthy();
}

async function createCreatorProject(
  page: import("@playwright/test").Page,
  preset: "coloring" | "story" | "mission" = "coloring"
) {
  await signIn(page);
  const created = await page.request.post("/api/projects", {
    data: { name: `Surpriza test ${Date.now()}`, mode: "popout", settings: { preset } }
  });
  expect(created.ok()).toBeTruthy();
  const body = (await created.json()) as { project: { id: string } };
  return body.project.id;
}

async function minHeight(locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);
}

test("editorial homepage is Romanian with auth-aware CTAs for guests", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Desenul tău prinde viață." })).toBeVisible();
  await expect(page.getByText("kiDAR", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Descoperă kiDAR" })).toHaveAttribute("href", "/intra");
  await expect(page.getByRole("link", { name: "Intră în Studio" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("heading", { name: "Desenează" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fotografiază" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Descoperă" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Intră în kiDAR" })).toHaveAttribute("href", "/intra");
  await minHeight(page.getByRole("link", { name: "Descoperă kiDAR" }));
});

test("editorial homepage sends signed-in users to Atelier and Studio preview", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Desenul tău prinde viață." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Descoperă kiDAR" })).toHaveAttribute("href", "/creaza");
  await expect(page.getByRole("link", { name: "Intră în Studio" })).toHaveAttribute(
    "href",
    "/studio-preview/personalizeaza"
  );
});

test("Romanian entry has a visible email label and status copy", async ({ page }) => {
  await page.goto("/intra");
  await expect(page.getByRole("heading", { name: "Intră în kiDAR" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trimite legătura de intrare" })).toBeVisible();
  await minHeight(page.getByRole("button", { name: "Trimite legătura de intrare" }));
});

test("authenticated /creaza shows Atelier 4-step shell and creates a world", async ({ page }) => {
  await signIn(page);
  await page.goto("/creaza");
  await expect(page.getByRole("heading", { name: "Cu ce începe lumea?" })).toBeVisible();
  await expect(page.getByRole("list", { name: /Progres/i })).toBeVisible();
  await expect(page.getByText("1 / 4").first()).toBeVisible();

  const coloring = page.getByRole("option", { name: /desen colorat/i });
  await coloring.click();
  await expect(coloring).toHaveAttribute("aria-selected", "true");
  await minHeight(page.getByRole("button", { name: "Începe lumea" }));

  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/projects") &&
      response.request().method() === "POST" &&
      response.ok()
  );
  await page.getByRole("button", { name: "Începe lumea" }).click();
  expect((await createdResponse).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Așază poza pe masă" })).toBeVisible({
    timeout: 20_000
  });
});

test("Atelier foto step uploads JPG and continues to scene", async ({ page }) => {
  await signIn(page);
  await page.goto("/creaza");
  await page.getByRole("option", { name: /desen colorat/i }).click();
  await page.getByRole("button", { name: "Începe lumea" }).click();
  await expect(page.getByRole("heading", { name: "Așază poza pe masă" })).toBeVisible({
    timeout: 20_000
  });

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(photoFixture);
  await page.getByRole("button", { name: /Salvează poza/i }).click();
  await expect(page.getByRole("heading", { name: "Cum vrei să prindă viață?" })).toBeVisible({
    timeout: 30_000
  });
});

test("Atelier scene save reaches confirmation and Studio link", async ({ page }) => {
  await signIn(page);
  await page.goto("/creaza");
  await page.getByRole("option", { name: /desen colorat/i }).click();
  await page.getByRole("button", { name: "Începe lumea" }).click();
  await expect(page.getByRole("heading", { name: "Așază poza pe masă" })).toBeVisible({
    timeout: 20_000
  });
  await page.locator('input[type="file"]').first().setInputFiles(photoFixture);
  await page.getByRole("button", { name: /Salvează poza/i }).click();
  await expect(page.getByRole("heading", { name: "Cum vrei să prindă viață?" })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: /Iese din pagină/i }).click();
  await page.getByRole("button", { name: /Salvează scena/i }).click();
  await expect(
    page.getByRole("heading", { name: /Lumea e gata de personalizat/i })
  ).toBeVisible({ timeout: 20_000 });
  const studioLink = page.getByRole("link", { name: "Deschide Studio" });
  await expect(studioLink).toBeVisible();
  await expect(studioLink).toHaveAttribute(
    "href",
    /\/studio-preview\/personalizeaza\?projectId=/
  );
});

test("legacy creaza step URLs redirect into Atelier / Studio", async ({ page }) => {
  const projectId = await createCreatorProject(page);
  await page.goto(`/creaza/${projectId}/foto`);
  await expect(page).toHaveURL(/\/creaza$/, { timeout: 20_000 });
  await page.goto(`/creaza/${projectId}/experienta`);
  await expect(page).toHaveURL(/\/creaza$/, { timeout: 20_000 });
  await page.goto(`/creaza/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/studio/${projectId}`), { timeout: 20_000 });
});

test("authenticated /intra continues to /creaza; /login goes to Studio hub", async ({ page }) => {
  await signIn(page);
  await page.goto("/intra");
  await expect(page).toHaveURL(/\/creaza$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cu ce începe lumea?" })).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });
});

test("unauthenticated Studio login is Romanian", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("kiDAR Studio")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intră în kiDAR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trimite legătura de intrare" })).toBeVisible();
});

test("preview routes redirect to official paths", async ({ page }) => {
  await signIn(page);
  await page.goto("/creaza-preview");
  await expect(page).toHaveURL(/\/creaza$/, { timeout: 20_000 });
  await page.goto("/studio-preview");
  await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });
});

test("advanced Studio project page still opens for an existing world", async ({ page }) => {
  const projectId = await createCreatorProject(page);
  await page.goto(`/studio/${projectId}`);
  await expect(page.getByRole("button", { name: "Publish experience" })).toBeVisible({
    timeout: 20_000
  });
});
