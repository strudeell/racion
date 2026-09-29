// Составление меню: подбор блюд, размер порций, список покупок и цены.
// Работает без интернета и без сервера — всё считается прямо в браузере.

import { PRODUCTS } from './data/products.js';
import { RECIPES } from './data/recipes.js';
import { STORES } from './data/stores.js';
import { MEALS, MEAL_SHARE, DEPTS, STOP_CHIPS } from './data/dicts.js';

export const P = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export const R = Object.fromEntries(RECIPES.map(r => [r.id, r]));

const OTHER_ADULT_KCAL = 2100;
const MIN_PORTION = 0.5;
const MAX_PORTION = 1.8;
const REPEAT_PENALTY = 450; // «штраф» в рублях за повтор блюда в неделе
const KIND_PENALTY = 150;   // за похожее блюдо (два плова, три пасты)

// Похожие блюда начинаются с одного слова: «Плов с курицей» и «Плов со свининой».
const kindOf = r => r.name.toLowerCase().split(/[\s,]/)[0];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = arr => arr.reduce((s, x) => s + x, 0);

export function defaultKcal(sex) {
  return sex === 'm' ? 2300 : 1800;
}

export function kidKcal(age) {
  if (age <= 3) return 1200;
  if (age <= 6) return 1450;
  if (age <= 10) return 1800;
  if (age <= 13) return 2100;
  return 2400;
}

export function peopleCount(a) {
  return a.adults + (a.hasKids ? a.kids.length : 0);
}

export function newSeed() {
  return Math.floor(Math.random() * 2147483647);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Поиск «нелюбимых» продуктов по тексту

const norm = s => s.toLowerCase().replace(/ё/g, 'е').trim();

export function stem(word) {
  const w = norm(word);
  const s = w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ов|ев|ей|ой|ый|ий|ая|яя|ое|ее|ые|ие|ах|ях|ам|ям|ом|ем|ы|и|а|я|о|е|у|ю|ь)$/, '');
  return s.length >= 3 ? s : w;
}

// Если человек вписал слово, похожее на готовый вариант («свинину»), берём готовый тег.
export function matchStopChip(text) {
  const st = stem(text);
  return STOP_CHIPS.find(([label]) => stem(label) === st) || null;
}

// --- Контекст: всё, что нужно знать о человеке для подбора меню

export function makeContext(answers, settings = {}, prices = {}) {
  const a = answers;
  const store = STORES.find(s => s.id === a.store) || STORES[0];
  const allergies = new Set(a.allergies.filter(x => x !== 'none'));
  const stopTags = new Set();
  const stopStems = [];
  for (const item of a.stop) {
    if (item.tag) stopTags.add(item.tag);
    else stopStems.push(norm(item.text).split(/\s+/).filter(Boolean).map(stem));
  }
  const noSpicy = stopTags.has('spicy') || stopStems.some(ws => ws.some(w => w.length >= 3 && 'острое'.startsWith(w)));

  const me = settings.kcal || defaultKcal(a.sex);
  const others = [];
  for (let i = 1; i < a.adults; i++) others.push(OTHER_ADULT_KCAL);
  const hasKids = a.hasKids && a.kids.length > 0;
  if (hasKids) for (const age of a.kids) others.push(kidKcal(age));
  const family = others.length > 0;

  const slotSpec = [];
  for (let day = 0; day < 7; day++) {
    for (const meal of MEALS) {
      if (family && a.familyMeals.includes(meal)) slotSpec.push({ day, meal, who: 'family' });
      else if (a.myMeals.includes(meal)) slotSpec.push({ day, meal, who: 'me' });
    }
  }

  return {
    answers: a,
    store,
    k: store.k * (1 + (settings.priceAdj || 0) / 100),
    prices: prices || {},
    kitchen: new Set(a.kitchen),
    allergies,
    stopTags,
    stopStems,
    noSpicy,
    eaters: { me: [me], family: [me, ...others] },
    hasKids,
    slotSpec,
    batch: settings.batch !== false,
    staplesInTotal: !!settings.staplesInTotal,
    _prep: new Map(),
    _cands: new Map(),
  };
}

// --- Продукты: можно ли, чем заменить

function productBlock(ctx, p) {
  for (const al of p.al || []) if (ctx.allergies.has(al)) return 'allergy';
  for (const t of p.tags || []) if (ctx.stopTags.has(t)) return 'stop';
  if (ctx.noSpicy && (p.tags || []).includes('spicy')) return 'stop';
  if (ctx.stopStems.length) {
    const text = norm(p.name + ' ' + (p.aka || ''));
    for (const ws of ctx.stopStems) if (ws.length && ws.every(w => text.includes(w))) return 'stop';
  }
  return null;
}

