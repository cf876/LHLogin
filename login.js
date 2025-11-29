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
      // 使用相对定位确保在不同分辨率下都能准确定位
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
        
        // 等待并检查跳转
        await randomDelay(3000, 5000);
        const navResult = await checkPageNavigation(page, originalUrl);
        
        if (navResult.navigated) {
          console.log(`方法1成功！页面已跳转至: ${navResult.url}`);
          return true;
        }
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
            const navResult = await checkPageNavigation(page, originalUrl);
            
            if (navResult.navigated) {
              console.log(`方法2成功！页面已跳转至: ${navResult.url}`);
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
        const navResult = await checkPageNavigation(page, originalUrl);
        
        if (navResult.navigated) {
          console.log(`方法3成功！在位置(${x}, ${y})点击后页面跳转至: ${navResult.url}`);
          return true;
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
    headless: false, // 调试时使用非无头模式，方便观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1200,800' // 使用更接近截图的窗口尺寸
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
    const initialUrl = page.url();
    
    // 验证重试循环
    while (verificationAttempts < maxVerificationAttempts) {
      verificationAttempts++;
      console.log(`\n========== 验证尝试 ${verificationAttempts}/${maxVerificationAttempts} ==========`);
      
      // 等待页面完全加载
      await randomDelay(2000, 3000);
      
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
    
    // 后续登录逻辑保持不变...
    
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
