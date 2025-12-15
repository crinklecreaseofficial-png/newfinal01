// =========================
// State & helpers
// =========================

const defaultAvatars = {
  alex: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200",
  elly: "https://images.pexels.com/photos/3760853/pexels-photo-3760853.jpeg?auto=compress&cs=tinysrgb&w=200",
  office: "https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=200",
  friend: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200",
  notes: "https://images.pexels.com/photos/2246476/pexels-photo-2246476.jpeg?auto=compress&cs=tinysrgb&w=200"
};

let currentContactId = "alex";

let conversations = {
  alex: [],
  elly: [],
  office: [],
  friend: [],
  notes: []
};

let contactSettings = {
  alex: { name: "Alex", avatar: defaultAvatars.alex },
  elly: { name: "Elly", avatar: defaultAvatars.elly },
  office: { name: "Office", avatar: defaultAvatars.office },
  friend: { name: "Friend", avatar: defaultAvatars.friend },
  notes: { name: "Notes", avatar: defaultAvatars.notes }
};

const LS_KEY_CONVOS = "mona_chat_conversations_v3";
const LS_KEY_CONTACTS = "mona_chat_contacts_v3";
const LS_KEY_THEME = "mona_chat_theme_v1";

function saveState() {
  localStorage.setItem(LS_KEY_CONVOS, JSON.stringify(conversations));
  localStorage.setItem(LS_KEY_CONTACTS, JSON.stringify(contactSettings));
}

