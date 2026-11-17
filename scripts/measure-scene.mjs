/* global document, scrollTo, innerWidth, requestAnimationFrame */
// Local browser measurement, not a cross-device FPS guarantee. Build and serve on 4375 first.
// Usage: node scripts/measure-scene.mjs [http://127.0.0.1:4375]
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:4375';
const dir = 'docs/design-reviews/2026-11-17';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, width, height] of [['desktop',1280,800],['mobile',390,844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
    const fonts = await page.evaluate(() => [...document.fonts].map(f=>({family:f.family,status:f.status})));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const violations = (await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,impact:v.impact}));
    await page.getByRole('switch',{name:'Reduce motion'}).click();
    const flame=page.locator('[data-flame]').first();
    // Allow the toggle's effect to revert the old GSAP context before sampling.
    await expect(page.getByRole('switch',{name:'Reduce motion'})).toHaveAttribute('aria-checked','true');
    await page.waitForTimeout(300);
    const before=await flame.getAttribute('transform');
    await page.waitForTimeout(1100);
    const after=await flame.getAttribute('transform');
    expect(after).toBe(before);
    await page.screenshot({path:`${dir}/${name}-reduced.png`,fullPage:true});
    const now=Date.now(), day=86400000;
    const items=Array.from({length:50},(_,i)=>({id:`perf-${i}`,title:`Demo: performance fixture ${i+1}`,demo:true,zone:'UTC',dateOnly:false,createdAt:now-14*day,lastActivityAt:i%5===3?now-8*day:now,dueAt:i%5===2?now-day:now+(i%5===1?0.25:5)*day,resolution:i%5===4?{kind:'submitted',at:now}:null}));
    const backup={format:'deadline-graveyard-backup',version:1,exportedAt:now,items,settings:[{key:'intro-seen',value:true},{key:'motion',value:'full'}]};
    await page.getByRole('button',{name:'Export and settings'}).click();
    await page.getByLabel('Restore backup').setInputFiles({name:'performance-demo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.getByRole('button',{name:'Replace my graveyard'}).click();
    await expect(page.getByText('Restored 50 deadlines from the backup.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.scene-item')).toHaveCount(50);
    await page.locator('.scene-wrap').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const timing=await page.evaluate(()=>new Promise(resolve=>{
      let first,previous; const frames=[];
      function tick(t){first??=t;if(previous!==undefined) frames.push(t-previous);previous=t;
        if(t-first<5000){requestAnimationFrame(tick);return;}
        const sorted=[...frames].sort((a,b)=>a-b);
        resolve({durationMs:t-first,frames:frames.length,fps:1000*frames.length/(t-first),p95FrameMs:sorted[Math.floor(sorted.length*.95)],over33ms:frames.filter(v=>v>33.4).length});
      }requestAnimationFrame(tick);
    }));
    results.push({name,width,height,fonts,overflow,violations,reducedFlameStatic:before===after,fixtureItems:50,timing});
    await context.close();
  }
  writeFileSync(`${dir}/measurements.json`, JSON.stringify({date:new Date().toISOString(),browser:browser.version(),loadAverage:os.loadavg(),note:'Headless local Chromium, 5-second requestAnimationFrame sample, 50 synthetic demo records imported through the real restore UI. No CPU throttle; not a field measurement.',results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }
