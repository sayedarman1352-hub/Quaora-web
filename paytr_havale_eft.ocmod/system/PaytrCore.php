<?php

require_once DIR_EXTENSION . 'paytr_havale_eft/system/Transaction.php';
require_once DIR_EXTENSION . 'paytr_havale_eft/system/Refund.php';
require_once DIR_EXTENSION . 'paytr_havale_eft/system/Hash.php';
require_once DIR_EXTENSION . 'paytr_havale_eft/system/Iframe.php';
require_once DIR_EXTENSION . 'paytr_havale_eft/system/Eft.php';

class PaytrCore
{
    private $registry;
    private $logger;
    private $db;
    private $config;
    private $load;
    private $currency;
    private $language;

    public $transaction;
    public $refund;
    public $iframe;
    public $eft;

    public function __construct($registry)
    {
        $this->registry = $registry;
        $this->logger = $registry->get('log');
        $this->db = $registry->get('db');
        $this->config = $registry->get('config');
        $this->load = $registry->get('load');
        $this->currency = $registry->get('currency');
        $this->language = $registry->get('language');
        $this->transaction = new Transaction();
        $this->transaction->db = $this->db;
        $this->transaction->logger = $this->logger;
        $this->refund = new Refund();
        $this->refund->db = $this->db;
        $this->refund->logger = $this->logger;
        $this->iframe = new Iframe();
        $this->iframe->db = $this->db;
        $this->iframe->logger = $this->logger;
        $this->iframe->config = $this->config;
        $this->eft = new Eft();
        $this->eft->db = $this->db;
        $this->eft->logger = $this->logger;
        $this->eft->config = $this->config;
    }

    public function installmentOptions($lang, $category_based = false): array
    {
        $options = [
            0 => $lang == 'tr' ? "Tüm Taksit Seçenekleri" : "All Installment Options",
            1 => $lang == 'tr' ? "Tek Çekim (Taksit Yok)" : "One Shot (No Installment)"
        ];

        for ($i = 2; $i <= 12; $i++) {
            $options[$i] = $lang == 'tr'
                ? "$i Taksit'e kadar"
                : "Up to $i Installments";
        }

        if ($category_based) {
            $options[13] = $lang == 'tr' ? 'KATEGORİ BAZLI' : 'CATEGORY BASED';
        }

        return $options;
    }

    public function categoryParser($lang_id): array
    {
        $query = $this->db->query("SELECT c.category_id AS 'id',  c.parent_id AS 'parent_id', cd.name AS 'name' FROM " . DB_PREFIX . "category c LEFT JOIN " . DB_PREFIX . "category_description cd ON (c.category_id = cd.category_id) WHERE cd.language_id = '" . (int)$lang_id . "' ORDER BY c.sort_order, cd.name ASC");
        $categories = $query->rows;
        $category_tree = array();
        foreach ($categories as $key => $item) {
            if ($item['parent_id'] == 0) {
                $category_tree[$item['id']] = array('id' => $item['id'], 'name' => $item['name']);
                $this->parentCategoryParser($categories, $category_tree[$item['id']]);
            }
        }

        return $category_tree;
    }

    public function categoryParserClear($tree, $level = 0, $arr = array(), &$finish_him = array()): void
    {
        foreach ($tree as $id => $item) {
            if ($level <= 2) {
                // Initialize or update the navigation path
                if ($level == 0) {
                    $arr = [$item['name']];
                } else {
                    // Limit the depth to 3 levels, removing the deepest level if necessary
                    if (count($arr) >= $level + 1) {
                        array_pop($arr);
                    }
                    $arr[] = $item['name'];
                }

                // Create navigation string
                $nav = implode(' > ', $arr);
                $finish_him[$item['id']] = $nav . '<br>';

                // Recursively process child categories
                if (isset($item['parent']) && !empty($item['parent'])) {
                    $this->categoryParserClear($item['parent'], $level + 1, $arr, $finish_him);
                }
            }
        }
    }

    protected function parentCategoryParser(&$categories = array(), &$category_tree = array()): void
    {
        foreach ($categories as $item) {
            if ($item['parent_id'] == $category_tree['id']) {
                $category_tree['parent'][$item['id']] = [
                    'id' => $item['id'],
                    'name' => $item['name']
                ];
                $this->parentCategoryParser($categories, $category_tree['parent'][$item['id']]);
            }
        }
    }

