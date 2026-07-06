# Fing Pong 🏓

Body-controlled Pong for a phone camera + projector. Two tracking modes, each on its own page:

| Page | Tracking | Camera | Best for |
|------|----------|--------|----------|
| `index.html` | Reflective wristband (brightness) | **rear** | Low latency, no download, works on weak Wi-Fi |
| `movenet.html` | MoveNet body pose (ml5.js) | **front** | Robust wrist tracking, but downloads an ML model |

Both need **HTTPS** for the iPhone camera to turn on — which GitHub Pages gives you for free.

---

## Deploy to GitHub Pages

1. Go to **github.com** → sign in (or make a free account).
2. Click **New repository**. Name it `fing-pong` (no spaces or repos names break). Set it **Public**. Create it.
3. Click **Add file → Upload files**, then drag in **all** of these:
   - `index.html`
   - `movenet.html`
   - `sketch.js`
   - `sketch-movenet.js`
   - `style.css`
   - *(You can skip the big `p5.js`, `p5.sound.min.js`, and the screenshot — they aren't used; the pages load p5 from a CDN.)*
4. Click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment → Branch**, pick **main**, folder **/(root)**, click **Save**.
6. Wait ~1–2 minutes. Your links:
   - Reflective: `https://YOURNAME.github.io/fing-pong/`
   - MoveNet:    `https://YOURNAME.github.io/fing-pong/movenet.html`

---

## Playing it (iPhone 11 → XGIMI H1)

1. **Turn off** portrait orientation lock, rotate phone to **landscape**, then open the link.
2. **Tap the screen once** — iOS needs a tap to start the camera and go fullscreen.
3. **Connect to the projector:**
   - **Wired (best, zero lag):** Lightning → Digital AV (HDMI) adapter into the H1's HDMI port.
   - **Wireless:** open **AirScreen** on the H1, then iPhone Control Center → **Screen Mirroring** → pick it. (Slight lag.)
4. Place the phone on a tripod/table facing you.

### Reflective mode (`index.html`)
- Wear a **bright reflective wristband**; move your wrist to slide the paddle.
- **Calibrate on the fly:** tap the on-screen **+ / −** buttons (bottom-right) to raise/lower the brightness threshold until the green "LOCK: YES" stays on only for your band.
- Keep bright lights / the projector beam out of the camera's view — they fool brightness tracking.
- *(On a laptop for testing: ↑/↓ arrows change threshold, `F` toggles fullscreen.)*

### MoveNet mode (`movenet.html`)
- No wristband needed — it tracks your **right wrist** directly.
- First load downloads the model (few seconds); give it a moment before it locks on.

---

## Editing later
Change `sketch.js` (reflective) or `sketch-movenet.js` (MoveNet) → re-upload / commit → Pages redeploys automatically. Hard-refresh the phone (or wait a minute) to see changes.
