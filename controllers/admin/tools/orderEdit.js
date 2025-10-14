import chatMcpAdmin from "../../../models/ChatMcpAdmin.js";
import { encrypt } from "../../api/Chatbot/extra/encrypt.js";
import { openAdmin } from "./puppeteer.js";

const statusMap = {
    "1": "Đã đặt hàng",
    "2": "Đã xác nhận đơn hàng",
    "3": "Hoàn tất đóng gói",
    "4": "Đang giao hàng",
    "5": "Đã giao hàng",
    "6": "Đã bị hủy"
};

export const puppeteerEditOrderStatus = {
    name: "puppeteerEditOrderStatus",
    description: "This tool is only for orders, Open the admin panel, search for an order by ID, open the update status modal, select the specified status, and save changes",
    execute: async (args, state) => {
        console.log("🚧 Executing: puppeteerEditOrderStatus");
        const { email, password } = state.credentials;

        console.log("email", email, "password", password);
        const { searchParam, newStatusId } = args;

        console.log("searchParam", searchParam, "newStatusId", newStatusId);

        if (!searchParam || !newStatusId) {
            const msg = "❌ Missing searchParam or newStatusId";
            return { role: "ai", content: msg };
        }

        let browser;
        try {
            const session = await openAdmin({ email, password });
            browser = session.browser;
            const page = session.page;
            console.log("✅ Admin page opened and logged in.");

            // 1. Navigate via sidebar if liHtml is provided
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

            // 2. Search order by ID
            await page.waitForSelector("input[name='search']", { timeout: 5000 });
            await page.focus("input[name='search']");
            await page.evaluate(() => (document.querySelector("input[name='search']").value = ""));
            await page.type("input[name='search']", String(searchParam));

            await Promise.all([
                page.click("button.btn.btn-danger[type='submit']"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]);
            console.log(`✅ Searched order ID: ${searchParam}`);

            // 3. Click the "Cập nhật trạng thái" button
            const updateBtnSelector = `button[data-order-id='${searchParam}']`;
            await page.waitForSelector(updateBtnSelector, { timeout: 5000 });
            await page.click(updateBtnSelector);
            console.log("✅ Clicked update status button");

            await page.waitForSelector("#updateModal.show", { timeout: 5000 });
            console.log("✅ Status modal opened");

            // 4. Select the radio by status id
            const radioSelector = `#updateModal input[name='order_status'][value='${newStatusId}']`;
            await page.waitForSelector(radioSelector, { timeout: 5000 });
            await page.click(radioSelector);
            console.log(`✅ Selected status ${newStatusId}`);

            // 5. Submit the form
            await Promise.all([
                page.click("#updateModal button[type='submit']"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]);
            console.log("✅ Submitted new status");

            const statusText = statusMap[newStatusId] || newStatusId;
            const msg = `✅ Đơn hàng ${searchParam} đã được cập nhật trạng thái thành "${statusText}".`;

            await chatMcpAdmin.saveChatMessage({ role: "ai", content: encrypt(msg), email });
            return { role: "ai", content: msg, end: true }; // 👈 mark finished
        } catch (err) {
            console.error("❌ puppeteerEditOrderStatus error:", err);
            const msg = "❌ Failed to edit order: " + err.message;
            if (email) {
                await chatMcpAdmin.saveChatMessage({ role: "ai", content: encrypt(msg), email });
            }
            return { role: "ai", content: msg };
        } finally {
            if (browser) {
                await browser.close();
                console.log("✅ Browser closed");
            }
        }
    },
};
