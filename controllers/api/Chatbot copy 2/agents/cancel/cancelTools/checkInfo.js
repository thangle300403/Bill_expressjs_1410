export async function checkInfo(state) {
    console.log("📍 Entered: checkInfo");

    const hasOrderId = !!state.orderId;
    const hasTypedEmail = !!state.temp_email;

    console.log("🧪 temp_email:", state.temp_email);
    console.log("🧪 session email:", state.email);

    // If missing data, ask user for it (but DO NOT jump back to LLM directly!)
    if (!hasOrderId || !hasTypedEmail) {
        const msg = `Vui lòng cung cấp${!hasTypedEmail ? " email" : ""}${!hasTypedEmail && !hasOrderId ? " và" : ""}${!hasOrderId ? " mã đơn hàng" : ""}.`;

        return {
            ...state,
            messages: [...state.messages, { role: "ai", content: msg }],
            current_step: "__wait_user_input__", // 🛑 wait for user before retrying
        };
    }

    if (state.temp_email !== state.email) {
        return {
            ...state,
            messages: [
                ...state.messages,
                {
                    role: "ai",
                    content: `Email bạn cung cấp (**${state.temp_email}**) không khớp với tài khoản hiện tại (**${state.email}**). Vui lòng nhập đúng email.`,
                },
            ],
            temp_email: undefined,
            current_step: "__wait_user_input__", // 🛑 wait for user to fix
        };
    }

    console.log("✅ Proceeding to ConfirmCancel");

    return {
        ...state,
        messages: [
            ...state.messages,
            {
                role: "ai",
                content: `Bạn có chắc muốn hủy đơn hàng **${state.orderId}** của email **${state.email}** không?\nVui lòng xác nhận bằng "Xác nhận" hoặc "Không".`,
            },
        ],
        current_step: "ConfirmCancel",
    };
}
