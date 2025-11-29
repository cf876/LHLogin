const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 精准定位验证复选框（基于当前页面）
async function clickVerifyCheckbox(page) {
  console.log('开始精准定位验证复选框...');
  
  // 1. 匹配页面上的验证区域容器
  const verifyContainer = await page.waitForSelector('div:has-text("Verify you are human by completing the action below.")', { timeout: 5000 });
  if (!verifyContainer) {
    console.log('未找到验证区域容器');
    return false;
  }

  // 2. 在容器内精准定位复选框（页面中“Verify you are human”旁边的小框）
  const checkboxSelector = 'input[type="checkbox"][name="cf-turnstile-response"]';
  try {
    // 先在容器内查找复选框
    const checkbox = await verifyContainer.$(checkboxSelector);
    if (checkbox) {
      // 获取复选框的精确位置
      const boundingBox = await checkbox.boundingBox();
      if (boundingBox) {
        console.log(`找到复选框，位置: (${boundingBox.x}, ${boundingBox.y})`);
        
        // 模拟真人操作流程：
        // 步骤1：鼠标移动到复选框上方（稍偏外）
        await page.mouse.move(boundingBox.x - 20, boundingBox.y - 10);
        await randomDelay(800, 1200); // 停留1秒左右
        
        // 步骤2：缓慢移动到复选框中心
        for (let i = 0; i < 5; i++) {
          await page.mouse.move(
            boundingBox.x - 20 + (i * 4), 
            boundingBox.y - 10 + (i * 2), 
            { steps: 2 } // 平滑移动
          );
          await randomDelay(100, 200);
        }
        
        // 步骤3：轻微晃动鼠标（模拟真人犹豫）
        await page.mouse.move(boundingBox.x + 5, boundingBox.y + 2);
        await randomDelay(300, 500);
        await page.mouse.move(boundingBox.x, boundingBox.y);
        await randomDelay(200, 300);
        
        // 步骤4：点击复选框（先按下，停留再松开）
        await page.mouse.down({ button: 'left' });
        await randomDelay(150, 250); // 按下后停留
        await page.mouse.up({ button: 'left' });
        console.log('已模拟真人点击验证复选框');
        
        // 等待验证状态变化
        await randomDelay(5000, 8000);
        return true;
      }
    }
  } catch (e) {
    console.log('复选框定位失败:', e.message);
  }

  // 备用：基于页面固定位置的精准点击（根据当前截图）
  console.log('尝试基于截图的固定位置精准点击...');
  try {
    // 截图中复选框的位置：页面左中区域，约 (270, 230)（视窗口大小）
    const targetX = 270;
    const targetY = 230;
    
    // 模拟真人移动路径
    await page.mouse.move(100, 100); // 先移到页面左上角
    await randomDelay(600, 900);
    await page.mouse.move(200, 200, { steps: 3 }); // 中间点
    await randomDelay(400, 600);
    await page.mouse.move(targetX, targetY, { steps: 5 }); // 平滑移到复选框
    await randomDelay(300, 500);
    
    // 模拟真人点击（带轻微偏移）
    await page.mouse.down({ button: 'left' });
    await randomDelay(100, 200);
    await page.mouse.move(targetX + 1, targetY + 1); // 点击时轻微移动
    await page.mouse.up({ button: 'left' });
    console.log(`已点击固定位置: (${targetX}, ${targetY})`);
    
    await randomDelay(5000, 8000);
    return true;
  } catch (e) {
    console.log('固定位置点击失败:', e.message);
    return false;
  }
}

async function login() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080' // 固定窗口大小确保坐标准确
    ]
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 }); // 与窗口大小一致
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
      
      // 执行精准点击验证
      const clickSuccess = await clickVerifyCheckbox(page);
      if (!clickSuccess) {
        console.log('本次验证点击未成功');
      }
      
      // 等待验证结果（延长时间）
      await randomDelay(10000, 15000);
      
      // 检查是否跳转（判断是否通过验证）
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`当前URL: ${currentUrl}`);
      console.log(`页面标题: ${pageTitle}`);
      
      // 判断条件：URL不再是验证页 + 标题不含"Just a moment"
      if (!currentUrl.includes('cdn-cgi/challenge') && !pageTitle.includes('Just a moment')) {
        console.log('验证成功！页面已跳转');
        break;
      }
      
      // 最后一次尝试失败则报错
      if (verificationAttempts >= maxVerificationAttempts) {
        await page.screenshot({ path: 'verification-failure.png', fullPage: true });
        throw new Error(`验证失败：3次尝试均未通过，已截图保存`);
      }
      
      // 刷新页面重试
      console.log('刷新页面重试验证...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
    
    // 后续登录逻辑（与之前一致，略）
    console.log('\n开始登录操作...');
    // （省略登录表单处理代码，保持原逻辑）
    
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
