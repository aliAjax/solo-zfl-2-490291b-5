import { enumerateBench, diagnoseBench } from '../src/mod/engine';
import { buildDecisionReport } from '../src/mod/report';
import { modSampleData } from '../src/data/modSampleData';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failures++; }
  else console.log('ok:', msg);
}

const weights = { feel: 4, sound: 3, price: 2, weight: 1 };

// 1. 默认无约束：有解，组合数 = 5*5*4*4 = 400
const r0 = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: {} });
assert(r0.structuralError === null, 'no structural error');
assert(r0.totalEnumerated === 400, `enumerated 400, got ${r0.totalEnumerated}`);
assert(r0.plans.length === 400, `400 feasible, got ${r0.plans.length}`);

// 排序稳定：总分非增
let sorted = true;
for (let i = 1; i < r0.plans.length; i++) {
  if (r0.plans[i].totalScore > r0.plans[i-1].totalScore) sorted = false;
}
assert(sorted, 'plans sorted by totalScore desc');

// 2. 唯一解：锁定三类 + 极宽约束
const lock3 = { switch: 'sw-gateron-yellow', keycap: 'kc-budget-abs', plate: 'pl-pc' };
const r1 = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: lock3 });
assert(r1.plans.length === 4, `lock3 => 4 (foam x4), got ${r1.plans.length}`);

// 锁定全部四类 -> 1 个方案
const lock4 = { ...lock3, foam: 'fm-none' };
const r2 = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: lock4 });
assert(r2.plans.length === 1, `lock4 => 1, got ${r2.plans.length}`);

// 3. 边界值：预算恰好等于某方案价格
// 锁全部为最便宜组合：yellow 120 + budget abs 80 + ? 最便宜 plate: pc150/fr4 160/alu180; foam none 0
// 120+80+150+0 = 350
const cheapLocks = { switch: 'sw-gateron-yellow', keycap: 'kc-budget-abs', plate: 'pl-pc', foam: 'fm-none' };
const r3 = enumerateBench({ candidates: modSampleData, constraints: { budget: 350, maxWeight: null, requiredTags: [] }, weights, locks: cheapLocks });
assert(r3.plans.length === 1, `budget==price boundary feasible, got ${r3.plans.length}`);
const r3b = enumerateBench({ candidates: modSampleData, constraints: { budget: 349.99, maxWeight: null, requiredTags: [] }, weights, locks: cheapLocks });
assert(r3b.plans.length === 0, `budget one cent below => infeasible, got ${r3b.plans.length}`);

// 4. 无解：预算 100（最便宜组合 350）—— 单项放宽即可解决
const d0 = diagnoseBench({ candidates: modSampleData, constraints: { budget: 100, maxWeight: null, requiredTags: [] }, weights, locks: {} });
assert(d0.groups.length > 0, 'no-solution gives relax groups');
assert(d0.groups.some(g => g.drops.length === 1 && g.drops[0].type === 'budget'), 'single group: drop budget');
assert(d0.groups.every(g => g.witness.violations.length === 0), 'every witness is actually feasible');
assert(d0.groups[0].drops.length === 1, 'minimum relax size for budget-only is 1');

// 5. 标签无解：要求没有候选能四类同时满足的标签 —— 单项放宽
const d1 = diagnoseBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: ['焊接'] }, weights, locks: {} });
assert(d1.groups.some(g => g.drops.length === 1 && g.drops[0].type === 'tag' && g.drops[0].tag === '焊接'), 'single group: drop impossible tag');

// 5b. 复合无解：单组合，预算与重量同时超限，单项放宽均无解 -> 必须两项一起放宽
const mk = (category, id, price, weight, tags = []) => ({
  id, category, name: id, price, feel: 5, sound: 5, weight, tags, isCurrent: false,
});
// 合计价格 500、合计重量 1000（轴100/200 + 帽100/200 + 板150/300 + 棉150/300）
const oneCombo = [
  mk('switch', 's1', 100, 200),
  mk('keycap', 'k1', 100, 200),
  mk('plate', 'p1', 150, 300),
  mk('foam', 'f1', 150, 300),
];
const d2 = diagnoseBench({ candidates: oneCombo, constraints: { budget: 400, maxWeight: 900, requiredTags: [] }, weights, locks: {} });
assert(d2.groups.length === 1, `two-relax: exactly 1 group, got ${d2.groups.length}`);
assert(d2.groups[0].drops.length === 2, `two-relax: group size 2, got ${d2.groups[0].drops.length}`);
assert(d2.groups[0].drops.some(d => d.type === 'budget') && d2.groups[0].drops.some(d => d.type === 'weight'),
  'two-relax: group contains budget + weight');
assert(d2.groups[0].witness.violations.length === 0, 'two-relax: witness feasible');
assert(d2.groups[0].witness.totalPrice === 500 && d2.groups[0].witness.totalWeight === 1000, 'two-relax: witness is the only combo');
// 绝不列出单独可用的单项建议
assert(!d2.groups.some(g => g.drops.length === 1), 'two-relax: no single-item fake suggestion');

