import { type Page } from '@playwright/test';
import { test, expect } from './base';

async function resetStorage(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '新建记录' }).waitFor();
}

test.describe('原有功能回归', () => {
  test.beforeEach(async ({ page }) => {
    await resetStorage(page);
  });

  test('查看：列表展示 4 条内置记录，点击卡片打开详情并关闭', async ({ page }) => {
    await expect(page.getByText('显示')).toBeVisible();
    await expect(page.locator('article')).toHaveCount(4);

    // 打开第一条详情（点击专用“查看详情”按钮）
    await page.locator('article').first().locator('button[title="查看详情"]').click();
    const modal = page.locator('.modal-surface').filter({ hasText: '日·夜 · 静' });
    await expect(modal.first()).toBeVisible();
    await expect(modal.first()).toContainText('Hyperglide MX Black');

    // 关闭：X 按钮
    await page.keyboard.press('Escape');
    await expect(modal.first()).toHaveCount(0);
  });

  test('筛选：轴体类型、关键词与最低评分筛选均生效且可清除', async ({ page }) => {
    // 轴体类型：线性轴只有 1 条（日·夜 · 静）
    await page.getByRole('button', { name: '线性轴' }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('日·夜 · 静');

    // 清除筛选
    await page.getByRole('button', { name: /清除筛选/ }).click();
    await expect(page.locator('article')).toHaveCount(4);

    // 关键词搜索
    await page.getByPlaceholder('搜索名称、轴体、备注...').fill('Zoom');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('春日抹茶');

    await page.getByPlaceholder('搜索名称、轴体、备注...').fill('');
    await expect(page.locator('article')).toHaveCount(4);

    // 最低评分 ≥9：只有 9 分的 1 条
    await page.locator('input[type="range"]').first().fill('9');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('日·夜 · 静');
  });

  test('对比：选两把键盘进入对比视图，展示差异统计，交换后仍正常', async ({ page }) => {
    // 注意：点击后按钮文案变为“✓ 已选对比”，直接在卡片内定位，避免 nth 漂移
    const articles = page.locator('article');
    await articles.nth(0).getByRole('button', { name: /加入对比|已选对比/ }).click();
    await articles.nth(1).getByRole('button', { name: /加入对比|已选对比/ }).click();

    // 横幅出现，进入对比
    await expect(page.getByText('已选择 2 把键盘')).toBeVisible();
    await page.getByRole('button', { name: '开始对比' }).click();

    await expect(page.locator('.modal-surface')).toHaveCount(0); // 没有弹窗遮挡
    await expect(page.getByText('键盘 A', { exact: true })).toBeVisible();
    await expect(page.getByText('键盘 B', { exact: true })).toBeVisible();

    // 差异统计行存在：X 项不同
    const diffChip = page.locator('.chip-active').filter({ hasText: '项不同' });
    await expect(diffChip).toBeVisible();

    // A 卡是第一把（日·夜 · 静）
    await expect(page.getByTestId('compare-card-A')).toContainText('日·夜 · 静');

    // 交换按钮可用，A/B 内容互换
    await page.getByRole('button', { name: /交换/ }).click();
    await expect(page.getByTestId('compare-card-A')).toContainText('快乐触发');
    await expect(page.getByTestId('compare-card-B')).toContainText('日·夜 · 静');

    // 返回列表
    await page.getByRole('button', { name: /返回列表/ }).first().click();
    await expect(page.locator('article')).toHaveCount(4);
  });

  test('统计：记录数、平均分、最高分键盘正确渲染', async ({ page }) => {
    await page.getByRole('button', { name: '统计' }).click();

    await expect(page.getByText(/基于\s*4\s*条记录统计/)).toBeVisible();
    // 平均 (9+7+8+6)/4 = 7.5
    await expect(page.locator('body')).toContainText('7.5');
    await expect(page.getByText('最高分键盘')).toBeVisible();
    await expect(page.getByText('日·夜 · 静').first()).toBeVisible();
    // 轴体类型占比里线性轴 1 条 (25%)
    await expect(page.locator('body')).toContainText('25%');
  });

  test('导航：在列表、统计、决策台之间切换互不影响，决策台不污染键盘日志数据', async ({ page }) => {
    await expect(page.locator('article')).toHaveCount(4);

    await page.getByTestId('nav-bench').click();
    await expect(page.getByTestId('bench-view')).toBeVisible();
    await expect(page.getByTestId('bench-summary')).toContainText('400');

    // 返回列表，键盘日志仍是 4 条
    await page.getByRole('button', { name: '列表' }).click();
    await expect(page.locator('article')).toHaveCount(4);

    // localStorage 中两套数据各自独立
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain('keyfeeling-logs-v1');
    expect(keys).toContain('keyfeeling-mod-bench-v1');
  });

  test('键盘日志 localStorage 持久化：新建记录后刷新仍存在', async ({ page }) => {
    await page.getByRole('button', { name: /新建/ }).click();
    const form = page.locator('.modal-surface').last();
    await form.getByPlaceholder('比如：日·夜 · 静、快乐轴机').fill('回归测试键盘');
    await form.getByPlaceholder('Matrix / Keychron / 自制...').fill('测试牌');
    await form.getByPlaceholder('Hyperglide MX Black / Gateron Baby Raccoon V2...').fill('测试轴');
    await form.getByRole('button', { name: '保存记录' }).click();

    await expect(page.locator('article')).toHaveCount(5);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('article')).toHaveCount(5);
    await expect(page.locator('body')).toContainText('回归测试键盘');
  });
});
