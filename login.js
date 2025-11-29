const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 500, max = 1500) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 检查页面是否仍为验证页面
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

// 精准定位验证复选框并点击（保留所有方法）
async function clickVerifyCheckbox(page) {
  const originalUrl = page.url();
  console.log('开始验证操作，原始URL:', originalUrl);
  
  // 截图中复选框的核心位置（基于提供的两张截图分析）
  const screenshotPositions = [
    { x: 50, y: 220 },  // 截图1中复选框位置
    { x: 60, y: 240 },  // 截图2中复选框位置
    { x: 45, y: 230 },  // 截图中间位置
    { x: 55, y: 210 },  // 截图上方位置
    { x: 40, y: 250 }   // 截图下方位置
  ];
  
  // 常见复选框位置
  const commonPositions = [
    { x: 80, y: 300 },  // 常见左上区域
    { x: 100, y: 280 }, // 常见中上区域
    { x: 60, y: 320 },  // 常见左下区域
    { x: 90, y: 260 }   // 常见右上区域
  ];

  // 方法1：基于截图分析的精准定位（优先策略）
  try {
    console.log('方法1：基于截图分析的精准定位');
    
    // 等待验证容器加载
    const container = await page.waitForSelector('body > div:not([style*="display:none"])', { 
      timeout: 5000 
    });
    
    if (container) {
      const containerBounds = await container.boundingBox();
      if (containerBounds) {
        // 先尝试截图中的精准位置
        for (const pos of screenshotPositions) {
          // 计算相对容器的位置（适配不同屏幕）
          const clickX = containerBounds.x + pos.x;
          const clickY = containerBounds.y + pos.y;
          
          console.log(`方法1 - 点击截图位置: (${clickX}, ${clickY})`);
          
          // 模拟自然鼠标移动
          await page.mouse.move(clickX - 30, clickY - 20, { steps: 4 });
          await randomDelay(200, 400);
          await page.mouse.move(clickX, clickY, { steps: 2 });
          await randomDelay(150, 300);
          
          // 点击操作
          await page.mouse.down({ button: 'left' });
          await randomDelay(100, 200);
          await page.mouse.up({ button: 'left' });
          
          // 检查是否已跳出验证
          await randomDelay(2000, 3000);
          if (!(await isVerificationPage(page))) {
            console.log(`方法1成功 - 在截图位置(${clickX}, ${clickY})点击后验证通过`);
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.log('方法1部分失败:', e.message);
  }
  
  // 方法2：专用选择器定位（Cloudflare验证框）
  try {
    console.log('方法2：Cloudflare专用选择器定位');
    const cfSelectors = [
      'input[type="checkbox"][name="cf-turnstile-response"]',
      'div.cf-turnstile-checkbox',
      'input[type="checkbox"].cf-checkbox',
      'div[role="checkbox"].cf-turnstile',
      'div:has(> img[alt*="Cloudflare"]) + input[type="checkbox"]'
    ];
    
    for (const selector of cfSelectors) {
      try {
        console.log(`方法2 - 尝试选择器: ${selector}`);
        const checkbox = await page.waitForSelector(selector, { timeout: 2000 });
        if (checkbox) {
          const box = await checkbox.boundingBox();
          if (box) {
            console.log(`方法2 - 找到复选框位置: (${box.x}, ${box.y})`);
            
            // 模拟人类点击行为
            await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
            await randomDelay(200, 400);
            await page.click(selector, { delay: 150 });
            
            await randomDelay(2000, 3000);
            if (!(await isVerificationPage(page))) {
              console.log(`方法2成功 - 通过选择器${selector}验证通过`);
              return true;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('方法2失败:', e.message);
  }
  
  // 方法3：常见位置点击（补充策略）
  try {
    console.log('方法3：常见验证框位置点击');
    
    for (const pos of commonPositions) {
      console.log(`方法3 - 点击常见位置: (${pos.x}, ${pos.y})`);
      
      // 模拟鼠标移动
      await page.mouse.move(pos.x - 20, pos.y - 15, { steps: 3 });
      await randomDelay(150, 300);
      await page.mouse.move(pos.x, pos.y, { steps: 2 });
      await randomDelay(100, 200);
      
      // 点击
      await page.mouse.click(pos.x, pos.y, { button: 'left' });
      
      // 检查结果
      await randomDelay(1500, 2500);
      if (!(await isVerificationPage(page))) {
        console.log(`方法3成功 - 在常见位置(${pos.x}, ${pos.y})验证通过`);
        return true;
      }
    }
  } catch (e) {
    console.log('方法3失败:', e.message);
  }
  
  // 方法4：截图位置附近密集点击（重点策略）
  try {
    console.log('方法4：截图位置附近密集点击');
    
    // 基于截图位置的密集点击区域（以截图位置为中心扩展）
    const centerX = 50;  // 截图复选框X坐标中心
    const centerY = 230; // 截图复选框Y坐标中心
    const radius = 30;   // 扩展半径
    const step = 8;      // 步长
    
    // 先移动到区域附近
    await page.mouse.move(centerX - radius, centerY - radius);
    await randomDelay(300, 500);
    
    // 网格状密集点击
    for (let x = centerX - radius; x <= centerX + radius; x += step) {
      for (let y = centerY - radius; y <= centerY + radius; y += step) {
        console.log(`方法4 - 密集点击: (${x}, ${y})`);
        await page.mouse.move(x, y, { steps: 2 });
        await randomDelay(80, 150);
        await page.mouse.click(x, y, { button: 'left' });
        
        // 检查是否已通过验证
        await randomDelay(1000, 1500);
        if (!(await isVerificationPage(page))) {
          console.log(`方法4成功 - 在密集区域(${x}, ${y})验证通过`);
          return true;
        }
      }
    }
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
    
    // 检查是否需要验证
    let isVerifying = await isVerificationPage(page);
    if (!isVerifying) {
      console.log('初始页面不是验证页面，直接进入登录流程');
    } else {
      // 验证重试循环
      while (verificationAttempts < maxVerificationAttempts && isVerifying) {
        verificationAttempts++;
        console.log(`\n========== 验证尝试 ${verificationAttempts}/${maxVerificationAttempts} ==========`);
        
        // 执行所有验证方法
        const success = await clickVerifyCheckbox(page);
        
        // 检查验证状态
        isVerifying = await isVerificationPage(page);
        
        if (!isVerifying || success) {
          console.log(`验证尝试 ${verificationAttempts} 成功！已跳出验证页面`);
          break;
        }
        
        console.log(`验证尝试 ${verificationAttempts} 后仍在验证页面`);
        
        // 最后一次尝试失败
        if (verificationAttempts >= maxVerificationAttempts) {
          await page.screenshot({ path: 'verification-failure.png', fullPage: true });
          throw new Error(`验证失败：${maxVerificationAttempts}次尝试均未通过`);
        }
        
        // 刷新页面重试
        console.log('刷新页面准备下一次尝试...');
        await page.reload({ waitUntil: 'networkidle2' });
        await randomDelay(2000, 3000);
      }
    }
    
    // 登录流程
    console.log('\n========== 开始登录操作 ==========');
    
    try {
      await page.waitForSelector('#email, [name="email"], #password, [name="password"]', { timeout: 10000 });
    } catch (e) {
      console.log('未找到登录表单，检查是否已登录...');
      const finalUrl = page.url();
      const finalTitle = await page.title();
      
      if (!finalTitle.includes('Login') && !finalUrl.includes('/login')) {
        console.log('✅ 已登录成功！');
        await browser.close();
        return;
      } else {
        throw new Error('无法找到登录表单');
      }
    }
    
    // 输入账号密码
    try {
      await page.hover('#email, [name="email"]');
      await randomDelay(500, 1000);
      
      const emailSelector = (await page.$('#email')) ? '#email' : '[name="email"]';
      const email = process.env.USERNAME;
      console.log(`输入邮箱到 ${emailSelector}`);
      for (const char of email) {
        await page.type(emailSelector, char);
        await randomDelay(100, 200);
      }
      
      await randomDelay(800, 1200);
      
      await page.hover('#password, [name="password"]');
      await randomDelay(500, 1000);
      
      const passwordSelector = (await page.$('#password')) ? '#password' : '[name="password"]';
      const password = process.env.PASSWORD;
      console.log(`输入密码到 ${passwordSelector}`);
      for (const char of password) {
        await page.type(passwordSelector, char);
        await randomDelay(100, 200);
      }
      
      await randomDelay(1500, 2500);
      
      // 点击提交
      await page.click('button[type="submit"], input[type="submit"]', { delay: 200 });
      await randomDelay(3000, 5000);
      
      const afterLoginUrl = page.url();
      const afterLoginTitle = await page.title();
      
      console.log(`登录后URL: ${afterLoginUrl}`);
      if (!afterLoginUrl.includes('/login') && !afterLoginTitle.includes('Login')) {
        console.log('✅ 登录成功！');
      } else {
        throw new Error('登录失败，页面未跳转');
      }
      
    } catch (e) {
      console.log('登录操作失败:', e.message);
      throw e;
    }
    
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
