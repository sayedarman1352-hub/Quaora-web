<?php
require __DIR__ . '/config.php';

function fail($message, $code = 400) {
    http_response_code($code);
    echo '<!doctype html><meta charset="utf-8"><body style="font-family:Arial;padding:32px"><h2>Odeme baslatilamadi</h2><p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p><p><a href="../index.html">Siteye don</a></p></body>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Gecersiz istek.');
}

$cart_json = $_POST['cart_json'] ?? '';
$cart = json_decode($cart_json, true);

if (!is_array($cart) || count($cart) === 0) {
    fail('Sepet bos gorunuyor.');
}

$user_name = trim($_POST['user_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$user_phone = trim($_POST['user_phone'] ?? '');
$user_address = trim($_POST['user_address'] ?? '');

if ($user_name === '' || $email === '' || $user_phone === '' || $user_address === '') {
    fail('Lutfen ad soyad, e-posta, telefon ve adres bilgilerini doldurun.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('E-posta adresi gecersiz.');
}

$basket = [];
$total = 0;

foreach ($cart as $item) {
    $name = trim((string)($item['name'] ?? 'Urun'));
    $price = (float)($item['price'] ?? 0);
    $qty = max(1, (int)($item['qty'] ?? 1));

    if ($price <= 0) {
        continue;
    }

    $total += $price * $qty;
    $basket[] = [$name, number_format($price, 2, '.', ''), $qty];
}

if ($total <= 0 || count($basket) === 0) {
    fail('Sepet tutari gecersiz.');
}

$user_ip = $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$merchant_oid = 'QUAORA' . date('YmdHis') . random_int(1000, 9999);
$payment_amount = (int)round($total * 100);
$user_basket = base64_encode(json_encode($basket));
$currency = 'TL';
$no_installment = 0;
$max_installment = 0;

$hash_str = PAYTR_MERCHANT_ID . $user_ip . $merchant_oid . $email . $payment_amount . $user_basket . $no_installment . $max_installment . $currency . PAYTR_TEST_MODE;
$paytr_token = base64_encode(hash_hmac('sha256', $hash_str . PAYTR_MERCHANT_SALT, PAYTR_MERCHANT_KEY, true));

$post_vals = [
    'merchant_id' => PAYTR_MERCHANT_ID,
    'user_ip' => $user_ip,
    'merchant_oid' => $merchant_oid,
    'email' => $email,
    'payment_amount' => $payment_amount,
    'paytr_token' => $paytr_token,
    'user_basket' => $user_basket,
    'debug_on' => PAYTR_DEBUG_ON,
    'no_installment' => $no_installment,
    'max_installment' => $max_installment,
    'user_name' => $user_name,
    'user_address' => $user_address,
    'user_phone' => $user_phone,
    'merchant_ok_url' => rtrim(QUAORA_SITE_URL, '/') . '/paytr/success.html',
    'merchant_fail_url' => rtrim(QUAORA_SITE_URL, '/') . '/paytr/fail.html',
    'timeout_limit' => 30,
    'currency' => $currency,
    'test_mode' => PAYTR_TEST_MODE,
    'lang' => 'tr'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://www.paytr.com/odeme/api/get-token');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post_vals);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$result = curl_exec($ch);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    fail('PayTR baglanti hatasi: ' . $curl_error, 502);
}

$response = json_decode($result, true);

if (!is_array($response) || ($response['status'] ?? '') !== 'success') {
    fail('PayTR token hatasi: ' . ($response['reason'] ?? $result), 502);
}

header('Location: https://www.paytr.com/odeme/guvenli/' . $response['token']);
exit;
