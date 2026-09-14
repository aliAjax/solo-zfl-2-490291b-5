import { SlidersHorizontal, X, Lock } from 'lucide-react';
import { useModStore } from '@/store/useModStore';
import { MOD_CATEGORY_LABELS } from '@/types';
import type { ModCategory } from '@/types';

function NumberConstraint({
  label,
  value,
  unit,
  testid,
  onChange,
}: {
  label: string;
  value: number | null;
  unit: string;
  testid: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] font-mono uppercase tracking-wider text-ink-500">
          {label}
        </label>
        <span className="font-mono text-xs font-bold text-brass-300">
          {value === null ? '不限' : `≤ ${value}${unit}`}
        </span>
      </div>
      <input
        type="number"
        min={0}
        step="any"
        value={value ?? ''}
        data-testid={testid}
        placeholder="不限"
        onChange={(e) => {
          if (e.target.value === '') {
            onChange(null);
            return;
          }
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && v >= 0) onChange(Math.round(v * 100) / 100);
        }}
        className="input-field !py-2 font-mono"
      />
    </div>
  );
}

function WeightSlider({
  label,
  value,
  testid,
  onChange,
}: {
  label: string;
  value: number;
  testid: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-500">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-brass-300">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        data-testid={testid}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function ControlsPanel() {
  const {
    constraints,
    setConstraints,
    resetConstraints,
    weights,
    setWeights,
    locks,
    candidates,
    clearLocks,
  } = useModStore();

  const allTags = Array.from(new Set(candidates.flatMap((c) => c.tags))).sort();
  const lockCount = Object.keys(locks).length;
  const weightSum = weights.feel + weights.sound + weights.price + weights.weight;

  return (
    <div className="space-y-4">
      {/* 约束 */}
      <div className="card-surface p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brass-300" />
            <h3 className="text-sm font-semibold text-ink-200 font-mono">约束条件</h3>
          </div>
          <button onClick={resetConstraints} className="chip chip-inactive !py-0.5 !text-[11px]">
            <X className="h-3 w-3" />
            重置
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <NumberConstraint
            label="预算上限（元）"
            value={constraints.budget}
            unit=" 元"
            testid="constraint-budget"
            onChange={(v) => setConstraints({ budget: v })}
          />
          <NumberConstraint
            label="重量上限（g）"
            value={constraints.maxWeight}
            unit="g"
            testid="constraint-weight"
            onChange={(v) => setConstraints({ maxWeight: v })}
          />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-ink-500 block mb-2">
            必含兼容标签（组合中每个部件都必须带）
          </label>
          <div className="flex flex-wrap gap-1.5" data-testid="tag-picker">
            {allTags.length === 0 && <span className="text-xs text-ink-600">候选还没有任何标签</span>}
            {allTags.map((tag) => {
              const active = constraints.requiredTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setConstraints({
                      requiredTags: active
                        ? constraints.requiredTags.filter((t) => t !== tag)
                        : [...constraints.requiredTags, tag],
                    })
                  }
                  className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        {lockCount > 0 && (
          <div className="mt-4 pt-3 border-t border-ink-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-brass-200">
                <Lock className="h-3 w-3" />
                已锁定 {lockCount} 项：
                {(Object.keys(locks) as ModCategory[]).map((cat) => {
                  const c = candidates.find((x) => x.id === locks[cat]);
                  return (
                    <span key={cat} className="text-ink-400">
                      {MOD_CATEGORY_LABELS[cat]}
                      <span className="text-ink-500">·</span>
                      <span className="text-ink-300">{c?.name.slice(0, 8) ?? '?'}</span>
                    </span>
                  );
                })}
              </div>
              <button onClick={clearLocks} className="text-[11px] text-ink-500 hover:text-wine-400">
                解除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 权重 */}
      <div className="card-surface p-4 sm:p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-ink-200 font-mono">评分权重</h3>
          <span className="text-[11px] font-mono text-ink-500">
            权重和 <span className={weightSum === 0 ? 'text-wine-400' : 'text-brass-300'}>{weightSum}</span>
            {weightSum === 0 && <span className="text-wine-400"> · 将等权处理</span>}
          </span>
        </div>
        <p className="text-[11px] text-ink-500 mb-4">
          价格/重量分在各自类别候选池中归一化为 0-100（越便宜/越轻越高），单候选类别记满分。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <WeightSlider
            label="手感"
            value={weights.feel}
            testid="weight-feel"
            onChange={(v) => setWeights({ feel: v })}
          />
          <WeightSlider
            label="声音"
            value={weights.sound}
            testid="weight-sound"
            onChange={(v) => setWeights({ sound: v })}
          />
          <WeightSlider
            label="价格友好"
            value={weights.price}
            testid="weight-price"
            onChange={(v) => setWeights({ price: v })}
          />
          <WeightSlider
            label="轻量化"
            value={weights.weight}
            testid="weight-kg"
            onChange={(v) => setWeights({ weight: v })}
          />
        </div>
      </div>
    </div>
  );
}
