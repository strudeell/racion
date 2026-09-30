// Составление меню: подбор блюд, размер порций, список покупок и цены.
// Работает без интернета и без сервера — всё считается прямо в браузере.

import { PRODUCTS } from './data/products.js';
import { RECIPES } from './data/recipes.js';
import { STORES } from './data/stores.js';
import { MEALS, MEAL_SHARE, DEPTS, STOP_CHIPS } from './data/dicts.js';

export const P = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export const R = Object.fromEntries(RECIPES.map(r => [r.id, r]));

// Нормы остальных взрослых — обычные, без похудения. Если пол не указан — среднее.
const ADULT_KCAL = { f: 2000, m: 2500 };
const ADULT_KCAL_UNKNOWN = 2250;
// Пределы порции относительно стандартной взрослой (из рецепта): от половины до двух с половиной.
const MIN_PORTION = 0.5;
const MAX_PORTION = 2.5;
// «Штрафы» при выборе блюда — в рублях на одну порцию.
const REPEAT_PENALTY = 150;  // то же блюдо второй раз за неделю
const KIND_PENALTY = 50;     // похожее блюдо (два плова, три пасты)
const MAIN_PENALTY = 40;     // тот же главный продукт (два блюда из чечевицы)
const RECENT_PENALTY = 60;   // блюдо было в прошлом меню
const PROTEIN_PENALTY = 25;  // курица на обед и на ужин подряд
const NOISE = 45;            // случайность, чтобы меню не повторялись
const FIT_BASE = 15;         // подгонка под бюджет: «цена» любой замены в баллах разнообразия
const FIT_NOISE = 45;        // и случайная добавка к ней, чтобы меню не повторялись

// Похожие блюда начинаются с одного слова: «Плов с курицей» и «Плов со свининой».
// Кроме просто «Суп …»: «Суп из сайры» и «Суп с пельменями» — совсем разные блюда.
// Поле kind у рецепта задаёт группу вручную: гороховый и чечевичный — оба «бобовые».
const kindOf = r => {
  if (r.kind) return r.kind;
  const w = r.name.toLowerCase().split(/[\s,]/)[0];
  return w === 'суп' ? r.id : w;
};

// Летние блюда (окрошка, гаспачо) предлагаем с мая по сентябрь.
const SUMMER_MONTHS = [5, 6, 7, 8, 9];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = arr => arr.reduce((s, x) => s + x, 0);

export function defaultKcal(sex) {
  return sex === 'm' ? 2300 : 1800;
}

// Примерная норма ребёнка по возрасту и полу. Если пол не указан — среднее.
export function kidKcal(age, sex = null) {
  const bySex = (f, m) => (sex === 'f' ? f : sex === 'm' ? m : Math.round((f + m) / 2));
  if (age <= 3) return 1200;
  if (age <= 6) return 1450;
  if (age <= 10) return bySex(1800, 1900);
  if (age <= 13) return bySex(2100, 2300);
  return bySex(2300, 2700);
}

const ADULT_LABEL = { f: 'Женщина', m: 'Мужчина' };
const KID_LABEL = { f: 'Девочка', m: 'Мальчик' };
const years = n => `${n} ${plural(n, ['год', 'года', 'лет'])}`;

