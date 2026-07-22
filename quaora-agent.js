(() => {
    'use strict';

    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/' && !path.endsWith('/index.html')) return;

    const root = document.createElement('aside');
    root.className = 'qa-agent';
    root.setAttribute('aria-label', 'Quaora müşteri desteği');
    root.innerHTML = `
        <section class="qa-agent__panel" id="qa-agent-panel" role="dialog" aria-modal="false" aria-labelledby="qa-agent-title" aria-hidden="true">
            <header class="qa-agent__header">
                <div class="qa-agent__avatar" aria-hidden="true">Q</div>
                <div class="qa-agent__heading">
                    <p class="qa-agent__eyebrow">Quaora destek</p>
                    <h2 class="qa-agent__title" id="qa-agent-title">Nasıl yardımcı olabilirim?</h2>
                    <div class="qa-agent__status">Yanıt vermeye hazır</div>
                </div>
                <button class="qa-agent__close" type="button" aria-label="Sohbeti kapat">×</button>
            </header>
            <div class="qa-agent__conversation" role="log" aria-live="polite" aria-relevant="additions text"></div>
            <footer class="qa-agent__composer">
                <form class="qa-agent__form">
                    <textarea class="qa-agent__input" rows="1" maxlength="1200" placeholder="Ürün, beden, stok, teslimat veya iade sorun..." aria-label="Mesajınız"></textarea>
                    <button class="qa-agent__send" type="submit" aria-label="Mesajı gönder">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/></svg>
                    </button>
                </form>
                <p class="qa-agent__privacy">Lütfen kişisel, sipariş veya ödeme bilgisi paylaşmayın.</p>
            </footer>
        </section>
        <button class="qa-agent__launcher" type="button" aria-label="Quaora desteği aç" aria-expanded="false" aria-controls="qa-agent-panel">
            <span class="qa-agent__launcher-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40"><path d="M8.5 9.5h23v17h-12l-7.5 5v-5H8.5v-17Z"/><path d="M15 17h10M15 21h7"/></svg>
            </span>
            <span class="qa-agent__online-dot" aria-hidden="true"></span>
        </button>`;

    document.body.appendChild(root);

    const panel = root.querySelector('.qa-agent__panel');
    const launcher = root.querySelector('.qa-agent__launcher');
    const closeButton = root.querySelector('.qa-agent__close');
    const conversation = root.querySelector('.qa-agent__conversation');
    const form = root.querySelector('.qa-agent__form');
    const input = root.querySelector('.qa-agent__input');
    const sendButton = root.querySelector('.qa-agent__send');
    const history = [];
    let pending = false;
    let typingMessage = null;

    const sessionId = getSessionId();

    appendMessage('assistant', 'Merhaba! Ürün seçimi, fiyat, materyal, renk, bakım, beden önerisi, güncel stok, teslimat, ödeme ve iade konularında yardımcı olabilirim.');
    appendQuickActions();

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    closeButton.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', event => {
        event.preventDefault();
        void sendMessage(input.value);
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void sendMessage(input.value);
        }
    });

    input.addEventListener('input', resizeInput);

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });

    function setOpen(isOpen) {
        panel.classList.toggle('is-open', isOpen);
        panel.setAttribute('aria-hidden', String(!isOpen));
        launcher.setAttribute('aria-expanded', String(isOpen));
        launcher.setAttribute('aria-label', isOpen ? 'Quaora desteği kapat' : 'Quaora desteği aç');
        if (isOpen) window.setTimeout(() => input.focus(), 220);
        else launcher.focus();
    }

    async function sendMessage(rawMessage) {
        const message = String(rawMessage || '').trim();
        if (!message || pending) return;

        const previousHistory = history.slice(-12);
        pending = true;
        input.value = '';
        resizeInput();
        sendButton.disabled = true;
        appendMessage('user', message);
        history.push({ role: 'user', content: message });
        showTyping();

        try {
            const response = await fetch('/api/agent-chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history: previousHistory, sessionId })
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || typeof body.reply !== 'string') {
                throw new Error(typeof body.error === 'string' ? body.error : 'Yanıt alınamadı.');
            }
            hideTyping();
            appendMessage('assistant', body.reply);
            history.push({ role: 'assistant', content: body.reply });
            trimHistory();
        } catch (error) {
            hideTyping();
            appendMessage('assistant', safeClientError(error));
        } finally {
            pending = false;
            sendButton.disabled = false;
            input.focus();
        }
    }

    function appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `qa-agent__message qa-agent__message--${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'qa-agent__bubble';
        appendSafeText(bubble, String(text || ''));
        wrapper.appendChild(bubble);
        conversation.appendChild(wrapper);
        scrollToBottom();
        return wrapper;
    }

    function appendSafeText(container, text) {
        const urlPattern = /https:\/\/www\.quaora\.com\.tr\/[^\s]+/gi;
        let lastIndex = 0;
        for (const match of text.matchAll(urlPattern)) {
            container.append(document.createTextNode(text.slice(lastIndex, match.index)));
            const link = document.createElement('a');
            link.href = match[0];
            link.textContent = /\/iletisim\.html(?:[?#]|$)/i.test(match[0]) ? 'İletişime geç' : 'Ürünü incele';
            link.target = '_self';
            link.rel = 'noopener';
            container.append(link);
            lastIndex = Number(match.index) + match[0].length;
        }
        container.append(document.createTextNode(text.slice(lastIndex)));
    }

    function appendQuickActions() {
        const list = document.createElement('div');
        list.className = 'qa-agent__quick-list';
        const actions = [
            ['Bedenimi bul', 'Bedenimi bulmama yardım eder misin? Ölçülerimi hangi sırayla yazmalıyım?'],
            ['Ürün öner', 'Mayo ve bikini seçenekleri hakkında ürün önerir misin?'],
            ['Stok sorgula', 'Bir ürünün beden bazlı stok durumunu öğrenmek istiyorum.'],
            ['İade ve teslimat', 'İade, değişim ve teslimat koşulları nelerdir?']
        ];
        for (const [label, message] of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'qa-agent__quick';
            button.textContent = label;
            button.addEventListener('click', () => void sendMessage(message));
            list.appendChild(button);
        }
        conversation.appendChild(list);
    }

    function showTyping() {
        typingMessage = document.createElement('div');
        typingMessage.className = 'qa-agent__message qa-agent__message--assistant';
        typingMessage.setAttribute('aria-label', 'Yanıt hazırlanıyor');
        typingMessage.innerHTML = '<div class="qa-agent__bubble qa-agent__typing"><span></span><span></span><span></span></div>';
        conversation.appendChild(typingMessage);
        scrollToBottom();
    }

    function hideTyping() {
        typingMessage?.remove();
        typingMessage = null;
    }

    function resizeInput() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 108)}px`;
    }

    function scrollToBottom() {
        window.requestAnimationFrame(() => {
            conversation.scrollTop = conversation.scrollHeight;
        });
    }

    function trimHistory() {
        if (history.length > 14) history.splice(0, history.length - 14);
    }

    function getSessionId() {
        const storageKey = 'quaora_support_session';
        try {
            const existing = sessionStorage.getItem(storageKey);
            if (existing) return existing;
            const created = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
            sessionStorage.setItem(storageKey, created);
            return created;
        } catch {
            return `q-${Date.now().toString(36)}`;
        }
    }

    function safeClientError(error) {
        const message = String(error?.message || '');
        if (/çok fazla istek/i.test(message)) return message;
        return 'Şu anda yanıt veremiyorum. Lütfen biraz sonra tekrar dene.';
    }
})();
