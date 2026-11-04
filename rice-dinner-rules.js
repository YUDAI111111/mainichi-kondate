/* ご飯中心の献立ルール。
 * 洋食を通常夕食で採用するのは各月の最初の月曜を含む週に最大1回。
 * パスタは本人指定で毎週1〜2回、カレーはご飯用の主菜なので別扱い。
 * 白米に合うかは料理上の好みのため、明示の候補と簡易判定で保守的に制御。
 */
(function(){
 const approvedWestern=new Set([
  "catalog_recipe_002", // 鮭ののりバタームニエル（醤油とのり）
  "catalog_recipe_003", // 酒蒸しハンバーグ（きのこソース）
  "catalog_recipe_053"  // 鮭と野菜のバターホイル焼き（醤油）
 ]);
 const hardNo=/クリーム|ミルク煮|シチュー|グラタン|ポタージュ|ロールキャベツ|ホワイトソース|チーズ煮|カルボナーラ|ピカタ/;
 const soyHints=/醤油|しょうゆ|照り焼き|てりやき|和風|味噌|みそ/;
 const meatName=/鶏|豚|牛|肉|鮭|さば|魚|ハンバーグ/;
 const cuisineOf=(key,db,catalog)=>{
  const fromCatalog=catalog.find(x=>x.appId===key);
  return db[key]?.cuisine||fromCatalog?.cuisine||"";
 };
 const kindOf=(key,db,catalog)=>{
  if(key==="pasta"||db[key]?.cat==="pasta")return "pasta";
  const item=catalog.find(x=>x.appId===key);
  return item?.category==="curry"||item?.category==="pot"?item.category:
   db[key]?.mealKind==="curry"||db[key]?.mealKind==="pot"?db[key].mealKind:"normal";
 };
 function isWestern(key,db,catalog){
  return kindOf(key,db,catalog)==="normal"&&cuisineOf(key,db,catalog)==="洋風";
 }
 function riceFriendly(key,db,catalog){
  if(kindOf(key,db,catalog)!=="normal")return true;
  if(!isWestern(key,db,catalog))return true;
  if(approvedWestern.has(key))return true;
  const dish=db[key];
  if(!dish)return false;
  const name=String(dish.n||""),ingredients=dish.ings||[];
  if(hardNo.test(name))return false;
  // 野菜だけ・汁物などを主菜と判断しない。
  if(!meatName.test(name))return false;
  // 牛乳・豆乳を煮込みに大量に使うものは白米用の候補から外す。
  if(ingredients.some(x=>/牛乳|生クリーム|豆乳/.test(x[0])&&Number(x[1])>=40))return false;
  return soyHints.test(name)||ingredients.some(x=>/^(醤油|薄口醤油|味噌|白味噌)$/.test(x[0])&&Number(x[1])>=5);
 }
 function mondayISO(date=new Date()){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()-(d.getDay()+6)%7);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
 }
 function fromISO(str){
  if(typeof str!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(str))return null;
  const [y,m,d]=str.split("-").map(Number);
  const date=new Date(y,m-1,d);
  return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null;
 }
 function monthlyQuota(weekStart){
  const start=fromISO(weekStart);
  if(!start)return 0;
  // その月の最初の月曜日がこの週に当たるときだけ洋食1回枠。
  const firstMonday=new Date(start.getFullYear(),start.getMonth(),1);
  firstMonday.setDate(1+(8-firstMonday.getDay())%7);
  return mondayISO(start)===mondayISO(firstMonday)?1:0;
 }
 function issues(week,weekStart,db,catalog){
  const quota=monthlyQuota(weekStart),western=week.map((day,i)=>isWestern(day.main,db,catalog)?i:-1).filter(i=>i>=0);
  const result=[];
  for(let i=0;i<week.length;i++){
   const main=week[i].main;
   if(kindOf(main,db,catalog)!=="normal")continue;
   if(!riceFriendly(main,db,catalog))result.push({day:i,reason:"白米に合いにくい洋食は通常献立から除外"});
   if(isWestern(main,db,catalog)&&(quota===0||western.length>quota))
    result.push({day:i,reason:quota===0?"今週は月1回の洋食枠ではありません":"洋食はこの週に1回まで"});
  }
  return result;
 }
 function allowReplacement(key,day,week,weekStart,db,catalog){
  if(!riceFriendly(key,db,catalog))return false;
  if(!isWestern(key,db,catalog))return true;
  if(!monthlyQuota(weekStart))return false;
  return week.every((d,i)=>i===day||!isWestern(d.main,db,catalog));
 }
 window.KONDATE_RICE_RULES={approvedWestern:[...approvedWestern],isWestern,riceFriendly,
  kindOf,mondayISO,monthlyQuota,issues,allowReplacement};
})();