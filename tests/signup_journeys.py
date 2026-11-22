"""Run with python3 tests/signup_journeys.py against the running Vite preview.

Tests navigation and form interaction, without creating accounts or sending emails.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUTPUT = Path("/tmp/browser/signup-journeys")


async def check_signup(page, parent=False):
    path = "/parent-auth" if parent else "/auth"
    await expect(page).to_have_url(f"{ORIGIN}{path}?view=signup")
    await expect(page.get_by_role("tab", name="Sign Up", exact=True)).to_have_attribute("aria-selected", "true")
    await expect(page.get_by_label("Your Name" if parent else "Username", exact=True)).to_be_visible()
    submit = page.get_by_role("button", name="Create Parent Account" if parent else "Create Account", exact=True)
    await expect(submit).to_be_disabled()
    await page.get_by_label("Your Name" if parent else "Username", exact=True).fill("Signup journey check")
    await page.get_by_label("Email", exact=True).fill("journey-check@example.com")
    await page.get_by_label("Password", exact=True).fill("short")
    await page.get_by_role("checkbox").check()
    await expect(submit).to_be_enabled()
    await submit.click()
    await expect(page.get_by_text("Password must be at least 6 characters", exact=True)).to_be_visible()
    await page.reload()
    await expect(page.get_by_role("tab", name="Sign Up", exact=True)).to_have_attribute("aria-selected", "true")
    assert "noindex" in (await page.locator('meta[name="robots"]').get_attribute("content"))
    await page.screenshot(path=str(OUTPUT / ("parent.png" if parent else "student.png")))
    await page.get_by_role("tab", name="Sign In", exact=True).click()
    await expect(page).to_have_url(f"{ORIGIN}{path}?view=signin")
    await page.go_back()
    await expect(page.get_by_role("tab", name="Sign Up", exact=True)).to_have_attribute("aria-selected", "true")


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width, height in [(1280, 1800), (390, 844)]:
            context = await browser.new_context(viewport={"width": width, "height": height})
            page = await context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            entries = [
                ("/", "Start 7-Day Free Trial", False, 0),
                ("/pricing", "Start Free Trial", False, 0),
                ("/pricing", "Start Free Trial", False, 1),
                ("/pricing", "Subscribe as Parent", True, 0),
                ("/pricing", "Parent Sign Up", True, 0),
                ("/how-it-works", "Get Started Free", False, 0),
            ]
            for route, button, parent, index in entries:
                await page.goto(ORIGIN + route)
                await page.get_by_role("button", name=button, exact=True).nth(index).click()
                await check_signup(page, parent)
                print(f"PASS {width}px {route} {button} #{index + 1}")
            for route in ["/auth", "/parent-auth"]:
                for suffix in ["", "?view=invalid"]:
                    await page.goto(ORIGIN + route + suffix)
                    await expect(page.get_by_role("tab", name="Sign In", exact=True)).to_have_attribute("aria-selected", "true")
                await page.goto(ORIGIN + route + "?view=signup&source=check")
                await page.get_by_role("tab", name="Sign In", exact=True).click()
                assert "source=check" in page.url
                await page.get_by_role("button", name="Forgot your password?", exact=True).click()
                await expect(page.get_by_role("button", name="Send Reset Link", exact=True)).to_be_visible()
                await page.get_by_role("button", name="Back to Sign In", exact=True).click()
                await expect(page.get_by_role("tab", name="Sign In", exact=True)).to_have_attribute("aria-selected", "true")
            assert not errors, errors
            await context.close()
        await browser.close()


asyncio.run(main())