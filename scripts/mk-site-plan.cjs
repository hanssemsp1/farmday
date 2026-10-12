// 사이트 전용 간단 기획서(옵션·가격만) — 대표님 기존 세트를 사이트에 올릴 때
// node scripts/mk-site-plan.cjs "<id>" <카테고리> "<공급처 메모>" [--tax] "라벨=공급가[+배송비]" ...
// 사이트 순이익 = 판매가×0.965 − 공급가 − 배송비 (− 과세면 (판매가−공급가)/11) ≥ 판매가의 15% 인 가장 낮은 x,900원
const fs = require('fs');
const args = process.argv.slice(2); const tax = args.includes('--tax'); const [id, category, vendor, ...opts] = args.filter((a) => a !== '--tax');
const netOf = (p, cost, ship) => p * 0.965 - cost - ship - (tax ? (p - cost) / 11 : 0);
const options = opts.map((s) => { const [label, c] = s.split('='); const [cost, ship = 0] = c.split('+').map(Number);
  let site = 900; while (netOf(site, cost, ship) < site * 0.15) site += 1000; const net = Math.round(netOf(site, cost, ship));
  return { label, weight: label, cost, shipping: ship, fee: 0.035, price: site, sitePriceFixed: site, note: `사이트 전용 · 공급가 ${cost}${ship ? ' + 배송비 ' + ship : ''}${tax ? ' · 과세(부가세 제외 계산)' : ''} · 순이익 ${net}원(${(net / site * 100).toFixed(1)}%)` }; });
const plan = { id, category, status: '사이트', vendor: { name: vendor }, options, content: { notes: ['대표님 기존 세트를 사이트에 다시 올림 — 쿠팡 배송안내·이벤트 장 빼고 교환반품은 사이트 공통 장'] } };
const f = 'plans/site/' + id.replace(/[\/:*?"<>|\[\] ]/g, '_') + '.json';
fs.writeFileSync(f, JSON.stringify(plan, null, 2));
for (const o of options) console.log(o.label, o.sitePriceFixed, o.note.split('· ').pop());
console.log(f);
