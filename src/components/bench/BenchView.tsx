import { useMemo, useState } from 'react';
import { FlaskConical, FileDown, Bookmark, Trash2, Wrench, Boxes } from 'lucide-react';
import { useModStore } from '@/store/useModStore';
import { enumerateBench, diagnoseBench } from '@/mod/engine';
import { buildDecisionReport, downloadMarkdown, generateReportFilename } from '@/mod/report';
import type { ModConstraints, ModPlan, RelaxGroup } from '@/types';
import ControlsPanel from './ControlsPanel';
import CandidatePanel from './CandidatePanel';
import PlanCard from './PlanCard';
import NoSolutionPanel from './NoSolutionPanel';
import Section from '@/components/form/Section';

const RENDER_CAP = 100;

export default function BenchView() {
  const {
    candidates,
    constraints,
    weights,
    locks,
    savedPlans,
    setConstraints,
    savePlan,
    deleteSavedPlan,
    toggleLock,
  } = useModStore();

  const [showAll, setShowAll] = useState(false);

  const result = useMemo(
    () => enumerateBench({ candidates, constraints, weights, locks }),
    [candidates, constraints, weights, locks],
  );

  const diagnosis = useMemo(() => {
    if (result.structuralError) return null;
    if (result.plans.length > 0) return null;
    return diagnoseBench({ candidates, constraints, weights, locks });
  }, [result, candidates, constraints, weights, locks]);

  const handleSave = (plan: ModPlan) => {
    savePlan({
      comboKey: plan.comboKey,
      candidateIds: {
        switch: plan.items.switch.candidateId,
        keycap: plan.items.keycap.candidateId,
        plate: plan.items.plate.candidateId,
        foam: plan.items.foam.candidateId,
      },
      totalPrice: plan.totalPrice,
      totalWeight: plan.totalWeight,
      totalScore: plan.totalScore,
    });
  };

  /** 一次应用整组必须一起放宽的约束（单项组即原有单项放宽行为） */
  const applyRelaxGroup = (group: RelaxGroup) => {
    const patch: Partial<ModConstraints> = {};
    let tags = [...constraints.requiredTags];
    let touchesTag = false;
    for (const d of group.drops) {
      if (d.type === 'budget') patch.budget = null;
      else if (d.type === 'weight') patch.maxWeight = null;
      else if (d.type === 'tag' && d.tag) {
        touchesTag = true;
        tags = tags.filter((t) => t !== d.tag);
      }
    }
    if (touchesTag) patch.requiredTags = tags;
    setConstraints(patch);
  };

  const loadSavedCombo = (comboKey: string) => {
    const saved = savedPlans.find((p) => p.comboKey === comboKey);
    if (!saved) return;
    (Object.entries(saved.candidateIds) as [keyof typeof saved.candidateIds, string][]).forEach(
      ([cat, id]) => {
        if (locks[cat] !== id) toggleLock(cat, id);
      },
    );
  };

  const handleExport = () => {
    const report = buildDecisionReport({
      candidates,
      constraints,
      weights,
      plans: result.plans,
      totalEnumerated: result.totalEnumerated,
      diagnosis,
      savedPlans,
    });
    downloadMarkdown(report, generateReportFilename());
  };

  const visiblePlans = showAll ? result.plans : result.plans.slice(0, RENDER_CAP);

  return (
    <div className="space-y-5" data-testid="bench-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="keycap !h-10 !w-10 !min-w-[40px] !rounded-lg !text-base">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mono text-lg font-bold text-gradient-brass leading-tight">
              改装方案决策台
            </h2>
            <p className="text-xs text-ink-500">枚举全部可行组合，按你的权重排序，无解时告诉你最少放宽什么</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-ghost text-xs" data-testid="export-report">
          <FileDown className="h-4 w-4" />
          导出决策报告
        </button>
      </div>

      <ControlsPanel />

      {/* 结果区 */}
      {result.structuralError ? (
        <div className="card-surface p-6 border-wine-500/30" data-testid="structural-error">
          <div className="flex items-start gap-3">
            <Boxes className="h-5 w-5 text-wine-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-mono text-sm font-bold text-wine-400 mb-1">暂时无法枚举方案</h3>
              <p className="text-sm text-ink-400">{result.structuralError}</p>
              <p className="text-xs text-ink-500 mt-2">在下方候选库中为空缺类别添加候选后即可自动计算。</p>
            </div>
          </div>
        </div>
      ) : diagnosis ? (
        <NoSolutionPanel diagnosis={diagnosis} onApply={applyRelaxGroup} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1" data-testid="bench-summary">
            <p className="text-xs font-mono text-ink-500">
              共枚举 <span className="text-brass-300 font-bold">{result.totalEnumerated < 0 ? `≥200000` : result.totalEnumerated}</span> 个组合 ·
              可行 <span className="text-moss-400 font-bold">{result.plans.length}</span> 个
              {Object.keys(result.activeLocks).length > 0 && (
                <span className="text-brass-200">（已锁定 {Object.keys(result.activeLocks).length} 项）</span>
              )}
            </p>
            <p className="text-[11px] font-mono text-ink-600">
              同分按 总价↑ → 总重↑ → 手感↓ → 声音↓ → 组合键 稳定排序
            </p>
          </div>

          {result.truncated && (
            <div className="text-[11px] text-brass-200 bg-brass-300/8 border border-brass-300/25 rounded-lg px-3 py-2">
              组合数达到枚举上限（200000），结果已截断；建议增加锁定或缩小候选池。
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {visiblePlans.map((plan, i) => (
              <PlanCard
                key={plan.comboKey}
                plan={plan}
                rank={i + 1}
                saved={savedPlans.some((p) => p.comboKey === plan.comboKey)}
                onSave={() => handleSave(plan)}
              />
            ))}
          </div>

          {result.plans.length > RENDER_CAP && (
            <div className="text-center">
              <button onClick={() => setShowAll(true)} className="btn-ghost text-xs">
                显示全部 {result.plans.length} 个方案（当前仅前 {RENDER_CAP} 个）
              </button>
            </div>
          )}
        </div>
      )}

      {/* 收藏的方案 */}
      {savedPlans.length > 0 && (
        <div className="card-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="h-4 w-4 text-moss-400" />
            <h3 className="text-sm font-semibold text-ink-200 font-mono">已收藏方案</h3>
            <span className="text-[11px] font-mono text-ink-500">{savedPlans.length} 个</span>
          </div>
          <div className="space-y-2">
            {savedPlans.map((p) => (
              <div
                key={p.id}
                data-testid="saved-plan"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-ink-200">{p.name}</div>
                  <div className="text-[11px] font-mono text-ink-500">
                    总分 {p.totalScore.toFixed(1)} · {p.totalPrice} 元 · {p.totalWeight}g
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => loadSavedCombo(p.comboKey)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-ink-400 hover:text-brass-200 hover:bg-brass-300/10 border border-transparent hover:border-brass-300/25 transition-all"
                    title="按该组合锁定全部四类候选"
                  >
                    <Wrench className="h-3 w-3" />
                    载入为锁定
                  </button>
                  <button
                    onClick={() => deleteSavedPlan(p.id)}
                    className="p-1.5 rounded text-ink-500 hover:text-wine-400 hover:bg-wine-500/10 transition-all"
                    title="删除收藏"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Section
        title="候选库 · 轴体 / 键帽 / 定位板 / 填充"
        subtitle="维护各部件候选：价格、手感分、声音分、重量、兼容标签；★ 设置当前配置，🔒 锁定"
        icon={<Boxes className="h-4 w-4" />}
        defaultOpen={false}
      >
        <CandidatePanel />
      </Section>
    </div>
  );
}
