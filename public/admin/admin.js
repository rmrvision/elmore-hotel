/* ─── El More — админка ────────────────────────────────── */

const initial = JSON.parse(document.getElementById('initialContent').textContent);
let state = structuredClone(initial);
let saved = structuredClone(initial);
let current = 'hero';

const panel = document.getElementById('panel');
const crumbCurrent = document.getElementById('crumbCurrent');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const saveState = document.getElementById('saveState');
const asideNav = document.getElementById('asideNav');
const toast = document.getElementById('toast');

const SECTIONS = {
  hero:       { title: 'Hero',          em: 'первый экран',     eyebrow: '— 01 · Hero' },
  philosophy: { title: 'Философия',     em: 'о доме',           eyebrow: '— 02 · Philosophy' },
  rooms:      { title: 'Номера',        em: 'категории',        eyebrow: '— 03 · Chambres' },
  gallery:    { title: 'Галерея',       em: 'кадры',            eyebrow: '— 04 · Atmosphère' },
  amenities:  { title: 'Удобства',      em: 'привилегии',       eyebrow: '— 05 · Quotidien' },
  reserve:    { title: 'Бронирование',  em: 'форма',            eyebrow: '— 06 · Réservation' },
  contact:    { title: 'Контакты',      em: 'связь',            eyebrow: '— 07 · Contact' },
  footer:     { title: 'Подвал',        em: 'низ страницы',     eyebrow: '— 08 · Pied' },
  site:       { title: 'Шапка',         em: 'навигация',        eyebrow: '— 09 · Navigation' },
  travelline: { title: 'TravelLine',    em: 'модуль бронирования', eyebrow: '— 10 · Booking Engine' },
  seo:        { title: 'SEO',           em: 'аналитика и поиск',   eyebrow: '— 11 · Webmaster · Метрика' },
  media:      { title: 'Медиатека',     em: 'изображения',      eyebrow: '— 12 · Médias' },
};

/* ─── helpers ─────────────────────────────────────────── */
const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

function setDirty() {
  const isDirty = JSON.stringify(state) !== JSON.stringify(saved);
  saveState.classList.toggle('dirty', isDirty);
  saveState.classList.toggle('saved', !isDirty);
  saveState.textContent = isDirty ? '— Несохранённые изменения' : '— Всё сохранено';
}

function showToast(msg, isErr) {
  toast.innerHTML = `<span class="dot"></span>${esc(msg)}`;
  toast.classList.toggle('err', !!isErr);
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ─── навигация ───────────────────────────────────────── */
function buildAside() {
  [...asideNav.children].forEach(a => {
    a.classList.toggle('active', a.dataset.section === current);
    a.onclick = () => navigate(a.dataset.section);
  });
}
function navigate(section) {
  current = section;
  buildAside();
  crumbCurrent.textContent = SECTIONS[section].title;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── рендеринг панели ────────────────────────────────── */
function panelHead(sec) {
  return `
    <div class="panel-head">
      <div class="panel-eyebrow">${esc(sec.eyebrow)}</div>
      <h1 class="panel-title">${esc(sec.title)} <em>${esc(sec.em)}</em></h1>
    </div>`;
}

function render() {
  const sec = SECTIONS[current];
  let html = panelHead(sec);
  switch (current) {
    case 'hero':       html += renderHero(); break;
    case 'philosophy': html += renderPhilosophy(); break;
    case 'rooms':      html += renderRooms(); break;
    case 'gallery':    html += renderGallery(); break;
    case 'amenities':  html += renderAmenities(); break;
    case 'reserve':    html += renderReserve(); break;
    case 'contact':    html += renderContact(); break;
    case 'footer':     html += renderFooter(); break;
    case 'site':       html += renderSite(); break;
    case 'travelline': html += renderTravelline(); break;
    case 'seo':        html += renderSeo(); break;
    case 'media':      html += renderMedia(); break;
  }
  panel.innerHTML = html;
  bindFields();
  if (current === 'media') refreshMedia();
}

/* ─── привязка полей через data-path ──────────────────── */
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => {
    if (o == null) return o;
    const m = k.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (!m) return undefined;
    return m[2] !== undefined ? o[m[1]][+m[2]] : o[m[1]];
  }, obj);
}
function setByPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => {
    const m = k.match(/^(\w+)(?:\[(\d+)\])?$/);
    return m[2] !== undefined ? o[m[1]][+m[2]] : o[m[1]];
  }, obj);
  const m = last.match(/^(\w+)(?:\[(\d+)\])?$/);
  if (m[2] !== undefined) parent[m[1]][+m[2]] = value;
  else parent[m[1]] = value;
}

