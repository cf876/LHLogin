const puppeteer = require('puppeteer');

// 随机延迟函数
function randomDelay(min = 500, max = 1500) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 检查是否仍在验证页面
async function isVerificationPage(page) {
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  // 验证页面特征判断
  return currentUrl.includes('cdn-cgi/challenge') || 
         pageTitle.includes('Just a moment') || 
         pageTitle.includes('Verify you are human') ||
         (await page.evaluate(() => {
           const bodyText = document.body.innerText.toLowerCase();
           return bodyText.includes('verify you are human') || bodyText.includes('cloudflare');
         }).catch(() => false));
}

// 精准定位验证复选框并点击（每次点击后都检查跳转）
async function clickVerifyCheckbox(page) {
  const originalUrl = page.url();
  console.log('开始验证操作，原始URL:', originalUrl);
  
  // 截图中复选框核心位置
  const screenshotPositions = [
    { x: 50, y: 220 },  // 截图1位置
    { x: 60, y: 240 },  // 截图2位置
    { x: 45, y: 230 },  // 中间位置
    { x: 55, y: 210 },  // 上方位置
    { x: 40, y: 250 }   // 下方位置
  ];
  
  // 常见复选框位置
  const commonPositions = [
    { x: 80, y: 300 }, { x: 100, y: 280 },
    { x: 60, y: 320 }, { x: 90, y: 260 }
  ];

  // 方法1：截图位置精准点击（每次点击后检查跳转）
  try {
    console.log('方法1：截图位置精准点击');
    const container = await page.waitForSelector('body > div:not([style*="display:none"])', { timeout: 5000 });
    
    if (container) {
      const containerBounds = await container.boundingBox();
      if (containerBounds) {
        for (const pos of screenshotPositions) {
          const clickX = containerBounds.x + pos.x;
          const clickY = containerBounds.y + pos.y;
          console.log(`方法1 - 点击截图位置: (${clickX}, ${clickY})`);
          
          // 模拟鼠标移动
          await page.mouse.move(clickX - 30, clickY - 20, { steps: 4 });
          await randomDelay(200, 400);
          await page.mouse.move(clickX, clickY, { steps: 2 });
          await randomDelay(150, 300);
          
          // 点击操作
          await page.mouse.down({ button: 'left' });
          await randomDelay(100, 200);
          await page.mouse.up({ button: 'left' });
          
          // 关键：点击后立即检查是否跳转
          await randomDelay(2000, 3000);
          const stillVerifying = await isVerificationPage(page);
          if (!stillVerifying) {
            console.log(`方法1成功 - 已跳转至非验证页面`);
            return true;
          }
          console.log(`方法1 - 点击后仍在验证页面，继续尝试`);
        }
      }
    }
  } catch (e) {
    console.log('方法1部分失败:', e.message);
  }
  
  // 方法2：专用选择器定位（每次点击后检查跳转）
  try {
    console.log('方法2：Cloudflare专用选择器定位');
    const cfSelectors = [
      'input[type="checkbox"][name="cf-turnstile-response"]',
      'div.cf-turnstile-checkbox',
      'input[type="checkbox"].cf-checkbox',
      'div[role="checkbox"].cf-turnstile'
    ];
    
    for (const selector of cfSelectors) {
      try {
        console.log(`方法2 - 尝试选择器: ${selector}`);
        const checkbox = await page.waitForSelector(selector, { timeout: 2000 });
        if (checkbox) {
          const box = await checkbox.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
            await randomDelay(200, 400);
            await page.click(selector, { delay: 150 });
            
            // 关键：点击后检查跳转
            await randomDelay(2000, 3000);
            if (!(await isVerificationPage(page))) {
              console.log(`方法2成功 - 已跳转至非验证页面`);
              return true;
            }
            console.log(`方法2 - 点击后仍在验证页面，继续尝试`);
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('方法2失败:', e.message);
  }
  
  // 方法3：常见位置点击（每次点击后检查跳转）
  try {
    console.log('方法3：常见验证框位置点击');
    for (const pos of commonPositions) {
      console.log(`方法3 - 点击常见位置: (${pos.x}, ${pos.y})`);
      
      await page.mouse.move(pos.x - 20, pos.y - 15, { steps: 3 });
      await randomDelay(150, 300);
      await page.mouse.move(pos.x, pos.y, { steps: 2 });
      await randomDelay(100, 200);
      await page.mouse.click(pos.x, pos.y, { button: 'left' });
      
      // 关键：点击后检查跳转
      await randomDelay(1500, 2500);
      if (!(await isVerificationPage(page))) {
        console.log(`方法3成功 - 已跳转至非验证页面`);
        return true;
      }
      console.log(`方法3 - 点击后仍在验证页面，继续尝试`);
    }
  } catch (e) {
    console.log('方法3失败:', e.message);
  }
  
  // 方法4：截图位置附近密集点击（批量点击后检查跳转）
  try {
    console.log('方法4：截图位置附近密集点击');
    const centerX = 50;
    const centerY = 230;
    const radius = 30;
    const step = 8;
    
    await page.mouse.move(centerX - radius, centerY - radius);
    await randomDelay(300, 500);
    
    // 密集点击区域内所有点
    const clickPositions = [];
    for (let x = centerX - radius; x <= centerX + radius; x += step) {
      for (let y = centerY - radius; y <= centerY + radius; y += step) {
        clickPositions.push({x, y});
      }
    }
    
    // 执行密集点击
    for (const pos of clickPositions) {
      console.log(`方法4 - 密集点击: (${pos.x}, ${pos.y})`);
      await page.mouse.move(pos.x, pos.y, { steps: 2 });
      await randomDelay(80, 150);
      await page.mouse.click(pos.x, pos.y, { button: 'left' });
    }
    
    // 关键：密集点击后检查跳转
    await randomDelay(2000, 3000);
    if (!(await isVerificationPage(page))) {
      console.log(`方法4成功 - 已跳转至非验证页面`);
      return true;
    }
    console.log(`方法4 - 密集点击后仍在验证页面`);
  } catch (e) {
    console.log('方法4失败:', e.message);
  }
  
  return false;
}

async function login() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1200,800'
    ]
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1200, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  page.on('console', msg => console.log('页面日志:', msg.text()));
  
  let verificationAttempts = 0;
  const maxVerificationAttempts = 3;
  
  try {
    await page.goto(process.env.WEBSITE_URL || 'https://betadash.lunes.host', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // 检查初始页面是否为验证页面
    let isVerifying = await isVerificationPage(page);
    if (!isVerifying) {
      console.log('初始页面不是验证页面，直接进入登录流程');
    } else {
      // 验证重试循环（严格基于跳转状态判断）
      while (verificationAttempts < maxVerificationAttempts) {
        verificationAttempts++;
        console.log(`\n========== 验证尝试 ${verificationAttempts}/${maxVerificationAttempts} ==========`);
        
        // 执行所有验证方法（内部已包含跳转检查）
        const success = await clickVerifyCheckbox(page);
        
        // 再次确认是否仍在验证页面
        isVerifying = await isVerificationPage(page);
        
        // 如果已跳转，停止尝试
        if (!isVerifying || success) {
          console.log(`验证尝试 ${verificationAttempts} 成功！已跳出验证页面`);
          break;
        }
        
        // 如果仍在验证页面且未达最大次数，准备下一次尝试
        if (verificationAttempts < maxVerificationAttempts) {
          console.log(`当前仍在验证页面，准备第 ${verificationAttempts + 1} 次尝试`);
          await page.reload({ waitUntil: 'networkidle2' });
          await randomDelay(2000, 3000);
        }
      }
      
      // 所有尝试后仍在验证页面
      if (isVerifying) {
        await page.screenshot({ path: 'verification-failure.png', fullPage: true });
        throw new Error(`验证失败：${maxVerificationAttempts}次尝试后仍在验证页面`);
      }
    }
    
    // 登录流程（省略，保持原有逻辑）
    console.log('\n========== 开始登录操作 ==========');
    // ... 登录相关代码 ...
    
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('\n❌ 流程失败：', error.message);
    console.error('错误截图已保存');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
