(() => {
  const { SIZE, createBoard, findWin, isFull } = Omok;
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const COLOR_NAME = { 1: '흑', 2: '백' };

  let g = null; // 현재 게임 상태
  let socket = null;
  let hover = null;
  let boardPx = 0;

  // ---------- 화면 전환 ----------

  function showMenu(message) {
    if (g && g.mode === 'online' && socket) socket.emit('leave');
    if (g) clearTimeout(g.aiTimer);
    g = null;
    $('game').hidden = true;
    $('menu').hidden = false;
    $('menu-msg').textContent = message || '';
    history.replaceState(null, '', location.pathname);
  }

  function startGame(mode, opts) {
    if (g) clearTimeout(g.aiTimer);
    g = Object.assign(
      {
        mode,
        board: createBoard(),
        turn: 1,
        winner: 0,
        winLine: null,
        last: null,
        moves: [],
        myColor: 1,
        waiting: false, // 온라인: 상대 입장 대기
        code: null,
        note: '',
        aiTimer: null,
      },
      opts
    );
    hover = null;
    $('menu').hidden = true;
    $('game').hidden = false;
    $('btn-undo').hidden = mode === 'online';
    resize();
    render();
    maybeAiMove();
  }

  // ---------- 로컬 / AI ----------

  function placeLocal(x, y) {
    if (g.winner || g.board[y][x]) return;
    g.board[y][x] = g.turn;
    g.moves.push([x, y]);
    g.last = [x, y];
    const line = findWin(g.board, x, y);
    if (line) {
      g.winner = g.turn;
      g.winLine = line;
    } else if (isFull(g.board)) {
      g.winner = 3;
    } else {
      g.turn = 3 - g.turn;
    }
    render();
    maybeAiMove();
  }

  function maybeAiMove() {
    if (g.mode !== 'ai' || g.winner || g.turn === g.myColor) return;
    const game = g;
    game.aiTimer = setTimeout(() => {
      if (g !== game) return;
      const [x, y] = OmokAI.chooseMove(game.board, game.turn);
      placeLocal(x, y);
    }, 300);
  }

  function undo() {
    if (g.mode === 'online' || g.moves.length === 0) return;
    clearTimeout(g.aiTimer);
    const turnAfter = () => (g.moves.length % 2 === 0 ? 1 : 2);
    do {
      const [x, y] = g.moves.pop();
      g.board[y][x] = 0;
    } while (g.mode === 'ai' && g.moves.length > 0 && turnAfter() !== g.myColor);
    g.turn = turnAfter();
    g.winner = 0;
    g.winLine = null;
    g.last = g.moves[g.moves.length - 1] || null;
    render();
    maybeAiMove();
  }

  // ---------- 온라인 ----------

  function connect() {
    if (socket) return socket;
    socket = io();

    socket.on('start', ({ code, color, state }) => {
      startGame('online', { myColor: color, code });
      Object.assign(g, state);
      render();
    });

    socket.on('state', (state) => {
      if (!g || g.mode !== 'online') return;
      Object.assign(g, state);
      render();
    });

    socket.on('rematch-requested', () => {
      if (!g || g.mode !== 'online') return;
      g.note = '상대가 다시 하자고 합니다. "다시하기"를 누르면 시작합니다.';
      render();
    });

    socket.on('opponent-left', () => {
      if (!g || g.mode !== 'online') return;
      startGame('online', { code: g.code, waiting: true, note: '상대가 나갔습니다.' });
    });

    socket.on('disconnect', () => {
      if (g && g.mode === 'online') {
        g = null;
        showMenu('서버와 연결이 끊어졌습니다.');
      }
    });

    return socket;
  }

  // 무료 서버가 잠들어 있으면 응답까지 1분 가까이 걸릴 수 있다.
  function request(event, args, onOk) {
    $('menu-msg').textContent = '서버에 연결 중… (잠들어 있던 서버는 깨어나는 데 1분쯤 걸릴 수 있어요)';
    connect()
      .timeout(90000)
      .emit(event, ...args, (err, res) => {
        if (err) return void ($('menu-msg').textContent = '서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
        if (!res.ok) return void ($('menu-msg').textContent = res.error);
        $('menu-msg').textContent = '';
        onOk(res);
      });
  }

  function createRoom() {
    request('create', [], (res) => {
      startGame('online', { code: res.code, waiting: true });
      history.replaceState(null, '', '?room=' + res.code);
    });
  }

  function joinRoom(code) {
    if (!code) return void ($('menu-msg').textContent = '방 코드를 입력해 주세요.');
    // 성공하면 서버가 곧바로 'start'를 보내 준다.
    request('join', [code], (res) => history.replaceState(null, '', '?room=' + res.code));
  }

  // ---------- 입력 ----------

  function canPlay() {
    if (!g || g.winner || g.waiting) return false;
    return g.mode === 'local' || g.turn === g.myColor;
  }

  function cellAt(event) {
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / SIZE;
    const x = Math.floor((event.clientX - rect.left) / cell);
    const y = Math.floor((event.clientY - rect.top) / cell);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
  }

  canvas.addEventListener('click', (event) => {
    const cell = cellAt(event);
    if (!cell || !canPlay() || g.board[cell[1]][cell[0]]) return;
    hover = null;
    if (g.mode === 'online') socket.emit('place', { x: cell[0], y: cell[1] });
    else placeLocal(cell[0], cell[1]);
  });

  canvas.addEventListener('mousemove', (event) => {
    const cell = canPlay() ? cellAt(event) : null;
    const next = cell && !g.board[cell[1]][cell[0]] ? cell : null;
    if (String(next) !== String(hover)) {
      hover = next;
      draw();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hover) {
      hover = null;
      draw();
    }
  });

  $('btn-ai').addEventListener('click', () => {
    const myColor = Number(document.querySelector('input[name="first"]:checked').value);
    startGame('ai', { myColor });
  });
  $('btn-local').addEventListener('click', () => startGame('local'));
  $('btn-create').addEventListener('click', createRoom);
  $('btn-join').addEventListener('click', () => joinRoom($('code-input').value.trim().toUpperCase()));
  $('code-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('btn-join').click();
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-menu').addEventListener('click', () => showMenu());
  $('btn-restart').addEventListener('click', () => {
    if (g.mode === 'online') {
      socket.emit('rematch');
      g.note = '상대의 수락을 기다리는 중…';
      render();
    } else {
      startGame(g.mode, { myColor: g.myColor });
    }
  });
  $('btn-copy').addEventListener('click', async () => {
    const link = location.origin + location.pathname + '?room=' + g.code;
    try {
      await navigator.clipboard.writeText(link);
      $('btn-copy').textContent = '복사됨!';
    } catch {
      prompt('이 링크를 복사해 보내 주세요', link);
    }
    setTimeout(() => ($('btn-copy').textContent = '초대 링크 복사'), 1500);
  });

  // ---------- 그리기 ----------

  function statusText() {
    if (g.waiting) return '상대를 기다리는 중…';
    if (g.winner === 3) return '무승부!';
    if (g.winner) {
      if (g.mode === 'local') return COLOR_NAME[g.winner] + ' 승리!';
      return g.winner === g.myColor ? '이겼습니다! 🎉' : '졌습니다…';
    }
    if (g.mode === 'local') return COLOR_NAME[g.turn] + ' 차례';
    const mine = g.turn === g.myColor;
    if (g.mode === 'ai') return mine ? `내 차례 (${COLOR_NAME[g.myColor]})` : 'AI가 생각 중…';
    return mine ? `내 차례 (${COLOR_NAME[g.myColor]})` : `상대 차례 (나는 ${COLOR_NAME[g.myColor]})`;
  }

  function render() {
    $('status').textContent = statusText();
    $('share').hidden = !(g.mode === 'online' && g.waiting);
    $('share-code').textContent = g.code || '';
    $('btn-undo').disabled = g.moves.length === 0;
    // 온라인에서는 판이 끝난 뒤에만 다시하기(재대결 요청)를 할 수 있다.
    $('btn-restart').disabled = g.mode === 'online' && !g.winner;
    if (g.note) {
      $('status').textContent += ' — ' + g.note;
      if (!g.winner && !g.waiting) g.note = '';
    }
    draw();
  }

  function resize() {
    const available = Math.min($('board-wrap').clientWidth, window.innerHeight - 220);
    boardPx = Math.max(280, Math.floor(available));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = boardPx + 'px';
    canvas.width = canvas.height = Math.round(boardPx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawStone(px, py, r, color, alpha) {
    const grad = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
    if (color === 1) {
      grad.addColorStop(0, '#666');
      grad.addColorStop(1, '#0b0b0b');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#c9c9c9');
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!g) return;
    const cell = boardPx / SIZE;
    const pos = (i) => cell / 2 + i * cell;
    const r = cell * 0.43;

    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, boardPx, boardPx);

    ctx.strokeStyle = '#5b4520';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < SIZE; i++) {
      ctx.moveTo(pos(0), pos(i));
      ctx.lineTo(pos(SIZE - 1), pos(i));
      ctx.moveTo(pos(i), pos(0));
      ctx.lineTo(pos(i), pos(SIZE - 1));
    }
    ctx.stroke();

    ctx.fillStyle = '#5b4520';
    for (const sx of [3, 7, 11]) {
      for (const sy of [3, 7, 11]) {
        ctx.beginPath();
        ctx.arc(pos(sx), pos(sy), cell * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (g.board[y][x]) drawStone(pos(x), pos(y), r, g.board[y][x], 1);
      }
    }

    if (g.last) {
      ctx.fillStyle = '#e03131';
      ctx.beginPath();
      ctx.arc(pos(g.last[0]), pos(g.last[1]), cell * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    if (g.winLine) {
      ctx.strokeStyle = '#e03131';
      ctx.lineWidth = Math.max(2, cell * 0.09);
      for (const [x, y] of g.winLine) {
        ctx.beginPath();
        ctx.arc(pos(x), pos(y), r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (hover && canPlay()) drawStone(pos(hover[0]), pos(hover[1]), r, g.turn, 0.45);
  }

  window.addEventListener('resize', () => {
    if (!g) return;
    resize();
    draw();
  });

  // 초대 링크(?room=CODE)로 들어오면 바로 참가한다.
  const invited = new URLSearchParams(location.search).get('room');
  if (invited) {
    $('code-input').value = invited.toUpperCase();
    joinRoom(invited.toUpperCase());
  }
})();