function bindFields() {
  panel.querySelectorAll('[data-path]').forEach(input => {
    const path = input.dataset.path;
    input.addEventListener('input', () => {
      setByPath(state, path, input.value);
      setDirty();
    });
  });
  // кнопки выбора изображения
  panel.querySelectorAll('[data-pick-image]').forEach(btn => {
    btn.addEventListener('click', () => openMediaPicker((url) => {
      const path = btn.dataset.pickImage;
      setByPath(state, path, url);
      setDirty();
      render();
    }));
  });
  // удалить изображение
  panel.querySelectorAll('[data-clear-image]').forEach(btn => {
    btn.addEventListener('click', () => {
      const path = btn.dataset.clearImage;
      setByPath(state, path, '');
      setDirty();
      render();
    });
  });
  // добавление / удаление в массивах
  panel.querySelectorAll('[data-array-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { arrayAdd, template } = btn.dataset;
      const arr = getByPath(state, arrayAdd);
      arr.push(JSON.parse(template));
      setDirty();
      render();
    });
  });
  // добавление изображения через медиа-пикер
  panel.querySelectorAll('[data-add-image]').forEach(btn => {
    btn.addEventListener('click', () => {
      const path = btn.dataset.addImage;
      openMediaPicker((url) => {
        const arr = getByPath(state, path) || [];
        arr.push(url);
        setByPath(state, path, arr);
        setDirty();
        render();
      });
    });
  });
  // перестановка изображения в массиве
  panel.querySelectorAll('[data-move-image]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [path, idxStr, dirStr] = btn.dataset.moveImage.split('|');
      const idx = +idxStr, dir = +dirStr;
      const arr = getByPath(state, path);
      const next = idx + dir;
      if (next < 0 || next >= arr.length) return;
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      setDirty();
      render();
    });
  });
  panel.querySelectorAll('[data-array-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [path, idx] = btn.dataset.arrayRemove.split('|');
      const arr = getByPath(state, path);
      arr.splice(+idx, 1);
      setDirty();
      render();
    });
  });
}

