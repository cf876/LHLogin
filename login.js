const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 随机延迟函数（模拟真人操作间隔）
const randomDelay = (min = 800, max = 2000) => {
  const safeMin = Math.max(min, 300);
  const safeMax = Math.max(safeMin, max);
  const delay = Math.floor(Math.random() * (safeMax - safeMin) + safeMin);
  return new Promise(resolve => setTimeout(resolve, delay));
};

// 生成带抖动的鼠标轨迹
const generateMousePath = (start, end, steps = 40) => {
  const path = [];
  const dx = (end.x - start.x) / steps;
  const dy = (end.y - start.y) / steps;
  
  for (let i = 0; i <= steps; i++) {
    const jitterX = Math.random() * 5 - 2.5;
    const jitterY = Math.random() * 5 - 2.5;
    path.push({
      x: start.x + dx * i + jitterX,
      y: start.y + dy * i + jitterY,
      delay: Math.floor(Math.random() * 8 + 4)
    });
  }
  return path;
};

// 模拟真人鼠标移动+点击
const simulateHumanClick = async (page, element) => {
  const boundingBox = await element.boundingBox();
  if (!boundingBox) throw new Error('Target element not found');

  const endX = boundingBox.x + boundingBox.width / 2 + Math.random() * 8 - 4;
  const endY = boundingBox.y + boundingBox.height / 2 + Math.random() * 8 - 4;

  const viewport = page.viewport();
  const startX = Math.random() * viewport.width * 0.7;
  const startY = Math.random() * viewport.height * 0.7;

  const path = generateMousePath({ x: startX, y: startY }, { x: endX, y: endY });
  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    await randomDelay(point.delay, point.delay);
  }

  await page.mouse.down();
  await randomDelay(80, 150);
  await page.mouse.up();
};

async function login() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=en-US'
    ],
    defaultViewport: { width: 1920, height: 1080 },
    slowMo: 40,
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  // 浏览器指纹伪装
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'DNT': '1'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'zh-CN'] });
    window.chrome = { runtime: {}, app: { isInstalled: false } };
    delete window.navigator.webdriver;
  });

  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await randomDelay(1500, 2500);

    // 模拟真人输入用户名
    const username = process.env.USERNAME;
    const emailInput = await page.waitForSelector('#email', { visible: true, timeout: 10000 });
    await simulateHumanClick(page, emailInput);
    await randomDelay(300, 600);
    
    for (const char of username.split('')) {
      if (Math.random() < 0.09) await randomDelay(400, 900);
      await page.type('#email', char, { delay: Math.random() * 120 + 60 });
    }
    await randomDelay(900, 1500);

    // 模拟真人输入密码
    const password = process.env.PASSWORD;
    const pwdInput = await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await simulateHumanClick(page, pwdInput);
    await randomDelay(300, 600);
    
    for (const char of password.split('')) {
      if (Math.random() < 0.07) await randomDelay(300, 800);
      await page.type('#password', char, { delay: Math.random() * 140 + 70 });
    }
    await randomDelay(1200, 2000);

    // 替换验证码自动识别为固定等待（保留原选择器检测）
    await page.waitForSelector('.g-recaptcha', { timeout: 10000 });
    console.log('Waiting for captcha completion (simulated wait)...');
    await randomDelay(5000, 8000); // 模拟验证码处理等待5-8秒

    // 模拟真人点击提交按钮
    const submitBtn = await page.waitForSelector('button[type="submit"]', { visible: true, timeout: 10000 });
    await simulateHumanClick(page, submitBtn);
    await randomDelay(800, 1200);

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.includes('Login')) {
      console.log('Login successful! Current URL:', currentUrlAfter);
    } else {
      throw new Error(`Login may have failed. Current URL: ${currentUrlAfter}, Title: ${title}`);
    }

    console.log('Script execution completed.');
  } catch (error) {
    // 确保截图目录存在（兼容原功能）
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    
    const screenshotPath = path.join(screenshotsDir, 'login-failure.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error('Login failed:', error.message);
    console.error(`Screenshot saved as ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason);
  process.exit(1);
});

login();
