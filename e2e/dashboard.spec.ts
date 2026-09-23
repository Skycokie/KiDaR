import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function signIn(page: import("@playwright/test").Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kidar.local`;
  const response = await page.request.post("/api/auth/e2e-session", {
    data: { email }
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });
}

async function createProject(page: import("@playwright/test").Page, name: string) {
  const created = await page.request.post("/api/projects", {
    data: { name, mode: "popout", settings: { preset: "coloring" } }
  });
  expect(created.ok()).toBeTruthy();
  const body = (await created.json()) as { project: { id: string; slug: string } };
  return body.project;
}

test("/dashboard redirects to Studio hub", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });
});

test("signup, create project via API, upload source, and open Studio editor", async ({ page }) => {
  const projectName = `E2E Drawing ${Date.now()}`;
  await signIn(page);
  const project = await createProject(page, projectName);

  const upload = await page.request.post(`/api/projects/${project.id}/source`, {
    multipart: {
      file: {
        name: "source.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        )
      }
    }
  });
  expect(upload.ok()).toBeTruthy();

  await page.goto(`/studio/${project.id}`);
  await expect(page.getByRole("button", { name: "Publish experience" })).toBeVisible({
    timeout: 20_000
  });

  const projects = await page.request.get("/api/projects");
  expect(projects.ok()).toBeTruthy();
  const listed = (await projects.json()).projects.find(
    (candidate: { name: string }) => candidate.name === projectName
  );
  expect(listed?.source_image_path).toMatch(/^src_/);
});

test("persists gallery selection and transform settings after reload", async ({ page }) => {
  await signIn(page);
  const project = await createProject(page, `Gallery Drawing ${Date.now()}`);
  await page.request.post(`/api/projects/${project.id}/source`, {
    multipart: {
      file: {
        name: "source.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        )
      }
    }
  });

  await page.route("**/api/gallery?query=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          { id: "rocket", name: "Rocket", thumbnailUrl: null, glbUrl: "https://cdn.example/rocket.glb" }
        ]
      })
    });
  });

  await page.goto(`/studio/${project.id}`);
  await page.getByRole("button", { name: "Gallery" }).click();
  await page.getByLabel("Search Poly Pizza").fill("rocket");
  await expect(page.getByTestId("gallery-model-rocket")).toBeVisible();
  await page.getByTestId("gallery-model-rocket").click();
  await page.locator("#scale").fill("1.75");
  await expect(page.getByText(/Saved|Save failed/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await page.getByLabel("Search Poly Pizza").fill("rocket");
  await expect(page.getByTestId("gallery-model-rocket")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#scale")).toHaveValue("1.75");
});

test("real photo pop-out uses foreground coverage and silhouette bounds", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);
  const project = await createProject(page, `Real Photo ${Date.now()}`);
  await page.request.post(`/api/projects/${project.id}/source`, {
    multipart: {
      file: {
        name: "test-photo.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync(resolve("e2e/fixtures/test-photo.jpg"))
      }
    }
  });

  await page.goto(`/studio/${project.id}`);
  const statsOutput = page.getByTestId("popout-stats");
  await expect(statsOutput).toBeVisible({ timeout: 150_000 });
  const stats = JSON.parse((await statsOutput.textContent()) ?? "{}") as {
    coverage: number;
    vertexCount: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
  const boundsWidth = stats.bounds.maxX - stats.bounds.minX;
  const boundsHeight = stats.bounds.maxY - stats.bounds.minY;

  expect(stats.coverage).toBeLessThan(0.4);
  expect(stats.vertexCount).toBeGreaterThan(4);
  expect(boundsWidth).toBeLessThan(0.9);
  expect(boundsHeight).toBeLessThan(0.9);
});

test("studio hides QR and PDF until publish is ready", async ({ page }) => {
  await signIn(page);
  const project = await createProject(page, `Publish Draft ${Date.now()}`);
  await page.goto(`/studio/${project.id}`);
  await expect(page.getByRole("button", { name: "Publish experience" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download QR" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
});

test("anonymous /ar slug is 404 without a public mapping", async ({ page }) => {
  const response = await page.goto("/ar/no-public-mapping-yet");
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/experiența nu este publică încă/i)).toBeVisible();
});
