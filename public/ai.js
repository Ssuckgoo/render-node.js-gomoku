// 한 수 앞만 보는 휴리스틱 AI. 빈칸마다 "내가 두면 얼마나 좋은가 + 상대가 두면 얼마나 아픈가"를 점수로 매긴다.
(function (root) {
  const { SIZE, DIRS, inBounds } = root.Omok;

  // 그 칸에 color가 놓였다고 가정했을 때 한 방향 줄의 가치
  function lineScore(board, x, y, dx, dy, color) {
    let count = 1;
    let openEnds = 0;
    for (const sign of [1, -1]) {
      let cx = x + dx * sign;
      let cy = y + dy * sign;
      while (inBounds(cx, cy) && board[cy][cx] === color) {
        count++;
        cx += dx * sign;
        cy += dy * sign;
      }
      if (inBounds(cx, cy) && board[cy][cx] === 0) openEnds++;
    }
    if (count >= 5) return 10000000;
    if (openEnds === 0) return 0;
    const open = openEnds === 2;
    if (count === 4) return open ? 100000 : 10000;
    if (count === 3) return open ? 5000 : 500;
    if (count === 2) return open ? 200 : 20;
    return open ? 5 : 1;
  }

  function cellScore(board, x, y, color) {
    let score = 0;
    for (const [dx, dy] of DIRS) score += lineScore(board, x, y, dx, dy, color);
    return score;
  }

  function hasNeighbor(board, x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if ((dx || dy) && inBounds(x + dx, y + dy) && board[y + dy][x + dx]) return true;
      }
    }
    return false;
  }

  function chooseMove(board, color) {
    const center = (SIZE - 1) / 2;
    const enemy = 3 - color;
    let best = null;
    let bestScore = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] || !hasNeighbor(board, x, y)) continue;
        const score =
          cellScore(board, x, y, color) * 1.1 +
          cellScore(board, x, y, enemy) -
          (Math.abs(x - center) + Math.abs(y - center)) * 0.01 +
          Math.random() * 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = [x, y];
        }
      }
    }
    return best || [center, center]; // 빈 판이면 천원(맨 중앙)
  }

  root.OmokAI = { chooseMove };
})(self);
