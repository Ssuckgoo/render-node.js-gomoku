# 오목

Render 무료 티어에 올릴 수 있는 오목 게임입니다. (Node.js + Express + Socket.IO)

- **AI와 대전** — 선공/후공 선택, 무르기 가능
- **한 기기에서 둘이** — 번갈아 두기
- **온라인 대전** — 방을 만들고 4자리 코드나 초대 링크를 상대에게 보내면 됩니다

규칙: 15×15 판, 같은 색 돌을 가로·세로·대각선으로 5개 이상 먼저 이으면 승리합니다. (3-3 등 금수 없음)

## 로컬 실행

```bash
npm install
npm start
```

http://localhost:3000 에서 확인합니다.

## Render 배포

1. 이 폴더를 GitHub 저장소로 푸시합니다.
2. Render 대시보드에서 **New → Blueprint** 를 고르고 저장소를 연결합니다. `render.yaml` 설정이 그대로 적용됩니다.
   - 직접 만들 경우: **New → Web Service**, Runtime `Node`, Build Command `npm install`, Start Command `npm start`, Instance Type `Free`
3. 배포가 끝나면 `https://<서비스이름>.onrender.com` 으로 접속합니다.

## 무료 티어에서 알아둘 점

- 15분 동안 접속이 없으면 서버가 잠들고, 다음 접속 때 깨어나는 데 1분 가까이 걸립니다.
- 방 정보는 메모리에만 있어서 서버가 잠들거나 재배포되면 진행 중인 온라인 대국은 사라집니다.
- AI 대전과 한 기기 대전은 브라우저에서만 돌아가므로 서버 상태와 상관없이 계속할 수 있습니다.
