<?php
class ControllerExtensionPaymentPaytrIframe extends Controller {
    public function index() {
        $this->load->language('extension/payment/paytr_iframe');

        $data['button_confirm'] = $this->language->get('button_confirm');
        $data['text_loading'] = $this->language->get('text_loading');

        return $this->load->view('extension/payment/paytr_iframe', $data);
    }

    public function pay() {
        $this->load->language('extension/payment/paytr_iframe');
        $json = array();

        if (empty($this->session->data['order_id'])) {
            $json['error'] = $this->language->get('error_missing_order');
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        $this->load->model('checkout/order');
        $order_info = $this->model_checkout_order->getOrder($this->session->data['order_id']);

        if (!$order_info) {
            $json['error'] = $this->language->get('error_missing_order');
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        if (!(int)$order_info['order_status_id']) {
            $this->model_checkout_order->addOrderHistory($order_info['order_id'], (int)$this->config->get('payment_paytr_iframe_order_status_id'), '', false);
        }

        $result = $this->createToken($order_info);

        if (!empty($result['error'])) {
            $json['error'] = sprintf($this->language->get('error_token'), $result['error']);
        } else {
            $this->session->data['paytr_iframe_token'] = $result['token'];
            $json['redirect'] = $this->url->link('extension/payment/paytr_iframe/iframe', '', true);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function iframe() {
        if (empty($this->session->data['paytr_iframe_token'])) {
            $this->response->redirect($this->url->link('checkout/checkout', '', true));
            return;
        }

        $this->load->language('extension/payment/paytr_iframe');
        $this->document->setTitle($this->language->get('text_title'));

        $data['breadcrumbs'] = array(
            array('text' => $this->language->get('text_home'), 'href' => $this->url->link('common/home')),
            array('text' => $this->language->get('text_title'), 'href' => $this->url->link('extension/payment/paytr_iframe/iframe', '', true))
        );

        $data['iframe_token'] = $this->session->data['paytr_iframe_token'];
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['column_right'] = $this->load->controller('common/column_right');
        $data['content_top'] = $this->load->controller('common/content_top');
        $data['content_bottom'] = $this->load->controller('common/content_bottom');
        $data['footer'] = $this->load->controller('common/footer');
        $data['header'] = $this->load->controller('common/header');

        $this->response->setOutput($this->load->view('extension/payment/paytr_iframe_page', $data));
    }

    public function callback() {
        $this->load->language('extension/payment/paytr_iframe');

        $merchant_key = $this->config->get('payment_paytr_iframe_merchant_key');
        $merchant_salt = $this->config->get('payment_paytr_iframe_merchant_salt');

        $merchant_oid = isset($this->request->post['merchant_oid']) ? $this->request->post['merchant_oid'] : '';
        $status = isset($this->request->post['status']) ? $this->request->post['status'] : '';
        $total_amount = isset($this->request->post['total_amount']) ? $this->request->post['total_amount'] : '';
        $hash = isset($this->request->post['hash']) ? $this->request->post['hash'] : '';

        $token = base64_encode(hash_hmac('sha256', $merchant_oid . $merchant_salt . $status . $total_amount, $merchant_key, true));

        if ($token !== $hash) {
            $this->response->addHeader('HTTP/1.1 403 Forbidden');
            $this->response->setOutput($this->language->get('error_signature'));
            return;
        }

        $order_id = (int)preg_replace('/[^0-9]/', '', $merchant_oid);
        $this->load->model('checkout/order');

        if ($status === 'success') {
            $this->model_checkout_order->addOrderHistory($order_id, (int)$this->config->get('payment_paytr_iframe_success_status_id'), $this->language->get('text_success_note'), true);
        } else {
            $message = isset($this->request->post['failed_reason_msg']) ? $this->request->post['failed_reason_msg'] : 'unknown';
            $this->model_checkout_order->addOrderHistory($order_id, (int)$this->config->get('payment_paytr_iframe_failed_status_id'), sprintf($this->language->get('text_failed_note'), $message), true);
        }

        $this->response->setOutput('OK');
    }

    public function success() {
        $this->response->redirect($this->url->link('checkout/success', '', true));
    }

    public function fail() {
        $this->response->redirect($this->url->link('checkout/checkout', '', true));
    }

    private function createToken($order_info) {
        $merchant_id = $this->config->get('payment_paytr_iframe_merchant_id');
        $merchant_key = $this->config->get('payment_paytr_iframe_merchant_key');
        $merchant_salt = $this->config->get('payment_paytr_iframe_merchant_salt');

        $order_id = (int)$order_info['order_id'];
        $merchant_oid = (string)$order_id;
        $email = $order_info['email'];
        $payment_amount = (int)round($order_info['total'] * 100);
        $currency = $order_info['currency_code'] == 'TRY' ? 'TL' : $order_info['currency_code'];
        $test_mode = (int)$this->config->get('payment_paytr_iframe_test_mode');
        $debug_on = (int)$this->config->get('payment_paytr_iframe_debug_on');
        $no_installment = (int)$this->config->get('payment_paytr_iframe_no_installment');
        $max_installment = (int)$this->config->get('payment_paytr_iframe_max_installment');
        $timeout_limit = 30;
        $user_ip = $this->request->server['REMOTE_ADDR'];

        $user_name = trim($order_info['payment_firstname'] . ' ' . $order_info['payment_lastname']);
        $user_address = trim($order_info['payment_address_1'] . ' ' . $order_info['payment_address_2'] . ' ' . $order_info['payment_city']);
        $user_phone = $order_info['telephone'];

        $basket = array();
        foreach ($this->cart->getProducts() as $product) {
            $basket[] = array(
                $product['name'],
                $this->currency->format($product['price'], $order_info['currency_code'], $order_info['currency_value'], false),
                (int)$product['quantity']
            );
        }

        $user_basket = base64_encode(json_encode($basket));
        $hash_str = $merchant_id . $user_ip . $merchant_oid . $email . $payment_amount . $user_basket . $no_installment . $max_installment . $currency . $test_mode;
        $paytr_token = base64_encode(hash_hmac('sha256', $hash_str . $merchant_salt, $merchant_key, true));

        $post_vals = array(
            'merchant_id' => $merchant_id,
            'user_ip' => $user_ip,
            'merchant_oid' => $merchant_oid,
            'email' => $email,
            'payment_amount' => $payment_amount,
            'paytr_token' => $paytr_token,
            'user_basket' => $user_basket,
            'debug_on' => $debug_on,
            'no_installment' => $no_installment,
            'max_installment' => $max_installment,
            'user_name' => $user_name,
            'user_address' => $user_address,
            'user_phone' => $user_phone,
            'merchant_ok_url' => $this->url->link('extension/payment/paytr_iframe/success', '', true),
            'merchant_fail_url' => $this->url->link('extension/payment/paytr_iframe/fail', '', true),
            'timeout_limit' => $timeout_limit,
            'currency' => $currency,
            'test_mode' => $test_mode,
            'lang' => 'tr'
        );

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
            return array('error' => $curl_error);
        }

        $response = json_decode($result, true);

        if (!is_array($response)) {
            return array('error' => $result);
        }

        if (isset($response['status']) && $response['status'] === 'success') {
            return array('token' => $response['token']);
        }

        return array('error' => isset($response['reason']) ? $response['reason'] : $result);
    }
}
