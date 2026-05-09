<?php
namespace Opencart\Catalog\Controller\Extension\PaytrHavaleEft\Payment;

require_once DIR_EXTENSION . 'paytr_havale_eft/system/PaytrCore.php';
use PaytrCore;

class PaytrCheckout extends \Opencart\System\Engine\Controller {
    private PaytrCore $paytr;
    private $oc_version = 'PAYTROC4';

    public function __construct($registry) {
        parent::__construct($registry);
        $this->paytr = new PaytrCore($registry);
    }

    public function index(): string {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_checkout');

        $data['button_confirm'] = $this->language->get('button_confirm');
        $data['text_loading'] = $this->language->get('text_loading');

        return $this->load->view('extension/paytr_havale_eft/payment/paytr_checkout', $data);
    }

    public function confirm(): void {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_checkout');
        $json = [];

        $data = $this->getIframeToken();

        if (!empty($data['error'])) {
            $json['error'] = $data['error'];
        } else {
            $this->session->data['paytr_iframe_token'] = $data['iframe_token'];
            $json['redirect'] = $this->url->link('extension/paytr_havale_eft/payment/paytr_checkout.iframe', '', true);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function iframe(): void {
        if (empty($this->session->data['paytr_iframe_token'])) {
            $this->response->redirect($this->url->link('checkout/checkout', '', true));
            return;
        }

        $this->load->language('extension/paytr_havale_eft/payment/paytr_checkout');
        $this->document->setTitle($this->language->get('text_title'));

        $data['breadcrumbs'] = [
            ['text' => $this->language->get('text_home'), 'href' => $this->url->link('common/home')],
            ['text' => $this->language->get('text_title'), 'href' => $this->url->link('extension/paytr_havale_eft/payment/paytr_checkout.iframe', '', true)]
        ];

        $data['iframe_token'] = $this->session->data['paytr_iframe_token'];
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['column_right'] = $this->load->controller('common/column_right');
        $data['content_top'] = $this->load->controller('common/content_top');
        $data['content_bottom'] = $this->load->controller('common/content_bottom');
        $data['footer'] = $this->load->controller('common/footer');
        $data['header'] = $this->load->controller('common/header');

        $this->response->setOutput($this->load->view('extension/paytr_havale_eft/payment/paytr_checkout_iframe', $data));
    }

    public function callback(): void {
        if (empty($_POST)) {
            echo '';
            exit;
        }

        $this->load->model('checkout/order');
        $this->paytr->chkHash($_POST, 'iframe');
        $this->paytr->iframeCallback($_POST, $this->oc_version);
    }

    public function success(): void {
        $this->response->redirect($this->url->link('checkout/success', '', true));
    }

    public function fail(): void {
        $this->response->redirect($this->url->link('checkout/checkout', '', true));
    }

    protected function getIframeToken(): array {
        $this->load->model('checkout/order');
        $this->load->model('localisation/currency');

        $data = [];
        if (!isset($this->session->data['order_id'])) {
            return ['error' => 'Order not found.'];
        }

        $order_info = $this->model_checkout_order->getOrder($this->session->data['order_id']);
        if (!$order_info) {
            return ['error' => 'Order not found.'];
        }

        $products = $this->cart->getProducts();
        $basket = $this->paytr->iframe->getBasketMaxInstallment($products, $this->config);
        $merchant_oid = uniqid() . $this->oc_version . $order_info['order_id'];
        $total = $this->currency->format($order_info['total'], $order_info['currency_code'], $order_info['currency_value'], false);

        $paytr_params = [
            'merchant_id' => $this->config->get('payment_paytr_checkout_merchant_id'),
            'merchant_key' => $this->config->get('payment_paytr_checkout_merchant_key'),
            'merchant_salt' => $this->config->get('payment_paytr_checkout_merchant_salt'),
            'user_ip' => $this->getIp(),
            'email' => $order_info['email'],
            'merchant_oid' => $merchant_oid,
            'payment_amount' => $total * 100,
            'user_basket' => $basket['user_basket'],
            'no_installment' => $basket['max_installment'] == 1 ? 1 : 0,
            'max_installment' => $basket['max_installment'],
            'user_name' => trim($order_info['payment_firstname'] . ' ' . $order_info['payment_lastname']),
            'user_address' => trim($order_info['payment_address_1'] . ' ' . $order_info['payment_address_2'] . ' ' . $order_info['payment_city']),
            'user_phone' => $order_info['telephone'],
            'currency' => $order_info['currency_code'] == 'TRY' ? 'TL' : $order_info['currency_code'],
            'test_mode' => $this->config->get('payment_paytr_checkout_test_mode'),
            'merchant_ok_url' => $this->url->link('extension/paytr_havale_eft/payment/paytr_checkout.success', '', true),
            'merchant_fail_url' => $this->url->link('extension/paytr_havale_eft/payment/paytr_checkout.fail', '', true),
            'lang' => $this->config->get('config_language') == 'tr-tr' ? 'tr' : 'en',
            'iframe_v2' => $this->config->get('payment_paytr_checkout_iframe_v2'),
            'iframe_v2_dark' => $this->config->get('payment_paytr_checkout_iframe_v2_dark')
        ];

        if (!function_exists('curl_version')) {
            return ['error' => $this->language->get('error_paytr_checkout_curl')];
        }

        $getToken = $this->paytr->iframe->getToken($paytr_params);

        if ($getToken['status'] == 'success') {
            $transaction = [
                'order_id' => $order_info['order_id'],
                'merchant_oid' => $merchant_oid,
                'total' => $total,
                'is_failed' => 0,
                'is_complete' => 0
            ];

            $this->load->model('extension/paytr_havale_eft/payment/paytr_checkout');
            if ($this->model_extension_paytr_havale_eft_payment_paytr_checkout->addTransaction($transaction)) {
                $data['iframe_token'] = $getToken['iframe_token'];
            } else {
                $data['error'] = $this->language->get('error_paytr_checkout_transaction_save');
            }
        } else {
            $data['error'] = $this->language->get('error_paytr_iframe_failed') . $getToken['status_message'];
        }

        return $data;
    }

    protected function getIp(): string {
        return $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
    }
}
