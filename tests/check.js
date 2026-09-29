// Проверка данных и алгоритма. Запуск: node tests/check.js
// Ловит опечатки в рецептах (несуществующий продукт, неизвестная техника)
// и прогоняет подбор меню на сотнях случайных анкет.

import { PRODUCTS } from '../js/data/products.js';
import { RECIPES } from '../js/data/recipes.js';
import { STORES } from '../js/data/stores.js';
import { ALLERGENS, KITCHEN, STOP_CHIPS, MEALS, DEPTS } from '../js/data/dicts.js';
import { P, prep, makeContext, makePlan, derive, estimateBudget, swapOptions, replaceSlot, planTotal } from '../js/planner.js';

const errors = [];
const fail = msg => errors.push(msg);

// 1. Данные
const kitchenIds = new Set(KITCHEN.map(k => k[0]));
const allergenIds = new Set(ALLERGENS.map(a => a[0]));
const deptIds = new Set(DEPTS.map(d => d[0]));
const stopTags = new Set(STOP_CHIPS.map(s => s[1]));
const ids = new Set();

for (const p of PRODUCTS) {
  if (ids.has(p.id)) fail(`Продукт ${p.id}: повторяется id`);
  ids.add(p.id);
  if (!deptIds.has(p.dept)) fail(`Продукт ${p.id}: неизвестный отдел ${p.dept}`);
  if (!p.free && !p.byWeight && !(p.pack > 0)) fail(`Продукт ${p.id}: нет pack и не byWeight`);
  if ((p.unit === 'шт' || p.unit === 'зуб.') && !p.gpu) fail(`Продукт ${p.id}: для штучного нужен gpu`);
  for (const a of p.al || []) if (!allergenIds.has(a)) fail(`Продукт ${p.id}: неизвестный аллерген ${a}`);
  for (const t of p.tags || []) if (!stopTags.has(t) && t !== 'chicken') fail(`Продукт ${p.id}: неизвестный тег ${t}`);
  if (p.alt && !P[p.alt]) fail(`Продукт ${p.id}: замена ${p.alt} не найдена`);
}

const rids = new Set();
for (const r of RECIPES) {
  if (rids.has(r.id)) fail(`Рецепт ${r.id}: повторяется id`);
  rids.add(r.id);
  if (!r.meals?.length || r.meals.some(m => !MEALS.includes(m))) fail(`Рецепт ${r.id}: неверный meals`);
  for (const group of (r.equip || '').split('+').filter(g => g.trim())) {
    for (const x of group.split('|')) if (!kitchenIds.has(x.trim())) fail(`Рецепт ${r.id}: неизвестная техника «${x.trim()}»`);
  }
  const seen = new Set();
  for (const [id, amt] of r.ing) {
    if (!P[id]) fail(`Рецепт ${r.id}: нет продукта ${id}`);
    if (seen.has(id)) fail(`Рецепт ${r.id}: продукт ${id} указан дважды`);
    seen.add(id);
    if (!(amt > 0)) fail(`Рецепт ${r.id}: количество ${id} должно быть больше нуля`);
  }
  if (!r.steps?.length) fail(`Рецепт ${r.id}: нет шагов`);
}

// Калорийность базовой порции
const kcalReport = [];
{
  const ctx = makeContext({ store: 'p5', adults: 1, hasKids: false, kids: [], myMeals: MEALS, familyMeals: [], sex: 'f', allergies: ['none'], stop: [], kitchen: [...kitchenIds], budgetMode: 'none', budget: null });
  for (const r of RECIPES) {
    const c = prep(ctx, r.id);
    if (!c) { fail(`Рецепт ${r.id}: не собрался даже без ограничений`); continue; }
    kcalReport.push([r.id, Math.round(c.base.kcal), r.meals.join('/')]);
  }
}

// 2. Алгоритм на случайных анкетах
function rnd(n) { return Math.floor(Math.random() * n); }
function pickSome(arr, max) { return arr.filter(() => Math.random() < max); }

