import type {
  BenchResult,
  ModCandidate,
  ModCategory,
  ModConstraints,
  ModPlan,
  ModWeights,
  PlanItemScore,
  PlanViolation,
  RelaxSuggestion,
} from '@/types';
import { MOD_CATEGORIES } from '@/types';

/** 枚举组合数硬上限，防止候选过多时卡死 */
export const COMBO_HARD_CAP = 200000;

export interface NormEntry {
  candidateId: string;
  priceScore: number;
  weightScore: number;
}

export interface NormalizedPools {
  byCategory: Record<ModCategory, Map<string, NormEntry>>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function scoreMap(values: number[], invert: boolean): number[] {
  // values 与返回按下标一一对应；单个候选时给满分
  if (values.length <= 1) return values.map(() => 100);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 100);
  // invert=true：值越小得分越高（价格、重量）
  return values.map((v) => {
    const t = (v - min) / (max - min);
    return round2((invert ? 1 - t : t) * 100);
  });
}

/** 对每个类别候选池做确定性归一化（与约束/锁定无关，保证结果可解释） */
export function normalizePools(candidates: ModCandidate[]): NormalizedPools {
  const byCategory = {} as Record<ModCategory, Map<string, NormEntry>>;
  for (const cat of MOD_CATEGORIES) {
    const pool = candidates
      .filter((c) => c.category === cat)
      .sort((a, b) => a.id.localeCompare(b.id));
    const priceScores = scoreMap(pool.map((c) => c.price), true);
    const weightScores = scoreMap(pool.map((c) => c.weight), true);
    const map = new Map<string, NormEntry>();
    pool.forEach((c, i) => {
      map.set(c.id, {
        candidateId: c.id,
        priceScore: priceScores[i],
        weightScore: weightScores[i],
      });
    });
    byCategory[cat] = map;
  }
  return { byCategory };
}

export interface CandidateLookup {
  byId: Map<string, ModCandidate>;
  byCategory: Record<ModCategory, ModCandidate[]>;
}

function buildLookup(candidates: ModCandidate[]): CandidateLookup {
  const byId = new Map<string, ModCandidate>();
  const byCategory = {} as Record<ModCategory, ModCandidate[]>;
  for (const cat of MOD_CATEGORIES) byCategory[cat] = [];
  for (const c of candidates) {
    byId.set(c.id, c);
    if (byCategory[c.category]) byCategory[c.category].push(c);
  }
  for (const cat of MOD_CATEGORIES) {
    byCategory[cat].sort((a, b) => a.id.localeCompare(b.id));
  }
  return { byId, byCategory };
}

function effectiveWeights(w: ModWeights): { feel: number; sound: number; price: number; weight: number } {
  const sum = w.feel + w.sound + w.price + w.weight;
  if (sum <= 0) return { feel: 0.25, sound: 0.25, price: 0.25, weight: 0.25 };
  return {
    feel: w.feel / sum,
    sound: w.sound / sum,
    price: w.price / sum,
    weight: w.weight / sum,
  };
}

function checkViolations(
  combo: ModCandidate[],
  constraints: ModConstraints,
): PlanViolation[] {
  const violations: PlanViolation[] = [];
  const totalPrice = combo.reduce((s, c) => s + c.price, 0);
  const totalWeight = combo.reduce((s, c) => s + c.weight, 0);

  if (constraints.budget !== null && totalPrice > constraints.budget) {
    violations.push({
      type: 'budget',
      missingBy: round2(totalPrice - constraints.budget),
      message: `超预算 ${round2(totalPrice - constraints.budget)} 元（合计 ${round2(totalPrice)} / 上限 ${constraints.budget}）`,
    });
  }
  if (constraints.maxWeight !== null && totalWeight > constraints.maxWeight) {
    violations.push({
      type: 'weight',
      missingBy: round2(totalWeight - constraints.maxWeight),
      message: `超重 ${round2(totalWeight - constraints.maxWeight)}g（合计 ${round2(totalWeight)}g / 上限 ${constraints.maxWeight}g）`,
    });
  }
  for (const tag of constraints.requiredTags) {
    const missing = combo.filter((c) => !c.tags.includes(tag));
    if (missing.length > 0) {
      violations.push({
        type: 'tag',
        tag,
        missingBy: missing.length,
        message: `缺少兼容标签 #${tag}：${missing.map((c) => c.name).join('、')}`,
      });
    }
  }
  return violations;
}

