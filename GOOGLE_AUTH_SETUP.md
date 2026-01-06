# Google Cloud OAuth 설정 상세 가이드

Google 로그인을 활성화하기 위해 사용자가 직접 수행해야 하는 설정입니다.
(보안상 제가 대신 수행할 수 없습니다.)

---

## 1단계: Google Cloud Console 설정

1. **[Google Cloud Console](https://console.cloud.google.com/)**에 접속하여 로그인합니다.
2. 왼쪽 상단 프로젝트 선택 드롭다운을 클릭하고 **[새 프로젝트]**를 만듭니다 (이름: `eformsign-quote-builder` 등).
3. **[API 및 서비스]** > **[OAuth 동의 화면]** 메뉴로 이동합니다.
   - User Type: **외부(External)** 선택 후 [만들기]
   - 앱 이름: `견적서 빌더` 입력
   - 사용자 지원 이메일: 본인 이메일 선택
   - 개발자 연락처 정보: 본인 이메일 입력
   - 나머지는 기본값으로 두고 [저장 후 계속] 반복하여 완료

4. **[API 및 서비스]** > **[사용자 인증 정보]** 메뉴로 이동합니다.
   - 화면 상단 **[+ 사용자 인증 정보 만들기]** > **[OAuth 클라이언트 ID]** 선택
   - 애플리케이션 유형: **웹 애플리케이션** 선택
   - 이름: `Supabase Auth` 등 원하는 이름

5. **승인된 리디렉션 URI** (가장 중요 ⭐️)
   - 아래 [URI 추가] 버튼을 누르고 다음 주소를 정확히 붙여넣습니다.

   ```
   https://luxdmyvuqceatjlvoaka.supabase.co/auth/v1/callback
   ```

   > ⚠️ 이 주소가 없거나 틀리면 `redirect_uri_mismatch` 오류가 발생합니다.

6. [만들기] 버튼을 누르면 **클라이언트 ID**와 **클라이언트 보안 비밀**이 나옵니다. 이 창을 닫지 마세요.

---

## 2단계: Supabase 대시보드 설정

1. **[Supabase Dashboard](https://supabase.com/dashboard/project/luxdmyvuqceatjlvoaka/auth/providers)** (Authentication > Providers)로 이동합니다.
2. **Google** 항목을 찾아 선택합니다.
3. **Google enabled** 스위치를 켭니다.
4. 방금 Google Cloud에서 발급받은 정보를 입력합니다:
   - **Client ID**: (Google Cloud에서 복사한 값)
   - **Client Secret**: (Google Cloud에서 복사한 값)
5. **[Save]** 버튼을 누릅니다.

---

## 설정 완료 확인

설정이 끝났다면 다시 견적서 빌더의 로그인 화면으로 돌아가서 **[Google 계정으로 로그인]** 버튼을 눌러보세요.
정상적으로 구글 로그인 팝업이 뜨면 성공입니다!
