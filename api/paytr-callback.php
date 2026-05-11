<?php
declare(strict_types=1);

require __DIR__ . '/paytr_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$post = $_POST;
$required = ['merchant_oid', 'status', 'total_amount', 'hash'];
foreach ($required as $key) {
    if (!isset($post[$key])) {
        http_response_code(400);
        exit;
    }
}

$hash = base64_encode(hash_hmac(
    'sha256',
    $post['merchant_oid'] . PAYTR_MERCHANT_SALT . $post['status'] . $post['total_amount'],
    PAYTR_MERCHANT_KEY,
    true
));

if (!hash_equals($hash, (string) $post['hash'])) {
    http_response_code(403);
    die('PAYTR notification failed: bad hash');
}

$logDir = __DIR__ . '/../paytr-notifications';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$safePost = $post;
unset($safePost['hash']);
$line = json_encode([
    'receivedAt' => gmdate('c'),
    'merchant_oid' => $post['merchant_oid'],
    'status' => $post['status'],
    'total_amount' => $post['total_amount'],
    'payload' => $safePost,
], JSON_UNESCAPED_UNICODE) . PHP_EOL;

file_put_contents($logDir . '/paytr-callbacks.jsonl', $line, FILE_APPEND | LOCK_EX);

echo 'OK';
exit;
