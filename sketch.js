let video;
let camFacing = "environment";   // rear camera by default (points at your wristband)

let paddleX, paddleY, paddleW, paddleH;
let aiX, aiY;                     // top paddle = AI (1P) or player 2 (2P)
let ball;

let playerScore = 0;
let aiScore = 0;

let threshold = 190;
let minPixels = 5;
let searchR = 70;                 // ROI radius in camera pixels, locked trackers

// Two trackers: index 0 = bottom paddle, index 1 = top paddle.
// calTop/calBot are head/waist image-Y fractions set by calibration.
let trackers = [
  { lastX: 0, lastY: 0, locked: false, calTop: 0.28, calBot: 0.55 },
  { lastX: 0, lastY: 0, locked: false, calTop: 0.28, calBot: 0.55 }
];

let twoPlayer = false;

// Calibration state machine
let calPlayer = -1;               // -1 idle, else player index
let calStep = 0;                  // 0 waiting head, 1 waiting waist
let calMsg = "";

// UI state
let showSettings = true;   // settings buttons visible (tap the gear to hide)
let cameraOnly = false;    // true = show raw camera feed, pause the game

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(60);

  startCamera(camFacing);

  paddleW = width * 0.20;
  paddleH = height * 0.035;

  paddleX = width / 2;
  paddleY = height * 0.84;   // paddle stays in bottom third

  aiX = width / 2;
  aiY = height * 0.10;

  resetBall();
}

function startCamera(facing) {
  if (video) video.remove();
  video = createCapture({
    video: {
      facingMode: facing,
      width: { ideal: 360 },
      height: { ideal: 640 }
    },
    audio: false
  });
  video.size(180, 320);
  video.hide();
}

function draw() {
  background(0);

  trackReflectors();

  if (cameraOnly) {
    drawCameraFull();      // raw camera, no game
  } else {
    drawGame();
    drawDebugCamera();
    moveBall();
  }

  drawUI();                // settings buttons / gear
}

// ---------- Reflector tracking (1 or 2 tapes) ----------

function trackReflectors() {
  if (!video || !video.width) return;   // camera not ready yet
  video.loadPixels();

  // Collect bright near-white pixels (the tape)
  let pts = [];
  for (let y = 0; y < video.height; y += 2) {
    for (let x = 0; x < video.width; x += 2) {
      let i = (x + y * video.width) * 4;
      let r = video.pixels[i];
      let g = video.pixels[i + 1];
      let b = video.pixels[i + 2];
      let bright = (r + g + b) / 3;
      if (bright > threshold && r > 150 && g > 150 && b > 150) {
        pts.push({ x: x, y: y, w: bright });
      }
    }
  }

  let n = twoPlayer ? 2 : 1;

  if (pts.length === 0) {
    for (let t of trackers) t.locked = false;
    return;
  }

  // Seed cluster centers from prior locks; cold-start uses x-extremes
  let centers = seedCenters(pts, n);

  // Assign each bright pixel to nearest center (locked ones reject far pixels)
  let acc = [];
  for (let k = 0; k < n; k++) acc.push({ sx: 0, sy: 0, sw: 0 });

  for (let p of pts) {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      let dx = p.x - centers[k].x;
      let dy = p.y - centers[k].y;
      let d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (trackers[best].locked && bestD > searchR * searchR) continue;   // reject far pixels
    acc[best].sx += p.x * p.w;
    acc[best].sy += p.y * p.w;
    acc[best].sw += p.w;
  }

  // Update trackers and drive their paddles
  for (let k = 0; k < n; k++) {
    if (acc[k].sw > minPixels * threshold) {
      trackers[k].lastX = acc[k].sx / acc[k].sw;
      trackers[k].lastY = acc[k].sy / acc[k].sw;
      trackers[k].locked = true;
      updatePaddleFromTracker(k);
    } else {
      trackers[k].locked = false;
    }
  }
  for (let k = n; k < trackers.length; k++) trackers[k].locked = false;
}