/* ─── поле — список изображений (для номеров) ────────── */
function imagesField(label, basePath, images) {
  const arr = images || [];
  return `
    <div class="field full">
      <label>${esc(label)} <span class="lbl-hint">${arr.length ? arr.length + ' шт.' : '— нет фото'}</span></label>
      <div class="imgs-list">
        ${arr.map((url, i) => `
          <div class="imgs-item">
            <div class="imgs-thumb">
              <img src="${esc(url)}" alt="">
              <div class="imgs-num">${String(i+1).padStart(2,'0')}</div>
            </div>
            <div class="imgs-controls">
              <button class="btn ghost" data-pick-image="${esc(basePath)}.images[${i}]" title="Заменить">Заменить</button>
              <button class="btn ghost" data-move-image="${esc(basePath)}.images|${i}|-1" title="Влево" ${i===0 ? 'disabled':''}>←</button>
              <button class="btn ghost" data-move-image="${esc(basePath)}.images|${i}|1"  title="Вправо" ${i===arr.length-1 ? 'disabled':''}>→</button>
              <button class="btn danger" data-array-remove="${esc(basePath)}.images|${i}" title="Удалить">×</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="add-btn" data-add-image="${esc(basePath)}.images">+ Добавить фото</button>
    </div>`;
}

/* ─── поле — изображение ─────────────────────────────── */
function imageField(label, path) {
  const url = getByPath(state, path) || '';
  return `
    <div class="field full field-image">
      <label>${esc(label)} <span class="lbl-hint">${url ? '— загружено' : '— не задано'}</span></label>
      <div class="img-preview">
        ${url ? `<img src="${esc(url)}" alt="">` : `<span class="empty">— Изображение не выбрано —</span>`}
      </div>
      <div class="img-actions">
        <button class="btn primary" data-pick-image="${esc(path)}"><span class="dot"></span>${url ? 'Заменить' : 'Выбрать'}</button>
        ${url ? `<button class="btn danger" data-clear-image="${esc(path)}">Убрать</button>` : ''}
      </div>
    </div>`;
}

/* ─── секции ──────────────────────────────────────────── */
function renderHero() {
  const h = state.hero;
  return `
    <div class="fields">
      <div class="field"><label>Заголовок — строка 1</label><input type="text" data-path="hero.titleLine1" value="${esc(h.titleLine1)}"></div>
      <div class="field"><label>Заголовок — строка 2 <span class="lbl-hint">курсив</span></label><input type="text" data-path="hero.titleLine2" value="${esc(h.titleLine2)}"></div>
      <div class="field"><label>Координаты / мета слева</label><input type="text" data-path="hero.metaLeft" value="${esc(h.metaLeft)}"></div>
      <div class="field"><label>Мета по центру</label><input type="text" data-path="hero.metaCenter" value="${esc(h.metaCenter)}"></div>
      <div class="field"><label>Мета справа</label><input type="text" data-path="hero.metaRight" value="${esc(h.metaRight)}"></div>
      <div class="field"><label>Метка интро <span class="lbl-hint">enter — перенос</span></label><input type="text" data-path="hero.introLabel" value="${esc(h.introLabel)}"></div>
      <div class="field full"><label>Вступительный текст</label><textarea data-path="hero.introText">${esc(h.introText)}</textarea></div>
      <div class="field"><label>Подпись изображения — слева</label><input type="text" data-path="hero.imageCaptionLeft" value="${esc(h.imageCaptionLeft)}"></div>
      <div class="field"><label>Подпись изображения — справа</label><input type="text" data-path="hero.imageCaptionRight" value="${esc(h.imageCaptionRight)}"></div>
      ${imageField('Главное изображение', 'hero.image')}
    </div>`;
}

function renderPhilosophy() {
  const p = state.philosophy;
  return `
    <div class="fields">
      <div class="field"><label>Eyebrow</label><input type="text" data-path="philosophy.eyebrow" value="${esc(p.eyebrow)}"></div>
      <div class="field full"><label>Цитата — начало</label><input type="text" data-path="philosophy.quotePre" value="${esc(p.quotePre)}"></div>
      <div class="field"><label>Цитата — акцент <span class="lbl-hint">латунный</span></label><input type="text" data-path="philosophy.quoteAccent" value="${esc(p.quoteAccent)}"></div>
      <div class="field"><label>Цитата — окончание</label><input type="text" data-path="philosophy.quotePost" value="${esc(p.quotePost)}"></div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">A</span>Параграфы</div></div>
      <div class="group-body">
        <div class="list">
          ${p.paragraphs.map((para, i) => `
            <div class="list-item" style="grid-template-columns:1fr auto;">
              <textarea data-path="philosophy.paragraphs[${i}]">${esc(para)}</textarea>
              <button class="del" data-array-remove="philosophy.paragraphs|${i}">×</button>
            </div>`).join('')}
        </div>
        <button class="add-btn" data-array-add="philosophy.paragraphs" data-template='""'>+ Добавить параграф</button>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">B</span>Статистика</div></div>
      <div class="group-body">
        <div class="list">
          ${p.stats.map((s, i) => `
            <div class="list-item">
              <input type="text" placeholder="Число" data-path="philosophy.stats[${i}].n" value="${esc(s.n)}">
              <input type="text" placeholder="Подпись" data-path="philosophy.stats[${i}].l" value="${esc(s.l)}">
              <button class="del" data-array-remove="philosophy.stats|${i}">×</button>
            </div>`).join('')}
        </div>
        <button class="add-btn" data-array-add="philosophy.stats" data-template='{"n":"00","l":"подпись"}'>+ Добавить</button>
      </div>
    </div>`;
}

function renderRooms() {
  const r = state.rooms;
  // миграция: одиночное `image` → массив `images`
  r.items.forEach(it => {
    if (!Array.isArray(it.images)) it.images = it.image ? [it.image] : [];
  });
  return `
    <div class="fields">
      <div class="field"><label>Eyebrow</label><input type="text" data-path="rooms.eyebrow" value="${esc(r.eyebrow)}"></div>
      <div class="field"><label>Заголовок — строка 1</label><input type="text" data-path="rooms.titleLine1" value="${esc(r.titleLine1)}"></div>
      <div class="field"><label>Заголовок — строка 2 <span class="lbl-hint">курсив</span></label><input type="text" data-path="rooms.titleLine2" value="${esc(r.titleLine2)}"></div>
      <div class="field full"><label>Описание секции</label><textarea data-path="rooms.description">${esc(r.description)}</textarea></div>
    </div>

    ${r.items.map((item, i) => `
      <div class="group">
        <div class="group-head">
          <div class="group-title"><span class="num">${esc(item.num)}</span>${esc(item.title)} ${item.titleItalic ? '<em>' + esc(item.titleItalic) + '</em>' : ''}</div>
          <div class="group-actions">
            <button class="btn danger" data-array-remove="rooms.items|${i}">Удалить</button>
          </div>
        </div>
        <div class="group-body">
          <div class="fields">
            <div class="field"><label>Номер</label><input type="text" data-path="rooms.items[${i}].num" value="${esc(item.num)}"></div>
            <div class="field"><label>Название</label><input type="text" data-path="rooms.items[${i}].title" value="${esc(item.title)}"></div>
            <div class="field"><label>Курсивная часть <span class="lbl-hint">опционально</span></label><input type="text" data-path="rooms.items[${i}].titleItalic" value="${esc(item.titleItalic)}"></div>
            <div class="field"><label>Категория / подзаголовок</label><input type="text" data-path="rooms.items[${i}].category" value="${esc(item.category)}"></div>
            <div class="field full"><label>Описание</label><textarea data-path="rooms.items[${i}].description">${esc(item.description)}</textarea></div>
            <div class="field"><label>Метка на фото</label><input type="text" data-path="rooms.items[${i}].imageTag" value="${esc(item.imageTag)}"></div>
            ${imagesField('Фотографии номера', `rooms.items[${i}]`, item.images)}
          </div>

          <div class="group" style="margin-top:24px;">
            <div class="group-head"><div class="group-title"><span class="num">▸</span>Характеристики</div></div>
            <div class="group-body">
              <div class="list">
                ${item.specs.map((sp, j) => `
                  <div class="list-item">
                    <input type="text" placeholder="Подпись" data-path="rooms.items[${i}].specs[${j}].lbl" value="${esc(sp.lbl)}">
                    <input type="text" placeholder="Значение" data-path="rooms.items[${i}].specs[${j}].val" value="${esc(sp.val)}">
                    <button class="del" data-array-remove="rooms.items[${i}].specs|${j}">×</button>
                  </div>`).join('')}
              </div>
              <button class="add-btn" data-array-add="rooms.items[${i}].specs" data-template='{"lbl":"Параметр","val":"значение"}'>+ Добавить характеристику</button>
            </div>
          </div>
        </div>
      </div>
    `).join('')}

    <button class="add-btn" data-array-add="rooms.items" data-template='${esc(JSON.stringify({
      num:"N° 04",title:"Новый номер",titleItalic:"",category:"Catégorie",description:"Описание...",
      specs:[{lbl:"Гости",val:"2"},{lbl:"Площадь",val:"20 м²"}],images:[],imageTag:"Pl. — "
    }))}'>+ Добавить категорию номера</button>`;
}

