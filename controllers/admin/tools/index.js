import { openAdmin } from "./puppeteer.js";
import { puppeteerFillForm } from "./productEdit.js";
import { endConversation } from "./endConversation.js";
import { puppeteerEditOrderStatus } from "./orderEdit.js";
import { fastApiTool } from "./fastApiTool.js";

export const availableTools = {
    openAdmin: {
        execute: async (_, state) => {
            const { email, password } = state.credentials || {};
            console.log("email", email, "password", password);
            return await openAdmin({ email, password });
        },
    },
    puppeteerFillForm,
    endConversation,
    puppeteerEditOrderStatus,
};
