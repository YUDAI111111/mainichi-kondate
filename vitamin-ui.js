/* Source-mapped micronutrient UI. Only values from listed composition records are summed. */
(function(){
 const keys=window.KONDATE_MICRO_KEYS||[];
 const foods=window.KONDATE_MICRO_FOODS||{};
 const references=window.KONDATE_TARGETS||{};
 const referenceTypes={VITA_RAE:"推奨量",VITD:"目安量",TOCPHA:"目安量",VITK:"目安量",
  THIA:"推奨量",RIBF:"推奨量",VITB6A:"推奨量",VITB12:"目安量",
  FOL:"推奨量",VITC:"推奨量",CA:"推奨量",FE:"推奨量",
  ZN:"推奨量",MG:"推奨量",K:"目標量"};
 function referenceProfile(){
  const v=el('micro-target-profile')?.value||s.microTargetProfile||'male1829';
  return ['male1829','female1829','female1829m'].includes(v)?v:'male1829';
 }
 function targetFor(key){
  const profile=referenceProfile(),row=references[key];
  if(!row)return null;
  if(key==='FE'&&profile==='female1829m')return 10;
  return row[profile==='male1829'?0:1];
 }
 function deficitList(data){
  return catalog.filter(([key])=>{
   const target=targetFor(key);
   return target!=null&&Number(data.microCovered?.[key]||0)>0&&Number(data.micro?.[key]||0)<target;
  }).sort((a,b)=>Number(data.micro?.[a[0]]||0)/targetFor(a[0])-Number(data.micro?.[b[0]]||0)/targetFor(b[0]));
 }

 const catalog=[
  ['VITA_RAE','ビタミンA','μgRAE',0],
  ['VITD','ビタミンD','μg',1],
  ['TOCPHA','ビタミンE','mg',1],
  ['VITK','ビタミンK','μg',0],
  ['THIA','ビタミンB1','mg',2],
  ['RIBF','ビタミンB2','mg',2],
  ['VITB6A','ビタミンB6','mg',2],
  ['VITB12','ビタミンB12','μg',1],
  ['FOL','葉酸','μg',0],
  ['VITC','ビタミンC','mg',1],
  ['CA','カルシウム','mg',0],
  ['FE','鉄','mg',1],
  ['ZN','亜鉛','mg',1],
  ['MG','マグネシウム','mg',0],
  ['K','カリウム','mg',0]
 ];
 const vitaminIds=new Set(['VITA_RAE','VITD','TOCPHA','VITK','THIA','RIBF','VITB6A','VITB12','FOL','VITC']);
 const round=(x,n=1)=>Number(x.toFixed(n)).toLocaleString('ja-JP',{maximumFractionDigits:n});
 const title=(i)=>daynames[i]+'曜';
 function averageData(days){
  const result={micro:{},microMissing:{},microCovered:{},count:0};
  for(const k of keys){
   result.micro[k]=days.reduce((v,d)=>v+Number(d.micro?.[k]||0),0)/7;
   result.microMissing[k]=[...new Set(days.flatMap(d=>d.microMissing?.[k]||[]))];
   result.microCovered[k]=days.reduce((v,d)=>v+Number(d.microCovered?.[k]||0),0);
  }
  result.count=days.reduce((a,d)=>a+Number(d.count||0),0);
  return result;
 }
 function formatted(d,key,digits,unit){
  const covered=d.microCovered?.[key]||0,missing=d.microMissing?.[key]||[];
  const value=covered?round(Number(d.micro?.[key]||0),digits):'—';
  return {value:value==='—'?value:value+' '+unit,covered,miss:missing.length,missing};
 }
 function nutrientCard(d,item){
  const [key,name,unit,digits]=item,got=Number(d.micro?.[key]||0),goal=targetFor(key);
  const f=formatted(d,key,digits,unit),partial=f.miss>0,below=goal!=null&&got<goal,hasAny=f.covered>0;
  const percent=goal>0?Math.round(got/goal*100):0;
  const state=hasAny?(below?(partial?'基準未達の可能性（未算出あり）':'基準未達（参考値）'):
    '基準量に到達（算出済み分）'):'データ不足で評価不可';
  const klass=!hasAny?'micro-unknown':below?'micro-below':'micro-met';
  return '<div class="micro-card '+klass+'"><div class="micro-title">'+name+'</div>'+
   '<strong class="micro-value">'+f.value+(partial?' <small>※</small>':'')+'</strong>'+
   '<div class="micro-standard">'+(referenceTypes[key]||'参考基準')+'：'+goal+' '+unit+' / 日</div>'+
   '<div class="micro-meter"><span style="width:'+Math.min(100,percent)+'%"></span></div>'+
   '<div class="micro-status">'+state+'・'+percent+'%</div>'+
   '<div class="micro-coverage">'+(f.covered?f.covered+'材料の成分値を加算':'成分値未登録')+
   (partial?'／未算出 '+f.miss+'件':'')+'</div></div>';
 }
 function detailMealRow(name,v){
  return '<tr><th>'+name+'</th><td>'+round(v.kcal,0)+' kcal'+(v.missingNutrition?.length?' ※':'')+'</td>'+
   '<td>'+round(v.protein,1)+' g</td><td>'+round(v.fat,1)+' g</td><td>'+round(v.carb,1)+' g</td>'+
   '<td>'+round(v.micro?.VITC||0,1)+' mg'+(v.microMissing?.VITC?.length?' ※':'')+'</td>'+
   '<td>'+round(v.micro?.CA||0,0)+' mg'+(v.microMissing?.CA?.length?' ※':'')+'</td></tr>';
 }
 function dailyMealHtml(data,i){
  if(i==='avg')return '<p class="micro-hint">上の曜日を選ぶと、朝食・弁当・夕食の栄養計上先を確認できます。</p>';
  const d=data.daily[+i];
  const parts=d?.meals;
  if(!parts)return '<p class="micro-hint">内訳を表示するには再計算してください。</p>';
  const lunch=bentoNeeded(+i)?
   (+i===0?'前週の夕食は未登録':
    mealKind(s.week[+i-1].main)==='normal'?'前夜の通常献立から主菜・副菜を各1食分取り分け':'別途準備（前夜が'+mealLabel(mealKind(s.week[+i-1].main))+'）'):
    '弁当なし（計上しません）';
  const rows=detailMealRow('朝食（1食分）',parts.breakfast)+
   detailMealRow('昼食／弁当（1食分）',parts.lunch)+
   detailMealRow('夕食（1食分）',parts.dinner);
  return '<p class="micro-hint">弁当：'+esc(lunch)+'。夜に2食分調理しても、夕食は1食分のみ計上し、取り分け分は翌日の昼食に計上しています。</p>'+
   '<div class="analysis-table-scroll"><table class="analysis-table micro-meal-table"><thead><tr><th>食事</th><th>熱量</th><th>たんぱく質</th><th>脂質</th><th>炭水化物</th><th>ビタミンC</th><th>カルシウム</th></tr></thead><tbody>'+
   rows+'</tbody></table></div><p class="subtle">※材料や前週献立が未登録の食事は、算出できた分だけ表示しています。</p>';
 }
 function sourceHtml(){
  const available=new Map();
  for(const row of shoppingData())if(!available.has(row.name))available.set(row.name,row.name);
  return '<details class="micro-sources"><summary>食材ごとの参照食品番号・照合先を確認</summary>'+
   '<p class="micro-hint">一部の食材は、近い食品を代用しています（豚こま肉を豚肩肉など）。食品や調理状態が違うと成分値も異なります。</p>'+
   '<div class="micro-source-list">'+[...available.keys()].sort((a,b)=>a.localeCompare(b,'ja')).map(name=>{
    const d=foods[name];
    return '<div><b>'+esc(name)+'</b><span>'+(d?esc((d.id||'番号なし')+'　'+d.source):'成分データ未照合')+'</span></div>';
   }).join('')+'</div></details>';
 }
 function renderMicro(){
  const host=el('micro-nutrients'),a=s.analysis;if(!host)return;
  if(!a||!a.daily?.[0]?.micro){
   host.innerHTML='<p class="micro-empty">未集計です。週間献立タブの「栄養計算」ボタンで計算してください。</p>';return;
  }
  const sel=el('micro-day'),choice=sel?.value||'0';
  const d=choice==='avg'?averageData(a.daily):a.daily[Number(choice)];
  if(!d)return;
  const vitamins=catalog.filter(item=>vitaminIds.has(item[0])),minerals=catalog.filter(item=>!vitaminIds.has(item[0]));
  const shown=choice==='avg'?'1週間の1日平均':title(Number(choice))+'の摂取量';
  const gaps=[...new Set(catalog.flatMap(item=>d.microMissing?.[item[0]]||[]))];
  const deficits=deficitList(d);
  const pending=deficits.filter(([key])=>(d.microMissing?.[key]||[]).length>0).length;
  const selected=referenceProfile();
  const overviews=a.daily.map((day,i)=>{
   const lacking=deficitList(day),titles=lacking.slice(0,3).map(x=>x[1]);
   return '<button type="button" class="'+(choice===String(i)?'active':'')+'" data-micro-view-day="'+i+'"><b>'+title(i)+'</b>'+
    '<span>'+(!lacking.length?'基準未達の候補なし':titles.join('・')+(lacking.length>3?' 他'+(lacking.length-3)+'項目':''))+'</span></button>';
  }).join('');
  const emphasis=deficits.map(([key,name,unit,digits])=>{
   const goal=targetFor(key),value=Number(d.micro?.[key]||0),percent=Math.round(100*value/goal);
   const incomplete=(d.microMissing?.[key]||[]).length>0;
   return '<span>'+name+'　'+percent+'%'+(incomplete?'（未算出あり）':'')+'</span>';
  }).join('');
  host.innerHTML=
   '<h3>曜日別・基準未達の候補</h3><div class="nutrition-day-overview">'+overviews+'</div>'+
   '<p class="micro-main-note">'+esc(shown)+'。基準：18〜29歳の'+
    (selected==='male1829'?'男性':selected==='female1829m'?'女性（月経あり）':'女性（月経なし）')+
    ' ／ 厚生労働省「日本人の食事摂取基準（2025年版）」。</p>'+
   '<div class="micro-deficit-summary"><h3>'+
    (deficits.length?'基準を下回る可能性がある栄養素：'+deficits.length+'項目':'基準未達の候補はありません')+'</h3>'+
    '<div class="micro-deficit-items">'+(emphasis||'<span>算出済み部分では基準に到達</span>')+'</div>'+
    '<p>基準より低い栄養素を優先表示しています。うち'+pending+'項目は未算出の食材・食事があり、<strong>実際の不足を確定できません</strong>。一日だけの結果で栄養欠乏を診断するものでもありません。</p></div>'+
   '<h3>ビタミン（摂取量と基準を比較）</h3><div class="micro-grid">'+vitamins.map(item=>nutrientCard(d,item)).join('')+'</div>'+
   '<h3>ミネラル</h3><div class="micro-grid">'+minerals.map(item=>nutrientCard(d,item)).join('')+'</div>'+
   '<div class="micro-warning">成分値は公表食品の参考値です。未登録食事、未記載の成分、加熱後の変化は推計できません。達成率は参考比較用で、個人の栄養状態を断定しません。</div>'+
   '<h3>食事別の計上内訳</h3>'+dailyMealHtml(a,choice)+
   (gaps.length?'<details class="micro-gaps"><summary>未算出の食材・食事（'+gaps.length+'件）</summary><p>'+gaps.map(esc).join('、')+'</p></details>':'')+
   sourceHtml();
  document.querySelectorAll('[data-micro-view-day]').forEach(b=>b.onclick=()=>{
   if(sel){sel.value=b.dataset.microViewDay;s.microSelectedDay=sel.value;save();renderMicro();}
  });
 }

 function renderPlannerGaps(){
  const fresh=!!s.analysis?.daily?.[0]?.micro&&!aIsStale();
  document.querySelectorAll('[data-micro-gap-day]').forEach(node=>{
   const index=Number(node.dataset.microGapDay);
   if(!fresh){
    node.hidden=true;
    node.innerHTML='';
    return;
   }
   const day=s.analysis.daily[index],shortfalls=deficitList(day);
   if(!shortfalls.length){
    node.hidden=true;
    node.innerHTML='';
    return;
   }
   node.hidden=false;
   const incomplete=shortfalls.some(([key])=>(day.microMissing?.[key]||[]).length>0);
   const chips=shortfalls.map(([key,name])=>'<span class="gap-tag">'+esc(name)+'</span>').join('');
   node.innerHTML='<span class="gap-label">不足候補</span><div class="gap-items">'+chips+'</div>'+
    (incomplete?'<span class="gap-note">未算出の料理・食材あり。実際の不足は未確定。</span>':'');
  });
 }
 const beforePlannerGaps=renderPlanner;
 renderPlanner=function(){
  beforePlannerGaps();
  renderPlannerGaps();
 };

 const previousNutrition=renderNutrition;
 renderNutrition=function(){
  previousNutrition();
  renderMicro();
  renderPlannerGaps();
  const info=el('nutrition-gaps');
  if(info)info.innerHTML='<p>出典：文部科学省「日本食品標準成分表2020年版（八訂）」に基づく食品別成分値。2023年増補・2026年正誤表の更新は未照合です。レシピの使用材料と公表食品との対応が一致しない場合や未登録の場合は参考値にとどまります。</p>'+
   '<p><a target="_blank" rel="noopener noreferrer" href="https://www.mext.go.jp/a_menu/syokuhinseibun/mext_01110.html">文部科学省：成分表2020年版（八訂）</a> ／ <a target="_blank" rel="noopener noreferrer" href="https://github.com/katoharu432/standards-tables-of-food-composition-in-japan">オープンデータ変換元（CC BY 4.0）</a></p>'+
   (aIsStale()?'<p class="warning">献立・材料が変更されています。週間献立タブで再計算してください。</p>':'');
 };
 function aIsStale(){
  return !s.analysis?.daily?.[0]?.micro||
   (el('analysis-status')?.className||'').includes('analysis-stale');
 }
 if(el('micro-day')){
  el('micro-day').value=s.microSelectedDay||'0';
  el('micro-day').onchange=()=>{
   s.microSelectedDay=el('micro-day').value;save();renderMicro();
  };
 }
 if(el('micro-target-profile')){
  el('micro-target-profile').value=s.microTargetProfile||'male1829';
  el('micro-target-profile').onchange=()=>{
   s.microTargetProfile=referenceProfile();save();renderMicro();renderPlannerGaps();
  };
 }
 renderNutrition();
})();
