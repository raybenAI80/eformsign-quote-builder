// 병합 직후 로컬에 없는 커밋을 다루는 헬퍼. check-prod-deploy.mjs 와 verify-commit-info.mjs 가 쓴다.
//
// 배경(2026-10-30): `gh pr merge` 로 병합한 직후에는 병합 커밋이 로컬에 없다.
// 그래서 `git rev-parse`/`git log` 가 `fatal: bad object` 로 죽었다. `git fetch origin` 후에는 정상 동작한다.
//
// 규칙: 커밋 제목은 표시용이다. 판정(Vercel status, 번들 확인)에 쓰지 않으므로 제목을 못 구해도 죽지 않는다.
//   sha 해석: git rev-parse → (실패) git fetch origin 1회 후 재시도 → (실패) gh api commits/<입력> 의 sha(짧은 sha 도 해석됨).
//   제목: git log → (실패) fetch 1회(이미 했으면 생략) 후 재시도 → (실패) gh api 의 commit.message 첫 줄 → (실패) 제목 없음.
// run 은 { git(...args) → string, gh(...args) → string } 이고, 테스트에서 실패를 주입하기 위해 바꿀 수 있다.
import { execFileSync } from 'node:child_process';

export const defaultRun = {
  git: (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
  gh: (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
};

const firstLine = s => String(s ?? '').split('\n')[0].trim();

// 로컬 git 에서 커밋 sha 를 푼다. 없으면 null.
function localSha(run, ref) {
  try { return run.git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) || null; } catch { return null; }
}

function localSubject(run, sha) {
  try { return run.git('log', '-1', '--format=%s', sha); } catch { return null; }
}

// 반환: { sha, subject, via }  via 는 어디서 얻었는지 알리는 표시용 메모 배열.
export function resolveCommit(ref, run = defaultRun, log = () => {}) {
  const via = [];
  let fetched = false;
  const fetchOnce = () => {
    if (fetched) return;
    fetched = true;
    try { run.git('fetch', 'origin'); via.push('git fetch origin'); log('로컬에 커밋이 없어 git fetch origin 실행'); }
    catch (e) { via.push('git fetch 실패'); log(`git fetch origin 실패: ${firstLine(e.message)}`); }
  };

  let sha = localSha(run, ref);
  if (!sha) {
    fetchOnce();
    sha = localSha(run, ref);
  }
  if (!sha) {
    // 포크·권한 등으로 fetch 로도 못 가져온 경우. gh api 가 짧은 sha 도 전체 sha 로 풀어 준다.
    try {
      const j = JSON.parse(run.gh('api', `repos/{owner}/{repo}/commits/${ref}`));
      sha = j.sha;
      via.push('gh api 로 sha 해석');
      log('로컬에서 해석하지 못해 gh api 로 sha 를 구함');
      return { sha, subject: firstLine(j.commit?.message) || null, via };
    } catch (e) {
      throw new Error(`커밋 ${ref} 를 로컬 git 에서도 gh api 에서도 찾지 못함: ${firstLine(e.message)}`);
    }
  }

  let subject = localSubject(run, sha);
  if (subject == null) {
    fetchOnce();
    subject = localSubject(run, sha);
  }
  if (subject == null) {
    try {
      const j = JSON.parse(run.gh('api', `repos/{owner}/{repo}/commits/${sha}`));
      subject = firstLine(j.commit?.message) || null;
      via.push('gh api 로 제목 조회');
    } catch (e) {
      log(`커밋 제목을 구하지 못해 제목 없이 진행: ${firstLine(e.message)}`);
    }
  }
  return { sha, subject: subject || null, via };
}