// Все, кто ест, с нормой калорий и подписью: «Ты», «Мужчина», «Девочка, 5 лет».
function familyPeople(a, me) {
  const list = [{ base: 'Ты', kcal: me, sex: a.sex, kid: false }];
  for (let i = 1; i < a.adults; i++) {
    const sex = (a.others || [])[i - 1] || null;
    list.push({ base: ADULT_LABEL[sex] || `Взрослый ${i + 1}`, kcal: ADULT_KCAL[sex] || ADULT_KCAL_UNKNOWN, sex, kid: false });
  }
  if (a.hasKids) {
    for (const k of a.kids) {
      const kid = typeof k === 'number' ? { age: k, sex: null } : k;
      list.push({ base: KID_LABEL[kid.sex] || 'Ребёнок', kcal: kidKcal(kid.age, kid.sex), sex: kid.sex, kid: true, age: kid.age });
    }
  }
  // Одинаковые подписи нумеруем: «Мужчина 1», «Мужчина 2».
  const full = p => p.base + (p.kid ? `, ${years(p.age)}` : '');
  const count = {};
  for (const p of list) count[full(p)] = (count[full(p)] || 0) + 1;
  const seen = {};
  for (const p of list) {
    const f = full(p);
    if (count[f] > 1) {
      seen[f] = (seen[f] || 0) + 1;
      p.label = `${p.base} ${seen[f]}${p.kid ? `, ${years(p.age)}` : ''}`;
    } else {
      p.label = f;
    }
  }
  return list;
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
  const people = familyPeople(a, me);
  const hasKids = people.some(p => p.kid);
  const family = people.length > 1;

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
    eaters: { me: [me], family: people.map(p => p.kcal) },
    people,
    hasKids,
    slotSpec,
    batch: settings.batch !== false,
    staplesInTotal: !!settings.staplesInTotal,
    summer: SUMMER_MONTHS.includes(settings.month || new Date().getMonth() + 1),
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

// Главный продукт блюда — тот, что даёт больше всего калорий (кроме хлеба, масла, муки, сахара).
function mainOf(ings) {
  let best = null;
  let bestKcal = 0;
  for (const { p, amt } of ings) {
    if (p.staple || p.dept === 'bread') continue;
    const kcal = p.kcal * gramsOf(p, amt) / 100;
    if (kcal > bestKcal) { bestKcal = kcal; best = p.id; }
  }
  return best;
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

// Как поправить название, если продукт убрали или заменили: «Блинчики со сметаной» → «Блинчики».
const NAME_FIXES = {
  sour_cream: [[' со сметаной', ''], [' и сметаной', '']],
  honey: [[' и мёдом', ''], [' с мёдом', '']],
  butter: [[' со сливочным маслом', '']],
  milk: [[' с молоком', ' на воде'], [' и молоком', '']],
  onion: [[' и жареным луком', ''], [' и луком', '']],
};

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
  let name = r.name;
  const fixName = id => {
    for (const [from, to] of NAME_FIXES[id] || []) name = name.replace(from, to);
  };
  for (const [id, amt, flag] of r.ing) {
    const opt = flag === 'opt';
    const res = resolve(ctx, id);
    const spicyForKids = kids && res.p && (res.p.tags || []).includes('spicy');
    if (res.blocked || spicyForKids) {
      if (!opt) return null;
      if (res.p) removed.push(res.p.name);
      fixName(id);
      continue;
    }
    if (res.from) {
      swapped.push([res.from.name, res.p.name]);
      fixName(id);
    }
    ings.push({ p: res.p, amt, opt });
  }
  const base = nutritionOf(ings);
  if (base.kcal < 50) return null;
  // Стоимость продуктов на одну стандартную порцию — чтобы быстро отсеивать дорогие замены.
  const exact = ings.reduce((s, { p, amt }) => s + (p.free ? 0 : proRata(ctx, p, amt)), 0);
  return { r, name, ings, removed, swapped, base, exact, protein: proteinOf(ings), main: mainOf(ings) };
}

export function candidates(ctx, meal, who) {
  const key = meal + ':' + who;
  if (!ctx._cands.has(key)) {
    const kids = who === 'family' && ctx.hasKids;
    // Летние блюда зимой не предлагаем, но в уже составленном меню они остаются.
    const list = RECIPES.filter(r => r.meals.includes(meal) && (!r.summer || ctx.summer)).map(r => prep(ctx, r.id, kids)).filter(Boolean);
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

// Стоимость ровно того количества, что уйдёт в блюдо, без округления до упаковок.
function proRata(ctx, p, amt) {
  const price = priceOf(ctx, p);
  if (p.byWeight) return (p.gpu ? amt * p.gpu : amt) / 1000 * price;
  return amt / p.pack * price;
}

// Во сколько обойдётся блюдо при выборе меню. Половина — сколько реально добавится к чеку
// (уже открытая пачка сметаны почти бесплатна — так меньше выбрасывается), половина —
// стоимость самих продуктов. Мука, масло и сахар тоже не бесплатные, хоть и не входят в чек.
function choiceCost(ctx, need, c, mult) {
  let d = 0;
  for (const { p, amt } of c.ings) {
    if (p.free) continue;
    const add = amt * mult;
    const exact = proRata(ctx, p, add);
    let receipt = exact;
    if (!p.staple) {
      const cur = need.get(p.id) || 0;
      receipt = purchase(ctx, p, cur + add).cost - (cur > 0.001 ? purchase(ctx, p, cur).cost : 0);
    }
    d += (receipt + exact) / 2;
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

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

// avoid — блюда из прошлых меню: { id → 1 для прошлого меню, 0.5 для позапрошлого }.
export function generatePlan(ctx, { seed = newSeed(), costW = 1, noise = NOISE, avoid = null } = {}) {
  const rnd = mulberry32(seed);
  const slots = ctx.slotSpec.map(s => ({ ...s, rid: null, days: 1, left: false }));
  const need = new Map();
  const used = new Map();
  const kinds = new Map();
  const mains = new Map();
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
      const perPortion = choiceCost(ctx, need, c, mult * days) / (mult * days);
      let score = -perPortion * costW + rnd() * noise;
      score -= (used.get(c.r.id) || 0) * REPEAT_PENALTY;
      score -= (kinds.get(kindOf(c.r)) || 0) * KIND_PENALTY;
      if (c.main) score -= (mains.get(c.main) || 0) * MAIN_PENALTY;
      if (avoid) score -= (avoid.get(c.r.id) || 0) * RECENT_PENALTY;
      if (slots.some(o => o.day === s.day && o.rid === c.r.id)) score -= 1000;
      if (s.meal !== 'breakfast' && c.protein && c.protein === prevProtein) score -= PROTEIN_PENALTY;
      if (!best || score > best.score) best = { c, mult, days, score };
    }
    s.rid = best.c.r.id;
    s.days = best.days;
    addNeed(need, best.c, best.mult * best.days);
    bump(used, s.rid);
    bump(kinds, kindOf(best.c.r));
    if (best.c.main) bump(mains, best.c.main);
    if (best.days === 2) Object.assign(slots[next], { rid: s.rid, left: true });
    if (s.meal !== 'breakfast') prevProtein = best.c.protein;
  }
  return { seed, slots };
}

// Заменяет блюда более дешёвыми, пока меню не уложится в бюджет. Возвращает итоговую сумму.
// Без rnd каждый раз берёт самую выгодную замену. С rnd — любую заметно экономящую,
// с учётом разнообразия: иначе каждую неделю в меню одни и те же самые дешёвые блюда.
function fitBudget(ctx, plan, budget, { rnd = null, avoid = null, maxIter = 80 } = {}) {
  const need = needOf(ctx, plan);
  let total = totalOf(ctx, need);
  for (let it = 0; it < maxIter && total > budget; it++) {
    const uses = countUses(plan);
    const kinds = new Map();
    for (const s of plan.slots) if (s.rid && !s.left) bump(kinds, kindOf(R[s.rid]));
    // Насколько блюдо портит разнообразие меню; self — сколько раз оно уже учтено в счётчиках.
    const penaltyOf = (r, self, selfKind) =>
      ((uses.get(r.id) || 0) - self) * REPEAT_PENALTY +
      ((kinds.get(kindOf(r)) || 0) - selfKind) * KIND_PENALTY +
      (avoid ? (avoid.get(r.id) || 0) * RECENT_PENALTY : 0);
    let best = null;
    plan.slots.forEach((s, i) => {
      if (!s.rid || s.left) return;
      const cur = slotPrep(ctx, s);
      if (!cur) return;
      const curMult = sum(portions(ctx, s, cur)) * s.days;
      for (const c of candidates(ctx, s.meal, s.who)) {
        if (c.r.id === s.rid) continue;
        // Заметно более дорогое блюдо почти никогда не экономит — не тратим время на подсчёт.
        if (c.exact > cur.exact + 15) continue;
        if (s.days === 2 && c.r.batch !== 2) continue;
        if (plan.slots.some(o => o.day === s.day && o.rid === c.r.id)) continue;
        const mult = sum(portions(ctx, s, c)) * s.days;
        const saving = -replaceCost(ctx, need, cur, curMult, c, mult);
        let score;
        if (rnd) {
          if (saving <= 1) continue;
          // Берём замену, которая экономит больше всего на порцию в расчёте на потерю разнообразия
          // (повтор, похожее блюдо, блюдо из прошлого меню). Иначе подгонка перебирает мелкие
          // замены по 5 ₽ и в конце вынужденно ставит одни и те же самые дешёвые блюда.
          const same = kindOf(c.r) === kindOf(cur.r) ? 1 : 0;
          const loss = Math.max(0, penaltyOf(c.r, 0, same) - penaltyOf(cur.r, 1, 1));
          score = (saving / mult) / (FIT_BASE + loss + rnd() * FIT_NOISE);
        } else {
          score = saving - (uses.get(c.r.id) || 0) * 60;
          if (score <= 1) continue;
        }
        if (!best || score > best.score) best = { i, c, cur, curMult, mult, score };
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

// Самый экономный стартовый вариант. Им же считается «минимум» на шаге бюджета,
// поэтому если человек выбрал сумму не меньше минимума, уложиться получится всегда.
const CHEAPEST = { seed: 7, costW: 4, noise: 5 };

export function makePlan(ctx, { seed = newSeed(), budget = null, avoid = null } = {}) {
  if (budget == null) return generatePlan(ctx, { seed, avoid });
  const typical = planTotal(ctx, generatePlan(ctx, { seed, avoid }));
  const tight = typical > 0 ? clamp((typical - budget) / typical, 0, 1) : 0;
  const attempts = [
    { seed, avoid, costW: 1 + tight * 6, noise: NOISE * (1 - Math.min(0.8, tight * 2)) },
    { seed: seed + 7919, avoid, costW: 3, noise: 15 },
    { seed: seed + 15838, avoid, costW: 4, noise: 10 },
    CHEAPEST,
  ];
  let best = null;
  for (const opts of attempts) {
    const plan = generatePlan(ctx, opts);
    // Последняя попытка — без случайности: она гарантирует, что минимальный бюджет достижим.
    const fit = opts === CHEAPEST ? {} : { rnd: mulberry32(opts.seed + 1), avoid };
    const total = fitBudget(ctx, plan, budget, fit);
    if (!best || total < best.total) best = { plan, total };
    if (total <= budget) break;
  }
  return best.plan;
}

export function estimateBudget(ctx) {
  let typical = 0;
  for (const seed of [11, 22, 33]) typical += planTotal(ctx, generatePlan(ctx, { seed }));
  typical /= 3;
  const cheap = generatePlan(ctx, CHEAPEST);
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
    day.items.push({ i, s, c, mult, mults, my, people: mults.length });
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
