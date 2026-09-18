import { test, expect } from "@playwright/test";

// axe-core is not a repo dependency. These tests cover semantics, copy,
// 48px targets, and focus; they do not claim an automated axe run.

async function signIn(page: import("@playwright/test").Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kidar.local`;
  const response = await page.request.post("/api/auth/e2e-session", {
    data: { email }
  });
  expect(response.ok()).toBeTruthy();
}

async function minHeight(locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);
}

test("marketing page is Romanian and does not claim live phone AR", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fă o pagină să prindă viață." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Creează o surpriză" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Intră în Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Povești care prind viață" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desene care ies din foaie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Misiuni și escape rooms" })).toBeVisible();
  await expect(page.getByText("Fără aplicație de instalat")).toBeVisible();
  await expect(page.getByText(/urmează/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Creează o surpriză" })).toHaveAttribute(
    "href",
    "/intra"
  );
  await minHeight(page.getByRole("link", { name: "Creează o surpriză" }));
});

test("Romanian entry has a visible email label and status copy", async ({ page }) => {
  await page.goto("/intra");
  await expect(page.getByRole("heading", { name: "Intră în kidAR" })).toBeVisible();
  await expect(page.getByText("Folosești doar adresa de email. Fără parolă.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trimite legătura de intrare" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Am deja un cont Studio (English)" })).toHaveAttribute(
    "href",
    "/login"
  );
  await minHeight(page.getByRole("button", { name: "Trimite legătura de intrare" }));

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Trimite legătura de intrare" }).click();
  await expect(page.locator(".creaza-error")).toContainText("Nu am putut trimite emailul");
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("authenticated Simple Creator creates a project with preset and popout mode", async ({
  page
}) => {
  await signIn(page);
  await page.goto("/creaza");
  await expect(page.getByText("Pasul 1 din 5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce vrei să prindă viață?" })).toBeVisible();

  const coloring = page.getByRole("button", { name: /Colorat/ });
  const story = page.getByRole("button", { name: /Poveste/ });
  const mission = page.getByRole("button", { name: /Misiune/ });
  await expect(coloring).toBeVisible();
  await expect(story).toBeVisible();
  await expect(mission).toBeVisible();
  await expect(coloring).toHaveAttribute("aria-pressed", "false");
  await coloring.click();
  await expect(coloring).toHaveAttribute("aria-pressed", "true");
  await expect(story).toHaveAttribute("aria-pressed", "false");
  await minHeight(coloring);
  await minHeight(page.getByRole("button", { name: "Continuă" }));

  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page).toHaveURL(/\/creaza\/[a-zA-Z0-9]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Am salvat alegerea ta" })).toBeVisible();
  await expect(page.getByText(/nu am pregătit încă/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Trimite pe email" })).toHaveCount(0);
  await expect(page.locator('a[href*="/ar/"]')).toHaveCount(0);

  const listed = await page.request.get("/api/projects");
  expect(listed.ok()).toBeTruthy();
  const body = (await listed.json()) as {
    projects: Array<{ mode: string; name: string; settings: { preset?: string } }>;
  };
  const created = body.projects.find((project) => project.settings?.preset === "coloring");
  expect(created?.mode).toBe("popout");
  expect(created?.name).toMatch(/^Surpriza din /);
});

test("English dashboard remains reachable from Simple Creator", async ({ page }) => {
  await signIn(page);
  await page.goto("/creaza");
  await expect(page.getByRole("heading", { name: "Ce vrei să prindă viață?" })).toBeVisible();
  await page.locator('a.creaza-btn-secondary[href="/dashboard"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "kidAR Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create project" })).toBeVisible();
});
