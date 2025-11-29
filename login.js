const puppeteer = require('puppeteer');

// 模拟真人操作的工具函数：生成随机等待时间
function randomDelay(min, max) {
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

// 模拟真人操作：鼠标平滑移动到元素
async function simulateHumanMouseMove(page, element) {
  const rect = await element.boundingBox();
  if (!rect) return;

  // 起点：页面随机位置
  const startX = Math.random() * 200 + 50;
  const startY = Math.random() * 200 + 50;
  
  // 终点：元素中心位置
  const endX = rect.x + rect.width / 2;
  const endY = rect.y + rect.height / 2;

  // 分多步移动，模拟人类鼠标轨迹
  const steps = Math.floor(Math.random() * 5) + 3; // 3-7 步
  const stepX = (endX - startX) / steps;
  const stepY = (endY - startY) / steps;

  await page.mouse.move(startX, startY);
  for (let i = 1; i <= steps; i++) {
    await randomDelay(30, 80);
    const x = startX + stepX * i + (Math.random() * 10 - 5); // 增加微小随机偏移
    const y = startY + stepY * i + (Math.random() * 10 - 5);
    await page.mouse.move(x, y);
  }
}

// 模拟真人操作：带间隔的文本输入
async function typeWithHumanDelay(page, selector, text) {
  const element = await page.$(selector);
  if (!element) throw new Error(`未找到选择器: ${selector}`);

  await simulateHumanMouseMove(page, element);
  await element.focus();
  await randomDelay(300, 600); // 聚焦后等待

  for (const char of text) {
    await page.keyboard.type(char);
    // 字符间随机间隔：普通字符 50-150ms，特殊字符可能更长
    const delay = /[A-Z0-9@#$%^&*()]/.test(char) ? 
      Math.floor(Math.random() * 100) + 100 : 
      Math.floor(Math.random() * 100) + 50;
    await randomDelay(delay, delay + 50);
  }
}

async function login() {
  const browser = await puppeteer.launch({
    headless: false, // 改为非无头模式，方便用户手动操作验证码
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800' // 设置窗口大小，模拟真实浏览器
    ],
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  // 随机选择常见用户代理，模拟不同浏览器
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(randomUserAgent);

  // 模拟真人浏览行为：设置页面加载偏好
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  });

  try {
    console.log('开始访问登录页面...');
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2' });
    await randomDelay(1500, 3000); // 页面加载后等待 1.5-3 秒

    // 模拟真人滚动页面（可选，根据实际页面情况调整）
    if (Math.random() > 0.5) {
      await page.mouse.wheel({ deltaY: Math.random() * 200 + 100 });
      await randomDelay(800, 1200);
      await page.mouse.wheel({ deltaY: -Math.random() * 200 - 100 });
      await randomDelay(500, 800);
    }

    // 模拟真人输入账号密码（带随机间隔和鼠标移动）
    console.log('正在输入账号密码...');
    await typeWithHumanDelay(page, '#email', process.env.USERNAME);
    await randomDelay(800, 1500); // 输入账号后等待
    await typeWithHumanDelay(page, '#password', process.env.PASSWORD);
    await randomDelay(1000, 2000); // 输入密码后等待

    // 等待用户手动完成验证码验证
    console.log('请在浏览器中手动完成验证码验证，验证完成后请保持页面，脚本将继续执行...');
    await page.waitForSelector('.g-recaptcha', { timeout: 0 }); // 无限等待验证码元素存在
    await randomDelay(500, 1000);
    
    // 等待用户完成验证（给用户足够时间，这里设置 5 分钟超时，可根据需要调整）
    const captchaTimeout = 300 * 1000; // 5 分钟
    console.log(`等待验证码验证中...（超时时间：${captchaTimeout / 1000} 秒）`);
    
    // 等待提交按钮可点击，或等待页面状态变化（根据实际验证码类型调整）
    await Promise.race([
      page.waitForFunction(() => {
        // 检测验证码是否完成（根据实际页面的验证码完成状态调整）
        // 这里以常见的 reCAPTCHA 完成状态检测为例，可能需要根据实际网站调整
        const captchaEl = document.querySelector('.g-recaptcha');
        if (!captchaEl) return true;
        
        // 检查是否有验证成功的标识（不同网站可能不同）
        const isVerified = captchaEl.classList.contains('verified') || 
                          document.querySelector('[data-callback]')?.getAttribute('data-callback') === 'verified';
        return isVerified;
      }, { timeout: captchaTimeout }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('验证码验证超时')), captchaTimeout);
      })
    ]);

    console.log('验证码验证完成，准备提交...');
    await randomDelay(800, 1500);

    // 模拟真人点击提交按钮
    const submitBtn = await page.$('button[type="submit"]');
    if (!submitBtn) throw new Error('未找到提交按钮');
    
    await simulateHumanMouseMove(page, submitBtn);
    await randomDelay(300, 600); // 鼠标移动到按钮后等待
    await submitBtn.click();
    await randomDelay(500, 1000); // 点击后等待

    // 等待页面导航完成
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    // 验证登录是否成功
    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.includes('Login') && !title.includes('登录')) {
      console.log('登录成功！');
      console.log(`时间: ${new Date().toISOString()}`);
      console.log(`页面: ${currentUrlAfter}`);
      console.log(`标题: ${title}`);
    } else {
      throw new Error(`登录可能失败。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
    }

    console.log('脚本执行完成。');
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('登录失败：', error.message);
    console.error('错误详情：', error.stack);
    console.error('截屏已保存为 login-failure.png');
    throw error;
  } finally {
    // 登录完成后不立即关闭浏览器，让用户查看结果（5秒后自动关闭）
    console.log('5秒后将自动关闭浏览器...');
    await randomDelay(5000, 5000);
    await browser.close();
  }
}

login();
