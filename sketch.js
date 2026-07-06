let video;

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

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(60);

  video = createCapture({
    video: {
      facingMode: "environment",
      width: { ideal: 360 },
      height: { ideal: 640 }
    },
    audio: false
  });

  video.size(180, 320);
  video.hide();

  paddleW = width * 0.20;
  paddleH = height * 0.035;

  paddleX = width / 2;

  // Paddle stays in bottom third
  paddleY = height * 0.84;

  aiX = width / 2;
  aiY = height * 0.10;

  resetBall();
}

function draw() {
  background(0);

  trackReflector();
  drawGame();
  drawDebugCamera();
  drawTouchButtons();
  moveBall();
}

// On-screen threshold buttons (bottom-right) so you can calibrate on the
// projector by tapping — no keyboard needed.
function thresholdButtons() {
  let s = min(width, height) * 0.10;
  let pad = s * 0.35;
  let y = height - s - pad;
  return {
    size: s,
    minus: { x: width - s * 2 - pad * 2, y: y },
    plus:  { x: width - s - pad,         y: y }
  };
}

function drawTouchButtons() {
  let b = thresholdButtons();
  rectMode(CORNER);
  textAlign(CENTER, CENTER);
  textSize(b.size * 0.55);

  noStroke();
  fill(255, 40);
  rect(b.minus.x, b.minus.y, b.size, b.size, 10);
  rect(b.plus.x, b.plus.y, b.size, b.size, 10);

  fill(255, 180);
  text("-", b.minus.x + b.size / 2, b.minus.y + b.size / 2);
  text("+", b.plus.x + b.size / 2, b.plus.y + b.size / 2);
}

function pointInRect(px, py, r, size) {
  return px >= r.x && px <= r.x + size && py >= r.y && py <= r.y + size;
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

    // IMPORTANT:
    // avgY is wrist height in the vertical camera image.
    // Higher wrist = smaller avgY.
    // We map smaller avgY to the RIGHT side of the TV.

    let mappedX = map(
      avgY,
      video.height * 0.20,  // high wrist
      video.height * 0.85,  // low wrist
      width - paddleW / 2,  // high wrist = right
      paddleW / 2,          // low wrist = left
      true
    );

    paddleX = lerp(paddleX, mappedX, 0.75);

    // Fixed paddle height in bottom third
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

function keyPressed() {
  if (keyCode === UP_ARROW) threshold += 5;
  if (keyCode === DOWN_ARROW) threshold -= 5;
  threshold = constrain(threshold, 100, 255);

  if (key === "f" || key === "F") {
    fullscreen(!fullscreen());
  }
}

function handleTap(px, py) {
  let b = thresholdButtons();

  // Tapping a calibration button adjusts the threshold instead of toggling
  // fullscreen.
  if (pointInRect(px, py, b.minus, b.size)) {
    threshold = constrain(threshold - 5, 100, 255);
    return;
  }
  if (pointInRect(px, py, b.plus, b.size)) {
    threshold = constrain(threshold + 5, 100, 255);
    return;
  }

  // Tapping anywhere else goes fullscreen (also satisfies iOS's
  // "user gesture required" rule to start the camera).
  fullscreen(true);
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