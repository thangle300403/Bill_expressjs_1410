const appendMessage = (role, text) => {
    const chatWindow = document.getElementById("chat-window");
    const bubbleStyle =
        role === "user"
            ? "background: #007bff; color: white; align-self: flex-end;"
            : "background: #585858; color: white; align-self: flex-start;";

    const bubble = `
    <div style="max-width: 80%; margin: 5px 0; padding: 10px 14px; border-radius: 16px; ${bubbleStyle} display: inline-block;">
      ${text}
    </div>
  `;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.innerHTML = bubble;

    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const showLoader = () => {
    const chatWindow = document.getElementById("chat-window");
    const loader = document.createElement("div");
    loader.id = "loader";
    loader.style.cssText = `
    font-style: italic;
    color: #888;
    padding-left: 10px;
    margin: 5px 0;
  `;
    loader.textContent = "🤖 Bot đang xử lý...";
    chatWindow.appendChild(loader);
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const removeLoader = () => {
    const loader = document.getElementById("loader");
    if (loader) loader.remove();
};

document.getElementById("chatbotToggle").addEventListener("click", async function () {
    document.getElementById("chat-window").innerHTML = `
    <div class="text-muted mb-2">
      Chatbot đã sẵn sàng. Hỏi gì đó như: <i>"Hãy tóm tắt các bình luận gần đây"</i>
    </div>`;

    // try {
    //     const res = await fetch("/admin/chatbot/logs");
    //     const data = await res.json();

    //     if (data.logs && data.logs.length > 0) {
    //         for (const log of data.logs) {
    //             appendMessage(log.role === "user" ? "user" : "bot", log.content);
    //         }
    //     }
    // } catch (err) {
    //     appendMessage("bot", "⚠️ Không thể tải lịch sử trò chuyện.");
    // }

    $('#chatbotModal').modal('show');
});

document.getElementById("send-btn").addEventListener("click", async function () {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    appendMessage("user", message);
    input.value = "";

    showLoader();

    try {
        const res = await fetch("/admin/chatbot", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: message
            })
        });

        const data = await res.json();
        removeLoader();
        appendMessage("bot", data.answer);

        if (Array.isArray(data.flagged) && data.flagged.length > 0) {
            const chatWindow = document.getElementById("chat-window");

            const formHTML = `
        <div style="background: #fefefe; padding: 10px; border-radius: 10px; margin-top: 5px;">
          <strong>📌 Bình luận vi phạm:</strong>
          <ul style="padding-left: 1rem; margin-top: 5px;">
            ${data.flagged.map(c => `
              <li><code>ID: ${c.id}</code> — <span class="text-danger">${c.description}</span></li>
            `).join("")}
          </ul>
        </div>
      `;

            const wrapper = document.createElement("div");
            wrapper.innerHTML = formHTML;
            chatWindow.appendChild(wrapper);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    } catch (err) {
        removeLoader();
        appendMessage("bot", "❌ Đã xảy ra lỗi khi gọi trợ lý.");
    }
});
