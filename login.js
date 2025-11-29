const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

async function attemptCloudflareVerification(page) {
  console.log('开始Cloudflare验证尝试...');
  
  // 方法1：处理iframe中的验证
  try {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('turnstile') || frame.url().includes('captcha')) {
        console.log('找到验证iframe，尝试点击...');
        await frame.click('input[type="checkbox"]', { delay: 300 });
        await randomDelay(3000, 5000);
        return true;
      }
    }
  } catch (e) {
    console.log('iframe方法失败:', e.message);
  }
  
  // 方法2：多种选择器尝试
  const selectors = [
    '#challenge-stage input[type="checkbox"]',
    '.cf-turnstile input[type="checkbox"]',
    'input[name="cf-turnstile-response"]',
    '.checkbox-wrapper input',
    'div[role="checkbox"]',
    'label[for*="captcha"]',
    'button[id*="verify"]',
    '.verify-button'
  ];
  
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await page.click(selector, { delay: 200 });
      console.log(`成功使用选择器点击: ${selector}`);
      await randomDelay(3000, 5000);
      return true;
    } catch (e) {
      continue;
    }
  }
  
  // 方法3：验证框区域密集点击
  console.log('开始验证框区域密集点击...');
  const clickPatterns = [
    // Cloudflare验证框通常位置的密集点击模式
    { x: 50, y: 300 }, { x: 60, y: 310 }, { x: 70, y: 320 },
    { x: 80, y: 330 }, { x: 90, y: 340 }, { x: 100, y: 350 },
    { x: 40, y: 350 }, { x: 50, y: 360 }, { x: 60, y: 370 },
    { x: 70, y: 380 }, { x: 80, y: 390 }, { x: 90, y: 400 },
    // 第二组位置
    { x: 120, y: 320 }, { x: 130, y: 330 }, { x: 140, y: 340 },
    { x: 150, y: 350 }, { x: 160, y: 360 }, { x: 170, y: 370 }
  ];
  
  for (let i = 0; i < clickPatterns.length; i++) {
    const pos = clickPatterns[i];
    try {
      await page.mouse.move(pos.x, pos.y);
      await randomDelay(100, 200);
      await page.mouse.click(pos.x, pos.y, { delay: 100 });
      
      // 每点击3个位置检查一次页面是否跳转
      if ((i + 1) % 3 === 0) {
        const currentUrl = page.url();
        if (!currentUrl.includes('challenge') && !page.title().includes('Just a moment')) {
          console.log(`密集点击后页面跳转成功（位置: ${pos.x}, ${pos.y}）`);
          return true;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // 方法4：点击页面上所有可能的按钮
  try {
    const buttons = await page.$$('button, [role="button"], input[type="button"], input[type="submit"]');
    for (const button of buttons) {
      try {
        await button.click({ delay: 200 });
        await randomDelay(2000, 3000);
        const title = await page.title();
        if (!title.includes('Just a moment')) {
          console.log('按钮点击后验证通过');
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('按钮点击方法失败:', e.message);
  }
  
  return false;
}

async function login() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ]
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  page.on('console', msg => console.log('页面日志:', msg.text()));
  
  let verificationAttempts = 0;
  const maxVerificationAttempts = 3;
  
  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 验证重试循环
    while (verificationAttempts < maxVerificationAttempts) {
      verificationAttempts++;
      console.log(`\n验证尝试 ${verificationAttempts}/${maxVerificationAttempts}`);
      
      await randomDelay(3000, 5000);
      
      // 尝试验证
      await attemptCloudflareVerification(page);
      
      // 等待验证完成
      await randomDelay(8000, 12000);
      
      // 检查是否通过验证进入登录页面
      const title = await page.title();
      const currentUrl = page.url();
      
      console.log(`当前页面标题: "${title}"`);
      console.log(`当前URL: ${currentUrl}`);
      
      // 判断是否进入登录页面
      if (!title.includes('Just a moment') && !title.includes('Challenge') && 
          !currentUrl.includes('challenge') && !currentUrl.includes('cdn-cgi')) {
        
        // 检查是否有登录表单元素
        try {
          await page.waitForSelector('#email, [name="email"], [name="username"], #username', { timeout: 5000 });
          console.log('验证成功！已进入登录页面');
          break;
        } catch (e) {
          console.log('页面跳转但未找到登录表单，继续验证...');
        }
      }
      
      // 如果是最后一次尝试仍未通过
      if (verificationAttempts >= maxVerificationAttempts) {
        throw new Error(`验证失败：已尝试${maxVerificationAttempts}次仍无法通过Cloudflare验证`);
      }
      
      // 刷新页面重试
      console.log('刷新页面重试验证...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
    
    // 验证通过后，进行登录操作
    console.log('\n开始登录操作...');
    
    // 等待登录表单加载
    await page.waitForSelector('#email, [name="email"], [name="username"], #username', { timeout: 10000 });
    
    // 模拟真人移动鼠标到邮箱输入框
    await page.hover('#email, [name="email"], [name="username"], #username');
    await randomDelay(500, 1000);
    
    // 输入用户名/邮箱
    const emailSelector = await page.$('#email') ? '#email' : 
                          (await page.$('[name="email"]') ? '[name="email"]' : 
                          (await page.$('[name="username"]') ? '[name="username"]' : '#username'));
    
    const email = process.env.USERNAME;
    for (const char of email) {
      await page.type(emailSelector, char);
      await randomDelay(100, 300);
    }
    
    await randomDelay(1000, 2000);
    
    // 输入密码
    await page.hover('#password, [name="password"]');
    await randomDelay(500, 1000);
    
    const passwordSelector = await page.$('#password') ? '#password' : '[name="password"]';
    const password = process.env.PASSWORD;
    for (const char of password) {
      await page.type(passwordSelector, char);
      await randomDelay(100, 300);
    }
    
    await randomDelay(2000, 3000);
    
    // 点击提交按钮
    try {
      await page.click('button[type="submit"], input[type="submit"], .login-button, #login-button', { delay: 200 });
      await randomDelay(2000, 4000);
    } catch (e) {
      console.log('提交按钮点击失败，尝试按回车键...');
      await page.keyboard.press('Enter');
      await randomDelay(2000, 4000);
    }
    
    // 等待页面导航
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
      console.log('页面导航超时，继续检查登录状态');
    }
    
    // 检查登录状态
    const currentUrlAfter = page.url();
    const titleAfter = await page.title();
    
    console.log('\n登录结果检查:');
    console.log(`当前URL: ${currentUrlAfter}`);
    console.log(`页面标题: ${titleAfter}`);
    
    if (currentUrlAfter.includes('/dashboard') || 
        currentUrlAfter.includes('/home') || 
        !titleAfter.includes('Login') && !titleAfter.includes('Sign') && 
        !currentUrlAfter.includes('/login') && !currentUrlAfter.includes('/signin')) {
      console.log('\n✅ 登录成功！');
    } else {
      throw new Error(`登录可能失败。URL: ${currentUrlAfter}, 标题: ${titleAfter}`);
    }
    
    console.log('\n脚本执行完成。');
    
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('\n❌ 登录失败：', error.message);
    console.error('截屏已保存为 login-failure.png');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