function resolve(ctx, id) {
  const p = P[id];
  if (!p) return { blocked: 'unknown' };
  const why = productBlock(ctx, p);
  if (!why) return { p };
  const alt = p.alt && P[p.alt];
  if (alt && !productBlock(ctx, alt)) return { p: alt, from: p };
  return { blocked: why, p };
}

export function equipOk(expr, kitchen) {
  if (!expr) return true;
  return expr.split('+').every(group => group.split('|').some(x => kitchen.has(x.trim())));
}

function gramsOf(p, amt) {
  return (p.gpu ? amt * p.gpu : amt) * (1 - (p.waste || 0));
}

function nutritionOf(ings) {
  const n = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const { p, amt } of ings) {
    const g = gramsOf(p, amt) / 100;
    n.kcal += p.kcal * g;
    n.p += p.p * g;
    n.f += p.f * g;
    n.c += p.c * g;
  }
  return n;
}

export function scaleNutrition(n, k) {
  return { kcal: n.kcal * k, p: n.p * k, f: n.f * k, c: n.c * k };
}

function proteinOf(ings) {
  for (const { p } of ings) {
    const t = p.tags || [];
    if (t.includes('chicken')) return 'chicken';
    if (t.includes('pork') || t.includes('beef')) return 'meat';
    if ((p.al || []).some(x => x === 'fish' || x === 'seafood')) return 'fish';
  }
  return null;
}

// Рецепт, подогнанный под человека: без запрещённых продуктов, с заменами.
// Возвращает null, если блюдо не подходит.
export function prep(ctx, rid, kids = false) {
  const key = rid + (kids ? ':kids' : '');
  if (!ctx._prep.has(key)) ctx._prep.set(key, prepare(ctx, R[rid], kids));
  return ctx._prep.get(key);
}

function prepare(ctx, r, kids) {
  if (!r) return null;
  if (!equipOk(r.equip, ctx.kitchen)) return null;
  if (r.spicy && (ctx.noSpicy || kids)) return null;
  if (kids && r.kid === false) return null;
  const ings = [];
  const removed = [];
  const swapped = [];
  for (const [id, amt, flag] of r.ing) {
    const opt = flag === 'opt';
    const res = resolve(ctx, id);
    const spicyForKids = kids && res.p && (res.p.tags || []).includes('spicy');
    if (res.blocked || spicyForKids) {
      if (!opt) return null;
      if (res.p) removed.push(res.p.name);
      continue;
    }
    if (res.from) swapped.push([res.from.name, res.p.name]);
    ings.push({ p: res.p, amt, opt });
  }
  const base = nutritionOf(ings);
  if (base.kcal < 50) return null;
  return { r, ings, removed, swapped, base, protein: proteinOf(ings) };
}

export function candidates(ctx, meal, who) {
  const key = meal + ':' + who;
  if (!ctx._cands.has(key)) {
    const kids = who === 'family' && ctx.hasKids;
    const list = RECIPES.filter(r => r.meals.includes(meal)).map(r => prep(ctx, r.id, kids)).filter(Boolean);
    ctx._cands.set(key, list);
  }
  return ctx._cands.get(key);
}

export function slotPrep(ctx, s) {
  return s.rid ? prep(ctx, s.rid, s.who === 'family' && ctx.hasKids) : null;
}

// Множители порций для каждого, кто ест: 1 — стандартная взрослая порция.
export function portions(ctx, s, c) {
  const share = MEAL_SHARE[s.meal];
  const eaters = s.who === 'family' ? ctx.eaters.family : ctx.eaters.me;
  return eaters.map(kcal => clamp(kcal * share / c.base.kcal, MIN_PORTION, MAX_PORTION));
}

// --- Цены и покупки

export function priceOf(ctx, p) {
  const custom = ctx.prices[ctx.store.id + ':' + p.id];
  if (custom != null) return custom;
  return Math.round(p.price * ctx.k);
}

export function purchase(ctx, p, amt) {
  const price = priceOf(ctx, p);
  if (p.byWeight) {
    if (p.gpu) {
      const n = Math.max(1, Math.ceil(amt - 0.15));
      return { n, grams: n * p.gpu, cost: n * p.gpu / 1000 * price };
    }
    const grams = Math.max(50, Math.ceil(amt / 50) * 50);
    return { grams, cost: grams / 1000 * price };
  }
  const packs = Math.max(1, Math.ceil(amt / p.pack - 0.05));
  return { packs, cost: packs * price };
}

