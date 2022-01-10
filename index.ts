import puppeteer from 'puppeteer';
import { readFile, writeFile } from 'fs/promises';
import PageDownloader from './src/PageDownloader';
import CollectionParser from './src/CollectionParser';

const urlBase = 'https://opensea.io/assets';
const collectionId = '0x569f26145f0c2fcc3da68395be3639009c53b6d8';

function getUrl(assetId: string) {
  return [urlBase, collectionId, assetId].join('/');
}

async function downloadAssets(ids: number[]) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const downloader = new PageDownloader(page, 'pages');

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    try {
      const assetId = id.toString();
      const url = getUrl(assetId);
      await downloader.savePage(url, assetId);
      console.log(`${id}.html has been saved.`, new Date());
    } catch (e) {
      console.error(e);
      i--;
    }
  }

  await browser.close();
}

function isAssetCorrupt(entry: string) {
  const cells = entry.split(',');
  return cells.length < 3 || /^0(?:\.0)?$/m.test(cells[cells.length - 1]);
}

async function parseAssets() {
  const filePath = 'data.csv';
  const lines = await (async () =>
    (await readFile(filePath, 'utf-8')).split(/\r?\n/))();

  const parseSubset = async (start: number, end: number) => {
    const columns = ['Id'];
    const firstSubset = start === 1;

    const rowPromises = Array.from(
      { length: end - start + 1 },
      async (_, i) => {
        const id = i + start;
        const isHeader = firstSubset && i < 1;
        if (!isHeader && !isAssetCorrupt(lines[id])) return lines[id];

        const parser = await CollectionParser.fromFile(`pages/${id}.html`);
        const properties = parser.parseCollection();

        if (isHeader) {
          columns.push(...properties.map((p) => p.type));
        }

        const cells = properties.map((p) => p.value);
        const row = [id.toString(), ...cells].join(',');

        console.log(`${id} has been parsed.`);

        return row;
      },
    );

    const subsetName = `subset [${start}, ${end}]`;

    const rows = await Promise.all(rowPromises);
    console.log(`Collections in ${subsetName} have been parsed.`);

    const data = firstSubset
      ? [columns.join(','), '\n', rows.join('\n')]
      : `\n${rows.join('\n')}`;

    console.log(`Writing ${subsetName} to ${filePath}...`);
    const options = firstSubset ? {} : { flag: 'a' };
    await writeFile(filePath, data, options);
  };

  const foldSize = 100;
  const totalSize = 10000;

  const repeats = Math.floor(totalSize / foldSize);

  for (let i = 0; i < repeats; i++) {
    await parseSubset(i * foldSize + 1, (i + 1) * foldSize);
  }

  const leftoverSize = totalSize % foldSize;
  if (leftoverSize !== 0) {
    await parseSubset(foldSize * repeats + 1, totalSize);
  }

  console.log('All collections have been written.');
}

async function filterFile() {
  const fileName = 'data.csv';
  const content = await readFile(fileName, 'utf-8');
  const lines = content.split(/(?<=\r?\n)/);

  const result = lines.map((s) =>
    s
      .replace(/(?<=,)0(?:\.0)?$/m, '')
      .replace(/^(\d+),$/m, `$1${','.repeat(10)}`),
  );
  await writeFile(`${fileName.replace('.csv', '')}-filtered.csv`, result);
}

function getAssetId(entry: string) {
  return parseInt(entry.slice(0, entry.indexOf(',')), 10);
}

async function getMissingIds() {
  const filePath = 'data.csv';
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  return lines.reduce((previousValue, currentValue) => {
    if (isAssetCorrupt(currentValue)) {
      previousValue.push(getAssetId(currentValue));
    }
    return previousValue;
  }, [] as number[]);
}

async function addRarityPercent() {
  const filePath = 'data-filtered.csv';
  const outPath = 'data-rarity.csv';
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split(/(?<=\r?\n)/);
  const [header] = lines.splice(0, 1);

  const cols = header.split(',');
  const rarityIdx = cols.indexOf('Rarity');
  cols.splice(rarityIdx + 1, 0, 'Rarity (percent)');

  const quantities = new Map([
    ['A', 593],
    ['B', 992],
    ['C', 2973],
    ['D', 4924],
    ['S', 296],
    ['S+', 100],
    ['Admin', 4],
    ['Illegal', 10],
    ['Prototype', 12],
  ]);

  for (const [k, v] of quantities.entries()) {
    quantities.set(k, Math.round((v / 10000) * 10000) / 10000);
  }

  const result = lines.map((s) => {
    const cells = s.split(',');
    const rarity = cells[rarityIdx];
    const numRarity = quantities.get(rarity);
    cells.splice(rarityIdx + 1, 0, numRarity?.toString() || '');
    return cells.join(',');
  });

  await writeFile(outPath, [cols.join(','), ...result]);
}

async function main() {
  const arg = process.argv[2];

  switch (arg) {
    case 'download': {
      let ids = [] as number[];
      do {
        ids = await getMissingIds();
        console.log(`Starting to download ${ids.length} missing assets.`);
        await downloadAssets(ids);
        await parseAssets();
      } while (ids.length > 0);
      break;
    }
    case 'parse':
      await parseAssets();
      break;
    case 'filter':
      await filterFile();
      break;
    case 'addrarity':
      await addRarityPercent();
      break;
    default:
      throw new Error('No argument given.');
  }
}

main().catch(console.error);
