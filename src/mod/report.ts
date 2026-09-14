import type {
  ModCandidate,
  ModCategory,
  ModConstraints,
  ModPlan,
  ModWeights,
  SavedPlan,
} from '@/types';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS } from '@/types';
import type { Diagnosis } from '@/mod/engine';

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function deltaText(delta: number, unit: string): string {
  if (delta === 0) return `±0 ${unit}`;
  return `${delta > 0 ? '+' : ''}${fmtNum(delta)} ${unit}`;
}

function constraintsLine(c: ModConstraints): string {
  const parts: string[] = [];
  parts.push(`预算 ≤ ${c.budget === null ? '不限' : `${c.budget} 元`}`);
  parts.push(`重量 ≤ ${c.maxWeight === null ? '不限' : `${c.maxWeight}g`}`);
  parts.push(`必含标签：${c.requiredTags.length ? c.requiredTags.map((t) => `#${t}`).join('、') : '无'}`);
  return parts.join('；');
}

function candidateMap(candidates: ModCandidate[]): Map<string, ModCandidate> {
  return new Map(candidates.map((c) => [c.id, c]));
}

function planComboNames(plan: ModPlan, lookup: Map<string, ModCandidate>): string[] {
  return MOD_CATEGORIES.map((cat) => {
    const id = plan.items[cat].candidateId;
    return lookup.get(id)?.name ?? id;
  });
}

function renderPlanSection(plan: ModPlan, index: number): string {
  const lines: string[] = [];
  lines.push(`### 方案 ${index + 1} · 总分 ${plan.totalScore.toFixed(2)}`);
  lines.push('');
  lines.push('| 类别 | 候选 | 手感 | 声音 | 价格分 | 重量分 | 变化 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const cat of MOD_CATEGORIES) {
    const item = plan.items[cat];
    lines.push(
      `| ${MOD_CATEGORY_LABELS[cat]} | ${item.name} | ${item.feel} | ${item.sound} | ${item.priceScore.toFixed(1)} | ${item.weightScore.toFixed(1)} | ${item.changed ? '🔁 替换' : '＝ 保持'} |`,
    );
  }
  lines.push('');
  lines.push(
    `- 合计价格：**${fmtNum(plan.totalPrice)} 元**（相对当前 ${deltaText(plan.priceDelta, '元')}）`,
  );
  lines.push(
    `- 合计重量：**${fmtNum(plan.totalWeight)}g**（相对当前 ${deltaText(plan.weightDelta, 'g')}）`,
  );
  lines.push(
    `- 维度得分：手感 ${plan.feelScore.toFixed(1)} / 声音 ${plan.soundScore.toFixed(1)} / 价格 ${plan.priceScore.toFixed(1)} / 重量 ${plan.weightScore.toFixed(1)}`,
  );
  lines.push(`- 替换部件数：${plan.changedCount} / 4`);
  lines.push(
    `- 超限项：${plan.violations.length === 0 ? '无' : plan.violations.map((v) => v.message).join('；')}`,
  );
  lines.push('');
  return lines.join('\n');
}

export interface ReportInput {
  candidates: ModCandidate[];
  constraints: ModConstraints;
  weights: ModWeights;
  plans: ModPlan[];
  totalEnumerated: number;
  diagnosis?: Diagnosis | null;
  savedPlans?: SavedPlan[];
}

export function buildDecisionReport(input: ReportInput): string {
  const { candidates, constraints, weights, plans, totalEnumerated, diagnosis } = input;
  const lookup = candidateMap(candidates);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const lines: string[] = [];
  lines.push('# KeyFeeling 改装方案决策报告');
  lines.push('');
  lines.push(`> 生成时间：${dateStr}`);
  lines.push('');
  lines.push('## 决策条件');
  lines.push('');
  lines.push(`- 约束：${constraintsLine(constraints)}`);
  lines.push(
    `- 权重：手感 ${weights.feel} / 声音 ${weights.sound} / 价格 ${weights.price} / 重量 ${weights.weight}（已归一化）`,
  );
  lines.push(
    `- 枚举组合总数：${totalEnumerated < 0 ? '达到上限' : totalEnumerated}，可行方案：${plans.length}`,
  );
  lines.push('');
  lines.push('## 排序规则');
  lines.push('');
  lines.push(
    '加权总分降序；同分时依次按 总价升序 → 总重升序 → 手感分降序 → 声音分降序 → 组合键字典序，保证顺序稳定可复现。',
  );
  lines.push('');

  if (plans.length > 0) {
    lines.push('## 推荐方案（按排名）');
    lines.push('');
    plans.slice(0, 20).forEach((p, i) => lines.push(renderPlanSection(p, i)));
    if (plans.length > 20) {
      lines.push(`_仅展示前 20 个方案，共 ${plans.length} 个可行方案。_`);
      lines.push('');
    }
  } else if (diagnosis) {
    lines.push('## 无可行方案');
    lines.push('');
    lines.push('当前约束下 **没有任何组合可行**，系统不会伪造方案。');
    lines.push('');
    if (diagnosis.reasons.length > 0) {
      lines.push('### 冲突原因');
      lines.push('');
      diagnosis.reasons.forEach((r) => lines.push(`- ${r.message}`));
      lines.push('');
    }
    if (diagnosis.suggestions.length > 0) {
      lines.push('### 最少放宽建议');
      lines.push('');
      const labelFor = (s: (typeof diagnosis.suggestions)[number]) => {
        if (s.drop === 'budget') return '取消预算上限';
        if (s.drop === 'weight') return '取消重量上限';
        return `取消必含标签 #${s.tag}`;
      };
      diagnosis.suggestions.forEach((s, i) => {
        lines.push(
          `${i + 1}. **${labelFor(s)}** —— 放宽后立即有解，例如：${planComboNames(s.witness, lookup).join(' + ')}（总分 ${s.witness.totalScore.toFixed(2)}，${fmtNum(s.witness.totalPrice)} 元 / ${fmtNum(s.witness.totalWeight)}g）`,
        );
      });
      lines.push('');
    }
    if (diagnosis.nearestInfeasible) {
      const p = diagnosis.nearestInfeasible;
      lines.push('### 最接近可行的组合');
      lines.push('');
      lines.push(
        `- 组合：${planComboNames(p, lookup).join(' + ')}`,
      );
      lines.push(`- ${p.violations.map((v) => v.message).join('；')}`);
      lines.push('');
    }
  }

  if (input.savedPlans && input.savedPlans.length > 0) {
    lines.push('## 已收藏方案');
    lines.push('');
    input.savedPlans.forEach((p, i) => {
      const names = MOD_CATEGORIES.map((cat: ModCategory) => {
        const id = p.candidateIds[cat];
        return lookup.get(id)?.name ?? id;
      });
      lines.push(
        `${i + 1}. **${p.name}** — ${names.join(' + ')}；总分 ${p.totalScore.toFixed(2)}，${fmtNum(p.totalPrice)} 元 / ${fmtNum(p.totalWeight)}g`,
      );
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateReportFilename(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `keyfeeling-decision-report-${dateStr}.md`;
}