export interface BuildPlanInput {
  combo: ModCandidate[];
  pools: NormalizedPools;
  weights: ModWeights;
  baseline: Partial<Record<ModCategory, ModCandidate>>;
  constraints: ModConstraints;
}

/** 由一个组合（每类一个候选）构建完整方案，含逐项/组合得分、变化与违规项 */
export function buildPlan({ combo, pools, weights, baseline, constraints }: BuildPlanInput): ModPlan {
  const items = {} as Record<ModCategory, PlanItemScore>;
  let totalPrice = 0;
  let totalWeight = 0;
  let feelSum = 0;
  let soundSum = 0;
  let priceScoreSum = 0;
  let weightScoreSum = 0;
  let baselinePrice = 0;
  let baselineWeight = 0;
  let changedCount = 0;

  for (const cat of MOD_CATEGORIES) {
    const c = combo.find((x) => x.category === cat);
    if (!c) throw new Error(`组合缺少类别: ${cat}`);
    const norm = pools.byCategory[cat].get(c.id) ?? { candidateId: c.id, priceScore: 100, weightScore: 100 };
    const base = baseline[cat];
    const changed = !base || base.id !== c.id;
    if (changed) changedCount++;
    if (base) {
      baselinePrice += base.price;
      baselineWeight += base.weight;
    }
    items[cat] = {
      candidateId: c.id,
      name: c.name,
      feel: c.feel,
      sound: c.sound,
      priceScore: norm.priceScore,
      weightScore: norm.weightScore,
      changed,
    };
    totalPrice += c.price;
    totalWeight += c.weight;
    feelSum += c.feel;
    soundSum += c.sound;
    priceScoreSum += norm.priceScore;
    weightScoreSum += norm.weightScore;
  }

  const n = MOD_CATEGORIES.length;
  const feelScore = round2((feelSum / n) * 10); // 0-10 → 0-100
  const soundScore = round2((soundSum / n) * 10);
  const priceScore = round2(priceScoreSum / n);
  const weightScore = round2(weightScoreSum / n);

  const w = effectiveWeights(weights);
  const totalScore = round2(
    feelScore * w.feel + soundScore * w.sound + priceScore * w.price + weightScore * w.weight,
  );

  const comboKey = MOD_CATEGORIES.map((cat) => items[cat].candidateId).join('|');

  return {
    items,
    totalPrice: round2(totalPrice),
    totalWeight: round2(totalWeight),
    feelScore,
    soundScore,
    priceScore,
    weightScore,
    totalScore,
    priceDelta: round2(totalPrice - baselinePrice),
    weightDelta: round2(totalWeight - baselineWeight),
    changedCount,
    comboKey,
    violations: checkViolations(combo, constraints),
  };
}

/** 稳定排序比较器：总分降序，平手依次按价格升、重量升、手感降、声音降，最后按 comboKey 字典序 */
export function comparePlans(a: ModPlan, b: ModPlan): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
  if (a.totalWeight !== b.totalWeight) return a.totalWeight - b.totalWeight;
  if (b.feelScore !== a.feelScore) return b.feelScore - a.feelScore;
  if (b.soundScore !== a.soundScore) return b.soundScore - a.soundScore;
  return a.comboKey.localeCompare(b.comboKey);
}

interface ActiveFilters {
  allowBudget: boolean;
  allowWeight: boolean;
  /** 仍然生效的必含标签 */
  activeTags: string[];
}

/**
 * 枚举全部组合。
 * - locks：用户锁定的候选（类别 -> id），失效锁定会被忽略并在 structuralError 之外提示。
 * - feasibility：true 时只返回满足约束的组合；false 时返回全部组合（用于无解诊断）。
 */
