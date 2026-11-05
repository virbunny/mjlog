let chatgptPatchPreview=null;
const CHATGPT_REQUIRED_FOOD_FIELDS=['name','serving','qty','kcal','protein','carbs','fat','fiber','calcium','iron','zinc','sodium'];
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
  const supplements=validateChatgptSupplements(raw);
  const mealDays=raw.days.filter(day=>Object.keys(day.meals||{}).length);
  let patch={format:raw.format,days:[]};
  if(mealDays.length){const mealsRaw={...raw,days:mealDays};validateChatgptPatchCompleteness(mealsRaw);patch=validateMealsPatch(mealsRaw)}
  for(const day of raw.days){
    let target=patch.days.find(x=>x.date===day.date);
    if(!target){target={date:day.date,meals:{}};patch.days.push(target)}
    target.supplements=supplements.get(day.date)||[];
  }
  return patch;
}
function peekMenuLog(date){const x=db.menu?.logs?.[date];return x&&typeof x==='object'?x:{done:{},swaps:{},actual:{},deleted:{}}}
function buildChatgptPatchPreview(patch,sourceText){
  const entries=[];for(const day of patch.days){const log=peekMenuLog(day.date);for(const [key,m] of Object.entries(day.meals)){const next=patchMealToActual(m),prev=log.actual?.[key]||null,conflict=!!prev;entries.push({date:day.date,key,meal:m,next,prev:prev?structuredClone(prev):null,conflict,identical:conflict&&JSON.stringify(actualComparable(prev))===JSON.stringify(actualComparable(next)),decision:conflict?'skip':'add',hadDone:Object.prototype.hasOwnProperty.call(log.done||{},key),prevDone:log.done?.[key]})}}
  return {patch,entries,supplementEntries:buildSupplementPreview(patch),sourceText:String(sourceText||'')};
}
function nutrientInline(n){return `${nfmt(n.kcal)} kcal・蛋白 ${nfmt(n.protein,1)}g・碳水 ${nfmt(n.carbs,1)}g・脂肪 ${nfmt(n.fat,1)}g・纖維 ${nfmt(n.fiber,1)}g・鈣 ${nfmt(n.calcium)}mg・鐵 ${nfmt(n.iron,1)}mg・鋅 ${nfmt(n.zinc,1)}mg・鈉 ${n._sodiumKnown===false?'—':nfmt(n.sodium)}mg`}
function renderChatgptPastePreview(){
  if(!chatgptPatchPreview)return;const entries=chatgptPatchPreview.entries,conflicts=entries.filter(x=>x.conflict).length,days=[...new Set(entries.map(x=>x.date))];
  chatgptPasteSummary.innerHTML=`已完整驗證 <b>${days.length}</b> 天、<b>${entries.length}</b> 餐。${conflicts?`其中 <b>${conflicts}</b> 餐已有既有紀錄，預設「略過」，可逐餐改成覆蓋。`:'沒有既有餐次衝突。'}<br><span class="paste-ok">尚未寫入任何資料；按「確認匯入」才會正式儲存。</span>`;chatgptConflictBulk.hidden=!conflicts;
  const grouped=new Map();for(const x of entries){if(!grouped.has(x.date))grouped.set(x.date,[]);grouped.get(x.date).push(x)}
  chatgptPastePreviewList.innerHTML=[...grouped.entries()].map(([date,list])=>{const dayTotal=zeroNutrients();for(const x of list){const t=calcItemsTotal(x.meal.foods);nutrientMeta.forEach(n=>dayTotal[n.key]+=Number(t[n.key]||0));if(!t._sodiumKnown)dayTotal._sodiumKnown=false}return `<div class="paste-day"><div class="paste-day-title"><span>${esc(date)}</span><span>${list.length} 餐</span></div><div class="paste-day-total">貼上內容合計：${nutrientInline(dayTotal)}</div>`+list.map(x=>{const t=calcItemsTotal(x.meal.foods),foods=x.meal.mode==='none'?'未吃':x.meal.foods.map(f=>`${esc(f.name)} × ${nfmt(f.qty,2)}（${esc(f.serving)}）`).join('；');const conflict=x.conflict?`<div class="paste-conflict"><b>${x.identical?'既有內容相同':'已有這一餐的實際紀錄'}</b><br>請選擇：<select data-chatgpt-decision="${esc(x.date)}|${esc(x.key)}"><option value="skip" ${x.decision==='skip'?'selected':''}>略過，不修改既有紀錄</option><option value="overwrite" ${x.decision==='overwrite'?'selected':''}>覆蓋該餐</option></select></div>`:'<div class="paste-ok" style="margin-top:6px">新增這一餐</div>';return `<div class="paste-meal"><div class="paste-meal-head"><div><div class="paste-meal-name">${esc(chatgptMealName(x.key))}｜${esc(x.meal.text)}</div><div class="paste-meal-meta">${nutrientInline(t)}</div></div></div><div class="paste-foods">${foods}</div>${x.meal.note?`<div class="paste-meal-meta">備註：${esc(x.meal.note)}</div>`:''}${conflict}</div>`}).join('')+'</div>'}).join('');
  chatgptPastePreviewList.querySelectorAll('[data-chatgpt-decision]').forEach(el=>el.onchange=()=>{const [date,key]=el.dataset.chatgptDecision.split('|');const x=chatgptPatchPreview.entries.find(v=>v.date===date&&v.key===key);if(x)x.decision=el.value});chatgptPastePreview.hidden=false;
}
function setChatgptConflictDecision(value){if(!chatgptPatchPreview)return;chatgptPatchPreview.entries.filter(x=>x.conflict).forEach(x=>x.decision=value);renderChatgptPastePreview()}
function resetChatgptPreview(){chatgptPatchPreview=null;chatgptPastePreview.hidden=true;chatgptPastePreviewList.innerHTML='';chatgptPasteError.hidden=true;chatgptPasteError.textContent=''}
function openChatgptPasteDialog(){resetChatgptPreview();chatgptPasteToast.classList.add('show');chatgptPasteBackdrop.classList.add('show');setTimeout(()=>chatgptPasteInput.focus(),120)}
function closeChatgptPasteDialog(){chatgptPasteToast.classList.remove('show');chatgptPasteBackdrop.classList.remove('show');resetChatgptPreview()}
function previewChatgptPasteText(){resetChatgptPreview();try{const patch=parseChatgptMealsText(chatgptPasteInput.value);chatgptPatchPreview=buildChatgptPatchPreview(patch,chatgptPasteInput.value);renderChatgptPastePreview()}catch(e){chatgptPasteError.textContent='無法匯入：'+String(e.message||e);chatgptPasteError.hidden=false}}
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


