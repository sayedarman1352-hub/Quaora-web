<?php
class ModelExtensionPaymentPaytrIframe extends Model {
    public function getMethod($address, $total) {
        $this->load->language('extension/payment/paytr_iframe');

        if (!$this->config->get('payment_paytr_iframe_status')) {
            return array();
        }

        if ($this->config->get('payment_paytr_iframe_total') > 0 && $this->config->get('payment_paytr_iframe_total') > $total) {
            return array();
        }

        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "zone_to_geo_zone WHERE geo_zone_id = '" . (int)$this->config->get('payment_paytr_iframe_geo_zone_id') . "' AND country_id = '" . (int)$address['country_id'] . "' AND (zone_id = '" . (int)$address['zone_id'] . "' OR zone_id = '0')");

        if ($this->config->get('payment_paytr_iframe_geo_zone_id') && !$query->num_rows) {
            return array();
        }

        return array(
            'code' => 'paytr_iframe',
            'title' => $this->language->get('text_title'),
            'terms' => '',
            'sort_order' => $this->config->get('payment_paytr_iframe_sort_order')
        );
    }
}
