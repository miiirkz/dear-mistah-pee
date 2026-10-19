(() => {
  "use strict";

  // Old versions of this site stored sample letters in the browser. Remove them.
  try {
    localStorage.removeItem("dearMistahPee.entries.v1");
  } catch {
    /* storage unavailable */
  }

  const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = ["apiKey", "authDomain", "projectId", "appId"].every(
    (key) => typeof cfg[key] === "string" && cfg[key] && !cfg[key].startsWith("YOUR_")
  );

  const $ = (id) => document.getElementById(id);
  const form = $("letter-form");
  const statusEl = $("form-status");
  const submitBtn = $("submit-btn");
  const nameInput = $("sender-name");
  const anonymousToggle = $("anonymous-toggle");
  const wallEl = $("letters-wall");
  const reader = $("reader");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const signinLink = $("signin-link");
  const signoutBtn = $("signout-btn");
  const authWho = $("auth-who");
  const authStatus = $("auth-status");
  const loginDialog = $("login-dialog");
  const loginError = $("login-error");

  let fb = null;
  let role = null; // "admin" | "adviser" | null
  let entries = [];
  let activeFilter = "All";
  let visibleEntries = [];
  let unsubscribe = null;
  let authToken = 0;
  const seenIds = new Set();

  /* ---------- Sign-in modal ---------- */

  function forceOpenLoginModal() {
    if (!loginDialog || typeof loginDialog.showModal !== "function") return;
    loginError.textContent = "";

    if (!loginDialog.open) {
      try {
        loginDialog.showModal();
      } catch (e) {
        console.error("Modal open failed:", e);
      }
    }

    // Re-open shortly after in case something closes it
    setTimeout(() => {
      if (!loginDialog.open) {
        try {
          loginDialog.showModal();
        } catch (e) {
          console.error("Modal reopen failed:", e);
        }
      }
    }, 150);
  }

  /* ---------- Firebase loading ---------- */

  let fbPromise = null;
  function loadFirebase() {
    if (!fbPromise) {
      fbPromise = (async () => {
        const [appM, authM, fsM] = await Promise.all([
          import(`${SDK}/firebase-app.js`),
          import(`${SDK}/firebase-auth.js`),
          import(`${SDK}/firebase-firestore.js`),
        ]);
        const app = appM.initializeApp(cfg);
        return { auth: authM.getAuth(app), db: fsM.getFirestore(app), authM, fsM };
      })();
      fbPromise.catch(() => {
        fbPromise = null;
      });
    }
    return fbPromise;
  }

  /* ---------- Helpers ---------- */

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#ffd4d4" : "#cbe5ff";
  }

  function setAuthStatus(message) {
    authStatus.textContent = message || "";
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- Roles / UI state ---------- */

  function stopListening() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    entries = [];
    seenIds.clear();
  }

  function applyRole(newRole, user) {
    role = newRole;
    const canRead = role === "admin" || role === "adviser";
    document.body.classList.toggle("role-admin", role === "admin");
    document.body.classList.toggle("role-adviser", role === "adviser");
    // The adviser sees only the letters; students never see the wall.
    document.querySelectorAll("[data-student-area]").forEach((el) => {
      el.hidden = role === "adviser";
    });
    reader.hidden = !canRead;
    $("reader-title").textContent =
      role === "adviser" ? "Letters for you, Mistah Pee 💙" : "Letters Wall";
    signinLink.hidden = canRead;
    signoutBtn.hidden = !canRead;
    authWho.hidden = !canRead;
    authWho.textContent = canRead
      ? `Signed in as ${role === "admin" ? "admin" : "adviser"} (${user.email})`
      : "";
    if (!canRead) closeViewer();
    renderWall();
  }

  function startListening() {
    const { db, fsM } = fb;
    const q = fsM.query(fsM.collection(db, "letters"), fsM.orderBy("createdAt", "desc"));
    unsubscribe = fsM.onSnapshot(
      q,
      (snap) => {
        entries = snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            type: String(data.type || "Letter"),
            sender: String(data.sender || "Anonymous"),
            message: String(data.message || ""),
            date: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date(),
          };
        });
        renderWall();
      },
      (err) => {
        console.error("Letters listener error:", err);
        setAuthStatus(`Couldn't load the letters: ${err.code || err.message || err}`);
      }
    );
  }

  async function handleUser(user) {
    const token = ++authToken;
    stopListening();
    if (!user || user.isAnonymous) {
      applyRole(null);
      return;
    }

    console.log("SIGNED IN EMAIL:", user.email);

    let newRole = null;
    try {
      const { db, fsM } = fb;
      const snap = await fsM.getDoc(fsM.doc(db, "roles", (user.email || "").toLowerCase()));
      const value = snap.exists() ? snap.data().role : null;
      console.log("ROLE DOC EXISTS:", snap.exists(), "ROLE VALUE:", value);
      if (value === "admin" || value === "adviser") newRole = value;
    } catch (err) {
      console.error("ROLE LOOKUP ERROR:", err);
      setAuthStatus(`Role lookup error: ${err.code || err.message || err}`);
      newRole = null;
    }

    if (token !== authToken) return;
    if (newRole) {
      setAuthStatus("");
      applyRole(newRole, user);
      startListening();
    } else {
      applyRole(null);
      if (!authStatus.textContent) {
        setAuthStatus("This account isn't on the admin/adviser list, so it can't view letters.");
      }
      try {
        await fb.authM.signOut(fb.auth);
      } catch {
        /* ignore */
      }
    }
  }

  /* ---------- Wall ---------- */

  function renderWall() {
    wallEl.innerHTML = "";
    visibleEntries = [];
    if (role !== "admin" && role !== "adviser") return;

    const filtered =
      activeFilter === "All" ? entries : entries.filter((e) => e.type === activeFilter);
    visibleEntries = filtered;

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = entries.length
        ? "No entries yet for this filter."
        : "No letters yet. When your Creechas send theirs, they'll appear here. 💙";
      wallEl.appendChild(empty);
      refreshViewer();
      return;
    }

    filtered.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "letter-item";
      if (!seenIds.has(entry.id)) {
        item.classList.add("pop");
        item.style.setProperty("--i", String(Math.min(index, 24)));
      }

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
      card.setAttribute("aria-label", `Open ${entry.type} from ${entry.sender}`);
      card.addEventListener("click", () => openViewer(index, card));
      item.appendChild(card);

      if (role === "admin") {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete-btn";
        del.textContent = "Delete";
        del.setAttribute("aria-label", `Delete ${entry.type} from ${entry.sender}`);
        del.addEventListener("click", () => deleteLetter(entry));
        item.appendChild(del);
      }

      wallEl.appendChild(item);
      seenIds.add(entry.id);
    });
    refreshViewer();
  }

  async function deleteLetter(entry) {
    if (role !== "admin") return;
    const ok = window.confirm(
      `Delete this ${entry.type.toLowerCase()} from ${entry.sender}? This can't be undone.`
    );
    if (!ok) return;
    try {
      const { db, fsM } = fb;
      await fsM.deleteDoc(fsM.doc(db, "letters", entry.id));
      setAuthStatus("Letter deleted.");
    } catch {
      setAuthStatus("Couldn't delete that letter. Please try again.");
    }
  }

  /* ---------- Viewer ---------- */

  const viewer = $("letter-viewer");
  const viewerPrev = $("viewer-prev");
  const viewerNext = $("viewer-next");
  const viewerClose = $("viewer-close");
  const viewerDelete = $("viewer-delete");
  let currentIndex = 0;
  let currentId = null;
  let lastTrigger = null;

  function showLetter(index, direction = 0) {
    const total = visibleEntries.length;
    if (!total) return;
    currentIndex = ((index % total) + total) % total;
    const entry = visibleEntries[currentIndex];
    currentId = entry.id;
    $("viewer-title").textContent = entry.type;
    $("viewer-message").textContent = entry.message;
    $("viewer-meta").textContent = `— ${entry.sender} · ${formatDate(entry.date)}`;
    $("viewer-count").textContent = `${currentIndex + 1} of ${total}`;
    viewerPrev.hidden = viewerNext.hidden = total < 2;
    viewerDelete.hidden = role !== "admin";

    // Replay the envelope: it pops in, the flap opens, then the letter slides out.
    viewer.classList.remove("play", "from-left", "from-right");
    void viewer.offsetWidth;
    if (direction) viewer.classList.add(direction > 0 ? "from-right" : "from-left");
    viewer.classList.add("play");
  }

  // Keep the open letter in sync when letters are added or deleted live.
  function refreshViewer() {
    if (viewer.hidden) return;
    if (!visibleEntries.length) {
      closeViewer();
      return;
    }
    const idx = visibleEntries.findIndex((e) => e.id === currentId);
    if (idx === -1) {
      showLetter(Math.min(currentIndex, visibleEntries.length - 1));
    } else {
      currentIndex = idx;
      $("viewer-count").textContent = `${idx + 1} of ${visibleEntries.length}`;
    }
    viewerPrev.hidden = viewerNext.hidden = visibleEntries.length < 2;
  }

  function setBackgroundInert(value) {
    document.querySelectorAll("main, footer, .sky").forEach((el) => {
      el.inert = value;
    });
  }

  function openViewer(index, trigger) {
    lastTrigger = trigger;
    viewer.hidden = false;
    setBackgroundInert(true);
    document.body.classList.add("viewer-active");
    showLetter(index);
    viewerClose.focus();
  }

  function closeViewer() {
    if (viewer.hidden) return;
    viewer.hidden = true;
    viewer.classList.remove("play", "from-left", "from-right");
    setBackgroundInert(false);
    document.body.classList.remove("viewer-active");
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  viewerPrev.addEventListener("click", () => showLetter(currentIndex - 1, -1));
  viewerNext.addEventListener("click", () => showLetter(currentIndex + 1, 1));
  viewerClose.addEventListener("click", closeViewer);
  viewer.querySelector("[data-close]").addEventListener("click", closeViewer);
  viewerDelete.addEventListener("click", () => {
    const entry = visibleEntries[currentIndex];
    if (entry) deleteLetter(entry);
  });

  document.addEventListener("keydown", (event) => {
    if (viewer.hidden) return;
    if (event.key === "Escape") {
      closeViewer();
    } else if (event.key === "ArrowLeft") {
      showLetter(currentIndex - 1, -1);
    } else if (event.key === "ArrowRight") {
      showLetter(currentIndex + 1, 1);
    } else if (event.key === "Tab") {
      const focusable = [...viewer.querySelectorAll("button")].filter((el) => !el.hidden);
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

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "All";
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      seenIds.clear();
      renderWall();
    });
  });

  /* ---------- Submitting a letter (students: create only) ---------- */

  anonymousToggle.addEventListener("change", () => {
    const isAnonymous = anonymousToggle.checked;
    nameInput.disabled = isAnonymous;
    nameInput.placeholder = isAnonymous ? "Anonymous" : "Your name";
    if (isAnonymous) nameInput.value = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured) {
      setStatus("The letter box isn't set up yet. Please tell the site owner.", true);
      return;
    }

    const formData = new FormData(form);
    const type = String(formData.get("entryType") || "Letter");
    const anonymous = Boolean(formData.get("anonymous"));
    const senderRaw = String(formData.get("senderName") || "").trim().slice(0, 50);
    const sender = anonymous || !senderRaw ? "Anonymous" : senderRaw;
    const message = String(formData.get("message") || "").trim();

    if (!["Letter", "Memory", "Message"].includes(type)) {
      setStatus("Please choose what you'd like to share.", true);
      return;
    }
    if (!message) {
      setStatus("Please write your message before submitting.", true);
      return;
    }
    if (message.length > 1200) {
      setStatus("Please keep your message under 1200 characters.", true);
      return;
    }

    submitBtn.disabled = true;
    setStatus("Sending…");
    try {
      fb = fb || (await loadFirebase());
      const { auth, db, authM, fsM } = fb;
      if (!auth.currentUser) await authM.signInAnonymously(auth);
      await fsM.addDoc(fsM.collection(db, "letters"), {
        type,
        sender,
        message,
        createdAt: fsM.serverTimestamp(),
      });
      form.reset();
      nameInput.disabled = false;
      nameInput.placeholder = "Your name";
      setStatus("Your message was sent to Mistah Pee. 💙");
    } catch (err) {
      console.error("Submit failed:", err);
      setStatus(`Couldn't send: ${(err && (err.code || err.message)) || "unknown error"}`, true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- Admin / adviser sign-in ---------- */

  function friendlyAuthError(err) {
    const code = err && err.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-email"
    ) {
      return "That email or password didn't work.";
    }
    return `Couldn't sign in (${code || "unknown error"}). Please try again.`;
  }

  signinLink.addEventListener("click", () => {
    loginError.textContent = "";
    if (!configured) {
      setAuthStatus("Sign-in isn't available yet: the Firebase setup hasn't been finished.");
      return;
    }
    if (!loginDialog.open) loginDialog.showModal();
  });

  $("login-cancel").addEventListener("click", () => loginDialog.close());

  $("google-signin").addEventListener("click", async () => {
    loginError.textContent = "";
    try {
      fb = fb || (await loadFirebase());
      await fb.authM.signInWithPopup(fb.auth, new fb.authM.GoogleAuthProvider());
      loginDialog.close();
    } catch (err) {
      loginError.textContent = friendlyAuthError(err);
    }
  });

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    if (!email || !password) {
      loginError.textContent = "Please enter your email and password.";
      return;
    }
    try {
      fb = fb || (await loadFirebase());
      await fb.authM.signInWithEmailAndPassword(fb.auth, email, password);
      $("login-password").value = "";
      loginDialog.close();
    } catch (err) {
      loginError.textContent = friendlyAuthError(err);
    }
  });

  signoutBtn.addEventListener("click", async () => {
    if (fb) await fb.authM.signOut(fb.auth);
  });

  /* ---------- Start ---------- */

  // Show the sign-in modal first
  forceOpenLoginModal();

  if (!configured) {
    $("setup-notice").hidden = false;
    submitBtn.disabled = true;
  } else {
    loadFirebase()
      .then((loaded) => {
        fb = loaded;
        fb.authM.onAuthStateChanged(fb.auth, handleUser);
      })
      .catch(() => {
        setAuthStatus("Couldn't reach the server. Check your connection and refresh.");
      });
  }
})();
