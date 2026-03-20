import { mkdir, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { constants } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'data', 'geo');
const DELAY_MS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const PROVINCES = [
  { code: 110000, name: "北京" },
  { code: 120000, name: "天津" },
  { code: 130000, name: "河北" },
  { code: 140000, name: "山西" },
  { code: 150000, name: "内蒙古" },
  { code: 210000, name: "辽宁" },
  { code: 220000, name: "吉林" },
  { code: 230000, name: "黑龙江" },
  { code: 310000, name: "上海" },
  { code: 320000, name: "江苏" },
  { code: 330000, name: "浙江" },
  { code: 340000, name: "安徽" },
  { code: 350000, name: "福建" },
  { code: 360000, name: "江西" },
  { code: 370000, name: "山东" },
  { code: 410000, name: "河南" },
  { code: 420000, name: "湖北" },
  { code: 430000, name: "湖南" },
  { code: 440000, name: "广东" },
  { code: 450000, name: "广西" },
  { code: 460000, name: "海南" },
  { code: 500000, name: "重庆" },
  { code: 510000, name: "四川" },
  { code: 520000, name: "贵州" },
  { code: 530000, name: "云南" },
  { code: 540000, name: "西藏" },
  { code: 610000, name: "陕西" },
  { code: 620000, name: "甘肃" },
  { code: 630000, name: "青海" },
  { code: 640000, name: "宁夏" },
  { code: 650000, name: "新疆" },
  { code: 710000, name: "台湾" },
  { code: 810000, name: "香港" },
  { code: 820000, name: "澳门" }
];

const failedUrls = [];

async function download(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Referer': 'https://datav.aliyun.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.text();
    } catch(e) {
      if (attempt < retries) {
        console.log(`    重试 ${attempt}/${retries}...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw e;
      }
    }
  }
}

async function fileExists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl(code) {
  return `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
}

async function main() {
  console.log('=== 全国行政区划数据下载 ===\n');
  console.log(`数据目录: ${OUTPUT_DIR}`);
  console.log(`请求间隔: ${DELAY_MS}ms`);
  console.log(`失败重试: ${MAX_RETRIES} 次\n`);
  
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  let total = 0, skipped = 0, failed = 0;
  const startTime = Date.now();

  for (const prov of PROVINCES) {
    console.log(`\n【${prov.name}】(${prov.code})`);
    
    const provPath = join(OUTPUT_DIR, `${prov.code}.json`);
    const provUrl = buildUrl(prov.code);
    
    if (await fileExists(provPath)) {
      console.log(`  省级: 已存在，跳过`);
      skipped++;
    } else {
      try {
        const provData = await download(provUrl);
        await writeFile(provPath, provData, 'utf-8');
        console.log(`  省级: ✓ 下载完成`);
        total++;
        await sleep(DELAY_MS);
      } catch(e) {
        console.error(`  省级: ✗ 下载失败 - ${e.message}`);
        console.error(`  失败URL: ${provUrl}`);
        failedUrls.push({ name: prov.name, code: prov.code, url: provUrl, error: e.message });
        failed++;
        continue;
      }
    }

    let provJson;
    try {
      const provData = await download(provUrl);
      provJson = JSON.parse(provData);
    } catch(e) {
      console.error(`  无法获取省级数据: ${e.message}`);
      console.error(`  失败URL: ${provUrl}`);
      failedUrls.push({ name: prov.name, code: prov.code, url: provUrl, error: '无法获取省级数据' });
      continue;
    }

    const cities = (provJson.features || []).filter(f => 
      f.properties.adcode !== prov.code
    );

    console.log(`  下辖 ${cities.length} 个市级行政区`);

    for (const city of cities) {
      const cityCode = city.properties.adcode;
      const cityName = city.properties.name;
      const cityPath = join(OUTPUT_DIR, `${cityCode}.json`);
      const cityUrl = buildUrl(cityCode);

      if (await fileExists(cityPath)) {
        skipped++;
      } else {
        try {
          const cityData = await download(cityUrl);
          await writeFile(cityPath, cityData, 'utf-8');
          total++;
          await sleep(DELAY_MS);
        } catch(e) {
          console.error(`    ${cityName}: ✗ 下载失败 - ${e.message}`);
          console.error(`    失败URL: ${cityUrl}`);
          failedUrls.push({ name: cityName, code: cityCode, url: cityUrl, error: e.message });
          failed++;
          continue;
        }
      }

      let cityJson;
      try {
        const cityRes = await fetch(cityUrl, {
          headers: {
            'Referer': 'https://datav.aliyun.com/',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        if (!cityRes.ok) throw new Error(`HTTP ${cityRes.status}`);
        cityJson = JSON.parse(await cityRes.text());
        await sleep(DELAY_MS);
      } catch(e) {
        continue;
      }

      const counties = (cityJson.features || []).filter(f => {
        const parent = f.properties.parent?.adcode;
        return parent === cityCode;
      });

      for (const county of counties) {
        const countyCode = county.properties.adcode;
        const countyName = county.properties.name;
        const countyPath = join(OUTPUT_DIR, `${countyCode}.json`);
        const countyUrl = buildUrl(countyCode);

        if (await fileExists(countyPath)) {
          skipped++;
        } else {
          try {
            const countyData = await download(countyUrl);
            await writeFile(countyPath, countyData, 'utf-8');
            total++;
            await sleep(DELAY_MS);
          } catch(e) {
            console.error(`      ${countyName}: ✗ 下载失败 - ${e.message}`);
            console.error(`      失败URL: ${countyUrl}`);
            failedUrls.push({ name: countyName, code: countyCode, url: countyUrl, error: e.message });
            failed++;
          }
        }
      }

      console.log(`    ${cityName}: ✓ 完成 (${counties.length} 区县)`);
    }
    console.log(`  ${prov.name} 全部完成`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n');
  console.log('='.repeat(60));
  console.log('下载完成!');
  console.log(`  成功下载: ${total} 个文件`);
  console.log(`  已存在跳过: ${skipped} 个文件`);
  console.log(`  下载失败: ${failed} 个文件`);
  console.log(`  耗时: ${elapsed} 秒`);
  console.log('='.repeat(60));

  if (failedUrls.length > 0) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('失败链接列表（可用于手动排查）:');
    console.log('='.repeat(60));
    for (const item of failedUrls) {
      console.log(`\n[${item.name}] (${item.code})`);
      console.log(`  URL: ${item.url}`);
      console.log(`  错误: ${item.error}`);
    }
    console.log('\n提示: 如果所有链接都失败，可能是 IP 被限制，请等待一段时间后重试');
    console.log('提示: 如果只有部分链接失败，可能是网络波动，可以重新运行脚本（支持断点续传）');
  }
}

main().catch(err => {
  console.error('下载脚本执行失败:', err);
  process.exit(1);
});
