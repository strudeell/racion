// Продукты: цены, упаковки, калории.
//
// Как поменять цену: найдите продукт и исправьте число price.
// Цены примерные, средние по стране; поправка на магазин — в stores.js.
//
// Поля:
//   id      — код продукта латиницей (на него ссылаются рецепты, не меняйте)
//   name    — название в списке покупок
//   dept    — отдел: veg, meat, fish, dairy, grocery, canned, bread, frozen, other
//   unit    — единица в рецептах: 'г', 'мл', 'шт' или 'зуб.'
//   byWeight: true — продаётся на вес, тогда price — цена за 1 кг
//   pack    — сколько в одной упаковке (в единицах unit), price — цена упаковки
//   forms   — как называть упаковку: ['пучок', 'пучка', 'пучков']
//   gpu     — вес одной штуки в граммах (для 'шт' и 'зуб.')
//   waste   — доля отходов (кожура, кости), на калории не идёт
//   kcal, p, f, c — калории, белки, жиры, углеводы на 100 г
//   al      — аллергены: nuts, peanut, milk, eggs, gluten, fish, seafood, soy, honey, citrus, sesame
//   tags    — для «не люблю»: pork, beef, chicken, mushrooms, onion, eggplant,
//             cilantro, olives, cottage, liver, spicy, tofu, barley
//   aka     — дополнительные слова для поиска, когда вписывают свой продукт
//   alt     — чем заменить, если продукт нельзя (аллергия или «не люблю»)
//   staple  — базовый продукт, который обычно есть дома (масло, мука, сахар)
//   free    — не покупается (вода)

const CHICKEN = 'курица куриный кура птица';