// Choose starting centers for the clusters this frame
function seedCenters(pts, n) {
  let centers = [];
  for (let k = 0; k < n; k++) {
    if (trackers[k].locked) {
      centers.push({ x: trackers[k].lastX, y: trackers[k].lastY });
    } else {
      centers.push(null);
    }
  }

  if (n === 1) {
    if (!centers[0]) {
      let sx = 0, sy = 0, sw = 0;
      for (let p of pts) { sx += p.x * p.w; sy += p.y * p.w; sw += p.w; }
      centers[0] = { x: sx / sw, y: sy / sw };
    }
    return centers;
  }

  // Two players: fill any unseeded slot from x-extreme pixels
  let minP = pts[0], maxP = pts[0];
  for (let p of pts) {
    if (p.x < minP.x) minP = p;
    if (p.x > maxP.x) maxP = p;
  }
  if (!centers[0]) centers[0] = { x: minP.x, y: minP.y };
  if (!centers[1]) centers[1] = { x: maxP.x, y: maxP.y };
  return centers;
}

// Map a tracker's image-Y (head..waist) to its paddle X
function updatePaddleFromTracker(k) {
  let t = trackers[k];
  let topY = t.calTop * video.height;   // head (small y)
  let botY = t.calBot * video.height;   // waist (large y)

  // Head up = right side, waist down = left side
  let mappedX = map(t.lastY, topY, botY, width - paddleW / 2, paddleW / 2, true);

  if (k === 0) paddleX = lerp(paddleX, mappedX, 0.75);
  else aiX = lerp(aiX, mappedX, 0.75);
}

// ---------- Calibration ----------

function startCalibration() {
  calPlayer = 0;
  calStep = 0;
  calMsg = "P1: hold bracelet at HEAD, tap";
}

// Capture the current lock as head, then waist
function calCapture() {
  let t = trackers[calPlayer];
  if (!t.locked) { calMsg = "No lock — show bracelet, tap"; return; }

  let f = t.lastY / video.height;

  if (calStep === 0) {
    t.calTop = f;
    calStep = 1;
    calMsg = "P" + (calPlayer + 1) + ": hold at WAIST, tap";
  } else {
    t.calBot = f;
    if (t.calBot <= t.calTop) {   // swap if captured out of order
      let tmp = t.calTop; t.calTop = t.calBot; t.calBot = tmp;
    }
    if (twoPlayer && calPlayer === 0) {
      calPlayer = 1;
      calStep = 0;
      calMsg = "P2: hold at HEAD, tap";
    } else {
      calPlayer = -1;
      calStep = 0;
      calMsg = "";
    }
  }
}

// ---------- Rendering ----------

function drawGame() {
  stroke(100);
  strokeWeight(3);

  for (let y = 0; y < height; y += 35) {
    line(width / 2, y, width / 2, y + 15);
  }

  // Show bottom-third paddle lane
  noFill();
  stroke(80);
  strokeWeight(2);
  rect(0, height * 0.67, width, height * 0.33);

  noStroke();
  rectMode(CENTER);

  fill(180);
  rect(aiX, aiY, paddleW, paddleH, 8);

  fill(255);
  rect(paddleX, paddleY, paddleW, paddleH, 8);

  fill(255);
  circle(ball.x, ball.y, ball.r * 2);

  textAlign(CENTER, CENTER);
  textSize(height * 0.08);

  fill(180);
  text(aiScore, width / 2, height * 0.28);

  fill(255);
  text(playerScore, width / 2, height * 0.72);

  if (calMsg !== "") {
    fill(0, 220, 120);
    textSize(height * 0.03);
    text(calMsg, width / 2, height * 0.50);
  }
}