/* V0.3.6 ChatGPT 飲食匯入 → 常吃食物庫同步 */
let libSyncCandidates=[];
let libSyncChoices=new Map();
const LIBSYNC_NUTRIENTS=['kcal','protein','carbs','fat','fiber','calcium','iron','zinc','sodium'];
const LIBSYNC_ABS_TOL={kcal:2,protein:.2,carbs:.2,fat:.2,fiber:.2,calcium:5,iron:.1,zinc:.1,sodium:5};
function libSyncNormalizeName(name){return String(name||'').normalize('NFKC').toLowerCase().trim().replace(/[\s\u3000・·._\-‐‑–—()（）【】\[\]「」『』]/g,'')}
function libSyncNormalizeServingText(v){return String(v||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')}
function libSyncParseServing(v){let s=libSyncNormalizeServingText(v).replace(/,/g,'').replace(/^半\s*/,'0.5 ');const m=s.match(/^(\d+(?:\.\d+)?)\s*(kg|公斤|g|公克|克|ml|毫升|l|公升|顆|個|包|瓶|片|杯|份|罐|條)$/i);if(!m)return null;let amount=Number(m[1]),unit=m[2].toLowerCase();if(!(amount>0))return null;if(unit==='kg'||unit==='公斤'){amount*=1000;unit='g'}else if(unit==='公克'||unit==='克')unit='g';else if(unit==='l'||unit==='公升'){amount*=1000;unit='ml'}else if(unit==='毫升')unit='ml';else if(unit==='顆'||unit==='個')unit='count';return {amount:amount,unit:unit}}
function libSyncClose(a,b,key){a=Number(a);b=Number(b);const d=Math.abs(a-b),base=Math.max(Math.abs(a),Math.abs(b),1);return d<=Math.max(LIBSYNC_ABS_TOL[key]||.1,base*.03)}
function libSyncCanonical(food,serv){const base=(serv.unit==='g'||serv.unit==='ml')?100:1,factor=base/serv.amount,out={};LIBSYNC_NUTRIENTS.forEach(function(k){out[k]=Number(food[k]||0)*factor});return out}
function libSyncCompareNutrition(aFood,bFood){if(!hasSodiumValue(aFood.sodium)||!hasSodiumValue(bFood.sodium))return {equal:false,convertible:false,reason:'既有或匯入資料未記錄鈉，不能判定營養相同',diffs:[]};const a=libSyncParseServing(aFood.serving),b=libSyncParseServing(bFood.serving);let av,bv,reason;if(a&&b&&a.unit===b.unit){av=libSyncCanonical(aFood,a);bv=libSyncCanonical(bFood,b);reason='可換算份量：'+aFood.serving+' ↔ '+bFood.serving}else if(libSyncNormalizeServingText(aFood.serving)===libSyncNormalizeServingText(bFood.serving)){av={};bv={};LIBSYNC_NUTRIENTS.forEach(function(k){av[k]=Number(aFood[k]||0);bv[k]=Number(bFood[k]||0)});reason='相同份量：'+aFood.serving}else return {equal:false,convertible:false,reason:'份量無法安全換算：'+aFood.serving+' ↔ '+bFood.serving,diffs:[]};const diffs=LIBSYNC_NUTRIENTS.filter(function(k){return !libSyncClose(av[k],bv[k],k)});return {equal:diffs.length===0,convertible:true,reason:reason,diffs:diffs,av:av,bv:bv}}
function libSyncSourceInfo(food,mealNote){const raw=String(food.source||'').trim().toLowerCase(),note=String(food.sourceNote||mealNote||'').trim();if(raw==='label'||raw==='package'||raw==='packaging')return {type:'label',note:note};if(raw==='estimated'||raw==='estimate')return {type:'estimated',note:note};if(raw==='unknown')return {type:'unknown',note:note};if(/估算|推估|一般食品|資料庫/.test(note))return {type:'estimated',note:note};if(/包裝|營養標示|食品標示|標示/.test(note))return {type:'label',note:note};return {type:'unknown',note:note}}
function libSyncSourceLabel(v){return ({label:'包裝標示',estimated:'估算',mixed:'混合來源',unknown:'來源未標示'})[v]||'來源未標示'}
function libSyncMergeSource(a,b){if(!a)return b;const notes=[a.note,b.note].filter(Boolean);return {type:a.type===b.type?a.type:'mixed',note:Array.from(new Set(notes)).join('；').slice(0,800)}}
function libSyncFoodSignature(food){const s=libSyncParseServing(food.serving),basis={};if(s){basis.unit=s.unit;basis.n=libSyncCanonical(food,s)}else{basis.serving=libSyncNormalizeServingText(food.serving);basis.n={};LIBSYNC_NUTRIENTS.forEach(function(k){basis.n[k]=Number(food[k]||0)})}return libSyncNormalizeName(food.name)+'|'+JSON.stringify(basis)}
function libSyncEffectiveEntries(){if(!chatgptPatchPreview)return [];return chatgptPatchPreview.entries.filter(function(x){return !x.conflict||x.decision==='overwrite'||x.identical})}
function libSyncBuildCandidates(){const groups=new Map();libSyncEffectiveEntries().forEach(function(entry){if(entry.meal.mode==='none')return;(entry.meal.foods||[]).forEach(function(food){if(!(Number(food.qty)>0))return;const n=libSyncNormalizeName(food.name);if(!n)return;const arr=groups.get(n)||[],same=arr.find(function(c){return libSyncCompareNutrition(food,c.food).equal}),src=libSyncSourceInfo(food,entry.meal.note);if(same)same.source=libSyncMergeSource(same.source,src);else arr.push({food:structuredClone(food),source:src});groups.set(n,arr)})});const existing=(db.foodLibrary&&Array.isArray(db.foodLibrary.custom)?db.foodLibrary.custom:[]).map(function(x){return {food:x}}),out=[];groups.forEach(function(variants,normName){variants.forEach(function(c){const sameName=existing.filter(function(e){return libSyncNormalizeName(e.food.name)===normName}),equal=sameName.find(function(e){return libSyncCompareNutrition(c.food,e.food).equal}),sig=libSyncFoodSignature(c.food);if(equal){out.push(Object.assign({},c,{signature:sig,status:'same',existing:equal}));return}if(sameName.length){const ex=sameName[0];out.push(Object.assign({},c,{signature:sig,status:'conflict',existing:ex,compare:libSyncCompareNutrition(c.food,ex.food),replaceAllowed:sameName.length===1,multiple:sameName.length>1}));return}if(variants.length>1){out.push(Object.assign({},c,{signature:sig,status:'import_conflict'}));return}out.push(Object.assign({},c,{signature:sig,status:'new'}))})});return out}
function libSyncDiffText(c){if(!c.compare)return '';if(!c.compare.convertible)return c.compare.reason;if(!c.compare.diffs.length)return c.compare.reason;const labels={kcal:'熱量',protein:'蛋白',carbs:'碳水',fat:'脂肪',fiber:'纖維',calcium:'鈣',iron:'鐵',zinc:'鋅',sodium:'鈉'},units={kcal:'kcal',protein:'g',carbs:'g',fat:'g',fiber:'g',calcium:'mg',iron:'mg',zinc:'mg',sodium:'mg'};return c.compare.reason+'；差異：'+c.compare.diffs.map(function(k){const d=(k==='kcal'||k==='calcium'||k==='sodium')?0:1;return labels[k]+' '+nfmt(c.compare.av[k],d)+' ↔ '+nfmt(c.compare.bv[k],d)+' '+units[k]}).join('、')}
function libSyncRender(){if(!chatgptPatchPreview||!chatgptPatchPreview.entries.length){chatgptLibrarySyncSection.hidden=true;return}libSyncCandidates=libSyncBuildCandidates();chatgptLibrarySyncSection.hidden=false;const add=libSyncCandidates.filter(function(x){return x.status==='new'}).length,same=libSyncCandidates.filter(function(x){return x.status==='same'}).length,conf=libSyncCandidates.filter(function(x){return x.status==='conflict'||x.status==='import_conflict'}).length;chatgptLibrarySummary.innerHTML='檢查 <b>'+libSyncCandidates.length+'</b> 種已食用食物：新食物 '+add+'、已存在相同 '+same+'、需確認 '+conf+'。<br><span class="paste-ok">新食物預設加入；同名不同營養預設保留原資料。</span>';chatgptLibraryPreview.innerHTML=libSyncCandidates.length?libSyncCandidates.map(function(c,i){const src='<span class="libsync-source '+(c.source.type==='estimated'?'estimate':'')+'">'+esc(libSyncSourceLabel(c.source.type))+'</span>',nut=nfmt(c.food.kcal)+' kcal・P '+nfmt(c.food.protein,1)+'g・碳水 '+nfmt(c.food.carbs,1)+'g・脂肪 '+nfmt(c.food.fat,1)+'g・纖維 '+nfmt(c.food.fiber,1)+'g・鈉 '+nfmt(c.food.sodium)+'mg';if(c.status==='new'){const checked=libSyncChoices.has(c.signature)?libSyncChoices.get(c.signature)==='add':true;libSyncChoices.set(c.signature,checked?'add':'keep');return '<div class="libsync-item"><label class="libsync-check"><input type="checkbox" data-libsync-add="'+i+'" '+(checked?'checked':'')+'><span><b>'+esc(c.food.name)+'</b>｜'+esc(c.food.serving)+' '+src+'<br><span class="libsync-meta">'+nut+'</span></span></label></div>'}if(c.status==='same')return '<div class="libsync-item"><b>'+esc(c.food.name)+'</b>｜'+esc(c.food.serving)+' '+src+'<div class="libsync-meta">'+nut+'<br><span class="paste-ok">已存在且換算後營養相同，不重複新增。</span></div></div>';if(c.status==='import_conflict')return '<div class="libsync-item conflict"><b>'+esc(c.food.name)+'</b>｜'+esc(c.food.serving)+' '+src+'<div class="libsync-meta">'+nut+'<br><span class="gap-near">本次貼上內容內有同名但不同營養版本，這次不自動加入食物庫。</span></div></div>';const ex=c.existing.food,choice=libSyncChoices.get(c.signature)||'keep';libSyncChoices.set(c.signature,choice);const control=c.replaceAllowed?'<select data-libsync-conflict="'+i+'"><option value="keep" '+(choice==='keep'?'selected':'')+'>保留原資料</option><option value="replace" '+(choice==='replace'?'selected':'')+'>用此次資料取代</option></select>':'<div class="libsync-lock">常吃食物庫已有多筆同名資料，請先手動整理；本次不覆蓋。</div>';return '<div class="libsync-item conflict"><b>'+esc(c.food.name)+'</b>｜此次 '+esc(c.food.serving)+' '+src+'<div class="libsync-meta">'+nut+'<br>既有：'+esc(ex.name)+'｜'+esc(ex.serving)+'<br>'+esc(libSyncDiffText(c))+'</div>'+control+'</div>'}).join(''):'<div class="hint">目前沒有可同步的已食用食物。</div>';chatgptLibraryPreview.querySelectorAll('[data-libsync-add]').forEach(function(el){el.onchange=function(){const c=libSyncCandidates[Number(el.dataset.libsyncAdd)];if(c)libSyncChoices.set(c.signature,el.checked?'add':'keep')}});chatgptLibraryPreview.querySelectorAll('[data-libsync-conflict]').forEach(function(el){el.onchange=function(){const c=libSyncCandidates[Number(el.dataset.libsyncConflict)];if(c)libSyncChoices.set(c.signature,el.value)}})}
function libSyncRecord(c,id){const f=c.food;return {id:id||('custom_cgpt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)),name:String(f.name),serving:String(f.serving),kcal:Number(f.kcal),protein:Number(f.protein),carbs:Number(f.carbs),fat:Number(f.fat),fiber:Number(f.fiber),calcium:Number(f.calcium),iron:Number(f.iron),zinc:Number(f.zinc),sodium:Number(f.sodium),nutritionSource:c.source.type,nutritionSourceNote:c.source.note||'',libraryOrigin:'chatgpt_meals_patch_v1',importedAt:new Date().toISOString()}}
function libSyncActions(){return libSyncCandidates.reduce(function(a,c){if(c.status==='new'&&libSyncChoices.get(c.signature)==='add')a.push({type:'add',candidate:c});else if(c.status==='conflict'&&c.replaceAllowed&&libSyncChoices.get(c.signature)==='replace')a.push({type:'replace',candidate:c,existing:c.existing.food});return a},[])}
function applyChatgptPastePreviewWithLibrary(){if(!chatgptPatchPreview)return alert('請先解析並預覽');if(chatgptPatchPreview.sourceText!==chatgptPasteInput.value)return alert('貼上的內容已變更，請重新按「解析並預覽」。');libSyncRender();const supplementSelected=selectedSupplementEntries();if(!supplementPreviewStillCurrent())return alert('補充劑資料已變更，請重新解析並預覽。');const selected=chatgptPatchPreview.entries.filter(function(x){return !x.conflict||x.decision==='overwrite'}),actions=libSyncActions();if(!selected.length&&!actions.length&&!supplementSelected.length)return alert('目前沒有資料需要寫入。');const nextDb=structuredClone(db),mealUndo=selected.map(function(x){return {date:x.date,key:x.key,prev:x.prev,hadDone:x.hadDone,prevDone:x.prevDone}}),dates=Array.from(new Set(selected.map(function(x){return x.date})));selected.forEach(function(x){const log=ensureMenuLogOn(nextDb,x.date);log.actual[x.key]=structuredClone(x.next);log.done[x.key]=x.next.mode!=='none'});if(!nextDb.foodLibrary)nextDb.foodLibrary={custom:[]};if(!Array.isArray(nextDb.foodLibrary.custom))nextDb.foodLibrary.custom=[];const libraryUndo=[];actions.forEach(function(a){if(a.type==='add'){const after=libSyncRecord(a.candidate);nextDb.foodLibrary.custom.push(after);libraryUndo.push({action:'add',id:after.id,after:structuredClone(after)})}else{const i=nextDb.foodLibrary.custom.findIndex(function(x){return x.id===a.existing.id});if(i<0)return;const prev=structuredClone(nextDb.foodLibrary.custom[i]),after=libSyncRecord(a.candidate,prev.id);nextDb.foodLibrary.custom[i]=after;libraryUndo.push({action:'replace',id:after.id,prev:prev,after:structuredClone(after)})}});const supplementUndo=applySupplementEntries(nextDb,supplementSelected);supplementSelected.forEach(x=>{if(!dates.includes(x.date))dates.push(x.date)});nextDb.meta=Object.assign({},nextDb.meta||{},{lastMealsPatchImport:{at:new Date().toISOString(),fileName:'貼上 ChatGPT 紀錄',dates:dates,count:selected.length,foodLibraryChanges:libraryUndo.length,supplementChanges:supplementUndo.length}});let oldUndo=null;try{oldUndo=localStorage.getItem(MEALS_PATCH_UNDO_KEY);localStorage.setItem(MEALS_PATCH_UNDO_KEY,JSON.stringify({format:'mengjianlu_meals_patch_undo_v2',createdAt:new Date().toISOString(),entries:mealUndo,libraryChanges:libraryUndo,supplementChanges:supplementUndo}));localStorage.setItem(KEY,JSON.stringify(nextDb))}catch(e){try{if(oldUndo===null)localStorage.removeItem(MEALS_PATCH_UNDO_KEY);else localStorage.setItem(MEALS_PATCH_UNDO_KEY,oldUndo)}catch(_){}return alert('資料寫入失敗，因此這次餐次、常吃食物庫與補充劑都沒有套用。')}db=nextDb;if(dates[0]){menuDate.value=dates[0];supplementDate.value=dates[0]}render();refreshChatgptUndoButton();closeChatgptPasteDialog();const targetTab=selected.length?'menu':'supplement';document.querySelector('[data-tab="'+targetTab+'"]').click();alert('ChatGPT 紀錄匯入完成：餐次 '+selected.length+' 筆；常吃食物庫新增／更新 '+libraryUndo.length+' 筆；補充劑 '+supplementSelected.length+' 項。')}
function undoLastMealsPatchV036(){let raw;try{raw=localStorage.getItem(MEALS_PATCH_UNDO_KEY)}catch(e){}if(!raw)return alert('沒有可復原的飲食／補充劑匯入');let b;try{b=JSON.parse(raw)}catch(e){return alert('回復點已損壞')};const entries=Array.isArray(b.entries)?b.entries:[],changes=Array.isArray(b.libraryChanges)?b.libraryChanges:[];const supplementChanges=Array.isArray(b.supplementChanges)?b.supplementChanges:[];if(!entries.length&&!changes.length&&!supplementChanges.length)return alert('回復點沒有可復原內容');if(!confirm('復原上次匯入：'+entries.length+' 筆餐次、'+changes.length+' 筆常吃食物庫變更、'+supplementChanges.length+' 項補充劑？'))return;const next=structuredClone(db);entries.forEach(function(x){if(!validYmdStrict(x.date))return;if(!next.menu.logs[x.date])next.menu.logs[x.date]={done:{},swaps:{},actual:{},deleted:{}};const log=next.menu.logs[x.date];if(!log.done)log.done={};if(!log.actual)log.actual={};if(x.prev)log.actual[x.key]=structuredClone(x.prev);else delete log.actual[x.key];if(x.hadDone)log.done[x.key]=x.prevDone;else delete log.done[x.key]});if(!next.foodLibrary)next.foodLibrary={custom:[]};if(!Array.isArray(next.foodLibrary.custom))next.foodLibrary.custom=[];let restored=0,skipped=0;changes.forEach(function(c){const i=next.foodLibrary.custom.findIndex(function(x){return x.id===c.id});if(c.action==='add'){if(i<0)return;if(c.after&&JSON.stringify(next.foodLibrary.custom[i])!==JSON.stringify(c.after)){skipped++;return}next.foodLibrary.custom.splice(i,1);restored++}else if(c.action==='replace'){if(i<0){skipped++;return}if(c.after&&JSON.stringify(next.foodLibrary.custom[i])!==JSON.stringify(c.after)){skipped++;return}next.foodLibrary.custom[i]=structuredClone(c.prev);restored++}});const supplementResult=restoreSupplementEntries(next,supplementChanges);const old=db;db=next;if(!persistDb()){db=old;return}try{localStorage.removeItem(MEALS_PATCH_UNDO_KEY)}catch(e){}render();refreshUndoMealsPatchButton();refreshChatgptUndoButton();let msg='已復原上次匯入';if(changes.length)msg+='；食物庫復原 '+restored+' 筆'+(skipped?'，'+skipped+' 筆因後續已修改而保留':'');if(supplementChanges.length)msg+='；補充劑復原 '+supplementResult.restored+' 項'+(supplementResult.skipped?'，'+supplementResult.skipped+' 項因後續已修改而保留':'');alert(msg)}
function renderFoodLibraryV036(){const custom=db.foodLibrary&&Array.isArray(db.foodLibrary.custom)?db.foodLibrary.custom:[];foodLibraryList.innerHTML=custom.length?custom.map(function(f){const src=f.nutritionSource?libSyncSourceLabel(f.nutritionSource):'',badge=src?' <span class="food-source-badge" title="'+esc(f.nutritionSourceNote||'')+'">'+esc(src)+'</span>':'';return '<div class="food-lib-row"><div><b>'+esc(f.name)+'</b>｜'+esc(f.serving)+badge+'<div class="food-lib-meta">'+nfmt(f.kcal)+' kcal・P '+nfmt(f.protein,1)+'g・碳水 '+nfmt(f.carbs,1)+'g・脂肪 '+nfmt(f.fat,1)+'g・纖維 '+nfmt(f.fiber,1)+'g・鈉 '+(hasSodiumValue(f.sodium)?nfmt(f.sodium)+'mg':'—')+'</div></div><button class="smallbtn" data-delete-food="'+esc(f.id)+'">刪除</button></div>'}).join(''):'<div class="hint">內建已有 '+baseFoods.length+' 種常用食物；妳自己新增的品牌／固定份量會顯示在這裡。</div>';foodLibraryList.querySelectorAll('[data-delete-food]').forEach(function(b){b.onclick=function(){db.foodLibrary.custom=db.foodLibrary.custom.filter(function(x){return x.id!==b.dataset.deleteFood});save()}})}
const _libSyncOriginalRender=renderChatgptPastePreview;renderChatgptPastePreview=function(){_libSyncOriginalRender();libSyncRender();chatgptPastePreviewList.querySelectorAll('[data-chatgpt-decision]').forEach(function(el){el.addEventListener('change',function(){setTimeout(libSyncRender,0)})})};
const _libSyncOriginalReset=resetChatgptPreview;resetChatgptPreview=function(){_libSyncOriginalReset();libSyncCandidates=[];libSyncChoices=new Map();chatgptLibrarySyncSection.hidden=true;chatgptLibraryPreview.innerHTML='';chatgptLibrarySummary.innerHTML=''};
renderFoodLibrary=renderFoodLibraryV036;undoLastMealsPatch=undoLastMealsPatchV036;undoMealsPatch.onclick=undoLastMealsPatch;undoMealsPatchMenu.onclick=undoLastMealsPatch;applyChatgptPaste.onclick=applyChatgptPastePreviewWithLibrary;renderFoodLibrary();

/* 補充劑貼上匯入。只建立當日快照，不變更每日固定清單。 */
function normalizeSupplementImportName(name){return String(name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()}
function validateOptionalSupplementText(item,key,max){const v=item[key];if(v===undefined||v===null)return '';if(typeof v!=='string')throw Error(item.name+' '+key+' 必須是文字');if(v.length>max)throw Error(item.name+' '+key+' 過長');return v.trim()}
function validateChatgptSupplements(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!=='mengjianlu_meals_patch_v1'||!Array.isArray(raw.days)||!raw.days.length||raw.days.length>366)throw Error('請提供有效的飲食／補充劑 JSON');
  const result=new Map();
  for(const day of raw.days){
    if(!day||typeof day!=='object'||Array.isArray(day)||!validYmdStrict(day.date)||result.has(day.date))throw Error('日期無效或重複');
    if(day.meals!==undefined&&(!day.meals||typeof day.meals!=='object'||Array.isArray(day.meals)))throw Error(day.date+' meals 必須是物件');
    const items=day.supplements===undefined?[]:day.supplements;
    if(!Array.isArray(items)||items.length>100)throw Error(day.date+' supplements 必須是陣列，最多 100 項');
    if(!items.length&&!Object.keys(day.meals||{}).length)throw Error(day.date+' 沒有餐次或補充劑');
    const names=new Set();
    result.set(day.date,items.map(item=>{
      if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.name!=='string'||!item.name.trim()||item.name.length>120)throw Error('補充劑名稱無效');
      if(typeof item.dose!=='string'||!item.dose.trim()||item.dose.length>120)throw Error(item.name+' 缺少用量');
      const name=item.name.trim(),normName=normalizeSupplementImportName(name);
      if(names.has(normName))throw Error(day.date+' 補充劑名稱重複：'+name);
      names.add(normName);
      const timing=validateOptionalSupplementText(item,'timing',60)||'任意時間';
      const ingredients=validateOptionalSupplementText(item,'ingredients',500);
      const note=validateOptionalSupplementText(item,'note',500);
      if(item.nutrition!==undefined&&(!item.nutrition||typeof item.nutrition!=='object'||Array.isArray(item.nutrition)))throw Error(name+' nutrition 必須是物件');
      const nutrition={};
      for(const key of ['calcium','iron','zinc','sodium']){
        const value=item.nutrition?.[key];
        nutrition[key]=value===undefined||value===null||value===''?null:safeNum(value,name+' '+key,100000);
      }
      return normalizeSupplementItem({...item,id:'paste_'+encodeURIComponent(normName),name,dose:item.dose.trim(),timing,ingredients,note,nutrition,active:false});
    }));
  }
  return result;
}
function supplementComparable(item){
  if(!item)return null;
  return {name:normalizeSupplementImportName(item.name),dose:item.dose,timing:item.timing,ingredients:item.ingredients,note:item.note,nutrition:item.nutrition};
}
function buildSupplementPreview(patch){
  const entries=[];
  const supplementDb=db.supplements||{items:[],logs:{}};
  for(const day of patch.days){
    const logs=supplementDb.logs?.[day.date]||{};
    for(const item of day.supplements||[]){
      const normName=normalizeSupplementImportName(item.name);
      const matches=Object.entries(logs).filter(([,entry])=>normalizeSupplementImportName(entry.snapshot?.name)===normName);
      if(matches.length>1)throw Error(day.date+' 有多筆同名補充劑，請先整理：'+item.name);
      const master=(supplementDb.items||[]).filter(x=>normalizeSupplementImportName(x.name)===normName);
      if(!matches.length&&master.length>1)throw Error('固定清單有多筆同名補充劑，請先整理：'+item.name);
      const id=matches[0]?.[0]||master[0]?.id||item.id;
      const prev=logs[id]||null;
      if(prev&&normalizeSupplementImportName(prev.snapshot?.name)!==normName)throw Error('補充劑識別碼衝突');
      const snapshot=supplementSnapshot({...item,id});
      entries.push({date:day.date,id,prev:prev?structuredClone(prev):null,snapshot,conflict:!!prev,identical:!!prev&&JSON.stringify(supplementComparable(prev.snapshot))===JSON.stringify(supplementComparable(snapshot)),decision:prev?'skip':'add'});
    }
  }
  return entries;
}
function selectedSupplementEntries(){return (chatgptPatchPreview?.supplementEntries||[]).filter(x=>!x.identical&&(!x.conflict||x.decision==='overwrite'))}
function supplementPreviewStillCurrent(){return (chatgptPatchPreview?.supplementEntries||[]).every(x=>JSON.stringify(db.supplements?.logs?.[x.date]?.[x.id]||null)===JSON.stringify(x.prev))}
function applySupplementEntries(target,entries){
  if(!target.supplements)target.supplements={items:[],logs:{}};
  if(!target.supplements.logs)target.supplements.logs={};
  return entries.map(x=>{
    if(!target.supplements.logs[x.date])target.supplements.logs[x.date]={};
    const after={takenAt:new Date().toISOString(),snapshot:structuredClone(x.snapshot)};
    target.supplements.logs[x.date][x.id]=after;
    return {date:x.date,id:x.id,prev:x.prev,after:structuredClone(after)};
  });
}
function restoreSupplementEntries(target,changes){
  if(!target.supplements)target.supplements={items:[],logs:{}};
  if(!target.supplements.logs)target.supplements.logs={};
  let restored=0,skipped=0;
  for(const change of changes){
    const logs=target.supplements.logs[change.date];
    if(!logs||JSON.stringify(logs[change.id])!==JSON.stringify(change.after)){skipped++;continue}
    if(change.prev)logs[change.id]=structuredClone(change.prev);else delete logs[change.id];
    if(!Object.keys(logs).length)delete target.supplements.logs[change.date];
    restored++;
  }
  return {restored,skipped};
}
const renderMealsAndLibraryPreview=renderChatgptPastePreview;
renderChatgptPastePreview=function(){
  renderMealsAndLibraryPreview();
  const entries=chatgptPatchPreview?.supplementEntries||[];
  const mealEntries=chatgptPatchPreview?.entries||[];
  const dayCount=new Set([...mealEntries.map(x=>x.date),...entries.map(x=>x.date)]).size;
  const mealConflicts=mealEntries.filter(x=>x.conflict).length;
  const supplementConflicts=entries.filter(x=>x.conflict&&!x.identical).length;
  chatgptPasteSummary.innerHTML='已完整驗證 <b>'+dayCount+'</b> 天、<b>'+mealEntries.length+'</b> 餐、<b>'+entries.length+'</b> 項補充劑。'+((mealConflicts||supplementConflicts)?'其中有衝突，預設「略過」，可逐項改成覆蓋。':'沒有既有紀錄衝突。')+'<br><span class="paste-ok">尚未寫入任何資料；按「確認匯入」才會正式儲存。</span>';
  chatgptConflictBulk.hidden=!mealConflicts&&!supplementConflicts;
  if(!entries.length)return;
  chatgptPastePreviewList.insertAdjacentHTML('beforeend','<div class="paste-day"><div class="paste-day-title"><span>補充劑</span><span>'+entries.length+' 項</span></div>'+entries.map((x,i)=>{
    const item=x.snapshot;
    const status=x.identical?'<div class="paste-ok">既有內容相同，自動略過</div>':x.conflict?'<div class="paste-conflict">已有這一天的同名補充劑紀錄<br><select data-supplement-decision="'+i+'"><option value="skip" '+(x.decision==='skip'?'selected':'')+'>略過，不修改既有紀錄</option><option value="overwrite" '+(x.decision==='overwrite'?'selected':'')+'>覆蓋當日紀錄</option></select></div>':'<div class="paste-ok">新增當日已吃紀錄</div>';
    const meta=[item.timing,item.ingredients].filter(Boolean).map(esc).join('｜');
    const nut=supplementNutritionText(item);
    return '<div class="paste-meal"><div class="paste-meal-name">'+esc(x.date)+'｜'+esc(item.name)+'｜'+esc(item.dose)+'</div>'+(meta?'<div class="paste-meal-meta">'+meta+'</div>':'')+(nut?'<div class="paste-meal-meta">'+esc(nut)+'</div>':'')+(item.note?'<div class="paste-meal-meta">備註：'+esc(item.note)+'</div>':'')+status+'</div>';
  }).join('')+'</div>');
  chatgptPastePreviewList.querySelectorAll('[data-supplement-decision]').forEach(el=>el.onchange=()=>{const x=entries[Number(el.dataset.supplementDecision)];if(x)x.decision=el.value});
};
const setMealConflictDecision=setChatgptConflictDecision;
setChatgptConflictDecision=function(value){
  if(!chatgptPatchPreview)return;
  (chatgptPatchPreview.supplementEntries||[]).filter(x=>x.conflict&&!x.identical).forEach(x=>x.decision=value);
  setMealConflictDecision(value);
};
