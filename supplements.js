window.SUPPLEMENTS_MODULE_VERSION='0.6.0';
/* 猛健錄 V0.5.0｜每日固定補充劑 */
let supplementEditId=null;

function supplementNullableNumber(v){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?n:null;
}
function normalizeSupplementItem(x){
  const nutrition=x&&typeof x.nutrition==='object'&&!Array.isArray(x.nutrition)?x.nutrition:{};
  return {id:String(x?.id||('supp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8))),name:String(x?.name||'').trim().slice(0,120),dose:String(x?.dose||'').trim().slice(0,120),timing:String(x?.timing||'任意時間').trim().slice(0,60),ingredients:String(x?.ingredients||'').trim().slice(0,500),note:String(x?.note||'').trim().slice(0,500),active:x?.active!==false,nutrition:normalizeFullNutritionObject(nutrition,'補充劑營養'),createdAt:String(x?.createdAt||new Date().toISOString()),updatedAt:String(x?.updatedAt||x?.createdAt||new Date().toISOString())};
}
function normalizeSupplementsData(raw){
  const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const items=Array.isArray(src.items)?src.items.map(normalizeSupplementItem).filter(x=>x.name):[];
  const logs=src.logs&&typeof src.logs==='object'&&!Array.isArray(src.logs)?src.logs:{};
  const cleanLogs={};
  for(const [date,entries] of Object.entries(logs)){
    if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
    cleanLogs[date]={};
    for(const [id,entry] of Object.entries(entries)){
      if(!entry||typeof entry!=='object')continue;
      const snapshot=normalizeSupplementItem(entry.snapshot||{id,name:entry.name||'已刪除補充劑',dose:entry.dose||'',timing:entry.timing||'',ingredients:entry.ingredients||'',note:entry.note||'',nutrition:entry.nutrition||{}});
      cleanLogs[date][id]={takenAt:String(entry.takenAt||''),snapshot};
    }
    if(!Object.keys(cleanLogs[date]).length)delete cleanLogs[date];
  }
  return {items,logs:cleanLogs};
}
function supplementSnapshot(item){
  const x=normalizeSupplementItem(item);
  return {id:x.id,name:x.name,dose:x.dose,timing:x.timing,ingredients:x.ingredients,note:x.note,active:x.active,nutrition:structuredClone(x.nutrition),createdAt:x.createdAt,updatedAt:x.updatedAt};
}
function supplementNutrientsForDate(date){
  const out={count:0,details:[]};FULL_NUTRIENT_META.forEach(m=>out[m.key]=0);
  const logs=db?.supplements?.logs?.[date]||{};
  for(const entry of Object.values(logs)){if(!entry?.snapshot)continue;out.count++;const n=entry.snapshot.nutrition||{};for(const meta of FULL_NUTRIENT_META){if(Object.prototype.hasOwnProperty.call(n,meta.key)&&fullFiniteNumber(n[meta.key])!==null)out[meta.key]+=Number(n[meta.key])}out.details.push(entry.snapshot.name||'補充劑')}
  return out;
}
function mergeSupplementNutrientsInto(total,date){
  if(!total||!date)return total;
  const s=supplementNutrientsForDate(date);
  for(const k of ['kcal','protein','carbs','fat','fiber','calcium','iron','zinc','sodium'])total[k]=Number(total[k]||0)+Number(s[k]||0);
  total._supplementCount=s.count;
  return total;
}
function supplementNutritionText(item){
  const direct=fullNutritionCompactText(item?.nutrition||{});if(direct)return direct;
  const parsed=parseIngredientNutrition(item?.ingredients||'',{}),parts=[];
  for(const [k,v] of Object.entries(parsed.standard)){const m=FULL_NUTRIENT_BY_KEY[k];parts.push(m.label+' '+fullFormat(m,v))}
  parsed.custom.forEach(c=>parts.push(c.name+' '+c.value+' '+c.unit));
  return parts.length>6?parts.slice(0,6).join('・')+'・另 '+(parts.length-6)+' 項':parts.join('・');
}
function supplementTodayRows(date){
  const items=db.supplements?.items||[],logs=db.supplements?.logs?.[date]||{},rows=[];
  for(const item of items){
    if(item.active||logs[item.id])rows.push({id:item.id,item,logged:logs[item.id]||null,historical:false});
  }
  for(const [id,entry] of Object.entries(logs)){
    if(items.some(x=>x.id===id))continue;
    rows.push({id,item:entry.snapshot,logged:entry,historical:true});
  }
  return rows.sort((a,b)=>String(a.item.timing||'').localeCompare(String(b.item.timing||''),'zh-Hant')||String(a.item.name||'').localeCompare(String(b.item.name||''),'zh-Hant'));
}
function renderSupplements(){
  if(typeof supplementDate==='undefined'||!db?.supplements)return;
  const date=supplementDate.value||ymd(),rows=supplementTodayRows(date),logs=db.supplements.logs[date]||{};
  supplementTodayList.innerHTML=rows.length?rows.map(r=>{
    const checked=!!logs[r.id],meta=[r.item.dose,r.item.timing,r.item.ingredients].filter(Boolean).map(esc).join('｜'),nut=supplementNutritionText(r.item);
    return '<div class="supplement-row '+(!r.item.active?'inactive':'')+'"><label class="supplement-check"><input type="checkbox" data-supplement-taken="'+esc(r.id)+'" '+(checked?'checked':'')+'><span><span class="supplement-name">'+esc(r.item.name)+'</span>'+(r.historical?' <span class="badge">歷史項目</span>':'')+'<div class="supplement-meta">'+(meta||'未填劑量／時段')+(nut?'<br>'+esc(nut):'')+(r.item.note?'<br>備註：'+esc(r.item.note):'')+'</div></span></label></div>';
  }).join(''):'<div class="empty">尚未建立固定補充劑。</div>';
  supplementTodayList.querySelectorAll('[data-supplement-taken]').forEach(el=>el.onchange=()=>toggleSupplementTaken(date,el.dataset.supplementTaken,el.checked));

  const sum=supplementNutrientsForDate(date);
  const parts=[];
  if(sum.calcium)parts.push('鈣 '+nfmt(sum.calcium,0)+' mg');
  if(sum.iron)parts.push('鐵 '+nfmt(sum.iron,1)+' mg');
  if(sum.zinc)parts.push('鋅 '+nfmt(sum.zinc,1)+' mg');
  if(sum.sodium)parts.push('鈉 '+nfmt(sum.sodium,0)+' mg');
  supplementDaySummary.innerHTML='<b>'+fmtDate(date)+'：</b>已勾選 '+sum.count+' 項'+(parts.length?'｜計入營養：'+parts.join('・'):'｜目前沒有可計入的鈣／鐵／鋅／鈉數值');

  const items=db.supplements.items||[];
  supplementMasterList.innerHTML=items.length?items.map(item=>{
    const meta=[item.dose,item.timing,item.ingredients].filter(Boolean).map(esc).join('｜'),nut=supplementNutritionText(item);
    return '<div class="supplement-row '+(!item.active?'inactive':'')+'"><div><span class="supplement-name">'+esc(item.name)+'</span> '+(item.active?'<span class="badge">每日啟用</span>':'<span class="badge">已停用</span>')+'<div class="supplement-meta">'+(meta||'未填劑量／成分')+(nut?'<br>'+esc(nut):'')+(item.note?'<br>備註：'+esc(item.note):'')+'</div></div><div class="supplement-tools"><button class="smallbtn edit-shot" data-supplement-edit="'+esc(item.id)+'">編輯</button><button class="smallbtn" data-supplement-toggle="'+esc(item.id)+'">'+(item.active?'停用':'啟用')+'</button><button class="smallbtn delete-shot" data-supplement-delete="'+esc(item.id)+'">刪除</button></div></div>';
  }).join(''):'<div class="hint">尚未新增固定補充劑。</div>';
  supplementMasterList.querySelectorAll('[data-supplement-edit]').forEach(b=>b.onclick=()=>openSupplementEdit(b.dataset.supplementEdit));
  supplementMasterList.querySelectorAll('[data-supplement-toggle]').forEach(b=>b.onclick=()=>toggleSupplementActive(b.dataset.supplementToggle));
  supplementMasterList.querySelectorAll('[data-supplement-delete]').forEach(b=>b.onclick=()=>deleteSupplementItem(b.dataset.supplementDelete));
}
function toggleSupplementTaken(date,id,checked){
  if(!db.supplements.logs[date])db.supplements.logs[date]={};
  if(checked){
    const item=db.supplements.items.find(x=>x.id===id);
    if(!item)return;
    db.supplements.logs[date][id]={takenAt:new Date().toISOString(),snapshot:supplementSnapshot(item)};
  }else{
    delete db.supplements.logs[date][id];
    if(!Object.keys(db.supplements.logs[date]).length)delete db.supplements.logs[date];
  }
  save();
}
function readSupplementForm(){
  const name=supplementName.value.trim();if(!name){alert('請輸入補充劑名稱');return null}
  const existing=supplementEditId?db.supplements.items.find(x=>x.id===supplementEditId):null;
  return normalizeSupplementItem({...(existing||{}),id:existing?.id||uid('supp'),name,dose:supplementDose.value.trim(),timing:supplementTiming.value||'任意時間',ingredients:supplementIngredients.value.trim(),note:supplementNote.value.trim(),active:existing?.active!==false,nutrition:{calcium:supplementCalcium.value===''?null:Number(supplementCalcium.value),iron:supplementIron.value===''?null:Number(supplementIron.value),zinc:supplementZinc.value===''?null:Number(supplementZinc.value),sodium:supplementSodium.value===''?null:Number(supplementSodium.value),...readSupplementExtendedNutrition()},createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
}
function clearSupplementForm(){
  supplementEditId=null;[supplementName,supplementDose,supplementIngredients,supplementCalcium,supplementIron,supplementZinc,supplementSodium,supplementNote].forEach(x=>x.value='');supplementTiming.value='早餐後';clearSupplementExtendedNutritionFields();saveSupplementItem.textContent='加入固定補充劑';cancelSupplementEdit.style.display='none';
}
function saveSupplementItemRecord(){
  const item=readSupplementForm();if(!item)return;
  const i=db.supplements.items.findIndex(x=>x.id===item.id);
  if(i>=0)db.supplements.items[i]=item;else db.supplements.items.push(item);
  clearSupplementForm();supplementEditorDetails.open=false;save();
}
function openSupplementEdit(id){
  const item=db.supplements.items.find(x=>x.id===id);if(!item)return;supplementEditId=id;supplementEditorDetails.open=true;supplementName.value=item.name||'';supplementDose.value=item.dose||'';supplementTiming.value=item.timing||'任意時間';supplementIngredients.value=item.ingredients||'';supplementNote.value=item.note||'';supplementCalcium.value=item.nutrition?.calcium??'';supplementIron.value=item.nutrition?.iron??'';supplementZinc.value=item.nutrition?.zinc??'';supplementSodium.value=item.nutrition?.sodium??'';fillSupplementExtendedNutritionFields(item.nutrition||{});saveSupplementItem.textContent='儲存修改';cancelSupplementEdit.style.display='inline-block';supplementName.focus();
}
function toggleSupplementActive(id){
  const item=db.supplements.items.find(x=>x.id===id);if(!item)return;
  item.active=!item.active;item.updatedAt=new Date().toISOString();save();
}
function deleteSupplementItem(id){
  const item=db.supplements.items.find(x=>x.id===id);if(!item)return;
  const usedDates=Object.entries(db.supplements.logs||{}).filter(([,v])=>v&&v[id]).length;
  const msg='確定刪除「'+item.name+'」？'+(usedDates?'\n過去 '+usedDates+' 天的已服用紀錄會保留為歷史快照，不會一起刪除。':'');
  if(!confirm(msg))return;
  db.supplements.items=db.supplements.items.filter(x=>x.id!==id);
  if(supplementEditId===id)clearSupplementForm();
  save();
}
function initSupplementsUI(){
  renderSupplementExtendedFields();saveSupplementItem.onclick=saveSupplementItemRecord;cancelSupplementEdit.onclick=clearSupplementForm;supplementDate.onchange=()=>renderSupplements();
}
