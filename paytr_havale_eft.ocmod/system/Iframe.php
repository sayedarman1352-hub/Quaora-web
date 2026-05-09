<?php

class Iframe
{
    public $db;
    public $logger;
    public $config;

    private $hash;
    private $category_installment = array();
    private $category_full;

    public function __construct()
    {
        $this->hash = new Hash();
    }

    public function getToken($params): array
    {
        $response = array();

        $paytr_token = $this->hash->generateHashIframeAPI($params);

        $post_val = array(
            'merchant_id' => $params['merchant_id'],
            'user_ip' => $params['user_ip'],
            'merchant_oid' => $params['merchant_oid'],
            'email' => $params['email'],
            'payment_amount' => $params['payment_amount'],
            'paytr_token' => $paytr_token,
            'user_basket' => $params['user_basket'],
            'debug_on' => 1,
            'no_installment' => $params['no_installment'],
            'max_installment' => $params['max_installment'],
            'user_name' => $params['user_name'],
            'user_address' => $params['user_address'],
            'user_phone' => $params['user_phone'],
            'currency' => $params['currency'],
            'test_mode'=> $params['test_mode'],
            'merchant_ok_url' => $params['merchant_ok_url'],
            'merchant_fail_url' => $params['merchant_fail_url'],
            'lang' => $params['lang'],
            'iframe_v2' => (isset($params['iframe_v2']) ? $params['iframe_v2'] : 0), 
            'iframe_v2_dark' => (isset($params['iframe_v2_dark']) ? $params['iframe_v2_dark'] : 0)
        );
        /*
        * XXX: DİKKAT: lokal makinanızda "SSL certificate problem: unable to get local issuer certificate" uyarısı alırsanız eğer
        * aşağıdaki kodu açıp deneyebilirsiniz. ANCAK, güvenlik nedeniyle sunucunuzda (gerçek ortamınızda) bu kodun kapalı kalması çok önemlidir!
        * curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        * */
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://www.paytr.com/odeme/api/get-token");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post_val);
        curl_setopt($ch, CURLOPT_FRESH_CONNECT, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 90);
        curl_setopt($ch, CURLOPT_SSLVERSION, 6);
        $result = @curl_exec($ch);

        if (curl_errno($ch)) {

            $response['status'] = 'failed';
            $response['status_message'] = 'PAYTR IFRAME connection error. err: ' . curl_error($ch);

            curl_close($ch);
        } else {

            $result = json_decode($result, 1);

            if ($result['status'] == 'success') {
                $response['status'] = 'success';
                $response['iframe_token'] = $result['token'];
            } else {
                $response['status'] = 'failed';
                $response['status_message'] = $result['reason'];
            }
        }

        return $response;
    }

    public function getBasketMaxInstallment($products, $config): array
    {
        $response = [];
        $user_basket = [];

        $installment_number = $config->get('payment_paytr_checkout_installment_number');

        if ($installment_number != 13) {

            foreach ($products as $product) {
                $user_basket[] = [$product['name'], $product['price'], $product['quantity']];
            }
            $max_installment = in_array($installment_number, range(0, 12)) ? $installment_number : 0;
        } else {
            $this->category_installment = $config->get('payment_paytr_checkout_category_installment');
            $installments = [];

            foreach ($products as $product) {
                $user_basket[] = [$product['name'], $product['price'], $product['quantity']];

                $query = $this->db->query("SELECT category_id FROM " . DB_PREFIX . "product_to_category WHERE product_id = '" . (int)$product['product_id'] . "' ORDER BY category_id ASC");

                foreach ($query->rows as $item) {
                    $category_id = $item['category_id'];
                    $installments[$category_id] = $this->category_installment[$category_id] ?? $this->categorySearch($category_id);
                }
            }

            $filtered_installments = array_diff($installments, [0]);
            $max_installment = count($filtered_installments) > 0 ? min($filtered_installments) : 0;
        }
        $response['max_installment'] = $max_installment;
        $response['user_basket'] = base64_encode(json_encode($user_basket));

        return $response;
    }

    protected function categorySearch($category_id = 0)
    {
        if (!empty($this->category_full[$category_id]) && isset($this->category_installment[$this->category_full[$category_id]])) {
            return $this->category_installment[$this->category_full[$category_id]];
        }

        foreach ($this->category_full as $id => $parent) {
            if ($category_id == $id) {
                if ($parent == 0 || !isset($this->category_installment[$parent])) {
                    return $this->categorySearch($parent);
                }
                return $this->category_installment[$parent];
            }
        }

        return 0;
    }
}
