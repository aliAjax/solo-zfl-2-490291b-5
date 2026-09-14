import { type Page } from '@playwright/test';
import { test, expect } from './base';
import { MOD_CATEGORIES } from '../src/types';

async function gotoBench(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('nav-bench').waitFor();
  await page.getByTestId('nav-bench').click();
  await expect(page.getByTestId('bench-view')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('nav-bench').waitFor();
});

async function expandCandidates(page: Page) {
  const panel = page.getByTestId('candidate-panel');
  if (!(await panel.isVisible())) {
    await page.getByRole('button', { name: /候选库/ }).click();
  }
  await expect(panel).toBeVisible();
}

/** 在候选库中锁定指定候选（按 data-candidate-id 定位） */
async function lockCandidate(page: Page, id: string) {
  const card = page.locator(`[data-candidate-id="${id}"]`);
  const btn = card.getByRole('button', { name: /锁定/ });
  await btn.click();
  await expect(card.getByText('已锁定')).toBeVisible();
}

/** 调用页面内打包后的引擎做独立校验（不经 UI 排序） */
async function enginePlans(page: Page) {
  return page.evaluate(async () => {
    const { enumerateBench } = await import('/src/mod/engine.ts');
    const { useModStore } = await import('/src/store/useModStore.ts');
    const s = useModStore.getState();
    const res = enumerateBench({
      candidates: s.candidates,
      constraints: s.constraints,
      weights: s.weights,
      locks: s.locks,
    });
    return {
      count: res.plans.length,
      total: res.totalEnumerated,
      structuralError: res.structuralError,
      keys: res.plans.map((p) => p.comboKey),
      scores: res.plans.map((p) => p.totalScore),
    };
  });
}

