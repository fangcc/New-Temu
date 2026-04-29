import { chromium } from 'playwright-core';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const apiBase = `${baseUrl}/api/trpc/productRecords`;

async function rpcGet(path) {
  const res = await fetch(`${apiBase}.${path}`, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function rpcPost(path, input) {
  const payload = {
    json: input,
    meta: {
      values: {
        uploadedAt: ['Date'],
      },
    },
  };

  const res = await fetch(`${apiBase}.${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function unwrapRpc(result) {
  return result?.result?.data?.json ?? result?.result?.data ?? result;
}

function makeRecord(index, listingDate) {
  return {
    productName: `分页验证产品 ${index}`,
    sourceCollectionUrl: `https://source.example.com/item-${index}`,
    supplierUrl: `https://supplier.example.com/item-${index}`,
    listingDate,
    costPrice: `${20 + index}`,
    salePrice: `${45 + index}`,
    weight: `${100 + index}`,
    note: `用于分页验证的自动化测试记录 ${index}`,
    images: [],
  };
}

async function ensureEnoughRecords() {
  const listResult = await rpcGet('list');
  const records = unwrapRpc(listResult);
  const existing = Array.isArray(records) ? records : [];
  const targetCount = 7;

  if (existing.length >= targetCount) {
    return { created: 0, total: existing.length };
  }

  const listingDate = '2026-04-15';
  let created = 0;
  for (let i = existing.length + 1; i <= targetCount; i += 1) {
    const createResult = await rpcPost('create', makeRecord(i, listingDate));
    unwrapRpc(createResult);
    created += 1;
  }

  return { created, total: targetCount };
}

async function run() {
  const seed = await ensureEnoughRecords();

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

  const findings = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('产品记录').first().waitFor({ state: 'visible', timeout: 15000 });

    const resultsText = await page.getByText(/共\s*\d+\s*条结果/).first().textContent();
    findings.push(`结果计数显示：${resultsText?.trim() ?? '未找到'}`);

    const pageSummary = page.getByText(/当前显示第\s*\d+-\d+\s*条，共\s*\d+\s*条记录/).first();
    await pageSummary.waitFor({ state: 'visible', timeout: 15000 });
    findings.push(`初始分页摘要：${(await pageSummary.textContent())?.trim() ?? '未找到'}`);

    const pageIndicator = page.getByText(/第\s*\d+\s*\/\s*\d+\s*页/).first();
    findings.push(`初始页码：${(await pageIndicator.textContent())?.trim() ?? '未找到'}`);

    const visibleBefore = await page.getByRole('button', { name: /点击展开查看完整记录/ }).count();
    findings.push(`首页可见折叠记录数：${visibleBefore}`);

    const nextLink = page.locator('a[aria-label="Go to next page"], a[aria-label="Next page"], a[aria-label="下一页"]').first();
    await nextLink.click();
    await page.waitForTimeout(500);

    findings.push(`翻页后页码：${(await pageIndicator.textContent())?.trim() ?? '未找到'}`);
    findings.push(`翻页后分页摘要：${(await pageSummary.textContent())?.trim() ?? '未找到'}`);

    const secondPageRecords = await page.getByRole('button', { name: /点击展开查看完整记录/ }).count();
    findings.push(`第二页可见折叠记录数：${secondPageRecords}`);

    const firstRecordOnPage = page.getByRole('button', { name: /点击展开查看完整记录/ }).first();
    await firstRecordOnPage.click();
    await page.waitForTimeout(400);
    const detailVisible = await page.locator('text=源采集平台链接').first().isVisible();
    findings.push(`第二页展开详情：${detailVisible ? '成功显示完整信息卡片' : '未成功显示完整信息卡片'}`);

    const dateInput = page.locator('input[type="date"]').nth(1);
    await dateInput.fill('2026-04-15');
    await page.waitForTimeout(700);
    findings.push(`筛选后页码：${(await pageIndicator.textContent())?.trim() ?? '未找到'}`);
    findings.push(`筛选后分页摘要：${(await pageSummary.textContent())?.trim() ?? '未找到'}`);

    await page.screenshot({ path: '/home/ubuntu/product-listing-tracker/pagination-verification.png', fullPage: true });
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ seed, findings }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
