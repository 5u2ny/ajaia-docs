import { test, expect, Page } from "@playwright/test";

/**
 * End-to-end tests for Ajaia Docs.
 *
 * These tests exercise the full user-facing contract:
 *   1. Login → create document → edit rich text → rename → refresh → persists
 *   2. Share a document from Alex to Maya → Maya sees it under "Shared with me"
 *
 * They run against a freshly-seeded SQLite DB via `npm run db:reset` (see
 * webServer config in playwright.config.ts). This means tests assume the
 * three seeded users (alex@demo.app, maya@demo.app, jordan@demo.app) exist.
 */

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Ajaia Docs — core flows", () => {
  test("login, create, edit rich text, rename, refresh persists", async ({
    page,
  }) => {
    await login(page, "alex@demo.app");

    // Create document
    await page.getByRole("button", { name: /new document/i }).click();
    await expect(page).toHaveURL(/\/documents\//);

    // Rename title
    const title = page.getByLabel("Document title");
    await title.fill("My test brief");

    // Write content with rich-text formatting
    const editor = page.locator(".tiptap");
    await editor.click();
    await editor.type("Hello world. ");

    // Apply Heading 1 to a new line
    await page.keyboard.press("Enter");
    await page.getByLabel("Heading 1").click();
    await editor.type("Section heading");

    // New paragraph with bullet list
    await page.keyboard.press("Enter");
    await page.getByLabel("Bullet list").click();
    await editor.type("first bullet");
    await page.keyboard.press("Enter");
    await editor.type("second bullet");

    // Wait for autosave to settle — our debounce is 1s, give it a buffer.
    await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 10_000 });

    // Reload and confirm everything persisted
    await page.reload();
    await expect(page.getByLabel("Document title")).toHaveValue(
      "My test brief"
    );
    const html = await page.locator(".tiptap").innerHTML();
    expect(html).toContain("Hello world");
    expect(html).toMatch(/<h1[^>]*>Section heading<\/h1>/);
    expect(html).toContain("first bullet");
    expect(html).toContain("second bullet");

    // Back to dashboard — doc should appear in "Your documents".
    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("My test brief")).toBeVisible();
  });

  test("share a document with another seeded user; recipient can open it", async ({
    page,
    context,
  }) => {
    // Alex creates a doc
    await login(page, "alex@demo.app");
    await page.getByRole("button", { name: /new document/i }).click();
    await expect(page).toHaveURL(/\/documents\//);
    const docUrl = page.url();

    await page.getByLabel("Document title").fill("Shared with Maya");
    await page.locator(".tiptap").click();
    await page.keyboard.type("This is for Maya.");
    await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 10_000 });

    // Open share modal, add Maya
    await page.getByRole("button", { name: /^share$/i }).click();
    await page
      .getByPlaceholder("someone@demo.app")
      .fill("maya@demo.app");
    await page.getByRole("button", { name: /^share$/i }).last().click();
    await expect(page.getByText("maya@demo.app")).toBeVisible();

    // Log Alex out
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Maya logs in on the same browser context (fresh session).
    // Use a new browser context to fully simulate a different user.
    const mayaPage = await context.newPage();
    await login(mayaPage, "maya@demo.app");

    // Shared doc visible under "Shared with me"
    await expect(mayaPage.getByText("Shared with Maya")).toBeVisible();

    // Maya can open the doc directly via URL
    await mayaPage.goto(docUrl);
    await expect(mayaPage.getByLabel("Document title")).toHaveValue(
      "Shared with Maya"
    );
    await expect(mayaPage.locator(".tiptap")).toContainText("This is for Maya");
  });

  test("unauthorized user cannot access a doc they don't own or share", async ({
    page,
    context,
  }) => {
    // Alex creates a private doc
    await login(page, "alex@demo.app");
    await page.getByRole("button", { name: /new document/i }).click();
    const privateUrl = page.url();
    await page.getByLabel("Document title").fill("Alex private notes");
    await page.locator(".tiptap").click();
    await page.keyboard.type("Private content.");
    await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 10_000 });

    // Jordan (another seeded user) tries to access directly
    const jordanPage = await context.newPage();
    await login(jordanPage, "jordan@demo.app");
    await jordanPage.goto(privateUrl);
    await expect(jordanPage).toHaveURL(/\/unauthorized/);
    await expect(jordanPage.getByText(/Access denied/i)).toBeVisible();
  });
});
