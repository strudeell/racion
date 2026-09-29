// Интерфейс приложения: главный экран, анкета, меню, список покупок.

import { STORES } from './data/stores.js';
import { MEALS, MEAL_NAMES, MEAL_EMOJI, DAY_NAMES, ALLERGENS, STOP_CHIPS, KITCHEN } from './data/dicts.js';
import {
  P, R, makeContext, makePlan, derive, estimateBudget, swapOptions, replaceSlot,
  defaultKcal, peopleCount, newSeed, priceOf, matchStopChip, scaleNutrition,
  amountText, fmtRub, fmtNum, fmtMass, plural,
} from './planner.js';

const KEY = 'nedelka:v1';
const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

// --- Состояние

// others — пол остальных взрослых ('f' / 'm' / null), kids — [{ age, sex }].
const freshAnswers = () => ({
  store: null, adults: 2, others: [null], hasKids: false, kids: [],
  myMeals: [...MEALS], familyMeals: [], sex: null,
  allergies: [], stop: [], kitchen: [], budgetMode: 'none', budget: null,
});
const freshSettings = () => ({ kcal: null, priceAdj: 0, batch: true, staplesInTotal: false });

// Список остальных взрослых всегда на одного меньше, чем взрослых всего.
function syncOthers(a) {
  a.others = (Array.isArray(a.others) ? a.others : []).slice(0, Math.max(0, a.adults - 1));
  while (a.others.length < a.adults - 1) a.others.push(null);
  return a;
}

// Ответы из первой версии: у детей был только возраст.
function migrate(a) {
  a.kids = (a.kids || []).map(k => (typeof k === 'number' ? { age: k, sex: null } : k));
  return syncOthers(a);
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) {
      return {
        answers: migrate({ ...freshAnswers(), ...s.answers }),
        settings: { ...freshSettings(), ...s.settings },
        plan: s.plan || null,
        checked: s.checked || {},
        prices: s.prices || {},
        tipClosed: !!s.tipClosed,
      };
    }
  } catch { /* повреждённые данные — начинаем заново */ }
  return { answers: freshAnswers(), settings: freshSettings(), plan: null, checked: {}, prices: {}, tipClosed: false };
}

let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* приватный режим — просто не сохраняем */ }
}

const view = { screen: S.plan ? 'result' : 'landing', step: 0, tab: 'menu' };
let cache = null;
let budgetEst = null;
let budgetEstKey = '';
let sheetOpen = false;
let ignorePop = false;
let depth = 0;
let installEvt = null;

const ctxNow = () => makeContext(S.answers, S.settings, S.prices);
function derived() {
  if (!cache) {
    const ctx = ctxNow();
    cache = { ctx, d: derive(ctx, S.plan) };
  }
  return cache;
}
const invalidate = () => { cache = null; };
const budgetOf = () => (S.answers.budgetMode === 'limit' && S.answers.budget > 0 ? S.answers.budget : null);

// --- Мелочи

const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const toggleIn = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); };
const people = n => `${n} ${plural(n, ['человека', 'человек', 'человек'])}`;
const years = n => `${n} ${plural(n, ['год', 'года', 'лет'])}`;

let toastTimer;
function toast(text) {
  $toast.textContent = text;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
}

// --- Иконки

