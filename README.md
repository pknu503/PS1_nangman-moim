# 낭만모임: 부경대 사회복지학 전공동아리 모이다

부경대 사회복지학 전공동아리 3곳, 오라(Hora), 클럽신화(MYTH), 띰(Theme)을 관리하는 React 웹앱입니다.

이 프로젝트는 초보자가 GitHub에 올리고 Vercel로 배포해볼 수 있도록 만든 정적 웹앱입니다. 서버와 데이터베이스가 없고, 입력한 이름, 학번, 성별, 가입 동아리, 게시글, 일정, 사진 자료는 모두 내 브라우저의 `localStorage`에만 저장됩니다.

## 실행 방법

1. Node.js LTS 버전을 설치합니다.
2. 이 폴더에서 터미널을 엽니다.
3. 아래 명령어를 실행합니다.

```bash
npm install
npm run dev
```

4. 터미널에 보이는 주소, 보통 `http://127.0.0.1:5173`, 를 브라우저에서 엽니다.

배포용 파일을 만들 때는 아래 명령어를 씁니다.

```bash
npm run build
```

## 파일 구조

```text
.
├─ index.html          # React 앱이 붙는 HTML 시작 파일
├─ package.json        # 실행 명령어와 설치할 라이브러리 목록
├─ vite.config.js      # Vite + React 설정
├─ src
│  ├─ main.jsx         # React를 브라우저에 연결하는 입구
│  ├─ App.jsx          # 화면, 데이터, 기능 대부분이 들어 있는 핵심 파일
│  └─ styles.css       # 전체 디자인과 반응형 스타일
└─ README.md           # 실행, 배포, 구조 설명
```

처음에는 `src/App.jsx`와 `src/styles.css`만 천천히 읽으면 됩니다.

## 들어간 기능

- 이름, 학번, 성별, 가입 동아리 복수 선택
- 오라(Hora), 클럽신화(MYTH), 띰(Theme) 지원
- 통합 활동 창: 동아리 홍보 게시판, 통합 일정, 빠른 통계
- 개별 동아리 관리 창: 월별 일정, 주별 일정, 주별 이벤트, 기타, 부원 게시판
- 부원 게시판: 일반 글쓰기와 비밀(익명) 글쓰기
- 전체 관리 창: 출석, 통계, 동아리별 비교
- 최고 관리자: 모든 게시글 삭제, 게시글 이동, 자료 넣기와 빼기, 출석 수정

## 관리자 데모 코드

관리자 코드는 학습용으로만 넣었습니다.

```text
moida-admin
```

실제 동아리 운영 서비스로 만들려면 서버, 로그인, 권한 관리, 데이터베이스가 필요합니다. 지금 버전은 배포해도 각 사용자의 브라우저 안에만 데이터가 남는 데모입니다.

## 개인정보 저장 방식

이 앱은 서버로 개인정보를 보내지 않습니다.

- `localStorage`에 저장되는 것: 이름, 학번, 성별, 선택한 동아리, 사용자가 쓴 글과 일정
- 저장 위치: 사용자의 브라우저
- 다른 기기와 공유 여부: 공유되지 않음
- 브라우저 저장 데이터를 지우면 앱 데이터도 사라짐

브라우저 데이터를 지우려면 개발자도구의 Application 탭에서 Local Storage를 지우거나, 앱의 관리자 영역에서 데모 데이터를 초기화하면 됩니다.

## GitHub에 올리는 방법

이 PC에서 `git` 명령어가 인식되지 않는다면 먼저 Git을 설치해야 합니다.

1. Git 설치: `https://git-scm.com/downloads`
2. GitHub에서 새 저장소를 만듭니다.
3. 저장소를 만들 때 README, `.gitignore`, license는 체크하지 않는 것이 쉽습니다.
4. 이 프로젝트 폴더에서 아래 명령어를 실행합니다.

```bash
git init -b main
git add .
git commit -m "Create romance club app"
git remote add origin https://github.com/내아이디/저장소이름.git
git push -u origin main
```

`내아이디`와 `저장소이름`은 본인의 GitHub 정보로 바꿔야 합니다.

## Vercel로 배포하는 방법

1. `https://vercel.com`에 로그인합니다.
2. Add New Project 또는 New Project를 누릅니다.
3. 방금 올린 GitHub 저장소를 선택합니다.
4. Framework Preset이 Vite로 잡히는지 확인합니다.
5. Build Command는 `npm run build`, Output Directory는 `dist`로 둡니다.
6. Deploy를 누릅니다.

이후에는 GitHub에 새 커밋을 올릴 때마다 Vercel이 자동으로 다시 배포합니다.
