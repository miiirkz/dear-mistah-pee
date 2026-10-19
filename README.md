# To Mistah, Love Your Creechas 💙

A digital keepsake from **12 · Joseph the Dreamer (SJTD)** for Mistah Pee. Plain HTML/CSS/JS — no build step — hosted on GitHub Pages, with Firebase (Authentication + Firestore, free tier) storing the letters.

## Who can do what

| Who | Can do |
| --- | --- |
| **Students / classmates** | Write and send a letter (anonymous or with a name). They **cannot** read, list or delete any letters — not even their own. They never see the letters wall. |
| **Admin** (the site owner) | Sign in, see every letter, and **delete** any letter (with a confirm prompt). |
| **Mistah Pee** (adviser) | Sign in and **read only**. He sees just the letters, as blue envelopes that pop in one after another. Tap an envelope: the flap opens and the letter slides out onto the star-cloud paper. Swipe left/right (or use the ‹ › buttons / ←/→ keys) for the next letter, which plays the same envelope-opening animation. Esc closes. Reduced-motion settings are respected. He cannot edit or delete. |

These rules are enforced by Firebase **security rules** (`firestore.rules`) on the server, not just by the page, so they can't be bypassed from the browser. The site starts with **no letters**; only real submissions appear.

Until Firebase is set up, the site shows a friendly "not switched on yet" message and the form is disabled.

## Setup (one time, ~15 minutes, no coding)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Add project** → name it (e.g. `dear-mistah-pee`) → you can turn Google Analytics off → **Create**.

### 2. Turn on Authentication and Firestore
1. **Build → Authentication → Get started → Sign-in method**. Enable:
   - **Anonymous** (lets students send letters without an account), and
   - **Google** (for you and Mistah Pee). *Email/Password* also works if you prefer, but Google is simplest because its emails are always verified, which the rules require.
2. **Authentication → Settings → Authorized domains → Add domain**: add `miiirkz.github.io` (and your custom domain, if you use one).
3. **Build → Firestore Database → Create database** → start in **production mode** → pick a location → **Enable**.

### 3. Paste the config
1. **Project settings (gear icon) → General → Your apps → `</>` Web app** → register it (no hosting needed).
2. Copy the values shown into `firebase-config.js`, replacing every `YOUR_...` placeholder. (This config is public by design; it is safe to commit.)

### 4. Publish the rules
1. **Firestore Database → Rules**.
2. Delete what's there, paste the entire contents of `firestore.rules`, and click **Publish**.

### 5. Set the admin and adviser emails
Roles are stored in a `roles` collection, one document per person:
1. **Firestore Database → Data → Start collection** → Collection ID: `roles`.
2. Document ID: **your Google email, all lowercase** (e.g. `miiirkz@gmail.com`). Add a field `role` (string) = `admin`. Save.
3. **Add document** again: Document ID = **Mistah Pee's Google email, lowercase**, field `role` (string) = `adviser`.

Only people added here (and signed in with that exact verified email) can read letters. Remove a document to remove access.

### 6. Try it
Open the site → send a test letter as a student → scroll to the bottom and click **Admin / adviser sign in** → sign in with Google. Delete the test letter when you're done.

## Run locally
Open `index.html` in your browser, or run `python3 -m http.server 8000` and visit <http://localhost:8000>. If you test on a local address, add `localhost` to Firebase **Authorized domains**.

## Deploy on GitHub Pages
1. **Settings → Pages**
2. **Source**: Deploy from a branch, **Branch**: `main` and `/ (root)`
3. Save and wait for deployment

Site URL: `https://miiirkz.github.io/dear-mistah-pee/`

## Files
- `index.html`, `styles.css`, `script.js` — the site
- `firebase-config.js` — your Firebase web config (fill in the placeholders)
- `firestore.rules` — security rules to paste into Firebase

---
Made with love by your Creechas.