const Logo = (s = 28) => `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC061"/><stop offset="1" stop-color="#FF7A4D"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><path d="M13 33h38a19 19 0 0 1-38 0z" fill="#fff"/><rect x="10" y="30" width="44" height="5" rx="2.5" fill="#fff"/><path d="M33 28c-1.5-8.5 4-14.5 13-15.5-.5 9-6 15-13 15.5z" fill="#3E9E66"/><path d="M33 28c-1.5-4-4.5-6.5-9-7.5" stroke="#3E9E66" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const Arrow = () => '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const Back = () => '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const Gear = () => '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SwapIcon = () => '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4L3 8l4 4M3 8h13a4 4 0 0 1 4 4M17 20l4-4-4-4M21 16H8a4 4 0 0 1-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const StoreBadge = (s, size = 40) => `<span class="badge" style="--c:${s.color};--i:${s.ink || '#fff'};--s:${size}px" aria-hidden="true">${s.badge}</span>`;

// --- Главный экран

function Landing() {
  const has = !!S.plan;
  return `
  <main class="screen landing">
    <header class="brand-top">${Logo(40)}<span>Неделька</span></header>
    <section class="hero">
      <h1>Меню на&nbsp;неделю&nbsp;— без&nbsp;лишних трат и&nbsp;раздумий</h1>
      <p class="lead">Бесплатный план питания под твой магазин, семью и бюджет.</p>
    </section>
    <ol class="how card">
      <li>
        <span class="hi">🛒<em>1</em></span>
        <div><b>Ответь на 8 вопросов</b><small>Магазин, семья, аллергии, бюджет — пара минут.</small>
          <span class="mini-badges">${STORES.slice(0, 9).map(s => StoreBadge(s, 20)).join('')}</span></div>
      </li>
      <li><span class="hi">🥗<em>2</em></span><div><b>Получи меню на 7 дней</b><small>С рецептами, порциями на всех и калориями.</small></div></li>
      <li><span class="hi">🧾<em>3</em></span><div><b>Иди в магазин со списком</b><small>Всё посчитано — ничего лишнего не купишь.</small></div></li>
    </ol>
    <p class="fineprint">Без регистрации и оплаты. Ответы и меню хранятся только на этом устройстве.</p>
  </main>
  <div class="cta-bar">
    ${has
      ? `<button class="btn btn-primary" data-act="openResult">Открыть моё меню ${Arrow()}</button>
         <button class="btn btn-ghost" data-act="start">Составить заново</button>`
      : `<button class="btn btn-primary" data-act="start">Составить меню ${Arrow()}</button>`}
  </div>`;
}

// --- Анкета

const STEPS = [
  { label: 'Магазин', title: 'Где покупаешь продукты?', sub: 'Цены в меню посчитаем для этого магазина.', view: StepStore, valid: a => !!a.store },
  { label: 'Семья', title: 'Для кого готовим?', view: StepPeople, valid: () => true },
  { label: 'Приёмы пищи', title: 'Какие приёмы пищи планируем?', sub: 'Отметь, что готовишь для себя, а&nbsp;что&nbsp;— сразу на&nbsp;всех.', view: StepMeals, valid: a => a.myMeals.length + a.familyMeals.length > 0 },
  {
    label: 'Пол',
    title: a => (hasSharedMeals(a) ? 'Пол каждого, кто ест' : 'Твой пол'),
    sub: a => (hasSharedMeals(a)
      ? 'У женщин и мужчин, девочек и мальчиков разная норма калорий — так порции и КБЖУ будут точнее.'
      : 'От него зависит примерная норма калорий.'),
    view: StepSex,
    valid: sexKnown,
  },
  { label: 'Аллергии', title: 'Есть аллергии?', sub: 'Эти продукты не попадут ни в одно блюдо.', view: StepAllergy, valid: a => a.allergies.length > 0 },
  { label: 'Не любишь', title: 'Что не готовим?', sub: 'Продукты, которые просто не нравятся. Аллергии уже учли.', view: StepStop, valid: () => true },
  { label: 'Кухня', title: 'Что есть на кухне?', sub: 'Рецепты подберём только под твою технику.', view: StepKitchen, valid: a => a.kitchen.length > 0 },
  { label: 'Бюджет', title: 'Бюджет на неделю', sub: 'Подберём блюда так, чтобы уложиться в сумму.', view: StepBudget, valid: a => a.budgetMode === 'none' || a.budget >= 300 },
];

// Меню не только для себя: несколько человек и есть общие приёмы пищи.
function hasSharedMeals(a) {
  return peopleCount(a) > 1 && a.familyMeals.length > 0;
}

function sexKnown(a) {
  if (!a.sex) return false;
  if (!hasSharedMeals(a)) return true;
  return a.others.every(Boolean) && (!a.hasKids || a.kids.every(k => k.sex));
}

function Quiz() {
  const st = STEPS[view.step];
  const last = view.step === STEPS.length - 1;
  const title = typeof st.title === 'function' ? st.title(S.answers) : st.title;
  const sub = typeof st.sub === 'function' ? st.sub(S.answers) : st.sub;
  return `
  <main class="screen quiz">
    <header class="quiz-top">
      <button class="icon-btn" data-act="back" aria-label="Назад">${Back()}</button>
      <div class="brand-mini">${Logo(22)}<span>Неделька</span></div>
      <span></span>
    </header>
    <div class="progress" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i <= view.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="progress-meta"><span>${st.label}</span><span>Шаг ${view.step + 1} из ${STEPS.length}</span></div>
    <h1 class="q-title">${title}</h1>
    ${sub ? `<p class="q-sub">${sub}</p>` : ''}
    <div class="q-body">${st.view(S.answers)}</div>
  </main>
  <div class="cta-bar">
    <button class="btn btn-primary" id="nextBtn" data-act="next" ${st.valid(S.answers) ? '' : 'disabled'}>${last ? 'Посчитать меню' : 'Далее'} ${Arrow()}</button>
  </div>`;
}

function StepStore(a) {
  return `<div class="grid2">${STORES.map(s => `
    <button class="opt store ${a.store === s.id ? 'sel' : ''}" data-act="pickStore" data-id="${s.id}" aria-pressed="${a.store === s.id}">
      ${StoreBadge(s)}<b>${s.name}</b><small>${s.tier}</small>
    </button>`).join('')}</div>`;
}

function StepPeople(a) {
  const n = peopleCount(a);
  return `
  <div class="card counter-card">
    <div class="counter-label">Взрослые</div>
    <div class="counter">
      <button class="round" data-act="adults" data-d="-1" ${a.adults <= 1 ? 'disabled' : ''} aria-label="Меньше взрослых">−</button>
      <output aria-live="polite">${a.adults}</output>
      <button class="round" data-act="adults" data-d="1" ${a.adults >= 8 ? 'disabled' : ''} aria-label="Больше взрослых">+</button>
    </div>
    <p class="hint">От этого зависят порции и объём покупок</p>
  </div>
  <div class="card row-card">
    <div><b>Есть дети?</b><small>Порции поменьше, блюда без острого</small></div>
    <button class="switch ${a.hasKids ? 'on' : ''}" role="switch" aria-checked="${a.hasKids}" aria-label="Есть дети" data-act="toggleKids"><i></i></button>
  </div>
  ${a.hasKids ? `<div class="card kids">
    ${a.kids.map(({ age }, i) => `
      <div class="kid-row">
        <span>Ребёнок ${i + 1}</span>
        <div class="mini-counter">
          <button data-act="kidAge" data-i="${i}" data-d="-1" ${age <= 1 ? 'disabled' : ''} aria-label="Младше">−</button>
          <output>${years(age)}</output>
          <button data-act="kidAge" data-i="${i}" data-d="1" ${age >= 17 ? 'disabled' : ''} aria-label="Старше">+</button>
        </div>
        <button class="x" data-act="kidRemove" data-i="${i}" aria-label="Убрать ребёнка">×</button>
      </div>`).join('')}
    ${a.kids.length < 6 ? '<button class="link-btn" data-act="kidAdd">＋ Добавить ребёнка</button>' : ''}
  </div>` : ''}
  <div class="note"><span>🍽️</span><div><b>Готовим на ${people(n)}</b><small>${n > 1
    ? `Общие блюда — сразу ${n} ${plural(n, ['порция', 'порции', 'порций'])} за одну готовку.`
    : 'Все блюда — одна порция для тебя.'}</small></div></div>`;
}

function StepMeals(a) {
  const fam = peopleCount(a) > 1;
  const row = (list, m, label, act) => `
    <button class="check-row ${list.includes(m) ? 'on' : ''}" data-act="${act}" data-m="${m}" aria-pressed="${list.includes(m)}">
      <span class="ce">${MEAL_EMOJI[m]}</span><span class="cl">${label}</span><i class="box"></i>
    </button>`;
  const famLabels = { breakfast: 'Общие завтраки', lunch: 'Общие обеды', dinner: 'Общие ужины' };
  const hint = !fam ? 'Все блюда — одна порция для тебя.'
    : a.familyMeals.length ? 'Общие приёмы пищи готовим сразу на всех, остальное — порция для тебя.'
      : 'Всё меню будет только для тебя, без общих блюд.';
  return `
  <div class="group-label">Для тебя</div>
  <div class="card list">${MEALS.map(m => row(a.myMeals, m, MEAL_NAMES[m], 'toggleMy')).join('')}</div>
  ${fam ? `<div class="group-label">Для всей семьи</div>
  <div class="card list">${MEALS.map(m => row(a.familyMeals, m, famLabels[m], 'toggleFam')).join('')}</div>` : ''}
  <div class="note"><span>⏰</span><div><small>${hint}</small></div></div>`;
}

function StepSex(a) {
  const shared = hasSharedMeals(a);
  const mine = `<div class="grid2">${[['f', '👩', 'Женский'], ['m', '👨', 'Мужской']].map(([id, e, t]) => `
    <button class="opt ${shared ? 'compact' : 'big'} ${a.sex === id ? 'sel' : ''}" data-act="pickSex" data-id="${id}" aria-pressed="${a.sex === id}">
      <span class="emoji-lg">${e}</span><b>${t}</b>
    </button>`).join('')}</div>`;
  if (!shared) return mine;

  const seg = (act, i, value, options) => `<div class="seg" role="group">${options.map(([v, e, t]) => `
    <button class="${value === v ? 'on' : ''}" data-act="${act}" data-i="${i}" data-sex="${v}" aria-pressed="${value === v}">${e} ${t}</button>`).join('')}</div>`;
  const adults = a.others.map((sex, i) => `
    <div class="sex-row">
      <span>${a.adults === 2 ? 'Второй взрослый' : `Взрослый ${i + 2}`}</span>
      ${seg('setOtherSex', i, sex, [['f', '👩', 'Женщина'], ['m', '👨', 'Мужчина']])}
    </div>`).join('');
  const kids = a.hasKids ? a.kids.map((k, i) => `
    <div class="sex-row">
      <span>Ребёнок ${i + 1} · ${years(k.age)}</span>
      ${seg('setKidSex', i, k.sex, [['f', '👧', 'Девочка'], ['m', '👦', 'Мальчик']])}
    </div>`).join('') : '';
  return `
  <div class="group-label">Ты</div>
  ${mine}
  ${adults ? `<div class="group-label">Остальные взрослые</div><div class="card sex-list">${adults}</div>` : ''}
  ${kids ? `<div class="group-label">Дети</div><div class="card sex-list">${kids}</div>` : ''}`;
}

function StepAllergy(a) {
  return `<div class="grid2 tight">${[['none', 'Нет аллергий', '🌿'], ...ALLERGENS].map(([id, t, e]) => `
    <button class="opt ${a.allergies.includes(id) ? 'sel' : ''}" data-act="toggleAllergy" data-id="${id}" aria-pressed="${a.allergies.includes(id)}">
      <span class="emoji-md">${e}</span><b>${t}</b>
    </button>`).join('')}</div>
  <p class="fineprint">Всё равно проверяй состав на упаковке: следы аллергенов бывают в неожиданных продуктах.</p>`;
}

function StepStop(a) {
  const chosen = new Set(a.stop.map(x => x.text.toLowerCase()));
  const sugg = STOP_CHIPS.filter(([t]) => !chosen.has(t.toLowerCase()));
  return `
  <form class="add-row" data-form="stop">
    <input id="stopInput" type="text" placeholder="Например, баклажаны" autocomplete="off" enterkeyhint="done" maxlength="40" aria-label="Продукт, который не любишь">
    <button class="round add" type="submit" aria-label="Добавить">+</button>
  </form>
  ${a.stop.length ? `<div class="chips">${a.stop.map((x, i) => `<button class="chip sel" data-act="stopRemove" data-i="${i}" aria-label="Убрать ${esc(x.text)}">${esc(x.text)} <span aria-hidden="true">×</span></button>`).join('')}</div>` : ''}
  ${sugg.length ? `<div class="group-label">Часто исключают</div>
  <div class="chips">${sugg.map(([t, tag]) => `<button class="chip" data-act="stopAdd" data-text="${t}" data-tag="${tag}">＋ ${t}</button>`).join('')}</div>` : ''}
  <p class="fineprint">Шаг можно пропустить.</p>`;
}

function StepKitchen(a) {
  return `<div class="grid2 tight">${KITCHEN.map(([id, t, e]) => `
    <button class="opt ${a.kitchen.includes(id) ? 'sel' : ''}" data-act="toggleKitchen" data-id="${id}" aria-pressed="${a.kitchen.includes(id)}">
      <span class="emoji-md">${e}</span><b>${t}</b>
    </button>`).join('')}</div>`;
}

function StepBudget(a) {
  const limit = a.budgetMode === 'limit';
  return `
  <button class="opt wide ${!limit ? 'sel' : ''}" data-act="budgetMode" data-mode="none" aria-pressed="${!limit}">
    <span class="radio"></span><div><b>Без ограничений</b><small>Просто подберём недорогие блюда</small></div>
  </button>
  <button class="opt wide ${limit ? 'sel' : ''}" data-act="budgetMode" data-mode="limit" aria-pressed="${limit}">
    <span class="radio"></span><div><b>Уложиться в сумму</b><small>Подберём блюда под твой лимит</small></div>
  </button>
  ${limit ? `<div class="card budget-card">
    <label for="budgetInput" class="field-label">Сколько готовы потратить за неделю</label>
    <div class="money"><input id="budgetInput" type="number" inputmode="numeric" min="300" step="100" value="${a.budget ?? ''}" placeholder="${budgetEst ? budgetEst.typical : 5000}"><span>₽</span></div>
    <div class="chips" id="budgetChips">${BudgetChips()}</div>
  </div>` : ''}
  <div class="note" id="budgetNote">${BudgetNote()}</div>`;
}

function BudgetChips() {
  if (!budgetEst) return '';
  return [[budgetEst.min, 'минимум'], [budgetEst.typical, 'обычно']]
    .map(([v, t]) => `<button class="chip" data-act="budgetSet" data-v="${v}">≈ ${fmtRub(v)} · ${t}</button>`).join('');
}

function BudgetNote() {
  const store = STORES.find(s => s.id === S.answers.store) || STORES[0];
  if (!budgetEst) return '<span>💰</span><div><small>Считаем, сколько обычно стоит такое меню…</small></div>';
  return `<span>💰</span><div><small>В магазине «${store.name}» такое меню обычно стоит около <b>${fmtRub(budgetEst.typical)}</b> в неделю, самый экономный вариант — около <b>${fmtRub(budgetEst.min)}</b>.</small></div>`;
}

// Считаем оценку бюджета после отрисовки, чтобы экран не подвисал.
function refreshBudgetEstimate() {
  const { budget, budgetMode, ...rest } = S.answers;
  const key = JSON.stringify([rest, S.settings]);
  if (budgetEst && key === budgetEstKey) return;
  budgetEst = null;
  setTimeout(() => {
    budgetEst = estimateBudget(ctxNow());
    budgetEstKey = key;
    if (view.screen !== 'quiz' || view.step !== STEPS.length - 1) return;
    const note = document.getElementById('budgetNote');
    if (note) note.innerHTML = BudgetNote();
    const chips = document.getElementById('budgetChips');
    if (chips) chips.innerHTML = BudgetChips();
    const input = document.getElementById('budgetInput');
    if (input) input.placeholder = budgetEst.typical;
  }, 30);
}

// --- Экран «Собираем меню»

const LOAD_STEPS = ['Учитываем ответы', 'Подбираем блюда под технику', 'Считаем корзину по ценам', 'Меню готово'];

function Loading() {
  return `
  <main class="screen loading">
    <div class="brand-mini">${Logo(22)}<span>Неделька</span></div>
    <div class="loader-emoji" aria-hidden="true">🥗</div>
    <h1>Собираем меню…</h1>
    <ul class="load-steps">${LOAD_STEPS.map((t, i) => `<li data-i="${i}"><i></i>${t}</li>`).join('')}</ul>
  </main>`;
}

function animateLoading(done) {
  const items = [...document.querySelectorAll('.load-steps li')];
  let i = 0;
  const tick = () => {
    items.forEach((li, j) => {
      li.classList.toggle('done', j < i);
      li.classList.toggle('active', j === i);
    });
    if (i >= items.length) { setTimeout(done, 350); return; }
    i++;
    setTimeout(tick, 620);
  };
  tick();
}

// --- Результат

function Result() {
  const { ctx, d } = derived();
  const shared = hasSharedMeals(S.answers);
  const n = shared ? peopleCount(S.answers) : 1;
  const unknownSex = shared && ctx.people.some((p, j) => j > 0 && !p.sex);
  const budget = budgetOf();
  const count = d.list.groups.reduce((s, g) => s + g.items.length, 0);
  return `
  <main class="screen result">
    <header class="res-top">
      <div class="brand-mini">${Logo(24)}<span>Неделька</span></div>
      <button class="icon-btn" data-act="settings" aria-label="Настройки">${Gear()}</button>
    </header>
    <section class="summary card">
      <h1>Меню на неделю</h1>
      <div class="sum-grid">
        <div>${StoreBadge(ctx.store, 30)}<span><small>Магазин</small><b>${ctx.store.name}</b></span></div>
        <div><span class="se">👥</span><span><small>Готовим на</small><b>${people(n)}</b></span></div>
        <div><span class="se">🔥</span><span><small>Твоя норма</small><b>${fmtNum(ctx.eaters.me[0])} ккал</b></span></div>
        <div><span class="se">🛒</span><span><small>Корзина</small><b>≈ ${fmtRub(d.total)}</b></span></div>
      </div>
      ${shared ? `<p class="norms">Нормы калорий в день: ${ctx.people.map(p => `${p.label} — ${fmtNum(p.kcal)}`).join(' · ')}</p>` : ''}
      ${unknownSex ? '<p class="warn">Укажи пол каждого, кто ест, — порции станут точнее. <button class="link-btn inline" data-act="editSex">Указать</button></p>' : ''}
      ${budget ? (d.total <= budget
        ? `<p class="banner ok">✓ Уложились в бюджет: ${fmtRub(d.total)} из ${fmtRub(budget)}</p>`
        : `<p class="banner over">Корзина на ${fmtRub(d.total - budget)} дороже бюджета (${fmtRub(budget)}). Замени пару блюд на те, что с зелёной ценой, или собери меню заново.</p>`) : ''}
      ${d.repeats ? '<p class="warn">Под твои условия подходит немного блюд, поэтому некоторые повторяются.</p>' : ''}
      ${d.missing ? '<p class="warn">Для части приёмов пищи не нашлось блюд. Отметь больше техники или убери часть ограничений.</p>' : ''}
    </section>
    ${S.tipClosed ? '' : `
    <div class="tip card">
      <span aria-hidden="true">📲</span>
      <div><b>Установи на телефон</b><small>Будет работать даже без интернета. <button class="link-btn inline" data-act="installHow">Как?</button></small></div>
      <button class="x" data-act="closeTip" aria-label="Скрыть подсказку">×</button>
    </div>`}
    <div class="tabs-wrap">
      <nav class="tabs" role="tablist">
        <button role="tab" aria-selected="${view.tab === 'menu'}" class="${view.tab === 'menu' ? 'on' : ''}" data-act="tab" data-tab="menu">Меню</button>
        <button role="tab" aria-selected="${view.tab === 'shop'}" class="${view.tab === 'shop' ? 'on' : ''}" data-act="tab" data-tab="shop">Покупки <span class="count">${count}</span></button>
      </nav>
    </div>
    ${view.tab === 'menu' ? MenuTab(d) : ShopTab(ctx, d)}
  </main>`;
}

function MenuTab(d) {
  return `${d.days.map(day => `
    <section class="day card">
      <header><h2>${DAY_NAMES[day.d]}</h2>${day.kcal ? `<span class="muted">≈ ${fmtNum(day.kcal)} ккал</span>` : ''}</header>
      ${day.items.map(MealRow).join('')}
    </section>`).join('')}
  <div class="actions">
    <button class="btn btn-soft" data-act="reroll">🔄 Собрать другое меню</button>
    <button class="btn btn-ghost" data-act="editAnswers">Изменить ответы</button>
  </div>`;
}

function MealRow(it) {
  const s = it.s;
  if (it.missing) {
    return `<div class="meal">
      <div class="meal-main"><span class="me">${MEAL_EMOJI[s.meal]}</span><span class="mt"><small>${MEAL_NAMES[s.meal]}</small><b>Нет подходящих блюд</b></span></div>
      <button class="swap" data-act="swap" data-i="${it.i}" aria-label="Выбрать блюдо">${SwapIcon()}</button>
    </div>`;
  }
  const r = it.c.r;
  const who = s.who === 'family' ? `на ${it.people} ${plural(it.people, ['порцию', 'порции', 'порций'])}` : 'для тебя';
  const extra = s.left ? 'осталось со вчера' : s.days === 2 ? `${r.time} мин · сразу на 2 дня` : `${r.time} мин`;
  return `<div class="meal">
    <button class="meal-main" data-act="recipe" data-i="${it.i}">
      <span class="me" aria-hidden="true">${r.emoji}</span>
      <span class="mt"><small>${MEAL_NAMES[s.meal]} · ${who}</small><b>${it.c.name}</b><small>${extra} · ${fmtNum(it.my.kcal)} ккал</small></span>
    </button>
    <button class="swap" data-act="swap" data-i="${it.i}" aria-label="Заменить блюдо «${it.c.name}»">${SwapIcon()}</button>
  </div>`;
}

function ShopTab(ctx, d) {
  const L = d.list;
  const all = L.groups.flatMap(g => g.items);
  const done = all.filter(x => S.checked[x.id]).length;
  return `
  <div class="shop-head card">
    <div><small>Куплено</small><b id="doneCount">${done} из ${all.length}</b></div>
    <div class="right"><small>Итого</small><b>≈ ${fmtRub(L.total)}</b></div>
    <div class="bar"><i id="doneBar" style="width:${all.length ? done / all.length * 100 : 0}%"></i></div>
  </div>
  ${L.groups.map(g => `
    <section class="shop-group card">
      <h2>${g.emoji} ${g.name}</h2>
      ${g.items.map(ShopItem).join('')}
    </section>`).join('')}
  ${L.staples.length ? `
    <details class="shop-group card staples">
      <summary><h2>🧂 Проверь, есть ли дома</h2><small>${ctx.staplesInTotal ? 'в сумме' : 'не в сумме'}</small></summary>
      ${L.staples.map(ShopItem).join('')}
      <p class="fineprint left">И ещё соль, перец и специи из рецептов.</p>
    </details>` : ''}
  <div class="actions">
    <button class="btn btn-primary" data-act="copyList">Скопировать список</button>
    ${navigator.share ? '<button class="btn btn-soft" data-act="shareList">Отправить</button>' : ''}
    ${done ? '<button class="btn btn-ghost" data-act="uncheckAll">Снять все отметки</button>' : ''}
  </div>
  <p class="fineprint">Цены примерные — средние по стране с поправкой на магазин. Нажми на цену, чтобы вписать свою: приложение её запомнит.</p>`;
}

function ShopItem(x) {
  const on = !!S.checked[x.id];
  return `<div class="item ${on ? 'on' : ''}" data-item="${x.id}">
    <button class="item-check" data-act="check" data-id="${x.id}" aria-pressed="${on}">
      <i class="box"></i><span><b>${x.p.name}</b><small>${x.qty}${x.need ? ' · ' + x.need : ''}</small></span>
    </button>
    <button class="price ${x.custom ? 'custom' : ''}" data-act="editPrice" data-id="${x.id}" aria-label="Цена ${fmtRub(x.cost)}, изменить">${fmtRub(x.cost)}</button>
  </div>`;
}

// --- Всплывающие окна

function openSheet(html) {
  $sheet.innerHTML = `<div class="sheet-backdrop" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-bar"><i></i><button class="icon-btn" data-act="closeSheet" aria-label="Закрыть">×</button></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.classList.add('no-scroll');
  if (!sheetOpen) history.pushState({ ...stateOf(), sheet: true }, '');
  sheetOpen = true;
}

