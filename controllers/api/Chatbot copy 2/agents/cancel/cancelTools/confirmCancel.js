export async function confirmCancel(state) {
    const last = state.messages.at(-1)?.content?.toLowerCase() ?? "";

    if (last.includes("xác nhận")) {
        return { ...state, current_step: "ExecuteCancel" };
    }

    if (last.includes("không")) {
        return {
            ...state,
            messages: [...state.messages, {
                role: "ai",
                content: "Đã hủy yêu cầu hủy đơn hàng. Nếu cần hỗ trợ gì khác, hãy cho tôi biết nhé.",
            }],
            current_step: "__end__",
        };
    }

    return {
        ...state,
        messages: [...state.messages, {
            role: "ai",
            content: "Bạn có muốn hủy đơn hàng không? Vui lòng xác nhận bằng 'Xác nhận' hoặc 'Không'.",
        }],
        current_step: "ConfirmCancel",
    };
}
