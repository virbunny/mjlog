window.NUTRITION_FULL_VERSION='0.5.0';
const FULL_NUTRIENT_META=[
  {key:'kcal',label:'熱量',unit:'kcal',digits:0,group:'macro'},
  {key:'protein',label:'蛋白質',unit:'g',digits:1,group:'macro'},
  {key:'carbs',label:'碳水化合物',unit:'g',digits:1,group:'macro'},
  {key:'fat',label:'脂肪',unit:'g',digits:1,group:'macro'},
  {key:'fiber',label:'膳食纖維',unit:'g',digits:1,group:'macro'},
  {key:'sugar',label:'糖',unit:'g',digits:1,group:'macro'},
  {key:'saturatedFat',label:'飽和脂肪',unit:'g',digits:1,group:'macro'},
  {key:'transFat',label:'反式脂肪',unit:'g',digits:1,group:'macro'},
  {key:'cholesterol',label:'膽固醇',unit:'mg',digits:0,group:'macro'},
  {key:'vitaminA',label:'維生素 A',unit:'µg RAE',digits:0,group:'vitamin'},
  {key:'vitaminB1',label:'維生素 B1',unit:'mg',digits:2,group:'vitamin'},
  {key:'vitaminB2',label:'維生素 B2',unit:'mg',digits:2,group:'vitamin'},
  {key:'vitaminB3',label:'菸鹼素 B3',unit:'mg',digits:1,group:'vitamin'},
  {key:'vitaminB5',label:'泛酸 B5',unit:'mg',digits:1,group:'vitamin'},
  {key:'vitaminB6',label:'維生素 B6',unit:'mg',digits:2,group:'vitamin'},
  {key:'biotin',label:'生物素 B7',unit:'µg',digits:0,group:'vitamin'},
  {key:'folate',label:'葉酸 B9',unit:'µg',digits:0,group:'vitamin'},
  {key:'vitaminB12',label:'維生素 B12',unit:'µg',digits:1,group:'vitamin'},
  {key:'vitaminC',label:'維生素 C',unit:'mg',digits:1,group:'vitamin'},
  {key:'vitaminD',label:'維生素 D',unit:'µg',digits:1,group:'vitamin'},
  {key:'vitaminE',label:'維生素 E',unit:'mg',digits:1,group:'vitamin'},
  {key:'vitaminK',label:'維生素 K',unit:'µg',digits:0,group:'vitamin'},
  {key:'choline',label:'膽鹼',unit:'mg',digits:1,group:'vitamin'},
  {key:'calcium',label:'鈣',unit:'mg',digits:0,group:'mineral'},
  {key:'iron',label:'鐵',unit:'mg',digits:1,group:'mineral'},
  {key:'zinc',label:'鋅',unit:'mg',digits:1,group:'mineral'},
  {key:'sodium',label:'鈉',unit:'mg',digits:0,group:'mineral'},
  {key:'magnesium',label:'鎂',unit:'mg',digits:1,group:'mineral'},
  {key:'potassium',label:'鉀',unit:'mg',digits:0,group:'mineral'},
  {key:'phosphorus',label:'磷',unit:'mg',digits:0,group:'mineral'},
  {key:'copper',label:'銅',unit:'mg',digits:2,group:'mineral'},
  {key:'selenium',label:'硒',unit:'µg',digits:1,group:'mineral'},
  {key:'manganese',label:'錳',unit:'mg',digits:2,group:'mineral'},
  {key:'iodine',label:'碘',unit:'µg',digits:0,group:'mineral'},
  {key:'omega3',label:'Omega-3',unit:'mg',digits:0,group:'fatty'},
  {key:'epa',label:'EPA',unit:'mg',digits:0,group:'fatty'},
  {key:'dha',label:'DHA',unit:'mg',digits:0,group:'fatty'}
];
const FULL_NUTRIENT_BY_KEY=Object.fromEntries(FULL_NUTRIENT_META.map(x=>[x.key,x]));
const FULL_CORE_KEYS=new Set(['kcal','protein','carbs','fat','fiber','calcium','iron','zinc','sodium']);
const FULL_SUPPLEMENT_EDIT_KEYS=FULL_NUTRIENT_META.filter(x=>!FULL_CORE_KEYS.has(x.key)&&!['sugar','saturatedFat','transFat','cholesterol'].includes(x.key)).map(x=>x.key);
function fullFiniteNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function normalizeFullNutritionObject(raw,label){
  if(raw===undefined||raw===null||raw==='')return {};
  if(typeof raw!=='object'||Array.isArray(raw))throw Error((label||'營養成分')+' 必須是物件');
  const out={};
  for(const [k,v] of Object.entries(raw)){
    if(k==='custom')continue;
    if(!FULL_NUTRIENT_BY_KEY[k])throw Error((label||'營養成分')+' 不支援欄位 '+k);
    const n=fullFiniteNumber(v);if(n===null){if(v!==null&&v!==''&&v!==undefined)throw Error((label||'營養成分')+' '+k+' 必須是非負數');continue}
    out[k]=n;
  }
  if(raw.custom!==undefined){
    if(!Array.isArray(raw.custom))throw Error((label||'營養成分')+' custom 必須是陣列');
    out.custom=raw.custom.map((x,i)=>{
      if(!x||typeof x!=='object'||Array.isArray(x))throw Error((label||'營養成分')+' custom['+i+'] 格式錯誤');
      const name=String(x.name||'').trim(),unit=String(x.unit||'').trim(),value=fullFiniteNumber(x.value);
      if(!name||name.length>120||!unit||unit.length>20||value===null)throw Error((label||'營養成分')+' custom['+i+'] 缺少有效 name/value/unit');
      return {name,value,unit};
    });
  }
  return out;
}
function normalizeExtendedNutritionObject(raw,label){
  const all=normalizeFullNutritionObject(raw,label),out={};
  for(const [k,v] of Object.entries(all)){if(k==='custom'||!FULL_CORE_KEYS.has(k))out[k]=structuredClone(v)}
  return out;
}
function fullFormat(meta,v){if(v===null||v===undefined||!Number.isFinite(Number(v)))return '—';const n=Number(v),d=meta?.digits??1;return n.toLocaleString('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:0})+' '+(meta?.unit||'')}
function fullNutritionCompactText(nutrition){
  const n=nutrition&&typeof nutrition==='object'?nutrition:{},parts=[];
  for(const meta of FULL_NUTRIENT_META){if(Object.prototype.hasOwnProperty.call(n,meta.key)&&fullFiniteNumber(n[meta.key])!==null)parts.push(meta.label+' '+fullFormat(meta,n[meta.key]))}
  if(Array.isArray(n.custom))for(const c of n.custom)parts.push(c.name+' '+c.value+' '+c.unit);
  return parts.length>6?parts.slice(0,6).join('・')+'・另 '+(parts.length-6)+' 項':parts.join('・');
}
const INGREDIENT_ALIASES={
  '維生素c':'vitaminC','vitaminc':'vitaminC','b12':'vitaminB12','維生素b12':'vitaminB12',
  '生物素':'biotin','維生素b7':'biotin','維生素d':'vitaminD','維生素d3':'vitaminD',
  '維生素a':'vitaminA','維生素e':'vitaminE','維生素k':'vitaminK',
  '維生素b1':'vitaminB1','維生素b2':'vitaminB2','維生素b3':'vitaminB3','菸鹼素':'vitaminB3',
  '維生素b5':'vitaminB5','泛酸':'vitaminB5','維生素b6':'vitaminB6','葉酸':'folate','維生素b9':'folate',
  '鎂':'magnesium','鉀':'potassium','磷':'phosphorus','銅':'copper','硒':'selenium','錳':'manganese','碘':'iodine',
  'omega-3':'omega3','omega3':'omega3','epa':'epa','dha':'dha','膽鹼':'choline'
};
function fullNormalizeUnit(u){const s=String(u||'').trim();if(/^(μg|ug|mcg)$/i.test(s))return 'µg';if(/^mg$/i.test(s))return 'mg';if(/^g$/i.test(s))return 'g';if(/^iu$/i.test(s))return 'IU';if(/^kcal$/i.test(s))return 'kcal';return s}
function parseIngredientNutrition(text,structured){
  const standard={},custom=[],seen=structured&&typeof structured==='object'?structured:{};
  const seenCustom=new Set(Array.isArray(seen.custom)?seen.custom.map(c=>String(c.name||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'')+'|'+fullNormalizeUnit(c.unit)):[]);
  String(text||'').split(/[、，,；;＋+]/).map(x=>x.trim()).filter(Boolean).forEach(part=>{
    const m=part.match(/^(.+?)\s*(?:約)?\s*(\d+(?:\.\d+)?)\s*(µg|μg|ug|mcg|mg|g|IU|kcal)$/i);if(!m)return;
    const rawName=m[1].trim(),value=Number(m[2]),unit=fullNormalizeUnit(m[3]),norm=rawName.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
    const key=INGREDIENT_ALIASES[norm];
    if(key&&!Object.prototype.hasOwnProperty.call(seen,key)&&FULL_NUTRIENT_BY_KEY[key]&&FULL_NUTRIENT_BY_KEY[key].unit===unit){standard[key]=value;return}
    const cid=norm+'|'+unit;if(!seenCustom.has(cid)){custom.push({name:rawName,value,unit});seenCustom.add(cid)}
  });
  return {standard,custom};
}
function fullAdd(map,key,value){const n=fullFiniteNumber(value);if(n===null)return;map[key]=(map[key]||0)+n}
function fullAddCustom(map,item,factor){
  const value=fullFiniteNumber(item?.value);if(value===null)return;const unit=fullNormalizeUnit(item.unit),name=String(item.name||'').trim();if(!name||!unit)return;
  const id=name.normalize('NFKC').toLowerCase().replace(/\s+/g,'')+'|'+unit;
  if(!map[id])map[id]={name,unit,value:0};map[id].value+=value*(factor||1);
}
function fullCollectDiet(date){
  const standard={},custom={};const day=getMenuDay(date),log=getMenuLog(date);
  for(const meal of day.meals){
    const a=log.actual?.[meal.key];
    if(a){
      if(a.mode==='none')continue;
      if(Array.isArray(a.foods)&&a.foods.length){
        for(const food of a.foods){
          const q=Number(food.qty||1);
          for(const meta of FULL_NUTRIENT_META){
            if(FULL_CORE_KEYS.has(meta.key)&&Object.prototype.hasOwnProperty.call(food,meta.key))fullAdd(standard,meta.key,Number(food[meta.key])*q);
          }
          const extra=food.extraNutrition&&typeof food.extraNutrition==='object'?food.extraNutrition:{};
          for(const [k,v] of Object.entries(extra)){if(k==='custom')continue;if(FULL_NUTRIENT_BY_KEY[k])fullAdd(standard,k,Number(v)*q)}
          if(Array.isArray(extra.custom))extra.custom.forEach(c=>fullAddCustom(custom,c,q));
        }
      }else if(a.nutrients){
        for(const k of FULL_CORE_KEYS)if(Object.prototype.hasOwnProperty.call(a.nutrients,k))fullAdd(standard,k,a.nutrients[k]);
      }
    }else if(log.done?.[meal.key]){
      for(const k of FULL_CORE_KEYS)if(Object.prototype.hasOwnProperty.call(meal,k))fullAdd(standard,k,meal[k]);
    }
  }
  return {standard,custom};
}
function fullCollectSupplements(date){
  const standard={},custom={},logs=db.supplements?.logs?.[date]||{};
  for(const entry of Object.values(logs)){
    const s=entry?.snapshot;if(!s)continue;
    const n=s.nutrition&&typeof s.nutrition==='object'?s.nutrition:{};
    for(const [k,v] of Object.entries(n)){if(k==='custom')continue;if(FULL_NUTRIENT_BY_KEY[k])fullAdd(standard,k,v)}
    if(Array.isArray(n.custom))n.custom.forEach(c=>fullAddCustom(custom,c,1));
    const parsed=parseIngredientNutrition(s.ingredients,n);
    for(const [k,v] of Object.entries(parsed.standard))fullAdd(standard,k,v);
    parsed.custom.forEach(c=>fullAddCustom(custom,c,1));
  }
  return {standard,custom};
}
function fullTargetText(key){
  const t=db.settings?.nutritionTargets||{};
  if(key==='sodium')return '提醒 '+Number(t.sodiumWarn||1500).toLocaleString('zh-TW')+' / 上限 '+Number(t.sodium||2000).toLocaleString('zh-TW')+' mg';
  if(['kcal','protein','fiber','calcium','iron','zinc'].includes(key)&&Number(t[key]||0)>0){const m=FULL_NUTRIENT_BY_KEY[key];return fullFormat(m,t[key])}
  return '—';
}
function fullMergeCustom(a,b){const out={};for(const src of [a||{},b||{}])for(const [id,x] of Object.entries(src)){if(!out[id])out[id]={name:x.name,unit:x.unit,value:0};out[id].value+=Number(x.value||0)}return out}
function renderFullNutrition(date){
  const host=document.getElementById('fullNutritionTable'),customHost=document.getElementById('fullNutritionCustom');if(!host||!customHost)return;
  const diet=fullCollectDiet(date),sup=fullCollectSupplements(date);
  const rows=FULL_NUTRIENT_META.map(meta=>{
    const dv=Object.prototype.hasOwnProperty.call(diet.standard,meta.key)?diet.standard[meta.key]:null;
    const sv=Object.prototype.hasOwnProperty.call(sup.standard,meta.key)?sup.standard[meta.key]:null;
    const tv=dv===null&&sv===null?null:Number(dv||0)+Number(sv||0);
    return '<tr><th>'+meta.label+'</th><td>'+fullFormat(meta,dv)+'</td><td>'+fullFormat(meta,sv)+'</td><td><b>'+fullFormat(meta,tv)+'</b></td><td>'+fullTargetText(meta.key)+'</td></tr>';
  }).join('');
  host.innerHTML='<div class="full-nutrition-scroll"><table class="full-nutrition-table"><thead><tr><th>營養素</th><th>飲食</th><th>補充劑</th><th>合計</th><th>目標／上限</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  const custom=fullMergeCustom(diet.custom,sup.custom),list=Object.values(custom);
  customHost.innerHTML=list.length?'<div class="full-custom-title">其他已記錄成分</div><div class="full-custom-grid">'+list.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')).map(x=>'<div><b>'+esc(x.name)+'</b><span>'+Number(x.value).toLocaleString('zh-TW',{maximumFractionDigits:2})+' '+esc(x.unit)+'</span></div>').join('')+'</div>':'';
}
function renderSupplementExtendedFields(){
  const host=document.getElementById('supplementExtendedFields');if(!host)return;
  host.innerHTML=FULL_SUPPLEMENT_EDIT_KEYS.map(key=>{const m=FULL_NUTRIENT_BY_KEY[key];return '<div class="field"><label>'+m.label+' '+m.unit+'</label><input type="number" min="0" step="any" data-supp-ext="'+key+'" placeholder="選填"></div>'}).join('');
}
function readSupplementExtendedNutrition(){const out={};document.querySelectorAll('[data-supp-ext]').forEach(el=>{if(el.value!=='')out[el.dataset.suppExt]=Number(el.value)});return out}
function fillSupplementExtendedNutritionFields(n){document.querySelectorAll('[data-supp-ext]').forEach(el=>{el.value=n&&Object.prototype.hasOwnProperty.call(n,el.dataset.suppExt)?n[el.dataset.suppExt]:''})}
function clearSupplementExtendedNutritionFields(){fillSupplementExtendedNutritionFields({})}
