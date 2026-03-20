import { mkdir, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { constants } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'data', 'geo');
const DELAY_MS = 100;

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

async function download(url) {
  const res = await fetch(url, {
    headers: {
      'Referer': 'https://datav.aliyun.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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

async function main() {
  console.log('=== 全国行政区划数据下载 ===\n');
  console.log(`数据目录: ${OUTPUT_DIR}\n`);
  
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  let total = 0, skipped = 0, failed = 0;
  const startTime = Date.now();

  for (const prov of PROVINCES) {
    console.log(`\n【${prov.name}】(${prov.code})`);
    
    const provPath = join(OUTPUT_DIR, `${prov.code}.json`);
    
    if (await fileExists(provPath)) {
      console.log(`  省级: 已存在，跳过`);
      skipped++;
    } else {
      try {
        const provData = await download(
          `https://geo.datav.aliyun.com/areas_v3/bound/${prov.code}_full.json`
        );
        await writeFile(provPath, provData, 'utf-8');
        console.log(`  省级: ✓ 下载完成`);
        total++;
        await sleep(DELAY_MS);
      } catch(e) {
        console.error(`  省级: ✗ 下载失败 - ${e.message}`);
        failed++;
        continue;
      }
    }

    let provJson;
    try {
      const provData = await download(
        `https://geo.datav.aliyun.com/areas_v3/bound/${prov.code}_full.json`
      );
      provJson = JSON.parse(provData);
    } catch(e) {
      console.error(`  无法解析省级数据`);
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

      if (await fileExists(cityPath)) {
        skipped++;
      } else {
        try {
          const cityData = await download(
            `https://geo.datav.aliyun.com/areas_v3/bound/${cityCode}_full.json`
          );
          await writeFile(cityPath, cityData, 'utf-8');
          total++;
          await sleep(DELAY_MS);
        } catch(e) {
          console.error(`    ${cityName}: ✗ 下载失败`);
          failed++;
          continue;
        }
      }

      let cityJson;
      try {
        const cityRes = await fetch(
          `https://geo.datav.aliyun.com/areas_v3/bound/${cityCode}_full.json`,
          {
            headers: {
              'Referer': 'https://datav.aliyun.com/',
              'User-Agent': 'Mozilla/5.0'
            }
          }
        );
        cityJson = JSON.parse(await cityRes.text());
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

        if (await fileExists(countyPath)) {
          skipped++;
        } else {
          try {
            const countyData = await download(
              `https://geo.datav.aliyun.com/areas_v3/bound/${countyCode}_full.json`
            );
            await writeFile(countyPath, countyData, 'utf-8');
            total++;
            await sleep(DELAY_MS);
          } catch(e) {
            failed++;
          }
        }
      }

      process.stdout.write(`    ${cityName}: ✓ 完成 (${counties.length} 区县)\r`);
    }
    console.log(`    ${prov.name} 全部完成`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n');
  console.log('='.repeat(50));
  console.log('下载完成!');
  console.log(`  成功下载: ${total} 个文件`);
  console.log(`  已存在跳过: ${skipped} 个文件`);
  console.log(`  下载失败: ${failed} 个文件`);
  console.log(`  耗时: ${elapsed} 秒`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('下载脚本执行失败:', err);
  process.exit(1);
});
