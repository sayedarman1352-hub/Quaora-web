"use strict";

const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const formStatus = document.getElementById("form-status");
const sessionId = getSessionId();
const history = [];

function getSessionId() {
  const existing = sessionStorage.getItem("quaora_agent_test_session");
  if (existing) return existing;
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  sessionStorage.setItem("quaora_agent_test_session", value);
  return value;
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const health = await response.json();
    if (!response.ok) throw new Error(health.error || "Sağlık kontrolü başarısız.");
    document.getElementById("health-dot").className = "health-dot is-ok";
    document.getElementById("health-label").textContent = "Test ortamı hazır";
    document.getElementById("environment").textContent = health.testEnvironment ? "Güvenli test" : "Hazır";
    document.getElementById("production").textContent = health.productionIntegrated ? "Evet" : "Hayır";
  } catch (error) {
    document.getElementById("health-dot").className = "health-dot is-error";
    document.getElementById("health-label").textContent = "Test ortamına ulaşılamıyor";
    formStatus.textContent = "Test ortamına bağlanılamadı.";
  }
}

function addMessage(role, text, meta = "") {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = role === "assistant" ? "Q" : "S";
  const bubble = document.createElement("div");
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.appendChild(paragraph);
  if (meta) {
    const small = document.createElement("small");
    small.textContent = meta;
    bubble.appendChild(small);
  }
  article.append(avatar, bubble);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(message) {
  addMessage("user", message);
  history.push({ role: "user", content: message });
  sendButton.disabled = true;
  input.disabled = true;
  formStatus.textContent = "Test agentı yanıt hazırlıyor…";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ message, history: history.slice(0, -1), sessionId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Agent yanıt veremedi.");
    addMessage("assistant", result.reply, "Güvenli test yanıtı");
    history.push({ role: "assistant", content: result.reply });
    formStatus.textContent = "Yanıtlar test amaçlıdır; kişisel veya ödeme bilgisi paylaşma.";
  } catch (error) {
    addMessage("assistant", `Test hatası: ${error.message}`, "İstek başarısız");
    formStatus.textContent = "Hata oluştu; sistem kartındaki durumu kontrol et.";
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  sendMessage(message);
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    form.requestSubmit();
  });
});

loadHealth();
