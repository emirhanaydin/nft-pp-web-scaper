import { Page } from 'puppeteer';
import { writeFile } from 'fs/promises';

const path = require('path');

export default class PageDownloader {
  constructor(private page: Page, private rootPath: string) {}

  async savePage(url: string, pageName: string) {
    const { page, rootPath } = this;

    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    if (!response.ok()) {
      throw new Error(response.statusText());
    }

    const filePath = path.resolve(rootPath, `${pageName}.html`);
    await writeFile(filePath, await page.content());
  }
}
