<?php
declare(strict_types=1);

require __DIR__ . '/paytr_config.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'failed', 'reason' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['status' => 'failed', 'reason' => 'Gecersiz istek']);
    exit;
}

function paytr_clean_text(mixed $value, int $maxLength): string
{
    $text = trim((string) $value);
    $text = preg_replace('/\s+/', ' ', $text) ?? '';
    return function_exists('mb_substr') ? mb_substr($text, 0, $maxLength, 'UTF-8') : substr($text, 0, $maxLength);
}

function paytr_client_ip(): string
{
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
    foreach ($keys as $key) {
        if (empty($_SERVER[$key])) {
            continue;
        }
        $value = (string) $_SERVER[$key];
        $ip = trim(explode(',', $value)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return substr($ip, 0, 39);
        }
    }
    return '127.0.0.1';
}

$merchantOid = preg_replace('/[^A-Za-z0-9]/', '', (string) ($payload['merchant_oid'] ?? ''));
$email = paytr_clean_text($payload['email'] ?? '', 100);
$userName = paytr_clean_text($payload['user_name'] ?? 'Quaora Musterisi', 60);
$userAddress = paytr_clean_text($payload['user_address'] ?? 'Quaora online siparis', 400);
$userPhone = paytr_clean_text($payload['user_phone'] ?? '0000000000', 20);
$amount = (int) ($payload['payment_amount'] ?? 0);
$basket = $payload['basket'] ?? [];

if ($merchantOid === '' || strlen($merchantOid) > 64 || !filter_var($email, FILTER_VALIDATE_EMAIL) || $amount <= 0 || !is_array($basket) || count($basket) === 0) {
    http_response_code(422);
    echo json_encode(['status' => 'failed', 'reason' => 'Eksik veya gecersiz odeme bilgisi']);
    exit;
}

$basketRows = [];
foreach (array_slice($basket, 0, 50) as $item) {
    if (!is_array($item)) {
        continue;
    }
    $name = paytr_clean_text($item['name'] ?? 'Quaora urun', 120);
    $price = number_format(max(0, (float) ($item['price'] ?? 0)), 2, '.', '');
    $qty = max(1, (int) ($item['qty'] ?? 1));
    $basketRows[] = [$name, $price, $qty];
}

if (count($basketRows) === 0) {
    http_response_code(422);
    echo json_encode(['status' => 'failed', 'reason' => 'Sepet bos']);
    exit;
}

$userBasket = base64_encode(json_encode($basketRows, JSON_UNESCAPED_UNICODE));
$userIp = paytr_client_ip();
$hashStr = PAYTR_MERCHANT_ID . $userIp . $merchantOid . $email . $amount . $userBasket . PAYTR_NO_INSTALLMENT . PAYTR_MAX_INSTALLMENT . PAYTR_CURRENCY . PAYTR_TEST_MODE;
$paytrToken = base64_encode(hash_hmac('sha256', $hashStr . PAYTR_MERCHANT_SALT, PAYTR_MERCHANT_KEY, true));

$postVals = [
    'merchant_id' => PAYTR_MERCHANT_ID,
    'user_ip' => $userIp,
    'merchant_oid' => $merchantOid,
    'email' => $email,
    'payment_amount' => $amount,
    'paytr_token' => $paytrToken,
    'user_basket' => $userBasket,
    'debug_on' => PAYTR_DEBUG_ON,
    'no_installment' => PAYTR_NO_INSTALLMENT,
    'max_installment' => PAYTR_MAX_INSTALLMENT,
    'user_name' => $userName,
    'user_address' => $userAddress,
    'user_phone' => $userPhone,
    'merchant_ok_url' => QUAORA_BASE_URL . '/odeme-basarili.html',
    'merchant_fail_url' => QUAORA_BASE_URL . '/odeme-hata.html',
    'timeout_limit' => PAYTR_TIMEOUT_LIMIT,
    'currency' => PAYTR_CURRENCY,
    'test_mode' => PAYTR_TEST_MODE,
    'lang' => 'tr',
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://www.paytr.com/odeme/api/get-token');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postVals);
curl_setopt($ch, CURLOPT_FRESH_CONNECT, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
$result = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(502);
    echo json_encode(['status' => 'failed', 'reason' => 'PAYTR baglanti hatasi: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}
curl_close($ch);

echo $result ?: json_encode(['status' => 'failed', 'reason' => 'PAYTR bos yanit dondu']);
