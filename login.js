const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

// 检查并安装 XVFB（仅 Linux 环境）
function ensureXvfb() {
  if (process.platform !== 'linux') return;
  
  try {
    // 检查 XVFB 是否安装
    execSync('which xvfb-run', { stdio: 'ignore' });
    console.log('XVFB 已安装，将使用虚拟桌面启动浏览器');
  } catch (error) {
    console.log('未找到 XVFB，正在尝试安装...');
    try {
      // 尝试自动安装 XVFB（适用于 Debian/Ubuntu 系统）
      execSync('sudo apt-get update && sudo apt-get install -y xvfb', { stdio: 'inherit' });
      console.log('XVFB 安装成功');
    } catch (installError) {
      console.error('XVFB 安装失败，请手动安装后再运行脚本');
      console.error('Debian/Ubuntu: sudo apt-get install xvfb');
      console.error('CentOS/RHEL: sudo yum install xorg-x11-server-Xvfb');
      process.exit(1);
    }
  }
}

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
  // 确保 XVFB 已安装（仅 Linux）
  ensureXvfb();

  // 配置浏览器启动参数（兼容无图形界面环境）
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,800',
    '--enable-logging',
    '--v=1',
    // 允许远程调试（可选，方便调试）
    '--remote-debugging-port=9222',
    '--remote-debugging-address=0.0.0.0'
  ];

  // 如果是 Linux 环境，通过 XVFB 启动浏览器
  const browser = process.platform === 'linux' 
    ? await puppeteer.launch({
        headless: false, // 非无头模式，配合 XVFB 虚拟桌面
        args: browserArgs,
        executablePath: '/usr/bin/google-chrome', // 指定 Chrome 路径（避免找不到浏览器）
        defaultViewport: { width: 1280, height: 800 }
      })
    : await puppeteer.launch({
        headless: false, // 非 Linux 环境直接启动带界面浏览器
        args: browserArgs.filter(arg => !arg.startsWith('--remote-debugging')), // 移除远程调试参数
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
    console.log('========================================');
    console.log('请手动完成验证码验证！');
    console.log(`提示：如果是远程服务器，可通过远程调试端口 9222 连接浏览器`);
    console.log(`验证完成后，脚本将自动继续执行...`);
    console.log('========================================');
    
    await page.waitForSelector('.g-recaptcha', { timeout: 0 }); // 无限等待验证码元素存在
    await randomDelay(500, 1000);
    
    // 等待用户完成验证（给用户足够时间，这里设置 10 分钟超时）
    const captchaTimeout = 600 * 1000; // 10 分钟
    console.log(`等待验证码验证中...（超时时间：${captchaTimeout / 60000} 分钟）`);
    
    // 等待验证码完成（兼容不同类型的验证码）
    await Promise.race([
      page.waitForFunction(() => {
        // 通用验证码完成检测逻辑（可根据目标网站调整）
        const captchaEls = document.querySelectorAll('.g-recaptcha, .cf-turnstile, [data-sitekey]');
        if (captchaEls.length === 0) return true;

        // 检测是否有验证成功的标识
        for (const el of captchaEls) {
          if (el.classList.contains('verified') || 
              el.getAttribute('data-status') === 'verified' ||
              el.querySelector('.success-icon') ||
              el.innerText.includes('验证通过') ||
              el.innerText.includes('Verified')) {
            return true;
          }
        }
        return false;
      }, { timeout: captchaTimeout }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('验证码验证超时（10分钟）')), captchaTimeout);
      })
    ]);

    console.log('验证码验证完成，准备提交...');
    await randomDelay(800, 1500);

    // 模拟真人点击提交按钮
    const submitBtn = await page.$('button[type="submit"]');
    if (!submitBtn) throw new Error('未找到提交按钮（选择器：button[type="submit"]）');
    
    await simulateHumanMouseMove(page, submitBtn);
    await randomDelay(300, 600); // 鼠标移动到按钮后等待
    await submitBtn.click();
    await randomDelay(500, 1000); // 点击后等待

    // 等待页面导航完成
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    // 验证登录是否成功
    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.toLowerCase().includes('login') && !title.includes('登录')) {
      console.log('\n✅ 登录成功！');
      console.log(`时间: ${new Date().toISOString()}`);
      console.log(`页面: ${currentUrlAfter}`);
      console.log(`标题: ${title}`);
    } else {
      throw new Error(`❌ 登录可能失败。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
    }

    console.log('\n脚本执行完成。');
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    console.error('\n❌ 登录失败：', error.message);
    console.error('错误详情：', error.stack);
    console.error('📸 错误截屏已保存为 login-failure.png');
    throw error;
  } finally {
    // 登录完成后延迟关闭浏览器，让用户查看结果
    console.log('\n5秒后将自动关闭浏览器...');
    await randomDelay(5000, 5000);
    await browser.close();
  }
}

// 运行登录函数
login();