function loadState() {
  try {
    const convosStr = localStorage.getItem(LS_KEY_CONVOS);
    const contactsStr = localStorage.getItem(LS_KEY_CONTACTS);
    if (convosStr) {
      const parsed = JSON.parse(convosStr);
      conversations = { ...conversations, ...parsed };
    }
    if (contactsStr) {
      const parsed = JSON.parse(contactsStr);
      contactSettings = { ...contactSettings, ...parsed };
    }
  } catch (e) {
    console.warn("loadState error", e);
  }
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hh = h % 12 || 12;
  const mm = m.toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ampm}`;
}

function formatDateLabel(date) {
  const today = new Date();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (t - d) / (1000 * 60 * 60 * 24);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function getDateKey(date) {
  return date.toISOString().slice(0, 10);
}

loadState();

// Build history for backend: last few user/assistant turns
function buildHistoryForBackend(contactId, limit = 8) {
  const conv = conversations[contactId] || [];
  const history = [];
  for (const msg of conv) {
    if (msg.role === "user" || msg.role === "assistant") {
      history.push({ role: msg.role, content: msg.content || "" });
    }
  }
  return history.slice(-limit);
}

// =========================
// DOM refs
// =========================

const body = document.body;
const contactsEls = document.querySelectorAll(".contact");
const chatBodyEl = document.getElementById("chat-body");
const chatNameEl = document.getElementById("chat-name");
const chatAvatarEl = document.getElementById("chat-avatar");
const chatStatusEl = document.getElementById("chat-status");
const typingIndicatorEl = document.getElementById("typing-indicator");
const typingTextEl = document.getElementById("typing-text");
const messageInputEl = document.getElementById("message-input");
const sendBtnEl = document.getElementById("send-btn");
const backBtnEl = document.getElementById("back-btn");
const attachBtnEl = document.getElementById("attach-btn");
const imageInputEl = document.getElementById("image-input");

const alexPreviewEl = document.getElementById("alex-preview");
const ellyPreviewEl = document.getElementById("elly-preview");
const officePreviewEl = document.getElementById("office-preview");
const friendPreviewEl = document.getElementById("friend-preview");
const notesPreviewEl = document.getElementById("notes-preview");

const alexAvatarEl = document.getElementById("alex-avatar");
const ellyAvatarEl = document.getElementById("elly-avatar");
const officeAvatarEl = document.getElementById("office-avatar");
const friendAvatarEl = document.getElementById("friend-avatar");
const notesAvatarEl = document.getElementById("notes-avatar");

// Modal
const profileModalEl = document.getElementById("profile-modal");
const profileModalCloseEl = document.getElementById("profile-modal-close");
const modalAvatarEl = document.getElementById("modal-avatar");
const modalAboutEl = document.getElementById("modal-about");
const avatarInputEl = document.getElementById("avatar-input");
const editProfileBtnEl = document.getElementById("edit-profile-btn");

// Rename popup
const renamePopupEl = document.getElementById("rename-popup");
const renameInputEl = document.getElementById("rename-input");
const renameSaveBtnEl = document.getElementById("rename-save-btn");
const renameCancelBtnEl = document.getElementById("rename-cancel-btn");
let renameTargetId = null;

// Theme buttons
const themeBtns = document.querySelectorAll(".theme-btn");

// Toast
const toastEl = document.getElementById("toast");

// Message context menu
let messageMenuEl = null;
let messageMenuTargetIndex = null;

// Call overlay refs
const callBtnEl = document.getElementById("call-btn");
const callOverlayEl = document.getElementById("call-overlay");
const callAvatarEl = document.getElementById("call-avatar");
const callNameEl = document.getElementById("call-name");
const callStatusEl = document.getElementById("call-status");
const callTimerEl = document.getElementById("call-timer");
const callEndBtnEl = document.getElementById("call-end-btn");
let callTimerInterval = null;
let callSeconds = 0;
let lastCallInitiator = "you"; // "you" or "them"

// =========================
// Theme
// =========================

function applyTheme(theme) {
  body.classList.remove("light-theme", "dark-theme");
  themeBtns.forEach(btn => btn.classList.remove("active"));

  if (theme === "light") body.classList.add("light-theme");
  else if (theme === "dark") body.classList.add("dark-theme");

  const btn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
  if (btn) btn.classList.add("active");

  localStorage.setItem(LS_KEY_THEME, theme);
}

function initTheme() {
  const saved = localStorage.getItem(LS_KEY_THEME) || "cute";
  applyTheme(saved);
}

themeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const t = btn.getAttribute("data-theme");
    applyTheme(t);
  });
});

initTheme();

// =========================
// Toast
// =========================

let toastTimeout = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("visible");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, 2000);
}

// =========================
// Message context menu (delete single message)
// =========================

function ensureMessageMenu() {
  if (messageMenuEl) return;
  messageMenuEl = document.createElement("div");
  messageMenuEl.id = "message-menu";
  messageMenuEl.className = "message-menu";
  messageMenuEl.textContent = "Delete message";
  document.body.appendChild(messageMenuEl);

  messageMenuEl.addEventListener("click", () => {
    if (messageMenuTargetIndex == null) {
      hideMessageMenu();
      return;
    }
    const msgs = conversations[currentContactId] || [];
    if (messageMenuTargetIndex >= 0 && messageMenuTargetIndex < msgs.length) {
      msgs.splice(messageMenuTargetIndex, 1);
      conversations[currentContactId] = msgs;
      saveState();
      renderContacts();
      renderChat(currentContactId);
      showToast("Message deleted");
    }
    hideMessageMenu();
  });

  document.addEventListener("click", (e) => {
    if (messageMenuEl && !messageMenuEl.contains(e.target)) {
      hideMessageMenu();
    }
  });
}

function showMessageMenu(x, y, msgIndex) {
  ensureMessageMenu();
  messageMenuTargetIndex = msgIndex;
  messageMenuEl.style.top = y + "px";
  messageMenuEl.style.left = x + "px";
  messageMenuEl.classList.add("visible");
}

function hideMessageMenu() {
  if (messageMenuEl) messageMenuEl.classList.remove("visible");
  messageMenuTargetIndex = null;
}

function attachLongPressHandlers() {
  const bubbles = chatBodyEl.querySelectorAll(".message-bubble");
  bubbles.forEach(bubble => {
    const idxStr = bubble.getAttribute("data-index");
    if (idxStr == null) return;
    const msgIndex = parseInt(idxStr, 10);
    let pressTimer = null;

    const start = () => {
      pressTimer = setTimeout(() => {
        const rect = bubble.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        showMessageMenu(x, y, msgIndex);
      }, 600);
    };

    const cancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    bubble.addEventListener("mousedown", start);
    bubble.addEventListener("mouseup", cancel);
    bubble.addEventListener("mouseleave", cancel);

    bubble.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => {
        const rect = bubble.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        showMessageMenu(x, y, msgIndex);
      }, 600);
    }, { passive: true });

    bubble.addEventListener("touchend", cancel, { passive: true });
    bubble.addEventListener("touchmove", cancel, { passive: true });
  });
}

// =========================
// Contacts render
// =========================

function renderContacts() {
  alexAvatarEl.src = contactSettings.alex.avatar || defaultAvatars.alex;
  ellyAvatarEl.src = contactSettings.elly.avatar || defaultAvatars.elly;
  officeAvatarEl.src = contactSettings.office.avatar || defaultAvatars.office;
  friendAvatarEl.src = contactSettings.friend.avatar || defaultAvatars.friend;
  notesAvatarEl.src = contactSettings.notes.avatar || defaultAvatars.notes;

  document.querySelectorAll(".contact-name").forEach(el => {
    const id = el.getAttribute("data-contact-name");
    el.textContent = contactSettings[id].name || id;
  });

  function setPreview(id, el) {
    const msgs = conversations[id] || [];
    if (msgs.length === 0) {
      if (id === "alex") el.textContent = "Tap to chat with Alex";
      else if (id === "elly") el.textContent = "Tap to chat with Elly";
      else el.textContent = "Tap to chat";
      return;
    }
    const last = msgs[msgs.length - 1];
    const prefix = last.role === "user" ? "You: " : "";
    if (last.type === "image") el.textContent = prefix + "[Image]";
    else if (last.type === "call") el.textContent = prefix + last.content;
    else el.textContent = prefix + last.content.slice(0, 40);
  }

  setPreview("alex", alexPreviewEl);
  setPreview("elly", ellyPreviewEl);
  setPreview("office", officePreviewEl);
  setPreview("friend", friendPreviewEl);
  setPreview("notes", notesPreviewEl);
}

// =========================
// Chat render
// =========================

function renderChat(contactId) {
  chatBodyEl.innerHTML = "";
  hideMessageMenu();
  const msgs = conversations[contactId] || [];
  let lastDateKey = null;

  if (msgs.length === 0) {
    const empty = document.createElement("div");
    empty.style.textAlign = "center";
    empty.style.marginTop = "24px";
    empty.style.fontSize = "12px";
    empty.style.opacity = "0.8";
    if (contactId === "notes") {
      empty.textContent = "This is your space. Drop any thoughts, notes, or to‑dos here.";
    } else if (contactId === "office") {
      empty.textContent = "Plan work, track tasks, or jot ideas down here.";
    } else {
      empty.textContent = `Start a conversation with ${contactSettings[contactId].name}.`;
    }
    chatBodyEl.appendChild(empty);
    return;
  }

  msgs.forEach((msg, idx) => {
    const msgDate = msg._dateObj ? new Date(msg._dateObj) : new Date();
    const dKey = msg.dateStr || getDateKey(msgDate);

    if (dKey !== lastDateKey) {
      const dateRow = document.createElement("div");
      dateRow.classList.add("date-separator");
      const badge = document.createElement("span");
      badge.classList.add("date-badge");
      badge.textContent = formatDateLabel(msgDate);
      dateRow.appendChild(badge);
      chatBodyEl.appendChild(dateRow);
      lastDateKey = dKey;
    }

    if (msg.type === "call") {
      const callRow = document.createElement("div");
      callRow.classList.add("date-separator");
      const callBadge = document.createElement("span");
      callBadge.classList.add("call-badge");
      if (msg.subtype === "missed") callBadge.classList.add("call-badge-missed");
      callBadge.textContent = msg.content;
      callRow.appendChild(callBadge);
      chatBodyEl.appendChild(callRow);
      return;
    }

    const row = document.createElement("div");
    row.classList.add("message-row", msg.role === "user" ? "me" : "them");

    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble");
    bubble.setAttribute("data-index", idx.toString());

    const prev = msgs[idx - 1];
    const next = msgs[idx + 1];
    const isStart = !prev || prev.role !== msg.role || prev.dateStr !== msg.dateStr;
    const isEnd = !next || next.role !== msg.role || next.dateStr !== msg.dateStr;

    if (isStart) bubble.classList.add("group-start");
    if (isEnd) bubble.classList.add("group-end");

    if (msg.type === "image") {
      const img = document.createElement("img");
      img.src = msg.imageData;
      img.alt = "Image";
      img.classList.add("message-image");
      bubble.appendChild(img);
      if (msg.content) {
        const caption = document.createElement("div");
        caption.textContent = msg.content;
        bubble.appendChild(caption);
      }
    } else {
      bubble.textContent = msg.content;
    }

    const meta = document.createElement("div");
    meta.classList.add("message-meta");
    const timeSpan = document.createElement("span");
    timeSpan.textContent = msg.time || "";
    meta.appendChild(timeSpan);

    if (msg.role === "user") {
      const statusSpan = document.createElement("span");
      statusSpan.classList.add("status-indicator");
      if (msg.status === "read") statusSpan.textContent = "✓✓ Read";
      else if (msg.status === "delivered") statusSpan.textContent = "✓✓ Delivered";
      else statusSpan.textContent = "✓ Sent";
      meta.appendChild(statusSpan);
    }

    bubble.appendChild(meta);
    row.appendChild(bubble);
    chatBodyEl.appendChild(row);
  });

  chatBodyEl.scrollTop = chatBodyEl.scrollHeight;
  attachLongPressHandlers();
}

// =========================
// Typing indicator + header status
// =========================

function showTyping(name, contactId) {
  let typingText = "";
  if (contactId === "notes") typingText = "Writing this down...";
  else if (contactId === "office") typingText = "Preparing something for you...";
  else typingText = `${name} is typing...`;

  typingTextEl.textContent = typingText;
  typingIndicatorEl.classList.add("visible");
  chatStatusEl.textContent = "Typing…";
}

function restoreStatus(contactId) {
  const now = new Date();
  if (contactId === "alex") {
    chatStatusEl.textContent = Math.random() > 0.2 ? "Online" : "Last seen just now";
  } else if (contactId === "elly") {
    chatStatusEl.textContent = Math.random() > 0.5 ? "Online" : "Last seen recently";
  } else if (contactId === "notes") {
    chatStatusEl.textContent = "Notes · private";
  } else if (contactId === "office") {
    chatStatusEl.textContent = "Work / tasks";
  } else {
    chatStatusEl.textContent = "Last seen " + formatTime(now);
  }
}

function hideTyping(contactId) {
  typingIndicatorEl.classList.remove("visible");
  restoreStatus(contactId);
}

// =========================
// Backend-based replies
// =========================

const BACKEND_URL = "https://noisy-haze-453b.crinkle-crease-official.workers.dev";

async function getMockReply(contactId, userText) {
  try {
    const history = buildHistoryForBackend(contactId);

    const res = await fetch(BACKEND_URL + "/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, userText, history })
    });

    if (!res.ok) {
      console.error("Backend error status:", res.status);
      return "Sorry, something went wrong on the server.";
    }

    const data = await res.json();
    return data.replyText || "I’m here, talk to you.";
  } catch (err) {
    console.error("Error calling backend:", err);
    return "I couldn’t reach the server, but I’m still here.";
  }
}

function mockSendMessage(contactId, userText) {
  const base = 700;
  const extraPerChar = 8; // ms per char, capped
  const len = userText ? Math.min(userText.length, 120) : 0;
  const delay = base + len * extraPerChar + Math.floor(Math.random() * 600);

  return new Promise(resolve => {
    setTimeout(async () => {
      const replyText = await getMockReply(contactId, userText);
      resolve(replyText);
    }, delay);
  });
}

// =========================
// Sending messages (text + images)
// =========================

async function sendMessage({ text, imageData }) {
  if (!text && !imageData) return;

  const now = new Date();
  const timeStr = formatTime(now);
  const dateKey = getDateKey(now);

  conversations[currentContactId] = conversations[currentContactId] || [];

  const userMsg = {
    role: "user",
    content: text || "",
    time: timeStr,
    dateStr: dateKey,
    status: "sent",
    type: imageData ? "image" : "text",
    imageData: imageData || null,
    _dateObj: now.toISOString()
  };

  conversations[currentContactId].push(userMsg);
  renderChat(currentContactId);
  renderContacts();
  saveState();
  messageInputEl.value = "";
  chatBodyEl.scrollTop = chatBodyEl.scrollHeight;

  const name = contactSettings[currentContactId].name;
  showTyping(name, currentContactId);

  const msgs = conversations[currentContactId];
  const lastUser = msgs.filter(m => m.role === "user").slice(-1)[0];
  if (lastUser) lastUser.status = "delivered";
  renderChat(currentContactId);
  saveState();

  let backendText = text;
  if (!backendText && imageData) {
    backendText = "I just sent you a picture. It's something I wanted to show you.";
  }

  const replyText = await mockSendMessage(currentContactId, backendText);

  hideTyping(currentContactId);

  setTimeout(() => {
    const msgsAfter = conversations[currentContactId] || [];
    const lastUserAfter = msgsAfter.filter(m => m.role === "user").slice(-1)[0];
    if (lastUserAfter) lastUserAfter.status = "read";
    renderChat(currentContactId);
    saveState();
  }, 400);

  const replyTime = formatTime(new Date());
  const replyMsg = {
    role: "assistant",
    content: replyText,
    time: replyTime,
    dateStr: dateKey,
    type: "text",
    _dateObj: new Date().toISOString()
  };
  conversations[currentContactId].push(replyMsg);
  renderChat(currentContactId);
  renderContacts();
  saveState();
}

async function handleSend() {
  const text = messageInputEl.value.trim();
  await sendMessage({ text, imageData: null });
}

sendBtnEl.addEventListener("click", handleSend);
messageInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Keep chat scrolled when focusing input (helps on mobile)
messageInputEl.addEventListener("focus", () => {
  setTimeout(() => {
    chatBodyEl.scrollTop = chatBodyEl.scrollHeight;
  }, 100);
});

attachBtnEl.addEventListener("click", () => {
  imageInputEl.click();
});

imageInputEl.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!messageInputEl.value.trim()) {
    showToast("Add a short caption so they know what the picture is.");
  }
  const reader = new FileReader();
  reader.onload = async function(evt) {
    const dataUrl = evt.target.result;
    await sendMessage({ text: messageInputEl.value.trim(), imageData: dataUrl });
  };
  reader.readAsDataURL(file);
});

// =========================
// Profile modal
// =========================

let modalContactId = "alex";

function getContactAbout(id) {
  if (id === "alex") {
    return `
