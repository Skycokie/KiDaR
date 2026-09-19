import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// axe-core is not a repo dependency. These tests cover semantics, copy,
// 48px targets, and focus; they do not claim an automated axe run.

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

test("authenticated Simple Creator creates a project and opens the photo step", async ({
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
  await expect(page).toHaveURL(/\/creaza\/[a-zA-Z0-9]+\/foto$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Fotografiază pagina" })).toBeVisible();
  await expect(page.getByText("Pasul 2 din 5")).toBeVisible();
  await expect(page.getByText("Nu fotografia un ecran.")).toBeVisible();
  await minHeight(page.getByRole("button", { name: "Fotografiază" }));
  await minHeight(page.getByRole("button", { name: "Alege din pozele telefonului" }));

  const listed = await page.request.get("/api/projects");
  expect(listed.ok()).toBeTruthy();
  const body = (await listed.json()) as {
    projects: Array<{ mode: string; name: string; settings: { preset?: string } }>;
  };
  const created = body.projects.find((project) => project.settings?.preset === "coloring");
  expect(created?.mode).toBe("popout");
  expect(created?.name).toMatch(/^Surpriza din /);
});

test("photo step uploads a private JPG and rejects invalid files", async ({ page }) => {
  const projectId = await createCreatorProject(page, "coloring");
  const publishCalls: string[] = [];
  await page.route("**/api/publish**", async (route) => {
    publishCalls.push(route.request().url());
    await route.abort();
  });

  await page.goto(`/creaza/${projectId}/foto`);
  await expect(page.getByRole("heading", { name: "Fotografiază pagina" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Înapoi" })).toBeVisible();

  const library = page.locator("#creaza-library");
  await expect(library).toHaveAttribute("accept", "image/jpeg,image/png");
  await expect(library).not.toHaveAttribute("capture");
  await expect(page.locator("#creaza-camera")).toHaveAttribute("capture", "environment");

  await library.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image")
  });
  await expect(page.locator(".creaza-error")).toContainText(
    "Putem folosi doar fotografii JPG sau PNG, până la 10 MB."
  );
  await expect(page.locator(".creaza-error")).toBeFocused();

  await library.setInputFiles(photoFixture);
  await expect(page.getByAltText("Pagina fotografiată")).toBeVisible();
  await expect(page.getByText("Se vede pagina întreagă")).toBeVisible();
  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page).toHaveURL(new RegExp(`/creaza/${projectId}/experienta$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cum vrei să prindă viață?" })).toBeVisible();
  expect(publishCalls).toEqual([]);

  const listed = await page.request.get("/api/projects");
  const project = (
    (await listed.json()) as { projects: Array<{ id: string; source_image_path?: string }> }
  ).projects.find((item) => item.id === projectId);
  expect(project?.source_image_path).toMatch(/^src_/);
});

test("pop-out choice persists mode and keeps the honest placeholder", async ({ page }) => {
  const projectId = await createCreatorProject(page, "story");
  await page.goto(`/creaza/${projectId}/experienta`);
  await expect(page.getByText("Pasul 3 din 5")).toBeVisible();
  const popout = page.getByRole("button", { name: /Iese din pagină/ });
  await expect(popout).toHaveAttribute("aria-pressed", "true");
  await minHeight(popout);
  await expect(page.getByLabel("Mesaj pentru participanți (opțional)")).toHaveCount(0);

  const publishCalls: string[] = [];
  await page.route("**/api/publish**", async (route) => {
    publishCalls.push(route.request().url());
    await route.fulfill({ status: 500, body: "{}" });
  });

  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page).toHaveURL(new RegExp(`/creaza/${projectId}$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Am salvat alegerea ta" })).toBeVisible();
  await expect(page.getByText(/pregătirea experienței va fi disponibilă/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Trimite pe email" })).toHaveCount(0);
  await expect(page.locator('a[href*="/ar/"]')).toHaveCount(0);
  expect(publishCalls).toEqual([]);

  const listed = await page.request.get("/api/projects");
  const project = (
    (await listed.json()) as {
      projects: Array<{ id: string; mode: string; settings: { preset?: string } }>;
    }
  ).projects.find((item) => item.id === projectId);
  expect(project?.mode).toBe("popout");
  expect(project?.settings.preset).toBe("story");
});

test("gallery choice persists mode using existing gallery data", async ({ page }) => {
  const projectId = await createCreatorProject(page, "coloring");
  await page.route("**/api/gallery?query=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          {
            id: "dragon-1",
            name: "Dragon prietenos",
            thumbnailUrl: null,
            glbUrl: "https://cdn.example/dragon.glb"
          }
        ]
      })
    });
  });

  await page.goto(`/creaza/${projectId}/experienta`);
  await page.getByRole("button", { name: /Alege o figurină/ }).click();
  await expect(page.getByRole("button", { name: /Alege o figurină/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: "Dragon prietenos" })).toBeVisible();
  await page.getByRole("button", { name: "Dragon prietenos" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page).toHaveURL(new RegExp(`/creaza/${projectId}$`), { timeout: 20_000 });

  const listed = await page.request.get("/api/projects");
  const project = (
    (await listed.json()) as {
      projects: Array<{
        id: string;
        mode: string;
        settings: { preset?: string; galleryModelUrl?: string };
      }>;
    }
  ).projects.find((item) => item.id === projectId);
  expect(project?.mode).toBe("gallery");
  expect(project?.settings.preset).toBe("coloring");
  expect(project?.settings.galleryModelUrl).toBe("https://cdn.example/dragon.glb");
});

test("mission shows the optional message and stores ctaText", async ({ page }) => {
  const projectId = await createCreatorProject(page, "mission");
  await page.goto(`/creaza/${projectId}/experienta`);
  const message = page.getByLabel("Mesaj pentru participanți (opțional)");
  await expect(message).toBeVisible();
  await expect(page.getByText("Caută cheia roșie lângă hartă.")).toBeVisible();
  await message.fill("Caută cheia roșie lângă hartă.");
  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page).toHaveURL(new RegExp(`/creaza/${projectId}$`), { timeout: 20_000 });

  const listed = await page.request.get("/api/projects");
  const project = (
    (await listed.json()) as {
      projects: Array<{
        id: string;
        mode: string;
        settings: { preset?: string; ctaText?: string };
      }>;
    }
  ).projects.find((item) => item.id === projectId);
  expect(project?.mode).toBe("popout");
  expect(project?.settings.preset).toBe("mission");
  expect(project?.settings.ctaText).toBe("Caută cheia roșie lângă hartă.");
});

test("advanced link opens existing English Studio", async ({ page }) => {
  const projectId = await createCreatorProject(page);
  await page.goto(`/creaza/${projectId}/experienta`);
  await page.getByRole("link", { name: "Opțiuni avansate în Studio" }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/${projectId}`), { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Publish experience" })).toBeVisible();
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
