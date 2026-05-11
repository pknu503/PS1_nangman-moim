# 낭만모임

부경대 사회복지 전공동아리 낭만모임 앱입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## 배포

GitHub에는 아래 파일과 폴더를 올리면 됩니다.

```text
index.html
package.json
package-lock.json
vite.config.js
src/
README.md
.gitignore
```

`node_modules`와 `dist`는 올리지 않습니다. Vercel이 배포할 때 다시 생성합니다.

## 이번 수정의 핵심

Firebase에 예전 데이터가 `members/0`처럼 남아 있고 최신 데이터가
`members/{실제회원id}`에 따로 있는 경우, 예전 코드가 오래된 회원 정보를 먼저
읽어서 수정한 정보가 원래대로 돌아가는 현상이 생길 수 있었습니다.

이 버전은 같은 `id`를 가진 회원 데이터가 여러 개 있어도 가장 최신
`updatedAt` 데이터를 사용하고, 정보 수정 시 로그인 세션과 Firebase 회원 레코드를
함께 갱신합니다.
