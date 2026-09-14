import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Star,
  RotateCcw,
} from 'lucide-react';
import type { ModCandidate, ModCategory } from '@/types';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS } from '@/types';
import { useModStore } from '@/store/useModStore';
import CandidateFormModal, { type CandidateFormValue } from './CandidateFormModal';

const CATEGORY_ACCENT: Record<ModCategory, string> = {
  switch: 'text-slateblue-400',
  keycap: 'text-brass-200',
  plate: 'text-moss-400',
  foam: 'text-wine-400',
};

interface CandidateRowProps {
  candidate: ModCandidate;
  locked: boolean;
}

function CandidateRow({ candidate, locked }: CandidateRowProps) {
  const { toggleLock, setCurrent, deleteCandidate, updateCandidate } = useModStore();
  const [editing, setEditing] = useState(false);

  const submit = (value: CandidateFormValue) => {
    updateCandidate(candidate.id, value);
    setEditing(false);
  };

  return (
    <>
      <div
        className={`rounded-lg border p-2.5 transition-all ${
          locked
            ? 'border-brass-300/60 bg-brass-300/8 shadow-glow'
            : candidate.isCurrent
              ? 'border-moss-500/40 bg-moss-500/5'
              : 'border-ink-700/70 bg-ink-900/50'
        }`}
        data-candidate-id={candidate.id}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-ink-100 leading-snug flex-1">{candidate.name}</p>
          {locked && <Lock className="h-3.5 w-3.5 text-brass-300 shrink-0" />}
          {!locked && candidate.isCurrent && (
            <Star className="h-3.5 w-3.5 text-moss-400 fill-moss-400 shrink-0" />
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-1.5">
          {candidate.tags.length === 0 && (
            <span className="text-[10px] text-ink-600 font-mono">无标签</span>
          )}
          {candidate.tags.map((t) => (
            <span
              key={t}
              className="px-1.5 py-px text-[10px] font-mono rounded bg-ink-800 text-brass-200/80 border border-ink-700/70"
            >
              #{t}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1 mt-2 text-center font-mono">
          <div>
            <div className="text-[9px] text-ink-500">价格</div>
            <div className="text-[11px] text-ink-200">{candidate.price}</div>
          </div>
          <div>
            <div className="text-[9px] text-ink-500">手感</div>
            <div className="text-[11px] text-ink-200">{candidate.feel}</div>
          </div>
          <div>
            <div className="text-[9px] text-ink-500">声音</div>
            <div className="text-[11px] text-ink-200">{candidate.sound}</div>
          </div>
          <div>
            <div className="text-[9px] text-ink-500">重量</div>
            <div className="text-[11px] text-ink-200">{candidate.weight}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => toggleLock(candidate.category, candidate.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
              locked
                ? 'bg-brass-300/20 text-brass-100 border border-brass-300/40'
                : 'text-ink-500 hover:text-brass-200 hover:bg-brass-300/8 border border-transparent'
            }`}
            title="锁定该候选（枚举时固定为该项）"
          >
            <Lock className="h-3 w-3" />
            {locked ? '已锁定' : '锁定'}
          </button>
          <button
            onClick={() => setCurrent(candidate.category, candidate.id)}
            disabled={candidate.isCurrent}
            className={`p-1 rounded transition-all ${
              candidate.isCurrent
                ? 'text-moss-400 cursor-default'
                : 'text-ink-500 hover:text-moss-400 hover:bg-moss-500/10'
            }`}
            title={candidate.isCurrent ? '已是当前配置' : '设为当前配置（变化对比基准）'}
          >
            <Star className={`h-3.5 w-3.5 ${candidate.isCurrent ? 'fill-moss-400' : ''}`} />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-ink-500 hover:text-slateblue-400 hover:bg-slateblue-500/10 transition-all"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteCandidate(candidate.id)}
            className="p-1 rounded text-ink-500 hover:text-wine-400 hover:bg-wine-500/10 transition-all"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <CandidateFormModal
          open
          editing={candidate}
          defaultCategory={candidate.category}
          onClose={() => setEditing(false)}
          onSubmit={submit}
        />
      )}
    </>
  );
}

function CategoryColumn({ category }: { category: ModCategory }) {
  const { candidates, locks, addCandidate } = useModStore();
  const [adding, setAdding] = useState(false);
  const pool = candidates.filter((c) => c.category === category);

  const submit = (value: CandidateFormValue) => {
    addCandidate(value);
    setAdding(false);
  };

  return (
    <div className="card-surface p-3 sm:p-4 flex flex-col" data-category={category}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-mono text-sm font-semibold ${CATEGORY_ACCENT[category]}`}>
          {MOD_CATEGORY_LABELS[category]}
          <span className="ml-2 text-[11px] font-normal text-ink-500">{pool.length} 个候选</span>
        </h3>
        <button
          onClick={() => setAdding(true)}
          data-testid={`add-candidate-${category}`}
          className="p-1 rounded text-ink-500 hover:text-brass-300 hover:bg-brass-300/10 transition-colors"
          title="新增候选"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 flex-1">
        {pool.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-ink-700/70 p-4 text-center">
            <p className="text-xs text-ink-500 mb-2">该类别暂无候选</p>
            <button onClick={() => setAdding(true)} className="btn-ghost !py-1 !px-3 text-xs">
              <Plus className="h-3.5 w-3.5" />
              添加一个
            </button>
          </div>
        )}
        {pool.map((c) => (
          <CandidateRow key={c.id} candidate={c} locked={locks[category] === c.id} />
        ))}
      </div>

      {adding && (
        <CandidateFormModal
          open
          editing={null}
          defaultCategory={category}
          onClose={() => setAdding(false)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

export default function CandidatePanel() {
  const { resetCandidates, locks, clearLocks } = useModStore();
  const lockCount = Object.keys(locks).length;

  return (
    <div className="space-y-3" data-testid="candidate-panel">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-500">
          <span>
            <Lock className="inline h-3 w-3 mr-1 text-brass-300" />
            {lockCount > 0 ? `已锁定 ${lockCount} 项` : '未锁定任何候选'}
          </span>
          <Star className="inline h-3 w-3 ml-2 text-moss-400" />
          <span>★ 为当前配置（变化对比基准）</span>
        </div>
        <div className="flex items-center gap-2">
          {lockCount > 0 && (
            <button onClick={clearLocks} className="btn-ghost !py-1 !px-2.5 text-[11px]">
              解除全部锁定
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('确定恢复内置候选吗？你新增/编辑的候选与锁定都会丢失。')) {
                resetCandidates();
              }
            }}
            className="btn-ghost !py-1 !px-2.5 text-[11px]"
            data-testid="reset-candidates"
          >
            <RotateCcw className="h-3 w-3" />
            恢复内置
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {MOD_CATEGORIES.map((cat) => (
          <CategoryColumn key={cat} category={cat} />
        ))}
      </div>
    </div>
  );
}