function enumeratePlans(
  lookup: CandidateLookup,
  pools: NormalizedPools,
  weights: ModWeights,
  baseline: Partial<Record<ModCategory, ModCandidate>>,
  constraints: ModConstraints,
  locks: Partial<Record<ModCategory, string>>,
  filters: ActiveFilters,
  feasibility: boolean,
): { plans: ModPlan[]; count: number; truncated: boolean } {
  const effectiveConstraints: ModConstraints = {
    budget: filters.allowBudget ? constraints.budget : null,
    maxWeight: filters.allowWeight ? constraints.maxWeight : null,
    requiredTags: filters.activeTags,
  };

  const plans: ModPlan[] = [];
  let count = 0;
  let truncated = false;

  const chosen: ModCandidate[] = [];

  const dfs = (depth: number): boolean => {
    if (depth === MOD_CATEGORIES.length) {
      count++;
      const plan = buildPlan({
        combo: [...chosen],
        pools,
        weights,
        baseline,
        constraints: effectiveConstraints,
      });
      if (!feasibility || plan.violations.length === 0) {
        plans.push(plan);
      }
      if (count >= COMBO_HARD_CAP) {
        truncated = true;
        return false; // 停止枚举
      }
      return true;
    }
    const cat = MOD_CATEGORIES[depth];
    const lockId = locks[cat];
    let pool = lookup.byCategory[cat];
    if (lockId) {
      const locked = pool.find((c) => c.id === lockId);
      if (locked) pool = [locked];
    }
    for (const c of pool) {
      chosen.push(c);
      if (!dfs(depth + 1)) return false;
      chosen.pop();
    }
    return true;
  };

  dfs(0);
  return { plans, count, truncated };
}

export interface EnumerateInput {
  candidates: ModCandidate[];
  constraints: ModConstraints;
  weights: ModWeights;
  locks: Partial<Record<ModCategory, string>>;
}

/** 主入口：校验结构 → 枚举可行组合 → 稳定排序 */
export function enumerateBench({ candidates, constraints, weights, locks }: EnumerateInput): BenchResult {
  const lookup = buildLookup(candidates);
  const pools = normalizePools(candidates);
  const baseline: Partial<Record<ModCategory, ModCandidate>> = {};

  // 结构问题：空类别
  const emptyCats = MOD_CATEGORIES.filter((cat) => lookup.byCategory[cat].length === 0);
  if (emptyCats.length > 0) {
    return {
      plans: [],
      totalEnumerated: 0,
      truncated: false,
      structuralError: `以下类别还没有候选，无法组成方案：${emptyCats
        .map((c) => ({ switch: '轴体', keycap: '键帽', plate: '定位板', foam: '填充' })[c])
        .join('、')}`,
      activeLocks: {},
    };
  }

  // 失效锁定过滤
  const activeLocks: Partial<Record<ModCategory, string>> = {};
  for (const cat of MOD_CATEGORIES) {
    const id = locks[cat];
    if (id && lookup.byId.has(id) && lookup.byId.get(id)!.category === cat) {
      activeLocks[cat] = id;
    }
  }

  for (const cat of MOD_CATEGORIES) {
    const cur = lookup.byCategory[cat].find((c) => c.isCurrent);
    if (cur) baseline[cat] = cur;
  }

  const { plans, count, truncated } = enumeratePlans(
    lookup,
    pools,
    weights,
    baseline,
    constraints,
    activeLocks,
    { allowBudget: true, allowWeight: true, activeTags: [...constraints.requiredTags] },
    true,
  );

  plans.sort(comparePlans);

  return {
    plans,
    totalEnumerated: truncated ? -1 : count,
    truncated,
    structuralError: null,
    activeLocks,
  };
}

export interface Diagnosis {
  /** 无解原因概览（按违规类型聚合） */
  reasons: PlanViolation[];
  /** 最少放宽建议，按「放宽数量升序、预算优先、重量其次、标签最后」稳定排列 */
  suggestions: RelaxSuggestion[];
  /** 违规最少的一个不可行组合（用于展示差距） */
  nearestInfeasible: ModPlan | null;
  totalEnumerated: number;
  truncated: boolean;
}

interface ConstraintKey {
  kind: 'budget' | 'weight' | 'tag';
  tag?: string;
  /** 固定优先级：预算 0 < 重量 1 < 标签 2+ */
  priority: number;
}

/**
 * 无解诊断：枚举所有「约束子集」（按放弃数量升序），
 * 找出最少放宽哪些约束即可出现可行组合。绝不伪造方案。
 */
