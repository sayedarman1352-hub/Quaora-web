const crypto = require('crypto');
const querystring = require('querystring');

function escapeHtml(value) {
  return String(value).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function getEnv(key, fallback = '') {
  const value = process.env[key];
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

function getEnvRaw(key) {
  const value = process.env[key];
  if (value === undefined || value === null) return '';
  return String(value);
}

function inspectSecretEnv(key) {
  const raw = getEnvRaw(key);
  const clean = getEnv(key);
  return {
    length: clean.length,
    changedByCleanup: raw !== clean,
    hasInternalWhitespace: /\s/.test(clean),
    looksLikePlaceholder: /magaza|merchant|parola|gizli|anahtar|key|salt/i.test(clean),
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }

    if (typeof req.body === 'string') {
      resolve(querystring.parse(req.body));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(querystring.parse(body)));
    req.on('error', reject);
  });
}

function htmlError(res, message, status = 400) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:Arial;padding:32px"><h2>Odeme baslatilamadi</h2><p>${escapeHtml(message)}</p><p><a href="/paytr-checkout.html">Geri don</a></p></body>`);
}

function createToken({ merchantId, merchantKey, merchantSalt, userIp, merchantOid, email, paymentAmount, userBasket, noInstallment, maxInstallment, currency, testMode }) {
  const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  return crypto.createHmac('sha256', merchantKey).update(hashStr + merchantSalt).digest('base64');
}

async function requestToken(postValues) {
  const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postValues,
  });

  const resultText = await response.text();

  try {
    return JSON.parse(resultText);
  } catch (error) {
    throw new Error(`PayTR cevabi okunamadi: ${resultText}`);
  }
}

