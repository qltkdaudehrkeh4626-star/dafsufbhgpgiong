const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 600;
canvas.height = 400;

// 플레이어 설정
let players = [
  {name: "You", x: 300, y: 350, state: "idle", currentThrowImg: null},
  {name: "P2", x: 150, y: 150, state: "idle", currentThrowImg: null},
  {name: "P3", x: 450, y: 150, state: "idle", currentThrowImg: null}
];

const playerStates = ['idle', 'active', 'throw', 'catch'];
let avatars = [];

// 이미지 로딩
let imagesLoaded = 0;
const totalImages = 3 * playerStates.length + 1; // 3명 * 4상태 + 공

function loadImage(src, onLoadCallback) {
  const img = new Image();
  img.src = src;
  img.onload = onLoadCallback;
  return img;
}

function onImageLoad() {
  imagesLoaded++;
  if (imagesLoaded === totalImages) {
    setTimeout(startGame, 5000); // 최소 5초 로딩
  }
}

// 플레이어 이미지 로딩
for (let i = 0; i < 3; i++) {
  avatars[i] = {};
  playerStates.forEach(state => {
    let numImages = 1;
    if (state === "throw") numImages = 3;

    if (numImages === 1) {
      avatars[i][state] = loadImage(`assets/player/${state}/1.png`, onImageLoad);
    } else {
      avatars[i][state] = [];
      for (let j = 1; j <= numImages; j++) {
        avatars[i][state].push(loadImage(`assets/player/${state}/${j}.png`, onImageLoad));
      }
    }
  });
}

// 공 이미지
let ballImg = loadImage('assets/ball.png', onImageLoad);

// 공 정보
let ball = {x: 300, y: 350, radius: 10, heldBy: 0};
let throws = 0;
const maxThrows = 30;

// 조건 설정
// URL에서 'v' (버전) 값을 읽어옴
const urlParams = new URLSearchParams(window.location.search);
const versionFromURL = urlParams.get('v');

// 조건 설정
let condition;

// URL의 v값이 '2'이면 배척 모드로, 그 외의 모든 경우(v=1, v값이 없거나 다른 값)는 포함 모드로 설정
if (versionFromURL === '2') {
  condition = 'exclusion';
  console.log("Version 2 로드됨 (Exclusion)"); // 확인용 메시지
} else {
  condition = 'inclusion';
  console.log("Version 1 로드됨 (Inclusion)"); // 확인용 메시지
}

// NPC 제약 관리 변수
let npcChainCount = 0;
let lastNpcPair = null;

// 참여자가 던질 대상 선택
let userSelected = false;
let targetPlayer = null;

canvas.addEventListener('click', (e) => {
  if (players[0].state !== "idle") return; // 던지는 중엔 선택 불가
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  for (let i = 1; i < players.length; i++) {
    if (Math.abs(players[i].x - mouseX) < 40 && Math.abs(players[i].y - mouseY) < 40) {
      targetPlayer = i;
      userSelected = true;
      break;
    }
  }
});

// 게임 시작
function startGame() {
  document.getElementById("loading-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");
  drawPlayers();
  drawBall();
  setTimeout(throwBall, 1000);
}

// 게임 종료
function endGame() {
  document.getElementById("game-screen").classList.add("hidden"); // 게임 화면 숨김

  // Game Over 표시
  const gameOverDiv = document.createElement("div");
  gameOverDiv.innerText = "Game Over";
  gameOverDiv.style.position = "fixed";
  gameOverDiv.style.top = "50%";
  gameOverDiv.style.left = "50%";
  gameOverDiv.style.transform = "translate(-50%, -50%)";
  gameOverDiv.style.fontSize = "80px";
  gameOverDiv.style.fontWeight = "bold";
  gameOverDiv.style.textAlign = "center";
  gameOverDiv.style.color = "black";
  gameOverDiv.style.zIndex = "9999";

  document.body.appendChild(gameOverDiv);
}

