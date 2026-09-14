import { enumerateBench, diagnoseBench } from '../src/mod/engine';
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

// 4. 无解：预算 100（最便宜组合 350）
const d0 = diagnoseBench({ candidates: modSampleData, constraints: { budget: 100, maxWeight: null, requiredTags: [] }, weights, locks: {} });
assert(d0.suggestions.length > 0, 'no-solution gives relax suggestions');
assert(d0.suggestions.some(s => s.drop === 'budget'), 'suggests dropping budget');
assert(d0.suggestions[0].witness.violations.length === 0, 'witness is actually feasible');

// 5. 标签无解：要求静音（plate 只有 pc 带静音；switch silent-red；keycap oem-silent；foam ixpe 带静音）
// 静音组合存在；要求不可能的标签：构造 requiredTags=['焊接'] —— 没有任何 switch 带焊接 => 无解
const d1 = diagnoseBench({ candidates: modSampleData, constraints: { budget: null, maxWeight: null, requiredTags: ['焊接'] }, weights, locks: {} });
assert(d1.suggestions.some(s => s.drop === 'tag' && s.tag === '焊接'), 'suggests dropping impossible tag');

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
