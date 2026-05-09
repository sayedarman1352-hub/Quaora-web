const crypto = require('crypto');
const querystring = require('querystring');

function getEnv(key) {
  const value = process.env[key];
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('');
    return;
  }

  const merchantKey = getEnv('PAYTR_MERCHANT_KEY');
  const merchantSalt = getEnv('PAYTR_MERCHANT_SALT');

  if (!merchantKey || !merchantSalt) {
    res.statusCode = 500;
    res.end('PAYTR config missing');
    return;
  }

  const post = await readBody(req);
  const expectedHash = crypto
    .createHmac('sha256', merchantKey)
    .update(`${post.merchant_oid || ''}${merchantSalt}${post.status || ''}${post.total_amount || ''}`)
    .digest('base64');

  if (expectedHash !== post.hash) {
    res.statusCode = 403;
    res.end('PAYTR notification failed: bad hash');
    return;
  }

  console.log('PAYTR_CALLBACK', {
    merchant_oid: post.merchant_oid,
    status: post.status,
    total_amount: post.total_amount,
    failed_reason_code: post.failed_reason_code,
    failed_reason_msg: post.failed_reason_msg,
  });

  res.statusCode = 200;
  res.end('OK');
};
