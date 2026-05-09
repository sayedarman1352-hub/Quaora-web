<?php

class Eft
{
    public $db;
    public $logger;
    public $config;

    private $hash;

    public function __construct()
    {
        $this->hash = new Hash();
    }

    public function getToken($params)
    {
        $response = [];
        $paytr_token = $this->hash->generateHashEftAPI($params);
        $post_val = [
            'merchant_id'    => $params['merchant_id'],
            'user_ip'        => $params['user_ip'],
            'merchant_oid'   => $params['merchant_oid'],
            'email'          => $params['email'],
            'payment_amount' => $params['payment_amount'],
            'payment_type'   => 'eft',
            'paytr_token'    => $paytr_token,
            'timeout_limit'  => $params['timeout_limit'] ?? 30,
            'test_mode'      => $params['test_mode'] ?? 0,
            'debug_on'       => 1
        ];
        $ch = curl_init('https://www.paytr.com/odeme/api/get-token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $post_val,
            CURLOPT_FRESH_CONNECT => true,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_CONNECTTIMEOUT => 90,
            CURLOPT_SSLVERSION => 6
        ]);
        $result = @curl_exec($ch);

        if (curl_errno($ch)) {
            $response['status'] = 'failed';
            $response['status_message'] = 'PAYTR IFRAME connection error. err: ' . curl_error($ch);
        } else {
            $result = json_decode($result, true);
            if ($result && $result['status'] === 'success') {
                $response['status'] = 'success';
                $response['eft_token'] = $result['token'];
            } else {
                $response['status'] = 'failed';
                $response['status_message'] = $result['reason'] ?? 'Unknown error';
            }
        }
        curl_close($ch);
        return $response;
    }
}
