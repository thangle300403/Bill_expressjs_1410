import chatMcpAdmin from "../../../models/ChatMcpAdmin.js";
import { encrypt } from "../../api/Chatbot/extra/encrypt.js";
import { openAdmin } from "./puppeteer.js";
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const puppeteerFillForm = {
    name: "puppeteerFillForm",
    description: "This tool is only for products, Open the admin panel, search for a product by name, click the Edit button, update the specified field, and save change. /n ",

    execute: async (args, state) => {
        console.log("🚧 Executing: puppeteerFillForm");
        const { email, password } = state.credentials;
        const { searchParam, selector, value } = args;

        console.log("email", email, "password", password, "searchParam", searchParam, "selector", selector, "value", value);

        if (!searchParam) return { message: "❌ Missing product name" };

        const { browser, page } = await openAdmin({ email, password });
        console.log("✅ Admin page opened and logged in.");

        try {
            if (args.liHtml) {
                const match = args.liHtml.match(/<a[^>]+href=["']([^"']+)["']/);
                if (match) {
                    const path = match[1];
                    const selector = `a.nav-link[href="${path}"]`;

                    await page.waitForSelector(selector, { timeout: 5000 });
                    await Promise.all([
                        page.click(selector),
                        page.waitForNavigation({ waitUntil: "networkidle2" }),
                    ]);
                    console.log(`✅ Clicked sidebar link to: ${path}`);
                }
            }

            await delay(1000);

            // 2. Type in search field
            await page.waitForSelector("input[name='search']", { timeout: 5000 });
            await page.focus("input[name='search']");
            await page.evaluate(() => (document.querySelector("input[name='search']").value = ""));
            await page.type("input[name='search']", searchParam);
            console.log(`✅ Typed search: ${searchParam}`);

            await Promise.all([
                page.click("button.btn.btn-danger[type='submit']"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]);
            console.log("✅ Submitted search");

            await delay(1000);

            // 4. Find and click the "Sửa" button in results
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll("a.btn.btn-info"));
                const editLink = links.find(link => link.textContent.trim() === "Sửa");
                if (editLink) editLink.click();
            });
            await page.waitForNavigation({ waitUntil: "networkidle2" });
            console.log("✅ Clicked Sửa and opened edit page");

            await delay(1000);

            // 5. Update the specified field
            await page.waitForSelector(selector, { timeout: 5000 });
            if (selector.includes("select")) {
                await page.select(selector, value);
            } else {
                await page.focus(selector);
                await page.evaluate((sel) => {
                    const input = document.querySelector(sel);
                    if (input) input.value = "";
                }, selector);
                await page.type(selector, String(value));
            }
            console.log("✅ Updated field");

            // 6. Save changes
            await Promise.all([
                page.click("button.btn.btn-success"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]);
            console.log("✅ Saved changes");

            const msg = `✅ Sản phẩm "${searchParam}" đã được update.`;

            console.log(msg);

            await chatMcpAdmin.saveChatMessage({ role: "ai", content: encrypt(msg), email });

            return { role: "ai", content: msg };
        } catch (err) {
            console.error("❌ puppeteerFillForm error:", err);
            const msg = "❌ Failed to edit product: " + err.message;
            await chatMcpAdmin.saveChatMessage({ role: "ai", content: encrypt(msg), email });
        } finally {
            if (browser) {
                await browser.close();
                console.log("✅ Browser closed");
            }
        }
    },
};