    public function eftCallback($params, $version)
    {
        $model_checkout_order = $this->registry->get('model_checkout_order');

        $order_id = explode($version, $params['merchant_oid']);
        $order = $model_checkout_order->getOrder($order_id[1]);

        if (!$order) {

            echo 'OK';
            exit;
        }

        $paytr_transaction = $this->transaction->getTransactionByMerchantOID($params['merchant_oid'], 'eft');

        if (!$paytr_transaction || !$paytr_transaction['is_order']) {

            echo 'OK';
            exit;
        }

        $merchant['id'] = $this->config->get('payment_paytr_eft_transfer_merchant_id');
        $merchant['key'] = $this->config->get('payment_paytr_eft_transfer_merchant_key');
        $merchant['salt'] = $this->config->get('payment_paytr_eft_transfer_merchant_salt');

        $completedStatus = $this->config->get('payment_paytr_eft_transfer_order_completed_id');
        $canceledStatus = $this->config->get('payment_paytr_eft_transfer_order_canceled_id');
        $notifyStatus = $this->config->get('payment_paytr_eft_transfer_notify');

        $transaction = array();
        $transaction['merchant_oid'] = $params['merchant_oid'];

        if ($params['status'] == 'success') {
            $transaction['status'] = $params['status'];
            $transaction['status_message'] = 'completed';
            $transaction['total_paid'] = $params['total_amount'];

            $note_params = array(
                'status' => $params['status'],
                'merchant_oid' => $params['merchant_oid'],
                'total_amount' => $params['total_amount'],
                'currency_code' => $order['currency_code'],
                'currency_value' => $order['currency_value'],
            );

            try {
                $note = $this->callbackNote($note_params, 0, 'eft');

                // Update Transaction Table
                $this->transaction->updateTransactionForCallback($transaction, 'eft');

                // Add Order History
                $model_checkout_order->addHistory($order['order_id'], $completedStatus, $note, $notifyStatus);
            } catch (Exception $exception) {
                echo $exception->getMessage();
                exit;
            }

            echo 'OK';
            exit;
        } else {

            // Transaction
            $transaction['status'] = $params['status'];
            $transaction['status_message'] = $params['failed_reason_code'] . " - " . $params['failed_reason_msg'];
            $transaction['is_complete'] = 1;
            $transaction['total_paid'] = 0;

            if (array_key_exists('failed_reason_code', $params) and $params['failed_reason_code'] != 6) {

                if ($paytr_transaction['status'] == 'success') {

                    // Two attempts have been made with the incoming merchant_oid. 1st attempt failed. Run here if the failed notification comes after the successful notification.
                    $addTransaction['order_id'] = $order['order_id'];
                    $addTransaction['merchant_oid'] = $params['merchant_oid'];
                    $addTransaction['total'] = $this->currency->format($order['total'], $order['currency_code'], $order['currency_value'], false);
                    $addTransaction['is_failed'] = 1;
                    $addTransaction['is_complete'] = 1;
                    $addTransaction['status'] = $transaction['status'];
                    $addTransaction['status_message'] = $transaction['status_message'];

                    $this->transaction->addTransactionForCallback($addTransaction, 'eft');
                } else {

                    // Update Transaction Table
                    $this->transaction->updateTransactionForCallback($transaction, 'eft');
                }

                $note = $this->callbackNote($params, 0, 'eft');

                // Add Order History
                $model_checkout_order->addHistory($order['order_id'], $canceledStatus, $note, 0);
            }

            echo 'OK';
            exit;
        }
    }

