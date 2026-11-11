// Credit OS investor showcase: EN/ES toggle + illustrative scenario model.
const ES = {
'nav.demo':'Demo en vivo','nav.problem':'Problema','nav.founder':'Fundador','nav.fin':'Finanzas','nav.plan':'Plan','nav.cta':'Agenda 15 min',
'hero.eyebrow':'Software de educación de crédito · Hecho en Orlando, FL',
'hero.h1':'Los reportes de crédito confunden. <em>Credit OS los hace legibles.</em>',
'hero.lede':'Sube un reporte de los 3 burós. Credit OS te muestra dónde TransUnion, Experian y Equifax no coinciden, te explica tus derechos con la fuente y te ayuda a escribir tus propias cartas. El reporte nunca sale de tu navegador.',
'hero.try':'Prueba el demo en vivo ↗','hero.book':'Agenda un demo de 15 minutos',
'pill.free':'Gratis para el consumidor','pill.private':'Privado por diseño: sin servidor','pill.es':'Español primero (en progreso)','pill.edu':'Educación, no reparación de crédito',
'hero.artcap':'Ilustración de la vista del producto · datos ficticios',
'mk.title':'Comparación de burós','mk.badge':'Datos ficticios','mk.acct':'Sample Auto Finance ••• 0000','mk.type':'A plazos','mk.th0':'Buró','mk.th1':'Saldo','mk.th2':'Estado','mk.th3':'Apertura','mk.cur':'Al corriente','mk.cur2':'Al corriente','mk.late':'30 días de atraso',
'mk.note':'2 diferencias encontradas. Aprende qué dice la FCRA sobre la exactitud, con la fuente, y redacta tu propia carta si crees que hay un error.','mk.fb':'Tus derechos, con la fuente','mk.fs':'FCRA §611 · reinvestigación de información disputada',
'strip.p':'Prototipo','eb.prob':'El problema','eb.prod':'El producto','eb.demo':'Míralo funcionar','eb.f':'Fundador','eb.fin':'Finanzas','eb.plan':'Plan',
'demo.pill':'Datos de demo','demo.ph':'La versión pública real, con un reporte ficticio','ch.t':'Ingresos mensuales ilustrativos, 36 meses','ch.l1':'Suscripciones','ch.l2':'Licencias B2B',
'strip.stage':'etapa','strip.rev':'ingresos','strip.users':'usuarios','strip.loc':'líneas de código funcional',
'strip.note':'Lo decimos claro. Números honestos ahora valen más que exageraciones después.',
'prob.h':'El problema es grande, y está documentado','prob.sub':'Cada cifra enlaza a su fuente pública. Los estudios antiguos indican el año de sus datos.',
'stat1':'adultos en EE. UU. eran "invisibles" para el crédito (26M) o tenían expedientes sin puntaje (19M).',
'stat2':'de los consumidores hispanos eran invisibles para el crédito (~15%) y otro 12% no tenía puntaje, frente a 9% y 7% de consumidores blancos.',
'stat3':'consumidores en el estudio de la FTC tenía un error en al menos uno de sus tres reportes de crédito.',
'stat4':'quejas sobre reportes de crédito o de consumidor llegaron a la CFPB en 2024: el 85% de todas las quejas recibidas.',
'stat5':'personas de 5 años o más en EE. UU. hablan español en casa.',
'prob.fine':'La FTC también encontró que muchos errores no eran materiales, así que no todo error cambia un puntaje. Credit OS ayuda a entender el expediente y a disputar solo lo que la persona cree que es inexacto.',
'prod.h':'Qué hace Credit OS',
's1.h':'Carga el reporte','s1.p':'Hoy lee la página del reporte de 3 burós de IdentityIQ, celda por celda, y verifica sus cuentas contra los totales del reporte.',
's2.h':'Mira las diferencias','s2.p':'Un mapa 3D tipo "órbita" pone cada cuenta en el anillo de cada buró. Los rayos magenta marcan dónde los burós no coinciden.',
's3.h':'Aprende la regla','s3.p':'Cada hallazgo enlaza a la ley federal (FCRA, FDCPA, Reg F) con su fuente. Es educación, no asesoría legal.',
's4.h':'Escribe tu propia carta','s4.p':'Borradores de cartas por buró o acreedor. La persona las revisa, firma y envía. Un tablero sigue cada ronda.',
'priv.h':'Privacidad por diseño','priv.1':'Sin servidor: el análisis y las cartas corren dentro del navegador.','priv.2':'Sin cuenta ni subidas. Los datos se quedan en el almacenamiento del navegador y se pueden borrar cuando quieras.','priv.3':'El SSN solo se escribe al imprimir cartas a los burós y nunca se guarda.','priv.4':'Sin servidor con datos sensibles, no hay botín que hackear.',
'not.h':'Lo que Credit OS no es','not.1':'No es una organización de reparación de crédito, ni bufete, ni asesor financiero.','not.2':'No cobra por eliminar nada y no promete eliminaciones ni cambios de puntaje.','not.3':'Promueve disputar solo información que la persona cree inexacta.','not.4':'Hay una pantalla de consentimiento de 4 partes antes de leer cualquier reporte.',
'demo.h':'Demo en vivo','demo.sub':'Es la versión pública real de Credit OS, con un reporte de demostración ficticio. Sin registro. Nada de lo que toques se envía a ningún lado.',
'demo.label':'DATOS DE DEMO: persona ficticia, no es un reporte real. Solo educación, sin garantías.',
'demo.poster':'El demo es una app 3D completa. Se ve mejor en laptop, pero funciona en teléfonos.','demo.open':'Abrir en pantalla completa ↗','demo.load':'Cargar aquí',
'demo.tip':'Consejo: marca las 4 casillas de consentimiento y explora Órbita, Escáner, Cartas y Guía. (La app del demo está en inglés por ahora.)',
'why.h':'Por qué ahora','why.1':'Las quejas se disparan. La CFPB reporta que las quejas sobre reportes de crédito subieron 182% en 2024 frente al promedio mensual de los dos años anteriores.','why.2':'La gente ya paga por reportes y monitoreo, pero la mayoría de las herramientas se quedan en un puntaje. No dan un plan.','why.3':'Los navegadores modernos pueden hacer análisis profundo y privado en el mismo dispositivo, a costo casi cero.','why.4':'La educación financiera se mueve a creadores y transmisiones en vivo. Necesitan una herramienta a la cual dirigir a la gente. (Nuestra opinión.)',
'esp.h':'Español primero, de verdad','esp.p1':'43.4 millones de personas en EE. UU. hablan español en casa, y los consumidores hispanos tienen más probabilidad de tener expedientes delgados o inexistentes (fuentes arriba). Casi toda la ayuda de crédito es en inglés.',
'esp.p2':'<b>Estado honesto:</b> estoy construyendo el flujo en español ahora. Hoy solo partes de la interfaz están en español. Probar todo el recorrido en español con 5+ usuarios hispanohablantes es una meta financiada abajo.',
'esp.q':'"Para muchas familias, el reporte de crédito es un muro. Credit OS es una puerta."',
'nav.journey':'Trayectoria','eb.j':'Trayectoria como programador','j.h':'De la consola de sonido a lanzar software',
'j.sub':'Primero fui ingeniero de audio. En 2026 aprendí por mi cuenta a construir software con herramientas de programación con IA, y no he parado de lanzar desde entonces. Las fechas son aproximadas, según cuándo empezó cada proyecto.',
'js1':'pull requests fusionados en el código de NEO, jul–nov 2026 (GitHub, al 11 de nov. de 2026)','js2':'proyectos iniciados en 2026, desde plataformas web hasta una app nativa para Mac','js3':'en el que voy con todo: Credit OS',
'j0d':'2017','j0h':'Antes del código','j0':'Ingeniería de audio en First Institute, y luego años en equipos de producción en vivo. Ahí aprendí a entregar bajo presión: el show empieza a tiempo, pase lo que pase.',
'j1d':'Ene 2026','j1p':'Una plataforma inmobiliaria. Empezó el 14 de enero como un sistema de diseño y un plan de analítica, y creció hasta ser un código de equipo: integraciones con feeds de constructoras (comunidades de D.R. Horton en Florida), un tablero de analítica y lanzamientos de staging a producción con revisión de PRs.',
'j2d':'Jul–Ago 2026','j2a':'Un sistema para buscar casa, hecho en tres días. Extrae anuncios de dueños alrededor de Four Corners, FL (34747).','j2b':'Un CRM de un solo archivo para vendedores puerta a puerta de T-Mobile Fiber en St. Pete.','j2c':'Una tienda directa al consumidor de productos naturales para el hogar.','j2e':'Un experimento para aprender cómo funcionan las herramientas de seguridad.',
'j3d':'Sep 2026','j3p':'Una app de educación de crédito de 3 burós que corre solo en el navegador, con vista 3D. Unas 4,150 líneas, sin servidor. Este es el proyecto.',
'j4d':'Oct 2026','j4a':'Una app nativa para Mac que corre varios agentes de IA lado a lado. Unos 333 archivos de código.','j4b':'El sitio de mi marca de estudio.','j4c':'Un plugin de audio, todavía en progreso. Me regresa a donde empecé: el audio.',
'j5d':'Nov 2026','j5a':'Una herramienta local de efectos y visuales para mi radio 24/7 en Kick.','j5b':'Un tracker local para mi búsqueda de trabajo.','j5c':'Una herramienta de datos para extraer información estructurada de la web.',
'j.take':'Lanzo rápido, aprendo en público, y Credit OS es en el que voy con todo.',
'f.h':'Quién soy','f.cap':'Retrato estilizado con IA','f.role':'Fundador, Credit OS · DVN Digital Marketing · Orlando / Saint Cloud, FL · Bilingüe EN/ES',
'f.p1':'Soy técnico de audio y A/V para eventos en vivo que construye software. Hice Credit OS solo, y lo probé con mi propio reporte de crédito antes que nadie lo viera. Sé lo que se siente mirar un reporte y no entenderlo.',
't1':'Programa de ingeniería de audio, First Institute','t2y':'Eventos','t2':'Equipos de Rhino Staging: WWE y los Billboard Latin Awards','t3y':'Ahora','t3':'Trabajos de A/V en Orlando con Show Services Florida',
't4':'Opero una estación de radio 24/7 donde artistas envían su música, en Kick: <a href="https://kick.com/irlzay" target="_blank" rel="noopener">kick.com/irlzay</a>','t5':'DVN Digital Marketing: campañas de alcance y con creadores','t6y':'Constructor','t6':'Trabajo en la plataforma inmobiliaria NEO (datos de constructoras y tableros), Credit OS y otras herramientas propias',
'fin.h':'El lado financiero, con total honestidad','k1':'Ingresos hasta hoy','k2':'Usuarios o clientes que pagan','k3':'Pruebas de registro sintéticas aprobadas en la rama de cuentas (el registro aún no está conectado)','k4':'Reporte real probado (el del fundador)',
'bm.h':'Caminos de modelo de negocio (hipótesis por probar)','bm1.h':'Licencias B2B2C','bm1.p':'Una herramienta privada, bilingüe y de marca blanca para cooperativas de crédito, organizaciones sin fines de lucro y consejeros de vivienda que ya atienden a familias. El socio paga por usuario o por año, y es gratis para la persona.',
'bm2.h':'Paquetes con creadores','bm2.p':'Creadores y streamers de finanzas incluyen Credit OS en programas educativos en inglés y español, con avisos claros.',
'bm3.h':'Nivel de autoayuda pagado','bm3.p':'Solo después de la aprobación de un abogado. La rama de cuentas propone planes de $19 / $39 / $59 al mes (Starter, Pro, Duo). No están activos y no hay pago.',
'bm3.f':'La ley CROA prohíbe a las organizaciones de reparación de crédito cobrar antes de completar los servicios (15 U.S.C. §1679b(b)). El software de autoayuda debe quedar claramente fuera de eso, y lo decide un abogado.',
'm.h':'Economía unitaria interactiva','m.disc':'ESCENARIO ILUSTRATIVO, NO ES UN PRONÓSTICO. Cada dato es una suposición que tú controlas. Nada de esto es medido.',
'in.price':'Precio por usuario / mes','in.new':'Nuevos usuarios que pagan / mes','in.growth':'Crecimiento mensual de nuevos usuarios','in.churn':'Cancelación mensual','in.cac':'CAC (costo por usuario)','in.cost':'Costo de servicio + soporte / usuario / mes','in.b2b':'Socios B2B firmados por año','in.lic':'Licencia por socio / año','in.reset':'Restablecer supuestos',
'out.ltv':'LTV por usuario','out.ratio':'LTV : CAC','out.payback':'Recuperación del CAC','out.life':'Vida promedio del usuario','y1':'Año 1','y2':'Año 2','y3':'Año 3',
'm.fine':'Cálculo: los usuarios activos avanzan cada mes (nuevos menos cancelaciones). Ingresos = usuarios activos × precio + licencias B2B. Contribución = ingresos − costo de servicio − gasto en CAC. No incluye salarios, legal, impuestos, reembolsos ni comisiones de pago. Cambia los supuestos y mira qué tan sensible es.',
'uf.h':'Uso de fondos: pre-seed propuesto de $100K–$250K','uf.disc':'UNA PROPUESTA solo para conversar. No es una oferta y no hay términos definidos.',
'uf1':'Abogado y cumplimiento: revisión de CROA, FCRA y Cap. 817 de Florida, entidad, términos finales','uf2':'Piloto en español: flujo completo en español, registro móvil, 25+ probadores','uf3':'Lanzamiento: cuentas seguras, almacenamiento cifrado, más formatos de reporte, pruebas','uf4':'Primer piloto B2B: cooperativa de crédito u organización sin fines de lucro, más lanzamiento con creadores',
'plan.h':'Metas y hoja de ruta','plan.sub':'Son metas, no promesas.','r1.t':'Meses 0–3','r1':'Revisión legal, entidad formada, campos legales completos, demo público en línea, lenguaje solo educativo en todo.','r2.t':'Meses 3–6','r2':'Flujo completo en español, piloto de 10–25 personas (5+ hispanohablantes), primeras métricas reales: tiempo para entender, cartas redactadas.','r3.t':'Meses 6–9','r3':'Cuentas seguras y multi-dispositivo, más formatos de reporte, lanzamiento público gratis.','r4.t':'Meses 9–12','r4':'Primer piloto con socio B2B2C. Un nivel de autoayuda pagado solo si el abogado lo aprueba.',
'c.h':'Plan de cumplimiento','c1':'Posicionado como software educativo de autoayuda. Sin cobro por eliminar nada y sin promesas de resultados. Un abogado confirma el estatus de cualquier nivel pagado futuro, incluidos contratos, avisos y cancelación.','c2':'Las personas disputan solo lo que creen inexacto, incompleto o no verificable. Las citas legales y los plazos (reglas de 30/45 días) se verifican con un abogado.','c3h':'Florida + privacidad','c3':'Las reglas de Florida para organizaciones de servicios de crédito (Cap. 817 Parte III) las revisa un abogado. Los datos se quedan locales por diseño, y la política de privacidad se finaliza antes del lanzamiento.',
'cta.h':'Hablemos 15 minutos','cta.p':'Te muestro el demo en vivo y respondo las preguntas difíciles. Bienvenida la crítica dura.','cta.btn':'Agenda un demo de 15 minutos',
'foot.1':'<b>No es una oferta de venta de valores.</b> Este sitio es solo informativo y no es una oferta de venta ni una solicitud de oferta de compra de ningún valor. Cualquier financiamiento futuro se ofrecería solo mediante documentos legales apropiados y donde esté permitido.',
'foot.2':'Credit OS es software de educación de crédito. No es una organización de reparación de crédito y no da asesoría legal. No se garantiza ningún resultado. Las cifras de mercado vienen de las fuentes públicas enlazadas arriba. Los escenarios financieros son ilustrativos, no pronósticos.'
};
const ROWS_EN={users:'Active users (end of year)',rev:'Revenue',b2b:'of which B2B licenses',contrib:'Contribution after CAC + serving'};
const ROWS_ES={users:'Usuarios activos (fin de año)',rev:'Ingresos',b2b:'de eso, licencias B2B',contrib:'Contribución después de CAC + servicio'};
let lang='en';
const orig=new Map();
document.querySelectorAll('[data-i18n]').forEach(el=>orig.set(el,el.innerHTML));
function setLang(l){
  lang=l;document.documentElement.lang=l;
  document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;el.innerHTML=(l==='es'&&ES[k])?ES[k]:orig.get(el);});
  const b=document.getElementById('lang');b.textContent=l==='es'?'EN':'ES';b.setAttribute('aria-label',l==='es'?'Switch to English':'Cambiar a español');
  const m=document.getElementById('mailto');
  m.href=l==='es'?'mailto:dvndigitalmarketinginfo@gmail.com?subject=Demo%20de%2015%20minutos%20de%20Credit%20OS&body=Hola%20Isaiah%2C%0A%0AMe%20gustar%C3%ADa%20un%20demo%20de%2015%20minutos.%20Horarios%20que%20me%20funcionan%3A%0A%0A':'mailto:dvndigitalmarketinginfo@gmail.com?subject=15-minute%20Credit%20OS%20demo&body=Hi%20Isaiah%2C%0A%0AI%27d%20like%20a%2015-minute%20Credit%20OS%20demo.%20A%20few%20times%20that%20work%20for%20me%3A%0A%0A';
  try{localStorage.setItem('cos.showcase.lang',l)}catch{}
  render();
}
document.getElementById('lang').addEventListener('click',()=>setLang(lang==='en'?'es':'en'));