// 5c. 三项同放宽：预算、重量、标签同时超限，任何 1~2 项放宽都无解
const d3 = diagnoseBench({ candidates: oneCombo, constraints: { budget: 400, maxWeight: 900, requiredTags: ['X'] }, weights, locks: {} });
assert(d3.groups.length === 1, `three-relax: 1 group, got ${d3.groups.length}`);
assert(d3.groups[0].drops.length === 3, `three-relax: group size 3, got ${d3.groups[0].drops.length}`);
assert(d3.groups[0].drops.some(d => d.type === 'budget'), 'three-relax: contains budget');
assert(d3.groups[0].drops.some(d => d.type === 'weight'), 'three-relax: contains weight');
assert(d3.groups[0].drops.some(d => d.type === 'tag' && d.tag === 'X'), 'three-relax: contains tag X');
assert(d3.groups[0].witness.violations.length === 0, 'three-relax: witness feasible');
assert(!d3.groups.some(g => g.drops.length < 3), 'three-relax: no smaller fake groups');

// 5c-2. 复合无解报告：两项组与三项组都渲染为「必须同时放宽」，且无单项假建议
const reportTwo = buildDecisionReport({
  candidates: oneCombo,
  constraints: { budget: 400, maxWeight: 900, requiredTags: [] },
  weights, plans: [], totalEnumerated: 1, diagnosis: d2,
});
assert(reportTwo.includes('取消预算上限 + 取消重量上限'), 'report: two-relax joined label');
assert(reportTwo.includes('（必须同时放宽）'), 'report: marks togetherness');
const reportThree = buildDecisionReport({
  candidates: oneCombo,
  constraints: { budget: 400, maxWeight: 900, requiredTags: ['X'] },
  weights, plans: [], totalEnumerated: 1, diagnosis: d3,
});
assert(reportThree.includes('取消预算上限 + 取消重量上限 + 取消必含标签 #X'), 'report: three-relax joined label');

// 5d. 同层存在两个不同的两项组：（标签+重量）或（标签+预算）各解锁一个组合
// 非填充合计：价格 350、重量 700
const twoCombo = [
  mk('switch', 's1', 100, 200),
  mk('keycap', 'k1', 100, 200),
  mk('plate', 'p1', 150, 300),
  mk('foam', 'fCheapHeavy', 150, 800), // A: 总价 500 / 总重 1500（超重量，不超预算）
  mk('foam', 'fPriceyLight', 500, 50), // B: 总价 850 / 总重 750（超预算，不超重量）
];
const d4 = diagnoseBench({ candidates: twoCombo, constraints: { budget: 600, maxWeight: 1000, requiredTags: ['X'] }, weights, locks: {} });
assert(d4.groups.length === 2, `multi-group: 2 groups at min layer, got ${d4.groups.length}`);
assert(d4.groups.every(g => g.drops.length === 2), 'multi-group: both groups are size 2');
assert(d4.groups.every(g => g.drops.some(d => d.type === 'tag' && d.tag === 'X')), 'multi-group: both include tag X');
assert(d4.groups.every(g => g.witness.violations.length === 0), 'multi-group: both witnesses feasible');
const wA = d4.groups.find(g => g.drops.some(d => d.type === 'weight'));
const wB = d4.groups.find(g => g.drops.some(d => d.type === 'budget'));
assert(wA && wA.witness.totalWeight === 1500, 'multi-group: dropping tag+weight unlocks heavy-cheap combo');
assert(wB && wB.witness.totalPrice === 850, 'multi-group: dropping tag+budget unlocks light-pricey combo');

// 6. 重量边界
// 锁定 heaviest: brass plate 700 + sa keycap 480 + box navy 300 + silicone 180 = 1660
const heavy = { switch: 'sw-box-navy', keycap: 'kc-sa-pbt', plate: 'pl-brass', foam: 'fm-silicone' };
const r4 = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: 1660, requiredTags: [] }, weights, locks: heavy });
assert(r4.plans.length === 1, `weight exact boundary feasible, got ${r4.plans.length}`);

// 7. 空类别 -> 结构错误
const noFoam = modSampleData.filter(c => c.category !== 'foam');
const r5 = enumerateBench({ candidates: noFoam, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: {} });
assert(r5.structuralError !== null && r5.structuralError.includes('填充'), 'empty category structural error');

// 8. 权重全零 -> 等权，不崩溃
const r6 = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights: { feel: 0, sound: 0, price: 0, weight: 0 }, locks: lock4 });
assert(r6.plans.length === 1, 'zero weights still works');

// 9. 确定性：两次枚举第一名相同
const a = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: {} });
const b = enumerateBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: [] }, weights, locks: {} });
assert(a.plans[0].comboKey === b.plans[0].comboKey, 'deterministic top plan');

// 10. 变化对比：锁 cheapLocks 时相对当前 changedCount=4
assert(r2.plans[0].changedCount === 4, `all-4 changed vs current, got ${r2.plans[0].changedCount}`);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nALL ENGINE SANITY CHECKS PASSED');
