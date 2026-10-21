// note 公開済み記事を PUT で直す「横取り」の仕掛け（2026-10-09 note担当。P2〜P3・T1・T2・T4 で実証）
// 使い方（アプリ内ブラウザ・editor.note.com/notes/<key>/edit/ を開いた状態）
//   1 このファイルの中身を丸ごと javascript_tool の text に貼る（Read で読んでそのまま。手で書き写さない）
//      → 主世界に blob: script を挿し、PUT /api/v1/text_notes/ を捕まえて**送らせない**
//      → 「公開に進む」を押して publish 画面へ（9秒待つ）。結果 {clicked, href} が返る
//   2 別の呼び出しで: 有料は「有料エリア設定」→「更新する」／無料は「更新する」を .click()（各3〜4秒待つ）
//      → #__out に {"captured":true,...} が出れば捕獲（記事はまだ変わっていない）
//   3 #__cmd に JSON を書いて #__out を読む（隔離ワールドからは DOM 経由でしか話せない）
//      {op:'dump'}  → free_body と pay_body をそのまま返す（2026-10-21 追加。有料部の中身を読むため。送らない）
//      {op:'stat', word:'<数える語>'}                     → price/is_refund/separator/status/tags/各本文の長さと語の数
//      {op:'apply', dry:true, ops:[[old,new], ...], word}   → 試算（送らない）。old は free_body と pay_body を通して**ちょうど1回**現れること
//      {op:'apply', ops:[...], word}                        → 送信（send_notifications_flag=false）
//      new が '__DEL__' なら old を含む <p>…</p> を（直後の空段落ごと）消す
//      name:'<新しい題>' を足すと題も差し替える（2026-10-14 追加。ops は空配列でもよい）
// ⚠️ 日本語は \uXXXX で渡す（py -3 -c "json.dumps(...,ensure_ascii=True)"）。書き写しで化けるのを防ぐ
// ⚠️ 送ったら必ず GET /api/v3/notes/<key> と公開ページで検証（status・price・publish_at・タグ数・separator）
await new Promise(r => setTimeout(r, 2500));
for (const id of ['__cmd', '__out']) { if (!document.getElementById(id)) { const d = document.createElement('div'); d.id = id; d.style.display = 'none'; document.body.appendChild(d); } }
const code = `(()=>{ if(window.__hooked) return; window.__hooked=1;
const out=o=>{document.getElementById('__out').textContent=JSON.stringify(o);};
const of=window.fetch; window.__of=of; window.__cap=null;
window.fetch=function(...a){ const u=(typeof a[0]==='string')?a[0]:(a[0]&&a[0].url); const o=a[1]||{};
  if(String((o.method||'GET')).toUpperCase()==='PUT' && /\\/api\\/v1\\/text_notes\\//.test(String(u))){ window.__cap={u:String(u), body:String(o.body)}; out({captured:true,u:String(u)}); return Promise.resolve(new Response(JSON.stringify({data:{}}),{status:200,headers:{'Content-Type':'application/json'}})); }
  return of.apply(this,a); };
const cnt=(s,w)=>w?(s||'').split(w).length-1:0;
setInterval(async()=>{ const c=document.getElementById('__cmd'); if(!c||!c.textContent) return; const cmd=JSON.parse(c.textContent); c.textContent='';
  try{ if(!window.__cap){ out({err:'no capture'}); return; } const p=JSON.parse(window.__cap.body);
    if(cmd.op==='dump'){ out({free:p.free_body||'',pay:p.pay_body||''}); return; }
    if(cmd.op==='stat'){ out({price:p.price,is_refund:p.is_refund,separator:p.separator,status:p.status,tags:(p.hashtags||[]).length,free_len:(p.free_body||'').length,pay_len:(p.pay_body||'').length,free_hits:cnt(p.free_body,cmd.word),pay_hits:cnt(p.pay_body,cmd.word)}); return; }
    if(cmd.op==='apply'){ const log=[];
      for(const [a,b] of cmd.ops){ const nf=cnt(p.free_body,a), np=cnt(p.pay_body,a); if(nf+np!==1){ out({err:'count '+(nf+np)+' for '+a.slice(0,40)}); return; }
        const f=nf?'free_body':'pay_body';
        if(b==='__DEL__'){ const re=new RegExp('<p[^>]*>'+a.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&')+'</p>(<p[^>]*><br ?/?></p>)?'); const m=p[f].match(re); if(!m){ out({err:'del pattern miss'}); return;} p[f]=p[f].replace(re,''); log.push(f+':del'); }
        else { p[f]=p[f].replace(a,()=>b); log.push(f+':rep'); } }
      if(cmd.name){ log.push('name:'+String(p.name).slice(0,12)+'→'+cmd.name.slice(0,12)); p.name=cmd.name; }
      p.send_notifications_flag=false;
      const left={free:cnt(p.free_body,cmd.word),pay:cnt(p.pay_body,cmd.word)};
      if(cmd.dry){ out({dry:true,log,free_len:(p.free_body||'').length,pay_len:(p.pay_body||'').length,left}); return; }
      const res=await of(window.__cap.u,{method:'PUT',credentials:'include',headers:{'x-requested-with':'XMLHttpRequest','content-type':'application/json'},body:JSON.stringify(p)});
      window.__cap=null;   // 1回送ったら捕獲を捨てる（同じ中身で2回送らない）
      out({sent:true,status:res.status,log,left}); } }catch(e){ out({err:String(e)}); } },500);
})();`;
const el = document.createElement('script'); el.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); document.documentElement.appendChild(el);
await new Promise(r => setTimeout(r, 800));
const b = [...document.querySelectorAll('button')].find(x => /公開に進む/.test(x.textContent || '')); b && b.click();
await new Promise(r => setTimeout(r, 9000));
({ clicked: !!b, href: location.href })
