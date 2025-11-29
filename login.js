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
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  const page = await browser.newPage();

  // 模拟真人的用户行为
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 模拟页面加载后的思考时间
  await randomDelay(2000, 4000);

  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2' });
    
    // 等待Cloudflare验证页面加载
    await randomDelay(3000, 5000);
    
    // 定位并点击“Verify you are human”复选框（根据页面元素）
    console.log('开始Cloudflare人机验证...');
    try {
      // 精准定位验证复选框（匹配页面上的元素）
      const verifyCheckbox = await page.waitForSelector('input[type="checkbox"][name="cf-turnstile-response"]', { timeout: 10000 });
      if (verifyCheckbox) {
        await page.hover('input[type="checkbox"][name="cf-turnstile-response"]');
        await randomDelay(500, 800);
        await page.click('input[type="checkbox"][name="cf-turnstile-response"]', { delay: 200 });
        console.log('已点击验证复选框，等待验证完成...');
      } else {
        // 备用选择器（匹配页面上的“Verify you are human”区域）
        await page.hover('div:has-text("Verify you are human") input[type="checkbox"]');
        await randomDelay(500, 800);
        await page.click('div:has-text("Verify you are human") input[type="checkbox"]', { delay: 200 });
        console.log('已通过备用选择器点击验证复选框...');
      }
    } catch (e) {
      // 极端情况：用坐标点击（根据你提供的页面，复选框在页面左上方区域）
      console.log('选择器点击失败，尝试坐标点击...');
      await page.mouse.move(50, 350); // 匹配页面上复选框的位置（左50px，上350px）
      await randomDelay(300, 500);
      await page.mouse.down();
      await randomDelay(100, 200);
      await page.mouse.up();
    }
    
    // 等待验证完成和页面跳转
    await randomDelay(5000, 10000);
    
    // 等待登录页面加载
    await randomDelay(3000, 5000);

    // 模拟真人阅读页面的时间
    await randomDelay(2000, 4000);

    // 模拟真人移动鼠标到邮箱输入框
    await page.hover('#email');
    await randomDelay(500, 1000);
    
    // 逐个字符输入，模拟真人打字
    const email = process.env.USERNAME;
    for (const char of email) {
      await page.type('#email', char);
      await randomDelay(100, 300); // 每个字符之间的延迟
    }
    
    await randomDelay(1000, 2000);
    
    // 移动到密码框
    await page.hover('#password');
    await randomDelay(500, 1000);
    
    // 逐个字符输入密码
    const password = process.env.PASSWORD;
    for (const char of password) {
      await page.type('#password', char);
      await randomDelay(100, 300);
    }
    
    await randomDelay(2000, 3000);

    // 等待验证码处理（30秒等待时间）
    console.log('等待验证码区域加载并准备跳过...');
    try {
      await page.waitForSelector('.g-recaptcha, [data-sitekey], iframe[src*="captcha"], iframe[src*="turnstile"]', { timeout: 10000 });
      console.log('检测到验证码，等待30秒供人工处理或自动跳过...');
      await randomDelay(30000); // 等待30秒
    } catch (e) {
      console.log('未检测到验证码或验证码已加载完成');
    }

    // 尝试点击提交按钮
    try {
      await page.click('button[type="submit"]', { delay: 100 });
      await randomDelay(2000, 4000);
    } catch (e) {
      console.log('提交按钮点击失败或需要验证码验证');
    }

    // 等待页面导航
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
      console.log('页面导航超时，继续检查登录状态');
    }

    // 检查登录状态
    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.includes('Login') && !title.includes('Sign')) {
      console.log('登录成功！当前页面：', currentUrlAfter);
      console.log('页面标题：', title);
    } else {
      // 如果登录页面有自动刷新或验证码自动过期机制，这里会继续
      console.log(`登录流程继续。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
      // 再等待一段时间让页面完成加载
      await randomDelay(5000, 8000);
      
      // 最终检查
      const finalUrl = page.url();
      const finalTitle = await page.title();
      if (finalUrl.includes('/') && !finalTitle.includes('Login') && !finalTitle.includes('Sign')) {
        console.log('最终检查：登录成功！当前页面：', finalUrl);
      } else {
        throw new Error(`登录可能失败。最终 URL: ${finalUrl}, 标题: ${finalTitle}`);
      }
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
