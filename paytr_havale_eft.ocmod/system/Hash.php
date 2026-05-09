<?php

class Hash
{
    public function generateHashIframeAPI($params): string
    {
        $hash_str = implode('', [
            $params['merchant_id'],
            $params['user_ip'],
            $params['merchant_oid'],
            $params['email'],
            $params['payment_amount'],
            $params['user_basket'],
            $params['no_installment'],
            $params['max_installment'],
            $params['currency'],
            $params['test_mode']
        ]);

        return base64_encode(hash_hmac(
                'sha256',
                $hash_str . $params['merchant_salt'], $params['merchant_key'],
                true
            ));
    }

    public function generateHashEftAPI($params)
    {
        $hash_str = implode('', [
            $params['merchant_id'],
            $params['user_ip'],
            $params['merchant_oid'],
            $params['email'],
            $params['payment_amount'],
            'eft',
            $params['test_mode']
        ]);

        return base64_encode(hash_hmac(
            'sha256',
            $hash_str . $params['merchant_salt'], $params['merchant_key'],
            true)
        );
    }

    public function generateHashRefundApi($params)
    {
        return base64_encode(hash_hmac(
            'sha256',
            $params['merchant_id'] . $params['merchant_oid'] . $params['amount'] . $params['merchant_salt'],
            $params['merchant_key'],
            true)
        );
    }
}