test.describe('改装方案决策台', () => {
  test('有解：默认候选库下枚举出全部组合，方案卡片展示总分、逐项、余量与变化', async ({ page }) => {
    await gotoBench(page);

    // 5 轴 × 5 帽 × 4 板 × 4 棉 = 400
    await expect(page.getByTestId('bench-summary')).toContainText('400');
    const cards = page.getByTestId('plan-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBe(100); // 渲染上限

    // 第一名卡片展示总分
    const first = cards.first();
    const score = await first.getAttribute('data-score');
    expect(Number(score)).toBeGreaterThan(0);
    await expect(first.locator('.font-mono.text-2xl')).toBeVisible();

    // 逐项：四类候选名称都在卡片中
    for (const label of ['轴体', '键帽', '定位板', '填充']) {
      await expect(first.getByText(label, { exact: true })).toBeVisible();
    }

    // 至少有一张卡片显示「替换」变化标记（默认第一名通常不是当前配置）
    await expect(page.locator('[data-testid="plan-card"]').filter({ hasText: '替换' }).first()).toBeVisible();

    // 引擎层独立校验数量与排序单调
    const engine = await enginePlans(page);
    expect(engine.count).toBe(400);
    expect(engine.total).toBe(400);
    const scores = engine.scores;
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  test('多解：调整权重后重新排序，且同分顺序稳定可复现（固定 tie-break 规则）', async ({ page }) => {
    await gotoBench(page);

    const readCardCombos = async () =>
      (await page.locator('[data-testid="plan-card"]').evaluateAll(
        (els) => els.map((e) => e.getAttribute('data-combo')),
      )) as string[];

    const before = await readCardCombos();
    expect(before.length).toBe(100);

    // 把价格权重拉满、其他清零：最便宜组合应排第一
    // 最便宜组合 = gateron-yellow(120) + budget-abs(80) + pc(150) + none(0) = 350（唯一）
    await page.getByTestId('weight-feel').fill('0');
    await page.getByTestId('weight-sound').fill('0');
    await page.getByTestId('weight-kg').fill('0');
    await page.getByTestId('weight-price').fill('10');

    await expect(page.getByTestId('plan-card').first()).toContainText('入门 ABS 透光键帽');
    await expect(page.getByTestId('plan-card').first()).toContainText('不装填充');

    // 同分稳定性：引擎层用打乱的候选顺序重算两次，排名必须一致
    const stable = await page.evaluate(async () => {
      const { enumerateBench } = await import('/src/mod/engine.ts');
      const { useModStore } = await import('/src/store/useModStore.ts');
      const s = useModStore.getState();
      const shuffle = <T,>(arr: T[]) =>
        arr
          .map((v, i) => ({ v, k: Math.sin((i + 1) * 12.9898) }))
          .sort((a, b) => a.k - b.k)
          .map((x) => x.v);
      const r1 = enumerateBench({ candidates: shuffle(s.candidates), constraints: s.constraints, weights: s.weights, locks: {} });
      const r2 = enumerateBench({ candidates: shuffle(s.candidates), constraints: s.constraints, weights: s.weights, locks: {} });
      return {
        sameOrder: r1.plans.map((p) => p.comboKey).join() === r2.plans.map((p) => p.comboKey).join(),
        cheapest: r1.plans[0].totalPrice,
        cheapestKey: r1.plans[0].comboKey,
      };
    });
    expect(stable.sameOrder).toBe(true);
    expect(stable.cheapest).toBe(350);

    // 同页面两次读取排名一致（稳定可复现）
    const after1 = await readCardCombos();
    const after2 = await readCardCombos();
    expect(after1).toEqual(after2);
    expect(after1.length).toBe(100);
  });

  test('锁定：锁定 3 类后组合数按未锁定类候选数缩减，锁定持久化，可解除', async ({ page }) => {
    await gotoBench(page);
    await expandCandidates(page);

    await lockCandidate(page, 'sw-hg-black');
    await lockCandidate(page, 'kc-gmk-olivia');
    await lockCandidate(page, 'pl-alu-15');

    // 只剩填充 4 个候选 => 4 个可行组合
    await expect(page.getByTestId('bench-summary')).toContainText('4 个');
    await expect(page.getByTestId('plan-card')).toHaveCount(4);

    // 每张方案卡片的前三项都是被锁定的候选
    for (const name of ['Hyperglide MX Black', 'GMK Olivia++', '1.5mm 铝板']) {
      const count = await page
        .locator('[data-testid="plan-card"]')
        .filter({ hasText: name })
        .count();
      expect(count).toBe(4);
    }

    // 锁定写入 localStorage
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('keyfeeling-mod-bench-v1') || '{}'),
    );
    expect(persisted.locks.switch).toBe('sw-hg-black');
    expect(persisted.locks.keycap).toBe('kc-gmk-olivia');
    expect(persisted.locks.plate).toBe('pl-alu-15');

    // 刷新后锁定仍在
    await gotoBench(page);
    await expect(page.getByTestId('bench-summary')).toContainText('4 个');

    // 解除一个锁定 => 轴体 5 × 填充 4 = 20
    await expandCandidates(page);
    await page.locator('[data-candidate-id="sw-hg-black"]').getByRole('button', { name: /已锁定/ }).click();
    await expect(page.getByTestId('bench-summary')).toContainText('20 个');
  });

  test('无解：过低预算下不伪造方案，给出原因与最少放宽建议，点击后出现方案', async ({ page }) => {
    await gotoBench(page);

    // 最便宜组合 350 元，预算 100 必无解
    await page.getByTestId('constraint-budget').fill('100');

    const noSolution = page.getByTestId('no-solution');
    await expect(noSolution).toBeVisible();
    await expect(page.getByTestId('plan-card')).toHaveCount(0);
    await expect(noSolution).toContainText('无可行方案');
    await expect(noSolution).toContainText('超预算');

    // 最少放宽建议：取消预算上限
    const relaxBtn = page.getByTestId('relax-0');
    await expect(relaxBtn).toContainText('取消预算上限');
    await relaxBtn.click();

    // 应用后立即出现方案
    await expect(page.getByTestId('plan-card').first()).toBeVisible();
    await expect(page.getByTestId('bench-summary')).toContainText('400 个');
  });

  test('无解（标签）：要求无法四类同时满足的标签时建议放弃该标签，见证组合确实可行', async ({ page }) => {
    await gotoBench(page);

    // 可行标签前置校验：#静音 四类各恰好 1 个候选 => 唯一组合
    const silentCount = await page.evaluate(async () => {
      const { enumerateBench } = await import('/src/mod/engine.ts');
      const { useModStore } = await import('/src/store/useModStore.ts');
      const s = useModStore.getState();
      const r = enumerateBench({
        candidates: s.candidates,
        constraints: { ...s.constraints, requiredTags: ['静音'] },
        weights: s.weights,
        locks: {},
      });
      return r.plans.length;
    });
    expect(silentCount).toBe(1);

    // #热插拔：填充类候选都不带该标签 => 必然无解
    await page.locator('[data-testid="tag-picker"] button', { hasText: '#热插拔' }).click();

    const noSolution = page.getByTestId('no-solution');
    await expect(noSolution).toBeVisible();
    const relax = page.getByTestId(/relax-\d/).filter({ hasText: '#热插拔' });
    await expect(relax).toBeVisible();

    // 独立校验：见证组合无违规
    const witnessOk = await page.evaluate(async () => {
      const { diagnoseBench } = await import('/src/mod/engine.ts');
      const { useModStore } = await import('/src/store/useModStore.ts');
      const s = useModStore.getState();
      const d = diagnoseBench({
        candidates: s.candidates,
        constraints: s.constraints,
        weights: s.weights,
        locks: s.locks,
      });
      const sug = d.suggestions.find((x) => x.drop === 'tag' && x.tag === '热插拔');
      return Boolean(sug && sug.witness.violations.length === 0);
    });
    expect(witnessOk).toBe(true);

    await relax.click();
    await expect(page.getByTestId('plan-card').first()).toBeVisible();
  });

  test('边界值：预算恰好等于总价可行、低一分钱无解；重量上限同样在临界点判定', async ({ page }) => {
    await gotoBench(page);
    await expandCandidates(page);

    // 锁定固定组合：120 + 80 + 150 + 0 = 350 元；260 + 300 + 200 + 0 = 760g
    await lockCandidate(page, 'sw-gateron-yellow');
    await lockCandidate(page, 'kc-budget-abs');
    await lockCandidate(page, 'pl-pc');
    await lockCandidate(page, 'fm-none');

    await expect(page.getByTestId('plan-card')).toHaveCount(1);

    // 预算 = 350（恰好相等）=> 仍可行
    await page.getByTestId('constraint-budget').fill('350');
    await expect(page.getByTestId('plan-card')).toHaveCount(1);
    await expect(page.getByTestId('no-solution')).toHaveCount(0);

    // 预算 = 349.99 => 无解
    await page.getByTestId('constraint-budget').fill('349.99');
    await expect(page.getByTestId('no-solution')).toBeVisible();

    // 清除预算，重量 = 760 恰好可行
    await page.getByTestId('constraint-budget').fill('');
    await page.getByTestId('constraint-weight').fill('760');
    await expect(page.getByTestId('plan-card')).toHaveCount(1);

    // 重量 = 759 => 无解，且建议取消重量上限
    await page.getByTestId('constraint-weight').fill('759');
    await expect(page.getByTestId('no-solution')).toBeVisible();
    await expect(page.getByTestId('relax-0')).toContainText('取消重量上限');
  });

  test('候选管理：新增 0 元 0g 候选、删除候选导致空类别时给出结构性错误而非伪造方案', async ({ page }) => {
    await gotoBench(page);
    await expandCandidates(page);

    // 删除全部填充候选（4 个）
    page.on('dialog', (d) => d.accept());
    for (const id of ['fm-ixpe-pe', 'fm-poron', 'fm-silicone', 'fm-none']) {
      await page
        .locator(`[data-candidate-id="${id}"]`)
        .getByRole('button', { name: '删除' })
        .click();
    }

    await expect(page.getByTestId('structural-error')).toBeVisible();
    await expect(page.getByTestId('structural-error')).toContainText('填充');
    await expect(page.getByTestId('plan-card')).toHaveCount(0);

    // 新增一个 0 元 0g 的填充候选（边界值）
    await page.getByTestId('add-candidate-foam').click();
    await page.getByPlaceholder(/Gateron 小浣熊/).fill('空腔零重填充');
    await page.getByTestId('candidate-price').fill('0');
    await page.getByTestId('candidate-weight').fill('0');
    await page.getByTestId('candidate-submit').click();

    await expect(page.getByTestId('structural-error')).toHaveCount(0);
    await expect(page.getByTestId('plan-card').first()).toBeVisible();
    // 5×5×4×1 = 100
    await expect(page.getByTestId('bench-summary')).toContainText('100 个');

    // 独立引擎校验 0 元 0g 候选不破坏归一化
    const ok = await page.evaluate(async () => {
      const { enumerateBench } = await import('/src/mod/engine.ts');
      const { useModStore } = await import('/src/store/useModStore.ts');
      const s = useModStore.getState();
      const r = enumerateBench({
        candidates: s.candidates,
        constraints: { budget: null, maxWeight: null, requiredTags: [] },
        weights: s.weights,
        locks: {},
      });
      return (
        r.plans.length === 100 &&
        r.plans.every((p) => Number.isFinite(p.totalScore) && p.totalScore >= 0 && p.totalScore <= 100)
      );
    });
    expect(ok).toBe(true);
  });

  test('收藏方案写入本地，导出的决策报告包含条件、排名方案与相对当前变化', async ({ page }) => {
    await gotoBench(page);

    await page.getByTestId('plan-card').first().getByTestId('save-plan').click();
    await expect(page.getByTestId('saved-plan')).toHaveCount(1);

    // 收藏持久化
    await gotoBench(page);
    await expect(page.getByTestId('saved-plan')).toHaveCount(1);

    // 导出报告：拦截下载
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-report').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^keyfeeling-decision-report-.*\.md$/);
    const stream = await download.createReadStream();
    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
    expect(content).toContain('# KeyFeeling 改装方案决策报告');
    expect(content).toContain('## 决策条件');
    expect(content).toContain('## 排序规则');
    expect(content).toContain('### 方案 1');
    expect(content).toContain('替换');
    expect(content).toContain('已收藏方案');

    // 类别常量不遗漏（保证逐项得分四类齐全）
    expect(MOD_CATEGORIES).toEqual(['switch', 'keycap', 'plate', 'foam']);
  });
});