function closeSheet(viaHistory = true) {
  if (!sheetOpen) return;
  sheetOpen = false;
  $sheet.innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (viaHistory) {
    ignorePop = true;
    history.back();
  }
}

function findItem(i) {
  return derived().d.days.flatMap(x => x.items).find(x => x.i === i);
}

function openRecipe(i) {
  const it = findItem(i);
  if (!it || it.missing) return;
  const { c, s } = it;
  const r = c.r;
  const days = s.days === 2 || s.left ? 2 : 1;
  const cookMult = it.mult * (s.left ? 2 : s.days);
  const portionsText = `${it.people} ${plural(it.people, ['порция', 'порции', 'порций'])}${days === 2 ? ' × 2 дня' : ''}`;
  const notes = [
    ...c.swapped.map(([a, b]) => `${a} → ${b}`),
    ...(c.removed.length ? [`Убрали: ${c.removed.map(x => x.toLowerCase()).join(', ')}`] : []),
  ];
  openSheet(`
    <div class="sheet-emoji" aria-hidden="true">${r.emoji}</div>
    <h2>${c.name}</h2>
    <p class="muted">⏱ ${r.time} мин · ${portionsText}</p>
    ${s.left ? '<p class="note-inline">Это блюдо приготовлено вчера сразу на 2 дня — просто разогрей.</p>' : days === 2 ? '<p class="note-inline">Готовим сразу на 2 дня: половину убери в холодильник на завтра.</p>' : ''}
    <div class="kbju">
      <div><b>${fmtNum(it.my.kcal)}</b><small>ккал</small></div>
      <div><b>${fmtNum(it.my.p)}</b><small>белки, г</small></div>
      <div><b>${fmtNum(it.my.f)}</b><small>жиры, г</small></div>
      <div><b>${fmtNum(it.my.c)}</b><small>углев., г</small></div>
    </div>
    <p class="caption">на твою порцию</p>
    ${notes.length ? `<div class="chips notes">${notes.map(t => `<span class="chip static">${esc(t)}</span>`).join('')}</div>` : ''}
    ${s.who === 'family' ? `
    <h3>Кому сколько</h3>
    <ul class="ing share">${derived().ctx.people.map((person, j) => {
      const n = scaleNutrition(c.base, it.mults[j]);
      return `<li><span>${person.label}<small>Б ${fmtNum(n.p)} · Ж ${fmtNum(n.f)} · У ${fmtNum(n.c)} г</small></span><b>${fmtNum(n.kcal)} ккал · ${Math.round(it.mults[j] / it.mult * 100)}%</b></li>`;
    }).join('')}</ul>
    <p class="caption left">Процент — какая часть готового блюда достаётся каждому за один приём пищи.</p>` : ''}
    <h3>Продукты</h3>
    <ul class="ing">${c.ings.map(g => `<li><span>${g.p.name}${g.opt ? ' <small>по желанию</small>' : ''}</span><b>${amountText(g.p, g.amt * cookMult)}</b></li>`).join('')}</ul>
    <h3>Как готовить</h3>
    <ol class="steps">${r.steps.map(t => `<li>${t}</li>`).join('')}</ol>
  `);
}

