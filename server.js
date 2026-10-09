const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Omok = require('./public/rules.js');

const app = express();
app.get('/healthz', (_req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// 방 상태는 메모리에만 둔다. (Render 무료 티어는 디스크가 없고, 잠들면 어차피 초기화된다)
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function resetGame(room) {
  room.board = Omok.createBoard();
  room.turn = 1;
  room.winner = 0; // 0 진행 중, 1 흑 승, 2 백 승, 3 무승부
  room.winLine = null;
  room.last = null;
  room.rematch = new Set();
}

function publicState(room) {
  return { board: room.board, turn: room.turn, winner: room.winner, winLine: room.winLine, last: room.last };
}

function colorOf(room, socketId) {
  return room.players.indexOf(socketId) === room.black ? 1 : 2;
}

function startGame(room) {
  resetGame(room);
  for (const id of room.players) {
    io.to(id).emit('start', { code: room.code, color: colorOf(room, id), state: publicState(room) });
  }
}

function leaveRoom(socket) {
  const room = rooms.get(socket.data.room);
  socket.data.room = null;
  if (!room) return;
  socket.leave(room.code);
  room.players = room.players.filter((id) => id !== socket.id);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  // 남은 사람은 같은 방 코드로 새 상대를 기다린다.
  room.black = 0;
  resetGame(room);
  io.to(room.code).emit('opponent-left');
}

io.on('connection', (socket) => {
  socket.on('create', (ack) => {
    if (typeof ack !== 'function') return;
    leaveRoom(socket);
    const room = { code: makeCode(), players: [socket.id], black: 0 };
    resetGame(room);
    rooms.set(room.code, room);
    socket.join(room.code);
    socket.data.room = room.code;
    ack({ ok: true, code: room.code });
  });

  socket.on('join', (code, ack) => {
    if (typeof ack !== 'function') return;
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return ack({ ok: false, error: '없는 방 코드입니다.' });
    if (room.players.includes(socket.id)) return ack({ ok: true, code: room.code });
    if (room.players.length >= 2) return ack({ ok: false, error: '이미 두 명이 들어간 방입니다.' });
    leaveRoom(socket);
    room.players.push(socket.id);
    socket.join(room.code);
    socket.data.room = room.code;
    ack({ ok: true, code: room.code });
    startGame(room);
  });

  socket.on('place', (move) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.players.length < 2 || room.winner) return;
    const x = move && move.x;
    const y = move && move.y;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Omok.inBounds(x, y)) return;
    if (room.turn !== colorOf(room, socket.id) || room.board[y][x]) return;

    room.board[y][x] = room.turn;
    room.last = [x, y];
    const line = Omok.findWin(room.board, x, y);
    if (line) {
      room.winner = room.turn;
      room.winLine = line;
    } else if (Omok.isFull(room.board)) {
      room.winner = 3;
    } else {
      room.turn = 3 - room.turn;
    }
    io.to(room.code).emit('state', publicState(room));
  });

  socket.on('rematch', () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.players.length < 2 || !room.winner) return;
    room.rematch.add(socket.id);
    if (room.rematch.size < 2) {
      socket.to(room.code).emit('rematch-requested');
      return;
    }
    room.black = 1 - room.black; // 다시 할 때는 흑백을 바꾼다
    startGame(room);
  });

  socket.on('leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`omok server listening on ${PORT}`);
});