function isTokenError(result) {
  return String(result?.reason || '').toLowerCase().includes('paytr_token');
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const required = ['PAYTR_MERCHANT_ID', 'PAYTR_MERCHANT_KEY', 'PAYTR_MERCHANT_SALT'];
    const merchantId = getEnv('PAYTR_MERCHANT_ID');
    const merchantKey = getEnv('PAYTR_MERCHANT_KEY');
    const merchantSalt = getEnv('PAYTR_MERCHANT_SALT');
    const missing = required.filter(key => !getEnv(key));
    const merchantIdFormatOk = /^\d+$/.test(merchantId);
    const merchantKeyInfo = inspectSecretEnv('PAYTR_MERCHANT_KEY');
    const merchantSaltInfo = inspectSecretEnv('PAYTR_MERCHANT_SALT');
    const secretShapeOk = merchantKeyInfo.length > 0
      && merchantSaltInfo.length > 0
      && merchantKey !== merchantSalt
      && !merchantKeyInfo.hasInternalWhitespace
      && !merchantSaltInfo.hasInternalWhitespace
      && !merchantKeyInfo.looksLikePlaceholder
      && !merchantSaltInfo.looksLikePlaceholder;
    res.statusCode = missing.length || !merchantIdFormatOk || !secretShapeOk ? 500 : 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: missing.length === 0 && merchantIdFormatOk && secretShapeOk,
      missing,
      merchantIdFormatOk,
      merchantIdLength: merchantId.length,
      merchantKeyInfo,
      merchantSaltInfo,
      merchantKeySaltSame: merchantKey !== '' && merchantKey === merchantSalt,
      siteUrl: getEnv('SITE_URL', 'https://quaora-web.vercel.app'),
      testMode: getEnv('PAYTR_TEST_MODE', '0'),
      debugOn: getEnv('PAYTR_DEBUG_ON', '0'),
    }));
    return;
  }

  if (req.method !== 'POST') {
    htmlError(res, 'Gecersiz istek.', 405);
    return;
  }

  const merchantId = getEnv('PAYTR_MERCHANT_ID');
  const merchantKey = getEnv('PAYTR_MERCHANT_KEY');
  const merchantSalt = getEnv('PAYTR_MERCHANT_SALT');
  const siteUrl = getEnv('SITE_URL', 'https://quaora-web.vercel.app').replace(/\/$/, '');
  const testMode = Number(getEnv('PAYTR_TEST_MODE', '0'));
  const debugOn = Number(getEnv('PAYTR_DEBUG_ON', '0'));

  if (!merchantId || !merchantKey || !merchantSalt) {
    const missing = [
      ['PAYTR_MERCHANT_ID', merchantId],
      ['PAYTR_MERCHANT_KEY', merchantKey],
      ['PAYTR_MERCHANT_SALT', merchantSalt],
    ].filter(([, value]) => !value).map(([key]) => key).join(', ');
    htmlError(res, `PayTR ortam degiskenleri eksik: ${missing}. Vercel Environment Variables alanini kontrol edin ve redeploy yapin.`, 500);
    return;
  }

  if (!/^\d+$/.test(merchantId)) {
    htmlError(res, 'PAYTR_MERCHANT_ID sadece rakamlardan olusmali. PayTR panelindeki Magaza No degerini kontrol edin.', 500);
    return;
  }

  const body = await readBody(req);
  let cart;

  try {
    cart = JSON.parse(body.cart_json || '[]');
  } catch (error) {
    htmlError(res, 'Sepet verisi okunamadi.');
    return;
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    htmlError(res, 'Sepet bos gorunuyor.');
    return;
  }

  const userName = String(body.user_name || '').trim();
  const email = String(body.email || '').trim();
  const userPhone = String(body.user_phone || '').trim();
  const userAddress = String(body.user_address || '').trim();

  if (!userName || !email || !userPhone || !userAddress) {
    htmlError(res, 'Lutfen ad soyad, e-posta, telefon ve adres bilgilerini doldurun.');
    return;
  }

  const basket = [];
  let total = 0;

  for (const item of cart) {
    const name = String(item.name || 'Urun').trim();
    const price = Number(item.price || 0);
    const qty = Math.max(1, Number.parseInt(item.qty || 1, 10));

    if (price > 0) {
      total += price * qty;
      basket.push([name, price.toFixed(2), qty]);
    }
  }

  if (total <= 0 || basket.length === 0) {
    htmlError(res, 'Sepet tutari gecersiz.');
    return;
  }

  const forwardedFor = String(req.headers['x-forwarded-for'] || '');
  const userIp = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
  const merchantOid = `QUAORA${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
  const paymentAmount = Math.round(total * 100);
  const userBasket = Buffer.from(JSON.stringify(basket)).toString('base64');
  const currency = 'TL';
  const noInstallment = 0;
  const maxInstallment = 0;

  const basePostValues = {
    merchant_id: merchantId,
    user_ip: userIp,
    merchant_oid: merchantOid,
    email,
    payment_amount: String(paymentAmount),
    user_basket: userBasket,
    debug_on: String(debugOn),
    no_installment: String(noInstallment),
    max_installment: String(maxInstallment),
    user_name: userName,
    user_address: userAddress,
    user_phone: userPhone,
    merchant_ok_url: `${siteUrl}/paytr/success.html`,
    merchant_fail_url: `${siteUrl}/paytr/fail.html`,
    timeout_limit: '30',
    currency,
    test_mode: String(testMode),
    lang: 'tr',
  };

  const tokenInput = {
    merchantId,
    merchantKey,
    merchantSalt,
    userIp,
    merchantOid,
    email,
    paymentAmount,
    userBasket,
    noInstallment,
    maxInstallment,
    currency,
    testMode,
  };

  let result;
  let usedFallbackCredentials = false;

  try {
    const paytrToken = createToken(tokenInput);
    result = await requestToken(new URLSearchParams({ ...basePostValues, paytr_token: paytrToken }));

    if (result.status !== 'success' && isTokenError(result)) {
      const fallbackToken = createToken({
        ...tokenInput,
        merchantKey: merchantSalt,
        merchantSalt: merchantKey,
      });
      const fallbackResult = await requestToken(new URLSearchParams({ ...basePostValues, paytr_token: fallbackToken }));

      if (fallbackResult.status === 'success') {
        result = fallbackResult;
        usedFallbackCredentials = true;
      }
    }
  } catch (error) {
    htmlError(res, `PayTR baglanti hatasi: ${error.message}`, 502);
    return;
  }

  if (result.status !== 'success') {
    htmlError(res, `PayTR token hatasi: ${result.reason || JSON.stringify(result)}. PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT degerlerini PayTR panelinden tekrar kontrol edin.`, 502);
    return;
  }

  if (usedFallbackCredentials) {
    console.warn('PAYTR_ENV_WARNING', 'PAYTR_MERCHANT_KEY and PAYTR_MERCHANT_SALT appear to be swapped in Vercel.');
  }

  res.writeHead(302, { Location: `https://www.paytr.com/odeme/guvenli/${result.token}` });
  res.end();
};
