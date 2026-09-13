let schedule=null, selectedAddress="", month=new Date(2026,8,1), selectedDay=null;
const FAV="sochaczewFavorites", SET="sochaczewSettings";
const $=id=>document.getElementById(id);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g," ").trim();
const date=s=>{let [d,m,y]=s.split(".").map(Number);return new Date(y,m-1,d)};
const long=d=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"long",year:"numeric"}).format(d);
const short=d=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"long"}).format(d);

function streets(){return [...new Set(Object.values(schedule.streetGroups.mixed).flat().concat(Object.values(schedule.streetGroups.segregated).flat()))].sort((a,b)=>a.localeCompare(b,"pl"))}
function streetOf(a){return (a||"").trim().replace(/\s+\d+[A-Za-z]?(?:[/-]\d+)?$/,"").trim()}
function findStreet(a){let n=norm(streetOf(a));return streets().find(s=>norm(s)===n)}
function region(s){let n=norm(s);for(let [r,arr] of Object.entries(schedule.streetGroups.mixed))if(arr.some(x=>norm(x)===n))return r}
function zone(s){let n=norm(s);for(let [z,arr] of Object.entries(schedule.streetGroups.segregated))if(arr.some(x=>norm(x)===n))return z}
function pickups(a){
 let s=findStreet(a), out=[]; if(!s)return out;
 let r=region(s),z=zone(s);
 if(r){let x=schedule.mixed.find(q=>q.region===r);(x?.dates||[]).forEach(d=>out.push({date:d,type:"Odpady zmieszane",icon:"🗑️",cls:""}))}
 if(z){let x=schedule.segregated.find(q=>q.zone===z);(x?.pickups||[]).forEach(p=>{let cls=p.type.includes("bio")?"bio":"seg";out.push({...p,icon:p.type.includes("Gabaryty")?"📦":"♻️",cls})})}
 return out.sort((a,b)=>date(a.date)-date(b.date))
}
function future(a){let t=new Date();t.setHours(0,0,0,0);return pickups(a).filter(p=>date(p.date)>=t)}
function search(){
 let raw=$("addressSearch").value.trim(), s=findStreet(raw);
 if(!s){$("result").innerHTML=`<div class="card empty"><b>🔎</b><h2>Nie znaleziono ulicy</h2><p>Spróbuj wpisać nazwę ulicy, np. Warszawska.</p></div>`;return}
 let n=raw.slice(s.length).trim(); if(n&&!/^\d/.test(n))n="";
 selectedAddress=s+(n?" "+n:""); $("addressSearch").value=selectedAddress;
 $("selectedAddressText").textContent=selectedAddress;$("selectedAddress").classList.remove("hidden");$("emptyState").classList.add("hidden");$("suggestions").innerHTML="";
 renderHome(); updateStar();
}
function renderSuggest(){
 let q=norm($("addressSearch").value), box=$("suggestions");box.innerHTML="";if(!q)return;
 streets().filter(s=>norm(s).includes(q)).slice(0,8).forEach(s=>{let b=document.createElement("button");b.className="suggestion";b.innerHTML=`<span><b>${s}</b><small>Sochaczew</small></span><span>›</span>`;b.onclick=()=>{$("addressSearch").value=s;search()};box.appendChild(b)})
}
function renderHome(){
 let arr=future(selectedAddress), box=$("result");box.innerHTML="";
 if(!arr.length){box.innerHTML=`<div class="card empty"><b>📭</b><h2>Brak przyszłych terminów</h2><p>Brak terminu w zapisanym harmonogramie.</p></div>`;return}
 let n=arr[0];box.innerHTML=`<div class="card next"><small>NAJBLIŻSZY ODBIÓR</small><h2>${short(date(n.date))}</h2><p>${n.icon} ${n.type}</p></div><h3 style="margin:16px 2px 9px">Następne terminy</h3>`;
 arr.slice(1).forEach(p=>box.insertAdjacentHTML("beforeend",`<div class="card pickup"><span class="ico">${p.icon}</span><div><b>${p.type}</b><small>${long(date(p.date))}</small></div><span class="date">${p.date.slice(0,5)}</span></div>`))
}
function favs(){try{return JSON.parse(localStorage.getItem(FAV)||"[]")}catch{return[]}}
function saveFavs(x){localStorage.setItem(FAV,JSON.stringify(x))}
function favorite(a){return favs().some(x=>norm(x.address)===norm(a))}
function updateStar(){$("favoriteCurrent").textContent=favorite(selectedAddress)?"★":"☆"}
function openModal(){if(!selectedAddress)return;$("modalAddress").textContent=selectedAddress;$("favoriteName").value="";$("modal").classList.remove("hidden");$("favoriteName").focus()}
function closeModal(){$("modal").classList.add("hidden")}
function addFav(){let a=$("modalAddress").textContent.trim(),n=$("favoriteName").value.trim()||a,l=favs(),e=l.find(x=>norm(x.address)===norm(a));if(e)e.name=n;else l.push({id:Date.now().toString(),name:n,address:a});saveFavs(l);closeModal();updateStar();renderFavs()}
function removeFav(id){saveFavs(favs().filter(x=>x.id!==id));renderFavs();updateStar()}
function renameFav(id){let l=favs(),x=l.find(q=>q.id===id),n=prompt("Nowa nazwa:",x?.name||"");if(n?.trim()){x.name=n.trim();saveFavs(l);renderFavs()}}
function openFav(x){$("addressSearch").value=x.address;search();show("home")}
function renderFavs(){
 let l=favs(),box=$("favoritesList");box.innerHTML="";$("favoritesEmpty").classList.toggle("hidden",l.length>0);
 l.forEach(x=>{let d=document.createElement("div");d.className="card favorite";d.innerHTML=`<span class="star2">★</span><div class="fi"><b></b><small></small></div><button class="edit">✎</button><button class="del">×</button>`;d.querySelector("b").textContent=x.name;d.querySelector("small").textContent=x.address;d.querySelector(".edit").onclick=e=>{e.stopPropagation();renameFav(x.id)};d.querySelector(".del").onclick=e=>{e.stopPropagation();removeFav(x.id)};d.querySelector(".fi").onclick=()=>openFav(x);box.appendChild(d)})
}
function show(p){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(p+"Page").classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===p));if(p==="favorites")renderFavs();if(p==="calendar")renderCalendar();if(p==="settings")applySettings();scrollTo(0,0)}
function renderCalendar(){
 let y=month.getFullYear(),m=month.getMonth(),cal=$("calendar");$("monthTitle").textContent=new Intl.DateTimeFormat("pl-PL",{month:"long",year:"numeric"}).format(month);
 cal.innerHTML=`<div class="week"><div>Pn</div><div>Wt</div><div>Śr</div><div>Cz</div><div>Pt</div><div>Sb</div><div>Nd</div></div><div class="days"></div>`;
 let days=cal.querySelector(".days"),start=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate(),arr=pickups(selectedAddress);
 for(let i=0;i<start;i++)days.insertAdjacentHTML("beforeend","<div></div>");
 for(let d=1;d<=count;d++){let ds=`${String(d).padStart(2,"0")}.${String(m+1).padStart(2,"0")}.${y}`,ps=arr.filter(p=>p.date===ds),b=document.createElement("button"),now=new Date();b.className="day"+(d===now.getDate()&&m===now.getMonth()&&y===now.getFullYear()?" today":"")+(selectedDay===ds?" selected":"");b.innerHTML=`<span>${d}</span><span class="dots">${ps.slice(0,4).map(p=>`<i class="dot ${p.cls}"></i>`).join("")}</span>`;b.onclick=()=>{selectedDay=ds;renderCalendar()};days.appendChild(b)}
 let ps=arr.filter(p=>p.date===selectedDay);$("calendarDetails").innerHTML=selectedDay?`<h3>${selectedDay}</h3>${ps.length?ps.map(p=>`<div class="line">${p.icon} <b>${p.type}</b></div>`).join(""):"<p>Brak odbioru tego dnia.</p>"}`:`<h3>${selectedAddress||"Wybierz adres"}</h3><p>Wybierz dzień z kropką.</p>`
}
function applySettings(){let s=JSON.parse(localStorage.getItem(SET)||"{}");document.body.classList.toggle("dark",!!s.dark);$("dark").checked=!!s.dark;$("notifications").checked=!!s.notifications}
function setting(k,v){let s=JSON.parse(localStorage.getItem(SET)||"{}");s[k]=v;localStorage.setItem(SET,JSON.stringify(s));applySettings()}
async function init(){
 try{let r=await fetch("data/schedule.json");schedule=await r.json()}catch(e){$("result").innerHTML='<div class="card empty"><h2>Błąd danych</h2><p>Uruchom projekt przez Live Server.</p></div>';return}
 $("addressSearch").oninput=renderSuggest;$("addressSearch").onkeydown=e=>{if(e.key==="Enter")search()};$("searchButton").onclick=search;
 $("favoriteCurrent").onclick=()=>favorite(selectedAddress)?(saveFavs(favs().filter(x=>norm(x.address)!==norm(selectedAddress))),updateStar(),renderFavs()):openModal();
 document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);$("saveFavorite").onclick=addFav;$("favoriteName").onkeydown=e=>{if(e.key==="Enter")addFav()};
 document.querySelectorAll("nav button").forEach(x=>x.onclick=()=>show(x.dataset.page));document.querySelectorAll("[data-home]").forEach(x=>x.onclick=()=>show("home"));$("homeSettings").onclick=()=>show("settings");
 $("prev").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);selectedDay=null;renderCalendar()};$("next").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);selectedDay=null;renderCalendar()};
 $("dark").onchange=e=>setting("dark",e.target.checked);$("notifications").onchange=e=>setting("notifications",e.target.checked);
 $("clearFavorites").onclick=()=>{if(confirm("Usunąć wszystkie ulubione?")){saveFavs([]);renderFavs();updateStar()}};$("about").onclick=()=>alert("Sochaczew Odpady\nWersja 1.0.0\nHarmonogram 2026");
 applySettings()
}
document.addEventListener("DOMContentLoaded",init);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));