export function diagnoseBench({ candidates, constraints, weights, locks }: EnumerateInput): Diagnosis {
  const lookup = buildLookup(candidates);
  const pools = normalizePools(candidates);
  const baseline: Partial<Record<ModCategory, ModCandidate>> = {};
  for (const cat of MOD_CATEGORIES) {
    const cur = lookup.byCategory[cat].find((c) => c.isCurrent);
    if (cur) baseline[cat] = cur;
  }

  const activeLocks: Partial<Record<ModCategory, string>> = {};
  for (const cat of MOD_CATEGORIES) {
    const id = locks[cat];
    if (id && lookup.byId.has(id) && lookup.byId.get(id)!.category === cat) {
      activeLocks[cat] = id;
    }
  }

  // 全部约束（固定顺序）
  const allKeys: ConstraintKey[] = [];
  if (constraints.budget !== null) allKeys.push({ kind: 'budget', priority: 0 });
  if (constraints.maxWeight !== null) allKeys.push({ kind: 'weight', priority: 1 });
  constraints.requiredTags.forEach((tag, i) =>
    allKeys.push({ kind: 'tag', tag, priority: 2 + i }),
  );

  const fullFilters: ActiveFilters = {
    allowBudget: constraints.budget !== null,
    allowWeight: constraints.maxWeight !== null,
    activeTags: [...constraints.requiredTags],
  };

  // 先确认确实无解，并收集全部组合用于选取「最接近可行」的组合
  const all = enumeratePlans(
    lookup,
    pools,
    weights,
    baseline,
    constraints,
    activeLocks,
    fullFilters,
    false,
  );

  const infeasible = all.plans.filter((p) => p.violations.length > 0);

  // 违规项聚合概览
  const reasonMap = new Map<string, PlanViolation>();
  for (const p of infeasible) {
    for (const v of p.violations) {
      const key = v.type === 'tag' ? `tag:${v.tag}` : v.type;
      const existing = reasonMap.get(key);
      if (!existing || v.missingBy > existing.missingBy) reasonMap.set(key, v);
    }
  }
  const reasons = [
    reasonMap.get('budget'),
    reasonMap.get('weight'),
    ...constraints.requiredTags.map((t) => reasonMap.get(`tag:${t}`)),
  ].filter((v): v is PlanViolation => Boolean(v));

  // 违规数最少，再按超出量总和最小，最后 comboKey 稳定
  const violationSeverity = (p: ModPlan) =>
    p.violations.reduce((s, v) => s + (v.type === 'tag' ? 1 : v.missingBy), 0);
  const nearestInfeasible =
    infeasible
      .slice()
      .sort(
        (a, b) =>
          a.violations.length - b.violations.length ||
          violationSeverity(a) - violationSeverity(b) ||
          a.comboKey.localeCompare(b.comboKey),
      )[0] ?? null;

  // 枚举约束子集：先按放弃数量升序，找到第一层可行子集即停止
  const suggestions: RelaxSuggestion[] = [];
  const seenSuggestionKeys = new Set<string>();
  const subsets = enumerateSubsets(allKeys);
  let droppedSize = -1;

  outer: for (const dropped of subsets) {
    if (dropped.length === 0) continue; // 空集=原约束，已知无解
    if (droppedSize >= 0 && dropped.length > droppedSize) break; // 已找到更优层

    const droppedSet = new Set(dropped.map((k) =>
      k.kind === 'tag' ? `tag:${k.tag}` : k.kind,
    ));
    const filters: ActiveFilters = {
      allowBudget: !droppedSet.has('budget') && constraints.budget !== null,
      allowWeight: !droppedSet.has('weight') && constraints.maxWeight !== null,
      activeTags: constraints.requiredTags.filter((t) => !droppedSet.has(`tag:${t}`)),
    };

    const { plans, truncated } = enumeratePlans(
      lookup,
      pools,
      weights,
      baseline,
      constraints,
      activeLocks,
      filters,
      true,
    );
    if (truncated) break;

    if (plans.length > 0) {
      droppedSize = dropped.length;
      const ordered = dropped.slice().sort((a, b) => a.priority - b.priority);
      // 见证方案取该放宽下排名第一的方案
      const witness = plans.slice().sort(comparePlans)[0];
      for (const key of ordered) {
        const dedupeKey = key.kind === 'tag' ? `tag:${key.tag}` : key.kind;
        if (seenSuggestionKeys.has(dedupeKey)) continue;
        seenSuggestionKeys.add(dedupeKey);
        suggestions.push({
          drop: key.kind,
          tag: key.tag,
          witness,
          priority: key.priority,
        });
      }
      if (suggestions.length >= 6) break outer;
    }
  }

  suggestions.sort((a, b) => a.priority - b.priority);

  return {
    reasons,
    suggestions,
    nearestInfeasible,
    totalEnumerated: all.truncated ? -1 : all.count,
    truncated: all.truncated,
  };
}

/** 枚举全部子集，按元素个数升序、同层按优先级位掩码稳定排列 */
function enumerateSubsets<T>(items: T[]): T[][] {
  const result: T[][] = [];
  const n = items.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(items[i]);
    }
    result.push(subset);
  }
  result.sort((a, b) => a.length - b.length);
  return result;
}
