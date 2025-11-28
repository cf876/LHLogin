const puppeteer = require('puppeteer');
const axios = require('axios');

async function sendTelegramMessage(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'  // 可选：支持格式化
  }).catch(error => {
    console.error('Telegram 通知失败:', error.message);
  });
}


async function login() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

    await page.type('#email', process.env.USERNAME);
    await page.type('#password', process.env.PASSWORD);

    await page.waitForSelector('.g-recaptcha', { timeout: 10000 });

    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

    const currentUrlAfter = page.url();
    const title = await page.title();
    if (currentUrlAfter.includes('/') && !title.includes('Login')) {
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, `*登录成功！*\n时间: ${new Date().toISOString()}\n页面: ${currentUrlAfter}\n标题: ${title}`);
      console.log('登录成功！当前页面：', currentUrlAfter);
    } else {
      throw new Error(`登录可能失败。当前 URL: ${currentUrlAfter}, 标题: ${title}`);
    }

    console.log('脚本执行完成。');
  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, `*登录失败！*\n时间: ${new Date().toISOString()}\n错误: ${error.message}\n请检查 Artifacts 中的 login-debug`);
    console.error('登录失败：', error.message);
    console.error('截屏已保存为 login-failure.png');
    throw error;
  } finally {
    await browser.close();
  }
}

login();
