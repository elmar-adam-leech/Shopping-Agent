(function () {
  "use strict";

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z"/><path d="M5 19l1.04 3.12L9.16 23.5l-3.12 1.38L5 28l-1.04-3.12L.84 23.5l3.12-1.38z" transform="scale(0.5) translate(2, -6)"/></svg>',
    close: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send: '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    tool: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  var TOOL_LABELS = {
    search_products: "Searching products",
    get_product: "Looking up product",
    get_collections: "Browsing collections",
    list_collections: "Browsing collections",
    get_blogs: "Reading blog posts",
    list_blogs: "Reading blog posts",
    add_to_cart: "Adding to cart",
    get_cart: "Checking cart",
    get_product_recommendations: "Finding recommendations"
  };

  var root = document.getElementById("mcp-chat-widget");
  if (!root) return;

  var config = {
    apiEndpoint: root.dataset.apiEndpoint || "",
    storeDomain: root.dataset.storeDomain || "",
    position: root.dataset.position || "bottom-right",
    primaryColor: root.dataset.primaryColor || "#6366f1",
    welcomeMessage: root.dataset.welcomeMessage || "Hi! I'm your AI shopping assistant. How can I help you today?",
    bubbleIcon: root.dataset.bubbleIcon || "chat",
    widgetTitle: root.dataset.widgetTitle || "Shopping Assistant"
  };

  if (!config.apiEndpoint || !config.storeDomain) {
    console.warn("[MCP Chat Widget] Missing apiEndpoint or storeDomain configuration.");
    return;
  }

  applyThemeColor(config.primaryColor);

  var state = {
    isOpen: false,
    sessionId: null,
    conversationId: null,
    messages: [],
    isLoading: false
  };

  var SESSION_KEY = "mcp_chat_session_" + config.storeDomain;
  var CONV_KEY = "mcp_chat_conv_" + config.storeDomain;

  function applyThemeColor(color) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      color = "#6366f1";
    }
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    root.style.setProperty("--mcp-primary", color);
    root.style.setProperty("--mcp-primary-hover", darken(color, 15));
    root.style.setProperty("--mcp-primary-light", "rgba(" + r + "," + g + "," + b + ",0.08)");
  }

  function darken(hex, percent) {
    var r = Math.max(0, parseInt(hex.slice(1, 3), 16) - percent * 2.55);
    var g = Math.max(0, parseInt(hex.slice(3, 5), 16) - percent * 2.55);
    var b = Math.max(0, parseInt(hex.slice(5, 7), 16) - percent * 2.55);
    return "#" + Math.round(r).toString(16).padStart(2, "0") + Math.round(g).toString(16).padStart(2, "0") + Math.round(b).toString(16).padStart(2, "0");
  }

  function loadSession() {
    try {
      var stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed.sessionId && parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          state.sessionId = parsed.sessionId;
        }
      }
      var convId = localStorage.getItem(CONV_KEY);
      if (convId) {
        state.conversationId = parseInt(convId, 10) || null;
      }
    } catch (e) {
      console.warn("[MCP Chat Widget] Failed to load session:", e);
    }
  }

  function saveSession() {
    try {
      if (state.sessionId) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          sessionId: state.sessionId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }));
      }
      if (state.conversationId) {
        localStorage.setItem(CONV_KEY, String(state.conversationId));
      }
    } catch (e) {
      console.warn("[MCP Chat Widget] Failed to save session:", e);
    }
  }

  function createSession(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", config.apiEndpoint + "/sessions");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var data = JSON.parse(xhr.responseText);
          state.sessionId = data.sessionId;
          saveSession();
          callback(null, data.sessionId);
        } catch (e) {
          callback(e);
        }
      } else if (xhr.status === 403) {
        var err = new Error("Chat is currently disabled for this store");
        err.chatDisabled = true;
        callback(err);
      } else {
        callback(new Error("Session creation failed: " + xhr.status));
      }
    };
    xhr.onerror = function () {
      callback(new Error("Network error creating session"));
    };
    xhr.send(JSON.stringify({ storeDomain: config.storeDomain }));
  }

  function ensureSession(callback) {
    if (state.sessionId) {
      callback(null, state.sessionId);
      return;
    }
    createSession(callback);
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "innerHTML") {
          node.innerHTML = attrs[k];
        } else if (k.startsWith("on")) {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    return node;
  }

  var bubble = el("button", "mcp-bubble " + config.position, {
    "aria-label": "Open chat",
    onClick: togglePanel
  });
  var chatIcon = el("span", "mcp-chat-icon", { innerHTML: ICONS[config.bubbleIcon] || ICONS.chat });
  var closeIcon = el("span", "mcp-close-icon", { innerHTML: ICONS.close });
  bubble.appendChild(chatIcon);
  bubble.appendChild(closeIcon);

  var panel = el("div", "mcp-panel " + config.position);

  var header = el("div", "mcp-header");
  var headerIcon = el("div", "mcp-header-icon", { innerHTML: ICONS.sparkle });
  var headerText = el("div", "mcp-header-text");
  var headerTitle = el("div", "mcp-header-title");
  headerTitle.textContent = config.widgetTitle;
  var headerSubtitle = el("div", "mcp-header-subtitle");
  headerSubtitle.textContent = "Powered by AI";
  headerText.appendChild(headerTitle);
  headerText.appendChild(headerSubtitle);
  header.appendChild(headerIcon);
  header.appendChild(headerText);

  var messagesContainer = el("div", "mcp-messages");

  var inputArea = el("div", "mcp-input-area");
  var textarea = el("textarea", "mcp-input", {
    placeholder: "Ask a question...",
    rows: "1"
  });
  var sendBtn = el("button", "mcp-send-btn", {
    "aria-label": "Send message",
    innerHTML: ICONS.send,
    onClick: handleSend
  });

  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  textarea.addEventListener("input", function () {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
  });

  inputArea.appendChild(textarea);
  inputArea.appendChild(sendBtn);

  var powered = el("div", "mcp-powered");
  powered.textContent = "Shopify MCP Agent";

  panel.appendChild(header);
  panel.appendChild(messagesContainer);
  panel.appendChild(inputArea);
  panel.appendChild(powered);

  root.appendChild(bubble);
  root.appendChild(panel);

  loadSession();
  renderMessages();

  function togglePanel() {
    state.isOpen = !state.isOpen;
    if (state.isOpen) {
      panel.classList.add("visible");
      bubble.classList.add("open");
      textarea.focus();
    } else {
      panel.classList.remove("visible");
      bubble.classList.remove("open");
    }
  }

  function handleSend() {
    var text = textarea.value.trim();
    if (!text || state.isLoading) return;

    textarea.value = "";
    textarea.style.height = "auto";

    state.messages.push({
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    });

    renderMessages();
    scrollToBottom();

    ensureSession(function (err) {
      if (err) {
        var msg = (err.chatDisabled)
          ? "Chat is currently unavailable for this store."
          : "Sorry, I couldn't connect to the assistant. Please try again.";
        state.messages.push({
          role: "assistant",
          content: msg,
          timestamp: new Date().toISOString()
        });
        renderMessages();
        return;
      }
      sendChatMessage(text);
    });
  }

  function sendChatMessage(message, retryCount) {
    retryCount = retryCount || 0;
    state.isLoading = true;
    renderMessages();
    scrollToBottom();

    var url = config.apiEndpoint + "/stores/" + encodeURIComponent(config.storeDomain) + "/chat";

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": state.sessionId
      },
      body: JSON.stringify({
        sessionId: state.sessionId,
        conversationId: state.conversationId,
        message: message
      })
    })
      .then(function (response) {
        if (response.status === 403) {
          return response.json().then(function (body) {
            state.isLoading = false;
            if (body && body.error && body.error.indexOf("disabled") !== -1) {
              state.messages.push({ role: "assistant", content: "Chat is currently unavailable for this store.", timestamp: new Date().toISOString() });
              renderMessages();
              scrollToBottom();
              return;
            }
            if (retryCount < 1) {
              state.sessionId = null;
              state.conversationId = null;
              try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(CONV_KEY); } catch (e) { /* ignore */ }
              return ensureSession(function (err) {
                if (err) {
                  state.messages.push({ role: "assistant", content: "Session expired. Please try sending your message again.", timestamp: new Date().toISOString() });
                  renderMessages();
                  return;
                }
                sendChatMessage(message, retryCount + 1);
              });
            }
            state.messages.push({ role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: new Date().toISOString() });
            renderMessages();
          }).catch(function () {
            state.isLoading = false;
            state.messages.push({ role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: new Date().toISOString() });
            renderMessages();
          });
        }
        if (response.status === 401 && retryCount < 1) {
          state.sessionId = null;
          state.conversationId = null;
          try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(CONV_KEY);
          } catch (e) { /* ignore */ }
          state.isLoading = false;
          return ensureSession(function (err) {
            if (err) {
              state.messages.push({ role: "assistant", content: "Session expired. Please try sending your message again.", timestamp: new Date().toISOString() });
              renderMessages();
              return;
            }
            sendChatMessage(message, retryCount + 1);
          });
        }
        if (!response.ok) throw new Error("Chat request failed: " + response.status);
        if (!response.body) throw new Error("No response body");

        var reader = response.body.getReader();
        var decoder = new TextDecoder("utf-8");
        var sseBuffer = "";
        var assistantContent = "";
        var toolCalls = [];
        var toolResults = [];

        state.messages.push({
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          toolCalls: [],
          toolResults: []
        });

        function processChunk() {
          return reader.read().then(function (result) {
            if (result.done) {
              if (sseBuffer.trim()) processSSELines(sseBuffer);
              state.isLoading = false;
              renderMessages();
              scrollToBottom();
              return;
            }

            sseBuffer += decoder.decode(result.value, { stream: true });
            var lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (var i = 0; i < lines.length; i++) {
              processSSELine(lines[i]);
            }

            renderMessages();
            scrollToBottom();
            return processChunk();
          });
        }

        function processSSELines(text) {
          var lines = text.split("\n");
          for (var i = 0; i < lines.length; i++) {
            processSSELine(lines[i]);
          }
        }

        function processSSELine(line) {
          if (!line.startsWith("data: ")) return;
          var dataStr = line.substring(6).trim();
          if (dataStr === "[DONE]") return;

          try {
            var event = JSON.parse(dataStr);
            var lastMsg = state.messages[state.messages.length - 1];

            if (event.type === "text") {
              assistantContent += event.data;
              lastMsg.content = assistantContent;
            } else if (event.type === "conversation_id") {
              state.conversationId = event.data;
              saveSession();
            } else if (event.type === "tool_call") {
              toolCalls.push({
                id: event.data.id,
                name: event.data.name,
                arguments: event.data.arguments
              });
              lastMsg.toolCalls = toolCalls.slice();
            } else if (event.type === "tool_result") {
              toolResults.push({
                toolCallId: event.data.toolCallId,
                content: event.data.content
              });
              lastMsg.toolResults = toolResults.slice();
            } else if (event.type === "error") {
              lastMsg.content = (assistantContent ? assistantContent + "\n\n" : "") + (typeof event.data === "string" ? event.data : "An error occurred processing your message.");
            }
          } catch (e) {
            // incomplete JSON, will be completed in next chunk
          }
        }

        return processChunk();
      })
      .catch(function (err) {
        console.error("[MCP Chat Widget] Error:", err);
        state.isLoading = false;
        state.messages.push({
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date().toISOString()
        });
        renderMessages();
        scrollToBottom();
      });
  }

  function renderMessages() {
    messagesContainer.innerHTML = "";

    if (state.messages.length === 0) {
      var welcome = el("div", "mcp-welcome");
      var wIcon = el("div", "mcp-welcome-icon", { innerHTML: ICONS.sparkle });
      var wText = el("div", "mcp-welcome-text");
      wText.textContent = config.welcomeMessage;
      welcome.appendChild(wIcon);
      welcome.appendChild(wText);
      messagesContainer.appendChild(welcome);
    } else {
      for (var i = 0; i < state.messages.length; i++) {
        var msg = state.messages[i];
        var msgEl = renderMessage(msg);
        messagesContainer.appendChild(msgEl);
      }
    }

    if (state.isLoading) {
      var typing = el("div", "mcp-typing");
      typing.appendChild(el("div", "mcp-typing-dot"));
      typing.appendChild(el("div", "mcp-typing-dot"));
      typing.appendChild(el("div", "mcp-typing-dot"));
      messagesContainer.appendChild(typing);
    }

    sendBtn.disabled = state.isLoading;
  }

  function renderMessage(msg) {
    var wrapper = document.createDocumentFragment();
    var isUser = msg.role === "user";

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      var badgesWrap = el("div", "", { style: "align-self: flex-start; display: flex; flex-wrap: wrap; gap: 4px;" });
      for (var t = 0; t < msg.toolCalls.length; t++) {
        var tc = msg.toolCalls[t];
        var label = TOOL_LABELS[tc.name] || tc.name;
        var badge = el("span", "mcp-tool-badge", { innerHTML: ICONS.tool });
        var badgeText = document.createTextNode(" " + label);
        badge.appendChild(badgeText);
        badgesWrap.appendChild(badge);
      }
      wrapper.appendChild(badgesWrap);
    }

    if (msg.toolResults && msg.toolResults.length > 0) {
      for (var r = 0; r < msg.toolResults.length; r++) {
        var tr = msg.toolResults[r];
        var matchingCall = null;
        if (msg.toolCalls) {
          for (var c = 0; c < msg.toolCalls.length; c++) {
            if (msg.toolCalls[c].id === tr.toolCallId) {
              matchingCall = msg.toolCalls[c];
              break;
            }
          }
        }
        if (matchingCall) {
          var cards = renderProductCards(matchingCall.name, tr.content);
          if (cards) wrapper.appendChild(cards);
        }
      }
    }

    if (msg.content) {
      var bubble = el("div", "mcp-msg " + (isUser ? "mcp-msg-user" : "mcp-msg-assistant"));
      if (isUser) {
        bubble.textContent = msg.content;
      } else {
        renderMarkdownDOM(msg.content, bubble);
      }
      wrapper.appendChild(bubble);
    }

    return wrapper;
  }

  function renderProductCards(toolName, content) {
    try {
      var data = JSON.parse(content);
    } catch (e) {
      return null;
    }

    var products = [];

    if (toolName === "search_products" || toolName === "get_product" || toolName === "get_product_recommendations") {
      if (data.products && data.products.edges) {
        for (var i = 0; i < data.products.edges.length && i < 4; i++) {
          products.push(data.products.edges[i].node);
        }
      } else if (data.product) {
        products.push(data.product);
      }
    }

    if (products.length === 0) return null;

    var container = document.createDocumentFragment();
    for (var p = 0; p < products.length; p++) {
      var prod = products[p];
      var card = el("div", "mcp-product-card");

      var imgUrl = (prod.featuredImage && prod.featuredImage.url) ||
        (prod.images && prod.images.edges && prod.images.edges[0] && prod.images.edges[0].node && prod.images.edges[0].node.url);

      if (imgUrl) {
        var img = el("img", "", { src: imgUrl, alt: prod.title || "Product" });
        card.appendChild(img);
      }

      var info = el("div", "mcp-product-info");
      var title = el("div", "mcp-product-title");
      title.textContent = prod.title || "Product";
      info.appendChild(title);

      if (prod.vendor) {
        var vendor = el("div", "mcp-product-vendor");
        vendor.textContent = prod.vendor;
        info.appendChild(vendor);
      }

      var price = prod.priceRange && prod.priceRange.minVariantPrice;
      if (price) {
        var priceEl = el("div", "mcp-product-price");
        var symbol = price.currencyCode === "USD" ? "$" : price.currencyCode + " ";
        priceEl.textContent = symbol + price.amount;
        info.appendChild(priceEl);
      }

      card.appendChild(info);
      container.appendChild(card);
    }

    return container;
  }

  function renderMarkdownDOM(text, container) {
    var lines = text.split("\n");
    var currentList = null;
    var currentListType = "";

    function closeList() {
      if (currentList) {
        container.appendChild(currentList);
        currentList = null;
        currentListType = "";
      }
    }

    function renderInline(str, parent) {
      var tokens = [];
      var regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
      var lastIndex = 0;
      var match;

      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
          tokens.push({ type: "text", value: str.slice(lastIndex, match.index) });
        }
        if (match[2] !== undefined) {
          tokens.push({ type: "bold", value: match[2] });
        } else if (match[3] !== undefined) {
          tokens.push({ type: "italic", value: match[3] });
        } else if (match[4] !== undefined) {
          tokens.push({ type: "code", value: match[4] });
        } else if (match[5] !== undefined && match[6] !== undefined) {
          tokens.push({ type: "link", text: match[5], url: match[6] });
        }
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < str.length) {
        tokens.push({ type: "text", value: str.slice(lastIndex) });
      }

      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        if (token.type === "text") {
          parent.appendChild(document.createTextNode(token.value));
        } else if (token.type === "bold") {
          var strong = document.createElement("strong");
          strong.textContent = token.value;
          parent.appendChild(strong);
        } else if (token.type === "italic") {
          var em = document.createElement("em");
          em.textContent = token.value;
          parent.appendChild(em);
        } else if (token.type === "code") {
          var code = document.createElement("code");
          code.textContent = token.value;
          parent.appendChild(code);
        } else if (token.type === "link") {
          var safeUrl = sanitizeURL(token.url);
          if (safeUrl) {
            var a = document.createElement("a");
            a.href = safeUrl;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = token.text;
            parent.appendChild(a);
          } else {
            parent.appendChild(document.createTextNode(token.text));
          }
        }
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var ulMatch = line.match(/^[-*]\s+(.+)/);
      var olMatch = line.match(/^\d+\.\s+(.+)/);

      if (ulMatch) {
        if (!currentList || currentListType !== "ul") {
          closeList();
          currentList = document.createElement("ul");
          currentListType = "ul";
        }
        var li = document.createElement("li");
        renderInline(ulMatch[1], li);
        currentList.appendChild(li);
      } else if (olMatch) {
        if (!currentList || currentListType !== "ol") {
          closeList();
          currentList = document.createElement("ol");
          currentListType = "ol";
        }
        var li2 = document.createElement("li");
        renderInline(olMatch[1], li2);
        currentList.appendChild(li2);
      } else {
        closeList();
        if (line.trim() !== "") {
          var p = document.createElement("p");
          renderInline(line, p);
          container.appendChild(p);
        }
      }
    }

    closeList();
  }

  function sanitizeURL(url) {
    try {
      var parsed = new URL(url, "https://placeholder.invalid");
      var protocol = parsed.protocol.toLowerCase();
      if (protocol === "https:" || protocol === "http:" || protocol === "mailto:" || protocol === "tel:") {
        return parsed.href;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }
})();