function openSwap(i) {
  const ctx = ctxNow();
  const s = S.plan.slots[i];
  const opts = swapOptions(ctx, S.plan, i).slice(0, 12);
  const deltaText = dl => Math.abs(dl) < 5 ? 'та же цена' : `${dl > 0 ? '+' : '−'}${fmtRub(Math.abs(dl))}`;
  openSheet(`
    <h2>Заменить блюдо</h2>
    <p class="muted">${DAY_NAMES[s.day]}, ${MEAL_NAMES[s.meal].toLowerCase()}. Цена — как изменится вся корзина.</p>
    ${opts.length ? `<div class="swap-list">${opts.map(o => `
      <button class="swap-opt" data-act="doSwap" data-i="${i}" data-rid="${o.c.r.id}">
        <span class="me" aria-hidden="true">${o.c.r.emoji}</span>
        <span class="mt"><b>${o.c.name}</b><small>${o.c.r.time} мин · ${fmtNum(o.myKcal)} ккал${o.used ? ' · уже есть в меню' : ''}</small></span>
        <span class="delta ${o.delta > 4 ? 'up' : o.delta < -4 ? 'down' : ''}">${deltaText(o.delta)}</span>
      </button>`).join('')}</div>`
      : '<p class="note-inline">Других блюд под твои условия нет. Отметь больше техники или убери часть ограничений.</p>'}
  `);
}

