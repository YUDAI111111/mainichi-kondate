/* 料理レパートリー画面。catalog.js は公開のレシピ名称・出典データのみを保持する。 */
const CATALOG_CATEGORY_LABEL={main:"主菜",side:"副菜",soup:"汁物",pot:"鍋",curry:"カレー"};
function renderCatalog(){
  const cat=el("catalog-category").value;
  const cuisine=el("catalog-cuisine").value;
  const src=el("catalog-source").value;
  const query=el("catalog-query").value.trim().toLocaleLowerCase("ja");
  const matches=KONDATE_CATALOG.filter(item=>{
    if(cat&&item.category!==cat)return false;
    if(cuisine&&item.cuisine!==cuisine)return false;
    if(src){
      if(src==="その他の料理家"){if(!item.original||/長谷川あかり|リュウジ/.test(item.source))return false;}
      else if(!item.source.includes(src))return false;
    }
    return !query||[item.name,item.style,item.source,item.original||""].join(" ").toLocaleLowerCase("ja").includes(query);
  });
  el("catalog-count").textContent="表示 "+matches.length+"品 ／ 登録 "+KONDATE_CATALOG.length+"品（料理家の参考レシピ "+KONDATE_CATALOG.filter(x=>x.original).length+"品）";
  el("catalog-grid").innerHTML=matches.map(item=>{
    const ref=item.original
      ?"<strong>参考：</strong>"+esc(item.source)+"<div>掲載料理："+esc(item.original)+"</div><div>アプリで調整："+esc(item.adjustment||"未登録")+"</div>"
      :"家庭料理の登録例";
    return '<article class="catalog-card"><div class="catalog-meta">'+esc(item.cuisine)+" · "+esc(item.style)+" · "+esc(CATALOG_CATEGORY_LABEL[item.category])+
      '</div><h3>'+esc(item.name)+'</h3><div class="catalog-note">'+ref+'</div><div class="catalog-actions"><button class="btn tiny" data-catalog-detail="'+esc(item.id)+
      '">材料・作り方を見る</button><button class="btn tiny primary" data-catalog-use="'+esc(item.id)+'">献立に使う</button></div></article>';
  }).join("")||"<p>条件に一致する料理はありません。</p>";
  document.querySelectorAll("[data-catalog-detail]").forEach(btn=>btn.onclick=()=>catalogDetail(btn.dataset.catalogDetail));
  document.querySelectorAll("[data-catalog-use]").forEach(btn=>btn.onclick=()=>catalogUse(btn.dataset.catalogUse));
}
function catalogDetail(recipeId){
  const item=KONDATE_CATALOG.find(x=>x.id===recipeId);if(!item)return;
  const rec=R[item.appId],have=rec&&rec.ings&&rec.ings.length>0;
  const ingredients=have
    ?'<div class="ingredientlist">'+rec.ings.map(x=>'<span class="ingredient">'+esc(x[0])+" "+fmt(x[1]*s.people)+esc(x[2])+"</span>").join("")+"</div>"
    :'<p class="warning">材料・分量は未登録です。料理名から推測して補完していません。</p>';
  const origin=item.original
    ?"<p>参考："+esc(item.source)+"</p><p>掲載料理："+esc(item.original)+"</p><p class=\"small muted\">調整："+esc(item.adjustment||"未登録")+"</p>"
    :'<p class="small muted">家庭料理の登録例</p>';
  const sourceLink=item.url
    ?'<p><a target="_blank" rel="noopener noreferrer" href="'+esc(item.url)+'">参考元レシピを別タブで開く ↗</a></p>'
    :(item.original?'<p class="small muted">参考元の直接URLは未確認です。</p>':"");
  modal(item.name,origin+ingredients+sourceLink+'<p class="small muted">調理手順：未登録。原典未確認の手順を作り物で補いません。</p>');
}
function catalogUse(recipeId){
  const item=KONDATE_CATALOG.find(x=>x.id===recipeId);if(!item)return;
  const slot=(item.category==="pot"||item.category==="curry")?"main":item.category;
  modal("献立に使う： "+item.name,
    '<p>この料理を配置する曜日を指定してください。ほかの料理・評価は維持します。</p>'+
    '<p class="small muted">区分：'+esc(CATALOG_CATEGORY_LABEL[item.category])+"</p>"+
    '<select id="catalog-day-choice" style="width:100%;padding:10px">'+daynames.map((d,i)=>'<option value="'+i+'">'+d+"曜日</option>").join("")+"</select>"+
    '<p style="margin-top:14px"><button class="btn primary" id="catalog-use-confirm">献立に採用する</button></p>'
  );
  el("catalog-use-confirm").onclick=()=>{
    const day=Number(el("catalog-day-choice").value);
    if(!Number.isInteger(day)||day<0||day>6)return;
    if(!R[item.appId].ings.length&&!confirm("この料理は材料が未登録です。アレルギー確認・買い物量・栄養計算ができません。それでも献立に配置しますか？"))return;
    s.week[day][slot]=item.appId;
    delete s.ratings[id(day,slot)];
    save();renderPlanner();el("modalbg").classList.remove("show");
  };
}
["catalog-category","catalog-cuisine","catalog-source","catalog-query"].forEach(key=>{
  el(key).addEventListener(key==="catalog-query"?"input":"change",renderCatalog);
});
const oldRenderShopping=renderShopping;
renderShopping=function(){
  oldRenderShopping();
  const missing=Array.from(new Set(s.week.flatMap(d=>(R[d.main]?.isOneDish?["main"]:slots)
    .map(t=>R[d[t]]).filter(rec=>rec&&!rec.ings.length).map(rec=>rec.n))));
  el("catalog-missing").innerHTML=missing.length
    ?'<div class="warning" style="margin-bottom:16px"><strong>材料未登録（集計対象外）：</strong>'+missing.map(esc).join("、")+"</div>"
    :"";
};
