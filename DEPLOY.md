# eformsign 견적서 빌더 배포 가이드

이 프로젝트는 Vite + React 기반으로 만들어졌으며, **Vercel**을 통해 손쉽게 배포할 수 있습니다.

## 1. GitHub에 코드 업로드

1. GitHub에 새로운 Repository를 생성합니다.
2. 로컬 프로젝트를 GitHub에 푸시합니다.

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <당신의_GITHUB_REPO_URL>
   git push -u origin main
   ```

## 2. Vercel 배포

1. [Vercel Dashboard](https://vercel.com/dashboard)에 접속합니다.
2. **Add New...** -> **Project**를 클릭합니다.
3. 방금 올린 GitHub Repository를 **Import** 합니다.
4. **Environment Variables** (환경 변수) 설정 섹션에서 다음 두 가지를 추가합니다:
   - `VITE_SUPABASE_URL`: (Supabase 프로젝트 URL)
   - `VITE_SUPABASE_ANON_KEY`: (Supabase Anon Key)
   *(이 값들은 프로젝트의 `.env` 파일 안에 있습니다)*
5. **Deploy** 버튼을 클릭합니다.

## 3. Supabase 설정 업데이트 (중요!)

배포가 완료되면 Vercel에서 제공하는 도메인(예: `https://my-project.vercel.app`)이 생성됩니다.
로그인이 정상 작동하려면 **Supabase 대시보드**에서 이 도메인을 허용해 주어야 합니다.

1. [Supabase Dashboard](https://supabase.com/dashboard) -> 해당 프로젝트 접속
2. **Authentication** -> **URL Configuration** 메뉴로 이동
3. **Site URL**에 배포된 Vercel 도메인을 입력합니다 (예: `https://abcd.vercel.app`)
4. **Redirect URLs**에도 동일한 도메인을 추가하고 `Save`를 누릅니다.
5. 이제 배포된 주소에서 로그인이 정상적으로 작동합니다.
