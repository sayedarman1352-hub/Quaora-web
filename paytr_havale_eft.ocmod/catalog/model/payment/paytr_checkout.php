<?php
namespace Opencart\Catalog\Model\Extension\PaytrHavaleEft\Payment;

use Opencart\System\Engine\Model;

class PaytrCheckout extends Model {
    public function getMethods(array $address): array {
        $this->load->language('extension/paytr_havale_eft/payment/paytr_checkout');

        if (!$this->getStatus($address)) {
            return [];
        }

        return [
            'code'       => 'paytr_checkout',
            'name'       => $this->language->get('text_title'),
            'sort_order' => $this->config->get('payment_paytr_checkout_sort_order'),
            'option'     => [
                'payment' => [
                    'code' => 'paytr_checkout.payment',
                    'name' => $this->language->get('text_title'),
                ]
            ],
        ];
    }

    private function getStatus(array $address): bool {
        if (!$this->config->get('payment_paytr_checkout_status')) {
            return false;
        }

        $this->load->model('checkout/order');
        $total = $this->getTotal();

        if ($this->config->get('payment_paytr_checkout_total') > $total) {
            return false;
        }

        return true;
    }

    private function getTotal(): float {
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

    public function addTransaction(array $data): bool {
        $this->db->query("INSERT INTO `" . DB_PREFIX . "paytr_iframe_transaction` SET order_id = '" . (int)$data['order_id'] . "', merchant_oid = '" . $this->db->escape($data['merchant_oid']) . "', total = '" . (float)$data['total'] . "', is_failed = '" . (int)$data['is_failed'] . "', is_complete = '" . (int)$data['is_complete'] . "', is_order = '1', date_added = NOW()");
        return true;
    }
}
