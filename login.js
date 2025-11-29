const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 检查页面是否已跳转（验证是否成功）
async function checkPageNavigation(page, originalUrl) {
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  // 判断条件：URL变化 或 标题不再是验证页面
  const isNavigated = currentUrl !== originalUrl && 
                     !pageTitle.includes('Just a moment') && 
                     !pageTitle.includes('Challenge') &&
                     !currentUrl.includes('cdn-cgi/challenge');
  
  return {
    navigated: isNavigated,
    url: currentUrl,
    title: pageTitle
  };
}

// 精准定位验证复选框并验证跳转
async function clickVerifyCheckbox(page) {
  const originalUrl = page.url();
  console.log('开始验证操作，原始URL:', originalUrl);
  
  // 方法1：尝试匹配页面上的验证区域容器
  try {
    const verifyContainer = await page.waitForSelector('div:has-text("Verify you are human")', { timeout: 3000 });
    if (verifyContainer) {
      console.log('方法1：找到验证区域容器');
      const checkboxSelector = 'input[type="checkbox"][name="cf-turnstile-response"], input[type="checkbox"], div[role="checkbox"]';
      const checkbox = await verifyContainer.$(checkboxSelector);
      
      if (checkbox) {
        const boundingBox = await checkbox.boundingBox();
        if (boundingBox) {
          console.log(`点击复选框位置: (${boundingBox.x}, ${boundingBox.y})`);
          
          // 模拟真人操作
          await page.mouse.move(boundingBox.x - 20, boundingBox.y - 10);
          await randomDelay(500, 800);
          await page.mouse.move(boundingBox.x, boundingBox.y, { steps: 3 });
          await randomDelay(200, 300);
          
          await page.mouse.down({ button: 'left' });
          await randomDelay(150, 250);
          await page.mouse.up({ button: 'left' });
          console.log('已点击复选框，等待响应...');
          
          // 等待并检查跳转
          await randomDelay(3000, 5000);
          const navResult = await checkPageNavigation(page, originalUrl);
          
          if (navResult.navigated) {
            console.log(`方法1成功！页面已跳转至: ${navResult.url}`);
            return true;
          } else {
            console.log('方法1点击后页面未跳转');
          }
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
          console.log(`方法2：使用选择器 ${selector}`);
          await page.hover(selector);
          await randomDelay(300, 500);
          await page.click(selector, { delay: 200 });
          console.log('已点击，等待响应...');
          
          // 等待并检查跳转
          await randomDelay(3000, 4000);
          const navResult = await checkPageNavigation(page, originalUrl);
          
          if (navResult.navigated) {
            console.log(`方法2成功！页面已跳转至: ${navResult.url}`);
            return true;
          } else {
            console.log(`选择器 ${selector} 点击后页面未跳转`);
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('方法2失败:', e.message);
  }
  
  // 方法3：基于常见位置的精准点击
  try {
    console.log('方法3：尝试固定位置点击');
    const positions = [
      { x: 50, y: 350 },  // 左上区域
      { x: 270, y: 230 }, // 中间区域
      { x: 80, y: 320 },  // 左上偏下
      { x: 120, y: 400 }, // 中上区域
      { x: 60, y: 300 }   // 顶部区域
    ];
    
    for (const pos of positions) {
      console.log(`点击位置: (${pos.x}, ${pos.y})`);
      // 模拟真人移动路径
      await page.mouse.move(pos.x - 30, pos.y - 20);
      await randomDelay(200, 300);
      await page.mouse.move(pos.x, pos.y, { steps: 2 });
      await randomDelay(100, 200);
      
      // 点击
      await page.mouse.down({ button: 'left' });
      await randomDelay(100, 200);
      await page.mouse.up({ button: 'left' });
      
      // 立即检查跳转
      await randomDelay(2000, 3000);
      const navResult = await checkPageNavigation(page, originalUrl);
      
      if (navResult.navigated) {
        console.log(`方法3成功！页面已跳转至: ${navResult.url}`);
        return true;
      } else {
        console.log(`位置 (${pos.x}, ${pos.y}) 点击后页面未跳转`);
      }
    }
  } catch (e) {
    console.log('方法3失败:', e.message);
  }
  
  // 方法4：密集区域点击
  try {
    console.log('方法4：执行密集区域点击');
    // 在验证框可能出现的区域进行网格点击
    for (let x = 40; x <= 100; x += 15) {
      for (let y = 300; y <= 400; y += 15) {
        console.log(`密集点击: (${x}, ${y})`);
        await page.mouse.move(x, y);
        await randomDelay(100, 200);
        await page.mouse.click(x, y);
        
        // 每次点击后立即检查跳转
        await randomDelay(1500, 2000);
        const navResult = await checkPageNavigation(page, originalUrl);
        
        if (navResult.navigated) {
          console.log(`方法4成功！在位置(${x}, ${y})点击后页面跳转至: ${navResult.url}`);
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
    const initialUrl = page.url();
    
    // 验证重试循环
    while (verificationAttempts < maxVerificationAttempts) {
      verificationAttempts++;
      console.log(`\n========== 验证尝试 ${verificationAttempts}/${maxVerificationAttempts} ==========`);
      
      await randomDelay(3000, 5000);
      
      // 执行验证并检查跳转
      const verificationSuccess = await clickVerifyCheckbox(page);
      
      // 最终检查跳转状态
      const navResult = await checkPageNavigation(page, initialUrl);
      
      if (verificationSuccess || navResult.navigated) {
        console.log(`\n验证成功！页面已跳转至: ${navResult.url}`);
        break;
      }
      
      console.log(`验证尝试 ${verificationAttempts} 未成功，当前URL: ${navResult.url}, 标题: ${navResult.title}`);
      
      // 最后一次尝试失败则报错
      if (verificationAttempts >= maxVerificationAttempts) {
        await page.screenshot({ path: 'verification-failure.png', fullPage: true });
        throw new Error(`验证失败：3次尝试均未通过Cloudflare验证，最终URL: ${navResult.url}`);
      }
      
      // 刷新页面重试
      console.log('刷新页面重试验证...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
    
    // 验证通过后，继续登录流程
    console.log('\n========== 开始登录操作 ==========');
    
    // 等待登录表单加载
    try {
      await page.waitForSelector('#email, [name="email"], #password, [name="password"]', { timeout: 10000 });
    } catch (e) {
      console.log('未找到登录表单元素，检查是否已登录...');
      // 检查当前状态
      const finalUrl = page.url();
      const finalTitle = await page.title();
      console.log(`当前URL: ${finalUrl}`);
      console.log(`当前标题: ${finalTitle}`);
      
      if (!finalTitle.includes('Login') && !finalTitle.includes('Sign') && !finalUrl.includes('/login')) {
        console.log('✅ 看起来已登录成功！');
        await browser.close();
        return;
      } else {
        throw new Error('无法找到登录表单，登录失败');
      }
    }
    
    // 输入账号密码
    try {
      // 模拟真人移动鼠标到邮箱输入框
      await page.hover('#email, [name="email"]');
      await randomDelay(500, 1000);
      
      const emailSelector = (await page.$('#email')) ? '#email' : '[name="email"]';
      const email = process.env.USERNAME;
      console.log(`输入邮箱/用户名到 ${emailSelector}`);
      for (const char of email) {
        await page.type(emailSelector, char);
        await randomDelay(100, 300);
      }
      
      await randomDelay(1000, 2000);
      
      await page.hover('#password, [name="password"]');
      await randomDelay(500, 1000);
      
      const passwordSelector = (await page.$('#password')) ? '#password' : '[name="password"]';
      console.log(`输入密码到 ${passwordSelector}`);
      const password = process.env.PASSWORD;
      for (const char of password) {
        await page.type(passwordSelector, char);
        await randomDelay(100, 300);
      }
      
      await randomDelay(2000, 3000);
      
      // 点击提交按钮
      console.log('点击提交按钮');
      await page.click('button[type="submit"], input[type="submit"]', { delay: 200 });
      
      // 等待并检查跳转
      await randomDelay(3000, 5000);
      const afterLoginUrl = page.url();
      const afterLoginTitle = await page.title();
      
      console.log('\n========== 登录结果 ==========');
      console.log(`登录后URL: ${afterLoginUrl}`);
      console.log(`登录后标题: ${afterLoginTitle}`);
      
      if (afterLoginUrl !== page.url() || !afterLoginTitle.includes('Login') && !afterLoginUrl.includes('/login')) {
        console.log('✅ 登录成功！页面已跳转');
      } else {
        throw new Error('登录后页面未跳转，可能登录失败');
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
    
    console.log('\n✅ 脚本执行完成，登录成功！');
    
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('\n❌ 流程失败：', error.message);
    console.error('截屏已保存为 login-failure.png');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
