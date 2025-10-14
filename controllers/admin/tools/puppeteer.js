// puppeteer.js
import puppeteer from "puppeteer-core";

const CHROME_PATH = process.env.CHROME_PATH;

export async function openAdmin({ email, password }) {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: CHROME_PATH,
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto(process.env.ADMIN_URL, { waitUntil: "networkidle2" });

    // ✅ check if login form exists
    const loginForm = await page.$("form.form-login");
    if (loginForm) {
        console.log("🔐 Logging in as:", email);
        await page.type("#email", email, { delay: 50 });
        await page.type("#Password", password, { delay: 50 });

        await Promise.all([
            page.click("button.btn.btn-blue"),
            page.waitForNavigation({ waitUntil: "networkidle2" }),
        ]);
    } else {
        console.log("✅ Already logged in, skipping login step.");
    }

    return { browser, page };
}