function costOf(ctx, p, amt) {
  if (amt <= 0.001 || p.free || (p.staple && !ctx.staplesInTotal)) return 0;
  return purchase(ctx, p, amt).cost;
}

function addNeed(need, c, mult) {
  for (const { p, amt } of c.ings) need.set(p.id, (need.get(p.id) || 0) + amt * mult);
}

// Насколько подорожает корзина, если добавить блюдо (с учётом уже открытых упаковок).
function addedCost(ctx, need, c, mult) {
  let d = 0;
  for (const { p, amt } of c.ings) {
    const cur = need.get(p.id) || 0;
    d += costOf(ctx, p, cur + amt * mult) - costOf(ctx, p, cur);
  }
  return d;
}

function replaceCost(ctx, need, oldC, oldMult, newC, newMult) {
  const change = new Map();
  for (const { p, amt } of oldC.ings) change.set(p.id, (change.get(p.id) || 0) - amt * oldMult);
  for (const { p, amt } of newC.ings) change.set(p.id, (change.get(p.id) || 0) + amt * newMult);
  let d = 0;
  for (const [id, ch] of change) {
    const cur = need.get(id) || 0;
    d += costOf(ctx, P[id], cur + ch) - costOf(ctx, P[id], cur);
  }
  return d;
}

function needOf(ctx, plan) {
  const need = new Map();
  for (const s of plan.slots) {
    if (!s.rid || s.left) continue;
    const c = slotPrep(ctx, s);
    if (c) addNeed(need, c, sum(portions(ctx, s, c)) * s.days);
  }
  return need;
}

function totalOf(ctx, need) {
  let t = 0;
  for (const [id, amt] of need) t += costOf(ctx, P[id], amt);
  return t;
}

export function planTotal(ctx, plan) {
  return totalOf(ctx, needOf(ctx, plan));
}

function countUses(plan) {
  const m = new Map();
  for (const s of plan.slots) if (s.rid && !s.left) m.set(s.rid, (m.get(s.rid) || 0) + 1);
  return m;
}

// --- Составление меню

function nextDaySlot(slots, i) {
  const s = slots[i];
  const j = slots.findIndex(o => o.day === s.day + 1 && o.meal === s.meal);
  return j >= 0 && slots[j].who === s.who && !slots[j].rid ? j : -1;
}

export function generatePlan(ctx, { seed = newSeed(), costW = 1, noise = 120 } = {}) {
  const rnd = mulberry32(seed);
  const slots = ctx.slotSpec.map(s => ({ ...s, rid: null, days: 1, left: false }));
  const need = new Map();
  const used = new Map();
  const kinds = new Map();
  let prevProtein = null;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.rid) continue;
    const cands = candidates(ctx, s.meal, s.who);
    if (!cands.length) continue;
    const next = ctx.batch ? nextDaySlot(slots, i) : -1;
    let best = null;
    for (const c of cands) {
      const mult = sum(portions(ctx, s, c));
      const days = c.r.batch === 2 && next >= 0 ? 2 : 1;
      let score = -(addedCost(ctx, need, c, mult * days) / days) * costW + rnd() * noise;
      score -= (used.get(c.r.id) || 0) * REPEAT_PENALTY;
      score -= (kinds.get(kindOf(c.r)) || 0) * KIND_PENALTY;
      if (slots.some(o => o.day === s.day && o.rid === c.r.id)) score -= 3000;
      if (s.meal !== 'breakfast' && c.protein && c.protein === prevProtein) score -= 70;
      if (!best || score > best.score) best = { c, mult, days, score };
    }
    s.rid = best.c.r.id;
    s.days = best.days;
    addNeed(need, best.c, best.mult * best.days);
    used.set(s.rid, (used.get(s.rid) || 0) + 1);
    kinds.set(kindOf(best.c.r), (kinds.get(kindOf(best.c.r)) || 0) + 1);
    if (best.days === 2) Object.assign(slots[next], { rid: s.rid, left: true });
    if (s.meal !== 'breakfast') prevProtein = best.c.protein;
  }
  return { seed, slots };
}

