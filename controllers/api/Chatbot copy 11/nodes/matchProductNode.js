// nodes/matchProductNode.js
import productModel from "../../../../models/Product.js";
import { pushLog } from "../extra/sseLogs.js";

export async function matchProductNode(state) {
    const logKey = state.email || state.session_id;
    console.log("logKey:", logKey);
    const log = (msg, step = null) => pushLog(logKey, { msg, step });
    log(`Trợ lí đang tìm hiểu về sản phẩm trong câu hỏi`, "match-product");
    console.log("🚧 !!!!!!!! Now we enter: matchProductNode");
    const products = await productModel.getAll();
    const userQuestion = state.original_user_msg || "";

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedQ = normalize(userQuestion);

    const filtered = products.filter((p) =>
        normalizedQ.includes(normalize(p.name))
    );

    const topMatchedProduct = filtered[0];

    const matchedProdInUserQues = filtered.map(
        (p) => `${p.name} (giá ${p.price}đ)`
    );

    console.log(
        "🚧 matchedProdInUserQues:",
        matchedProdInUserQues
    )
    const prevUsed = Array.isArray(state.used_tool)
        ? state.used_tool
        : state.used_tool
            ? [state.used_tool]
            : [];

    const newUsedTools = [...new Set([...prevUsed, "match_product"])];

    return {
        ...state,
        matchedProdInUserQues,
        topMatchedProduct: topMatchedProduct,
        products,
        current_step: "consult",
        used_tool: newUsedTools,
    };
}
