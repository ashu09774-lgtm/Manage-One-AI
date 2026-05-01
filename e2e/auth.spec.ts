import { test, expect } from "@playwright/test"

test.describe("Authentication and Navigation", () => {
  test("user can navigate to login page from landing page", async ({ page }) => {
    // Navigate to the landing page
    await page.goto("/")

    // Expect the title to contain "TaskFlow AI"
    await expect(page).toHaveTitle(/TaskFlow AI/i)

    // Find the login link and click it
    const loginLink = page.getByRole("link", { name: "Log in" })
    await loginLink.click()

    // Expect the URL to be /login
    await expect(page).toHaveURL(/.*\/login/)

    // Expect the login form to be visible
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    await expect(page.getByLabel("Email address")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  })

  test("shows error on invalid login", async ({ page }) => {
    await page.goto("/login")

    // Fill in invalid credentials
    await page.getByLabel("Email address").fill("invalid@example.com")
    await page.getByLabel("Password").fill("wrongpassword")

    // Click submit
    await page.getByRole("button", { name: "Sign in" }).click()

    // Expect an error message (could be "Invalid credentials" or similar depending on the exact implementation)
    // Wait for the response and error message to appear
    await expect(page.locator("text=Invalid email or password").or(page.locator("text=Could not sign in"))).toBeVisible()
  })
})
