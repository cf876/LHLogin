const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const randomDelay = (min = 1000, max = 3000) => {
  const safeMin = Math.max(min, 500);
  const safeMax = Math.max(safeMin, max);
  const delay = Math.floor(Math.random() * (safeMax - safeMin) + safeMin);
  return new Promise(resolve => setTimeout(resolve, delay));
};

const generateMousePath = (start, end, steps = 50) => {
  const path = [];
  const dx = (end.x - start.x) / steps;
  const dy = (end.y - start.y) / steps;
  
  for (let i = 0; i <= steps; i++) {
    const jitterX = Math.random() * 6 - 3;
    const jitterY = Math.random() * 6 - 3;
    
    path.push({
      x: start.x + dx * i + jitterX,
      y: start.y + dy * i + jitterY,
      delay: Math.floor(Math.random() * 10 + 5)
    });
  }
  return path;
};

const simulateHumanClick = async (page, element) => {
  const boundingBox = await element.boundingBox();
  if (!boundingBox) throw new Error('目标元素未找到');

  const endX = boundingBox.x + boundingBox.width / 2 + Math.random() * 10 - 5;
  const endY = boundingBox.y + boundingBox.height / 2 + Math.random() * 10 - 5;

  const viewport = page.viewport();
  const startX = Math.random() * viewport.width * 0.8;
  const startY = Math.random() * viewport.height * 0.8;

  const path = generateMousePath({ x: startX, y: startY }, { x: endX, y: endY });
  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    await randomDelay(point.delay, point.delay);
  }

  await page.mouse.down();
  await randomDelay(100, 200);
  await page.mouse.up();
};

async function sendTelegramMessage(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Telegram 通知失败:', error.message);
  }
}

async function login() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=zh-CN',
      '--disable-notifications',
      '--disable-extensions'
    ],
    defaultViewport: { width: 1920, height: 1080 },
    slowMo: 50,
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1'
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0');

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => Array.from({ length: Math.floor(Math.random() * 3 + 1) }) });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => Array.from({ length: Math.floor(Math.random() * 5 + 2) }) });
      window.chrome = {
        runtime: {},
        app: { isInstalled: false },
        webstore: { onInstallStageChanged: {}, onDownloadProgress: {} }
      };
      delete window.navigator.webdriver;
      delete document.documentElement.dataset.testid;
    });

    await page.goto(process.env.WEBSITE_URL, {
      waitUntil: ['domcontentloaded', 'networkidle2', 'load'],
      timeout: 20000
    });
    await randomDelay(2000, 4000);

    const username = process.env.USERNAME;
    const emailInput = await page.waitForSelector('#email', { visible: true, timeout: 15000 });
    await simulateHumanClick(page, emailInput);
    await randomDelay(300, 800);
    
    for (let i = 0; i < username.length; i++) {
      const char = username[i];
      if (Math.random() < 0.1) {
        await randomDelay(500, 1500);
      }
      await page.type('#email', char, { delay: Math.random() * 150 + 80 });
    }
    await randomDelay(1000, 2000);

    const password = process.env.PASSWORD;
    const pwdInput = await page.waitForSelector('#password', { visible: true, timeout: 15000 });
    await simulateHumanClick(page, pwdInput);
    await randomDelay(300, 800);
    
    for (let i = 0; i < password.length; i++) {
      const char = password[i];
      if (Math.random() < 0.08) {
        await randomDelay(400, 1200);
      }
      await page.type('#password', char, { delay: Math.random() * 180 + 100 });
    }
    await randomDelay(1500, 3000);

    console.log('请在浏览器中手动完成验证码（如果有），脚本将等待60秒...');
    await page.waitForSelector('.g-recaptcha', { visible: true, timeout: 60000 });
    await randomDelay(2000, 3000);

    const submitBtn = await page.waitForSelector('button[type="submit"]', { visible: true, timeout: 15000 });
    await simulateHumanClick(page, submitBtn);
    await randomDelay(1000, 2000);

    await page.waitForNavigation({
      waitUntil: ['domcontentloaded', 'networkidle2'],
      timeout: 25000
    });

    const currentUrl = page.url();
    const pageTitle = await page.title();
    const pageContent = await page.content();

    const isLoginSuccess = 
      !currentUrl.toLowerCase().includes('login') && 
      !currentUrl.toLowerCase().includes('signin') && 
      !pageTitle.toLowerCase().includes('登录') && 
      (pageContent.includes('欢迎') || pageContent.includes('Welcome') || pageContent.includes('退出') || pageContent.includes('Logout'));

    if (isLoginSuccess) {
      const message = `*✅ 登录成功！*\n` +
                     `📅 时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}\n` +
                     `🌐 页面: ${currentUrl}\n` +
                     `📌 标题: ${pageTitle}`;
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, message);
      console.log('登录成功！当前页面：', currentUrl);
    } else {
      throw new Error(`登录失败：URL=${currentUrl}, 标题=${pageTitle}, 未检测到登录成功标识`);
    }

    console.log('脚本执行完成，浏览器将在8秒后关闭...');
    await randomDelay(8000);

  } catch (error) {
    const timestamp = new Date().getTime();
    const screenshotPath = path.join(screenshotsDir, `login-failure-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, type: 'png', quality: 90 });
    
    const message = `*❌ 登录失败！*\n` +
                   `📅 时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}\n` +
                   `⚠️  错误: ${error.message}\n` +
                   `📸 截图: ${path.basename(screenshotPath)}`;
    await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, message);
    
    console.error('登录失败：', error.message);
    console.error(`截屏已保存为 ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('未处理的异常：', reason instanceof Error ? reason.message : reason);
  process.exit(1);
});

login();