function openPrice(id) {
  const ctx = ctxNow();
  const p = P[id];
  const key = ctx.store.id + ':' + id;
  const custom = S.prices[key] != null;
  const unitText = p.byWeight ? '1 кг'
    : p.forms ? `1 ${p.forms[0]}${p.unit === 'г' || p.unit === 'мл' ? ` (${fmtMass(p.pack, p.unit)})` : ''}`
      : `упаковка ${fmtMass(p.pack, p.unit)}`;
  openSheet(`
    <h2>${p.name}</h2>
    <p class="muted">Сколько стоит ${unitText} в магазине «${ctx.store.name}»?</p>
    <form data-form="price" data-id="${id}" class="price-form">
      <div class="money big"><input id="priceInput" type="number" inputmode="decimal" min="0" step="1" value="${priceOf(ctx, p)}" aria-label="Цена в рублях"><span>₽</span></div>
      <button class="btn btn-primary" type="submit">Сохранить</button>
    </form>
    ${custom ? `<button class="btn btn-ghost" data-act="resetPrice" data-id="${id}">Вернуть среднюю цену (${fmtRub(p.price * ctx.k)})</button>` : ''}
  `);
  setTimeout(() => document.getElementById('priceInput')?.select(), 50);
}

const adjText = v => (v === 0 ? 'Как в среднем по стране' : v > 0 ? `На ${v}% дороже средних` : `На ${-v}% дешевле средних`);