// 공 던지기
function throwBall() {
  if (throws >= maxThrows) {
    endGame();
    return;
  }

  let current = ball.heldBy;
  let target;

  if (current === 0) { 
    // 참가자가 공을 가지고 있으면 선택 대기
    if (!userSelected) {
      requestAnimationFrame(throwBall);
      return;
    }
    target = targetPlayer;
    userSelected = false;
    targetPlayer = null;
    npcChainCount = 0; // NPC 체인 초기화
    lastNpcPair = null;
  } else { 
    // NPC 자동 던지기
    if (condition === "inclusion") {
      // 마지막 패스는 반드시 참가자에게
      if (throws === maxThrows - 1) {
        target = 0;
      } else {
        do {
          target = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : 2);

          if (target === 0) {
            // 참가자에게 가면 체인 초기화
            npcChainCount = 0;
            lastNpcPair = null;
            break;
          } else {
            // NPC → NPC
            const newPair = [current, target].sort().join("-");
            if (newPair === lastNpcPair) {
              npcChainCount++;
            } else {
              npcChainCount = 1;
              lastNpcPair = newPair;
            }
          }
        } while (npcChainCount > 3); // 같은 NPC 간 연속 3회 이상 불가
      }
    } else {
      // exclusion 로직 (기존 유지)
      if (throws < 6) target = Math.random() < 0.2 ? 0 : (Math.random() < 0.5 ? 1 : 2);
      else target = Math.random() < 0.05 ? 0 : (Math.random() < 0.5 ? 1 : 2);
    }
  }

  animateThrow(current, target);
  ball.heldBy = target;
  throws++;
}

// 공 애니메이션 (throw 상태 이미지 순차 표시, 각 200ms)
function animateThrow(from, to) {
  const throwImgs = avatars[from]["throw"]; // 3개 이미지
  let step = 0;
  const steps = throwImgs.length;
  const intervalTime = 200; // 각 이미지 표시 시간(ms)

  const startX = players[from].x;
  const startY = players[from].y;
  const endX = players[to].x;
  const endY = players[to].y;

  players[from].state = "throw";

  const interval = setInterval(() => {
    // 공 위치 진행
    const progress = (step + 1)/steps;
    ball.x = startX + (endX - startX) * progress;
    ball.y = startY + (endY - startY) * progress;

    // 현재 throw 이미지
    players[from].currentThrowImg = throwImgs[step];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayers();
    drawBall();

    step++;
    if (step >= steps) {
      clearInterval(interval);
      players[to].state = "catch";
      setTimeout(() => { players[to].state = "idle"; }, 1000);
      players[from].state = "idle";
      players[from].currentThrowImg = null;
      // 1. 최소-최대 고민 시간 설정 (단위: ms, 1000ms = 1초)
      const minThinkingTime = 800;  // 최소 0.5초
      const maxThinkingTime = 2000; // 최대 2초

      // 2. 위 범위 내에서 랜덤한 시간 생성
      const randomThinkingTime = Math.random() * (maxThinkingTime - minThinkingTime) + minThinkingTime;

      // 3. 고정된 500 대신 랜덤한 시간 적용
      setTimeout(throwBall, randomThinkingTime);
    }
  }, intervalTime);
}

// 플레이어 그리기
function drawPlayers() {
  for (let i = 0; i < players.length; i++) {
    let img;
    if (players[i].state === "throw" && players[i].currentThrowImg) {
      img = players[i].currentThrowImg;
    } else {
      img = avatars[i][players[i].state];
    }
    ctx.drawImage(img, players[i].x - 40, players[i].y - 40, 80, 80);
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText(players[i].name, players[i].x - 20, players[i].y + 60);
  }
}

// 공 그리기
function drawBall() {
  ctx.drawImage(ballImg, ball.x - ball.radius, ball.y - ball.radius, ball.radius*2, ball.radius*2);
}