function renderGallery() {
  const g = state.gallery;
  return `
    <div class="fields">
      <div class="field"><label>Eyebrow</label><input type="text" data-path="gallery.eyebrow" value="${esc(g.eyebrow)}"></div>
      <div class="field"><label>Заголовок</label><input type="text" data-path="gallery.title" value="${esc(g.title)}"></div>
      <div class="field"><label>Заголовок — курсив</label><input type="text" data-path="gallery.titleItalic" value="${esc(g.titleItalic)}"></div>
      <div class="field full"><label>Описание</label><textarea data-path="gallery.description">${esc(g.description)}</textarea></div>
      <div class="field"><label>Подпись внизу</label><input type="text" data-path="gallery.footText" value="${esc(g.footText)}"></div>
      <div class="field"><label>CTA внизу</label><input type="text" data-path="gallery.footCta" value="${esc(g.footCta)}"></div>
    </div>

    ${g.tiles.map((t, i) => `
      <div class="group">
        <div class="group-head">
          <div class="group-title"><span class="num">${String(i+1).padStart(2,'0')}</span>${t.type === 'note' ? 'Цитата' : 'Изображение'}</div>
          <div class="group-actions">
            <button class="btn danger" data-array-remove="gallery.tiles|${i}">Удалить</button>
          </div>
        </div>
        <div class="group-body">
          ${t.type === 'note' ? `
            <div class="fields">
              <div class="field"><label>Номер / метка</label><input type="text" data-path="gallery.tiles[${i}].num" value="${esc(t.num)}"></div>
              <div class="field"><label>Подпись</label><input type="text" data-path="gallery.tiles[${i}].sign" value="${esc(t.sign)}"></div>
              <div class="field full"><label>Цитата</label><textarea data-path="gallery.tiles[${i}].quote">${esc(t.quote)}</textarea></div>
            </div>` : `
            <div class="fields">
              <div class="field"><label>Подпись <span class="lbl-hint">Pl. I — ...</span></label><input type="text" data-path="gallery.tiles[${i}].cap" value="${esc(t.cap)}"></div>
              <div class="field"><label>Римский номер</label><input type="text" data-path="gallery.tiles[${i}].num" value="${esc(t.num)}"></div>
              ${imageField('Изображение', `gallery.tiles[${i}].image`)}
            </div>`}
        </div>
      </div>
    `).join('')}

    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="add-btn" data-array-add="gallery.tiles" data-template='${esc(JSON.stringify({type:"image",image:"",cap:"Pl. — ",num:"vii."}))}'>+ Добавить изображение</button>
      <button class="add-btn" data-array-add="gallery.tiles" data-template='${esc(JSON.stringify({type:"note",num:"— Note",quote:"«Цитата.»",sign:"— Автор"}))}'>+ Добавить цитату</button>
    </div>`;
}

function renderAmenities() {
  const a = state.amenities;
  return `
    <div class="fields">
      <div class="field"><label>Eyebrow</label><input type="text" data-path="amenities.eyebrow" value="${esc(a.eyebrow)}"></div>
      <div class="field"><label>Заголовок</label><input type="text" data-path="amenities.title" value="${esc(a.title)}"></div>
      <div class="field"><label>Заголовок — курсив</label><input type="text" data-path="amenities.titleItalic" value="${esc(a.titleItalic)}"></div>
      <div class="field full"><label>Описание</label><textarea data-path="amenities.description">${esc(a.description)}</textarea></div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">▸</span>Удобства · ${a.items.length} шт.</div></div>
      <div class="group-body">
        ${a.items.map((it, i) => `
          <div class="group" style="margin-top:${i===0?0:14}px;">
            <div class="group-head">
              <div class="group-title"><span class="num">${esc(it.num)}</span>${esc(it.title)}</div>
              <div class="group-actions">
                <button class="btn danger" data-array-remove="amenities.items|${i}">×</button>
              </div>
            </div>
            <div class="group-body">
              <div class="fields">
                <div class="field"><label>Номер</label><input type="text" data-path="amenities.items[${i}].num" value="${esc(it.num)}"></div>
                <div class="field"><label>Заголовок</label><input type="text" data-path="amenities.items[${i}].title" value="${esc(it.title)}"></div>
                <div class="field full"><label>Описание</label><textarea data-path="amenities.items[${i}].text">${esc(it.text)}</textarea></div>
              </div>
            </div>
          </div>`).join('')}
        <button class="add-btn" data-array-add="amenities.items" data-template='${esc(JSON.stringify({num:"09",title:"Новое удобство",text:"Описание..."}))}'>+ Добавить удобство</button>
      </div>
    </div>`;
}

function renderReserve() {
  const r = state.reserve;
  return `
    <div class="fields">
      <div class="field"><label>Eyebrow</label><input type="text" data-path="reserve.eyebrow" value="${esc(r.eyebrow)}"></div>
      <div class="field"><label>Заголовок — строка 1</label><input type="text" data-path="reserve.titleLine1" value="${esc(r.titleLine1)}"></div>
      <div class="field"><label>Заголовок — строка 2 <span class="lbl-hint">курсив</span></label><input type="text" data-path="reserve.titleLine2" value="${esc(r.titleLine2)}"></div>
      <div class="field full"><label>Описание</label><textarea data-path="reserve.description">${esc(r.description)}</textarea></div>
      <div class="field"><label>Текст кнопки</label><input type="text" data-path="reserve.buttonLabel" value="${esc(r.buttonLabel)}"></div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">▸</span>Категории в форме</div></div>
      <div class="group-body">
        <div class="list">
          ${r.categories.map((c, i) => `
            <div class="list-item" style="grid-template-columns:1fr auto;">
              <input type="text" data-path="reserve.categories[${i}]" value="${esc(c)}">
              <button class="del" data-array-remove="reserve.categories|${i}">×</button>
            </div>`).join('')}
        </div>
        <button class="add-btn" data-array-add="reserve.categories" data-template='"Новая категория"'>+ Добавить категорию</button>
      </div>
    </div>`;
}

