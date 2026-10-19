const STORAGE_KEY = "dearMistahPee.entries.v1";

const seedEntries = [
  {
    id: crypto.randomUUID(),
    type: "Letter",
    sender: "Anonymous",
    message:
      "Thank you for believing in us, even during days we didn't believe in ourselves. We'll always carry your lessons with us.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    type: "Memory",
    sender: "A grateful Creecha",
    message:
      "Favorite memory: when you reminded us that being kind is also a form of strength. That stayed with me.",
    createdAt: new Date().toISOString(),
  },
];

const form = document.getElementById("letter-form");
const statusEl = document.getElementById("form-status");
const wallEl = document.getElementById("letters-wall");
const filterButtons = document.querySelectorAll(".filter-btn");
const nameInput = document.getElementById("sender-name");
const anonymousToggle = document.getElementById("anonymous-toggle");

let activeFilter = "All";
let visibleEntries = [];

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedEntries));
    return [...seedEntries];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...seedEntries];
  } catch {
    return [...seedEntries];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderEntries() {
  const entries = loadEntries();
  const filtered =
    activeFilter === "All"
      ? entries
      : entries.filter((entry) => entry.type === activeFilter);

  wallEl.innerHTML = "";
  visibleEntries = [];

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No entries yet for this filter.";
    wallEl.appendChild(empty);
    return;
  }

  filtered
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((entry) => {
      const index = visibleEntries.length;
      visibleEntries.push(entry);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "letter-card";
      card.innerHTML = `
        <span class="envelope-flap" aria-hidden="true"></span>
        <svg class="envelope-motif" viewBox="0 0 60 24" aria-hidden="true">
          <path d="M6 20a6 6 0 0 1 1-11 8 8 0 0 1 15-2 7 7 0 0 1 10 6 5 5 0 0 1-1 7z" opacity=".5"/>
          <path d="M46 4a6 6 0 1 0 6 8 5 5 0 0 1-6-8z"/>
          <path d="M40 18l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" transform="translate(6 -6) scale(.8)"/>
        </svg>
        <span class="letter-type"></span>
        <span class="letter-meta"></span>
      `;
      card.querySelector(".letter-type").textContent = entry.type;
      card.querySelector(".letter-meta").textContent = `— ${entry.sender}`;
      card.setAttribute(
        "aria-label",
        `Open ${entry.type} from ${entry.sender}`
      );
      card.addEventListener("click", () => openViewer(index, card));
      wallEl.appendChild(card);
    });
}

const viewer = document.getElementById("letter-viewer");
const viewerPaper = document.getElementById("viewer-paper");
const viewerPrev = document.getElementById("viewer-prev");
const viewerNext = document.getElementById("viewer-next");
const viewerClose = document.getElementById("viewer-close");
let currentIndex = 0;
let lastTrigger = null;

function showLetter(index, direction = 0) {
  const total = visibleEntries.length;
  if (!total) return;
  currentIndex = ((index % total) + total) % total;
  const entry = visibleEntries[currentIndex];
  document.getElementById("viewer-title").textContent = entry.type;
  document.getElementById("viewer-message").textContent = entry.message;
  document.getElementById("viewer-meta").textContent =
    `— ${entry.sender} · ${formatDate(entry.createdAt)}`;
  document.getElementById("viewer-count").textContent =
    `${currentIndex + 1} of ${total}`;
  viewerPrev.hidden = viewerNext.hidden = total < 2;

  viewerPaper.classList.remove("slide-in", "slide-from-left", "slide-from-right");
  void viewerPaper.offsetWidth;
  viewerPaper.classList.add(
    direction > 0 ? "slide-from-right" : direction < 0 ? "slide-from-left" : "slide-in"
  );
}

function setBackgroundInert(value) {
  document.querySelectorAll("main, footer, .sky").forEach((el) => {
    el.inert = value;
  });
}

function openViewer(index, trigger) {
  lastTrigger = trigger;
  viewer.hidden = false;
  viewer.classList.remove("is-open");
  void viewer.offsetWidth;
  viewer.classList.add("is-open");
  setBackgroundInert(true);
  document.body.classList.add("viewer-active");
  showLetter(index);
  viewerClose.focus();
}

function closeViewer() {
  if (viewer.hidden) return;
  viewer.hidden = true;
  viewer.classList.remove("is-open");
  setBackgroundInert(false);
  document.body.classList.remove("viewer-active");
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
}

viewerPrev.addEventListener("click", () => showLetter(currentIndex - 1, -1));
viewerNext.addEventListener("click", () => showLetter(currentIndex + 1, 1));
viewerClose.addEventListener("click", closeViewer);
viewer.querySelector("[data-close]").addEventListener("click", closeViewer);

document.addEventListener("keydown", (event) => {
  if (viewer.hidden) return;
  if (event.key === "Escape") {
    closeViewer();
  } else if (event.key === "ArrowLeft") {
    showLetter(currentIndex - 1, -1);
  } else if (event.key === "ArrowRight") {
    showLetter(currentIndex + 1, 1);
  } else if (event.key === "Tab") {
    const focusable = [...viewer.querySelectorAll("button")].filter(
      (el) => !el.hidden
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!viewer.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }
});

let touchStartX = null;
let touchStartY = null;
viewer.addEventListener(
  "touchstart",
  (event) => {
    const t = event.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  },
  { passive: true }
);
viewer.addEventListener(
  "touchend",
  (event) => {
    if (touchStartX === null) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = touchStartY = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showLetter(currentIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  },
  { passive: true }
);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffd4d4" : "#cbe5ff";
}

anonymousToggle.addEventListener("change", () => {
  const isAnonymous = anonymousToggle.checked;
  nameInput.disabled = isAnonymous;
  nameInput.placeholder = isAnonymous ? "Anonymous" : "Your name";
  if (isAnonymous) {
    nameInput.value = "";
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);

  const type = String(formData.get("entryType") || "Letter").trim();
  const anonymous = Boolean(formData.get("anonymous"));
  const senderRaw = String(formData.get("senderName") || "").trim();
  const sender = anonymous || !senderRaw ? "Anonymous" : senderRaw;
  const message = String(formData.get("message") || "").trim();

  if (!message) {
    setStatus("Please write your message before submitting.", true);
    return;
  }

  const entries = loadEntries();
  entries.push({
    id: crypto.randomUUID(),
    type,
    sender,
    message,
    createdAt: new Date().toISOString(),
  });

  saveEntries(entries);
  form.reset();
  nameInput.disabled = false;
  nameInput.placeholder = "Your name";
  setStatus("Your message was added to the keepsake. 💙");
  renderEntries();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "All";

    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    renderEntries();
  });
});

renderEntries();