// demo embed on request (keeps the page light on phones)
document.getElementById('load-demo').addEventListener('click',()=>{
  const box=document.getElementById('demo-box');
  box.innerHTML='<iframe src="demo/" title="Credit OS live demo on fictional data" allow="fullscreen" loading="lazy"></iframe>';
});

// ---- illustrative model
const ids=['price','newu','growth','churn','cac','cost','b2b','lic'];
const D={};ids.forEach(i=>D[i]=+document.getElementById(i).value);
const $=id=>document.getElementById(id);
const usd=(n,d=0)=>(n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const short=n=>{const a=Math.abs(n);const s=a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(a>=1e5?0:1)+'K':a.toFixed(0);return (n<0?'−$':'$')+s};
function render(){
  const v={};ids.forEach(i=>v[i]=+$(i).value);
  $('o-price').textContent=usd(v.price);$('o-new').textContent=v.newu;$('o-growth').textContent=v.growth+'%';$('o-churn').textContent=v.churn+'%';
  $('o-cac').textContent=usd(v.cac);$('o-cost').textContent=usd(v.cost,2);$('o-b2b').textContent=v.b2b;$('o-lic').textContent=usd(v.lic);
  ids.forEach(i=>{const el=$(i);el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%')});
  const c=v.churn/100,margin=v.price-v.cost;
  const ltv=c>0?margin/c:0;$('ltv').textContent=usd(ltv);
  $('ratio').textContent=v.cac>0?(ltv/v.cac).toFixed(1)+'×':'—';
  $('payback').textContent=margin>0?(v.cac/margin).toFixed(1)+(lang==='es'?' meses':' mo'):(lang==='es'?'nunca':'never');
  $('life').textContent=(1/c).toFixed(1)+(lang==='es'?' meses':' mo');
  let active=0,newm=v.newu,partners=0;const yr=[0,1,2].map(()=>({rev:0,b2b:0,contrib:0,users:0}));const monthly=[];
  for(let m=0;m<36;m++){
    const y=Math.floor(m/12);
    if(m%12===0)partners+=v.b2b;
    active=active*(1-c)+newm;
    const subs=active*v.price,lic=partners*v.lic/12;
    const rev=subs+lic,contrib=rev-active*v.cost-newm*v.cac;
    yr[y].rev+=rev;yr[y].b2b+=lic;yr[y].contrib+=contrib;yr[y].users=active;monthly.push({s:subs,l:lic});
    newm*=1+v.growth/100;
  }
  const R=lang==='es'?ROWS_ES:ROWS_EN;
  $('ytable').innerHTML=[['users',x=>Math.round(x.users).toLocaleString('en-US')],['rev',x=>usd(x.rev)],['b2b',x=>usd(x.b2b)],['contrib',x=>usd(x.contrib)]]
    .map(([k,f])=>`<tr><td>${R[k]}</td>${yr.map(x=>`<td>${f(x)}</td>`).join('')}</tr>`).join('');
  // chart: stacked area, subscriptions + B2B licenses
  const W=560,H=250,L=52,Rp=12,T=14,B=34,max=4*niceMax(Math.max(1,...monthly.map(m=>m.s+m.l))/4);
  const xs=i=>L+i*(W-L-Rp)/35,ys=val=>H-B-(val/max)*(H-B-T);
  let s='';
  for(let k=0;k<=4;k++){const yv=max*k/4,yy=ys(yv);s+=`<line x1="${L}" x2="${W-Rp}" y1="${yy}" y2="${yy}" stroke="${k?'#E9ECF1':'#C9D0DA'}" stroke-width="1"/><text x="${L-8}" y="${yy+4}" fill="#8A94A6" font-size="11" text-anchor="end">${short(yv)}</text>`}
  [12,24].forEach(m=>{s+=`<line x1="${xs(m-.5)}" x2="${xs(m-.5)}" y1="${T}" y2="${H-B}" stroke="#E2E6EC" stroke-dasharray="3 4"/>`});
  [0,1,2].forEach(y=>{s+=`<text x="${xs(y*12+5.5)}" y="${H-12}" fill="#5E6B80" font-size="11.5" font-weight="600" text-anchor="middle">${(lang==='es'?'Año ':'Year ')+(y+1)}</text>`});
  const top=monthly.map((m,i)=>`${xs(i).toFixed(1)},${ys(m.s+m.l).toFixed(1)}`),mid=monthly.map((m,i)=>`${xs(i).toFixed(1)},${ys(m.s).toFixed(1)}`);
  s+=`<polygon points="${L},${H-B} ${mid.join(' ')} ${xs(35)},${H-B}" fill="#0A1A2F" fill-opacity=".9"/>`;
  s+=`<polygon points="${mid.join(' ')} ${top.slice().reverse().join(' ')}" fill="#2FB585" fill-opacity=".85"/>`;
  s+=`<polyline points="${top.join(' ')}" fill="none" stroke="#0E7C5A" stroke-width="1.5"/>`;
  s+=`<line id="xh" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="#0A1A2F" stroke-opacity=".35" visibility="hidden"/><circle id="xd" r="3.5" fill="#fff" stroke="#0E7C5A" stroke-width="2" visibility="hidden"/>`;
  s+=`<rect x="${L}" y="${T}" width="${W-L-Rp}" height="${H-B-T}" fill="transparent" id="hit"/>`;
  $('chart').innerHTML=s;
  lastMonthly=monthly;CH={W,H,L,Rp,xs,ys};
}
let lastMonthly=[],CH=null;
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p}
$('chart').addEventListener('pointermove',e=>{
  if(!CH)return;const svg=$('chart'),r=svg.getBoundingClientRect(),x=(e.clientX-r.left)*CH.W/r.width;
  const i=Math.max(0,Math.min(35,Math.round((x-CH.L)/((CH.W-CH.L-CH.Rp)/35))));const m=lastMonthly[i];if(!m)return;
  const px=CH.xs(i),py=CH.ys(m.s+m.l);const xh=svg.querySelector('#xh'),xd=svg.querySelector('#xd');
  xh.setAttribute('x1',px);xh.setAttribute('x2',px);xh.setAttribute('visibility','visible');xd.setAttribute('cx',px);xd.setAttribute('cy',py);xd.setAttribute('visibility','visible');
  const t=$('tip'),wr=$('chart-wrap').getBoundingClientRect();t.style.left=(r.left-wr.left+px*r.width/CH.W)+'px';t.style.top=(r.top-wr.top+py*r.height/CH.H)+'px';
  t.innerHTML=`${lang==='es'?'Mes':'Month'} ${i+1}: <b>${usd(m.s+m.l)}</b>`;t.classList.add('on');
});
$('chart').addEventListener('pointerleave',()=>{$('tip').classList.remove('on');const svg=$('chart');svg.querySelector('#xh')?.setAttribute('visibility','hidden');svg.querySelector('#xd')?.setAttribute('visibility','hidden');});
ids.forEach(i=>$(i).addEventListener('input',render));
$('reset').addEventListener('click',()=>{ids.forEach(i=>$(i).value=D[i]);render();});
let saved='en';try{saved=localStorage.getItem('cos.showcase.lang')||(navigator.language||'').toLowerCase().startsWith('es')&&'es'||'en'}catch{}
if(new URLSearchParams(location.search).get('lang')==='es')saved='es';
setLang(saved==='es'?'es':'en');

// subtle reveal on scroll
const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'}):null;
document.querySelectorAll('.sec .wrap > *, .reveal').forEach(el=>{el.classList.add('reveal');io?io.observe(el):el.classList.add('in')});
