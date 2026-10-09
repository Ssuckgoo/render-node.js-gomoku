// 서버(Node)와 브라우저가 같이 쓰는 오목 규칙.
// board[y][x] : 0 = 빈칸, 1 = 흑, 2 = 백
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Omok = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SIZE = 15;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function createBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  // (x, y)에 놓인 돌을 포함해 5목 이상이 완성됐으면 그 좌표 목록을, 아니면 null을 돌려준다.
  function findWin(board, x, y) {
    const color = board[y][x];
    if (!color) return null;
    for (const [dx, dy] of DIRS) {
      const line = [[x, y]];
      for (const sign of [1, -1]) {
        let cx = x + dx * sign;
        let cy = y + dy * sign;
        while (inBounds(cx, cy) && board[cy][cx] === color) {
          line.push([cx, cy]);
          cx += dx * sign;
          cy += dy * sign;
        }
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  function isFull(board) {
    return board.every((row) => row.every((cell) => cell !== 0));
  }

  return { SIZE, DIRS, createBoard, inBounds, findWin, isFull };
});
