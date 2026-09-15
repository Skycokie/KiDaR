import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54334";

async function waitForMagicLink(request: {
  get(url: string): Promise<{ ok(): boolean; json(): Promise<any> }>;
}, email: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request.get(`${mailpitUrl}/api/v1/search?query=to:${email}`);
    if (response.ok()) {
      const result = await response.json();
      const message = result.messages?.[0];
      if (message?.ID) {
        const detail = await request.get(`${mailpitUrl}/api/v1/message/${message.ID}`);
        const body = await detail.json();
        const link = `${body.Text ?? ""} ${body.HTML ?? ""}`.match(
          /https?:\/\/[^"'\s<>]+\/auth\/v1\/verify\?token=[^"'\s<>]+/
        )?.[0];
        if (link) return link;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Magic link was not delivered for ${email}`);
}

async function signIn(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  const email = `e2e-${Date.now()}@kidar.local`;
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await waitForMagicLink(request, email));
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("signup, create project, upload source drawing, and list it", async ({ page, request }) => {
  const projectName = `E2E Drawing ${Date.now()}`;
  const projectSlug = projectName.toLowerCase().replaceAll(" ", "-");

  await signIn(page, request);

  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(`/${projectSlug}`)).toBeVisible();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-real-png")
  });
  await expect(page.getByRole("status")).toContainText("Drawing uploaded");

  const projects = await page.request.get("/api/projects");
  expect(projects.ok()).toBeTruthy();
  const project = (await projects.json()).projects.find(
    (candidate: { name: string }) => candidate.name === projectName
  );
  expect(project?.source_image_path).toMatch(
    /^[0-9a-f-]+\/[0-9a-f-]+\/source\.png$/
  );
});

test("persists gallery selection and transform settings after reload", async ({ page, request }) => {
  await signIn(page, request);
  const projectName = `Gallery Drawing ${Date.now()}`;

  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(`/${projectName.toLowerCase().replaceAll(" ", "-")}`)).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-real-png")
  });
  await expect(page.getByRole("status")).toContainText("Drawing uploaded");

  await page.route("**/api/gallery?query=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        models: [{ id: "rocket", name: "Rocket", thumbnailUrl: null, glbUrl: "https://cdn.example/rocket.glb" }]
      })
    });
  });
  await page.getByRole("link", { name: "Open studio" }).click();
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

test("real photo pop-out uses foreground coverage and silhouette bounds", async ({ page, request }) => {
  test.setTimeout(180_000);
  await signIn(page, request);
  const projectName = `Real Photo ${Date.now()}`;

  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(`/${projectName.toLowerCase().replaceAll(" ", "-")}`)).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "test-photo.jpg",
    mimeType: "image/jpeg",
    buffer: readFileSync(resolve("e2e/fixtures/test-photo.jpg"))
  });
  await expect(page.getByRole("status")).toContainText("Drawing uploaded");

  await page.getByRole("link", { name: "Open studio" }).click();
  const statsOutput = page.getByTestId("popout-stats");
  await expect(statsOutput).toBeVisible({ timeout: 150_000 });
  const stats = JSON.parse(await statsOutput.textContent() ?? "{}") as {
    coverage: number;
    vertexCount: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
  const boundsWidth = stats.bounds.maxX - stats.bounds.minX;
  const boundsHeight = stats.bounds.maxY - stats.bounds.minY;

  console.log(`REAL PHOTO POP-OUT ${JSON.stringify({ ...stats, boundsWidth, boundsHeight })}`);
  expect(stats.coverage).toBeLessThan(0.4);
  expect(stats.vertexCount).toBeGreaterThan(4);
  expect(boundsWidth).toBeLessThan(0.9);
  expect(boundsHeight).toBeLessThan(0.9);
  expect(stats.bounds.minX).toBeGreaterThan(-0.5);
  expect(stats.bounds.maxX).toBeLessThan(0.5);
  expect(stats.bounds.minY).toBeGreaterThan(-0.5);
  expect(stats.bounds.maxY).toBeLessThan(0.5);

  await page.screenshot({ path: "test-results/popout-real.png", fullPage: true });
});
