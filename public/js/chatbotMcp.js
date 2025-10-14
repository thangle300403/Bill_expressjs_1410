import { encrypt } from "../utils/cryptoFE.js";

const appendMessage = (role, text) => {
    const chatWindow = document.getElementById("chat-window");
    const bubbleStyle = role === "user" ?
        "background: #007bff; color: white; align-self: flex-end;" :
        "background: #585858; color: white; align-self: flex-start;";

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
    loader.style.cssText = "font-style: italic; color: #888; padding-left: 10px; margin: 5px 0;";
    loader.textContent = "🤖 Bot đang xử lý...";
    chatWindow.appendChild(loader);
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const removeLoader = () => {
    const loader = document.getElementById("loader");
    if (loader) loader.remove();
};

document.getElementById("chatbotToggleMcp").addEventListener("click", async function () {
    document.getElementById("chat-window").innerHTML = `
      <div class="text-muted mb-2">
        Chatbot đã sẵn sàng. Ví dụ: <i>"Hãy tóm tắt đơn hàng hôm nay"</i>
      </div>`;
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
        const res = await fetch("/admin/chatbotmcp", {
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
    } catch (err) {
        removeLoader();
        appendMessage("bot", "❌ Đã xảy ra lỗi khi gọi chatbot.");
    }
});

document.getElementById("chatbotToggleMcp").addEventListener("click", function () {
    const encEmail = localStorage.getItem("admin_email");
    const encPass = localStorage.getItem("admin_pass");

    if (!encEmail || !encPass) {
        // Show login form
        document.getElementById("chatbot-login").style.display = "block";
        document.getElementById("chat-window").style.display = "none";
    } else {
        // Already logged in → go to chat
        document.getElementById("chatbot-login").style.display = "none";
        document.getElementById("chat-window").style.display = "block";
    }

    $('#chatbotModal').modal('show');
});
//send cho chatbot
document.getElementById("send-btn").addEventListener("click", async function () {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    // Show user's message
    appendMessage("user", message);
    input.value = "";

    showLoader();

    try {
        const encEmail = localStorage.getItem("admin_email");
        const encPass = localStorage.getItem("admin_pass");

        const res = await fetch("/admin/chatbotmcp", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: message,
                email: encEmail,
                password: encPass
            })
        });

        const data = await res.json();
        removeLoader();

        appendMessage("bot", data.answer || "🤖 Không có phản hồi.");
    } catch (err) {
        removeLoader();
        console.error("❌ Chatbot error:", err);
        appendMessage("bot", "❌ Đã xảy ra lỗi khi gọi chatbot.");
    }
});

document.getElementById("chatbot-login-btn").addEventListener("click", async function () {
    const email = document.getElementById("chatbot-email").value.trim();
    const pass = document.getElementById("chatbot-pass").value.trim();

    if (!email || !pass) {
        alert("Vui lòng nhập đầy đủ email và mật khẩu");
        return;
    }

    const secretKey = process.env.SECRET_ENCRYPT_KEY;

    const encEmail = await encrypt(email, secretKey);
    const encPass = await encrypt(pass, secretKey);

    localStorage.setItem("admin_email", encEmail);
    localStorage.setItem("admin_pass", encPass);

    document.getElementById("chatbot-login").style.display = "none";
    document.getElementById("chat-window").style.display = "block";
});
