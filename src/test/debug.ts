
import createBrowserContext from '../lib/chromium';
import { loggerFactory } from '../util/logger';
import { v4 } from 'uuid';

async function mainDebug(userId: string, url: string) {
  console.log('Launching browser...', { userId: userId });

  const context = await createBrowserContext();
  await context.grantPermissions(['microphone', 'camera'], { origin: url });

  const page = await context.newPage();

  console.log('Navigating to URL...');
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('Uploading screenshot...');

  console.log('Closing the browser...');
  await page.context().browser()?.close();
}

export default mainDebug;
