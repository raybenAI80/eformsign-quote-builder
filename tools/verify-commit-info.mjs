// tools/lib/commit-info.mjs 의 경로별 동작 검증: git/gh 실패를 주입해 fetch 재시도·gh 대체·제목 생략 경로가 실제로 실행되는지 본다.
// 실행: node tools/verify-commit-info.mjs   (네트워크·gh 불필요. 실패 시 exit 1)
import assert from 'node:assert/strict';
import { resolveCommit } from './lib/commit-info.mjs';

const FULL = 'fca9645df7a972990bfffd5e57f0d8a8a500751a';
const bad = msg => () => { throw new Error(msg); };

// 호출 기록을 남기는 가짜 실행기. local: fetch 전/후 로컬에 커밋이 있는지.
function fake({ localBeforeFetch, localAfterFetch, fetchOk = true, ghJson = null, ghOk = true }) {
  const calls = [];
  let fetched = false;
  const hasLocal = () => (fetched ? localAfterFetch : localBeforeFetch);
  return {
    calls,
    git: (...a) => {
      calls.push(`git ${a.join(' ')}`);
      if (a[0] === 'fetch') { fetched = true; if (!fetchOk) throw new Error('fetch failed'); return ''; }
      if (!hasLocal()) throw new Error(`fatal: bad object ${a.at(-1)}`);
      if (a[0] === 'rev-parse') return FULL;
      if (a[0] === 'log') return '병합 제목';
      throw new Error('unexpected');
    },
    gh: (...a) => {
      calls.push(`gh ${a.join(' ')}`);
      if (!ghOk) throw new Error('gh failed');
      return JSON.stringify(ghJson ?? { sha: FULL, commit: { message: 'gh 제목\n\n본문' } });
    },
  };
}
const count = (r, prefix) => r.calls.filter(c => c.startsWith(prefix)).length;
const results = [];
const check = (name, fn) => { fn(); results.push(name); console.log('PASS', name); };

check('정상: 로컬에 있으면 fetch·gh 호출 없음', () => {
  const r = fake({ localBeforeFetch: true, localAfterFetch: true });
  const c = resolveCommit('fca9645', r);
  assert.equal(c.sha, FULL); assert.equal(c.subject, '병합 제목');
  assert.equal(count(r, 'git fetch'), 0); assert.equal(count(r, 'gh '), 0);
});

check('fetch 재시도: 로컬에 없다가 fetch 후 sha·제목 해석, gh 호출 없음, fetch 는 1회', () => {
  const r = fake({ localBeforeFetch: false, localAfterFetch: true });
  const c = resolveCommit('fca9645', r);
  assert.equal(c.sha, FULL); assert.equal(c.subject, '병합 제목');
  assert.equal(count(r, 'git fetch origin'), 1); assert.equal(count(r, 'gh '), 0);
  assert.ok(c.via.includes('git fetch origin'));
});

check('gh 대체: fetch 후에도 없으면 gh api 로 sha(짧은 sha 입력)·제목 해석', () => {
  const r = fake({ localBeforeFetch: false, localAfterFetch: false });
  const c = resolveCommit('fca9645', r);
  assert.equal(c.sha, FULL); assert.equal(c.subject, 'gh 제목');
  assert.equal(count(r, 'git fetch origin'), 1);
  assert.ok(r.calls.some(x => x === 'gh api repos/{owner}/{repo}/commits/fca9645'));
});

check('fetch 자체가 실패해도 gh api 로 계속 진행', () => {
  const r = fake({ localBeforeFetch: false, localAfterFetch: false, fetchOk: false });
  const c = resolveCommit('fca9645', r);
  assert.equal(c.sha, FULL); assert.equal(c.subject, 'gh 제목');
});

check('제목만 못 구하는 경우: sha 는 로컬, 제목은 fetch 재시도 후 gh 로', () => {
  // rev-parse 는 되고 log 만 실패(로컬에 sha 객체가 없는 부분 클론 상황 흉내)
  const calls = [];
  const run = {
    calls,
    git: (...a) => { calls.push(`git ${a.join(' ')}`); if (a[0] === 'rev-parse') return FULL; throw new Error('fatal: bad object'); },
    gh: (...a) => { calls.push(`gh ${a.join(' ')}`); return JSON.stringify({ sha: FULL, commit: { message: 'gh 제목' } }); },
  };
  const c = resolveCommit(FULL, run);
  assert.equal(c.sha, FULL); assert.equal(c.subject, 'gh 제목');
  assert.equal(count(run, 'git fetch origin'), 1);
});

check('제목 없이 진행: log·fetch·gh 가 모두 실패해도 sha 는 반환(제목 null), 던지지 않음', () => {
  const run = {
    git: (...a) => { if (a[0] === 'rev-parse') return FULL; throw new Error('fatal'); },
    gh: bad('gh failed'),
  };
  const c = resolveCommit(FULL, run);
  assert.equal(c.sha, FULL); assert.equal(c.subject, null);
});

check('실패: 로컬·fetch·gh 모두 못 찾으면 명확한 오류', () => {
  const r = fake({ localBeforeFetch: false, localAfterFetch: false, ghOk: false });
  assert.throws(() => resolveCommit('deadbee', r), /deadbee.*찾지 못함/);
});

console.log(`\nOK ${results.length}건 통과`);
