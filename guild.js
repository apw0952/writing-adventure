/* 小作家冒險島 v3.2：冒險公會視圖。所有正式戰鬥、答案和 XP 記帳由 Google Apps Script 處理。 */
(function(){'use strict';
const C={};let tab='forest',busy=false,lastFeedback=null,lastResult=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const skillIcon={flame:'🔥',barrier:'🛡️',thunder:'⚡',ice:'❄️'};
const modeLabel={forest:'森林巡邏',ruins:'遺跡探索',boss:'BOSS 再戰'};
const moduleLabel={A:'基礎造句',B:'複合造句',C:'精簡文字',D:'作文結構',E:'閱讀理解',F:'摘要重點',G:'詞彙運用',H:'文學創意',I:'知識說明',J:'觀點論證',K:'資訊判讀',L:'實用表達'};
function button(label,action,extra='',className='ghost',disabled=false){return `<button type="button" class="btn ${className}" data-action="guild-${action}" ${extra} ${disabled||busy?'disabled':''}>${label}</button>`;}
function bar(label,hp,max,type){return `<div class="guild-hp"><div class="guild-hp-name">${esc(label)} <b>${hp} / ${max}</b></div><div class="guild-track"><i class="${type}" style="width:${Math.max(0,Math.min(100,hp/Math.max(1,max)*100))}%"></i></div></div>`;}
function current(student){return C[student]||null;}
function getSpent(student){return Number(C[student]?.spent)||0;}
function getSkillCount(student){return C[student]?.skillIds?.length||0;}
function hasHistory(student){return !!(C[student]?.history?.length||C[student]?.active);}
function clear(){for(const k of Object.keys(C))delete C[k];lastFeedback=null;lastResult=null;}
async function load(student){if(!window.LWCloud?.active)throw Error('正式冒險公會需要先連接家庭雲端');const r=await LWCloud.call('guildState',{student});C[student]=r;return r;}
function apply(student,data){C[student]=data;lastFeedback=data.lastFeedback||null;lastResult=data.lastResult||null;}
function selectSkills(student,run){const s=C[student];const usable=(s?.skills||[]).filter(x=>s.skillIds.includes(x.id)&&!run.usedSkills.includes(x.id));
 return usable.length?`<label class="guild-skill-pick">本回合使用技能（非必要）<select class="field" id="guild-skill"><option value="">不使用技能</option>${usable.map(x=>`<option value="${esc(x.id)}">${skillIcon[x.id]||'✨'} ${esc(x.name)}｜本場限一次</option>`).join('')}</select></label>`:'<p class="muted sm">尚未解鎖技能，仍可用答對題目攻擊。</p>';
}
function renderBattle(student,s,run){const question=run.question;const label=run.mode==='forest'?'文字怪':run.mode==='boss'?(s.bosses[Math.floor(Number(run.target)/3)]||'主線 BOSS'):'遺跡守衛';
 return `<section class="guild-battle card"><div class="guild-battle-head"><span class="pill peach">⚔️ ${modeLabel[run.mode]}｜第 ${run.step+1} 回合</span><span class="muted sm">${run.mode==='ruins'?'本場入場費 '+run.cost+' XP 已支付':'本場不消耗 XP'}</span></div><div class="guild-battle-map"><div><div class="guild-fighter">🧙‍♂️</div>${bar('冒險者',run.playerHP,run.maxPlayerHP,'hero')}</div><div><div class="guild-fighter">${run.mode==='forest'?'👾':run.mode==='boss'?'🐲':'🗿'}</div>${bar(label,run.enemyHP,run.maxEnemyHP,'enemy')}</div></div>
 ${run.mode==='ruins'?`<div class="guild-question"><h3>🗿 守衛行動提示</h3><p>${esc(run.telegraph)}</p><p class="muted sm">普通攻擊穩定輸出；防禦可以減少本回合傷害；已取得的技能可在適當時機施展。</p>${selectSkills(student,run)}<div class="guild-buttons">${button('⚔️ 普通攻擊','move','data-move="attack"','',false)}${button('🛡️ 防禦反擊','move','data-move="guard"','outline',false)}${button('✨ 施展選定技能','move','data-move="skill"','outline',!(s.skillIds||[]).some(x=>!run.usedSkills.includes(x)))}</div></div>`:
 `<div class="guild-question"><div class="guild-question-top"><span class="pill green">${esc(question?.module||'')}｜${esc(moduleLabel[question?.module]||'國語挑戰')}</span><span class="muted sm">第 ${run.round+1} / ${run.total} 題 · 已答對 ${run.correct} 題</span></div><h3>${esc(question?.prompt||'題目讀取中')}</h3>${selectSkills(student,run)}<div class="guild-options">${(question?.choices||[]).map((c,i)=>button(`${i+1}. ${esc(c)}`,'answer',`data-choice="${i}"`,'guild-option')).join('')}</div></div>`}
 <div class="guild-battle-foot"><span class="muted sm">不確定能否獲勝？本場可放棄；遺跡入場 XP 不退還，但保留粉塵補償。</span>${button('結束本場','leave','','outline')}</div></section>`;
}
function renderForest(student,s){return `<div class="guild-section"><div class="card"><div class="row between"><h2>🌲 森林巡邏</h2><span class="pill ${s.alert>=2?'peach':'green'}">警戒度 ${s.alert}/3</span></div><p>答對國語題目才能攻擊文字怪，累積合格討伐數解鎖真正能在戰鬥中使用的技能。連續挑戰會逐步變難，也可能戰敗；不消耗 XP。</p><div class="guild-huge">${s.qualifiedKills} <small>隻有效討伐</small></div>${button('🌲 開始森林巡邏','start','data-mode="forest"','',false)}<p class="muted sm">每次約 4 題。45 分鐘內的巡邏次數會提高警戒度，逐漸加入更高階國語題。答錯後可查看解析；失敗不扣既有 XP。</p></div><div class="guild-tiles">${s.skills.map(x=>`<div class="card guild-skill-card"><div class="guild-skill-emoji">${skillIcon[x.id]||'✨'}</div><h3>${esc(x.name)}</h3><p class="muted sm">${esc(x.desc)}</p><div class="guild-stat">${s.skillIds.includes(x.id)?'✅ 已解鎖':Math.min(s.qualifiedKills,x.kills)+' / '+x.kills+' 隻'}</div></div>`).join('')}</div></div>`;}
function renderRuins(student,s,spendable){return `<div class="guild-section"><div class="card"><h2>🏛️ 遺跡探索</h2><p>使用普通攻擊、防禦和森林解鎖的技能，打倒遺跡守衛。入場時扣 XP；勝利得到寶物碎片，失敗也獲得古代粉塵，累積 3 個粉塵自動換 1 片碎片。</p><p class="guild-huge">${spendable} <small>目前可用 XP</small></p><p class="muted sm">入場費依最近 12 筆已核准作品的平均 XP 調整，不因勾選較高級模組就立刻漲價。裝備碎片需求對不同年級相同。</p></div><div class="guild-tiles">${s.relics.map(x=>{const owned=s.inventory[x.id]||0,forged=s.forged.includes(x.id),fee=s.ruinCosts[x.id];return `<article class="card guild-relic"><div class="guild-relic-icon">${esc(x.icon)}</div><h3>${esc(x.name)}</h3><div class="guild-stat">${forged?'✅ 已合成':owned+' / '+x.need+' 個碎片'}</div><div class="guild-track"><i class="hero" style="width:${Math.min(100,owned/x.need*100)}%"></i></div><p class="muted sm">古代粉塵 ${s.dust[x.id]||0}/3 · ${forged?'攻擊加成 +'+x.bonus:'碎片達標後會自動合成永久武器'}</p><p><b>入場費：${fee} XP</b></p>${button(forged?'再探索（收藏碎片）':'進入這座遺跡','start',`data-mode="ruins" data-target="${esc(x.id)}"`,'',spendable<fee)}</article>`;}).join('')}</div></div>`;}
function renderPuzzle(n){return `<div class="guild-puzzle" aria-label="已收集 ${n} 片，共九片">${Array.from({length:9},(_,i)=>`<span class="${i<n?'got':'missing'}">${i<n?'🐉':'?'}</span>`).join('')}</div>`;}
function renderBoss(student,s){return `<div class="guild-section"><div class="card"><h2>🐲 BOSS 再戰｜九片圖鑑</h2><p>只有已在主線擊敗的 BOSS 才能再戰。每次回答綜合國語題並使用森林技能戰鬥，勝利獲得一片尚未收集的拼圖；集滿 9 片後納入圖鑑並解鎖討伐者徽章。無 XP 消耗，也不重複發家庭點數。</p><p class="muted sm">沒有技能仍然能打，但必須多答對幾題。每場至少答對 3 題才有勝利資格。</p></div><div class="guild-tiles">${s.bosses.map((x,i)=>{const idx=i*3+2,unlocked=s.bossAvailable.includes(idx),collected=Math.min(9,s.bossWins[String(idx)]||0);return `<article class="card"><h3>👑 ${esc(x)}</h3>${renderPuzzle(collected)}<p class="guild-stat">${collected===9?'🏅 '+esc(x)+'討伐者':collected+'/9 片拼圖'}</p>${button(collected===9?'已收錄圖鑑':unlocked?'再戰取得拼圖':'主線尚未通關','start',`data-mode="boss" data-target="${idx}"`,'',!unlocked||collected===9)}</article>`;}).join('')}</div></div>`;}
function renderMastery(s){const entries=Object.entries(s.mastery||{}).sort((a,b)=>b[1].total-a[1].total);
 return `<section class="card guild-master"><h2>📊 國語能力驗收紀錄</h2><p class="muted sm">公會的客觀選擇題會記錄各能力的正確率，供家長挑選需要加強的學習模組。這是輔助指標，不取代造句、作文等手寫作品的教師評量。</p>${entries.length?`<div class="guild-master-list">${entries.map(([k,v])=>`<div><div class="row between"><b>${esc(k)}｜${esc(moduleLabel[k]||k)}</b><span class="muted sm">答對 ${v.correct}/${v.total} · ${Math.round(v.correct/v.total*100)}%</span></div><div class="guild-track"><i class="hero" style="width:${Math.round(v.correct/v.total*100)}%"></i></div></div>`).join('')}</div>`:'<div class="callout">還沒有測驗紀錄。完成森林巡邏或 BOSS 再戰後，就會逐漸形成能力分布。</div>'}<h3 style="margin-top:16px">最近的冒險</h3>${s.history?.length?`<div class="guild-history">${s.history.slice(0,7).map(r=>`<div>${r.status==='won'?'✅':'↩️'} ${esc(modeLabel[r.mode])}｜${r.status==='won'?'成功':'未成功'}${r.cost?' · 消耗 '+r.cost+' XP':''} <small>${esc(r.at.slice(0,10))}</small></div>`).join('')}</div>`:'<p class="muted">尚未開始冒險。</p>'}</section>`;
}
function render(student,spendable){const s=current(student);if(!s)return `<div class="card"><h2>🏕️ 冒險公會</h2><p>正在準備國語能力驗收與 RPG 冒險資料。請先連接家庭雲端。</p>${button('同步公會資料','sync')}</div>`;
 return `<section class="guild-page"><div class="guild-summary row between"><div><h2>公會任務</h2><p class="muted">選擇要進行的國語驗收或冒險。</p></div>${button('↻ 同步','sync','','outline')}</div><div class="guild-tabs">${['forest','ruins','boss','mastery'].map(k=>button(({forest:'🌲 森林巡邏',ruins:'🏛️ 遺跡探索',boss:'🐲 BOSS 再戰',mastery:'📊 學習驗收'})[k],'tab',`data-tab="${k}"`,k===tab?'':'outline')).join('')}</div>
 ${lastResult?`<div class="callout ${lastResult.win?'green':'gold'} guild-result"><b>${lastResult.win?'🏆 挑戰完成':'📚 本次挑戰結束'}</b><p>${esc(lastResult.text||'')}</p>${button('關閉結果','clear-result','','outline')}</div>`:''}
 ${lastFeedback?`<div class="callout guild-feedback ${lastFeedback.correct===false?'gold':'green'}"><b>${lastFeedback.correct===false?'📖 答案解析':lastFeedback.correct===true?'✅ 答題正確':'⚔️ 戰鬥訊息'}</b><p>${esc(lastFeedback.text||'')}</p>${lastFeedback.correct===false?`<p><b>正確答案：</b>${esc(lastFeedback.answer)}</p>`:''}${lastFeedback.explanation?`<p class="muted sm">${esc(lastFeedback.explanation)}</p>`:''}</div>`:''}
 ${s.active?renderBattle(student,s,s.active):tab==='forest'?renderForest(student,s):tab==='ruins'?renderRuins(student,s,spendable):tab==='boss'?renderBoss(student,s):renderMastery(s)}
 ${s.active?'<p class="muted sm guild-note">一位學生同一時間只能有一場未完成的公會戰鬥，重新整理頁面可繼續原戰鬥，不會再次扣入場 XP。</p>':''}<div class="guild-footer-note">正式雲端紀錄以後端為準。公會不發 XP 或家庭獎勵點數；終身 XP 僅由正式學習模組的教師核准發放。</div></section>`;
}
function teacherReport(student){const s=C[student];if(!s)return `<div class="card"><h2>📊 公會國語能力驗收</h2><p class="muted">尚未載入這位學生的公會紀錄。</p>${button('讀取公會測驗紀錄','teacher-sync')}</div>`;
 const items=Object.entries(s.mastery||{}).sort((a,b)=>b[1].total-a[1].total);
 const weaker=items.filter(([k,v])=>v.total>=5&&v.correct/v.total<.7);
 const pending=items.filter(([k,v])=>v.total<5);
 return `<div class="card guild-master"><div class="row between"><h2>📊 公會國語能力驗收</h2>${button('↻ 同步測驗紀錄','teacher-sync','','outline')}</div><p class="muted sm">這是森林巡邏與 BOSS 再戰的選擇題正確率，代表「概念理解與辨識」；作文品質、造句創造力仍須看正式手寫作品。</p><div class="guild-huge">${s.qualifiedKills} <small>次森林有效討伐　·　${s.skillIds.length} 個技能</small></div>${weaker.length?`<div class="callout gold"><b>可優先補強</b><p>${weaker.map(([k,v])=>esc(k+' '+moduleLabel[k])+'（'+Math.round(v.correct/v.total*100)+'%）').join('、')}</p><p class="muted sm">可回到該學生的 A～L 對應模組，加強類似觀念後再觀察答題變化。</p></div>`:'<div class="callout green">目前沒有達到至少五題且正確率低於 70% 的項目。樣本不足不代表已精熟。</div>'}${items.length?`<div class="guild-master-list">${items.map(([k,v])=>`<div><div class="row between"><b>${esc(k)}｜${esc(moduleLabel[k]||k)}</b><span class="muted sm">答對 ${v.correct}/${v.total} · ${Math.round(v.correct/v.total*100)}%${v.total<5?'（樣本少）':''}</span></div><div class="guild-track"><i class="hero" style="width:${Math.round(v.correct/v.total*100)}%"></i></div></div>`).join('')}</div>`:'<p class="muted">這位學生還沒有公會測驗資料。</p>'}<p class="muted sm">至少累積 5 題後再參考該能力的趨勢；不要僅憑一兩題就判斷學習成果。</p></div>`;
}
async function handle(action,data,ctx){const student=ctx.student;if(busy)return;try{
 if(action==='tab'){tab=data.tab;ctx.render();return;}
 if(action==='clear-result'){lastResult=null;lastFeedback=null;ctx.render();return;}
 if(action==='sync'){busy=true;await load(student);lastResult=null;lastFeedback=null;busy=false;ctx.render();return;}
 if(!window.LWCloud?.active)throw Error('請先連線家庭雲端，公會戰鬥不能在離線狀態修改正式紀錄');
 busy=true;
 if(action==='start'){
  const mode=data.mode,target=data.target||'';const s=C[student]||await load(student);
  if(mode==='ruins'&&!s.active){const cost=s.ruinCosts[target];if(!confirm(`確定進入遺跡？這次立即消耗 ${cost} XP；戰敗不退費，但會保留古代粉塵。`))return;}
  const r=await LWCloud.call('guildStart',{student,mode,target});apply(student,r);
 }else if(action==='answer'||action==='move'){
  const s=C[student],run=s?.active;if(!run)throw Error('本場挑戰已結束，請重新同步');
  const payload={student,runId:run.id,step:run.step};
  if(action==='answer'){payload.choice=Number(data.choice);payload.skill=document.getElementById('guild-skill')?.value||'';}
  else {payload.move=data.move;if(data.move==='skill'){payload.skill=document.getElementById('guild-skill')?.value||'';if(!payload.skill)throw Error('請先選擇已解鎖的技能');}}
  const r=await LWCloud.call('guildAct',payload);apply(student,r);
 }else if(action==='leave'){
  const run=C[student]?.active;if(!run)return;
  if(!confirm(run.mode==='ruins'?'確定結束探索？本場 XP 不退還，但保留古代粉塵。':'確定放棄本場挑戰？已取得的學習 XP 和技能都不會消失。'))return;
  const r=await LWCloud.call('guildLeave',{student,runId:run.id});apply(student,r);
 }else throw Error('不支援的公會操作');
 busy=false;ctx.render();
 }finally{busy=false;}}
window.LWGuild={load,render,handle,getSpent,getSkillCount,hasHistory,clear,teacherReport};
})();