// Заменяет дешёвыми блюдами, пока меню не уложится в бюджет. Возвращает итоговую сумму.
function fitBudget(ctx, plan, budget, maxIter = 80) {
  const need = needOf(ctx, plan);
  let total = totalOf(ctx, need);
  for (let it = 0; it < maxIter && total > budget; it++) {
    const uses = countUses(plan);
    let best = null;
    plan.slots.forEach((s, i) => {
      if (!s.rid || s.left) return;
      const cur = slotPrep(ctx, s);
      if (!cur) return;
      const curMult = sum(portions(ctx, s, cur)) * s.days;
      for (const c of candidates(ctx, s.meal, s.who)) {
        if (c.r.id === s.rid) continue;
        if (s.days === 2 && c.r.batch !== 2) continue;
        if (plan.slots.some(o => o.day === s.day && o.rid === c.r.id)) continue;
        const mult = sum(portions(ctx, s, c)) * s.days;
        const saving = -replaceCost(ctx, need, cur, curMult, c, mult) - (uses.get(c.r.id) || 0) * 60;
        if (saving > 1 && (!best || saving > best.saving)) best = { i, c, cur, curMult, mult, saving };
      }
    });
    if (!best) break;
    const s = plan.slots[best.i];
    addNeed(need, best.cur, -best.curMult);
    addNeed(need, best.c, best.mult);
    const old = s.rid;
    s.rid = best.c.r.id;
    if (s.days === 2) {
      const pair = plan.slots.find(o => o.day === s.day + 1 && o.meal === s.meal && o.left && o.rid === old);
      if (pair) pair.rid = s.rid;
    }
    total = totalOf(ctx, need);
  }
  return total;
}

export function makePlan(ctx, { seed = newSeed(), budget = null } = {}) {
  if (budget == null) return generatePlan(ctx, { seed });
  const typical = planTotal(ctx, generatePlan(ctx, { seed }));
  const tight = typical > 0 ? clamp((typical - budget) / typical, 0, 1) : 0;
  const plan = generatePlan(ctx, { seed, costW: 1 + tight * 8, noise: 120 * (1 - Math.min(0.8, tight * 2)) });
  fitBudget(ctx, plan, budget);
  return plan;
}

export function estimateBudget(ctx) {
  let typical = 0;
  for (const seed of [11, 22, 33]) typical += planTotal(ctx, generatePlan(ctx, { seed }));
  typical /= 3;
  const cheap = generatePlan(ctx, { seed: 7, costW: 4, noise: 15 });
  const min = fitBudget(ctx, cheap, 0);
  const round50 = x => Math.max(50, Math.round(x / 50) * 50);
  return { typical: round50(typical), min: round50(Math.min(min, typical)) };
}

// Новое меню, в котором блюдо в ячейке i заменено на rid.
export function replaceSlot(ctx, plan, i, rid) {
  const slots = plan.slots.map(s => ({ ...s }));
  const s = slots[i];
  const pairAfter = () => slots.findIndex(o => o.day === s.day + 1 && o.meal === s.meal && o.left);
  if (s.left) {
    // Это был «вчерашний» суп: вчера теперь варим только на один день.
    const j = slots.findIndex(o => o.day === s.day - 1 && o.meal === s.meal && o.days === 2);
    if (j >= 0) slots[j].days = 1;
    Object.assign(s, { rid, left: false, days: 1 });
  } else if (s.days === 2) {
    const j = pairAfter();
    if (R[rid].batch === 2) {
      s.rid = rid;
      if (j >= 0) slots[j].rid = rid;
    } else {
      Object.assign(s, { rid, days: 1 });
      if (j >= 0) Object.assign(slots[j], { left: false, days: 1 });
    }
  } else {
    s.rid = rid;
  }
  return { ...plan, slots };
}

// Варианты замены блюда: похожие по калориям и цене — выше.
export function swapOptions(ctx, plan, i) {
  const s = plan.slots[i];
  const cur = slotPrep(ctx, s);
  const total = planTotal(ctx, plan);
  const uses = countUses(plan);
  const out = [];
  for (const c of candidates(ctx, s.meal, s.who)) {
    if (c.r.id === s.rid) continue;
    if (plan.slots.some((o, j) => j !== i && o.day === s.day && o.rid === c.r.id)) continue;
    const delta = planTotal(ctx, replaceSlot(ctx, plan, i, c.r.id)) - total;
    const kcalDiff = cur ? Math.abs(c.base.kcal - cur.base.kcal) : 0;
    const used = uses.get(c.r.id) || 0;
    out.push({ c, delta, used, myKcal: c.base.kcal * portions(ctx, s, c)[0], score: delta / 4 + kcalDiff / 12 + used * 25 });
  }
  return out.sort((a, b) => a.score - b.score);
}

// --- Всё для экрана результата: дни, порции, список покупок

