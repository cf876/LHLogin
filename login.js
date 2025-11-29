const puppeteer = require('puppeteer');

// 模拟真人操作的随机延迟函数
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

async function login() {
  const browser = await puppeteer.launch({
    headless: false, // 改为false以便人工操作验证码
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();

  // 模拟真人的用户行为
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 模拟页面加载后的思考时间
  await randomDelay(2000, 4000);

  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2' });
    
    // 模拟真人阅读页面的时间
    await randomDelay(3000, 5000);

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

    // 等待验证码人工处理（60秒超时）
    console.log('请在60秒内完成验证码验证并点击登录按钮...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {
      console.log('验证码等待超时，继续执行...');
    });

    // 检查登录状态
    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.includes('Login')) {
      console.log('登录成功！当前页面：', currentUrlAfter);
      console.log('页面标题：', title);
    } else {
      throw new Error(`登录可能失败。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
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
