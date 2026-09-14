export type SwitchType = 'linear' | 'tactile' | 'clicky' | 'other';
export type SoundCharacter = 'deep' | 'bright' | 'muffled' | 'neutral';
export type KeycapMaterial = 'ABS' | 'PBT' | 'PC' | '混合' | '其他';
export type KeycapProfile = 'Cherry' | 'SA' | 'DSA' | 'OEM' | 'XDA' | 'KAT' | 'MT3' | '其他';
export type PlateMaterial = '铝' | '铜' | '钢' | 'PC/FR4' | '碳纤维' | '塑料' | '其他';
export type CaseMaterial = '铝合金' | '塑料' | '木头' | '亚克力' | '黄铜' | '不锈钢' | '其他';

export interface KeyboardLog {
  id: string;
  name: string;
  brand: string;
  model: string;
  purchaseDate: string;
  overallRating: number;
  switchName: string;
  switchType: SwitchType;
  switchLubed: string;
  keycapMaterial: KeycapMaterial;
  keycapProfile: KeycapProfile;
  keycapProcess: string;
  plateMaterial: PlateMaterial;
  plateThickness: string;
  fillMaterial: string;
  caseMaterial: CaseMaterial;
  soundCharacter: SoundCharacter;
  soundTags: string[];
  reboundRating: number;
  tactilityRating: number;
  fatigueRating: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  switchType: SwitchType | 'all';
  soundCharacter: SoundCharacter | 'all';
  minRating: number;
  searchKeyword: string;
}

export type ViewMode = 'list' | 'compare' | 'stats' | 'bench';

/* ============ 改装方案决策台 ============ */

export type ModCategory = 'switch' | 'keycap' | 'plate' | 'foam';

export const MOD_CATEGORIES: ModCategory[] = ['switch', 'keycap', 'plate', 'foam'];

export const MOD_CATEGORY_LABELS: Record<ModCategory, string> = {
  switch: '轴体',
  keycap: '键帽',
  plate: '定位板',
  foam: '填充',
};

export interface ModCandidate {
  id: string;
  category: ModCategory;
  name: string;
  /** 价格（元），整套改装的该部件成本 */
  price: number;
  /** 手感分 0-10 */
  feel: number;
  /** 声音分 0-10 */
  sound: number;
  /** 重量（克，g） */
  weight: number;
  /** 兼容标签：同一组标签的部件互相兼容（如 5pin、Cherry、ANSI、静音…） */
  tags: string[];
  /** 是否为当前配置（基准配置），每个类别至多一个 */
  isCurrent: boolean;
  note?: string;
}

export interface ModWeights {
  /** 手感权重 0-10 */
  feel: number;
  /** 声音权重 0-10 */
  sound: number;
  /** 预算友好权重 0-10（越高越偏好便宜） */
  price: number;
  /** 轻量化权重 0-10（越高越偏好轻量） */
  weight: number;
}

export interface ModConstraints {
  /** 预算上限（元），null 表示不限 */
  budget: number | null;
  /** 重量上限（克），null 表示不限 */
  maxWeight: number | null;
  /** 必须全部满足的兼容标签，组合里每个部件都要带这些标签 */
  requiredTags: string[];
}

export interface PlanItemScore {
  candidateId: string;
  name: string;
  /** 候选原始手感分 */
  feel: number;
  /** 候选原始声音分 */
  sound: number;
  /** 该候选在其类别候选池中的 0-100 归一化价格分（越便宜越高） */
  priceScore: number;
  /** 该候选在其类别候选池中的 0-100 归一化重量分（越轻越高） */
  weightScore: number;
  /** 该候选是否相对当前配置发生变化 */
  changed: boolean;
}

export interface PlanViolation {
  type: 'budget' | 'weight' | 'tag';
  tag?: string;
  missingBy: number;
  message: string;
}

export interface RelaxSuggestion {
  /** 需要放弃的约束类型 */
  drop: 'budget' | 'weight' | 'tag';
  /** 放弃单个标签约束时，该标签名 */
  tag?: string;
  /** 放宽后可行的见证组合（完整方案） */
  witness: ModPlan;
  /** 放弃的约束在所有约束中的固定优先级（小=优先放宽） */
  priority: number;
}

export interface ModPlan {
  /** 轴体/键帽/定位板/填充各一个候选 */
  items: Record<ModCategory, PlanItemScore>;
  totalPrice: number;
  totalWeight: number;
  /** 四个维度的组合得分（0-100）：手感、声音、价格、重量 */
  feelScore: number;
  soundScore: number;
  priceScore: number;
  weightScore: number;
  /** 加权总分 0-100 */
  totalScore: number;
  /** 相对当前配置：总价差（正=变贵） */
  priceDelta: number;
  /** 相对当前配置：总重量差（正=变重） */
  weightDelta: number;
  /** 相对当前配置：替换了几项（当前配置缺失时按全部替换计） */
  changedCount: number;
  /** 所有部件 id 串联，作为组合唯一键与稳定排序依据 */
  comboKey: string;
  violations: PlanViolation[];
}

export interface BenchResult {
  plans: ModPlan[];
  /** 枚举的组合总数（含不可行组合，受上限截断时为 -1） */
  totalEnumerated: number;
  /** 是否达到枚举上限而截断 */
  truncated: boolean;
  /** 结构问题：某类别没有候选，或锁定的候选已不存在 */
  structuralError: string | null;
  /** 当前生效的锁定（类别 -> 候选 id），会过滤掉失效锁定 */
  activeLocks: Partial<Record<ModCategory, string>>;
}

export interface SavedPlan {
  id: string;
  name: string;
  savedAt: string;
  comboKey: string;
  candidateIds: Record<ModCategory, string>;
  totalPrice: number;
  totalWeight: number;
  totalScore: number;
}

export interface UIState {
  viewMode: ViewMode;
  selectedForCompare: string[];
  formModalOpen: boolean;
  editingLog: KeyboardLog | null;
  detailLog: KeyboardLog | null;
  importExportModalOpen: boolean;
}

export const SWITCH_TYPE_LABELS: Record<SwitchType, string> = {
  linear: '线性轴',
  tactile: '段落轴',
  clicky: '点击轴',
  other: '其他',
};

export const SOUND_CHARACTER_LABELS: Record<SoundCharacter, string> = {
  deep: '低沉',
  bright: '清脆',
  muffled: '闷响',
  neutral: '中性',
};

export const SWITCH_TYPES: SwitchType[] = ['linear', 'tactile', 'clicky', 'other'];
export const SOUND_CHARACTERS: SoundCharacter[] = ['deep', 'bright', 'muffled', 'neutral'];
export const KEYCAP_MATERIALS: KeycapMaterial[] = ['ABS', 'PBT', 'PC', '混合', '其他'];
export const KEYCAP_PROFILES: KeycapProfile[] = ['Cherry', 'SA', 'DSA', 'OEM', 'XDA', 'KAT', 'MT3', '其他'];
export const PLATE_MATERIALS: PlateMaterial[] = ['铝', '铜', '钢', 'PC/FR4', '碳纤维', '塑料', '其他'];
export const CASE_MATERIALS: CaseMaterial[] = ['铝合金', '塑料', '木头', '亚克力', '黄铜', '不锈钢', '其他'];

export const PRESET_SOUND_TAGS = [
  '沙脆', '麻将音', '雨滴声', '低频闷', '高频亮',
  '回响声', '塑料感', '金属感', '木头声', '软弹',
  '硬朗', '细腻', '厚重', '空灵', '干净',
];
