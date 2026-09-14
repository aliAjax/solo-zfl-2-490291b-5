import { Bookmark, ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react';
import type { ModPlan } from '@/types';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS } from '@/types';

interface Props {
  plan: ModPlan;
  rank: number;
  saved: boolean;
  onSave: () => void;
}

const CAT_DOT: Record<string, string> = {
  switch: 'bg-slateblue-400',
  keycap: 'bg-brass-300',
  plate: 'bg-moss-400',
  foam: 'bg-wine-400',
};

function Delta({ delta, unit }: { delta: number; unit: string }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-ink-500">
        <Minus className="h-3 w-3" />0{unit}
      </span>
    );
  }
  // 价格/重量：上涨为差（红），下降为好（绿）
  const bad = delta > 0;
  const cls = bad ? 'text-wine-400' : 'text-moss-400';
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${cls}`}>
      {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta)}
      {unit}
    </span>
  );
}

export default function PlanCard({ plan, rank, saved, onSave }: Props) {
  return (
    <div
      className="card-surface p-4 animate-fadeIn"
      data-testid="plan-card"
      data-combo={plan.comboKey}
      data-score={plan.totalScore}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-sm font-bold ${
              rank === 1
                ? 'bg-gradient-to-br from-brass-200 to-brass-400 text-ink-950'
                : 'bg-ink-800 text-ink-300 border border-ink-700'
            }`}
          >
            {rank}
          </div>
          <div>
            <div className="font-mono text-2xl font-bold text-gradient-brass leading-none">
              {plan.totalScore.toFixed(1)}
            </div>
            <div className="text-[10px] font-mono text-ink-500 mt-1">加权总分 / 100</div>
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saved}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            saved
              ? 'bg-moss-500/20 text-moss-400 border border-moss-500/40 cursor-default'
              : 'text-ink-400 hover:text-brass-200 bg-ink-800/60 border border-ink-700 hover:border-brass-300/40'
          }`}
          data-testid="save-plan"
        >
          <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-moss-400' : ''}`} />
          {saved ? '已收藏' : '收藏'}
        </button>
      </div>

      <div className="space-y-1.5 mb-3">
        {MOD_CATEGORIES.map((cat) => {
          const item = plan.items[cat];
          return (
            <div
              key={cat}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                item.changed ? 'bg-brass-300/5' : ''
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CAT_DOT[cat]}`} />
              <span className="font-mono text-ink-500 w-10 shrink-0">
                {MOD_CATEGORY_LABELS[cat]}
              </span>
              <span className={`flex-1 truncate ${item.changed ? 'text-brass-100' : 'text-ink-300'}`}>
                {item.name}
              </span>
              {item.changed && (
                <span className="shrink-0 text-[10px] font-mono text-brass-300 bg-brass-300/10 border border-brass-300/25 rounded px-1 py-px">
                  替换
                </span>
              )}
              <span className="shrink-0 font-mono text-[10px] text-ink-500 w-20 text-right">
                手{item.feel} 音{item.sound}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: '手感', value: plan.feelScore },
          { label: '声音', value: plan.soundScore },
          { label: '价格', value: plan.priceScore },
          { label: '重量', value: plan.weightScore },
        ].map((s) => (
          <div key={s.label} className="rounded-md bg-ink-900/60 border border-ink-700/60 px-2 py-1.5 text-center">
            <div className="text-[9px] font-mono text-ink-500">{s.label}</div>
            <div className="font-mono text-xs font-bold text-ink-200">{s.value.toFixed(1)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ink-700/60">
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-ink-300">
            合计 <span className="text-ink-100 font-bold">{plan.totalPrice}</span> 元
          </span>
          <Delta delta={plan.priceDelta} unit="元" />
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-ink-300">
            <span className="text-ink-100 font-bold">{plan.totalWeight}</span>g
          </span>
          <Delta delta={plan.weightDelta} unit="g" />
        </div>
        <div className="text-[11px] font-mono text-ink-500">
          替换 <span className="text-brass-300">{plan.changedCount}</span>/4 项
        </div>
      </div>

      {plan.violations.length > 0 && (
        <div className="mt-2 space-y-1">
          {plan.violations.map((v, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-[11px] text-wine-400 bg-wine-500/8 border border-wine-500/20 rounded px-2 py-1"
            >
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {v.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
