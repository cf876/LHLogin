const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 精准定位验证复选框（基于当前页面）
async function clickVerifyCheckbox(page) {
  console.log('开始精准定位验证复选框...');
  
  // 方法1：尝试匹配页面上的验证区域容器
  try {
    const verifyContainer = await page.waitForSelector('div:has-text("Verify you are human")', { timeout: 3000 });
    if (verifyContainer) {
      console.log('找到验证区域容器');
      // 在容器内查找复选框
      const checkboxSelector = 'input[type="checkbox"][name="cf-turnstile-response"], input[type="checkbox"], div[role="checkbox"]';
      const checkbox = await verifyContainer.$(checkboxSelector);
      if (checkbox) {
        const boundingBox = await checkbox.boundingBox();
        if (boundingBox) {
          console.log(`找到复选框，位置: (${boundingBox.x}, ${boundingBox.y})`);
          
          // 模拟真人操作流程
          await page.mouse.move(boundingBox.x - 20, boundingBox.y - 10);
          await randomDelay(500, 800);
          await page.mouse.move(boundingBox.x, boundingBox.y, { steps: 3 });
          await randomDelay(200, 300);
          
          await page.mouse.down({ button: 'left' });
          await randomDelay(150, 250);
          await page.mouse.up({ button: 'left' });
          console.log('已模拟真人点击验证复选框');
          
          await randomDelay(5000, 8000);
          return true;
        }
      }
    }
  } catch (e) {
    console.log('方法1失败:', e.message);
  }
  
  // 方法2：直接查找所有可能的复选框选择器
  try {
    const selectors = [
      'input[type="checkbox"][name="cf-turnstile-response"]',
      '#challenge-stage input[type="checkbox"]',
      '.cf-turnstile input[type="checkbox"]',
      'input[type="checkbox"]',
      'div[role="checkbox"]'
    ];
    
    for (const selector of selectors) {
      try {
        const checkbox = await page.waitForSelector(selector, { timeout: 2000 });
        if (checkbox) {
          console.log(`使用选择器找到复选框: ${selector}`);
          await page.hover(selector);
          await randomDelay(300, 500);
          await page.click(selector, { delay: 200 });
          console.log('已点击复选框');
          await randomDelay(5000, 8000);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('方法2失败:', e.message);
  }
  
  // 方法3：基于常见位置的精准点击（根据截图）
  try {
    console.log('使用固定位置点击...');
    // 常见的Cloudflare验证复选框位置
    const positions = [
      { x: 50, y: 350 },  // 左上区域
      { x: 270, y: 230 }, // 中间区域
      { x: 80, y: 320 },  // 左上偏下
      { x: 120, y: 400 }, // 中上区域
      { x: 60, y: 300 }   // 顶部区域
    ];
    
    for (const pos of positions) {
      // 模拟真人移动路径
      await page.mouse.move(pos.x - 30, pos.y - 20);
      await randomDelay(200, 300);
      await page.mouse.move(pos.x, pos.y, { steps: 2 });
      await randomDelay(100, 200);
      
      // 点击
      await page.mouse.down({ button: 'left' });
      await randomDelay(100, 200);
      await page.mouse.up({ button: 'left' });
      console.log(`已点击位置: (${pos.x}, ${pos.y})`);
      
      // 检查是否有反应
      await randomDelay(2000, 3000);
      
      // 检查页面是否变化
      const title = await page.title();
      if (!title.includes('Just a moment')) {
        return true;
      }
    }
  } catch (e) {
    console.log('方法3失败:', e.message);
  }
  
  // 方法4：密集区域点击
  try {
    console.log('执行密集区域点击...');
    // 在验证框可能出现的区域进行网格点击
    for (let x = 40; x <= 100; x += 20) {
      for (let y = 300; y <= 400; y += 20) {
        await page.mouse.move(x, y);
        await randomDelay(100, 200);
        await page.mouse.click(x, y);
        await randomDelay(500, 1000);
        
        // 检查页面状态
        const url = page.url();
        if (!url.includes('challenge')) {
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
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
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
      
      // 执行验证（会尝试所有方法）
      await clickVerifyCheckbox(page);
      
      // 等待验证结果
      await randomDelay(8000, 12000);
      
      // 检查是否跳转
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`当前URL: ${currentUrl}`);
      console.log(`页面标题: ${pageTitle}`);
      
      // 判断是否通过验证
      if (!currentUrl.includes('cdn-cgi/challenge') && 
          !pageTitle.includes('Just a moment') && 
          !pageTitle.includes('Challenge')) {
        console.log('验证成功！页面已跳转');
        break;
      }
      
      // 最后一次尝试失败则报错
      if (verificationAttempts >= maxVerificationAttempts) {
        await page.screenshot({ path: 'verification-failure.png', fullPage: true });
        throw new Error(`验证失败：3次尝试均未通过Cloudflare验证`);
      }
      
      // 刷新页面重试
      console.log('刷新页面重试验证...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
    
    // 验证通过后，继续登录流程
    console.log('\n开始登录操作...');
    
    // 等待登录表单加载
    try {
      await page.waitForSelector('#email, [name="email"], #password, [name="password"]', { timeout: 10000 });
    } catch (e) {
      console.log('未找到登录表单元素，可能已登录或页面结构变化');
      // 检查当前状态
      const finalUrl = page.url();
      const finalTitle = await page.title();
      console.log(`最终URL: ${finalUrl}`);
      console.log(`最终标题: ${finalTitle}`);
      
      if (!finalTitle.includes('Login') && !finalTitle.includes('Sign') && !finalUrl.includes('/login')) {
        console.log('✅ 登录成功！');
        await browser.close();
        return;
      } else {
        throw new Error('无法找到登录表单，登录失败');
      }
    }
    
    // 输入账号密码（保留原有逻辑）
    try {
      // 模拟真人移动鼠标到邮箱输入框
      await page.hover('#email, [name="email"]');
      await randomDelay(500, 1000);
      
      const emailSelector = (await page.$('#email')) ? '#email' : '[name="email"]';
      const email = process.env.USERNAME;
      for (const char of email) {
        await page.type(emailSelector, char);
        await randomDelay(100, 300);
      }
      
      await randomDelay(1000, 2000);
      
      await page.hover('#password, [name="password"]');
      await randomDelay(500, 1000);
      
      const passwordSelector = (await page.$('#password')) ? '#password' : '[name="password"]';
      const password = process.env.PASSWORD;
      for (const char of password) {
        await page.type(passwordSelector, char);
        await randomDelay(100, 300);
      }
      
      await randomDelay(2000, 3000);
      
      // 点击提交按钮
      await page.click('button[type="submit"], input[type="submit"]', { delay: 200 });
      await randomDelay(3000, 5000);
      
      // 检查登录结果
      const currentUrlAfter = page.url();
      const titleAfter = await page.title();
      
      console.log('\n登录结果:');
      console.log(`URL: ${currentUrlAfter}`);
      console.log(`标题: ${titleAfter}`);
      
      if (!titleAfter.includes('Login') && !titleAfter.includes('Sign') && !currentUrlAfter.includes('/login')) {
        console.log('✅ 登录成功！');
      } else {
        throw new Error('登录可能失败');
      }
      
    } catch (e) {
      console.log('登录表单操作失败:', e.message);
      // 最终状态检查
      const finalUrl = page.url();
      const finalTitle = await page.title();
      
      if (!finalTitle.includes('Login') && !finalUrl.includes('/login')) {
        console.log('✅ 看起来已登录成功！');
      } else {
        throw e;
      }
    }
    
    console.log('\n脚本执行完成。');
    
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('\n❌ 流程失败：', error.message);
    console.error('截屏已保存');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
