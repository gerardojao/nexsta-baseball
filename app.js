// Mobile nav + back-to-top
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const toTop = document.querySelector('.to-top');

if (navToggle){
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });
}

// Show back-to-top when scrolling
window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    toTop.style.display = 'block';
  } else {
    toTop.style.display = 'none';
  }
});

if (toTop){
  toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
}
// ===== CSV utils =====
async function loadCSV(url) {
  const res = await fetch(`${url}?v=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  // Detectar separador por frecuencia en la primera línea
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  return parseCSV(text, sep);
}

function parseCSV(text, sep = ',') {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    if (!cols.length || cols.every(c => c === '')) continue;
    const obj = {};
    header.forEach((h, idx) => obj[h] = (cols[idx] ?? ''));
    rows.push(obj);
  }
  return rows;
}

function renderStandings(tbodyEl, data) {
  // Acepta cabeceras "team,wins,losses" en cualquier mayúscula/minúscula
  const norm = r => ({
    Team: r.team ?? r.Team ?? r['TEAM'] ?? '',
    Wins: Number(r.wins ?? r.Wins ?? r['WINS'] ?? 0),
    Losses: Number(r.losses ?? r.Losses ?? r['LOSSES'] ?? 0),
  });

  const rows = data.map(norm)
    .filter(r => r.Team && !Number.isNaN(r.Wins) && !Number.isNaN(r.Losses))
    .sort((a,b) => (b.Wins - a.Wins) || (a.Losses - b.Losses));

  tbodyEl.innerHTML = rows.map((r, i) =>
    `<tr${i===0?' class="leader"':''}><td>${r.Team}</td><td>${r.Wins}</td><td>${r.Losses}</td></tr>`
  ).join('');
}

// ===== Hook =====
document.addEventListener('DOMContentLoaded', async () => {
  const table = document.getElementById('standings');
  const tbody = table?.querySelector('tbody');
  const err = document.getElementById('standings-error');
  if (!table || !tbody) return;

  const src = table.dataset.src;
  if (!src) {
    tbody.innerHTML = '<tr><td colspan="3">Sin fuente (data-src)</td></tr>';
    return;
  }

  try {
    const data = await loadCSV(src);
    if (!data.length) throw new Error('CSV vacío o sin filas válidas');
    renderStandings(tbody, data);
    if (err) err.style.display = 'none';
  } catch (e) {
    console.error('Standings error:', e);
    tbody.innerHTML = '<tr><td colspan="3">Sin datos</td></tr>';
    if (err) {
      err.textContent = 'No se pudo cargar standings: ' + e.message +
        ' (¿abriste con un servidor local y la ruta del CSV es correcta?)';
      err.style.display = 'block';
    }
  }
});

// ===== Utilidades =====
async function loadJSON(url){
  const res = await fetch(url + '?v=' + Date.now());
  if(!res.ok) throw new Error('No se pudo cargar ' + url);
  return res.json();
}
const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function formatNiceDate(date){
  const m = new Intl.DateTimeFormat('es-ES', { month:'long' }).format(date);
  const d = new Intl.DateTimeFormat('es-ES', { day:'2-digit' }).format(date);
  const y = new Intl.DateTimeFormat('es-ES', { year:'numeric' }).format(date);
  return `${capFirst(m)} ${d}, ${y}`;
}
function formatNiceTime(date){
  return new Intl.DateTimeFormat('es-ES', { hour:'2-digit', minute:'2-digit', hour12:false }).format(date);
}

// ===== Template de card con overlay de logos sobre la imagen =====
function matchCardTemplate(m){
  const dt = new Date(m.datetime);
  const dateStr = new Intl.DateTimeFormat('es-ES', { day:'2-digit', month:'long', year:'numeric' })
                    .format(dt).replace(/^./, s => s.toUpperCase());
  const timeStr = new Intl.DateTimeFormat('es-ES', { hour:'2-digit', minute:'2-digit', hour12:false }).format(dt);

  // Logo del torneo como fondo (fallback a imagen del partido)
  const bg =
    m.tournamentLogo || m.tournament_logo || m.logoTorneo || m['logo-torneo'] ||
    m.image || '';

    

  // (Opcional) ayuda a depurar rutas:
  console.debug('match bg:', bg, 'title:', m.title);

  return `
  <article class="match-card
    ${m.image ? '' : 'match-card--noimage'}">
    <div class="thumb" style="
      background-image:url('${bg}');
    ">
      <div class="thumb-overlay">
        <div class="logo-pod" aria-label="Enfrentamiento ${m?.home?.name || ''} vs ${m?.away?.name || ''}">
          ${m.home?.logo ? `<img class="team-logo team-logo--big" src="${m.home.logo}" alt="${m.home.name || 'Local'}">` : ''}
          <span class="vs-chip">VS</span>
          ${m.away?.logo ? `<img class="team-logo team-logo--big" src="${m.away.logo}" alt="${m.away.name || 'Visitante'}">` : ''}
        </div>
      </div>
    </div>

    <div class="match-card__meta">
      <p class="game-title">${m.game ? `🏆 ${m.game}` : ''}</p>
      <p class="meta"><span class="icon">📅</span> ${dateStr}</p>
      <h3>${m.title} | ${timeStr}</h3>
      <p>${m.description ?? ''}</p>
      <a target="_blank" class="btn btn--primary" href="${m.stream || '#'}">Ver partido →</a>
    </div>
  </article>`;
}

async function renderMatchesSection(){
  const sec = document.querySelector('#proximos[data-matches-src]');
  if(!sec) return;

  const track = document.getElementById('match-track');
  const dots  = document.getElementById('match-dots');
  const prev  = document.querySelector('#match-slider .prev');
  const next  = document.querySelector('#match-slider .next');

  track.innerHTML = '<p class="muted">Cargando partidos…</p>';

  try{
    const url = sec.dataset.matchesSrc;
    const matches = await loadJSON(url);

    // ordena por fecha ascendente (próximos primero)
    matches.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));

    // pinta como "slides"
    track.innerHTML = matches.map(m => `<div class="slide">${matchCardTemplate(m)}</div>`).join('');

    // Asegura mínimo 3 visibles: clona si hay menos de 3
    ensureMinSlides(track, 3);

    initMatchSlider(track, dots, prev, next, { slidesPerView: 3 }); // ← fijo a 3
  }catch(err){
    console.error(err);
    track.innerHTML = '<p class="muted">No se pudieron cargar los partidos.</p>';
  }
}

// clona slides del inicio hasta llegar al mínimo requerido
function ensureMinSlides(trackEl, min){
  const count = trackEl.children.length;
  if (count >= min) return;
  for (let i = 0; i < (min - count); i++){
    const clone = trackEl.children[i % count].cloneNode(true);
    clone.classList.add('is-ghost'); // para estilo sutil si quieres
    trackEl.appendChild(clone);
  }
}

// ---- slider vanilla ----
function initMatchSlider(track, dotsEl, prevBtn, nextBtn){
  const S = { index: 0, slidesPerView: 3, pages: 1 };
  const isInteractive = (el) => el.closest('a,button,input,textarea,select,label,[role="button"]');

  const getSlidesPerView = () => (
    window.innerWidth < 720 ? 1 :
    window.innerWidth < 1024 ? 2 : 3
  );

  function recalc(){
    S.slidesPerView = getSlidesPerView();
    track.style.setProperty('--slides', S.slidesPerView);
    track.style.setProperty('--gap', getComputedStyle(track).gap || '16px');

    // ⬇️ FALTABA: calcular páginas según nº de slides
    S.pages = Math.max(1, Math.ceil(track.children.length / S.slidesPerView));

    if (S.index > S.pages - 1) S.index = S.pages - 1;
    update();
  }

  function go(i){ S.index = Math.max(0, Math.min(i, S.pages - 1)); update(); }

  function update(){
    track.style.transform = `translateX(-${S.index * 100}%)`;
    if (prevBtn) prevBtn.disabled = (S.index === 0);
    if (nextBtn) nextBtn.disabled = (S.index >= S.pages - 1);
    renderDots();
  }

  function renderDots(){
    if (!dotsEl) return;
    dotsEl.innerHTML = Array.from({length: S.pages}, (_,i) =>
      `<button class="dot${i===S.index?' is-active':''}" aria-label="Ir a página ${i+1}"></button>`
    ).join('');
    dotsEl.querySelectorAll('.dot').forEach((b,i)=> b.addEventListener('click',()=>go(i)));
  }

  // ⬇️ FALTABAN: eventos de navegación
  prevBtn?.addEventListener('click', ()=>go(S.index - 1));
  nextBtn?.addEventListener('click', ()=>go(S.index + 1));

  // Swipe sin interferir con links/botones
  let startX = null, dx = 0, dragging = false;
  track.addEventListener('pointerdown', (e)=>{
    if (isInteractive(e.target)) return;
    dragging = true; startX = e.clientX; dx = 0;
    track.setPointerCapture(e.pointerId);
    track.classList.add('is-dragging');
  });
  track.addEventListener('pointermove', (e)=>{ if (dragging) dx = e.clientX - startX; });
  track.addEventListener('pointerup', (e)=>{
    if (!dragging) return;
    track.releasePointerCapture(e.pointerId);
    track.classList.remove('is-dragging');
    if (Math.abs(dx) > 40) go(dx < 0 ? S.index + 1 : S.index - 1);
    dragging = false; startX = null; dx = 0;
  });

  // Recalcular en resize (debounce)
  let t; window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(recalc,120); });

  recalc();
}





document.addEventListener('DOMContentLoaded', renderMatchesSection);




const form  = document.getElementById('form-contacto');
const modal = document.getElementById('thanks-modal');




const NETLIFY_SITE = 'https://nesxta-baseball.netlify.app'; // ← pon tu URL real

function openModal(){
  if (!modal) return;
  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
  modal.querySelector('[data-close-modal]')?.focus();
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    fd.set('form-name', form.getAttribute('name') || 'contacto');
    const body = new URLSearchParams(fd).toString();

    try {
      // 1) Intento normal (dev/prod) → Netlify Forms responde 200 JSON si todo va bien
      const r = await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body
      });

      if (r.ok) {

        // Toma el nombre COMPLETO tal cual lo escribió la persona
        const fullName = (form.name?.value || '').trim();

        // Inserta de forma segura en el span del modal
        const span = document.getElementById('thanks-name');
        if (span) span.textContent = fullName;
        form.reset();
        openModal();
        return;
      }

      // 2) Si falla (p. ej., 405 en dev), hacemos fallback a tu sitio público con no-cors
      if (r.status === 405) {
        await fetch(NETLIFY_SITE + '/', {
          method: 'POST',
          mode: 'no-cors', // envía el form a Netlify; no podemos leer respuesta
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        
        // Toma el nombre COMPLETO tal cual lo escribió la persona
        const fullName = (form.name?.value || '').trim();

        // Inserta de forma segura en el span del modal
        const span = document.getElementById('thanks-name');
        if (span) span.textContent = fullName;
        form.reset();
        openModal();
        return;
      }

      // 3) Otros errores
      const txt = await r.text();
      console.error('Netlify Forms error:', r.status, txt);
      alert('Hubo un problema. Intenta de nuevo.');

    } catch (err) {
      console.error(err);
      alert('No se pudo enviar. Revisa tu conexión.');
    }
  });
}
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.dataset.closeModal !== undefined) {
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      form.querySelector('input,textarea')?.focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      form.querySelector('input,textarea')?.focus();
    }
  });
}

// ---- CSV helper mínimo (autodetecta ; o ,) ----
async function _loadCSV(url){
  const res = await fetch(url + '?v=' + Date.now());
  if(!res.ok) throw new Error('No se pudo cargar CSV: ' + url);
  const text = await res.text();
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length ? ';' : ',';
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const header = lines.shift().split(sep).map(h => h.trim());
  return lines.map(l=>{
    const cols = l.split(sep).map(c=>c.trim());
    const o = {};
    header.forEach((h,i)=>o[h] = cols[i] ?? '');
    return o;
  });
}

// ---- Render Latest Matches desde CSV ----
function _fmtRow(r){
  const dash = '–';
  const home = r.home_code || r.home || '';
  const away = r.away_code || r.away || '';
  const hs = r.home_score ?? r.hs ?? '';
  const as = r.away_score ?? r.as ?? '';
  const stage = r.stage ? ` · ${r.stage}` : '';
  return `${home} ${hs}${dash}${as} ${away}${stage} — Watch Replay →`;
}

async function renderLatestMatches(){
  const ul = document.querySelector('#latest-list[data-src]');
  if(!ul) return;

  ul.innerHTML = '<li class="muted">Cargando…</li>';

  try{
    const rows = await _loadCSV(ul.dataset.src);

    // Orden por fecha DESC si hay date; si no, deja el orden del CSV
    rows.sort((a,b)=>{
      const da = Date.parse(a.date || a.fecha || ''), db = Date.parse(b.date || b.fecha || '');
      return isNaN(db)-isNaN(da) || db - da;
    });

    const limit = parseInt(ul.dataset.limit || '5', 10);
    const list = rows.slice(0, limit).map(r=>{
      const label = _fmtRow(r);
      const href  = r.replay || r.link || r.url || '';
      return `<li>${
        href
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
          : `<span>${label.replace(' — Watch Replay →','')}</span>`
      }</li>`;
    }).join('');

    ul.innerHTML = list || '<li class="muted">Sin partidos recientes</li>';
  }catch(err){
    console.error(err);
    ul.innerHTML = '<li class="muted">No se pudieron cargar los últimos partidos.</li>';
  }
}

document.addEventListener('DOMContentLoaded', renderLatestMatches);