function drawDebugCamera() {
  let previewW = width * 0.18;
  let previewH = previewW * (video.height / video.width);
  let x = 16;
  let y = 16;

  push();
  translate(x + previewW, y);
  scale(-1, 1);
  image(video, 0, 0, previewW, previewH);
  pop();

  let anyLock = trackers[0].locked || (twoPlayer && trackers[1].locked);
  noFill();
  stroke(anyLock ? 0 : 255, anyLock ? 255 : 0, 0);
  strokeWeight(3);
  rectMode(CORNER);
  rect(x, y, previewW, previewH);

  // Crosshair per locked tracker: P1 green, P2 cyan
  let n = twoPlayer ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (!trackers[k].locked) continue;
    let lx = map(trackers[k].lastX, 0, video.width, x + previewW, x);
    let ly = map(trackers[k].lastY, 0, video.height, y, y + previewH);
    if (k === 0) stroke(0, 255, 0);
    else stroke(0, 220, 255);
    strokeWeight(3);
    noFill();
    circle(lx, ly, 24);
    line(lx - 15, ly, lx + 15, ly);
    line(lx, ly - 15, lx, ly + 15);
  }

  noStroke();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(14);
  text("P1: " + (trackers[0].locked ? "YES" : "NO") +
       (twoPlayer ? "   P2: " + (trackers[1].locked ? "YES" : "NO") : ""),
       x, y + previewH + 6);
  text("THRESH: " + threshold, x, y + previewH + 24);
}

// Full-screen raw camera view (game paused) — for aiming the phone and tuning.
function drawCameraFull() {
  let vw = video.width || 180;
  let vh = video.height || 320;
  let s = min(width / vw, height / vh);   // "contain" fit, keep whole frame visible
  let dw = vw * s;
  let dh = vh * s;
  let ox = (width - dw) / 2;
  let oy = (height - dh) / 2;

  push();
  translate(ox + dw, oy);   // mirror horizontally (matches the debug preview)
  scale(-1, 1);
  image(video, 0, 0, dw, dh);
  pop();

  let n = twoPlayer ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (!trackers[k].locked) continue;
    let lx = ox + dw - (trackers[k].lastX / vw) * dw;   // account for mirror
    let ly = oy + (trackers[k].lastY / vh) * dh;
    if (k === 0) stroke(0, 255, 0);
    else stroke(0, 220, 255);
    strokeWeight(3);
    noFill();
    circle(lx, ly, 30);
    line(lx - 18, ly, lx + 18, ly);
    line(lx, ly - 18, lx, ly + 18);
  }

  noStroke();
  fill(255, 200);
  textAlign(CENTER, TOP);
  textSize(min(width, height) * 0.035);
  text("CAMERA VIEW   P1: " + (trackers[0].locked ? "YES" : "NO") + "   THRESH: " + threshold,
       width / 2, oy + 8);
}

// ---------- On-screen settings UI ----------

// Returns the list of tappable buttons for the current state.
// A gear button is always present (bottom-right); the rest appear to its
// left only when settings are shown.
function uiButtons() {
  let s = min(width, height) * 0.11;
  let pad = s * 0.28;
  let y = height - s - pad;
  let x = width - s - pad;   // rightmost slot = gear

  let btns = [{ id: "gear", label: showSettings ? "x" : "⚙", x: x, y: y, w: s, h: s }];

  if (showSettings) {
    let items = [
      { id: "full",  label: "full" },
      { id: "flip",  label: "flip" },
      { id: "cal",   label: "cal" },
      { id: "2p",    label: twoPlayer ? "1p" : "2p" },
      { id: "plus",  label: "+" },
      { id: "minus", label: "-" },
      { id: "cam",   label: cameraOnly ? "game" : "cam" }
    ];
    for (let it of items) {
      x -= (s + pad);
      btns.push({ id: it.id, label: it.label, x: x, y: y, w: s, h: s });
    }
  }
  return btns;
}

