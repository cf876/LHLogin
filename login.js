const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 检查页面是否仍为验证页面
async function isVerificationPage(page) {
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  // 验证页面特征：URL包含验证路径或标题符合验证页面特征
  return currentUrl.includes('cdn-cgi/challenge') || 
         pageTitle.includes('Just a moment') || 
         pageTitle.includes('Verify you are human') ||
         (await page.$eval('body', body => body.innerText.includes('Verify you are human'))).catch(() => false);
}

// 精准定位验证复选框并点击
async function clickVerifyCheckbox(page) {
  const originalUrl = page.url();
  console.log('开始验证操作，原始URL:', originalUrl);
  
  // 获取视口信息用于计算相对位置
  const viewport = page.viewport();
  if (!viewport) throw new Error('无法获取视口信息');
  
  // 方法1：基于截图分析的精准定位（针对提供的截图优化）
  try {
    console.log('方法1：基于截图分析的精准定位');
    
    // 等待Cloudflare验证容器加载
    const cloudflareContainer = await page.waitForSelector('body > div, body > main', { 
      timeout: 5000 
    });
    
    if (cloudflareContainer) {
      // 从截图分析，复选框位于页面中上部，左侧位置
      const containerBounds = await cloudflareContainer.boundingBox();
      if (containerBounds) {
        // 计算复选框相对位置（基于截图中复选框位置）
        const checkboxX = containerBounds.x + 40;  // 左偏移量
        const checkboxY = containerBounds.y + 120; // 上偏移量
        
        console.log(`计算复选框位置: (${checkboxX}, ${checkboxY})`);
        
        // 模拟自然鼠标移动
        await page.mouse.move(checkboxX - 50, checkboxY - 30, { steps: 5 });
        await randomDelay(300, 600);
        await page.mouse.move(checkboxX, checkboxY, { steps: 3 });
        await randomDelay(200, 400);
        
        // 精准点击复选框
        await page.mouse.down({ button: 'left' });
        await randomDelay(100, 200);
        await page.mouse.up({ button: 'left' });
        console.log('已点击复选框，等待响应...');
        
        // 等待验证结果
        await randomDelay(3000, 5000);
        return true;
      }
    }
  } catch (e) {
    console.log('方法1失败:', e.message);
  }
  
  // 方法2：针对Cloudflare验证框的专用选择器
  try {
    console.log('方法2：Cloudflare专用选择器定位');
    const cfSelectors = [
      'input[type="checkbox"].cf-turnstile-checkbox',
      'div.cf-turnstile > div > input[type="checkbox"]',
      'div:has(> img[alt="Cloudflare"]) + input[type="checkbox"]',
      'input[type="checkbox"][name="cf-turnstile-response"]'
    ];
    
    for (const selector of cfSelectors) {
      try {
        console.log(`尝试选择器: ${selector}`);
        const checkbox = await page.waitForSelector(selector, { timeout: 2000 });
        if (checkbox) {
          const box = await checkbox.boundingBox();
          if (box) {
            console.log(`找到复选框位置: (${box.x}, ${box.y})`);
            
            // 模拟人类点击行为
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await randomDelay(300, 500);
            await page.click(selector, { delay: 150 });
            
            await randomDelay(3000, 4000);
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('方法2失败:', e.message);
  }
  
  // 方法3：密集点击复选框可能出现的区域（基于截图位置）
  try {
    console.log('方法3：复选框区域密集点击');
    
    // 基于截图分析的复选框可能位置范围
    const startX = 30;
    const endX = 100;
    const startY = 200;
    const endY = 280;
    const step = 10;
    
    // 先移动到区域附近
    await page.mouse.move(startX - 20, startY - 20);
    await randomDelay(500, 800);
    
    // 在可能的区域内进行网格点击
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        console.log(`密集点击位置: (${x}, ${y})`);
        await page.mouse.move(x, y, { steps: 2 });
        await randomDelay(100, 200);
        await page.mouse.click(x, y, { button: 'left' });
        
        // 检查是否跳转
        await randomDelay(1500, 2000);
        const stillVerifying = await isVerificationPage(page);
        if (!stillVerifying) {
          return true; // 已跳出验证页面，结束点击
        }
      }
    }
  } catch (e) {
    console.log('方法3失败:', e.message);
  }
  
  return false;
}

async function login() {
  const browser = await puppeteer.launch({
    headless: "new",  // 无头模式，兼容服务器环境
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1200,800'
    ]
  });
  const page = await browser.newPage();
  
  // 设置与截图匹配的视口尺寸
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
      // 验证重试循环：仅当仍在验证页面时才继续尝试
      while (verificationAttempts < maxVerificationAttempts && isVerifying) {
        verificationAttempts++;
        console.log(`\n========== 验证尝试 ${verificationAttempts}/${maxVerificationAttempts} ==========`);
        
        // 执行验证点击
        await clickVerifyCheckbox(page);
        
        // 检查是否仍在验证页面
        isVerifying = await isVerificationPage(page);
        
        if (!isVerifying) {
          console.log(`\n验证尝试 ${verificationAttempts} 成功！已跳出验证页面`);
          break;
        }
        
        console.log(`验证尝试 ${verificationAttempts} 后仍在验证页面`);
        
        // 最后一次尝试失败则报错
        if (verificationAttempts >= maxVerificationAttempts) {
          await page.screenshot({ path: 'verification-failure.png', fullPage: true });
          throw new Error(`验证失败：${maxVerificationAttempts}次尝试均未通过Cloudflare验证`);
        }
        
        // 刷新页面进行下一次尝试
        console.log('刷新页面准备下一次验证尝试...');
        await page.reload({ waitUntil: 'networkidle2' });
        await randomDelay(2000, 3000); // 等待页面重新加载
      }
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