export const PRODUCTS = [
  // Овощи, фрукты, зелень
  { id: 'potato', name: 'Картофель', dept: 'veg', unit: 'г', byWeight: true, price: 45, waste: 0.2, kcal: 77, p: 2, f: 0.4, c: 16.3, aka: 'картошка' },
  { id: 'onion', name: 'Лук репчатый', dept: 'veg', unit: 'г', byWeight: true, price: 40, waste: 0.1, kcal: 41, p: 1.4, f: 0, c: 8.2, tags: ['onion'] },
  { id: 'carrot', name: 'Морковь', dept: 'veg', unit: 'г', byWeight: true, price: 45, waste: 0.15, kcal: 35, p: 1.3, f: 0.1, c: 6.9 },
  { id: 'cabbage', name: 'Капуста белокочанная', dept: 'veg', unit: 'г', byWeight: true, price: 35, waste: 0.15, kcal: 27, p: 1.8, f: 0.1, c: 4.7 },
  { id: 'pekin', name: 'Пекинская капуста', dept: 'veg', unit: 'г', byWeight: true, price: 110, waste: 0.1, kcal: 16, p: 1.2, f: 0.2, c: 2, aka: 'салат' },
  { id: 'beet', name: 'Свёкла', dept: 'veg', unit: 'г', byWeight: true, price: 45, waste: 0.15, kcal: 42, p: 1.5, f: 0.1, c: 8.8, aka: 'свекла' },
  { id: 'tomato', name: 'Помидоры', dept: 'veg', unit: 'г', byWeight: true, price: 230, kcal: 20, p: 1.1, f: 0.2, c: 3.7, aka: 'томаты' },
  { id: 'cucumber', name: 'Огурцы', dept: 'veg', unit: 'г', byWeight: true, price: 180, kcal: 14, p: 0.8, f: 0.1, c: 2.5 },
  { id: 'bell_pepper', name: 'Перец болгарский', dept: 'veg', unit: 'г', byWeight: true, price: 320, waste: 0.15, kcal: 26, p: 1.3, f: 0.1, c: 5.3 },
  { id: 'zucchini', name: 'Кабачки', dept: 'veg', unit: 'г', byWeight: true, price: 95, waste: 0.1, kcal: 24, p: 0.6, f: 0.3, c: 4.6, aka: 'кабачок цукини' },
  { id: 'eggplant', name: 'Баклажаны', dept: 'veg', unit: 'г', byWeight: true, price: 170, waste: 0.1, kcal: 24, p: 1.2, f: 0.1, c: 4.5, tags: ['eggplant'] },
  { id: 'pumpkin', name: 'Тыква', dept: 'veg', unit: 'г', byWeight: true, price: 60, waste: 0.3, kcal: 22, p: 1, f: 0.1, c: 4.4 },
  { id: 'mushrooms', name: 'Шампиньоны', dept: 'veg', unit: 'г', pack: 400, price: 190, kcal: 27, p: 4.3, f: 1, c: 0.1, tags: ['mushrooms'], aka: 'грибы' },
  { id: 'garlic', name: 'Чеснок', dept: 'veg', unit: 'зуб.', pack: 10, forms: ['головка', 'головки', 'головок'], price: 35, gpu: 5, kcal: 143, p: 6.5, f: 0.5, c: 30 },
  { id: 'greens', name: 'Зелень (укроп, петрушка)', dept: 'veg', unit: 'г', pack: 50, forms: ['пучок', 'пучка', 'пучков'], price: 60, kcal: 40, p: 3, f: 0.5, c: 6, aka: 'укроп петрушка' },
  { id: 'green_onion', name: 'Зелёный лук', dept: 'veg', unit: 'г', pack: 50, forms: ['пучок', 'пучка', 'пучков'], price: 60, kcal: 20, p: 1.3, f: 0.1, c: 3.2, tags: ['onion'] },
  { id: 'cilantro', name: 'Кинза', dept: 'veg', unit: 'г', pack: 50, forms: ['пучок', 'пучка', 'пучков'], price: 70, kcal: 23, p: 2.1, f: 0.5, c: 1.9, tags: ['cilantro'] },
  { id: 'lemon', name: 'Лимоны', dept: 'veg', unit: 'шт', byWeight: true, gpu: 130, waste: 0.3, price: 250, kcal: 34, p: 0.9, f: 0.1, c: 3, al: ['citrus'], aka: 'лимон' },
  { id: 'apple', name: 'Яблоки', dept: 'veg', unit: 'шт', byWeight: true, gpu: 180, waste: 0.15, price: 140, kcal: 47, p: 0.4, f: 0.4, c: 9.8, aka: 'яблоко' },
  { id: 'banana', name: 'Бананы', dept: 'veg', unit: 'шт', byWeight: true, gpu: 170, waste: 0.35, price: 160, kcal: 89, p: 1.1, f: 0.3, c: 20, aka: 'банан' },

  // Мясо и птица
  { id: 'chicken_breast', name: 'Куриное филе', dept: 'meat', unit: 'г', byWeight: true, price: 480, kcal: 113, p: 23.6, f: 1.9, c: 0.4, tags: ['chicken'], aka: CHICKEN },
  { id: 'chicken_thigh', name: 'Куриные бёдра', dept: 'meat', unit: 'г', byWeight: true, price: 330, waste: 0.25, kcal: 185, p: 16.8, f: 13, c: 0, tags: ['chicken'], aka: CHICKEN },
  { id: 'chicken_drumstick', name: 'Куриные голени', dept: 'meat', unit: 'г', byWeight: true, price: 300, waste: 0.3, kcal: 158, p: 18, f: 9.5, c: 0, tags: ['chicken'], aka: CHICKEN },
  { id: 'chicken_liver', name: 'Печень куриная', dept: 'meat', unit: 'г', byWeight: true, price: 260, kcal: 137, p: 20.4, f: 5.9, c: 0.7, tags: ['liver', 'chicken'], aka: 'печёнка ' + CHICKEN },
  { id: 'minced_chicken', name: 'Фарш куриный', dept: 'meat', unit: 'г', pack: 400, price: 220, kcal: 143, p: 17.4, f: 8.1, c: 0, tags: ['chicken'], aka: CHICKEN },
  { id: 'minced_mix', name: 'Фарш домашний (свинина и говядина)', dept: 'meat', unit: 'г', pack: 400, price: 270, kcal: 263, p: 17, f: 22, c: 0, tags: ['pork', 'beef'], aka: 'свиной говяжий', alt: 'minced_chicken' },
  { id: 'pork', name: 'Свинина (лопатка)', dept: 'meat', unit: 'г', byWeight: true, price: 480, kcal: 250, p: 16, f: 21, c: 0, tags: ['pork'], aka: 'свиной' },
  { id: 'beef', name: 'Говядина для тушения', dept: 'meat', unit: 'г', byWeight: true, price: 850, kcal: 187, p: 18.9, f: 12.4, c: 0, tags: ['beef'], aka: 'говяжий телятина' },
  { id: 'sausages', name: 'Сосиски', dept: 'meat', unit: 'г', pack: 450, price: 260, kcal: 260, p: 11, f: 24, c: 1.6, al: ['milk', 'soy'], tags: ['pork'], aka: 'колбаса сосиска' },

  // Рыба
  { id: 'pollock', name: 'Минтай, филе замороженное', dept: 'fish', unit: 'г', pack: 400, price: 250, kcal: 72, p: 15.9, f: 0.9, c: 0, al: ['fish'], aka: 'рыба' },
  { id: 'mackerel', name: 'Скумбрия', dept: 'fish', unit: 'г', byWeight: true, price: 350, waste: 0.3, kcal: 191, p: 18, f: 13.2, c: 0, al: ['fish'], aka: 'рыба' },
  { id: 'pink_salmon', name: 'Горбуша', dept: 'fish', unit: 'г', byWeight: true, price: 480, waste: 0.2, kcal: 140, p: 20.5, f: 6.5, c: 0, al: ['fish'], aka: 'рыба лосось' },
  { id: 'crab_sticks', name: 'Крабовые палочки', dept: 'fish', unit: 'г', pack: 200, price: 120, kcal: 73, p: 6, f: 1, c: 10, al: ['fish', 'eggs'], aka: 'краб' },
  { id: 'tuna', name: 'Тунец консервированный', dept: 'canned', unit: 'г', pack: 185, forms: ['банка', 'банки', 'банок'], price: 190, kcal: 96, p: 21, f: 1, c: 0, al: ['fish'], aka: 'рыба консервы' },
  { id: 'shrimp', name: 'Креветки варёно-мороженые', dept: 'frozen', unit: 'г', pack: 500, price: 560, waste: 0.1, kcal: 95, p: 18.9, f: 2.2, c: 0, al: ['seafood'], aka: 'морепродукты' },

  // Молочное и яйца
  { id: 'milk', name: 'Молоко 2,5%', dept: 'dairy', unit: 'мл', pack: 930, price: 95, kcal: 52, p: 2.8, f: 2.5, c: 4.7, al: ['milk'], alt: 'water' },
  { id: 'kefir', name: 'Кефир 1%', dept: 'dairy', unit: 'мл', pack: 900, price: 95, kcal: 40, p: 3, f: 1, c: 4, al: ['milk'] },
  { id: 'sour_cream', name: 'Сметана 15%', dept: 'dairy', unit: 'г', pack: 300, price: 125, kcal: 158, p: 2.6, f: 15, c: 3, al: ['milk'] },
  { id: 'cottage', name: 'Творог 5%', dept: 'dairy', unit: 'г', pack: 300, price: 170, kcal: 121, p: 17.2, f: 5, c: 1.8, al: ['milk'], tags: ['cottage'], aka: 'творожный' },
  { id: 'yogurt', name: 'Йогурт натуральный', dept: 'dairy', unit: 'г', pack: 300, price: 110, kcal: 66, p: 5, f: 2, c: 7, al: ['milk'] },
  { id: 'cheese', name: 'Сыр полутвёрдый', dept: 'dairy', unit: 'г', pack: 200, price: 230, kcal: 350, p: 25, f: 27, c: 0, al: ['milk'] },
  { id: 'feta', name: 'Сыр фета (брынза)', dept: 'dairy', unit: 'г', pack: 200, price: 190, kcal: 260, p: 17, f: 21, c: 0.5, al: ['milk'], aka: 'брынза сыр' },
  { id: 'butter', name: 'Масло сливочное 82%', dept: 'dairy', unit: 'г', pack: 180, price: 250, kcal: 748, p: 0.5, f: 82.5, c: 0.8, al: ['milk'], alt: 'oil' },
  { id: 'cream', name: 'Сливки 10%', dept: 'dairy', unit: 'мл', pack: 200, price: 85, kcal: 118, p: 3, f: 10, c: 4, al: ['milk'] },
  { id: 'egg', name: 'Яйца С1', dept: 'dairy', unit: 'шт', pack: 10, forms: ['десяток', 'десятка', 'десятков'], price: 125, gpu: 55, waste: 0.1, kcal: 157, p: 12.7, f: 11.5, c: 0.7, al: ['eggs'], aka: 'яйцо' },

  // Крупы и бакалея
  { id: 'buckwheat', name: 'Гречка', dept: 'grocery', unit: 'г', pack: 800, price: 110, kcal: 313, p: 12.6, f: 3.3, c: 57.1, aka: 'гречневая' },
  { id: 'rice', name: 'Рис', dept: 'grocery', unit: 'г', pack: 900, price: 125, kcal: 333, p: 7, f: 1, c: 74 },
  { id: 'oats', name: 'Овсяные хлопья', dept: 'grocery', unit: 'г', pack: 400, price: 80, kcal: 352, p: 12.3, f: 6.1, c: 59.5, al: ['gluten'], aka: 'овсянка овёс геркулес' },
  { id: 'millet', name: 'Пшено', dept: 'grocery', unit: 'г', pack: 900, price: 90, kcal: 342, p: 11.5, f: 3.3, c: 66.5, aka: 'пшённая' },
  { id: 'semolina', name: 'Манная крупа', dept: 'grocery', unit: 'г', pack: 800, price: 85, kcal: 333, p: 10.3, f: 1, c: 70.6, al: ['gluten'], aka: 'манка' },
  { id: 'corn_grits', name: 'Кукурузная крупа', dept: 'grocery', unit: 'г', pack: 700, price: 90, kcal: 337, p: 8.3, f: 1.2, c: 71 },
  { id: 'barley', name: 'Перловка', dept: 'grocery', unit: 'г', pack: 900, price: 75, kcal: 315, p: 9.3, f: 1.1, c: 66.9, al: ['gluten'], tags: ['barley'], aka: 'перловая' },
  { id: 'lentils', name: 'Чечевица красная', dept: 'grocery', unit: 'г', pack: 450, price: 130, kcal: 314, p: 24, f: 1.5, c: 49 },
  { id: 'peas', name: 'Горох колотый', dept: 'grocery', unit: 'г', pack: 800, price: 90, kcal: 298, p: 20.5, f: 2, c: 49.5 },
  { id: 'chickpeas', name: 'Нут', dept: 'grocery', unit: 'г', pack: 450, price: 140, kcal: 364, p: 19, f: 6, c: 61 },
  { id: 'pasta', name: 'Макароны', dept: 'grocery', unit: 'г', pack: 450, price: 85, kcal: 344, p: 11, f: 1.3, c: 70.5, al: ['gluten'], aka: 'паста спагетти' },
  { id: 'vermicelli', name: 'Вермишель', dept: 'grocery', unit: 'г', pack: 400, price: 70, kcal: 344, p: 11, f: 1.3, c: 70.5, al: ['gluten'], aka: 'лапша' },
  { id: 'breadcrumbs', name: 'Сухари панировочные', dept: 'grocery', unit: 'г', pack: 200, price: 60, kcal: 347, p: 9.7, f: 1.9, c: 77.6, al: ['gluten'] },
  { id: 'muesli', name: 'Мюсли', dept: 'grocery', unit: 'г', pack: 400, price: 200, kcal: 370, p: 9, f: 8, c: 64, al: ['gluten', 'nuts'] },
  { id: 'raisins', name: 'Изюм', dept: 'grocery', unit: 'г', pack: 200, price: 130, kcal: 264, p: 2.9, f: 0.6, c: 66 },
  { id: 'walnuts', name: 'Грецкие орехи', dept: 'grocery', unit: 'г', pack: 100, price: 180, kcal: 654, p: 15.2, f: 65.2, c: 7, al: ['nuts'], aka: 'орехи' },
  { id: 'honey', name: 'Мёд', dept: 'grocery', unit: 'г', pack: 250, price: 330, kcal: 329, p: 0.8, f: 0, c: 81.5, al: ['honey'], aka: 'мед' },
  { id: 'peanut_butter', name: 'Арахисовая паста', dept: 'grocery', unit: 'г', pack: 300, price: 250, kcal: 588, p: 25, f: 50, c: 20, al: ['peanut'], aka: 'арахис' },
  { id: 'sesame', name: 'Кунжут', dept: 'grocery', unit: 'г', pack: 50, price: 60, kcal: 565, p: 19.4, f: 48.7, c: 12.2, al: ['sesame'] },
  { id: 'flour', name: 'Мука пшеничная', dept: 'grocery', unit: 'г', pack: 2000, price: 120, kcal: 334, p: 10.3, f: 1.1, c: 69.9, al: ['gluten'], staple: true },
  { id: 'sugar', name: 'Сахар', dept: 'grocery', unit: 'г', pack: 1000, price: 85, kcal: 399, p: 0, f: 0, c: 99.8, staple: true },
  { id: 'oil', name: 'Масло подсолнечное', dept: 'grocery', unit: 'мл', pack: 1000, price: 160, kcal: 899, p: 0, f: 99.9, c: 0, staple: true, aka: 'растительное' },
  { id: 'baking_powder', name: 'Разрыхлитель', dept: 'grocery', unit: 'г', pack: 10, price: 20, kcal: 79, p: 0, f: 0, c: 37, staple: true },

  // Консервы и соусы
  { id: 'tomato_paste', name: 'Томатная паста', dept: 'canned', unit: 'г', pack: 270, price: 110, kcal: 102, p: 4.8, f: 0, c: 19 },
  { id: 'canned_tomatoes', name: 'Томаты в собственном соку', dept: 'canned', unit: 'г', pack: 400, forms: ['банка', 'банки', 'банок'], price: 150, kcal: 20, p: 1.1, f: 0.1, c: 3.5, aka: 'помидоры' },
  { id: 'beans', name: 'Фасоль консервированная', dept: 'canned', unit: 'г', pack: 400, forms: ['банка', 'банки', 'банок'], price: 110, kcal: 99, p: 6.7, f: 0.3, c: 17.4 },
  { id: 'corn', name: 'Кукуруза консервированная', dept: 'canned', unit: 'г', pack: 340, forms: ['банка', 'банки', 'банок'], price: 110, kcal: 58, p: 2.2, f: 0.4, c: 11.2 },
  { id: 'green_peas', name: 'Горошек консервированный', dept: 'canned', unit: 'г', pack: 400, forms: ['банка', 'банки', 'банок'], price: 100, kcal: 40, p: 3.1, f: 0.2, c: 6.5 },
  { id: 'pickles', name: 'Огурцы солёные', dept: 'canned', unit: 'г', pack: 680, forms: ['банка', 'банки', 'банок'], price: 150, kcal: 16, p: 0.8, f: 0.1, c: 1.7 },
  { id: 'olives', name: 'Оливки без косточки', dept: 'canned', unit: 'г', pack: 300, forms: ['банка', 'банки', 'банок'], price: 150, kcal: 166, p: 1, f: 15, c: 6, tags: ['olives'], aka: 'маслины' },
  { id: 'mayo', name: 'Майонез', dept: 'canned', unit: 'г', pack: 400, price: 130, kcal: 624, p: 0.3, f: 67, c: 2.6, al: ['eggs'], alt: 'sour_cream' },
  { id: 'soy_sauce', name: 'Соевый соус', dept: 'canned', unit: 'мл', pack: 150, price: 90, kcal: 53, p: 6, f: 0, c: 6.6, al: ['soy', 'gluten'] },
  { id: 'adjika', name: 'Аджика острая', dept: 'canned', unit: 'г', pack: 200, price: 90, kcal: 59, p: 1, f: 3.7, c: 5.8, tags: ['spicy'], aka: 'острый острое чили' },

  // Хлеб
  { id: 'bread', name: 'Хлеб пшеничный', dept: 'bread', unit: 'г', pack: 400, forms: ['батон', 'батона', 'батонов'], price: 55, kcal: 264, p: 7.5, f: 2.9, c: 50.9, al: ['gluten'], aka: 'батон' },
  { id: 'rye_bread', name: 'Хлеб ржаной', dept: 'bread', unit: 'г', pack: 400, forms: ['буханка', 'буханки', 'буханок'], price: 60, kcal: 208, p: 6.6, f: 1.2, c: 40, al: ['gluten'], aka: 'бородинский' },
  { id: 'lavash', name: 'Лаваш тонкий', dept: 'bread', unit: 'г', pack: 250, price: 70, kcal: 275, p: 9, f: 1, c: 57, al: ['gluten'] },

  // Заморозка
  { id: 'broccoli', name: 'Брокколи замороженная', dept: 'frozen', unit: 'г', pack: 400, price: 170, kcal: 28, p: 3, f: 0.4, c: 5.2 },
  { id: 'veg_mix', name: 'Овощная смесь замороженная', dept: 'frozen', unit: 'г', pack: 400, price: 130, kcal: 50, p: 2.2, f: 0.5, c: 9 },
  { id: 'berries', name: 'Ягоды замороженные', dept: 'frozen', unit: 'г', pack: 300, price: 230, kcal: 40, p: 0.8, f: 0.3, c: 8, aka: 'ягода' },
  { id: 'pelmeni', name: 'Пельмени', dept: 'frozen', unit: 'г', pack: 800, price: 380, kcal: 275, p: 12, f: 13, c: 29, al: ['gluten', 'eggs'], tags: ['pork', 'beef'] },

  // Другое
  { id: 'tofu', name: 'Тофу', dept: 'other', unit: 'г', pack: 300, price: 160, kcal: 76, p: 8.1, f: 4.8, c: 1.9, al: ['soy'], tags: ['tofu'] },
  { id: 'water', name: 'Вода', dept: 'other', unit: 'мл', free: true, price: 0, kcal: 0, p: 0, f: 0, c: 0 },
];
