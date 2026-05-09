<?php

namespace Opencart\Catalog\Model\Extension\PaytrHavaleEft\Payment;

use Opencart\System\Engine\Model;

class PaytrEftTransfer extends Model
{
    public function getMethods(array $address): array
    {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_eft_transfer');

        if (!$this->getStatus($address)) {
            return [];
        }

        return [
            'code'       => 'paytr_eft_transfer',
            'name'       => $this->language->get('text_title'),
            'sort_order' => $this->config->get('payment_paytr_eft_transfer_sort_order'),
            'option'     => [
                'payment' => [
                    'code' => 'paytr_eft_transfer.payment',
                    'name' => $this->language->get('text_title'),
                ]
            ],
        ];
    }

    private function getStatus(array $address): bool
    {
        if (!$this->config->get('payment_paytr_eft_transfer_status')) {
            return false;
        }

        $this->load->model('checkout/order');
        $total = $this->getTotal();

        if ($this->config->get('payment_paytr_eft_transfer_total') > $total) {
            return false;
        }

        $geo_zone_id = (int)$this->config->get('payment_paytr_eft_transfer_geo_zone_id');
        if (!$geo_zone_id) {
            return true;
        }

        $query = $this->db->query("SELECT * FROM `" . DB_PREFIX . "zone_to_geo_zone` WHERE `geo_zone_id` = '" . $geo_zone_id . "' AND `country_id` = '" . (int)$address['country_id'] . "' AND (`zone_id` = '" . (int)$address['zone_id'] . "' OR `zone_id` = '0')");

        if ($query->num_rows) {
            return true;
        }

        return false;
    }

    private function getTotal(): float
    {
        if (isset($this->session->data['order_id'])) {
            $order_info = $this->model_checkout_order->getOrder($this->session->data['order_id']);
            if ($order_info) {
                return (float)$order_info['total'];
            }
        }

        $totals = [];
        $taxes = $this->cart->getTaxes();
        $total = 0;

        $this->load->model('checkout/cart');
        if (isset($this->model_checkout_cart) && is_callable([$this->model_checkout_cart, 'getTotals'])) {
             ($this->model_checkout_cart->getTotals)($totals, $taxes, $total);
        }

        return $total;
    }

    public function addTransaction(array $data): bool
    {
        $this->db->query("INSERT INTO `" . DB_PREFIX . "paytr_eft_transaction` SET order_id = '" . (int)$data['order_id'] . "', merchant_oid = '" . $this->db->escape($data['merchant_oid']) . "', total = '" . (float)$data['total'] . "', is_failed = '" . (int)$data['is_failed'] . "', is_complete = '" . (int)$data['is_complete'] . "', date_added = NOW()");
        return true;
    }
}
