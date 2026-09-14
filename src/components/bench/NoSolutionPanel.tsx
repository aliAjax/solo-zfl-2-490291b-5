import { ShieldX, Wand2, Target, AlertTriangle } from 'lucide-react';
import type { Diagnosis } from '@/mod/engine';
import type { RelaxSuggestion } from '@/types';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS } from '@/types';

interface Props {
  diagnosis: Diagnosis;
  onApply: (suggestion: RelaxSuggestion) => void;
}

function suggestLabel(s: RelaxSuggestion): string {
  if (s.drop === 'budget') return '取消预算上限';
  if (s.drop === 'weight') return '取消重量上限';
  return `取消必含标签 #${s.tag}`;
}

export default function NoSolutionPanel({ diagnosis, onApply }: Props) {
  return (
    <div className="card-surface p-5 sm:p-6 border-wine-500/30 animate-fadeIn" data-testid="no-solution">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-wine-500/15 border border-wine-500/30 flex items-center justify-center">
          <ShieldX className="h-5 w-5 text-wine-400" />
        </div>
        <div>
          <h3 className="font-mono text-base font-bold text-wine-400">当前约束下无可行方案</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            枚举了{' '}
            {diagnosis.totalEnumerated < 0 ? '上限数量的' : diagnosis.totalEnumerated} 个组合，全部不满足约束 —— 系统不会伪造方案。
          </p>
        </div>
      </div>

      {diagnosis.reasons.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-mono uppercase tracking-wider text-wine-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            冲突原因
          </div>
          <div className="space-y-1.5">
            {diagnosis.reasons.map((r, i) => (
              <div
                key={i}
                className="text-xs text-ink-300 bg-wine-500/8 border border-wine-500/20 rounded-lg px-3 py-2"
              >
                {r.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {diagnosis.suggestions.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-mono uppercase tracking-wider text-moss-400">
            <Wand2 className="h-3.5 w-3.5" />
            最少放宽建议（放宽任意一项即可出现可行组合）
          </div>
          <div className="space-y-2">
            {diagnosis.suggestions.map((s, i) => (
              <button
                key={`${s.drop}-${s.tag ?? ''}`}
                onClick={() => onApply(s)}
                data-testid={`relax-${i}`}
                className="w-full text-left rounded-lg border border-moss-500/25 bg-moss-500/5 hover:bg-moss-500/10 hover:border-moss-500/50 transition-all p-3 group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-mono font-semibold text-moss-400">
                    {suggestLabel(s)}
                  </span>
                  <span className="text-[10px] font-mono text-ink-500 group-hover:text-moss-400 transition-colors">
                    点击应用 →
                  </span>
                </div>
                <div className="text-[11px] text-ink-400 leading-relaxed">
                  放宽后最优组合：
                  {MOD_CATEGORIES.map((cat) => (
                    <span key={cat}>
                      <span className="text-ink-500"> {MOD_CATEGORY_LABELS[cat]}·</span>
                      {s.witness.items[cat].name}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-ink-500 mt-1">
                  总分 {s.witness.totalScore.toFixed(1)} · {s.witness.totalPrice} 元 · {s.witness.totalWeight}g
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 text-xs text-ink-500">
          即使放宽全部数值与标签约束仍无解（可能存在结构性问题，例如锁定的组合无法兼容），请检查锁定项或补充候选。
        </div>
      )}

      {diagnosis.nearestInfeasible && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-mono uppercase tracking-wider text-brass-200">
            <Target className="h-3.5 w-3.5" />
            最接近可行的组合
          </div>
          <div className="rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
            <div className="text-xs text-ink-300 mb-2">
              {MOD_CATEGORIES.map((cat) => diagnosis.nearestInfeasible!.items[cat].name).join(' + ')}
            </div>
            <div className="space-y-1">
              {diagnosis.nearestInfeasible.violations.map((v, i) => (
                <div key={i} className="text-[11px] text-wine-400">
                  · {v.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