export function derive(ctx, plan) {
  const days = Array.from({ length: 7 }, (_, d) => ({ d, items: [], kcal: 0 }));
  const need = new Map();
  const uses = new Map();
  plan.slots.forEach((s, i) => {
    const day = days[s.day];
    const c = slotPrep(ctx, s);
    if (!c) {
      day.items.push({ i, s, missing: true });
      return;
    }
    const mults = portions(ctx, s, c);
    const mult = sum(mults);
    const my = scaleNutrition(c.base, mults[0]);
    day.items.push({ i, s, c, mult, my, people: mults.length });
    day.kcal += my.kcal;
    if (!s.left) {
      addNeed(need, c, mult * s.days);
      uses.set(s.rid, (uses.get(s.rid) || 0) + 1);
    }
  });
  const list = buildList(ctx, need);
  return {
    days,
    list,
    total: list.total,
    repeats: [...uses.values()].some(n => n > 2),
    missing: days.some(d => d.items.some(x => x.missing)),
  };
}

export function buildList(ctx, need) {
  const groups = DEPTS.map(([id, name, emoji]) => ({ id, name, emoji, items: [] }));
  const byId = Object.fromEntries(groups.map(g => [g.id, g]));
  const staples = [];
  let total = 0;
  for (const [id, amt] of need) {
    const p = P[id];
    if (!p || p.free || amt <= 0.001) continue;
    const pu = purchase(ctx, p, amt);
    const item = {
      id, p, amt, ...pu,
      price: priceOf(ctx, p),
      custom: ctx.prices[ctx.store.id + ':' + id] != null,
      qty: qtyText(p, pu),
      need: needText(p, amt),
    };
    if (p.staple) {
      staples.push(item);
      if (ctx.staplesInTotal) total += pu.cost;
    } else {
      (byId[p.dept] || byId.other).items.push(item);
      total += pu.cost;
    }
  }
  for (const g of groups) g.items.sort((a, b) => a.p.name.localeCompare(b.p.name, 'ru'));
  staples.sort((a, b) => a.p.name.localeCompare(b.p.name, 'ru'));
  return { groups: groups.filter(g => g.items.length), staples, total };
}

// --- Форматирование

export function plural(n, [one, few, many]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function fmtNum(x, digits = 0) {
  return Number(x).toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

export function fmtRub(x) {
  return `${fmtNum(Math.round(x))} ₽`;
}

export function fmtMass(v, unit) {
  if (unit !== 'г' && unit !== 'мл') return `${fmtNum(v, 1)} ${unit}`;
  if (v >= 1000) return `${fmtNum(Math.round(v / 10) / 100, 2)} ${unit === 'мл' ? 'л' : 'кг'}`;
  return `${Math.round(v)} ${unit}`;
}

function roundAmount(v) {
  if (v < 20) return Math.max(5, Math.round(v / 5) * 5);
  if (v < 200) return Math.round(v / 10) * 10;
  if (v < 1000) return Math.round(v / 25) * 25;
  return Math.round(v / 50) * 50;
}

const isPiece = p => p.unit === 'шт' || p.unit === 'зуб.';

function qtyText(p, pu) {
  if (p.byWeight) return p.gpu ? `${pu.n} шт` : fmtMass(pu.grams, 'г');
  const packSize = isPiece(p) ? '' : ` по ${fmtMass(p.pack, p.unit)}`;
  if (p.forms) return `${pu.packs} ${plural(pu.packs, p.forms)}${packSize}`;
  return `${pu.packs} уп.${packSize}`;
}

function needText(p, amt) {
  if (p.byWeight) return p.gpu ? `≈ ${fmtMass(Math.ceil(amt - 0.15) * p.gpu, 'г')}` : '';
  if (isPiece(p)) return `нужно ${Math.ceil(amt - 0.05)} ${p.unit}`;
  return `нужно ${fmtMass(roundAmount(amt), p.unit)}`;
}

const SPOON = new Set(['oil', 'soy_sauce', 'honey', 'sugar', 'tomato_paste', 'mayo', 'flour', 'baking_powder', 'sesame', 'adjika']);

// Количество продукта в рецепте: «350 г», «2 шт», «1,5 ст. л.»
export function amountText(p, amt) {
  if (isPiece(p)) {
    const v = p.id === 'egg' ? Math.max(1, Math.round(amt)) : Math.max(0.5, Math.round(amt * 2) / 2);
    return `${fmtNum(v, 1)} ${p.unit}`;
  }
  if (p.byWeight && p.gpu) return `${fmtNum(Math.max(0.5, Math.round(amt * 2) / 2), 1)} шт`;
  if (SPOON.has(p.id) && amt < 60) {
    const tbsp = amt / 15;
    if (tbsp >= 0.75) return `${fmtNum(Math.max(1, Math.round(tbsp * 2) / 2), 1)} ст. л.`;
    return `${fmtNum(Math.max(0.5, Math.round(amt / 5 * 2) / 2), 1)} ч. л.`;
  }
  return fmtMass(roundAmount(amt), p.unit);
}
