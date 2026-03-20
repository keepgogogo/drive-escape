import { readdir, stat, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'geo');
const MAX_AGE_DAYS = 30;
const DELAY_MS = 100;

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== 行政区划数据更新 ===\n');
  console.log(`数据目录: ${DATA_DIR}`);
  console.log(`更新阈值: ${MAX_AGE_DAYS} 天\n`);

  let files;
  try {
    files = await readdir(DATA_DIR);
  } catch(e) {
    console.error(`无法读取数据目录: ${DATA_DIR}`);
    console.log('请先运行 npm run download 下载数据');
    process.exit(1);
  }

  const jsonFiles = files.filter(f => f.endsWith('.json'));
  console.log(`共有 ${jsonFiles.length} 个数据文件\n`);

  const now = Date.now();
  let updated = 0, failed = 0, skipped = 0;
  const startTime = Date.now();

  for (const file of jsonFiles) {
    const filePath = join(DATA_DIR, file);
    const stats = await stat(filePath);
    const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageDays < MAX_AGE_DAYS) {
      skipped++;
      continue;
    }

    const code = file.replace('.json', '');
    console.log(`更新 ${code} (${Math.round(ageDays)} 天前)`);

    try {
      const data = await download(
        `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`
      );
      await writeFile(filePath, data, 'utf-8');
      console.log(`  ✓ 更新成功`);
      updated++;
      await sleep(DELAY_MS);
    } catch(e) {
      console.error(`  ✗ 更新失败: ${e.message}`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(50));
  console.log('更新完成!');
  console.log(`  已更新: ${updated} 个文件`);
  console.log(`  无需更新: ${skipped} 个文件`);
  console.log(`  更新失败: ${failed} 个文件`);
  console.log(`  耗时: ${elapsed} 秒`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('更新脚本执行失败:', err);
  process.exit(1);
});