function openSettings() {
  const def = defaultKcal(S.answers.sex);
  const hasPrices = Object.keys(S.prices).length > 0;
  openSheet(`
    <h2>Настройки</h2>
    <form data-form="settings" class="settings">
      <label class="field">
        <span>Твоя норма калорий в день</span>
        <div class="money"><input name="kcal" type="number" inputmode="numeric" min="1000" max="4500" step="50" value="${S.settings.kcal ?? ''}" placeholder="${def}"><span>ккал</span></div>
        <small>По умолчанию ${def} — средняя норма для ${S.answers.sex === 'm' ? 'мужчины' : 'женщины'}. От неё зависит размер твоих порций.</small>
      </label>
      <label class="field">
        <span>Цены в моём городе</span>
        <input name="priceAdj" type="range" min="-30" max="30" step="5" value="${S.settings.priceAdj}">
        <small id="adjLabel">${adjText(S.settings.priceAdj)}</small>
      </label>
      <label class="toggle-row">
        <span>Супы и рагу — сразу на 2 дня<small>Меньше готовки. Меню соберётся заново.</small></span>
        <input name="batch" type="checkbox" ${S.settings.batch ? 'checked' : ''}>
      </label>
      <label class="toggle-row">
        <span>Масло, мука и сахар в сумме<small>Обычно они уже есть дома</small></span>
        <input name="staplesInTotal" type="checkbox" ${S.settings.staplesInTotal ? 'checked' : ''}>
      </label>
      <button class="btn btn-primary" type="submit">Сохранить</button>
    </form>
    <div class="actions">
      ${hasPrices ? '<button class="btn btn-soft" data-act="resetPrices">Сбросить мои цены</button>' : ''}
      <button class="btn btn-ghost" data-act="editAnswers">Пройти анкету заново</button>
    </div>
    <p class="fineprint">Неделька — бесплатное приложение без рекламы и регистрации. Все данные хранятся только на этом устройстве.</p>
  `);
}

