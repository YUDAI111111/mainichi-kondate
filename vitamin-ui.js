/* Source-mapped micronutrient UI. Only values from listed composition records are summed. */
(function(){
 const keys=window.KONDATE_MICRO_KEYS||[];
 const foods=window.KONDATE_MICRO_FOODS||{};
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
  const [key,name,unit,digits]=item;
  const f=formatted(d,key,digits,unit),partial=f.miss>0;
  return '<div class="micro-card"><div class="micro-title">'+name+'</div>'+
   '<strong class="micro-value">'+f.value+(partial?' <small>※</small>':'')+'</strong>'+
   '<div class="micro-coverage">'+(f.covered?f.covered+'材料の成分値を加算':'成分値が未登録')+
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
   host.innerHTML='<p class="micro-empty">まだビタミン・ミネラルを計算していません。週間献立タブの「栄養計算（現在のレシピで集計）」を押してください。</p>';return;
  }
  const sel=el('micro-day');
  const choice=sel?.value||'avg';
  const d=choice==='avg'?averageData(a.daily):a.daily[Number(choice)];
  if(!d)return;
  const vitamins=catalog.filter(item=>vitaminIds.has(item[0])),minerals=catalog.filter(item=>!vitaminIds.has(item[0]));
  const shown=choice==='avg'?'週の1日平均（算出済み分）':title(Number(choice))+'の摂取量（算出済み分）';
  const gaps=[...new Set(catalog.flatMap(item=>d.microMissing?.[item[0]]||[]))];
  host.innerHTML='<p class="micro-main-note">'+esc(shown)+'。<strong>食品成分表に値がある食材のみ合計しています。</strong></p>'+
   '<h3>ビタミン</h3><div class="micro-grid">'+vitamins.map(item=>nutrientCard(d,item)).join('')+'</div>'+
   '<h3>ミネラル</h3><div class="micro-grid">'+minerals.map(item=>nutrientCard(d,item)).join('')+'</div>'+
   '<div class="micro-warning">※は一部食材・食事が未算出である印です。数値は<strong>計算できた部分の小計</strong>であり、必要量を満たしているという意味ではありません。食品の生・加熱、重量変化や調理による損失は反映していません。</div>'+
   '<h3>食事別の計上内訳</h3>'+dailyMealHtml(a,choice)+
   (gaps.length?'<details class="micro-gaps"><summary>未算出の食材・食事（'+gaps.length+'件）</summary><p>'+gaps.map(esc).join('、')+'</p></details>':'')+
   sourceHtml();
 }
 const previousNutrition=renderNutrition;
 renderNutrition=function(){
  previousNutrition();
  renderMicro();
  const info=el('nutrition-gaps');
  if(info)info.innerHTML='<p>出典：文部科学省「日本食品標準成分表2020年版（八訂）」に基づく食品別成分値。2023年増補・2026年正誤表の更新は未照合です。レシピの使用材料と公表食品との対応が一致しない場合や未登録の場合は参考値にとどまります。</p>'+
   '<p><a target="_blank" rel="noopener noreferrer" href="https://www.mext.go.jp/a_menu/syokuhinseibun/mext_01110.html">文部科学省：成分表2020年版（八訂）</a> ／ <a target="_blank" rel="noopener noreferrer" href="https://github.com/katoharu432/standards-tables-of-food-composition-in-japan">オープンデータ変換元（CC BY 4.0）</a></p>'+
   (aIsStale()?'<p class="warning">献立・材料が変更されています。週間献立タブで再計算してください。</p>':'');
 };
 function aIsStale(){
  return !s.analysis?.daily?.[0]?.micro||
   (el('analysis-status')?.className||'').includes('analysis-stale');
 }
 if(el('micro-day'))el('micro-day').onchange=renderMicro;
 renderNutrition();
})();
