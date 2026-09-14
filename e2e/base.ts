import { test as base, expect } from '@playwright/test';

const test = base;

test.beforeEach(async ({ context }) => {
  // 沙箱无法访问外网，index.html 的 Google Fonts 请求会长时间挂起，
  // 连带阻塞其后的内联 module 脚本，使 DOMContentLoaded 间歇性超时。
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

  // 每个用例使用全新上下文；仅在首次文档加载前清空本地存储。
  // 用 sessionStorage 做“已清理”标记：同标签页内的后续导航（如持久化用例）不再清空，
  // 而新用例的全新上下文会重新清理，避免用例间通过 localStorage 串扰。
  await context.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__kf_storage_cleared')) {
        localStorage.clear();
        sessionStorage.setItem('__kf_storage_cleared', '1');
      }
    } catch {
      // ignore
    }
  });
});

export { test, expect };
