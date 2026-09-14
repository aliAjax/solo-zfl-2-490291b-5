import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import type { ModCandidate, ModCategory } from '@/types';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS } from '@/types';
import { MOD_PRESET_TAGS } from '@/data/modSampleData';
import TagInput from '@/components/form/TagInput';

export interface CandidateFormValue {
  category: ModCategory;
  name: string;
  price: number;
  feel: number;
  sound: number;
  weight: number;
  tags: string[];
  note: string;
}

interface Props {
  open: boolean;
  editing: ModCandidate | null;
  defaultCategory: ModCategory;
  onClose: () => void;
  onSubmit: (value: CandidateFormValue) => void;
}

const emptyForm: CandidateFormValue = {
  category: 'switch',
  name: '',
  price: 0,
  feel: 5,
  sound: 5,
  weight: 0,
  tags: [],
  note: '',
};

export default function CandidateFormModal({ open, editing, defaultCategory, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CandidateFormValue>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        category: editing.category,
        name: editing.name,
        price: editing.price,
        feel: editing.feel,
        sound: editing.sound,
        weight: editing.weight,
        tags: [...editing.tags],
        note: editing.note ?? '',
      });
    } else {
      setForm({ ...emptyForm, category: defaultCategory });
    }
    setErrors({});
  }, [open, editing, defaultCategory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = <K extends keyof CandidateFormValue>(key: K, value: CandidateFormValue[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: '' }));
  };

  const numField = (key: 'price' | 'feel' | 'sound' | 'weight', raw: string) => {
    if (raw === '') {
      update(key, 0);
      return;
    }
    const v = Number(raw);
    if (!Number.isNaN(v)) update(key, Math.round(v * 100) / 100);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '请输入候选名称';
    if (form.price < 0) e.price = '价格不能为负';
    if (form.weight < 0) e.weight = '重量不能为负';
    if (form.feel < 0 || form.feel > 10) e.feel = '手感分需在 0-10';
    if (form.sound < 0 || form.sound > 10) e.sound = '声音分需在 0-10';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({ ...form, name: form.name.trim() });
  };

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-surface scrollbar-thin !max-w-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-ink-700/60 bg-gradient-to-b from-ink-800/98 to-ink-800/90 backdrop-blur-sm">
          <div>
            <h2 className="font-mono text-lg font-bold text-gradient-brass">
              {editing ? '编辑候选' : '新增候选'}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">记录价格、手感分、声音分、重量与兼容标签</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-300 mb-1.5">
                候选名称 <span className="text-wine-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="比如：Gateron 小浣熊 V2、PC 半透明定位板..."
                className={`input-field ${errors.name ? 'border-wine-500/60' : ''}`}
              />
              {errors.name && <p className="text-[11px] text-wine-400 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">类别</label>
              <select
                value={form.category}
                disabled={Boolean(editing)}
                onChange={(e) => update('category', e.target.value as ModCategory)}
                className="input-field appearance-none cursor-pointer disabled:opacity-60"
              >
                {MOD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MOD_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">价格（元）</label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.price}
                data-testid="candidate-price"
                onChange={(e) => numField('price', e.target.value)}
                className={`input-field ${errors.price ? 'border-wine-500/60' : ''}`}
              />
              {errors.price && <p className="text-[11px] text-wine-400 mt-1">{errors.price}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">重量（g）</label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.weight}
                data-testid="candidate-weight"
                onChange={(e) => numField('weight', e.target.value)}
                className={`input-field ${errors.weight ? 'border-wine-500/60' : ''}`}
              />
              {errors.weight && <p className="text-[11px] text-wine-400 mt-1">{errors.weight}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  手感分 <span className="font-mono text-brass-300">{form.feel}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={form.feel}
                  data-testid="candidate-feel"
                  onChange={(e) => update('feel', Number(e.target.value))}
                />
                {errors.feel && <p className="text-[11px] text-wine-400 mt-1">{errors.feel}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  声音分 <span className="font-mono text-brass-300">{form.sound}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={form.sound}
                  data-testid="candidate-sound"
                  onChange={(e) => update('sound', Number(e.target.value))}
                />
                {errors.sound && <p className="text-[11px] text-wine-400 mt-1">{errors.sound}</p>}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-300 mb-1.5">兼容标签</label>
              <TagInput
                tags={form.tags}
                onChange={(t) => update('tags', t)}
                presetSuggestions={MOD_PRESET_TAGS}
                placeholder="输入兼容标签后回车，如 5pin、Cherry、热插拔"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-300 mb-1.5">备注</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => update('note', e.target.value)}
                placeholder="可选：声音风格、购买渠道等"
                className="input-field"
              />
            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-2 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-ink-700/60 bg-gradient-to-t from-ink-800 via-ink-800/95 to-ink-800/80 backdrop-blur-sm rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn-ghost">
              取消
            </button>
            <button type="submit" className="btn-primary min-w-[120px]" data-testid="candidate-submit">
              <Save className="h-4 w-4" />
              {editing ? '保存修改' : '添加候选'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
