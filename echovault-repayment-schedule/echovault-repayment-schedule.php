<?php
/**
 * Plugin Name: EchoVault Loan Schedule API
 * Description: Provides a REST endpoint that computes loan repayment schedules on the server.
 * Version:     2.0.0
 * Author:      EchoVault
 * Text Domain: echovault-loan-schedule
 */

if (!defined('ABSPATH')) {
    exit;
}

register_activation_hook(__FILE__, static function () {
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, static function () {
    flush_rewrite_rules();
});

final class EchoVault_Loan_Schedule_API {
    private const ROUTE_NAMESPACE = 'echovault/v2';
    private const ROUTE           = '/calculate-schedule';
    private const TEST_ROUTE      = '/test';

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('rest_api_init', [$this, 'enable_cors'], 5);
    }

    public function enable_cors(): void {
        // Handle CORS headers for our routes
        add_filter('rest_pre_serve_request', static function ($served, $result, $request) {
            $route = $request->get_route();
            if (strpos($route, self::ROUTE_NAMESPACE) === 0) {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
                header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
                
                // Handle OPTIONS preflight requests
                if ($request->get_method() === 'OPTIONS') {
                    status_header(200);
                    exit(0);
                }
            }
            return $served;
        }, 10, 3);
    }

    public function register_routes(): void {
        // Main calculation endpoint
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::ROUTE,
            [
                'methods'             => ['POST', 'OPTIONS'],
                'callback'            => [$this, 'handle_request'],
                'permission_callback' => '__return_true',
            ]
        );

        // Test endpoint for connection verification
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::TEST_ROUTE,
            [
                'methods'             => ['GET', 'OPTIONS'],
                'callback'            => [$this, 'handle_test'],
                'permission_callback' => '__return_true',
            ]
        );
    }

    public function handle_test(WP_REST_Request $request): WP_REST_Response {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }

        return new WP_REST_Response(
            [
                'success' => true,
                'message' => 'EchoVault Loan Schedule API is active',
                'version' => '2.0.0',
                'endpoint' => self::ROUTE_NAMESPACE . self::ROUTE,
            ],
            200
        );
    }

    public function handle_request(WP_REST_Request $request): WP_REST_Response {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }

        $data = $this->sanitize($request);
        $this->validate($data);

        $schedule = $this->build_schedule($data);
        $summary  = $this->build_summary($schedule, $data['loan_amount']);

        return new WP_REST_Response(
            [
                'success'  => true,
                'schedule' => $schedule,
                'summary'  => $summary,
            ],
            200
        );
    }

    private function sanitize(WP_REST_Request $request): array {
        return [
            'loan_amount'         => floatval($request->get_param('loan_amount')),
            'loan_term'           => intval($request->get_param('loan_term')),
            'loan_interest'       => floatval($request->get_param('loan_interest')),
            'repayment_method'    => sanitize_text_field($request->get_param('repayment_method')),
            'repayment_frequency' => sanitize_text_field($request->get_param('repayment_frequency')),
            'start_date'          => sanitize_text_field($request->get_param('start_date')),
        ];
    }

    private function validate(array $payload): void {
        if ($payload['loan_amount'] <= 0) {
            throw new WP_REST_Exception('invalid_amount', 'Loan amount must be greater than 0.', ['status' => 400]);
        }
        if ($payload['loan_term'] <= 0) {
            throw new WP_REST_Exception('invalid_term', 'Loan term must be greater than 0.', ['status' => 400]);
        }
        if ($payload['loan_interest'] < 0) {
            throw new WP_REST_Exception('invalid_interest', 'Interest rate cannot be negative.', ['status' => 400]);
        }
        if (!in_array($payload['repayment_method'], ['Equal Principal', 'Equal Total', 'Interest-Only'], true)) {
            throw new WP_REST_Exception('invalid_method', 'Unsupported repayment method.', ['status' => 400]);
        }
        if (!in_array($payload['repayment_frequency'], ['Weekly', 'Fortnightly', 'Monthly'], true)) {
            throw new WP_REST_Exception('invalid_frequency', 'Unsupported repayment frequency.', ['status' => 400]);
        }
        $date = DateTime::createFromFormat('Y-m-d', $payload['start_date']);
        if (!$date || $date->format('Y-m-d') !== $payload['start_date']) {
            throw new WP_REST_Exception('invalid_date', 'Start date must be YYYY-MM-DD.', ['status' => 400]);
        }
    }

    private function build_schedule(array $payload): array {
        $principal = $payload['loan_amount'];
        $periods   = $this->period_count($payload['loan_term'], $payload['repayment_frequency']);
        $rate      = $this->rate_per_period($payload['loan_interest'], $payload['repayment_frequency']);

        if ($periods <= 0 || $principal <= 0) {
            return [];
        }

        $rows    = [];
        $balance = $principal;
        $start   = new DateTime($payload['start_date']);

        if ($payload['repayment_method'] === 'Equal Total') {
            $payment = $rate == 0
                ? $principal / $periods
                : ($principal * $rate) / (1 - pow(1 + $rate, -$periods));

            for ($i = 0; $i < $periods; $i++) {
                $interest       = $balance * $rate;
                $principal_paid = min($payment - $interest, $balance);
                $balance        = max(0, $balance - $principal_paid);

                $rows[] = $this->row($i, $start, $payload['repayment_frequency'], $payment, $principal_paid, $interest, $balance);
            }
        } elseif ($payload['repayment_method'] === 'Interest-Only') {
            $interest_only = $balance * $rate;
            for ($i = 0; $i < $periods - 1; $i++) {
                $rows[] = $this->row($i, $start, $payload['repayment_frequency'], $interest_only, 0, $interest_only, $balance);
            }
            $rows[] = $this->row($periods - 1, $start, $payload['repayment_frequency'], $interest_only + $balance, $balance, $interest_only, 0);
        } else {
            $principal_per_period = $principal / $periods;
            for ($i = 0; $i < $periods; $i++) {
                $interest = $balance * $rate;
                $payment  = $principal_per_period + $interest;
                $balance  = max(0, $balance - $principal_per_period);

                $rows[] = $this->row($i, $start, $payload['repayment_frequency'], $payment, $principal_per_period, $interest, $balance);
            }
        }

        return array_values($rows);
    }

    private function row(int $index, DateTime $start, string $frequency, float $payment, float $principal, float $interest, float $balance): array {
        $date = clone $start;
        switch ($frequency) {
            case 'Weekly':
                $date->modify('+' . ($index + 1) * 7 . ' days');
                break;
            case 'Fortnightly':
                $date->modify('+' . ($index + 1) * 14 . ' days');
                break;
            default:
                $date->modify('+' . ($index + 1) . ' months');
        }

        return [
            'idx'       => $index + 1,
            'date'      => $date->format('c'),
            'payment'   => round($payment, 2),
            'principal' => round($principal, 2),
            'interest'  => round($interest, 2),
            'balance'   => round($balance, 2),
        ];
    }

    private function build_summary(array $schedule, float $principal): array {
        return [
            'total_payments' => count($schedule),
            'total_principal'=> round($principal, 2),
            'total_interest' => round(array_sum(array_column($schedule, 'interest')), 2),
            'total_paid'     => round(array_sum(array_column($schedule, 'payment')), 2),
        ];
    }

    private function period_count(int $months, string $frequency): int {
        switch ($frequency) {
            case 'Weekly':
                return (int) ceil(($months * 52) / 12);
            case 'Fortnightly':
                return (int) ceil(($months * 26) / 12);
            default:
                return $months;
        }
    }

    private function rate_per_period(float $annual_percent, string $frequency): float {
        $annual = $annual_percent / 100;
        switch ($frequency) {
            case 'Weekly':
                return $annual / 52;
            case 'Fortnightly':
                return $annual / 26;
            default:
                return $annual / 12;
        }
    }
}

new EchoVault_Loan_Schedule_API();