function renderContact() {
  const c = state.contact;
  return `
    <div class="fields">
      <div class="field"><label>Подпись блока «Адрес»</label><input type="text" data-path="contact.addressLabel" value="${esc(c.addressLabel)}"></div>
      <div class="field full"><label>Адрес <span class="lbl-hint">enter — перенос</span></label><textarea data-path="contact.address">${esc(c.address)}</textarea></div>
      <div class="field full"><label>Примечание к адресу</label><input type="text" data-path="contact.addressNote" value="${esc(c.addressNote)}"></div>
      <div class="field"><label>Подпись блока «Связь»</label><input type="text" data-path="contact.linkLabel" value="${esc(c.linkLabel)}"></div>
      <div class="field"><label>Телефон</label><input type="text" data-path="contact.phone" value="${esc(c.phone)}"></div>
      <div class="field"><label>Email</label><input type="email" data-path="contact.email" value="${esc(c.email)}"></div>
      <div class="field full"><label>Примечание к связи</label><textarea data-path="contact.contactNote">${esc(c.contactNote)}</textarea></div>
    </div>`;
}

function renderFooter() {
  const f = state.footer;
  return `
    <div class="fields">
      <div class="field full"><label>Подзаголовок бренда</label><input type="text" data-path="footer.tagline" value="${esc(f.tagline)}"></div>
      <div class="field full"><label>Копирайт</label><input type="text" data-path="footer.copyright" value="${esc(f.copyright)}"></div>
    </div>

    ${f.columns.map((col, i) => `
      <div class="group">
        <div class="group-head">
          <div class="group-title"><span class="num">${String(i+1).padStart(2,'0')}</span>${esc(col.title)}</div>
          <div class="group-actions"><button class="btn danger" data-array-remove="footer.columns|${i}">Удалить колонку</button></div>
        </div>
        <div class="group-body">
          <div class="fields">
            <div class="field"><label>Заголовок колонки</label><input type="text" data-path="footer.columns[${i}].title" value="${esc(col.title)}"></div>
            <div class="field"><label>Доп. текст <span class="lbl-hint">опционально</span></label><input type="text" data-path="footer.columns[${i}].extra" value="${esc(col.extra || '')}"></div>
          </div>
          <div class="group" style="margin-top:18px;">
            <div class="group-head"><div class="group-title"><span class="num">▸</span>Ссылки</div></div>
            <div class="group-body">
              <div class="list">
                ${col.links.map((l, j) => `
                  <div class="list-item">
                    <input type="text" placeholder="Текст" data-path="footer.columns[${i}].links[${j}].label" value="${esc(l.label)}">
                    <input type="text" placeholder="href" data-path="footer.columns[${i}].links[${j}].href" value="${esc(l.href)}">
                    <button class="del" data-array-remove="footer.columns[${i}].links|${j}">×</button>
                  </div>`).join('')}
              </div>
              <button class="add-btn" data-array-add="footer.columns[${i}].links" data-template='{"label":"Новая","href":"#"}'>+ Добавить ссылку</button>
            </div>
          </div>
        </div>
      </div>
    `).join('')}

    <button class="add-btn" data-array-add="footer.columns" data-template='${esc(JSON.stringify({title:"— Новая колонка",links:[{label:"Ссылка","href":"#"}]}))}'>+ Добавить колонку</button>`;
}

function renderSite() {
  const s = state.site;
  return `
    <div class="fields">
      <div class="field"><label>Бренд</label><input type="text" data-path="site.brand" value="${esc(s.brand)}"></div>
      <div class="field"><label>Курсивная часть бренда</label><input type="text" data-path="site.brandItalic" value="${esc(s.brandItalic)}"></div>
      <div class="field"><label>Текст CTA в шапке</label><input type="text" data-path="site.navCta" value="${esc(s.navCta)}"></div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">▸</span>Ссылки в навигации</div></div>
      <div class="group-body">
        <div class="list">
          ${s.navLinks.map((l, i) => `
            <div class="list-item">
              <input type="text" placeholder="Текст" data-path="site.navLinks[${i}].label" value="${esc(l.label)}">
              <input type="text" placeholder="href" data-path="site.navLinks[${i}].href" value="${esc(l.href)}">
              <button class="del" data-array-remove="site.navLinks|${i}">×</button>
            </div>`).join('')}
        </div>
        <button class="add-btn" data-array-add="site.navLinks" data-template='{"label":"Новая","href":"#"}'>+ Добавить ссылку</button>
      </div>
    </div>`;
}

