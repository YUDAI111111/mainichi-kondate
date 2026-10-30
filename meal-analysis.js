/* 献立からの手動集計。公的食品成分表の個別食品照合前の暫定参考値。 */
(function(){
 const meta=[
  ['kcal','エネルギー','kcal',0],
  ['protein','たんぱく質','g',1],
  ['fat','脂質','g',1],
  ['carb','炭水化物','g',1],
  ['fiber','食物繊維','g',1],
  ['salt','食塩相当量','g',1]
 ];
 const money=n=>Math.round(n).toLocaleString('ja-JP')+'円';
 const nf=(n,d=0)=>Number(n.toFixed(d)).toLocaleString('ja-JP',{maximumFractionDigits:d});
 const allow=n=>Number.isFinite(n)&&n>=0;
 const prices=window.KONDATE_ESTIMATES||{};
 const weights=window.KONDATE_UNIT_WEIGHTS||{};
 const itemPrices=window.KONDATE_ITEM_PRICE_PRESETS||{};
 const microKeys=window.KONDATE_MICRO_KEYS||[];
 const microFoods=window.KONDATE_MICRO_FOODS||{};
 function foodWeight(name,q,unit){
  if(unit==='g'||unit==='ml')return q;
  const key=name+'|'+unit;
  return weights[key]!=null?q*weights[key]:null;
 }
 function priced(name,q,unit){
  const key=name+'|'+unit;
  const hasOverride=Object.prototype.hasOwnProperty.call(s.priceOverrides||{},key);
  const by100=prices[name]?.[6];
  const unitDefault=itemPrices[key];
  const unitPrice=hasOverride?Number(s.priceOverrides[key]):unitDefault!=null?unitDefault:by100!=null&&['g','ml'].includes(unit)?by100:null;
  const base=(unit==='g'||unit==='ml')?100:1;
  return unitPrice==null||!allow(unitPrice)?null:(q/base)*unitPrice;
 }
 function unitPrice(name,unit){
  const key=name+'|'+unit;
  if(Object.prototype.hasOwnProperty.call(s.priceOverrides||{},key))return s.priceOverrides[key];
  return itemPrices[key]??(unit==='g'||unit==='ml'?prices[name]?.[6]:null);
 }
 function newTotals(){
  return {kcal:0,protein:0,fat:0,carb:0,fiber:0,salt:0,price:0,missingNutrition:new Set(),missingPrice:new Set(),count:0,
   micro:Object.fromEntries(microKeys.map(k=>[k,0])),
   microMissing:Object.fromEntries(microKeys.map(k=>[k,new Set()])),
   microCovered:Object.fromEntries(microKeys.map(k=>[k,0]))};
 }
 function plain(t){
  return {kcal:t.kcal,protein:t.protein,fat:t.fat,carb:t.carb,fiber:t.fiber,salt:t.salt,price:t.price,count:t.count,
   missingNutrition:[...t.missingNutrition],missingPrice:[...t.missingPrice],micro:{...t.micro},
   microMissing:Object.fromEntries(microKeys.map(k=>[k,[...t.microMissing[k]]])),
   microCovered:{...t.microCovered}};
 }
 function accumulate(list){
  const t=newTotals();
  for(const x of list){
   for(const key of ['kcal','protein','fat','carb','fiber','salt','price','count'])t[key]+=x[key];
   for(const name of x.missingNutrition)t.missingNutrition.add(name);
   for(const name of x.missingPrice)t.missingPrice.add(name);
   for(const key of microKeys){
    t.micro[key]+=x.micro[key];t.microCovered[key]+=x.microCovered[key];
    for(const name of x.microMissing[key])t.microMissing[key].add(name);
   }
  }
  return t;
 }
 function countOne(t,name,q,unit){
  const d=prices[name],w=foodWeight(name,q,unit),p=priced(name,q,unit);
  if(!d||w==null){
   t.missingNutrition.add(name+'（'+unit+'）');
  }else{
   const factor=w/100;
   ['kcal','protein','fat','carb','fiber','salt'].forEach((key,i)=>{t[key]+=d[i]*factor;});
  }
  const microFood=microFoods[name];
  for(let i=0;i<microKeys.length;i++){
   const key=microKeys[i],n=microFood?.v?.[i];
   if(w!=null&&typeof n==='number'&&Number.isFinite(n)){
    t.micro[key]+=n*w/100;
    t.microCovered[key]++;
   }else t.microMissing[key].add(name+'（'+unit+'）');
  }
  if(p==null)t.missingPrice.add(name+'（'+unit+'）');
  else t.price+=p;
  t.count++;
 }
 function addDish(t,recipeKey,excludesRice){
  const rec=R[recipeKey];
  if(!rec||!rec.ings?.length){
   t.missingNutrition.add(rec?.n||'料理未登録');
   t.missingPrice.add(rec?.n||'料理未登録');
   return;
  }
  for(const [name,q,unit] of rec.ings){
   // 古いレシピ内の「米」は主食として既に別計上しているため重ねない
   if(excludesRice&&name==='米')continue;
   countOne(t,name,Number(q),unit);
  }
 }
 function addRice(t){countOne(t,'ご飯（炊飯後）',160,'g');}
 function unresolved(t,message){
  t.missingNutrition.add(message);t.missingPrice.add(message);
  for(const key of microKeys)t.microMissing[key].add(message);
 }
 function totals(day){
  const breakfast=newTotals(),lunch=newTotals(),dinner=newTotals(),d=s.week[day],kind=mealKind(d.main),roles=mealRoles(d);
  // 各食は1人分。2食分調理しても夜に食べるのは1食分であり、翌日の弁当でのみ別計上。
  for(const [name,q,unit] of breakfastEntries())countOne(breakfast,name,Number(q),unit);
  if(s.morningSoup){
   if(day===0)unresolved(breakfast,'月曜朝の汁物（前週の日曜未登録）');
   else{
    const prev=s.week[day-1],prevKind=mealKind(prev.main);
    if(prevKind==='normal'||(prevKind==='pasta'&&prev.optionalSoup))addDish(breakfast,prev.soup,false);
    else unresolved(breakfast,'朝の汁物（前夜が'+mealLabel(prevKind)+'）');
   }
  }
  if(bentoNeeded(day)){
   if(day===0)unresolved(lunch,'月曜の弁当（前週の日曜未登録）');
   else{
    const prev=s.week[day-1],kindPrev=mealKind(prev.main);
    if(kindPrev==='normal'){
     addDish(lunch,prev.main,true);
     addDish(lunch,prev.side,false);
     addRice(lunch);
    }else unresolved(lunch,'弁当（前夜が'+mealLabel(kindPrev)+'）');
   }
  }
  addDish(dinner,d.main,kind==='normal');
  if(roles.includes('side'))addDish(dinner,d.side,false);
  if(roles.includes('soup'))addDish(dinner,d.soup,false);
  if(kind==='normal'||kind==='curry')addRice(dinner);
  const t=accumulate([breakfast,lunch,dinner]);
  t.meals={breakfast:plain(breakfast),lunch:plain(lunch),dinner:plain(dinner)};
  return t;
 }
  function weeklyPurchases(){
  const lines=shoppingData(),miss=[];
  let cost=0;
  for(const line of lines){
   if(line.needed<=0)continue;
   const v=priced(line.name,line.needed,line.u);
   if(v==null)miss.push(line.name+'（'+line.u+'）');else cost+=v;
  }
  // レシピの材料未登録は単価マスターだけでは見つからないため別途検出する。
  for(let i=0;i<7;i++){
   const day=s.week[i];
   for(const slot of mealRoles(day)){
    const rec=R[day[slot]];
    if(!rec?.ings?.length)miss.push(daynames[i]+'曜 '+(rec?.n||'料理未登録'));
   }
   if(bentoNeeded(i)){
    if(i===0)miss.push('月曜の弁当（前週献立未登録）');
    else if(mealKind(s.week[i-1].main)!=='normal')miss.push(daynames[i]+'曜の弁当（別途準備）');
   }
   if(s.morningSoup){
    if(i===0)miss.push('月曜の朝の汁物（前週未登録）');
    else{
     const prev=s.week[i-1],kind=mealKind(prev.main);
     if(kind!=='normal'&&!(kind==='pasta'&&prev.optionalSoup))miss.push(daynames[i]+'曜朝の汁物（別途準備）');
    }
   }
  }
  return {cost,miss:[...new Set(miss)]};
 }
 function budgetValue(){const b=Number(s.weeklyBudget);return s.weeklyBudget!==''&&allow(b)&&b>0?b:null;}
 function signature(){
  return JSON.stringify({
   version:2,week:s.week,breakfast:s.breakfast,morningSoup:s.morningSoup,
   noBentoDays:s.noBentoDays,people:s.people,
   weeklyBudget:s.weeklyBudget,priceOverrides:s.priceOverrides,stock:s.stock
  });
 }
 function snapshot(){
  const daily=s.week.map((d,i)=>{
   const t=totals(i);
   return {...plain(t),meals:t.meals};
  });
  const purchase=weeklyPurchases(),b=budgetValue();
  return {signature:signature(),daily,purchase,budget:b,people:Number(s.people)||1,time:new Date().toISOString()};
 }
 function isFresh(){return !!(s.analysis&&s.analysis.signature===signature()&&Array.isArray(s.analysis.daily)&&s.analysis.daily.length===7);}
 function statusText(){
  if(!s.analysis)return 'まだ計算していません。「栄養計算」ボタンを押してください。';
  if(!isFresh())return '献立・食材・単価・設定が変更されています。再計算してください（表示中の数値は前回の計算結果です）。';
  return '現在のレシピで集計済みです。献立を変更しても自動更新しません。';
 }
 function gapLabels(day){
  const x=day.missingNutrition.length,y=day.missingPrice.length;
  return (x?'栄養未算出 '+x+'件':'栄養データ内の食材は算出')+' / '+(y?'単価未設定 '+y+'件':'単価登録済み');
 }
 function priceLine(i,a){
  const missing=a.missingPrice.length;
  return '<div class="costday"><span>'+daynames[i]+'曜</span><strong>'+money(a.price*aPeople())+(missing?'〜':'')+'</strong><small>'+(missing?'未登録単価 '+missing+'件':'仮単価で試算')+'</small></div>';
 }
 function aPeople(){return s.analysis?.people||Number(s.people)||1;}
 function dailyTables(a){
  const rows=a.daily.map((d,i)=>{
   const nutrition=d.missingNutrition.length?'（一部食材未算出）':'（仮値）';
   return '<tr><th scope="row">'+daynames[i]+'曜</th>'+
    '<td>'+money(d.price*a.people)+(d.missingPrice.length?' ※':'')+'</td>'+
    '<td>'+nf(d.kcal)+' kcal '+(d.missingNutrition.length?'※':'')+'</td>'+
    '<td>'+nf(d.protein,1)+' g</td><td>'+nf(d.fat,1)+' g</td>'+
    '<td>'+nf(d.carb,1)+' g</td><td>'+nf(d.fiber,1)+' g</td><td>'+nf(d.salt,1)+' g</td></tr>';
  }).join('');
  return '<div class="analysis-table-scroll"><table class="analysis-table"><thead><tr><th>曜日</th><th>食費</th><th>熱量</th><th>たんぱく質</th><th>脂質</th><th>炭水化物</th><th>食物繊維</th><th>食塩相当量</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
   '<p class="subtle">※ 未算出食材がある日の数値は、確認できた材料のみの小計です。完全な1日摂取量ではありません。食費は設定した仮単価による概算です。</p>';
 }
 function summaryHTML(){
  const a=s.analysis;
  if(!a)return '<p class="analysis-empty">未集計です。献立が決まったら上のボタンで計算してください。</p>';
  const spent=a.purchase.cost,hasMissing=a.purchase.miss.length>0;
  const budget=a.budget==null?'未設定':money(a.budget);
  const over=a.budget!=null&&spent>a.budget;
  const diff=a.budget==null?'未設定':
   hasMissing?(over?'少なくとも '+money(spent-a.budget)+'超過':'残り最大 '+money(a.budget-spent)):
   money(a.budget-spent);
  const total=a.daily.reduce((sum,d)=>sum+d.price*a.people,0);
  const gaps=a.daily.flatMap((d,i)=>{
   const parts=[...new Set([...d.missingNutrition,...d.missingPrice])];
   return parts.length?['<strong>'+daynames[i]+'曜：</strong>'+parts.map(esc).join('、')]:[];
  });
  return '<div class="analysis-kpis">'+
   '<div><small>週の食費予算</small><strong>'+budget+'</strong></div>'+
   '<div><small>1週間の購入見込み（算出済み分）</small><strong>'+money(spent)+(a.purchase.miss.length?' ※':'')+'</strong></div>'+
   '<div><small>週予算との差額'+(hasMissing?'（未計上あり）':'')+'</small><strong class="'+(over?'warn-text':'')+'">'+diff+'</strong></div>'+
   '<div><small>今週の食事分（参考）</small><strong>'+money(total)+'</strong></div></div>'+
   '<p class="analysis-foot">購入見込みは在庫差引後の買い物リストから算出。各日の食費は食べる料理の材料費です。計上範囲が異なり、一致するとは限りません。'+
    (a.purchase.miss.length?'未計上の材料・食事・単価：'+a.purchase.miss.map(esc).join('、')+'。':'')+'</p>'+
   '<h3>曜日別の食費・栄養素</h3>'+dailyTables(a)+
   (gaps.length?'<details class="analysis-gaps"><summary>計算に含められなかった食材・食事（'+gaps.length+'日）</summary><p>'+gaps.join('</p><p>')+'</p></details>':'');
 }
 function renderPanel(){
  const summary=el('analysis-summary');
  if(summary)summary.innerHTML=summaryHTML();
  const status=el('analysis-status');
  if(status){status.textContent=statusText();status.className='analysis-status '+(!isFresh()?'analysis-stale':'analysis-fresh');}
  document.querySelectorAll('[data-cost-day]').forEach(node=>{
   const i=Number(node.dataset.costDay);
   const item=s.analysis?.daily?.[i];
   node.innerHTML=item?
    '<div class="cost-label"><span>1日の食費（概算）</span><strong>'+money(item.price*aPeople())+(item.missingPrice.length?' ※':'')+'</strong></div>'+
    (!isFresh()?'<div class="mealnote">前回の集計結果</div>':''):
    '<div class="cost-label muted">1日の食費：未集計</div>';
  });
 }
 const oldPlanner=renderPlanner;
 renderPlanner=function(){oldPlanner();renderPanel();};
 const oldSettings=renderSettings;
 renderSettings=function(){oldSettings();renderPrices();};
 const oldNutrition=renderNutrition;
 renderNutrition=function(){
  if(!s.analysis){
   el('nutrients').innerHTML='<p>栄養計算は未実行です。献立画面の「栄養計算」ボタンで集計してください。</p>';
   el('nutrition-gaps').innerHTML='<p>日本食品標準成分表の食品コード照合は未実装です。下記は仮の参考値であり、ビタミンやミネラルの正確な値は算出していません。</p>';
   return;
  }
  el('nutrients').innerHTML=summaryHTML();
  el('nutrition-gaps').innerHTML='<p>食品成分データはアプリ内の仮参考値です。公的食品成分表の食品番号との個別照合は済んでいません。エネルギー・たんぱく質・脂質・炭水化物・食物繊維・食塩相当量のみを概算しています。</p>'+
  '<p><a href="https://fooddb.mext.go.jp/" target="_blank" rel="noopener noreferrer">文部科学省 食品成分データベース（食品の正確な成分値を確認）</a></p>'+
  '<p class="small">以下の栄養素は未計算です：ビタミンA・B1・B2・B6・B12・C・D・E・K、葉酸、カルシウム、鉄、亜鉛、マグネシウム、カリウム。</p>'+
  (isFresh()?'':'<p class="warning">前回の集計結果です。変更を反映するには献立画面で再計算してください。</p>');
 };
 function renderPrices(){
  const master=el('price-master');if(!master)return;
  const names=new Map();
  for(const x of shoppingData())names.set(x.name+'|'+x.u,{name:x.name,unit:x.u});
  const entries=[...names.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  master.innerHTML='<p class="small muted">現在の献立で使用する食材の仮単価です。1単位あたりの金額を変更できます。未入力なら初期の仮単価を利用します。</p>'+
   '<div class="price-list">'+entries.map(x=>{
    const key=x.name+'|'+x.unit;
    const base=(x.unit==='g'||x.unit==='ml')?'100'+x.unit:'1'+x.unit;
    const def=unitPrice(x.name,x.unit);
    return '<label class="price-row"><span>'+esc(x.name)+'<small> / '+esc(base)+'</small></span>'+
     '<input data-price-value="'+esc(key)+'" type="number" min="0" step="0.1" value="'+(def==null?'':Number(def))+'" placeholder="未設定" aria-label="'+esc(x.name)+'の単価">'+
     '<span>円</span></label>';
   }).join('')+'</div>'+
   '<p class="subtle">数量の基準は、g/mlの場合は100単位、卵は1個、納豆は1パックなどです。値は店舗価格ではなく仮の参考単価です。</p>';
 }
 el('run-nutrition').onclick=()=>{
  s.analysis=snapshot();
  save();renderPanel();renderNutrition();
  const section=el('analysis-summary');if(section?.scrollIntoView)section.scrollIntoView({behavior:'smooth',block:'start'});
 };
 el('save-price-master').onclick=()=>{
  const inputs=[...document.querySelectorAll('[data-price-value]')],next={};
  for(const inp of inputs){
   if(!inp.value.trim())continue;
   const n=Number(inp.value);
   if(!allow(n)||n>1e6){alert('食材単価は0円以上の数値で入力してください。');return;}
   next[inp.dataset.priceValue]=n;
  }
  s.priceOverrides=next;save();renderPlanner();renderSettings();
  alert('食材単価を保存しました。栄養計算ボタンで再集計してください。');
 };
 renderPlanner();renderSettings();renderPanel();
})();
