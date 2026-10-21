// 公開済み記事の出典表記を直す（2026-10-21 本人指示「文献の表記は投稿文の一番最後のみ」）。note_put_hook.js で publish 画面まで進めたあとに走らせる。
// 修正データは window.__FIX[key] = {ops:[[old,new]...], del_seg, append}（GitHub Pages の fix_1021.json を fetch して入れる）
// やること: 更新するで PUT を捕まえる → dump で本文を取る → 本文中の書き換え ops を順に当てた結果を手元で再現しながら、
//   ①「出典は、…」の文を消す ② 末尾の作業メモ（【出典（本文に出したもの）】と ``` の間）を消す ③ 最後に「📚 参考にした資料：…」を足す
//   → dry で全 op が1回ずつ当たるのを確かめてから1回だけ送る
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = () => document.getElementById('__out').textContent;
const btn = t => [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === t);
const key = (location.pathname.match(/notes\/(n[0-9a-f]+)/) || [])[1];
if (!window.__FIX) { window.__FIX = await (await fetch('https://manabu49-ai.github.io/zukai/fix_1021.json?' + Date.now())).json(); }
const E = window.__FIX[key];
if (!E) return { err: 'no fix for ' + key };
const paid = btn('有料エリア設定'); if (paid) { paid.click(); await sleep(4000); }
const up = btn('更新する'); if (up) { up.click(); await sleep(4000); }
if (!up || !/captured/.test(out())) return { err: 'not captured', up: !!up, cap: out() };
document.getElementById('__cmd').textContent = JSON.stringify({ op: 'dump' }); await sleep(1500);
const D = JSON.parse(out()); let free = D.free, pay = D.pay;
const cnt = (s, w) => w ? s.split(w).length - 1 : 0;
const ops = []; const log = [];
const step = (a, b) => { const n = cnt(free, a) + cnt(pay, a); if (n !== 1) throw new Error('count ' + n + ' ' + a.slice(0, 30)); if (cnt(free, a)) free = free.replace(a, () => b); else pay = pay.replace(a, () => b); ops.push([a, b]); };
try {
  for (const [a, b] of E.ops) step(a, b);
  log.push('ops' + E.ops.length);
  if (E.del_seg) {
    const all = free + pay; const esc = E.del_seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let m = all.match(new RegExp('<p[^>]*>' + esc + '</p>')) || all.match(new RegExp('<br\\s*/?>' + esc)) || all.match(new RegExp(esc + '<br\\s*/?>'));
    step(m ? m[0] : E.del_seg, ''); log.push('del');
  }
  const mm = (free + pay).match(/<p[^>]*>【出典[^<]*<\/p>[\s\S]*?<p[^>]*>```<\/p>[\s\S]*?<p[^>]*>```<\/p>/);
  if (mm) { step(mm[0], ''); log.push('memo' + mm[0].length); }
  if (E.append && !(free + pay).includes('📚 参考にした資料')) {
    const tgt = pay ? 'pay' : 'free'; const s = tgt === 'pay' ? pay : free;
    const tail = s.slice(-120); const u = crypto.randomUUID();
    step(tail, tail + '<p name="' + u + '" id="' + u + '">' + E.append + '</p>'); log.push('append:' + tgt);
  }
} catch (e) { return { err: String(e), log }; }
const left = /```|【出典|原文は未確認/.test(free + pay);
document.getElementById('__cmd').textContent = JSON.stringify({ op: 'apply', dry: true, ops, word: '📚' }); await sleep(1500);
const dry = out();
if (!/"dry":true/.test(dry)) return { err: 'dry failed', dry: dry.slice(0, 200), log };
document.getElementById('__cmd').textContent = JSON.stringify({ op: 'apply', ops, word: '📚' }); await sleep(5000);
return { key, paid: !!paid, log, left, sent: out().slice(0, 200) };
