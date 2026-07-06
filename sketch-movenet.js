let video;
let bodyPose;
let poses = [];
let modelReady = false;

let paddleX, paddleY, paddleW, paddleH;
let aiX, aiY;
let ball;

let playerScore = 0;
let aiScore = 0;

let lockX = 0;
let lockY = 0;
let locked = false;

function preload() {
  // flipped: true so your movements mirror naturally on the projector.
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(60);

  // Front camera, 16:9 landscape feed from the iPhone.
  let constraints = {
    video: { facingMode: "user", aspectRatio: 16 / 9 },
    audio: false
  };

  video = createCapture(constraints, () => { /* stream ready */ });
  video.hide();

  bodyPose.detectStart(video, gotPoses);
  modelReady = true;

  paddleW = width * 0.20;
  paddleH = height * 0.035;

  paddleX = width / 2;
  paddleY = height * 0.84;

  aiX = width / 2;
  aiY = height * 0.10;

  resetBall();
}

function gotPoses(results) {
  poses = results;
}

function draw() {
  background(0);

  trackWrist();
  drawGame();
  drawDebugCamera();
  moveBall();
}

function trackWrist() {
  if (poses.length > 0) {
    let pose = poses[0];
    let rightWrist = pose.keypoints.find(k => k.name === 'right_wrist');

    if (rightWrist && rightWrist.confidence > 0.15) {
      lockX = rightWrist.x;
      lockY = rightWrist.y;
      locked = true;

      let mappedX = map(
        rightWrist.x,
        0, video.width,
        paddleW / 2, width - paddleW / 2,
        true
      );

      paddleX = lerp(paddleX, mappedX, 0.75);
      paddleY = height * 0.84;
    } else {
      locked = false;
    }
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
  if (!video || !video.width) return;

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
    let lx = map(lockX, 0, video.width, x, x + previewW);
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
  text("ML LOCK: " + (locked ? "YES" : "NO"), x, y + previewH + 6);
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

// iOS requires a user gesture before the camera and fullscreen can start.
function touchStarted() {
  fullscreen(true);
  return false;
}

function mousePressed() {
  fullscreen(true);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  paddleW = width * 0.20;
  paddleH = height * 0.035;
  paddleY = height * 0.84;
}
