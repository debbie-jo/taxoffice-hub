# TaxOffice Hub

세무사무실 거래처 관리 웹앱입니다. 배포하면 어떤 컴퓨터에서든 사이트 주소로 접속해서 사용할 수 있습니다.

## 운영 준비

1. Supabase SQL Editor에서 `supabase-app-state.sql` 내용을 실행합니다.
2. Vercel에 이 프로젝트를 연결합니다.
3. Vercel 환경변수에 아래 값을 넣습니다.

```text
VITE_SUPABASE_URL=Supabase Project URL
VITE_SUPABASE_ANON_KEY=Supabase anon/public key
```

## 배포 설정

Vercel이 Vite 앱으로 자동 인식합니다.

```text
Build Command: npm run build
Output Directory: dist
```

배포 후 받은 주소로 접속하면 바로 앱이 열립니다. 크롬이나 엣지에서 사이트를 연 뒤 브라우저 메뉴의 앱 설치 기능을 쓰면 바탕화면 아이콘처럼 실행할 수 있습니다.

## 참고

로그인을 쓰지 않는 설정이라 사이트 주소와 Supabase 키가 노출되면 다른 사람도 데이터에 접근할 수 있습니다. 혼자 쓰고 주소를 공유하지 않는 용도라면 가장 간단하고, 나중에 직원이 늘어나면 로그인 방식으로 다시 바꾸는 편이 좋습니다.

## 로컬에서 확인

```bash
npm run dev
npm run build
```