<strong>About Alex</strong><br>
British businessman, travels a lot for work. Met Mona in India on a business trip and has been in a relationship with her for over 2 years. Very in love, a bit possessive and clingy, gets jealous easily but adores her. Calls her “love”, “babe”, and “sweetheart”.
`;
  }
  if (id === "elly") {
    return `
<strong>About Elly</strong><br>
American best friend, living in Australia with her boyfriend Leon. She has known Mona for around 10 years, knows all her drama with Alex, and talks in a casual, outspoken, and supportive way.
`;
  }
  if (id === "office") {
    return `
<strong>About Office</strong><br>
A placeholder contact for work or projects. You can rename and customize this contact.
`;
  }
  if (id === "friend") {
    return `
<strong>About Friend</strong><br>
A generic friend contact you can rename and use however you like.
`;
  }
  if (id === "notes") {
    return `
<strong>About Notes</strong><br>
Use this chat as a space to drop random thoughts, to‑dos, and ideas.
`;
  }
  return "";
}

function openProfileModal(id) {
  modalContactId = id;
  const settings = contactSettings[id];
  modalAvatarEl.src = settings.avatar;
  modalAboutEl.innerHTML = getContactAbout(id);

  let existingDeleteBtn = document.getElementById("delete-chat-btn");
  if (!existingDeleteBtn) {
    const actions = profileModalEl.querySelector(".modal-actions");
    const btn = document.createElement("button");
    btn.id = "delete-chat-btn";
    btn.textContent = "Delete chat";
    btn.style.marginLeft = "8px";
    btn.style.borderRadius = "999px";
    btn.style.border = "none";
    btn.style.padding = "6px 14px";
    btn.style.fontSize = "13px";
    btn.style.cursor = "pointer";
    btn.style.background = "#e53935";
    btn.style.color = "#fff";
    actions.appendChild(btn);

    btn.addEventListener("click", () => {
      const confirmDelete = window.confirm("Delete all messages in this chat? This cannot be undone.");
      if (!confirmDelete) return;

      conversations[modalContactId] = [];
      saveState();
      renderContacts();
      if (modalContactId === currentContactId) {
        renderChat(currentContactId);
      }
      showToast("Chat deleted");
      closeProfileModal();
    });
  }

  profileModalEl.classList.add("visible");
}

function closeProfileModal() {
  profileModalEl.classList.remove("visible");
}

chatAvatarEl.addEventListener("click", () => {
  openProfileModal(currentContactId);
});

profileModalCloseEl.addEventListener("click", closeProfileModal);
profileModalEl.addEventListener("click", (e) => {
  if (e.target === profileModalEl) closeProfileModal();
});

avatarInputEl.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    contactSettings[modalContactId].avatar = dataUrl;
    saveState();
    renderContacts();
    if (modalContactId === currentContactId) {
      chatAvatarEl.src = dataUrl;
    }
    modalAvatarEl.src = dataUrl;
    showToast("Profile photo saved");
  };
  reader.readAsDataURL(file);
});

editProfileBtnEl.addEventListener("click", () => {
  openProfileModal(currentContactId);
});

// =========================
// Fake call feature
// =========================

function startCall() {
  if (!callOverlayEl) return;
  lastCallInitiator = "you";
  const settings = contactSettings[currentContactId];

  callAvatarEl.src = settings.avatar;
  callNameEl.textContent = settings.name;
  callStatusEl.textContent = "Calling…";
  callTimerEl.textContent = "00:00";
  callSeconds = 0;

  callOverlayEl.classList.add("visible");

  setTimeout(() => {
    if (!callOverlayEl.classList.contains("visible")) return;
    callStatusEl.textContent = "On call";
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      callSeconds += 1;
      const mm = String(Math.floor(callSeconds / 60)).padStart(2, "0");
      const ss = String(callSeconds % 60).padStart(2, "0");
      callTimerEl.textContent = `${mm}:${ss}`;
    }, 1000);
  }, 1500);
}

function endCall() {
  if (callOverlayEl) callOverlayEl.classList.remove("visible");
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }

  const now = new Date();
  const timeStr = formatTime(now);
  const dateKey = getDateKey(now);

  const durationSec = callSeconds;
  let durationLabel = "Missed call";
  let subtype = "missed";
  if (durationSec > 0) {
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    durationLabel = `${mm}:${ss}`;
    subtype = "completed";
  }

  const contactName = contactSettings[currentContactId].name;
  let content;
  if (lastCallInitiator === "you") {
    if (durationSec > 0) {
      content = `You called ${contactName} – ${durationLabel}`;
    } else {
      content = `You tried calling ${contactName} – missed call`;
    }
  } else {
    if (durationSec > 0) {
      content = `${contactName} called you – ${durationLabel}`;
    } else {
      content = `${contactName} tried calling – missed call`;
    }
  }

  const callMsg = {
    role: "assistant",
    content,
    time: timeStr,
    dateStr: dateKey,
    type: "call",
    subtype,
    _dateObj: now.toISOString()
  };

  conversations[currentContactId] = conversations[currentContactId] || [];
  conversations[currentContactId].push(callMsg);
  saveState();
  renderContacts();
  renderChat(currentContactId);

  callSeconds = 0;
}

if (callBtnEl) {
  callBtnEl.addEventListener("click", startCall);
}
if (callEndBtnEl) {
  callEndBtnEl.addEventListener("click", endCall);
}

// =========================
// Rename contacts
// =========================

document.querySelectorAll(".edit-contact-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = btn.getAttribute("data-contact-id");
    renameTargetId = id;
    const rect = btn.getBoundingClientRect();
    renamePopupEl.style.top = (rect.bottom + 4) + "px";
    renamePopupEl.style.left = (rect.left - 40) + "px";
    renameInputEl.value = contactSettings[id].name || "";
    renamePopupEl.classList.add("visible");
    renameInputEl.focus();
  });
});

renameSaveBtnEl.addEventListener("click", () => {
  const newName = renameInputEl.value.trim();
  if (renameTargetId && newName) {
    contactSettings[renameTargetId].name = newName;
    saveState();
    renderContacts();
    if (renameTargetId === currentContactId) {
      chatNameEl.textContent = newName;
    }
    showToast("Name saved");
  }
  renamePopupEl.classList.remove("visible");
  renameTargetId = null;
});

renameCancelBtnEl.addEventListener("click", () => {
  renamePopupEl.classList.remove("visible");
  renameTargetId = null;
});

document.addEventListener("click", (e) => {
  if (!renamePopupEl.contains(e.target) && !e.target.classList.contains("edit-contact-btn")) {
    renamePopupEl.classList.remove("visible");
    renameTargetId = null;
  }
});

// =========================
// Contact switching
// =========================

function setActiveContact(id) {
  currentContactId = id;
  document.querySelectorAll(".contact").forEach(el => {
    el.classList.toggle("active", el.getAttribute("data-contact-id") === id);
  });

  const settings = contactSettings[id];
  chatNameEl.textContent = settings.name;
  chatAvatarEl.src = settings.avatar;
  restoreStatus(id);
  renderChat(id);

  if (id === "notes") {
    messageInputEl.placeholder = "Write a note...";
  } else {
    messageInputEl.placeholder = `Message ${settings.name}...`;
  }

  document.querySelector(".chat-container").classList.add("visible");
}

contactsEls.forEach(el => {
  el.addEventListener("click", () => {
    const id = el.getAttribute("data-contact-id");
    setActiveContact(id);
  });
});

backBtnEl.addEventListener("click", () => {
  document.querySelector(".chat-container").classList.remove("visible");
});

// =========================
// Init: Alex first message
// =========================

function initChat() {
  renderContacts();
  setActiveContact("alex");

  if (!conversations.alex || conversations.alex.length === 0) {
    const now = new Date();
    const timeStr = formatTime(now);
    const dateKey = getDateKey(now);
    conversations.alex.push({
      role: "assistant",
      content: "Hey love, it’s Alex. I’ve been thinking about you all day and just wanted to check in on you.",
      time: timeStr,
      dateStr: dateKey,
      type: "text",
      _dateObj: now.toISOString()
    });
    saveState();
    renderChat("alex");
    renderContacts();
  }
}

initChat();