let chatgptPatchPreview=null;
const CHATGPT_REQUIRED_FOOD_FIELDS=['name','serving','qty','kcal','protein','carbs','fat','fiber','calcium','iron','zinc'];
function chatgptMealName(key){return ({breakfast:'早餐',lunch:'午餐',snack:'加餐',dinner:'晚餐'})[key]||key}
function validateChatgptPatchCompleteness(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('最外層必須是 JSON 物件');
  if(raw.format!=='mengjianlu_meals_patch_v1')throw Error('format 必須是 mengjianlu_meals_patch_v1');
  if(!Array.isArray(raw.days)||!raw.days.length)throw Error('days 必須至少有 1 天');
  raw.days.forEach((day,di)=>{
    if(!day||typeof day!=='object'||Array.isArray(day))throw Error(`days[${di}] 格式錯誤`);
    if(!Object.prototype.hasOwnProperty.call(day,'date'))throw Error(`days[${di}] 缺少 date`);
    if(!day.meals||typeof day.meals!=='object'||Array.isArray(day.meals))throw Error(`${day.date||`days[${di}]`} 缺少 meals`);
    for(const [key,m] of Object.entries(day.meals)){
      if(!m||typeof m!=='object'||Array.isArray(m))throw Error(`${day.date} ${key} 格式錯誤`);
      for(const req of ['mode','text','foods'])if(!Object.prototype.hasOwnProperty.call(m,req))throw Error(`${day.date} ${key} 缺少 ${req}`);
      if(typeof m.text!=='string'||!m.text.trim())throw Error(`${day.date} ${key} text 不可留白`);
      if(!Array.isArray(m.foods))throw Error(`${day.date} ${key} foods 必須是陣列`);
      if(m.mode==='none'){
        if(m.foods.length)throw Error(`${day.date} ${key} mode 為 none 時 foods 必須是空陣列`);
      }else{
        if(!m.foods.length)throw Error(`${day.date} ${key} foods 不可為空`);
        m.foods.forEach((food,fi)=>{
          if(!food||typeof food!=='object'||Array.isArray(food))throw Error(`${day.date} ${key} 第 ${fi+1} 項食物格式錯誤`);
          for(const field of CHATGPT_REQUIRED_FOOD_FIELDS){if(!Object.prototype.hasOwnProperty.call(food,field)||food[field]===null||food[field]==='')throw Error(`${day.date} ${key} 第 ${fi+1} 項食物缺少 ${field}`)}
        });
      }
    }
  });
  return true;
}
function parseChatgptMealsText(text){
  let body=String(text||'').trim();if(!body)throw Error('尚未貼上內容');
  const fenced=body.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)body=fenced[1].trim();
  let raw;try{raw=JSON.parse(body)}catch(e){throw Error('JSON 解析失敗：'+e.message)}
  validateChatgptPatchCompleteness(raw);return validateMealsPatch(raw);
}
function peekMenuLog(date){const x=db.menu?.logs?.[date];return x&&typeof x==='object'?x:{done:{},swaps:{},actual:{},deleted:{}}}
function buildChatgptPatchPreview(patch,sourceText){
  const entries=[];for(const day of patch.days){const log=peekMenuLog(day.date);for(const [key,m] of Object.entries(day.meals)){const next=patchMealToActual(m),prev=log.actual?.[key]||null,conflict=!!prev;entries.push({date:day.date,key,meal:m,next,prev:prev?structuredClone(prev):null,conflict,identical:conflict&&JSON.stringify(actualComparable(prev))===JSON.stringify(actualComparable(next)),decision:conflict?'skip':'add',hadDone:Object.prototype.hasOwnProperty.call(log.done||{},key),prevDone:log.done?.[key]})}}
  return {patch,entries,sourceText:String(sourceText||'')};
}
function nutrientInline(n){return `${nfmt(n.kcal)} kcal・蛋白 ${nfmt(n.protein,1)}g・碳水 ${nfmt(n.carbs,1)}g・脂肪 ${nfmt(n.fat,1)}g・纖維 ${nfmt(n.fiber,1)}g・鈣 ${nfmt(n.calcium)}mg・鐵 ${nfmt(n.iron,1)}mg・鋅 ${nfmt(n.zinc,1)}mg`}
function renderChatgptPastePreview(){
  if(!chatgptPatchPreview)return;const entries=chatgptPatchPreview.entries,conflicts=entries.filter(x=>x.conflict).length,days=[...new Set(entries.map(x=>x.date))];
  chatgptPasteSummary.innerHTML=`已完整驗證 <b>${days.length}</b> 天、<b>${entries.length}</b> 餐。${conflicts?`其中 <b>${conflicts}</b> 餐已有既有紀錄，預設「略過」，可逐餐改成覆蓋。`:'沒有既有餐次衝突。'}<br><span class="paste-ok">尚未寫入任何資料；按「確認匯入」才會正式儲存。</span>`;chatgptConflictBulk.hidden=!conflicts;
  const grouped=new Map();for(const x of entries){if(!grouped.has(x.date))grouped.set(x.date,[]);grouped.get(x.date).push(x)}
  chatgptPastePreviewList.innerHTML=[...grouped.entries()].map(([date,list])=>{const dayTotal=zeroNutrients();for(const x of list){const t=calcItemsTotal(x.meal.foods);nutrientMeta.forEach(n=>dayTotal[n.key]+=Number(t[n.key]||0))}return `<div class="paste-day"><div class="paste-day-title"><span>${esc(date)}</span><span>${list.length} 餐</span></div><div class="paste-day-total">貼上內容合計：${nutrientInline(dayTotal)}</div>`+list.map(x=>{const t=calcItemsTotal(x.meal.foods),foods=x.meal.mode==='none'?'未吃':x.meal.foods.map(f=>`${esc(f.name)} × ${nfmt(f.qty,2)}（${esc(f.serving)}）`).join('；');const conflict=x.conflict?`<div class="paste-conflict"><b>${x.identical?'既有內容相同':'已有這一餐的實際紀錄'}</b><br>請選擇：<select data-chatgpt-decision="${esc(x.date)}|${esc(x.key)}"><option value="skip" ${x.decision==='skip'?'selected':''}>略過，不修改既有紀錄</option><option value="overwrite" ${x.decision==='overwrite'?'selected':''}>覆蓋該餐</option></select></div>`:'<div class="paste-ok" style="margin-top:6px">新增這一餐</div>';return `<div class="paste-meal"><div class="paste-meal-head"><div><div class="paste-meal-name">${esc(chatgptMealName(x.key))}｜${esc(x.meal.text)}</div><div class="paste-meal-meta">${nutrientInline(t)}</div></div></div><div class="paste-foods">${foods}</div>${x.meal.note?`<div class="paste-meal-meta">備註：${esc(x.meal.note)}</div>`:''}${conflict}</div>`}).join('')+'</div>'}).join('');
  chatgptPastePreviewList.querySelectorAll('[data-chatgpt-decision]').forEach(el=>el.onchange=()=>{const [date,key]=el.dataset.chatgptDecision.split('|');const x=chatgptPatchPreview.entries.find(v=>v.date===date&&v.key===key);if(x)x.decision=el.value});chatgptPastePreview.hidden=false;
}
function setChatgptConflictDecision(value){if(!chatgptPatchPreview)return;chatgptPatchPreview.entries.filter(x=>x.conflict).forEach(x=>x.decision=value);renderChatgptPastePreview()}
function resetChatgptPreview(){chatgptPatchPreview=null;chatgptPastePreview.hidden=true;chatgptPastePreviewList.innerHTML='';chatgptPasteError.hidden=true;chatgptPasteError.textContent=''}
function openChatgptPasteDialog(){resetChatgptPreview();chatgptPasteToast.classList.add('show');chatgptPasteBackdrop.classList.add('show');setTimeout(()=>chatgptPasteInput.focus(),120)}
function closeChatgptPasteDialog(){chatgptPasteToast.classList.remove('show');chatgptPasteBackdrop.classList.remove('show');resetChatgptPreview()}
function previewChatgptPasteText(){resetChatgptPreview();try{const patch=parseChatgptMealsText(chatgptPasteInput.value);chatgptPatchPreview=buildChatgptPastePreview(patch,chatgptPasteInput.value);renderChatgptPastePreview()}catch(e){chatgptPasteError.textContent='無法匯入：'+String(e.message||e);chatgptPasteError.hidden=false}}
function ensureMenuLogOn(target,date){if(!target.menu.logs[date])target.menu.logs[date]={done:{},swaps:{},actual:{},deleted:{}};const x=target.menu.logs[date];if(!x.done)x.done={};if(!x.swaps)x.swaps={};if(!x.actual)x.actual={};if(!x.deleted)x.deleted={};return x}
function applyChatgptPastePreview(){
  if(!chatgptPatchPreview)return alert('請先解析並預覽');if(chatgptPatchPreview.sourceText!==chatgptPasteInput.value)return alert('貼上的內容已變更，請重新按「解析並預覽」。');
  const selected=chatgptPatchPreview.entries.filter(x=>!x.conflict||x.decision==='overwrite');if(!selected.length)return alert('目前所有衝突餐次都選擇略過，沒有資料需要寫入。');
  const nextDb=structuredClone(db),undo=selected.map(x=>({date:x.date,key:x.key,prev:x.prev,hadDone:x.hadDone,prevDone:x.prevDone})),dates=[...new Set(selected.map(x=>x.date))];for(const x of selected){const log=ensureMenuLogOn(nextDb,x.date);log.actual[x.key]=structuredClone(x.next);log.done[x.key]=x.next.mode!=='none'}nextDb.meta={...(nextDb.meta||{}),lastMealsPatchImport:{at:new Date().toISOString(),fileName:'貼上 ChatGPT 紀錄',dates,count:selected.length}};
  let oldUndo=null;try{oldUndo=localStorage.getItem(MEALS_PATCH_UNDO_KEY);localStorage.setItem(MEALS_PATCH_UNDO_KEY,JSON.stringify({format:'mengjianlu_meals_patch_undo_v1',createdAt:new Date().toISOString(),entries:undo}));localStorage.setItem(KEY,JSON.stringify(nextDb))}catch(e){try{if(oldUndo===null)localStorage.removeItem(MEALS_PATCH_UNDO_KEY);else localStorage.setItem(MEALS_PATCH_UNDO_KEY,oldUndo)}catch(_){}return alert('資料寫入失敗，因此這次沒有套用任何餐次。請先匯出完整備份並檢查瀏覽器儲存空間。')}
  db=nextDb;menuDate.value=dates[0];render();refreshChatgptUndoButton();closeChatgptPasteDialog();document.querySelector('[data-tab="menu"]').click();alert(`ChatGPT 飲食紀錄匯入完成：寫入 ${selected.length} 餐。`)
}
function refreshChatgptUndoButton(){let show=false;try{show=storageAvailable()&&!!localStorage.getItem(MEALS_PATCH_UNDO_KEY)}catch(e){}undoMealsPatchMenu.style.display=show?'inline-block':'none'}
const _refreshUndoMealsPatchButton=refreshUndoMealsPatchButton;refreshUndoMealsPatchButton=function(){_refreshUndoMealsPatchButton();refreshChatgptUndoButton()};
openChatgptPaste.onclick=openChatgptPasteDialog;closeChatgptPaste.onclick=closeChatgptPasteDialog;cancelChatgptPaste.onclick=closeChatgptPasteDialog;chatgptPasteBackdrop.onclick=closeChatgptPasteDialog;previewChatgptPaste.onclick=previewChatgptPasteText;applyChatgptPaste.onclick=applyChatgptPastePreview;clearChatgptPaste.onclick=()=>{chatgptPasteInput.value='';resetChatgptPreview();chatgptPasteInput.focus()};chatgptSkipAll.onclick=()=>setChatgptConflictDecision('skip');chatgptOverwriteAll.onclick=()=>setChatgptConflictDecision('overwrite');undoMealsPatchMenu.onclick=undoLastMealsPatch;refreshChatgptUndoButton();