function renderTravelline() {
  if (!state.travelline) state.travelline = { contextId: '', lang: 'ru', searchScript: '', bookingScript: '' };
  if (state.travelline.searchScript == null)  state.travelline.searchScript = '';
  if (state.travelline.bookingScript == null) state.travelline.bookingScript = '';
  const tl = state.travelline;
  const hasScripts = !!(tl.searchScript || tl.bookingScript);
  const hasCtx = !!tl.contextId;
  const connected = hasScripts || hasCtx;

  return `
    <p class="panel-desc">
      Подключение модуля онлайн-бронирования <strong>TL: Booking Engine</strong>.
      Поддержка TravelLine сделает скрипты под наш дизайн и пришлёт их на почту.
      Вставьте полученные скрипты в поля ниже — этого достаточно.
    </p>

    <div class="group">
      <div class="group-head">
        <div class="group-title"><span class="num">●</span>Статус подключения
          <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.25em;margin-left:14px;color:${connected ? '#3F7044' : 'var(--brass)'};">
            ${connected ? '● ПОДКЛЮЧЕНО' : '● НЕ ПОДКЛЮЧЕНО'}
          </span>
        </div>
      </div>
      <div class="group-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-family:var(--mono);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">
          <div style="padding:14px 18px;border:1px solid var(--line);">
            <div style="color:var(--ink-3);">Скрипт поиска</div>
            <div style="margin-top:6px;color:${tl.searchScript ? '#3F7044' : 'var(--ink-3)'};">${tl.searchScript ? '● вставлен' : '○ не вставлен'}</div>
          </div>
          <div style="padding:14px 18px;border:1px solid var(--line);">
            <div style="color:var(--ink-3);">Скрипт бронирования</div>
            <div style="margin-top:6px;color:${tl.bookingScript ? '#3F7044' : 'var(--ink-3)'};">${tl.bookingScript ? '● вставлен' : '○ не вставлен'}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">1</span>Скрипт виджета поиска
        <span class="lbl-hint" style="font-family:var(--sans);font-size:12px;color:var(--ink-3);text-transform:none;letter-spacing:0;margin-left:14px;">→ показывается на главной в секции «Бронирование»</span>
      </div></div>
      <div class="group-body">
        <div class="field full">
          <label>Вставьте скрипт от TravelLine целиком <span class="lbl-hint">включая теги &lt;script&gt;&lt;/script&gt;</span></label>
          <textarea data-path="travelline.searchScript" style="font-family:var(--mono);font-size:12px;min-height:200px;white-space:pre;">${esc(tl.searchScript)}</textarea>
        </div>
        <p style="margin-top:10px;font-size:13px;color:var(--ink-3);line-height:1.6;">
          В письме от поддержки этот скрипт будет помечен примерно так:
          «Скрипт для формы поиска» или «search-form».
          Внутри он должен содержать <code>'embed', 'search-form'</code>.
        </p>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">2</span>Скрипт формы бронирования
        <span class="lbl-hint" style="font-family:var(--sans);font-size:12px;color:var(--ink-3);text-transform:none;letter-spacing:0;margin-left:14px;">→ показывается на странице /booking</span>
      </div></div>
      <div class="group-body">
        <div class="field full">
          <label>Вставьте скрипт от TravelLine целиком <span class="lbl-hint">включая теги &lt;script&gt;&lt;/script&gt;</span></label>
          <textarea data-path="travelline.bookingScript" style="font-family:var(--mono);font-size:12px;min-height:200px;white-space:pre;">${esc(tl.bookingScript)}</textarea>
        </div>
        <p style="margin-top:10px;font-size:13px;color:var(--ink-3);line-height:1.6;">
          В письме от поддержки этот скрипт будет помечен примерно так:
          «Скрипт для формы бронирования» или «booking-form».
          Внутри он должен содержать <code>'embed', 'booking-form'</code>.
        </p>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">3</span>Резервный вариант — простой contextId</div></div>
      <div class="group-body">
        <p style="font-size:13px;color:var(--ink-3);line-height:1.6;margin-bottom:14px;">
          Если поддержка вместо скриптов прислала только идентификатор отеля
          (формат <code>TL-INT-xxx-xxx</code>) — вставьте его сюда, мы соберём
          стандартный скрипт сами. Если выше уже заполнены скрипты — это поле игнорируется.
        </p>
        <div class="fields">
          <div class="field full">
            <label>contextId</label>
            <input type="text" data-path="travelline.contextId" placeholder="TL-INT-..."
              value="${esc(tl.contextId)}"
              style="font-family:var(--mono);font-size:14px;letter-spacing:0.05em;">
          </div>
          <div class="field">
            <label>Язык модуля</label>
            <select data-path="travelline.lang">
              ${['ru','en','de','fr','es','it','zh'].map(l =>
                `<option value="${l}" ${tl.lang === l ? 'selected':''}>${l.toUpperCase()}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">i</span>Поддержка TravelLine</div></div>
      <div class="group-body">
        <ul style="padding-left:22px;line-height:1.9;color:var(--ink-2);font-size:14px;">
          <li>Email: <strong>support@travelline.ru</strong></li>
          <li>Тел: <strong>8 800 555-20-30</strong></li>
          <li>Личный кабинет: <a href="https://my.tlintegration.com" target="_blank" style="color:var(--brass);text-decoration:underline;">my.tlintegration.com</a></li>
        </ul>
      </div>
    </div>`;
}

function renderSeo() {
  if (!state.seo) state.seo = { yandexVerification: '', yandexMetrikaId: '', googleVerification: '', siteUrl: '' };
  const s = state.seo;
  const yv = !!s.yandexVerification, ym = !!s.yandexMetrikaId, gv = !!s.googleVerification;
  return `
    <p class="panel-desc">
      Подключение Яндекс Вебмастера и Яндекс Метрики. Также можно подтвердить право
      на сайт в Google Search Console. Все коды вшиваются в <code>&lt;head&gt;</code>
      обеих страниц (главной и /booking).
    </p>

    <div class="group">
      <div class="group-head">
        <div class="group-title"><span class="num">▸</span>Яндекс Вебмастер
          <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.25em;margin-left:14px;color:${yv ? '#3F7044' : 'var(--brass)'};">
            ${yv ? '● ПОДКЛЮЧЕНО' : '● НЕ ПОДКЛЮЧЕНО'}
          </span>
        </div>
      </div>
      <div class="group-body">
        <div class="fields">
          <div class="field full">
            <label>Код верификации <span class="lbl-hint">из meta-тега</span></label>
            <input type="text" data-path="seo.yandexVerification"
              placeholder="abc123def456..."
              value="${esc(s.yandexVerification)}"
              style="font-family:var(--mono);font-size:14px;letter-spacing:0.05em;">
          </div>
        </div>
        <div style="margin-top:18px;padding:18px 22px;background:var(--bone-2);border:1px solid var(--line);">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:var(--brass);margin-bottom:10px;">— Как получить</div>
          <ol style="padding-left:22px;line-height:1.8;color:var(--ink-2);font-size:13px;">
            <li>Зайти в <a href="https://webmaster.yandex.ru" target="_blank" style="color:var(--brass);text-decoration:underline;">webmaster.yandex.ru</a> → добавить сайт <code>${esc(s.siteUrl || 'https://elmorehotel.ru')}</code></li>
            <li>Выбрать способ верификации <strong>«Мета-тег»</strong></li>
            <li>Яндекс покажет строку вида <code style="font-size:11px;">&lt;meta name="yandex-verification" content="<u>abc123</u>"&gt;</code></li>
            <li>Скопировать значение <code>content="..."</code> (только то, что в кавычках) → вставить выше</li>
            <li><strong>Сохранить</strong> в админке, дождаться редеплоя, нажать в Вебмастере «Проверить»</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-head">
        <div class="group-title"><span class="num">▸</span>Яндекс Метрика
          <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.25em;margin-left:14px;color:${ym ? '#3F7044' : 'var(--brass)'};">
            ${ym ? '● ПОДКЛЮЧЕНО' : '● НЕ ПОДКЛЮЧЕНО'}
          </span>
        </div>
      </div>
      <div class="group-body">
        <div class="fields">
          <div class="field full">
            <label>Номер счётчика <span class="lbl-hint">только цифры</span></label>
            <input type="text" data-path="seo.yandexMetrikaId"
              placeholder="12345678"
              value="${esc(s.yandexMetrikaId)}"
              style="font-family:var(--mono);font-size:14px;letter-spacing:0.1em;">
          </div>
        </div>
        <div style="margin-top:18px;padding:18px 22px;background:var(--bone-2);border:1px solid var(--line);">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:var(--brass);margin-bottom:10px;">— Как получить</div>
          <ol style="padding-left:22px;line-height:1.8;color:var(--ink-2);font-size:13px;">
            <li>Зайти в <a href="https://metrika.yandex.ru" target="_blank" style="color:var(--brass);text-decoration:underline;">metrika.yandex.ru</a> → создать счётчик</li>
            <li>Адрес сайта: <code>${esc(s.siteUrl || 'https://elmorehotel.ru')}</code></li>
            <li>Включить опции: <strong>Карта кликов</strong>, <strong>Вебвизор</strong>, <strong>Точный показатель отказов</strong> (мы уже настроили в коде)</li>
            <li>Скопировать <strong>номер счётчика</strong> (8 цифр) — он в верху страницы счётчика</li>
            <li>Вставить выше → <strong>Сохранить</strong></li>
          </ol>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-head">
        <div class="group-title"><span class="num">▸</span>Google Search Console
          <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.25em;margin-left:14px;color:${gv ? '#3F7044' : 'var(--ink-3)'};">
            ${gv ? '● ПОДКЛЮЧЕНО' : '○ ОПЦИОНАЛЬНО'}
          </span>
        </div>
      </div>
      <div class="group-body">
        <div class="fields">
          <div class="field full">
            <label>Код верификации Google</label>
            <input type="text" data-path="seo.googleVerification"
              placeholder="abc123..."
              value="${esc(s.googleVerification)}"
              style="font-family:var(--mono);font-size:14px;letter-spacing:0.05em;">
          </div>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-head"><div class="group-title"><span class="num">▸</span>Базовые SEO-настройки</div></div>
      <div class="group-body">
        <div class="fields">
          <div class="field full">
            <label>URL сайта <span class="lbl-hint">для sitemap.xml</span></label>
            <input type="text" data-path="seo.siteUrl" placeholder="https://elmorehotel.ru" value="${esc(s.siteUrl)}">
          </div>
        </div>
        <div style="margin-top:18px;padding:18px 22px;background:var(--bone-2);border:1px solid var(--line);">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:var(--brass);margin-bottom:10px;">— Автоматические эндпоинты</div>
          <p style="line-height:1.7;color:var(--ink-2);font-size:13px;">
            Сайт автоматически отдаёт:
          </p>
          <ul style="padding-left:22px;line-height:1.9;color:var(--ink-2);font-size:13px;">
            <li><a href="/robots.txt" target="_blank" style="color:var(--brass);text-decoration:underline;font-family:var(--mono);">/robots.txt</a> — для поисковых роботов</li>
            <li><a href="/sitemap.xml" target="_blank" style="color:var(--brass);text-decoration:underline;font-family:var(--mono);">/sitemap.xml</a> — карта сайта (главная + /booking)</li>
          </ul>
          <p style="margin-top:10px;line-height:1.7;color:var(--ink-2);font-size:13px;">
            После добавления сайта в Вебмастер укажите там же ссылку на sitemap.xml для ускоренной индексации.
          </p>
        </div>
      </div>
    </div>`;
}

function renderMedia() {
  return `<p class="panel-desc">Все загруженные изображения. Используйте их повторно в любом разделе через «Заменить → Выбрать из медиатеки».</p>
    <div class="group" style="margin-top:30px;">
      <div class="group-head">
        <div class="group-title"><span class="num">▸</span>Загруженные файлы</div>
        <div class="group-actions">
          <label class="btn primary upload-btn"><span class="dot"></span>Загрузить
            <input type="file" id="mediaPageUpload" accept="image/*" hidden>
          </label>
        </div>
      </div>
      <div class="group-body">
        <div class="media-grid" id="mediaPageGrid"><div class="panel-desc">Загрузка...</div></div>
      </div>
    </div>`;
}

async function refreshMedia() {
  const grid = document.getElementById('mediaPageGrid');
  const input = document.getElementById('mediaPageUpload');
  if (input) {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadFile(file);
      refreshMedia();
    });
  }
  if (!grid) return;
  const res = await fetch('/admin/api/uploads');
  const list = await res.json();
  if (!list.length) {
    grid.innerHTML = `<div class="panel-desc">Медиатека пуста. Загрузите первое изображение.</div>`;
    return;
  }
  grid.innerHTML = list.map(f => `
    <div class="item">
      <img src="${esc(f.url)}" alt="">
      <button class="del" data-name="${esc(f.name)}">×</button>
    </div>
  `).join('');
  grid.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Удалить изображение?')) return;
      await fetch('/admin/api/uploads/' + btn.dataset.name, { method: 'DELETE' });
      refreshMedia();
    });
  });
}

/* ─── медиатека (модалка) ────────────────────────────── */
const mediaModal = document.getElementById('mediaModal');
const mediaGrid = document.getElementById('mediaGrid');
const uploadInput = document.getElementById('uploadInput');
const urlInput = document.getElementById('urlInput');
const useUrlBtn = document.getElementById('useUrlBtn');
let pickerCallback = null;

function openMediaPicker(cb) {
  pickerCallback = cb;
  mediaModal.classList.add('open');
  urlInput.value = '';
  loadMediaList();
}
function closeMediaPicker() {
  mediaModal.classList.remove('open');
  pickerCallback = null;
}
mediaModal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeMediaPicker));

async function loadMediaList() {
  mediaGrid.innerHTML = `<div class="panel-desc" style="grid-column:1/-1;">Загрузка...</div>`;
  const res = await fetch('/admin/api/uploads');
  const list = await res.json();
  if (!list.length) {
    mediaGrid.innerHTML = `<div class="panel-desc" style="grid-column:1/-1;">Медиатека пуста. Загрузите первое изображение.</div>`;
    return;
  }
  mediaGrid.innerHTML = list.map(f => `
    <div class="item" data-url="${esc(f.url)}">
      <img src="${esc(f.url)}" alt="">
      <button class="del" data-name="${esc(f.name)}">×</button>
    </div>
  `).join('');
  mediaGrid.querySelectorAll('.item').forEach(item => {
    item.addEventListener('click', () => {
      if (pickerCallback) pickerCallback(item.dataset.url);
      closeMediaPicker();
    });
  });
  mediaGrid.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Удалить изображение?')) return;
      await fetch('/admin/api/uploads/' + btn.dataset.name, { method: 'DELETE' });
      loadMediaList();
    });
  });
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('image', file);
  try {
    const res = await fetch('/admin/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) {
      showToast('Загружено');
      return data.url;
    } else {
      showToast(data.error || 'Ошибка', true);
    }
  } catch (e) {
    showToast('Ошибка загрузки', true);
  }
}

uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = await uploadFile(file);
  if (url && pickerCallback) {
    pickerCallback(url);
    closeMediaPicker();
  } else {
    loadMediaList();
  }
  uploadInput.value = '';
});

useUrlBtn.addEventListener('click', () => {
  const v = urlInput.value.trim();
  if (!v) return;
  if (pickerCallback) pickerCallback(v);
  closeMediaPicker();
});

/* ─── сохранение ──────────────────────────────────────── */
saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  try {
    const res = await fetch('/admin/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    const data = await res.json();
    if (data.ok) {
      saved = structuredClone(state);
      setDirty();
      showToast('Сохранено');
    } else {
      showToast(data.error || 'Ошибка сохранения', true);
    }
  } catch (e) {
    showToast('Сетевая ошибка', true);
  } finally {
    saveBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Откатить все несохранённые изменения?')) return;
  state = structuredClone(saved);
  setDirty();
  render();
  showToast('Откачено');
});

/* ─── защита от потери ──────────────────────────────── */
window.addEventListener('beforeunload', (e) => {
  if (JSON.stringify(state) !== JSON.stringify(saved)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ─── старт ──────────────────────────────────────────── */
buildAside();
navigate('hero');
setDirty();
