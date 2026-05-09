<?php

namespace Opencart\Admin\Controller\Extension\PaytrHavaleEft\Payment;

require_once DIR_EXTENSION . 'paytr_havale_eft/system/PaytrCore.php';
use PaytrCore;

class PaytrEftTransfer extends \Opencart\System\Engine\Controller
{
    private PaytrCore $paytr;

    public function __construct($registry)
    {
        parent::__construct($registry);
        $this->paytr = new PaytrCore($registry);
    }

    public function index(): void
    {
        // Load Language
        $this->load->language('extension/paytr_havale_eft/payment/paytr_eft_transfer');
        // Load Models
        $this->load->model('setting/setting');
        $this->load->model('localisation/order_status');

        // Set Page Title
        $this->document->setTitle($this->language->get('heading_title'));

        // All Language Keys
        $keys = [
            'heading_title', 'text_settings', 'text_general', 'text_order_status',
            'text_enabled', 'text_disabled', 'text_select', 'entry_merchant_id',
            'entry_merchant_key', 'entry_merchant_salt', 'entry_total', 'entry_status',
            'entry_sort_order', 'entry_payment_complete', 'entry_payment_failed',
            'entry_notify_status', 'help_paytr_eft_transfer', 'help_total', 'help_notify',
            'entry_test_mode', 'entry_test_mode_on', 'entry_test_mode_off',
            'button_save', 'button_back'
        ];

        // Set Language Keys
        foreach ($keys as $key) {
            $data[$key] = $this->language->get($key);
        }

        // Frontend Buttons
        $data['back'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=payment');
        $data['save'] = $this->url->link('extension/paytr_havale_eft/payment/paytr_eft_transfer.save', 'user_token=' . $this->session->data['user_token']);
        $data['user_token'] = $this->request->get['user_token'];

        // Breadcrumbs
        $data['breadcrumbs'] = [
            [
                'text' => $this->language->get('text_home'),
                'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true),
            ],
            [
                'text' => $this->language->get('text_extensions'),
                'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'], true),
            ],
            [
                'text' => $this->language->get('heading_title'),
                'href' => $this->url->link('extension/paytr_havale_eft/payment/paytr_eft_transfer', 'user_token=' . $this->session->data['user_token'], true),
            ],
        ];

        // Get Order Statuses
        $data['order_statuses'] = $this->model_localisation_order_status->getOrderStatuses();

        // Get Input Fields
        $fields = [
            'merchant_id', 'merchant_key', 'merchant_salt', 'test_mode', 'total', 'status', 'sort_order',
            'order_completed_id', 'order_canceled_id', 'notify'
        ];

        // Returns Fields and Fetches for Config
        foreach ($fields as $field) {
            $key = 'payment_paytr_eft_transfer_' . $field;
            $data[$key] = isset($this->request->post[$key])
                ? trim($this->request->post[$key])
                : $this->config->get($key);
        }

        // Template Parts
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        // Return Response
        $this->response->setOutput($this->load->view('extension/paytr_havale_eft/payment/paytr_eft_transfer', $data));
    }

    public function save(): void
    {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_eft_transfer');

        if (!$this->user->hasPermission('modify', 'extension/paytr_havale_eft/payment/paytr_eft_transfer')) {
            $json['error'] = $this->language->get('error_permission');
        } else {
            $json = [];

            if (!$this->request->post['payment_paytr_eft_transfer_merchant_id']) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_id');
            } elseif (!is_numeric($this->request->post['payment_paytr_eft_transfer_merchant_id'])) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_id_val');
            } elseif (!$this->request->post['payment_paytr_eft_transfer_merchant_key']) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_key');
            } elseif (strlen($this->request->post['payment_paytr_eft_transfer_merchant_key']) != 16) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_key_len');
            } elseif (!$this->request->post['payment_paytr_eft_transfer_merchant_salt']) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_salt');
            } elseif (strlen($this->request->post['payment_paytr_eft_transfer_merchant_salt']) != 16) {
                $json['error'] = $this->language->get('error_paytr_eft_transfer_merchant_salt_len');
            }

            if (empty($json)) {
                $this->load->model('setting/setting');
                $this->model_setting_setting->editSetting('payment_paytr_eft_transfer', $this->request->post);
                $json['success'] = $this->language->get('text_success');
            }
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function install(): void
    {
        $this->load->model('setting/setting');
        $this->load->model('extension/paytr_havale_eft/payment/paytr_eft_transfer');

        $data['payment_paytr_eft_transfer_notify'] = '0';
        $data['payment_paytr_eft_transfer_test_mode'] = '1';
        $data['payment_paytr_eft_transfer_total'] = '1';
        $data['payment_paytr_eft_transfer_order_completed_id'] = '1';
        $data['payment_paytr_eft_transfer_order_canceled_id'] = '10';
        $data['payment_paytr_eft_transfer_sort_order'] = '1';

        $this->model_extension_paytr_havale_eft_payment_paytr_eft_transfer->install();
        $this->model_setting_setting->editSetting('payment_paytr_eft_transfer', $data);
    }

    public function uninstall(): void
    {
        $this->load->model('setting/setting');
        $this->load->model('extension/paytr_havale_eft/payment/paytr_eft_transfer');

        $this->model_extension_paytr_havale_eft_payment_paytr_eft_transfer->uninstall();
        $this->model_setting_setting->deleteSetting('payment_paytr_eft_transfer');
    }
}
