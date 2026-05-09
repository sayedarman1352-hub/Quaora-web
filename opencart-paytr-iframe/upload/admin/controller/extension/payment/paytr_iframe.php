<?php
class ControllerExtensionPaymentPaytrIframe extends Controller {
    private $error = array();

    public function index() {
        $this->load->language('extension/payment/paytr_iframe');
        $this->document->setTitle($this->language->get('heading_title'));
        $this->load->model('setting/setting');

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            $this->model_setting_setting->editSetting('payment_paytr_iframe', $this->request->post);
            $this->session->data['success'] = $this->language->get('text_success');
            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=payment', true));
        }

        $data['heading_title'] = $this->language->get('heading_title');
        $data['text_edit'] = $this->language->get('text_edit');
        $data['text_enabled'] = $this->language->get('text_enabled');
        $data['text_disabled'] = $this->language->get('text_disabled');
        $data['button_save'] = $this->language->get('button_save');
        $data['button_cancel'] = $this->language->get('button_cancel');

        foreach (array(
            'entry_merchant_id', 'entry_merchant_key', 'entry_merchant_salt', 'entry_test_mode',
            'entry_debug_on', 'entry_no_installment', 'entry_max_installment', 'entry_total',
            'entry_order_status', 'entry_success_status', 'entry_failed_status', 'entry_geo_zone',
            'entry_status', 'entry_sort_order'
        ) as $key) {
            $data[$key] = $this->language->get($key);
        }

        $data['help_total'] = $this->language->get('help_total');
        $data['help_callback'] = sprintf($this->language->get('help_callback'), HTTPS_CATALOG . 'index.php?route=extension/payment/paytr_iframe/callback');

        foreach (array('warning', 'merchant_id', 'merchant_key', 'merchant_salt') as $key) {
            $data['error_' . $key] = isset($this->error[$key]) ? $this->error[$key] : '';
        }

        $data['breadcrumbs'] = array(
            array('text' => $this->language->get('text_home'), 'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)),
            array('text' => $this->language->get('text_extension'), 'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=payment', true)),
            array('text' => $this->language->get('heading_title'), 'href' => $this->url->link('extension/payment/paytr_iframe', 'user_token=' . $this->session->data['user_token'], true))
        );

        $data['action'] = $this->url->link('extension/payment/paytr_iframe', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=payment', true);

        $fields = array(
            'merchant_id' => '',
            'merchant_key' => '',
            'merchant_salt' => '',
            'test_mode' => 1,
            'debug_on' => 1,
            'no_installment' => 0,
            'max_installment' => 0,
            'total' => '0.00',
            'order_status_id' => 1,
            'success_status_id' => 2,
            'failed_status_id' => 10,
            'geo_zone_id' => 0,
            'status' => 0,
            'sort_order' => 0
        );

        foreach ($fields as $field => $default) {
            $key = 'payment_paytr_iframe_' . $field;
            $data[$key] = isset($this->request->post[$key]) ? $this->request->post[$key] : ($this->config->get($key) !== null ? $this->config->get($key) : $default);
        }

        $this->load->model('localisation/order_status');
        $data['order_statuses'] = $this->model_localisation_order_status->getOrderStatuses();

        $this->load->model('localisation/geo_zone');
        $data['geo_zones'] = $this->model_localisation_geo_zone->getGeoZones();

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/payment/paytr_iframe', $data));
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/payment/paytr_iframe')) {
            $this->error['warning'] = $this->language->get('error_permission');
        }

        if (empty($this->request->post['payment_paytr_iframe_merchant_id'])) {
            $this->error['merchant_id'] = $this->language->get('error_merchant_id');
        }

        if (empty($this->request->post['payment_paytr_iframe_merchant_key'])) {
            $this->error['merchant_key'] = $this->language->get('error_merchant_key');
        }

        if (empty($this->request->post['payment_paytr_iframe_merchant_salt'])) {
            $this->error['merchant_salt'] = $this->language->get('error_merchant_salt');
        }

        return !$this->error;
    }
}
