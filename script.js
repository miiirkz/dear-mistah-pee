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
      const card = document.createElement("article");
      card.className = "letter-card";

      card.innerHTML = `
        <span class="letter-type">${entry.type}</span>
        <p class="letter-message"></p>
        <p class="letter-meta">— ${entry.sender} · ${formatDate(entry.createdAt)}</p>
      `;

      card.querySelector(".letter-message").textContent = entry.message;
      wallEl.appendChild(card);
    });
}

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