function openInstallHelp() {
  if (installEvt) {
    installEvt.prompt();
    installEvt.userChoice.finally(() => { installEvt = null; });
    return;
  }
  openSheet(`
    <h2>Как установить</h2>
    <div class="howto">
      <h3>Android</h3>
      <p>Открой меню браузера <b>⋮</b> и выбери <b>«Добавить на главный экран»</b> или <b>«Установить приложение»</b>.</p>
      <h3>iPhone</h3>
      <p>В Safari нажми <b>«Поделиться»</b> (квадрат со стрелкой) и выбери <b>«На экран „Домой“»</b>.</p>
      <p class="muted">После этого Неделька откроется с главного экрана, даже если нет интернета.</p>
    </div>
  `);
}

// --- Список покупок текстом

function listText() {
  const { ctx, d } = derived();
  const lines = ['🛒 Список покупок на неделю', `${ctx.store.name} · ≈ ${fmtRub(d.total)}`, ''];
  for (const g of d.list.groups) {
    lines.push(`${g.name}:`);
    for (const x of g.items) lines.push(`${S.checked[x.id] ? '✓' : '—'} ${x.p.name} — ${x.qty}`);
    lines.push('');
  }
  if (d.list.staples.length) lines.push(`Проверить дома: ${d.list.staples.map(x => x.p.name.toLowerCase()).join(', ')}`);
  return lines.join('\n').trim();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Список скопирован');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Список скопирован'); } catch { toast('Не получилось скопировать'); }
    ta.remove();
  }
}

// --- Действия

function fixFamily() {
  if (peopleCount(S.answers) <= 1) S.answers.familyMeals = [];
}

function addStop(text, tag) {
  text = (text || '').trim().slice(0, 40);
  if (!text) return;
  if (!tag) {
    const chip = matchStopChip(text);
    if (chip) [text, tag] = chip;
  }
  const a = S.answers;
  if (a.stop.some(x => x.text.toLowerCase() === text.toLowerCase())) return;
  a.stop.push(tag ? { text, tag } : { text });
  save();
  render();
}

function buildNewPlan(seed = newSeed()) {
  const ctx = ctxNow();
  S.plan = makePlan(ctx, { seed, budget: budgetOf() });
  S.checked = {};
  save();
  invalidate();
}

function calculate() {
  go({ screen: 'loading' });
  setTimeout(() => {
    buildNewPlan();
    animateLoading(() => {
      view.screen = 'result';
      view.tab = 'menu';
      history.replaceState(stateOf(), '');
      render();
      window.scrollTo(0, 0);
    });
  }, 60);
}

function updateShopProgress() {
  const items = [...document.querySelectorAll('.shop-group:not(.staples) [data-item]')];
  const done = items.filter(el => S.checked[el.dataset.item]).length;
  const count = document.getElementById('doneCount');
  const bar = document.getElementById('doneBar');
  if (count) count.textContent = `${done} из ${items.length}`;
  if (bar) bar.style.width = `${items.length ? done / items.length * 100 : 0}%`;
}

const ACTIONS = {
  start() { go({ screen: 'quiz', step: 0 }); },
  openResult() { go({ screen: 'result' }); },
  back() {
    if (depth > 0) history.back();
    else if (view.step > 0) replace({ step: view.step - 1 });
    else replace({ screen: 'landing' });
  },
  next() {
    if (!STEPS[view.step].valid(S.answers)) return;
    save();
    if (view.step < STEPS.length - 1) go({ step: view.step + 1 });
    else calculate();
  },
  pickStore(t) { S.answers.store = t.dataset.id; save(); render(); },
  adults(t) {
    const a = S.answers;
    a.adults = clamp(a.adults + Number(t.dataset.d), 1, 8);
    syncOthers(a); fixFamily(); save(); render();
  },
  toggleKids() {
    const a = S.answers;
    a.hasKids = !a.hasKids;
    if (a.hasKids && !a.kids.length) a.kids = [{ age: 5, sex: null }];
    fixFamily(); save(); render();
  },
  kidAge(t) { const k = S.answers.kids[Number(t.dataset.i)]; k.age = clamp(k.age + Number(t.dataset.d), 1, 17); save(); render(); },
  kidAdd() { S.answers.kids.push({ age: 5, sex: null }); save(); render(); },
  setOtherSex(t) { S.answers.others[Number(t.dataset.i)] = t.dataset.sex; save(); render(); },
  setKidSex(t) { S.answers.kids[Number(t.dataset.i)].sex = t.dataset.sex; save(); render(); },
  editSex() { go({ screen: 'quiz', step: STEPS.findIndex(st => st.label === 'Пол') }); },
  kidRemove(t) {
    const a = S.answers;
    a.kids.splice(Number(t.dataset.i), 1);
    if (!a.kids.length) a.hasKids = false;
    fixFamily(); save(); render();
  },
  toggleMy(t) { toggleIn(S.answers.myMeals, t.dataset.m); save(); render(); },
  toggleFam(t) { toggleIn(S.answers.familyMeals, t.dataset.m); save(); render(); },
  pickSex(t) { S.answers.sex = t.dataset.id; save(); render(); },
  toggleAllergy(t) {
    const a = S.answers;
    const id = t.dataset.id;
    if (id === 'none') a.allergies = a.allergies.includes('none') ? [] : ['none'];
    else { a.allergies = a.allergies.filter(x => x !== 'none'); toggleIn(a.allergies, id); }
    save(); render();
  },
  stopAdd(t) { addStop(t.dataset.text, t.dataset.tag); },
  stopRemove(t) { S.answers.stop.splice(Number(t.dataset.i), 1); save(); render(); },
  toggleKitchen(t) { toggleIn(S.answers.kitchen, t.dataset.id); save(); render(); },
  budgetMode(t) {
    const a = S.answers;
    a.budgetMode = t.dataset.mode;
    if (a.budgetMode === 'limit' && !a.budget && budgetEst) a.budget = budgetEst.typical;
    save(); render();
    if (a.budgetMode === 'limit') document.getElementById('budgetInput')?.focus();
  },
  budgetSet(t) { S.answers.budget = Number(t.dataset.v); save(); render(); },

  tab(t) { view.tab = t.dataset.tab; history.replaceState(stateOf(), ''); render(); },
  recipe(t) { openRecipe(Number(t.dataset.i)); },
  swap(t) { openSwap(Number(t.dataset.i)); },
  doSwap(t) {
    const i = Number(t.dataset.i);
    S.plan = replaceSlot(ctxNow(), S.plan, i, t.dataset.rid);
    save(); invalidate(); closeSheet(); render();
    toast(`Заменили на «${findItem(i)?.c?.name || R[t.dataset.rid].name}»`);
  },
  reroll() { buildNewPlan(); render(); toast('Собрали новое меню'); },
  editAnswers() { closeSheet(false); go({ screen: 'quiz', step: 0 }); },
  check(t) {
    const id = t.dataset.id;
    if (S.checked[id]) delete S.checked[id]; else S.checked[id] = true;
    save();
    const row = t.closest('.item');
    row.classList.toggle('on', !!S.checked[id]);
    t.setAttribute('aria-pressed', String(!!S.checked[id]));
    updateShopProgress();
  },
  uncheckAll() { S.checked = {}; save(); render(); },
  editPrice(t) { openPrice(t.dataset.id); },
  resetPrice(t) {
    delete S.prices[S.answers.store + ':' + t.dataset.id];
    save(); invalidate(); closeSheet(); render();
  },
  resetPrices() { S.prices = {}; save(); invalidate(); closeSheet(); render(); toast('Цены сброшены'); },
  copyList() { copyText(listText()); },
  shareList() { navigator.share({ title: 'Список покупок', text: listText() }).catch(() => {}); },
  settings() { openSettings(); },
  closeSheet() { closeSheet(); },
  closeTip() { S.tipClosed = true; save(); render(); },
  installHow() { openInstallHelp(); },
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t, e);
});

