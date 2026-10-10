/* Insight: renders a tiny page to PDF through the shared headless browser (used by story PDF export). */
import { closeBrowser, getBrowser } from '../src/utils/headless-browser';

const out = process.argv[2] ?? 'smoke.pdf';
const browser = await getBrowser();
const page = await browser.newPage();
await page.setContent('<h1>Insight PDF export</h1><p>It works.</p>');
await Bun.write(out, await page.pdf({ format: 'A4' }));
await page.close();
await closeBrowser();
console.log(`wrote ${out}`);
