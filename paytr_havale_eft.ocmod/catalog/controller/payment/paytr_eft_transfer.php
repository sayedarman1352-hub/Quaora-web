<?php

namespace Opencart\Catalog\Controller\Extension\PaytrHavaleEft\Payment;

require_once DIR_EXTENSION . 'paytr_havale_eft/system/PaytrCore.php';
use PaytrCore;

class PaytrEftTransfer extends \Opencart\System\Engine\Controller
{
    private PaytrCore $paytr;
    private $oc_version = 'PAYTROC4';

    public function __construct($registry)
    {
        parent::__construct($registry);
        $this->paytr = new PaytrCore($registry);
    }

    public function index(): string
    {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_eft_transfer');

        $data = $this->getEftToken();
        $data['help_bank'] = $this->language->get('help_bank');
        $data['button_confirm'] = $this->language->get('button_confirm');

        return $this->load->view('extension/paytr_havale_eft/payment/paytr_eft_transfer', $data);
    }

    public function confirm(): void
    {
        $json = [];

        if (isset($this->session->data['payment_method']) && $this->session->data['payment_method']['code'] == 'paytr_eft_transfer.payment') {
            $this->load->model('checkout/order');

            $order_status = $this->config->get('payment_paytr_eft_transfer_order_completed_id');
            $note = 'PAYTR SİSTEM NOTU - EFT / Havale Bekleniyor';

            $this->model_checkout_order->addHistory($this->session->data['order_id'], $order_status, $note, false);

            $json['redirect'] = $this->url->link('checkout/success', '', true);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function callback(): void
    {
        if (empty($_POST)) {
            echo '';
            exit;
        }

        $this->load->model('checkout/order');

        if (isset($_POST['payment_type']) && $_POST['payment_type'] == 'eft') {
            $this->paytr->chkHash($_POST, 'eft');
            $this->load->language('extension/paytr_havale_eft/payment/paytr_eft_transfer');
            $this->paytr->eftCallback($_POST, $this->oc_version);
        }
    }

    public function notification(): void
    {
        if (empty($_POST)) {
            echo '';
            exit;
        }
        $this->paytr->eftNotification($_POST);
    }

    protected function getEftToken(): array
    {
        $this->load->model('checkout/order');
        $this->load->model('localisation/currency');

        $data = [];
        if (!isset($this->session->data['order_id'])) {
            return $data;
        }

        $order_info = $this->model_checkout_order->getOrder($this->session->data['order_id']);

        $paytr_params = [
            'merchant_id'    => $this->config->get('payment_paytr_eft_transfer_merchant_id'),
            'merchant_key'   => $this->config->get('payment_paytr_eft_transfer_merchant_key'),
            'merchant_salt'  => $this->config->get('payment_paytr_eft_transfer_merchant_salt'),
            'user_ip'        => $this->getIp(),
            'email'          => $order_info['email'],
            'merchant_oid'   => uniqid() . $this->oc_version . $order_info['order_id'],
            'payment_amount' => $this->currency->format($order_info['total'], $order_info['currency_code'], $order_info['currency_value'], false) * 100,
            'test_mode'      => $this->config->get('payment_paytr_eft_transfer_test_mode'),
            'timeout_limit'  => 30
        ];

        if (function_exists('curl_version')) {
            $getToken = $this->paytr->eft->getToken($paytr_params);

            if ($getToken['status'] == 'success') {
                $transaction = [
                    'order_id'     => $order_info['order_id'],
                    'merchant_oid' => $paytr_params['merchant_oid'],
                    'total'        => $this->currency->format($order_info['total'], $order_info['currency_code'], $order_info['currency_value'], false),
                    'is_failed'    => 0,
                    'is_complete'  => 0
                ];

                try {
                    $this->load->model('extension/paytr_havale_eft/payment/paytr_eft_transfer');
                    if ($this->model_extension_paytr_havale_eft_payment_paytr_eft_transfer->addTransaction($transaction)) {
                        $data['eft_token'] = $getToken['eft_token'];
                    } else {
                        $data['error'] = $this->language->get('error_paytr_eft_transfer_transaction_save');
                    }
                } catch (\Exception $e) {
                    $data['error'] = 'Database error: ' . $e->getMessage();
                }
            } else {
                $data['error'] = $this->language->get('error_paytr_iframe_failed') . $getToken['status_message'];
            }
        } else {
            $data['error'] = $this->language->get('error_paytr_eft_transfer_curl');
        }

        return $data;
    }

    protected function getIp(): string
    {
        return $_SERVER["HTTP_CLIENT_IP"] ?? $_SERVER["HTTP_X_FORWARDED_FOR"] ?? $_SERVER["REMOTE_ADDR"];
    }
}
