/* 献立の味・濃さ・料理系統の組み合わせ判定（栄養学的な禁忌の判定ではない）。
 * 料理名、系統、原材料からヒューリスティックに判定。わからない料理は警告扱い。
 */
(function(){
 const negligible=new Set(["玉ねぎ","にんにく","生姜","塩","砂糖","醤油","水","料理酒","みりん","だし汁","鶏がらだし","コンソメ","調理油","こしょう","黒こしょう","片栗粉","薄力粉","かつお節"]);
 const foodClusters=[
  ["きのこ",/しめじ|えのき|エリンギ|マッシュルーム|しいたけ|椎茸|なめこ|きのこ|舞茸/],
  ["コーン",/コーン|とうもろこし/],["じゃがいも",/じゃがいも|ポテト/],
  ["かぼちゃ",/かぼちゃ|南瓜/],["キャベツ",/キャベツ/],
  ["白菜",/白菜/],["ブロッコリー",/ブロッコリー/],
  ["ほうれん草",/ほうれん草/],["小松菜",/小松菜/],
  ["にんじん",/にんじん/],["大根",/大根/],["かぶ",/かぶ/],
  ["卵",/卵|たまご|玉子/],["豆腐",/豆腐|厚揚げ/],
  ["鶏肉",/鶏もも|鶏むね|鶏肉|鶏ひき|鶏団子|つくね/],
  ["豚肉",/豚肉|豚バラ|豚こま|豚ひき|豚ロース|肉団子/],
  ["牛肉",/牛肉|牛薄切り/],["鮭",/鮭/],
  ["ベーコン",/ベーコン/],["チーズ",/チーズ/]
 ];
 const sharedSensitive=new Set(["きのこ","コーン","じゃがいも","かぼちゃ","キャベツ","白菜","ブロッコリー","ほうれん草","小松菜","大根","かぶ","鶏肉","豚肉","牛肉","鮭","チーズ"]);
 function dishInfo(rec){
  if(!rec)return null;
  const name=String(rec.n||""),style=String(rec.style||""),txt=name+" "+style;
  const ing=Array.isArray(rec.ings)?rec.ings:[];
  const ingredients=ing.map(v=>({name:String(v[0]),quantity:Number(v[1]||0),unit:v[2]}));
  const present=new Set();
  const dominant=new Set();
  for(const [k,regex] of foodClusters){
   const matches=ingredients.filter(x=>regex.test(x.name));
   const qty=matches.reduce((v,x)=>v+(x.unit==="g"||x.unit==="ml"?x.quantity:50*x.quantity),0);
   if(matches.length||regex.test(name))present.add(k);
   if((regex.test(name)&&qty>=10)||qty>=40)dominant.add(k);
  }
  const creamy=/クリーム|ミルク|ポタージュ|ホワイト|グラタン|シチュー|豆乳|チーズ|カルボナーラ|クリーミー/.test(txt)||
   ingredients.some(x=>/牛乳|無調整豆乳|生クリーム/.test(x.name)&&x.quantity>=40);
  const fatty=/こってり|濃厚|バター|チーズ|クリーム|ミルク|揚げ|唐揚げ|フライ|カツ|回鍋肉|麻婆|キーマ/.test(txt);
  const meatBroth=/豚汁|肉団子|鶏団子|具だくさん.*汁/.test(txt)||
    ingredients.some(x=>/豚こま|豚バラ|鶏ひき/.test(x.name)&&x.quantity>=40);
  let richness=creamy?3:fatty?2:meatBroth?2:0;
  if(/ソテー|炒め|蒸し煮/.test(txt)&&!creamy)richness=Math.max(richness,1);
  if(/澄まし|すまし|お吸い物|コンソメ|だし汁|塩だし|野菜汁|中華スープ|おひたし|煮びたし/.test(txt)&&!creamy&&!meatBroth)richness=0;
  const flavors=new Set();
  if(creamy)flavors.add("乳系・クリーム");
  if(/みそ|味噌/.test(txt))flavors.add("みそ");
  if(/バター/.test(txt))flavors.add("バター");
  if(/ごま/.test(txt))flavors.add("ごま");
  if(/トマト|ミネストローネ/.test(txt))flavors.add("トマト");
  if(/カレー/.test(txt))flavors.add("カレー");
  if(/にんにく/.test(txt))flavors.add("にんにく");
  return {name,cuisine:String(rec.cuisine||""),richness,creamy,meatBroth,present,dominant,flavors};
 }
 function assess(map,mainKey,sideKey,soupKey){
  const main=dishInfo(map[mainKey]),side=dishInfo(map[sideKey]),soup=dishInfo(map[soupKey]);
  const issues=[],soft=[];
  if(!main||!side||!soup)return {ok:false,score:1000,issues:["材料・料理が未登録"],soft:[]};
  const add=(text,hard=true)=>(hard?issues:soft).push(text);
  if(!main.cuisine||!side.cuisine||!soup.cuisine)add("料理系統が未登録",true);
  if(main.cuisine&&side.cuisine&&main.cuisine!==side.cuisine)add("主菜と副菜の料理系統が異なります");
  if(main.cuisine&&soup.cuisine&&main.cuisine!==soup.cuisine)add("主菜と汁物の料理系統が異なります");
  if(main.richness>=2&&soup.richness>=2)add("こってりした主菜と重い汁物が重なっています");
  if(main.creamy&&soup.creamy)add("主菜と汁物がどちらもクリーム・乳系です");
  if(main.richness>=2&&side.richness>=2)add("主菜と副菜がどちらも濃厚です");
  if(side.richness>=2&&soup.richness>=2)add("副菜と汁物がどちらも濃厚です",false);
  if(soup.meatBroth&&main.richness>=1)add("肉が中心の主菜に具だくさんの肉汁が重なっています",false);
  for(const flavor of main.flavors){
   if(soup.flavors.has(flavor)&&flavor!=="にんにく")add("主菜と汁物が同じ「"+flavor+"」の味付けです");
  }
  for(const [a,b,labels] of [[main,soup,"主菜と汁物"],[side,soup,"副菜と汁物"],[main,side,"主菜と副菜"]]){
   for(const ingredient of a.dominant){
    if(sharedSensitive.has(ingredient)&&b.dominant.has(ingredient)){
     // Same dominant ingredient in two dishes is particularly repetitive.
     add(labels+"で「"+ingredient+"」が重なっています",labels!=="主菜と副菜");
    }
   }
  }
  // Creamy main + buttery side is needlessly heavy even with a light soup.
  if(main.creamy&&side.flavors.has("バター"))add("クリーム主菜とバター副菜で脂っこさが重なります",false);
  const dedupHard=[...new Set(issues)],dedupSoft=[...new Set(soft)];
  return {ok:dedupHard.length===0,score:dedupHard.length*100+dedupSoft.length*12,
   issues:dedupHard,soft:dedupSoft};
 }
 window.KONDATE_PAIRING={assess,dishInfo};
})();