    public function eftNotification($params)
    {
        $merchant['merchant_key'] = $this->config->get('payment_paytr_eft_transfer_merchant_key');
        $merchant['merchant_salt'] = $this->config->get('payment_paytr_eft_transfer_merchant_salt');

        $hash = base64_encode(hash_hmac('sha256', $params['merchant_oid'] . $params['bank'] . $merchant['merchant_salt'], $merchant['merchant_key'], true));

        if ($hash != $_POST['hash']) {
            die('PAYTR notification failed: bad hash');
        }

        $transaction = array();
        $note = '';

        // Note Start
        $note .= '<div class="paytr-note">';
        $note .= '<div class="paytr-note_title">PAYTR SİSTEM NOTU - <span class="paytr-note_status_title status-info">Bildirim Yapıldı</span></div>';
        $note .= '<div class="paytr-note_sub_title"><span>Banka</span>: ' . $params['bank'] . '</div>';
        $note .= '<div class="paytr-note_sub_title"><span>Ad Soyad</span>: ' . $params['user_name'] . '</div>';
        $note .= '<div class="paytr-note_sub_title"><span>Telefon</span>: ' . $params['user_phone'] . '</div>';
        $note .= '<div class="paytr-note_sub_title"><span>Tarih</span>: ' . $params['payment_sent_date'] . '</div>';
        $note .= '<div class="paytr-note_sub_title"><span>PayTR Sipariş No</span>: ' . $params['merchant_oid'] . '</div>';
        $note .= '</div>';
        // Note End

        $transaction['status'] = $params['status'];
        $transaction['merchant_oid'] = $params['merchant_oid'];
        $transaction['notify_message'] = $note;

        $this->transaction->updateTransactionForEftNotify($transaction);

        echo 'OK';
        exit;
    }

    public function iframeCallback($params, $version)
    {
        $model_checkout_order = $this->registry->get('model_checkout_order');

        $order_id = explode($version, $params['merchant_oid']);
        $order = $model_checkout_order->getOrder($order_id[1]);

        if (!$order) {
            echo 'OK';
            exit;
        }

        $paytr_transaction = $this->transaction->getTransactionByMerchantOIDByFailed($params['merchant_oid'], 'iframe');

        if (count($paytr_transaction)) {
            echo 'OK';
            exit;
        }

        $merchant['id'] = $this->config->get('payment_paytr_checkout_merchant_id');
        $merchant['key'] = $this->config->get('payment_paytr_checkout_merchant_key');
        $merchant['salt'] = $this->config->get('payment_paytr_checkout_merchant_salt');

        $completedStatus = $this->config->get('payment_paytr_checkout_order_completed_id');
        $canceledStatus = $this->config->get('payment_paytr_checkout_order_canceled_id');

        $transaction = array();
        $transaction['merchant_oid'] = $params['merchant_oid'];

        if ($params['status'] == 'success') {

            $notifyStatus = $this->config->get('payment_paytr_checkout_notify');

            $total_amount = $params['total_amount'];

            $transaction['status'] = $params['status'];
            $transaction['status_message'] = 'completed';
            $transaction['is_complete'] = 1;
            $transaction['total_paid'] = ($total_amount / 100);

            $note_params = array(
                'status' => $params['status'],
                'merchant_oid' => $params['merchant_oid'],
                'total_amount' => $total_amount,
                'currency_code' => $order['currency_code'],
                'currency_value' => $order['currency_value'],
            );

            $note = $this->callbackNote($note_params, 'iframe');

            // Update Transaction Table
            $this->transaction->updateTransactionForCallback($transaction, 'iframe');

            // Add Order History
            $model_checkout_order->addHistory($order['order_id'], $completedStatus, $note, $notifyStatus);

            echo 'OK';
            exit;
        } else {

            // Transaction
            $transaction['status'] = $params['status'];
            $transaction['status_message'] = $params['failed_reason_code'] . " - " . $params['failed_reason_msg'];
            $transaction['is_complete'] = 1;
            $transaction['total_paid'] = 0;

            if ($order['order_status_id'] != 0) {
                if (array_key_exists('failed_reason_code', $params) and $params['failed_reason_code'] != 6) {
                    if ($paytr_transaction['status'] == 'success') {

                        // Two attempts have been made with the incoming merchant_oid. 1st attempt failed. Run here if the failed notification comes after the successful notification.
                        $addTransaction['order_id'] = $order['order_id'];
                        $addTransaction['merchant_oid'] = $params['merchant_oid'];
                        $addTransaction['total'] = ($order['total'] / 100) . ' ' . $order['currency_code'];
                        $addTransaction['is_failed'] = 1;
                        $addTransaction['is_complete'] = 1;
                        $addTransaction['status'] = $transaction['status'];
                        $addTransaction['status_message'] = $transaction['status_message'];

                        $this->transaction->addTransactionForCallback($addTransaction, 'iframe');
                    } else {

                        // The transaction was made with the incoming merchant oid, but it was not completed successfully.
                        // Unsuccessful transaction. Just mirror it to the paytr_transaction table.

                        // Update Transaction Table
                        $this->transaction->updateTransactionForCallback($transaction, 'iframe');
                    }
                }

                echo 'OK';
                exit;
            } else {

                if (array_key_exists('failed_reason_code', $params) and $params['failed_reason_code'] != 6) {

                    $note = $this->callbackNote($params, 0, 'iframe');

                    // Update Transaction Table
                    $this->transaction->updateTransactionForCallback($transaction, 'iframe');

                    // Add Order History
                    $model_checkout_order->addHistory($order['order_id'], $canceledStatus, $note, 0);
                }

                echo 'OK';
                exit;
            }
        }
    }