function drawUI() {
  rectMode(CORNER);
  textAlign(CENTER, CENTER);
  for (let b of uiButtons()) {
    noStroke();
    if (b.id === "cam" && cameraOnly) fill(0, 170, 90, 210);
    else if (b.id === "2p" && twoPlayer) fill(0, 130, 200, 210);
    else fill(255, 45);
    rect(b.x, b.y, b.w, b.h, 10);

    fill(255, 210);
    textSize(b.w * (b.label.length > 1 ? 0.30 : 0.5));
    text(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }
}

function doButton(id) {
  if (id === "gear")       showSettings = !showSettings;
  else if (id === "cam")   cameraOnly = !cameraOnly;
  else if (id === "minus") threshold = constrain(threshold - 5, 100, 255);
  else if (id === "plus")  threshold = constrain(threshold + 5, 100, 255);
  else if (id === "full")  fullscreen(!fullscreen());
  else if (id === "2p")    twoPlayer = !twoPlayer;
  else if (id === "cal")   startCalibration();
  else if (id === "flip") {
    camFacing = (camFacing === "environment") ? "user" : "environment";
    startCamera(camFacing);
  }
}

function handleTap(px, py) {
  for (let b of uiButtons()) {
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
      doButton(b.id);
      return;
    }
  }
  if (calPlayer >= 0) { calCapture(); return; }   // calibration tap
  // Tapping anywhere else goes fullscreen (also satisfies iOS's
  // "user gesture required" rule to start the camera).
  fullscreen(true);
}

// ---------- Game physics ----------

function moveBall() {
  if (!twoPlayer) {                       // 1P: AI drives the top paddle
    aiX = lerp(aiX, ball.x, 0.055);
  }
  aiX = constrain(aiX, paddleW / 2, width - paddleW / 2);

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.r || ball.x > width - ball.r) {
    ball.vx *= -1;
  }

  if (
    ball.y - ball.r < aiY + paddleH / 2 &&
    ball.y + ball.r > aiY - paddleH / 2 &&
    ball.x > aiX - paddleW / 2 &&
    ball.x < aiX + paddleW / 2 &&
    ball.vy < 0
  ) {
    ball.vy *= -1;
    ball.vx += map(ball.x - aiX, -paddleW / 2, paddleW / 2, -2, 2);
  }

  if (
    ball.y + ball.r > paddleY - paddleH / 2 &&
    ball.y - ball.r < paddleY + paddleH / 2 &&
    ball.x > paddleX - paddleW / 2 &&
    ball.x < paddleX + paddleW / 2 &&
    ball.vy > 0
  ) {
    ball.vy *= -1;
    ball.vx += map(ball.x - paddleX, -paddleW / 2, paddleW / 2, -3, 3);
  }

  if (ball.y < -30) {
    playerScore++;
    resetBall();
  }

  if (ball.y > height + 30) {
    aiScore++;
    resetBall();
  }
}

function resetBall() {
  ball = {
    x: width / 2,
    y: height / 2,
    vx: random([-width * 0.007, width * 0.007]),
    vy: random([-height * 0.009, height * 0.009]),
    r: height * 0.025
  };

  if (abs(ball.vy) < height * 0.004) {
    ball.vy = height * 0.007;
  }
}

// ---------- Input ----------

function keyPressed() {
  if (keyCode === UP_ARROW) threshold += 5;
  if (keyCode === DOWN_ARROW) threshold -= 5;
  threshold = constrain(threshold, 100, 255);

  if (key === "f" || key === "F") fullscreen(!fullscreen());
  if (key === "c" || key === "C") cameraOnly = !cameraOnly;   // camera view
  if (key === "h" || key === "H") showSettings = !showSettings; // hide buttons
  if (key === "2") twoPlayer = !twoPlayer;                     // toggle 2-player
  if (key === "k" || key === "K") startCalibration();          // calibrate
}

function touchStarted() {
  handleTap(mouseX, mouseY);
  return false;
}

function mousePressed() {
  handleTap(mouseX, mouseY);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  paddleW = width * 0.20;
  paddleH = height * 0.035;
  paddleY = height * 0.84;
}
