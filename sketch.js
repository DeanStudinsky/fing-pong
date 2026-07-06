let video;
let camFacing = "environment";   // rear camera by default (points at your wristband)

let paddleX, paddleY, paddleW, paddleH;
let aiX, aiY;
let ball;

let playerScore = 0;
let aiScore = 0;

let threshold = 190;
let minPixels = 5;

let lockX = 0;
let lockY = 0;
let locked = false;

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

  trackReflector();

  if (cameraOnly) {
    drawCameraFull();      // raw camera, no game
  } else {
    drawGame();
    drawDebugCamera();
    moveBall();
  }

  drawUI();                // settings buttons / gear
}

function trackReflector() {
  video.loadPixels();

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < video.height; y += 2) {
    for (let x = 0; x < video.width; x += 2) {
      let i = (x + y * video.width) * 4;

      let r = video.pixels[i];
      let g = video.pixels[i + 1];
      let b = video.pixels[i + 2];

      let brightness = (r + g + b) / 3;

      if (brightness > threshold && r > 150 && g > 150 && b > 150) {
        sumX += x * brightness;
        sumY += y * brightness;
        count += brightness;
      }
    }
  }

  if (count > minPixels * threshold) {
    let avgX = sumX / count;
    let avgY = sumY / count;

    lockX = avgX;
    lockY = avgY;
    locked = true;

    // avgY is wrist height in the vertical camera image.
    // Higher wrist = smaller avgY -> map to the RIGHT side of the TV.
    let mappedX = map(
      avgY,
      video.height * 0.20,  // high wrist
      video.height * 0.85,  // low wrist
      width - paddleW / 2,  // high wrist = right
      paddleW / 2,          // low wrist = left
      true
    );

    paddleX = lerp(paddleX, mappedX, 0.75);
    paddleY = height * 0.84;
  } else {
    locked = false;
  }
}

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

  noFill();
  stroke(locked ? 0 : 255, locked ? 255 : 0, 0);
  strokeWeight(3);
  rectMode(CORNER);
  rect(x, y, previewW, previewH);

  if (locked) {
    let lx = map(lockX, 0, video.width, x + previewW, x);
    let ly = map(lockY, 0, video.height, y, y + previewH);

    stroke(0, 255, 0);
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
  text("LOCK: " + (locked ? "YES" : "NO"), x, y + previewH + 6);
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

  if (locked) {
    let lx = ox + dw - (lockX / vw) * dw;   // account for mirror
    let ly = oy + (lockY / vh) * dh;
    stroke(0, 255, 0);
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
  text("CAMERA VIEW   LOCK: " + (locked ? "YES" : "NO") + "   THRESH: " + threshold,
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
  // Tapping anywhere else goes fullscreen (also satisfies iOS's
  // "user gesture required" rule to start the camera).
  fullscreen(true);
}

// ---------- Game physics ----------

function moveBall() {
  aiX = lerp(aiX, ball.x, 0.055);
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
