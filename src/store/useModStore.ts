import { create } from 'zustand';
import type {
  ModCandidate,
  ModCategory,
  ModConstraints,
  ModWeights,
  SavedPlan,
} from '@/types';
import { modSampleData } from '@/data/modSampleData';

const STORAGE_KEY = 'keyfeeling-mod-bench-v1';

interface PersistShape {
  candidates: ModCandidate[];
  constraints: ModConstraints;
  weights: ModWeights;
  locks: Partial<Record<ModCategory, string>>;
  savedPlans: SavedPlan[];
}

export const defaultWeights: ModWeights = {
  feel: 4,
  sound: 3,
  price: 2,
  weight: 1,
};

export const defaultConstraints: ModConstraints = {
  budget: null,
  maxWeight: null,
  requiredTags: [],
};

function loadState(): PersistShape {
  const fallback: PersistShape = {
    candidates: modSampleData,
    constraints: defaultConstraints,
    weights: defaultWeights,
    locks: {},
    savedPlans: [],
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
      return { ...fallback, ...parsed, candidates: modSampleData };
    }
    return {
      candidates: parsed.candidates,
      constraints: { ...defaultConstraints, ...(parsed.constraints ?? {}) },
      weights: { ...defaultWeights, ...(parsed.weights ?? {}) },
      locks: parsed.locks ?? {},
      savedPlans: Array.isArray(parsed.savedPlans) ? parsed.savedPlans : [],
    };
  } catch {
    return fallback;
  }
}

function saveState(s: PersistShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function genCandidateId(): string {
  return (
    'mod-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

export type CandidateDraft = Omit<ModCandidate, 'id' | 'isCurrent'> & {
  id?: string;
  isCurrent?: boolean;
};

interface ModState extends PersistShape {
  // 候选管理
  addCandidate: (draft: Omit<ModCandidate, 'id' | 'isCurrent'>) => void;
  updateCandidate: (id: string, patch: Partial<ModCandidate>) => void;
  deleteCandidate: (id: string) => void;
  setCurrent: (category: ModCategory, id: string) => void;
  resetCandidates: () => void;
  // 决策控制
  setConstraints: (patch: Partial<ModConstraints>) => void;
  resetConstraints: () => void;
  setWeights: (patch: Partial<ModWeights>) => void;
  toggleLock: (category: ModCategory, id: string) => void;
  clearLocks: () => void;
  // 收藏
  savePlan: (plan: Omit<SavedPlan, 'id' | 'savedAt' | 'name'> & { name?: string }) => void;
  deleteSavedPlan: (id: string) => void;
}

export const useModStore = create<ModState>((set, get) => {
  const persist = (patch: Partial<ModState>) => {
    set(patch);
    const s = get();
    saveState({
      candidates: s.candidates,
      constraints: s.constraints,
      weights: s.weights,
      locks: s.locks,
      savedPlans: s.savedPlans,
    });
  };

  return {
    ...loadState(),

    addCandidate: (draft) => {
      const candidate: ModCandidate = {
        ...draft,
        id: genCandidateId(),
        isCurrent: false,
      };
      persist({ candidates: [...get().candidates, candidate] });
    },

    updateCandidate: (id, patch) => {
      persist({
        candidates: get().candidates.map((c) =>
          c.id === id ? { ...c, ...patch, id: c.id, category: c.category } : c,
        ),
      });
    },

    deleteCandidate: (id) => {
      const target = get().candidates.find((c) => c.id === id);
      const locks = { ...get().locks };
      if (target && locks[target.category] === id) delete locks[target.category];
      persist({
        candidates: get().candidates.filter((c) => c.id !== id),
        locks,
      });
    },

    setCurrent: (category, id) => {
      persist({
        candidates: get().candidates.map((c) =>
          c.category === category ? { ...c, isCurrent: c.id === id } : c,
        ),
      });
    },

    resetCandidates: () => {
      persist({ candidates: modSampleData.map((c) => ({ ...c, tags: [...c.tags] })), locks: {} });
    },

    setConstraints: (patch) => {
      persist({ constraints: { ...get().constraints, ...patch } });
    },

    resetConstraints: () => persist({ constraints: defaultConstraints }),

    setWeights: (patch) => {
      persist({ weights: { ...get().weights, ...patch } });
    },

    toggleLock: (category, id) => {
      const locks = { ...get().locks };
      if (locks[category] === id) {
        delete locks[category];
      } else {
        locks[category] = id;
      }
      persist({ locks });
    },

    clearLocks: () => persist({ locks: {} }),

    savePlan: (plan) => {
      const saved: SavedPlan = {
        id: 'plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        name: plan.name?.trim() || `方案 ${get().savedPlans.length + 1}`,
        savedAt: new Date().toISOString(),
        comboKey: plan.comboKey,
        candidateIds: plan.candidateIds,
        totalPrice: plan.totalPrice,
        totalWeight: plan.totalWeight,
        totalScore: plan.totalScore,
      };
      persist({ savedPlans: [saved, ...get().savedPlans] });
    },

    deleteSavedPlan: (id) => {
      persist({ savedPlans: get().savedPlans.filter((p) => p.id !== id) });
    },
  };
});