document.addEventListener('submit', e => {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'stop') {
    const input = form.querySelector('input');
    addStop(input.value);
    document.getElementById('stopInput')?.focus();
  } else if (form.dataset.form === 'price') {
    const v = Number(form.querySelector('input').value);
    if (Number.isFinite(v) && v >= 0) {
      S.prices[S.answers.store + ':' + form.dataset.id] = Math.round(v * 100) / 100;
      save(); invalidate(); closeSheet(); render();
      toast('Цена сохранена');
    }
  } else if (form.dataset.form === 'settings') {
    const f = new FormData(form);
    const kcal = Number(f.get('kcal'));
    const next = {
      kcal: kcal >= 1000 && kcal <= 4500 ? Math.round(kcal) : null,
      priceAdj: Number(f.get('priceAdj')) || 0,
      batch: f.get('batch') === 'on',
      staplesInTotal: f.get('staplesInTotal') === 'on',
    };
    const rebuild = next.batch !== S.settings.batch;
    S.settings = next;
    if (rebuild && S.plan) buildNewPlan(S.plan.seed);
    save(); invalidate(); closeSheet(); render();
    toast('Сохранено');
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'budgetInput') {
    const v = Number(e.target.value);
    S.answers.budget = v > 0 ? Math.round(v) : null;
    save();
    const btn = document.getElementById('nextBtn');
    if (btn) btn.disabled = !STEPS[view.step].valid(S.answers);
  } else if (e.target.name === 'priceAdj') {
    const label = document.getElementById('adjLabel');
    if (label) label.textContent = adjText(Number(e.target.value));
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheetOpen) closeSheet();
});

// --- Навигация (кнопка «назад» телефона работает как надо)

function stateOf() {
  return { screen: view.screen, step: view.step, tab: view.tab };
}

function go(next) {
  Object.assign(view, next);
  history.pushState(stateOf(), '');
  depth++;
  render();
  window.scrollTo(0, 0);
}

function replace(next) {
  Object.assign(view, next);
  history.replaceState(stateOf(), '');
  render();
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', e => {
  if (ignorePop) { ignorePop = false; return; }
  if (sheetOpen) { closeSheet(false); return; }
  depth = Math.max(0, depth - 1);
  const st = e.state;
  if (!st || !st.screen) return;
  Object.assign(view, { screen: st.screen, step: st.step || 0, tab: st.tab || 'menu' });
  if (view.screen === 'loading') view.screen = S.plan ? 'result' : 'quiz';
  if (view.screen === 'result' && !S.plan) view.screen = 'landing';
  render();
  window.scrollTo(0, 0);
});

// --- Отрисовка

let lastScreenKey = '';

function render() {
  if (view.screen === 'result' && !S.plan) view.screen = 'landing';
  if (view.screen === 'landing') $app.innerHTML = Landing();
  else if (view.screen === 'quiz') $app.innerHTML = Quiz();
  else if (view.screen === 'loading') $app.innerHTML = Loading();
  else if (view.screen === 'result') $app.innerHTML = Result();
  // Плавное появление — только при переходе на другой экран или шаг, а не при каждом нажатии.
  const key = `${view.screen}:${view.step}:${view.tab}`;
  if (key !== lastScreenKey) $app.querySelector('.screen')?.classList.add('enter');
  lastScreenKey = key;
  if (view.screen === 'quiz' && view.step === STEPS.length - 1) refreshBudgetEstimate();
}

// --- Запуск

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvt = e;
});

// На своём компьютере (localhost) офлайн-режим выключен, чтобы правки были видны сразу; включить: ?sw
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isLocal) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

history.replaceState(stateOf(), '');
render();