    protected function callbackNote($params, $api_name): string
    {
        $note = '';
        $title = '';
        $amount_title = '';
        $amount_status = '';
        $installment_title = '';

        if ($params['status'] == 'success') {
            $title = '<span class="paytr-note_status_title status-success">Ödeme Onaylandı.</span>';
            $amount_title = '<div class="paytr-note_sub_title"><span>Ödeme Tutarı</span>: ' . ($params['total_amount'] / 100) . ' ' . $params['currency_code'] . '</div>';

            if ($api_name == 'iframe') {

                if (array_key_exists('installment_count', $params)) {

                    $installment_title .= '<div class="paytr-note_sub_title"><span>Taksit Sayısı</span>: ' . ($params['installment_count'] == 1 ? 'Tek Çekim' : $params['installment_count']) . '</div>';
                }
            }
        }

        if ($params['status'] == 'failed') {
            $title = '<span class="paytr-note_status_title status-danger">Ödeme Başarısız.</span>';
            $amount_title = '<div class="paytr-note_sub_title"><span>Ödeme Durumu</span>: Başarısız.</div>';
            $amount_status = '<div class="paytr-note_sub_title"><span>Ödeme Hatası</span>: ' . $params['failed_reason_msg'] . '</div>';
        }

        // Note Start
        $note .= '<div class="paytr-note">';
        $note .= '<div class="paytr-note_title">PAYTR SİSTEM NOTU - ' . $title . '</div>';
        $note .= $amount_title . '';
        $note .= $amount_status;
        $note .= $installment_title;
        $note .= '<div class="paytr-note_sub_title"><span>PayTR Sipariş No</span>: ' . $params['merchant_oid'] . '</div>';
        $note .= '</div>';
        // Note End

        return $note;
    }

    public function chkHash($params, $api_name)
    {
        if ($api_name == 'iframe') {
            $key = $this->config->get('payment_paytr_checkout_merchant_key');
            $salt = $this->config->get('payment_paytr_checkout_merchant_salt');
        }

        if ($api_name == 'eft') {
            $key = $this->config->get('payment_paytr_eft_transfer_merchant_key');
            $salt = $this->config->get('payment_paytr_eft_transfer_merchant_salt');
        }

        $created_hash = base64_encode(hash_hmac('sha256', $params['merchant_oid'] . $salt . $params['status'] . $params['total_amount'], $key, true));

        if ($created_hash != $params['hash']) {
            die('PAYTR notification failed: bad hash.');
        }

        return true;
    }

    protected function getOrderHistory($order_id, $order_status_id)
    {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "order_history WHERE order_id = '" . (int)$order_id . "' AND order_status_id = '" . (int)$order_status_id . "'");

        return $query->rows;
    }

    protected function editOrderTotal($order_id, $total)
    {
        // Edit total value in orders table.
        $this->db->query("UPDATE `" . DB_PREFIX . "order` SET total = '" . (float)$total . "', date_modified = NOW() WHERE order_id = '" . (int)$order_id . "'");
    }

    protected function editTotalItem($order_id, $total, $amount, $title)
    {
        // Edit total value in order_total table
        $this->db->query("UPDATE `" . DB_PREFIX . "order_total` SET value = '" . (float)$total . "' WHERE order_id = '" . (int)$order_id . "' AND code = 'total' ");

        // Add total value in order_total table
        $this->db->query("INSERT INTO `" . DB_PREFIX . "order_total` SET order_id = '" . (int)$order_id . "', code = 'paytr_checkout', title = '" . $this->db->escape($title) . "', value = '" . (float)$amount . "', sort_order = '4' ");
    }

    protected function editTotalValue($order_id, $total)
    {
        // Edit total value in order_total table
        $this->db->query("UPDATE `" . DB_PREFIX . "order_total` SET value = '" . (float)$total . "' WHERE order_id = '" . (int)$order_id . "' AND code = 'total' ");
    }
}
