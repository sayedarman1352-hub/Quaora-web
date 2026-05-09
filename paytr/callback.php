<?php
require __DIR__ . '/config.php';

$post = $_POST;

if (!$post) {
    echo '';
    exit;
}

$hash = base64_encode(hash_hmac('sha256', $post['merchant_oid'] . PAYTR_MERCHANT_SALT . $post['status'] . $post['total_amount'], PAYTR_MERCHANT_KEY, true));

if ($hash !== ($post['hash'] ?? '')) {
    die('PAYTR notification failed: bad hash');
}

$log_dir = __DIR__ . '/logs';
if (!is_dir($log_dir)) {
    mkdir($log_dir, 0755, true);
}

$line = date('c') . ' ' . json_encode([
    'merchant_oid' => $post['merchant_oid'] ?? '',
    'status' => $post['status'] ?? '',
    'total_amount' => $post['total_amount'] ?? '',
    'failed_reason_code' => $post['failed_reason_code'] ?? '',
    'failed_reason_msg' => $post['failed_reason_msg'] ?? ''
], JSON_UNESCAPED_UNICODE) . PHP_EOL;

file_put_contents($log_dir . '/paytr-callback.log', $line, FILE_APPEND);

echo 'OK';
exit;