let runs = 0, totalMs = 0, maxMs = 0;
for (let t = 0; t < 400; t++) {
  const adults = 1 + rnd(4);
  const hasKids = Math.random() < 0.4;
  const kids = hasKids ? Array.from({ length: 1 + rnd(3) }, () => 1 + rnd(17)) : [];
  const allergies = Math.random() < 0.5 ? ['none'] : pickSome(ALLERGENS.map(a => a[0]), 0.25);
  const stop = pickSome(STOP_CHIPS, 0.2).map(([text, tag]) => ({ text, tag }));
  if (Math.random() < 0.2) stop.push({ text: 'курицу' });
  let kitchen = pickSome([...kitchenIds], 0.5);
  if (!kitchen.length) kitchen = ['stove'];
  const myMeals = pickSome(MEALS, 0.8);
  const familyMeals = adults + kids.length > 1 ? pickSome(MEALS, 0.5) : [];
  if (!myMeals.length && !familyMeals.length) myMeals.push('dinner');
  const answers = {
    store: STORES[rnd(STORES.length)].id, adults, hasKids: kids.length > 0, kids, myMeals, familyMeals,
    sex: Math.random() < 0.5 ? 'f' : 'm', allergies: allergies.length ? allergies : ['none'], stop, kitchen,
    budgetMode: 'none', budget: null,
  };
  const t0 = performance.now();
  const ctx = makeContext(answers, { batch: Math.random() < 0.8 });
  const est = estimateBudget(ctx);
  const budget = Math.random() < 0.5 ? Math.round(est.min + Math.random() * (est.typical - est.min)) : null;
  const plan = makePlan(ctx, { seed: rnd(1e9), budget });
  const d = derive(ctx, plan);
  const ms = performance.now() - t0;
  totalMs += ms; maxMs = Math.max(maxMs, ms); runs++;

  const al = new Set(answers.allergies.filter(a => a !== 'none'));
  for (const day of d.days) {
    for (const it of day.items) {
      if (it.missing) continue;
      for (const { p } of it.c.ings) {
        for (const a of p.al || []) if (al.has(a)) fail(`Аллерген ${a} в «${it.c.r.name}» (анкета ${t})`);
        for (const tg of p.tags || []) if (stop.some(s => s.tag === tg)) fail(`Нелюбимый ${tg} в «${it.c.r.name}» (анкета ${t})`);
        if (stop.some(s => s.text === 'курицу') && (p.tags || []).includes('chicken')) fail(`Курица в «${it.c.r.name}» (анкета ${t})`);
      }
    }
  }
  if (!Number.isFinite(d.total) || d.total < 0) fail(`Сумма ${d.total} (анкета ${t})`);
  if (budget != null && est.min <= budget && d.total > budget * 1.12) fail(`Бюджет ${budget}, вышло ${Math.round(d.total)}, минимум ${est.min} (анкета ${t})`);

  // Замена блюда не ломает меню
  const i = plan.slots.findIndex(s => s.rid);
  if (i >= 0) {
    const opts = swapOptions(ctx, plan, i);
    if (opts.length) {
      const p2 = replaceSlot(ctx, plan, i, opts[0].c.r.id);
      const d2 = derive(ctx, p2);
      if (Math.abs(planTotal(ctx, p2) - d2.total) > 1) fail(`Сумма после замены не сходится (анкета ${t})`);
    }
  }
}

// 3. Пример меню
{
  const answers = { store: 'p5', adults: 2, hasKids: true, kids: [5], myMeals: MEALS, familyMeals: ['dinner'], sex: 'f', allergies: ['none'], stop: [{ text: 'Печень', tag: 'liver' }], kitchen: ['stove', 'oven', 'micro'], budgetMode: 'none', budget: null };
  const ctx = makeContext(answers);
  const est = estimateBudget(ctx);
  const plan = makePlan(ctx, { seed: 42 });
  const d = derive(ctx, plan);
  console.log(`\nПример: 2 взрослых + ребёнок 5 лет, общие ужины, Пятёрочка. Обычно ≈${est.typical} ₽, минимум ≈${est.min} ₽`);
  for (const day of d.days) {
    console.log(`  День ${day.d + 1} (${Math.round(day.kcal)} ккал): ` + day.items.map(it => it.missing ? '—' : `${it.c.r.name}${it.s.left ? ' (вчерашн.)' : ''}`).join(' | '));
  }
  console.log(`  Корзина: ${Math.round(d.total)} ₽, позиций: ${d.list.groups.reduce((s, g) => s + g.items.length, 0)}`);
  for (const g of d.list.groups) console.log(`   ${g.name}: ` + g.items.map(x => `${x.p.name} ${x.qty} (${Math.round(x.cost)} ₽)`).join('; '));
  console.log('   Проверь дома: ' + d.list.staples.map(x => `${x.p.name} (${x.need || x.qty})`).join('; '));
}

const low = kcalReport.filter(([, k]) => k < 330);
const high = kcalReport.filter(([, k]) => k > 800);
console.log(`\nРецептов: ${RECIPES.length}, продуктов: ${PRODUCTS.length}`);
console.log(`Мало калорий в базовой порции (<330): ${low.map(x => x.join(' ')).join(', ') || 'нет'}`);
console.log(`Много калорий (>800): ${high.map(x => x.join(' ')).join(', ') || 'нет'}`);
console.log(`Прогонов: ${runs}, в среднем ${Math.round(totalMs / runs)} мс, максимум ${Math.round(maxMs)} мс`);

if (errors.length) {
  console.error(`\nОшибок: ${errors.length}`);
  for (const e of [...new Set(errors)].slice(0, 40)) console.error(' • ' + e);
  process.exit(1);
}
console.log('\nВсё в порядке ✓');
