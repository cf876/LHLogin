const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
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
      '--window-size=1920,1080' // 设置窗口大小确保元素可见
    ]
  });
  const page = await browser.newPage();
  
  // 设置视口大小
  await page.setViewport({ width: 1920, height: 1080 });

  // 模拟真人的用户行为
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 监听请求和响应，帮助调试
  page.on('console', msg => console.log('页面日志:', msg.text()));
  
  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 等待Cloudflare验证页面完全加载
    await randomDelay(5000, 8000);
    
    // 方案1：处理iframe中的验证
    console.log('尝试通过iframe定位验证元素...');
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame.url().includes('turnstile') || frame.url().includes('captcha')) {
          console.log('找到验证iframe，尝试点击...');
          await frame.click('input[type="checkbox"]', { delay: 300 });
          await randomDelay(3000, 5000);
          break;
        }
      }
    } catch (e) {
      console.log('iframe方法失败:', e.message);
    }
    
    // 方案2：使用多种选择器尝试点击
    console.log('尝试多种选择器定位验证元素...');
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
    
    let clicked = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.hover(selector);
        await randomDelay(300, 500);
        await page.click(selector, { delay: 200, clickCount: 1 });
        console.log(`成功使用选择器点击: ${selector}`);
        clicked = true;
        await randomDelay(3000, 5000);
        break;
      } catch (e) {
        continue;
      }
    }
    
    // 方案3：基于页面结构的相对位置点击
    if (!clicked) {
      console.log('尝试基于页面结构的点击...');
      // 找到Cloudflare验证容器
      try {
        const challengeContainer = await page.waitForSelector('div[id*="challenge"]', { timeout: 3000 });
        if (challengeContainer) {
          const boundingBox = await challengeContainer.boundingBox();
          if (boundingBox) {
            // 点击容器内的左上角区域（通常是复选框位置）
            const clickX = boundingBox.x + 30;
            const clickY = boundingBox.y + 30;
            await page.mouse.move(clickX, clickY);
            await randomDelay(300, 500);
            await page.mouse.click(clickX, clickY, { delay: 200 });
            console.log(`在验证容器内点击: (${clickX}, ${clickY})`);
            clicked = true;
            await randomDelay(3000, 5000);
          }
        }
      } catch (e) {
        console.log('容器点击失败:', e.message);
      }
    }
    
    // 方案4：全屏扫描点击（最后尝试）
    if (!clicked) {
      console.log('尝试常见验证位置点击...');
      // Cloudflare验证通常出现在的几个位置
      const commonPositions = [
        { x: 80, y: 350 },  // 左上区域
        { x: 120, y: 400 }, // 中上区域  
        { x: 60, y: 320 },  // 左上偏下
        { x: 70, y: 380 },  // 左中区域
        { x: 50, y: 300 }   // 顶部区域
      ];
      
      for (const pos of commonPositions) {
        try {
          await page.mouse.move(pos.x, pos.y);
          await randomDelay(200, 300);
          await page.mouse.click(pos.x, pos.y, { delay: 100 });
          console.log(`尝试点击位置: (${pos.x}, ${pos.y})`);
          await randomDelay(2000, 3000);
          
          // 检查页面是否跳转
          const currentUrl = page.url();
          if (currentUrl !== process.env.WEBSITE_URL) {
            console.log('页面已跳转，验证可能成功');
            clicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // 等待验证完成和页面跳转
    await randomDelay(5000, 10000);
    
    // 检查是否通过验证
    const currentUrlAfterVerify = page.url();
    console.log('验证后的URL:', currentUrlAfterVerify);
    
    // 模拟真人阅读页面的时间
    await randomDelay(2000, 4000);

    // 模拟真人移动鼠标到邮箱输入框
    try {
      await page.hover('#email');
      await randomDelay(500, 1000);
      
      // 逐个字符输入，模拟真人打字
      const email = process.env.USERNAME;
      for (const char of email) {
        await page.type('#email', char);
        await randomDelay(100, 300); // 每个字符之间的延迟
      }
    } catch (e) {
      console.log('邮箱输入失败，可能页面还在验证中:', e.message);
    }
    
    await randomDelay(1000, 2000);
    
    // 移动到密码框
    try {
      await page.hover('#password');
      await randomDelay(500, 1000);
      
      // 逐个字符输入密码
      const password = process.env.PASSWORD;
      for (const char of password) {
        await page.type('#password', char);
        await randomDelay(100, 300);
      }
    } catch (e) {
      console.log('密码输入失败:', e.message);
    }
    
    await randomDelay(2000, 3000);

    // 尝试点击提交按钮
    try {
      await page.click('button[type="submit"]', { delay: 100 });
      await randomDelay(2000, 4000);
    } catch (e) {
      console.log('提交按钮点击失败或需要验证码验证:', e.message);
    }

    // 等待页面导航
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
      console.log('页面导航超时，继续检查登录状态:', e.message);
    }

    // 检查登录状态
    const currentUrlAfter = page.url();
    const title = await page.title();
    console.log('最终页面URL:', currentUrlAfter);
    console.log('最终页面标题:', title);
    
    if (currentUrlAfter.includes('/') && !title.includes('Login') && !title.includes('Sign') && !title.includes('Verify')) {
      console.log('登录成功！当前页面：', currentUrlAfter);
    } else {
      console.log(`登录流程完成。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
    }

    console.log('脚本执行完成。');
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('登录失败：', error.message);
    console.error('截屏已保存为 login-failure.png');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
