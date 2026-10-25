let VER=window.__VER||0,_tm=null;
function cloudSave(){clearTimeout(_tm);_tm=setTimeout(async()=>{const j=JSON.parse(JSON.stringify(S));delete j.sim;const old=VER;VER=old+1;const {data,error}=await window.sb.from('prestamos_datos').update({json:j,version:old+1,updated_at:new Date().toISOString()}).eq('id',1).eq('version',old).select('version');if(error){VER=old;toast('Error al guardar: '+error.message);return}if(!data.length)await recarga('Otro usuario hizo cambios. Se actualizaron los datos; repite tu último cambio.')},700)}
async function recarga(msg){const {data}=await window.sb.from('prestamos_datos').select('json,version').eq('id',1).single();if(data){const sim=S.sim;S=data.json;S.sim=sim;S.ancla='2026-11-04';VER=data.version;render();if(msg)toast(msg)}}
window.sb.channel('datos').on('postgres_changes',{event:'UPDATE',schema:'public',table:'prestamos_datos'},p=>{if(p.new.version>VER)recarga('Datos actualizados por otro usuario')}).subscribe();

const $=s=>document.querySelector(s);let S;
S=window.__INIT||null;
S=S||{fondo:0,banks:[],clientes:[],loans:[],ancla:''};S.sim='';S.ancla='2026-11-04';S.seed2=S.seed3=S.seed4=S.seed5=true;
S.seed1=true;
let V='home',dl=null;
const save=()=>{cloudSave();return true};
const uid=()=>Math.random().toString(36).slice(2,9);
const M=n=>(+n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const D=d=>d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const P=s=>new Date(s+'T12:00:00');const today=()=>{if(S.sim)return P(S.sim);const d=new Date();d.setHours(12,0,0,0);return d};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cli=id=>S.clientes.find(c=>c.id==id)||{nombre:'(eliminado)'};
function cats(from,n){const d=P(S.ancla||iso(today()));const k=Math.floor((from-d)/864e5/14);d.setDate(d.getDate()+k*14);while(d<=from)d.setDate(d.getDate()+14);const o=[];for(let i=0;i<n;i++){o.push(new Date(d));d.setDate(d.getDate()+14)}return o}
// Interés: se genera cada 2 catorcenas (saldo x tasa%); se cobra mitad en cada catorcena.
// Regla: faltan 1-7 dias -> se cobra en la 2a catorcena (proporcional de esos dias + catorcena completa); 8-13 dias -> 1a catorcena proporcional (d/14); 14 -> completa. Todo a decena superior
const TASA=7;
const TR=l=>l.tr||[{f:l.fecha,m:l.monto,t:l.tasa||TASA}];
function fst(f){const a=cats(f,1)[0],d=Math.round((a-f)/864e5);return{a,d,skip:d<=7,mf:d<=7?1+d/14:d<=13?d/14:1}}
function cs(from,n){const a=cats(from,n+1);return fst(from).skip?a.slice(1):a.slice(0,n)}
// Interés de la catorcena d (mitad de la tasa por tramo); cp = capital pagado antes de d (se aplica al tramo más antiguo primero)
function ia(d,tr,cp){let r=cp,x=0;const act=tr.map(t=>{const take=Math.min(r,t.m);r-=take;return{t,b:t.m-take}}).filter(o=>P(o.t.f)<d);let ex=Math.ceil(act.reduce((a,o)=>a+o.b,0)/500)*500-act.reduce((a,o)=>a+o.b,0);act.forEach(o=>{if(o.b>0&&ex){o.b+=ex;ex=0}const f=P(o.t.f),s=fst(f),c=s.skip?cats(f,2)[1]:s.a;if(d<c)return;x+=o.b*(o.t.t||TASA)/200*(iso(d)==iso(c)?s.mf:1)});return Math.ceil(x/10-1e-9)*10}
function proj(monto,tasa,modo,ab,n,fecha,tr){tr=tr||[{f:fecha,m:monto,t:tasa}];const ds=cs(P(fecha),n);let cp=0,r=[];ds.forEach(d=>{const bal=tr.filter(t=>P(t.f)<d).reduce((a,t)=>a+t.m,0)-cp,int=ia(d,tr,cp),cap=modo=='capital'?Math.min(ab,Math.max(0,bal)):0;r.push({d,bal,int,cap,tot:int+cap});cp+=cap});return{r,fin:tr.reduce((a,t)=>a+t.m,0)-cp}}
function st(l,hoy=today()){const tr=TR(l),pg=l.pagos.filter(p=>P(p.fecha)<=hoy).slice().sort((a,b)=>a.fecha<b.fecha?-1:1),n=Math.max(0,Math.floor((hoy-P(l.fecha))/864e5/14)+1),ds=cats(P(l.fecha),n+1).filter(d=>d<=hoy);
let k=0,cp=0,ip=0,acc=0,pend=0,ci=0;const al={};
const pay=p=>{const i=Math.min(p.monto,pend);pend-=i;ip+=i;const c=p.monto-i;cp+=c;al[p.id]={i,c}};
ds.forEach(d=>{while(k<pg.length&&P(pg[k].fecha)<d)pay(pg[k++]);const I=ia(d,tr,cp);acc+=I;pend+=I;if(iso(d)==iso(hoy))ci=I});
while(k<pg.length)pay(pg[k++]);
const mt=tr.filter(t=>P(t.f)<=hoy).reduce((a,t)=>a+t.m,0),capP=Math.max(0,mt-cp);return{cp,ip,acc,capP,intP:pend,debe:capP+pend,ci,al}}
function futD(l,ds){const s=st(l),tr=TR(l);return{s,r:ds.map(d=>{const i=ia(d,tr,s.cp);return{d,bal:s.capP,int:i,cap:0,tot:i}}),fin:s.capP}}
const futN=(l,n)=>futD(l,cats(today(),n));
const alt=(s,p)=>{const a=s.al[p.id];return a?'Interés '+M(a.i)+' · Capital '+M(a.c):''};
function tot(){let pr=0,ac=0,ip=0,pag=0,mo=0;S.loans.filter(l=>P(l.fecha)<=today()).forEach(l=>{const s=st(l);pr+=s.capP;ac+=s.acc;ip+=s.ip;mo+=TR(l).filter(t=>P(t.f)<=today()).reduce((a,t)=>a+t.m,0);pag+=s.cp+s.ip});return{pr,ac,ip,disp:(+S.fondo||0)-mo+pag}}
let H=0;
function go(v,np){V=v;if(!np){try{history.pushState({v},'');H++}catch(e){}}render();window.scrollTo(0,0)}
function goBack(f='loans'){if(H>0)history.back();else go(f)}
addEventListener('popstate',e=>{H=Math.max(0,H-1);V=(e.state&&e.state.v)||'home';render()});
try{history.replaceState({v:'home'},'')}catch(e){}
function render(){['home','loans','cfg'].forEach(x=>$('#n-'+x).classList.toggle('on',V==x||(x=='home'&&V=='cob')||(x=='cfg'&&['cli','bank','fondo'].includes(V))||(x=='loans'&&(V=='new'||V.startsWith('loan:')))));
$('#app').innerHTML=simbar()+(V=='home'?home():V=='cob'?cobros():V=='proy'?projCard(proy()):V=='cli'?clis():V=='bank'?banks():V=='cfg'?cfg():V=='fondo'?fondoV():V=='loans'?loans():V=='new'?nuevo():detalle(V.slice(5)));if(V=='new')sim()}
let CD=null;
function toast(t){const m=document.createElement('div');m.textContent=t;m.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--ac);color:#fff;padding:8px 14px;border-radius:20px;z-index:20';document.body.append(m);setTimeout(()=>m.remove(),3000)}
function setSim(v){S.sim=v;CD=null;render()}
function mv(n){const d=today();d.setDate(d.getDate()+n);setSim(iso(d))}
function simbar(){return`<div class="card" style="margin-top:0"><div class="k">Navegar en el tiempo · hoy es ${D(today())} ${S.sim?'<b class="rd">(simulación)</b>':''}</div><div style="display:flex;gap:6px;margin-top:6px"><button class="s" style="margin:0;white-space:nowrap" onclick="mv(-14)">‹ 14d</button><input type="date" value="${iso(today())}" onchange="setSim(this.value)"><button class="s" style="margin:0;white-space:nowrap" onclick="mv(14)">14d ›</button>${S.sim?`<button style="margin:0" onclick="setSim('')">Hoy</button>`:''}</div></div>`}
function cd(){const y=new Date(today());y.setDate(y.getDate()-1);return CD||iso(cats(y,1)[0])}
function isCat(X){return !!S.ancla&&Math.round((P(X)-P(S.ancla))/864e5)%14==0}
function due(l,X){const s=st(l,P(X));return s.ci>0?{d:P(X),int:s.ci,cap:0,tot:s.ci}:null}
function cobRows(X){return S.loans.map(l=>({l,row:due(l,X),s:st(l,P(X))})).filter(x=>x.row&&x.s.debe>0)}
function cmv(n){const d=P(cd());d.setDate(d.getDate()+n);CD=iso(d);render()}
function cobCard(){const X=cd(),r=cobRows(X),sum=r.reduce((a,x)=>a+x.row.tot,0);return`<div class="card"><div class="k">Próxima catorcena: ${D(P(X))}</div><div class="v">${M(sum)} por cobrar</div><div class="mu">${r.length} cliente(s)</div><div class="mu" style="margin-top:4px">Siguientes catorcenas: ${[0,1,2,3].map(i=>{const d=P(X);d.setDate(d.getDate()+14*i);return D(d)}).join(' · ')}</div><button onclick="go('cob')">Ver cobros y mensajes</button></div>`}
function cobros(){const X=cd(),rows=cobRows(X),sum=rows.reduce((a,x)=>a+x.row.tot,0);
return`<button class="s" style="margin:0" onclick="goBack('home')">← Volver</button><h2>Cobros por catorcena</h2><div class="card"><label>Fecha de catorcena</label><div style="display:flex;gap:6px"><button class="s" style="margin:0" onclick="cmv(-14)">‹</button><input type="date" value="${X}" onchange="CD=this.value;render()"><button class="s" style="margin:0" onclick="cmv(14)">›</button></div>${S.ancla?(isCat(X)?'':'<div class="mu rd">Esa fecha no es día de catorcena.</div>'):'<div class="mu rd">Define las catorcenas en Inicio.</div>'}<div class="v" style="margin-top:8px">${M(sum)}</div><div class="k">a cobrar ese día · ${rows.length} cliente(s)</div></div>${rows.map(x=>`<div class="card"><b>${esc(cli(x.l.cid).nombre)}</b><div class="mu">Pago de la catorcena: ${M(x.row.tot)} (interés ${M(x.row.int)}${x.row.cap?` + capital ${M(x.row.cap)}`:''})</div><div class="mu">Debe en total a esa fecha: <b>${M(x.s.debe)}</b></div><button onclick="cpMsg('${x.l.id}','${X}')">Copiar mensaje</button><button class="s" onclick="msg('${x.l.id}','${X}')">Ver / WhatsApp</button></div>`).join('')||'<div class="card mu">Nadie tiene pago programado en esta fecha.</div>'}`}
function cpMsg(id,X){const t=msgText(S.loans.find(x=>x.id==id),X);try{navigator.clipboard.writeText(t).then(()=>toast('Mensaje copiado')).catch(()=>msg(id,X))}catch(e){msg(id,X)}}
function corteDef(){const t=today(),f=y=>cats(new Date(y,10,30,12),1)[0];let c=f(t.getFullYear());if(c<t)c=f(t.getFullYear()+1);return iso(c)}
const corte=()=>S.corte||corteDef();
function proy(){const C=P(corte()),h=today();let ti=0;const L=[];S.loans.forEach(l=>{if(P(l.fecha)>=C)return;const f=futD(l,cats(h,Math.max(0,Math.ceil((C-h)/864e5/14)+1)).filter(d=>d<=C)),i=f.s.acc+f.r.reduce((a,x)=>a+x.int,0);ti+=i;L.push({l,i})});return{C,ti,L}}
function projCard(p){return`<h2>Proyección de intereses</h2><div class="card"><label>Fecha de corte (por defecto, 1ª catorcena de diciembre)</label><input type="date" value="${corte()}" onchange="S.corte=this.value;save();render()"><div class="v" style="margin-top:8px">${M(p.ti)}</div><div class="k">interés total estimado al ${D(p.C)}, liquidando todo en esa fecha</div>${p.L.map(x=>`<div class="row"><span>${esc(cli(x.l.cid).nombre)} <span class="mu">(${M(x.l.monto)})</span></span><b>${M(x.i)}</b></div>`).join('')}<div class="mu">Interés generado a la fecha más el de las catorcenas restantes con el capital actual (sin más abonos). 1er cargo: faltando 1 a 6 días inicia en la 2ª catorcena; faltando 7 a 13 días la 1ª es proporcional (a decena superior).</div></div>`}
function corteLine(v){const f=P(v.fecha),a=cats(f,1)[0],d=Math.round((a-f)/864e5),C=P(corte());let h='<div class="card" style="margin:10px 0 0">'+'';if(f<C){const r=proj(v.monto,v.tasa,v.modo,v.ab,Math.ceil((C-f)/864e5/14)+2,v.fecha).r.filter(x=>x.d<=C);h+='<b>Interés estimado al '+D(C)+': '+M(r.reduce((s,x)=>s+x.int,0))+'</b>'}return f<C?h+'</div>':''}
function banks(){return`<button class="s" style="margin:0" onclick="goBack('home')">← Volver</button><h2>Datos bancarios para recibir pagos</h2><div class="card">${S.banks.map(b=>`<div class="row"><div>${esc(b.banco)} · ${esc(b.titular)}<div class="mu">Cuenta/CLABE: ${esc(b.cuenta)}</div></div><button class="r" onclick="S.banks=S.banks.filter(x=>x.id!='${b.id}');save();render()">Quitar</button></div>`).join('')||'<div class="mu">Aún no hay cuentas.</div>'}<label>Banco</label><input id="bb"><label>Titular</label><input id="bt"><label>Cuenta / CLABE</label><input id="bc"><button onclick="addBank()">Agregar cuenta</button></div>`}
