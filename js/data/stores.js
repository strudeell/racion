// Магазины.
// k — насколько цены в магазине отличаются от средних: 1 — как в среднем,
// 0.85 — на 15% дешевле, 1.3 — на 30% дороже.
// badge и color — буква и цвет значка в анкете.

export const STORES = [
  { id: 'p5',          name: 'Пятёрочка',    tier: 'Рядом с домом · недорого',  k: 1.00, badge: '5',  color: '#D8232A' },
  { id: 'magnit',      name: 'Магнит',       tier: 'Рядом с домом · недорого',  k: 0.98, badge: 'М',  color: '#E3262D' },
  { id: 'dixy',        name: 'Дикси',        tier: 'Рядом с домом',             k: 1.03, badge: 'Д',  color: '#F07D19' },
  { id: 'chizhik',     name: 'Чижик',        tier: 'Дискаунтер · самое нужное', k: 0.86, badge: 'Ч',  color: '#FFD02B', ink: '#2B2118' },
  { id: 'svetofor',    name: 'Светофор',     tier: 'Дискаунтер · большие пачки', k: 0.80, badge: 'С', color: '#C8242B' },
  { id: 'perekrestok', name: 'Перекрёсток',  tier: 'Выбор побольше',            k: 1.12, badge: 'П',  color: '#0F8A3C' },
  { id: 'lenta',       name: 'Лента',        tier: 'Гипермаркет',               k: 0.96, badge: 'Л',  color: '#16398F' },
  { id: 'auchan',      name: 'Ашан',         tier: 'Гипермаркет · впрок',       k: 0.95, badge: 'А',  color: '#DC1F26' },
  { id: 'metro',       name: 'Метро',        tier: 'Мелкий опт',                k: 0.93, badge: 'M',  color: '#0D2C6C', ink: '#FFE24A' },
  { id: 'vkusvill',    name: 'ВкусВилл',     tier: 'Своя продукция',            k: 1.30, badge: 'В',  color: '#23A047' },
  { id: 'azbuka',      name: 'Азбука вкуса', tier: 'Премиум',                   k: 1.75, badge: 'АВ', color: '#24473A' },
  { id: 'lavka',       name: 'Яндекс Лавка', tier: 'Доставка',                  k: 1.25, badge: 'Л',  color: '#FFD43B', ink: '#2B2118' },
  { id: 'samokat',     name: 'Самокат',      tier: 'Доставка',                  k: 1.22, badge: 'С',  color: '#FF3B64' },
];
