<?php
/**
 * Plugin Name: EchoVault Loan Schedule API
 * Description: Provides REST endpoints and storage for loan repayment schedules.
 * Version:     3.0.0
 * Author:      EchoVault
 * Text Domain: echovault-loan-schedule
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Create the custom repayment schedule table on plugin activation.
 */
register_activation_hook(__FILE__, static function () {
    global $wpdb;
    $table_name     = $wpdb->prefix . 'echovault_repayment_schedule';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        related_loan bigint(20) UNSIGNED NOT NULL,
        segment_start date NOT NULL,
        segment_end date NOT NULL,
        loan_days int(11) NOT NULL DEFAULT 0,
        start_balance decimal(15,2) NOT NULL DEFAULT 0.00,
        accrued_interest decimal(15,2) NOT NULL DEFAULT 0.00,
        scheduled_principal decimal(15,2) NOT NULL DEFAULT 0.00,
        scheduled_total_payment decimal(15,2) NOT NULL DEFAULT 0.00,
        paid_interest decimal(15,2) NOT NULL DEFAULT 0.00,
        paid_principles decimal(15,2) NOT NULL DEFAULT 0.00,
        total_payment decimal(15,2) NOT NULL DEFAULT 0.00,
        outstanding_interest decimal(15,2) NOT NULL DEFAULT 0.00,
        remain_balance decimal(15,2) NOT NULL DEFAULT 0.00,
        repayment_status varchar(50) NOT NULL DEFAULT 'Pending',
        repayment_note text,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY related_loan (related_loan),
        KEY segment_start (segment_start),
        KEY repayment_status (repayment_status)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
});

final class EchoVault_Loan_Schedule_API {
    private const ROUTE_NAMESPACE = 'echovault/v2';
    private const ROUTE           = '/calculate-schedule';
    private const TEST_ROUTE      = '/test';
    private const GENERATE_SCHEDULE_ROUTE = '/generate-repayment-schedule';
    private const REGISTER_PAYMENT_ROUTE  = '/register-payment';
    private const GET_SCHEDULE_ROUTE      = '/get-repayment-schedule';
    private const DELETE_SCHEDULE_ROUTE   = '/delete-repayment-schedule';
    private const REPAYMENT_SCHEDULE_POST_TYPE = 'repayment_schedule';
    
    /**
     * Get the custom table name for repayment schedule
     */
    private function get_table_name(): string {
        global $wpdb;
        return $wpdb->prefix . 'echovault_repayment_schedule';
    }

    public function __construct() {
        // Register REST API routes and CORS handling
        add_action('rest_api_init', [$this, 'register_routes'], 10);
        add_action('rest_api_init', [$this, 'enable_cors'], 15);

        // Generate schedule once, when key meta fields are present
        add_action('updated_post_meta', [$this, 'maybe_generate_schedule_from_meta'], 10, 4);

        // Admin UI for viewing repayment schedules
        add_action('admin_menu', [$this, 'add_admin_menu']);
        
        // Handle manual deletion from admin page
        add_action('admin_init', [$this, 'handle_manual_delete']);
    }

    /**
     * Ensure the custom repayment schedule table exists.
     * Kept as a safety net in case activation did not run cleanly.
     */
    private function ensure_table_exists(): void {
        global $wpdb;
        $table_name = $this->get_table_name();

        // Quick existence check
        $exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name));
        if ($exists === $table_name) {
            // Table exists, check if migration is needed
            $this->migrate_table_columns($table_name);
            return;
        }

        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            related_loan bigint(20) UNSIGNED NOT NULL,
            segment_start date NOT NULL,
            segment_end date NOT NULL,
            loan_days int(11) NOT NULL DEFAULT 0,
            start_balance decimal(15,2) NOT NULL DEFAULT 0.00,
            accrued_interest decimal(15,2) NOT NULL DEFAULT 0.00,
            scheduled_principal decimal(15,2) NOT NULL DEFAULT 0.00,
            scheduled_total_payment decimal(15,2) NOT NULL DEFAULT 0.00,
            paid_interest decimal(15,2) NOT NULL DEFAULT 0.00,
            paid_principles decimal(15,2) NOT NULL DEFAULT 0.00,
            total_payment decimal(15,2) NOT NULL DEFAULT 0.00,
            outstanding_interest decimal(15,2) NOT NULL DEFAULT 0.00,
            remain_balance decimal(15,2) NOT NULL DEFAULT 0.00,
            repayment_status varchar(50) NOT NULL DEFAULT 'Pending',
            repayment_note text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY related_loan (related_loan),
            KEY segment_start (segment_start),
            KEY repayment_status (repayment_status)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /**
     * Migrate table columns - add new columns if they don't exist
     */
    private function migrate_table_columns(string $table_name): void {
        global $wpdb;
        
        // Check if scheduled_principal column exists
        $column_exists = $wpdb->get_results($wpdb->prepare(
            "SHOW COLUMNS FROM $table_name LIKE %s",
            'scheduled_principal'
        ));
        
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $table_name ADD COLUMN scheduled_principal decimal(15,2) NOT NULL DEFAULT 0.00 AFTER accrued_interest");
            error_log("EchoVault: Added scheduled_principal column to $table_name");
        }
        
        // Check if scheduled_total_payment column exists
        $column_exists = $wpdb->get_results($wpdb->prepare(
            "SHOW COLUMNS FROM $table_name LIKE %s",
            'scheduled_total_payment'
        ));
        
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $table_name ADD COLUMN scheduled_total_payment decimal(15,2) NOT NULL DEFAULT 0.00 AFTER scheduled_principal");
            error_log("EchoVault: Added scheduled_total_payment column to $table_name");
        }
    }

    /**
     * Single meta-based trigger for generating a schedule.
     * Fires once when loan_amount, loan_term and start_date are all present.
     */
    public function maybe_generate_schedule_from_meta($meta_id, $post_id, $meta_key, $meta_value): void {
        // Only care about our core fields
        $watched_keys = ['loan_amount', 'loan_term', 'start_date'];
        if (!in_array($meta_key, $watched_keys, true)) {
            return;
        }

        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'loans') {
            return;
        }

        // Do not create duplicates
        if ($this->schedule_exists($post_id)) {
            return;
        }

        // Pull all data in one place; this will return null until all required fields exist
        $loan_data = $this->get_loan_data($post_id);
        if (!$loan_data) {
            return;
        }

        $this->create_repayment_schedule($post_id, $loan_data);
    }
    
    /**
     * Handle manual deletion of repayment schedules from admin page
     */
    public function handle_manual_delete(): void {
        // Check if this is a delete request
        if (!isset($_GET['echovault_delete_schedule']) || !isset($_GET['loan_id'])) {
            return;
        }
        
        // Verify nonce for security
        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'delete_schedule_' . intval($_GET['loan_id']))) {
            wp_die('Security check failed');
        }
        
        // Check user permissions
        if (!current_user_can('manage_options')) {
            wp_die('You do not have permission to delete repayment schedules');
        }
        
        $loan_id = intval($_GET['loan_id']);
        
        // Delete all schedules for this loan
        $deleted = $this->delete_existing_schedule($loan_id);
        
        // Redirect back with success message
        $redirect_url = add_query_arg([
            'page' => 'echovault-repayment-schedules',
            'deleted' => $deleted,
            'loan_id' => $loan_id > 0 ? $loan_id : null
        ], admin_url('admin.php'));
        
        wp_redirect($redirect_url);
        exit;
    }
    
    /**
     * Add admin menu for viewing repayment schedules
     */
    public function add_admin_menu(): void {
        add_menu_page(
            'Repayment Schedules',
            'Repayment Schedules',
            'manage_options',
            'echovault-repayment-schedules',
            [$this, 'render_admin_page'],
            'dashicons-calendar-alt',
            30
        );
    }
    
    /**
     * Render admin page to view repayment schedules
     */
    public function render_admin_page(): void {
        global $wpdb;
        $table_name = $this->get_table_name();
        
        // Get loan ID from query parameter
        $loan_id = isset($_GET['loan_id']) ? intval($_GET['loan_id']) : 0;
        
        // Get all schedules if no loan ID specified
        if ($loan_id > 0) {
            $schedules = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM $table_name WHERE related_loan = %d ORDER BY segment_start ASC",
                $loan_id
            ), ARRAY_A);
            $loan = get_post($loan_id);
            $loan_title = $loan ? $loan->post_title : "Loan #$loan_id";
        } else {
            // Get all schedules grouped by loan
            $all_schedules = $wpdb->get_results(
                "SELECT s.*, p.post_title as loan_title 
                FROM $table_name s 
                LEFT JOIN {$wpdb->posts} p ON s.related_loan = p.ID 
                ORDER BY s.related_loan DESC, s.segment_start ASC",
                ARRAY_A
            );
            $schedules_by_loan = [];
            foreach ($all_schedules as $schedule) {
                $loan_id_key = $schedule['related_loan'];
                if (!isset($schedules_by_loan[$loan_id_key])) {
                    $schedules_by_loan[$loan_id_key] = [
                        'loan_id' => $loan_id_key,
                        'loan_title' => $schedule['loan_title'] ?: "Loan #{$loan_id_key}",
                        'schedules' => []
                    ];
                }
                $schedules_by_loan[$loan_id_key]['schedules'][] = $schedule;
            }
        }
        
        // Handle success message
        $deleted_count = isset($_GET['deleted']) ? intval($_GET['deleted']) : 0;
        
        ?>
        <div class="wrap">
            <h1>Repayment Schedules</h1>
            
            <?php if ($deleted_count > 0): ?>
                <div class="notice notice-success is-dismissible">
                    <p>Successfully deleted <?php echo esc_html($deleted_count); ?> repayment schedule row(s).</p>
                </div>
            <?php endif; ?>
            
            <?php if ($loan_id > 0): ?>
                <p><a href="<?php echo admin_url('admin.php?page=echovault-repayment-schedules'); ?>">&larr; Back to All Schedules</a></p>
                <h2><?php echo esc_html($loan_title); ?></h2>
                
                <?php if (empty($schedules)): ?>
                    <p>No repayment schedule found for this loan.</p>
                <?php else: ?>
                    <p>
                        <a href="<?php echo wp_nonce_url(
                            add_query_arg([
                                'page' => 'echovault-repayment-schedules',
                                'echovault_delete_schedule' => '1',
                                'loan_id' => $loan_id
                            ], admin_url('admin.php')),
                            'delete_schedule_' . $loan_id
                        ); ?>" 
                        class="button button-secondary" 
                        onclick="return confirm('Are you sure you want to delete all repayment schedules for this loan? This action cannot be undone.');">
                            Delete All Schedules for This Loan
                        </a>
                    </p>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Days</th>
                                <th>Start Balance</th>
                                <th>Interest</th>
                                <th>Principal</th>
                                <th>Total Payment</th>
                                <th>Paid Interest</th>
                                <th>Paid Principal</th>
                                <th>Paid Total Payment</th>
                                <th>Remaining Balance</th>
                                <th>Status</th>
                                <th>Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $index = 0;
                            foreach ($schedules as $schedule): 
                                $index++;
                                // Calculate scheduled values if not in database (backward compatibility)
                                $scheduled_principal = isset($schedule['scheduled_principal']) && $schedule['scheduled_principal'] > 0
                                    ? (float)$schedule['scheduled_principal']
                                    : ((float)$schedule['start_balance'] - (float)$schedule['remain_balance']);
                                $scheduled_total_payment = isset($schedule['scheduled_total_payment']) && $schedule['scheduled_total_payment'] > 0
                                    ? (float)$schedule['scheduled_total_payment']
                                    : ((float)$schedule['accrued_interest'] + $scheduled_principal);
                            ?>
                                <tr>
                                    <td><?php echo esc_html($index); ?></td>
                                    <td><?php echo esc_html($schedule['segment_start']); ?></td>
                                    <td><?php echo esc_html($schedule['segment_end']); ?></td>
                                    <td><?php echo esc_html($schedule['loan_days']); ?></td>
                                    <td><?php echo number_format($schedule['start_balance'], 2); ?></td>
                                    <td><?php echo number_format($schedule['accrued_interest'], 2); ?></td>
                                    <td><?php echo number_format($scheduled_principal, 2); ?></td>
                                    <td><?php echo number_format($scheduled_total_payment, 2); ?></td>
                                    <td><?php echo number_format($schedule['paid_interest'], 2); ?></td>
                                    <td><?php echo number_format($schedule['paid_principles'], 2); ?></td>
                                    <td><?php echo number_format($schedule['total_payment'], 2); ?></td>
                                    <td><?php echo number_format($schedule['remain_balance'], 2); ?></td>
                                    <td><?php echo esc_html($schedule['repayment_status']); ?></td>
                                    <td><?php echo esc_html($schedule['repayment_note']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            <?php else: ?>
                <h2>All Repayment Schedules</h2>
                <?php if (empty($schedules_by_loan)): ?>
                    <p>No repayment schedules found.</p>
                <?php else: ?>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Loan</th>
                                <th>Loan ID</th>
                                <th>Segments</th>
                                <th>Total Balance</th>
                                <th>Remaining Balance</th>
                                <th>Total Accrued Interest</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($schedules_by_loan as $loan_data): ?>
                                <?php
                                $schedules_for_loan = $loan_data['schedules'];
                                // Total balance: initial loan amount from first segment's start_balance
                                $initial_balance = isset($schedules_for_loan[0]['start_balance'])
                                    ? (float) $schedules_for_loan[0]['start_balance']
                                    : 0.0;
                                // Remaining balance: find the FIRST segment with "Pending" status (top of the list)
                                // This shows the current outstanding balance that needs to be paid
                                $remaining_balance = 0.0;
                                foreach ($schedules_for_loan as $segment) {
                                    $segment_status = isset($segment['repayment_status']) ? $segment['repayment_status'] : 'Pending';
                                    // Use the first segment with Pending status
                                    if ($segment_status === 'Pending') {
                                        $remaining_balance = isset($segment['remain_balance']) ? (float) $segment['remain_balance'] : 0.0;
                                        break;
                                    }
                                }
                                // If no Pending segment found, use the last segment's balance as fallback
                                if ($remaining_balance == 0.0 && !empty($schedules_for_loan)) {
                                    $last_segment = end($schedules_for_loan);
                                    $remaining_balance = isset($last_segment['remain_balance']) ? (float) $last_segment['remain_balance'] : 0.0;
                                }
                                ?>
                                <tr>
                                    <td><?php echo esc_html($loan_data['loan_title']); ?></td>
                                    <td><?php echo esc_html($loan_data['loan_id']); ?></td>
                                    <td><?php echo count($schedules_for_loan); ?></td>
                                    <td><?php echo number_format($initial_balance, 2); ?></td>
                                    <td><?php echo number_format($remaining_balance, 2); ?></td>
                                    <td>
                                        <?php 
                                        $total_interest = array_sum(array_column($schedules_for_loan, 'accrued_interest'));
                                        echo number_format($total_interest, 2); 
                                        ?>
                                    </td>
                                    <td>
                                        <a href="<?php echo admin_url('admin.php?page=echovault-repayment-schedules&loan_id=' . $loan_data['loan_id']); ?>">View Details</a>
                                        |
                                        <a href="<?php echo wp_nonce_url(
                                            add_query_arg([
                                                'page' => 'echovault-repayment-schedules',
                                                'echovault_delete_schedule' => '1',
                                                'loan_id' => $loan_data['loan_id']
                                            ], admin_url('admin.php')),
                                            'delete_schedule_' . $loan_data['loan_id']
                                        ); ?>" 
                                        style="color: #a00;" 
                                        onclick="return confirm('Are you sure you want to delete all repayment schedules for loan #<?php echo esc_js($loan_data['loan_id']); ?>? This action cannot be undone.');">
                                            Delete
                                        </a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php
    }
    
    /**
     * Register the repayment_schedule custom post type
     */
    public function register_repayment_schedule_post_type(): void {
        if (post_type_exists(self::REPAYMENT_SCHEDULE_POST_TYPE)) {
            error_log("EchoVault: Post type already registered");
            return;
        }
        
        $result = register_post_type(self::REPAYMENT_SCHEDULE_POST_TYPE, [
            'label' => 'Repayment Schedules',
            'labels' => [
                'name' => 'Repayment Schedules',
                'singular_name' => 'Repayment Schedule',
                'add_new' => 'Add New',
                'add_new_item' => 'Add New Repayment Schedule',
                'edit_item' => 'Edit Repayment Schedule',
                'new_item' => 'New Repayment Schedule',
                'view_item' => 'View Repayment Schedule',
                'search_items' => 'Search Repayment Schedules',
                'not_found' => 'No repayment schedules found',
                'not_found_in_trash' => 'No repayment schedules found in trash',
            ],
            'public' => false,
            'show_ui' => false,
            'show_in_menu' => false,
            'show_in_rest' => false,
            'publicly_queryable' => false,
            'exclude_from_search' => true,
            'has_archive' => false,
            'hierarchical' => false,
            'supports' => ['title'],
            'rewrite' => false,
            'query_var' => false,
        ]);
        
        if (is_wp_error($result)) {
            error_log("EchoVault: ERROR registering post type: " . $result->get_error_message());
        } else {
            error_log("EchoVault: Post type registered successfully");
        }
        
        // Force flush rewrite rules
        flush_rewrite_rules(false);
    }
    
    /**
     * Send CORS headers very early in the request
     */
    public function enable_cors_early(): void {
        if (!isset($_SERVER['REQUEST_URI'])) {
            return;
        }
        
        $uri = $_SERVER['REQUEST_URI'];
        if (strpos($uri, '/wp-json/' . self::ROUTE_NAMESPACE) === false) {
            return;
        }
        
        // Send CORS headers immediately - use header() with replace=false to ensure they're sent
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
            header('Access-Control-Max-Age: 86400', false);
        }
        
        // Handle OPTIONS preflight
        if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }
    }

    public function enable_cors(): void {
        // Remove WordPress default CORS for our routes and add our own
        add_filter('rest_pre_serve_request', function($served, $result, $request) {
            $route = $request->get_route();
            if (strpos($route, self::ROUTE_NAMESPACE) === 0) {
                // Remove default CORS
                remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
                
                // Force our CORS headers - check if headers already sent
                if (!headers_sent()) {
                    header('Access-Control-Allow-Origin: *', false);
                    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
                    header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
                    header('Access-Control-Max-Age: 86400', false);
                }
                
                // Handle OPTIONS
                if ($request->get_method() === 'OPTIONS') {
                    if (!headers_sent()) {
                        status_header(200);
                    }
                    exit(0);
                }
            }
            return $served;
        }, 1, 3);
        
        // Add headers to all responses via WP_REST_Response
        add_filter('rest_post_dispatch', function($result, $server, $request) {
            $route = $request->get_route();
            if (strpos($route, self::ROUTE_NAMESPACE) === 0) {
                if ($result instanceof WP_REST_Response) {
                    $result->header('Access-Control-Allow-Origin', '*');
                    $result->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                    $result->header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Requested-With');
                }
            }
            return $result;
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

        // Generate repayment schedule endpoint
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::GENERATE_SCHEDULE_ROUTE,
            [
                'methods'             => ['POST', 'OPTIONS'],
                'callback'            => [$this, 'handle_generate_schedule'],
                'permission_callback' => '__return_true',
            ]
        );

        // Register payment endpoint
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::REGISTER_PAYMENT_ROUTE,
            [
                'methods'             => ['POST', 'OPTIONS'],
                'callback'            => [$this, 'handle_register_payment'],
                'permission_callback' => '__return_true',
            ]
        );

        // Get repayment schedule endpoint
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::GET_SCHEDULE_ROUTE,
            [
                'methods'             => ['GET', 'POST', 'OPTIONS'],
                'callback'            => [$this, 'handle_get_schedule'],
                'permission_callback' => '__return_true',
            ]
        );
        
        // Delete repayment schedule endpoint
        register_rest_route(
            self::ROUTE_NAMESPACE,
            self::DELETE_SCHEDULE_ROUTE,
            [
                'methods'             => ['POST', 'DELETE', 'OPTIONS'],
                'callback'            => [$this, 'handle_delete_schedule'],
                'permission_callback' => '__return_true',
            ]
        );
        
        // Auto-generate endpoint (triggered when viewing loan without schedule)
        register_rest_route(
            self::ROUTE_NAMESPACE,
            '/auto-generate-schedule',
            [
                'methods'             => ['GET', 'POST'],
                'callback'            => [$this, 'handle_auto_generate'],
                'permission_callback' => '__return_true',
                'args'                => [
                    'loan_id' => [
                        'required' => true,
                        'type'     => 'integer',
                        'validate_callback' => function($param) {
                            return is_numeric($param) && $param > 0;
                        },
                    ],
                ],
            ]
        );
        
        // FORCE GENERATE endpoint - use this to manually trigger generation
        register_rest_route(
            self::ROUTE_NAMESPACE,
            '/force-generate-schedule',
            [
                'methods'             => ['GET', 'POST'],
                'callback'            => [$this, 'handle_force_generate'],
                'permission_callback' => '__return_true',
            ]
        );
        
        // Log that routes were registered (for debugging)
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('EchoVault: REST API routes registered for namespace: ' . self::ROUTE_NAMESPACE);
        }
    }
    
    /**
     * Check if routes are registered and show admin notice if needed
     */
    public function check_routes_registered(): void {
        // Only show on admin pages and if user can manage options
        if (!is_admin() || !current_user_can('manage_options')) {
            return;
        }
        
        // Check if we can access the test endpoint (only check once per day)
        $transient_key = 'echovault_routes_check';
        $last_check = get_transient($transient_key);
        
        if ($last_check === false) {
            // Try to verify routes are registered
            $routes = rest_get_server()->get_routes();
            $namespace = self::ROUTE_NAMESPACE;
            $routes_found = false;
            
            foreach ($routes as $route => $handlers) {
                if (strpos($route, $namespace) === 1) { // Routes start with /
                    $routes_found = true;
                    break;
                }
            }
            
            if (!$routes_found) {
                echo '<div class="notice notice-warning"><p>';
                echo '<strong>EchoVault Loan Schedule API:</strong> REST API routes may not be registered. ';
                echo 'Please deactivate and reactivate the plugin, or go to Settings > Permalinks and click "Save Changes" to flush rewrite rules.';
                echo '</p></div>';
            }
            
            // Check again in 24 hours
            set_transient($transient_key, time(), DAY_IN_SECONDS);
        }
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

        try {
            $data = $this->sanitize($request);
            $this->validate($data);

            $schedule = $this->build_schedule($data);
            $summary  = $this->build_summary($schedule, $data['loan_amount']);

            return new WP_REST_Response(
                [
                    'success'  => true,
                    'schedule' => $schedule,
                    'summary'  => $summary,
                    'debug'    => [
                        'frequency' => $data['repayment_frequency'],
                        'method'    => $data['repayment_method'],
                        'periods'   => $this->period_count($data['loan_term'], $data['repayment_frequency']),
                    ],
                ],
                200
            );
        } catch (WP_REST_Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error'   => $e->getMessage(),
                    'code'    => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
        } catch (Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error'   => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
        }
    }

    private function sanitize(WP_REST_Request $request): array {
        // Get raw frequency value and ensure it's a string
        $frequency = $request->get_param('repayment_frequency');
        if (is_array($frequency)) {
            $frequency = $frequency[0] ?? 'Monthly';
        }
        $frequency = trim((string) $frequency);
        
        // Get raw method value and ensure it's a string
        $method = $request->get_param('repayment_method');
        if (is_array($method)) {
            $method = $method[0] ?? 'Equal Principal';
        }
        $method = trim((string) $method);
        
        return [
            'loan_amount'         => floatval($request->get_param('loan_amount')),
            'loan_term'           => intval($request->get_param('loan_term')),
            'loan_interest'       => floatval($request->get_param('loan_interest')),
            'repayment_method'    => $method,
            'repayment_frequency' => $frequency,
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
        
        // Normalize method and frequency for comparison (case-insensitive)
        $method = trim($payload['repayment_method']);
        $frequency = trim($payload['repayment_frequency']);
        
        $validMethods = ['Equal Principal', 'Equal Total', 'Interest-Only'];
        $validFrequencies = ['Weekly', 'Fortnightly', 'Monthly'];
        
        if (!in_array($method, $validMethods, true)) {
            throw new WP_REST_Exception('invalid_method', 'Unsupported repayment method: ' . $method, ['status' => 400]);
        }
        if (!in_array($frequency, $validFrequencies, true)) {
            throw new WP_REST_Exception('invalid_frequency', 'Unsupported repayment frequency: ' . $frequency . '. Expected: Weekly, Fortnightly, or Monthly', ['status' => 400]);
        }
        
        $date = DateTime::createFromFormat('Y-m-d', $payload['start_date']);
        if (!$date || $date->format('Y-m-d') !== $payload['start_date']) {
            throw new WP_REST_Exception('invalid_date', 'Start date must be YYYY-MM-DD.', ['status' => 400]);
        }
    }

    /**
     * Build the complete repayment schedule based on loan parameters.
     * 
     * Supports three repayment methods:
     * - Equal Principal: Fixed principal payment per period, interest decreases over time
     * - Equal Total: Fixed total payment per period (amortization formula)
     * - Interest-Only: Pay only interest until final period, then principal + interest
     * 
     * @param array $payload Sanitized loan parameters
     * @return array Array of schedule rows, each containing idx, date, payment, principal, interest, balance
     */
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

        // Equal Total Payment (Amortization)
        // Formula: P = (P * r) / (1 - (1 + r)^(-n))
        // Where P = principal, r = rate per period, n = number of periods
        if ($payload['repayment_method'] === 'Equal Total') {
            // Handle zero interest rate case
            $payment = $rate == 0
                ? $principal / $periods
                : ($principal * $rate) / (1 - pow(1 + $rate, -$periods));

            for ($i = 0; $i < $periods; $i++) {
                $interest       = $balance * $rate;
                $principal_paid = min($payment - $interest, $balance);
                $balance        = max(0, $balance - $principal_paid);

                $rows[] = $this->row($i, $start, $payload['repayment_frequency'], $payment, $principal_paid, $interest, $balance);
            }
        }
        // Interest-Only Payment
        // Pay only interest for all periods except the last, where principal + interest is paid
        elseif ($payload['repayment_method'] === 'Interest-Only') {
            $interest_only = $balance * $rate;
            // All periods except the last: pay only interest
            for ($i = 0; $i < $periods - 1; $i++) {
                $rows[] = $this->row($i, $start, $payload['repayment_frequency'], $interest_only, 0, $interest_only, $balance);
            }
            // Final period: pay interest + full principal
            $rows[] = $this->row($periods - 1, $start, $payload['repayment_frequency'], $interest_only + $balance, $balance, $interest_only, 0);
        }
        // Equal Principal Payment (Default)
        // Fixed principal amount per period, interest calculated daily on remaining balance
        // Interest rate is monthly (e.g., 4% per month), calculated using: Balance × Monthly Rate × (Days / 30)
        else {
            $principal_per_period = $principal / $periods;
            $monthly_rate = $payload['loan_interest'] / 100; // Monthly rate as decimal (e.g., 0.04 for 4%)
            
            $period_start = clone $start;
            
            for ($i = 0; $i < $periods; $i++) {
                // Calculate payment date for this period
                $period_end = clone $period_start;
                switch ($payload['repayment_frequency']) {
                    case 'Weekly':
                        $period_end->modify('+7 days');
                        break;
                    case 'Fortnightly':
                        $period_end->modify('+14 days');
                        break;
                    default: // Monthly
                        $period_end->modify('+1 month');
                        break;
                }
                
                // Calculate actual number of days in this period
                $days_in_period = $period_start->diff($period_end)->days;
                if ($days_in_period <= 0) {
                    $days_in_period = 1; // Fallback to prevent division by zero
                }
                
                // Calculate interest using the formula: Opening Balance × Monthly Rate × (Days / 30)
                // This uses a standard 30-day month as the base, then adjusts for actual days in period
                // Example: $10,000 × 0.04 × (31/30) = $413.33
                // Example: $9,166.67 × 0.04 × (30/30) = $366.67
                $interest = $balance * $monthly_rate * ($days_in_period / 30);
                
                $payment  = $principal_per_period + $interest;
                $balance  = max(0, $balance - $principal_per_period);

                $rows[] = $this->row_with_date($i, $period_start, $period_end, $payment, $principal_per_period, $interest, $balance);
                
                // Move to next period start
                $period_start = clone $period_end;
            }
        }

        return array_values($rows);
    }

    /**
     * Create a single schedule row with payment date calculation.
     * 
     * @param int $index Zero-based period index
     * @param DateTime $start Start date of the loan
     * @param string $frequency Payment frequency (Weekly, Fortnightly, Monthly)
     * @param float $payment Total payment amount for this period
     * @param float $principal Principal portion of payment
     * @param float $interest Interest portion of payment
     * @param float $balance Remaining balance after this payment
     * @return array Schedule row with idx, date (ISO 8601), payment, principal, interest, balance
     */
    private function row(int $index, DateTime $start, string $frequency, float $payment, float $principal, float $interest, float $balance): array {
        $date = clone $start;
        switch ($frequency) {
            case 'Weekly':
                $date->modify('+' . ($index + 1) * 7 . ' days');
                break;
            case 'Fortnightly':
                $date->modify('+' . ($index + 1) * 14 . ' days');
                break;
            default: // Monthly
                $date->modify('+' . ($index + 1) . ' months');
        }

        return [
            'idx'       => $index + 1,
            'date'      => $date->format('c'), // ISO 8601 format
            'payment'   => round($payment, 2),
            'principal' => round($principal, 2),
            'interest'  => round($interest, 2),
            'balance'   => round($balance, 2),
        ];
    }

    /**
     * Create a single schedule row with explicit start and end dates (for daily interest calculation).
     * 
     * @param int $index Zero-based period index
     * @param DateTime $period_start Start date of this payment period
     * @param DateTime $period_end End date of this payment period (payment due date)
     * @param float $payment Total payment amount for this period
     * @param float $principal Principal portion of payment
     * @param float $interest Interest portion of payment
     * @param float $balance Remaining balance after this payment
     * @return array Schedule row with idx, date (ISO 8601), payment, principal, interest, balance, period_start, period_end, days
     */
    private function row_with_date(int $index, DateTime $period_start, DateTime $period_end, float $payment, float $principal, float $interest, float $balance): array {
        $days = $period_start->diff($period_end)->days;
        return [
            'idx'           => $index + 1,
            'date'          => $period_end->format('c'), // ISO 8601 format (payment due date)
            'payment'       => round($payment, 2),
            'principal'     => round($principal, 2),
            'interest'      => round($interest, 2),
            'balance'       => round($balance, 2),
            'period_start'  => $period_start->format('Y-m-d'), // Store start date for exact matching
            'period_end'    => $period_end->format('Y-m-d'), // Store end date for exact matching
            'days'          => $days, // Store days for exact matching
        ];
    }

    /**
     * Build summary statistics from the schedule.
     * 
     * @param array $schedule Complete repayment schedule
     * @param float $principal Original loan principal amount
     * @return array Summary with total_payments, total_principal, total_interest, total_paid
     */
    private function build_summary(array $schedule, float $principal): array {
        return [
            'total_payments' => count($schedule),
            'total_principal'=> round($principal, 2),
            'total_interest' => round(array_sum(array_column($schedule, 'interest')), 2),
            'total_paid'     => round(array_sum(array_column($schedule, 'payment')), 2),
        ];
    }

    /**
     * Calculate the number of payment periods based on loan term and frequency.
     * 
     * Converts loan term (in months) to number of payment periods:
     * - Monthly: 1 period per month
     * - Fortnightly: ~26 periods per year (52 weeks / 2)
     * - Weekly: ~52 periods per year
     * 
     * @param int $months Loan term in months
     * @param string $frequency Payment frequency
     * @return int Number of payment periods
     */
    private function period_count(int $months, string $frequency): int {
        switch ($frequency) {
            case 'Weekly':
                // 52 weeks per year, convert months to periods
                return (int) ceil(($months * 52) / 12);
            case 'Fortnightly':
                // 26 fortnights per year (52 weeks / 2)
                return (int) ceil(($months * 26) / 12);
            default: // Monthly
                return $months;
        }
    }

    /**
     * Calculate the interest rate per payment period from monthly interest rate.
     * 
     * IMPORTANT: The loan_interest field represents a MONTHLY interest rate (not annual).
     * For example, 4% means 4% per month.
     * 
     * For Equal Principal Payment method, interest is calculated daily:
     * - Daily rate = monthly_rate / days_in_period
     * - Interest = balance * daily_rate * days_in_period
     * 
     * For other methods (Equal Total, Interest-Only), converts monthly rate to periodic rate:
     * - Monthly: monthly rate (as-is)
     * - Fortnightly: monthly rate * (12/26) = monthly rate * 0.4615
     * - Weekly: monthly rate * (12/52) = monthly rate * 0.2308
     * 
     * @param float $monthly_percent Monthly interest rate as percentage (e.g., 4.0 for 4% per month)
     * @param string $frequency Payment frequency
     * @return float Interest rate per period (as decimal, e.g., 0.04 for 4%)
     */
    private function rate_per_period(float $monthly_percent, string $frequency): float {
        $monthly = $monthly_percent / 100; // Convert percentage to decimal
        switch ($frequency) {
            case 'Weekly':
                // Convert monthly rate to weekly: monthly * (12 months / 52 weeks)
                return $monthly * (12 / 52);
            case 'Fortnightly':
                // Convert monthly rate to fortnightly: monthly * (12 months / 26 fortnights)
                return $monthly * (12 / 26);
            default: // Monthly
                return $monthly; // Monthly rate as-is
        }
    }

    /**
     * Hook on rest_insert_loans (before meta is saved)
     */
    public function force_generate_schedule_insert($post, $request, $creating): void {
        if (!$creating) return;
        error_log("EchoVault: rest_insert_loans hook FIRED for loan {$post->ID}");
    }
    
    /**
     * FORCE generate schedule - called directly when loan is created via REST API
     * THIS IS THE MAIN FUNCTION THAT SAVES THE SCHEDULE
     */
    public function force_generate_schedule($post, $request, $creating): void {
        if (!$creating) {
            return;
        }
        
        $loan_id = $post->ID;
        error_log("EchoVault: =========================================");
        error_log("EchoVault: force_generate_schedule called for NEW loan $loan_id");
        
        if ($this->schedule_exists($loan_id)) {
            error_log("EchoVault: Schedule already exists for loan $loan_id");
            return;
        }
        
        // Try to get data from request first (FormData)
        $loan_data = null;
        if ($request && is_object($request)) {
            $loan_amount = $request->get_param('loan_amount') ?? $request->get_param('meta[loan_amount]') ?? $_POST['loan_amount'] ?? null;
            $loan_term = $request->get_param('loan_term') ?? $request->get_param('meta[loan_term]') ?? $_POST['loan_term'] ?? null;
            $start_date = $request->get_param('start_date') ?? $request->get_param('meta[start_date]') ?? $_POST['start_date'] ?? null;
            
            if (is_array($loan_amount)) $loan_amount = $loan_amount[0];
            if (is_array($loan_term)) $loan_term = $loan_term[0];
            if (is_array($start_date)) $start_date = $start_date[0];
            
            if ($loan_amount && $loan_term && $start_date) {
                $loan_interest = $request->get_param('loan_interest') ?? $request->get_param('meta[loan_interest]') ?? $_POST['loan_interest'] ?? 0;
                $repayment_method = $request->get_param('repayment_method') ?? $request->get_param('meta[repayment_method]') ?? $_POST['repayment_method'] ?? 'Equal Principal';
                $repayment_frequency = $request->get_param('repayment_frequency') ?? $request->get_param('meta[repayment_frequency]') ?? $_POST['repayment_frequency'] ?? 'Monthly';
                
                if (is_array($loan_interest)) $loan_interest = $loan_interest[0];
                if (is_array($repayment_method)) $repayment_method = $repayment_method[0];
                if (is_array($repayment_frequency)) $repayment_frequency = $repayment_frequency[0];
                
                $loan_interest_val = floatval($loan_interest ?: 0);
                
                // If interest rate is 0 or missing, try to get it from the loan product
                if ($loan_interest_val <= 0) {
                    $loan_product_id = $request->get_param('loan_product_id') ?? $request->get_param('meta[loan_product_id]') ?? $_POST['loan_product_id'] ?? get_post_meta($loan_id, 'loan_product_id', true);
                    if (!empty($loan_product_id)) {
                        if (is_array($loan_product_id)) $loan_product_id = $loan_product_id[0];
                        $product_interest = get_post_meta($loan_product_id, 'interest_rate', true);
                        if (is_array($product_interest)) {
                            $product_interest = isset($product_interest[0]) ? $product_interest[0] : '';
                        }
                        if (!empty($product_interest) && floatval($product_interest) > 0) {
                            $loan_interest_val = floatval($product_interest);
                            error_log("EchoVault: Using interest rate from loan product in force_generate: $loan_interest_val");
                        }
                    }
                }
                
                $loan_data = [
                    'loan_amount' => floatval($loan_amount),
                    'loan_term' => intval($loan_term),
                    'loan_interest' => $loan_interest_val,
                    'repayment_method' => trim((string)($repayment_method ?: 'Equal Principal')),
                    'repayment_frequency' => trim((string)($repayment_frequency ?: 'Monthly')),
                    'start_date' => trim((string)$start_date),
                ];
                
                error_log("EchoVault: Got data from request: amount={$loan_data['loan_amount']}, term={$loan_data['loan_term']}, date={$loan_data['start_date']}");
            }
        }
        
        // If no data from request, try from $_POST (FormData)
        if (!$loan_data && !empty($_POST)) {
            error_log("EchoVault: Checking \$_POST for loan data");
            $loan_amount = $_POST['loan_amount'] ?? null;
            $loan_term = $_POST['loan_term'] ?? null;
            $start_date = $_POST['start_date'] ?? null;
            
            if ($loan_amount && $loan_term && $start_date) {
                $loan_interest = $_POST['loan_interest'] ?? 0;
                $repayment_method = $_POST['repayment_method'] ?? 'Equal Principal';
                $repayment_frequency = $_POST['repayment_frequency'] ?? 'Monthly';
                
                $loan_interest_val = floatval($loan_interest ?: 0);
                
                // If interest rate is 0 or missing, try to get it from the loan product
                if ($loan_interest_val <= 0) {
                    $loan_product_id = $_POST['loan_product_id'] ?? $_POST['meta[loan_product_id]'] ?? get_post_meta($loan_id, 'loan_product_id', true);
                    if (!empty($loan_product_id)) {
                        if (is_array($loan_product_id)) $loan_product_id = $loan_product_id[0];
                        $product_interest = get_post_meta($loan_product_id, 'interest_rate', true);
                        if (is_array($product_interest)) {
                            $product_interest = isset($product_interest[0]) ? $product_interest[0] : '';
                        }
                        if (!empty($product_interest) && floatval($product_interest) > 0) {
                            $loan_interest_val = floatval($product_interest);
                            error_log("EchoVault: Using interest rate from loan product in \$_POST: $loan_interest_val");
                        }
                    }
                }
                
                $loan_data = [
                    'loan_amount' => floatval($loan_amount),
                    'loan_term' => intval($loan_term),
                    'loan_interest' => $loan_interest_val,
                    'repayment_method' => trim((string)($repayment_method ?: 'Equal Principal')),
                    'repayment_frequency' => trim((string)($repayment_frequency ?: 'Monthly')),
                    'start_date' => trim((string)$start_date),
                ];
                error_log("EchoVault: Got data from \$_POST: amount={$loan_data['loan_amount']}, term={$loan_data['loan_term']}, interest={$loan_data['loan_interest']}, date={$loan_data['start_date']}");
            }
        }
        
        // If still no data, try from meta
        if (!$loan_data) {
            error_log("EchoVault: No data from request/POST, trying from meta for loan $loan_id");
            $loan_data = $this->get_loan_data($loan_id);
        }
        
        if ($loan_data) {
            error_log("EchoVault: *** ALL DATA READY - GENERATING AND SAVING SCHEDULE NOW FOR LOAN $loan_id ***");
            // Generate AND SAVE the schedule immediately
            $count = $this->create_repayment_schedule($loan_id, $loan_data);
            error_log("EchoVault: *** SAVED $count SEGMENTS FOR LOAN $loan_id ***");
            error_log("EchoVault: =========================================");
        } else {
            error_log("EchoVault: Data not ready yet, will retry on shutdown for loan $loan_id");
            // Use shutdown hook as fallback - wait for meta to be saved
            add_action('shutdown', function() use ($loan_id) {
                $loan_data = $this->get_loan_data($loan_id);
                if ($loan_data && !$this->schedule_exists($loan_id)) {
                    error_log("EchoVault: SHUTDOWN HOOK - Generating schedule for loan $loan_id");
                    $count = $this->create_repayment_schedule($loan_id, $loan_data);
                    error_log("EchoVault: SHUTDOWN HOOK - Generated $count segments for loan $loan_id");
                }
            }, 999);
        }
    }
    
    /**
     * FORCE generate when meta is added/updated - THIS IS THE KEY FUNCTION
     */
    public function force_generate_on_meta_add($meta_id, $post_id, $meta_key, $meta_value): void {
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'loans') {
            return;
        }
        
        // Skip if schedule exists
        if ($this->schedule_exists($post_id)) {
            return;
        }
        
        // Check ALL loan meta fields to see if we have required data
        $loan_amount = get_post_meta($post_id, 'loan_amount', true);
        $loan_term = get_post_meta($post_id, 'loan_term', true);
        $start_date = get_post_meta($post_id, 'start_date', true);
        
        // Handle arrays
        if (is_array($loan_amount)) $loan_amount = $loan_amount[0];
        if (is_array($loan_term)) $loan_term = $loan_term[0];
        if (is_array($start_date)) $start_date = $start_date[0];
        
        $loan_amount = floatval($loan_amount ?: 0);
        $loan_term = intval($loan_term ?: 0);
        $start_date = trim((string)($start_date ?: ''));
        
        // Check if we have ALL required fields
        if ($loan_amount > 0 && $loan_term > 0 && !empty($start_date)) {
            error_log("EchoVault: ALL REQUIRED FIELDS PRESENT for loan $post_id! Generating schedule NOW!");
            
            $loan_interest = get_post_meta($post_id, 'loan_interest', true);
            $repayment_method = get_post_meta($post_id, 'repayment_method', true);
            $repayment_frequency = get_post_meta($post_id, 'repayment_frequency', true);
            
            if (is_array($loan_interest)) $loan_interest = $loan_interest[0];
            if (is_array($repayment_method)) $repayment_method = $repayment_method[0];
            if (is_array($repayment_frequency)) $repayment_frequency = $repayment_frequency[0];
            
            $loan_interest_val = floatval($loan_interest ?: 0);
            
            // If interest rate is 0 or missing, try to get it from the loan product
            if ($loan_interest_val <= 0) {
                $loan_product_id = get_post_meta($post_id, 'loan_product_id', true);
                if (is_array($loan_product_id)) $loan_product_id = $loan_product_id[0];
                if (!empty($loan_product_id)) {
                    $product_interest = get_post_meta($loan_product_id, 'interest_rate', true);
                    if (is_array($product_interest)) {
                        $product_interest = isset($product_interest[0]) ? $product_interest[0] : '';
                    }
                    if (!empty($product_interest) && floatval($product_interest) > 0) {
                        $loan_interest_val = floatval($product_interest);
                        error_log("EchoVault: Using interest rate from loan product in force_generate_on_meta_add: $loan_interest_val");
                    }
                }
            }
            
            $loan_data = [
                'loan_amount' => $loan_amount,
                'loan_term' => $loan_term,
                'loan_interest' => $loan_interest_val,
                'repayment_method' => trim((string)($repayment_method ?: 'Equal Principal')),
                'repayment_frequency' => trim((string)($repayment_frequency ?: 'Monthly')),
                'start_date' => $start_date,
            ];
            
            // Validate date
            $date_obj = DateTime::createFromFormat('Y-m-d', $start_date);
            if ($date_obj && $date_obj->format('Y-m-d') === $start_date) {
                // GENERATE NOW! - This is the MAIN trigger when loan is created
                error_log("EchoVault: =========================================");
                error_log("EchoVault: *** GENERATING SCHEDULE FOR LOAN $post_id RIGHT NOW! ***");
                error_log("EchoVault: Loan data: amount=$loan_amount, term=$loan_term, interest=$loan_interest, method=$repayment_method, freq=$repayment_frequency, start=$start_date");
                error_log("EchoVault: =========================================");
                
                try {
                    $count = $this->create_repayment_schedule($post_id, $loan_data);
                    error_log("EchoVault: =========================================");
                    error_log("EchoVault: *** SUCCESS: GENERATED $count SEGMENTS FOR LOAN $post_id ***");
                    error_log("EchoVault: =========================================");
                } catch (Exception $e) {
                    error_log("EchoVault: ERROR generating schedule: " . $e->getMessage());
                    error_log("EchoVault: Stack: " . $e->getTraceAsString());
                }
            } else {
                error_log("EchoVault: Invalid date format: $start_date");
            }
        } else {
            error_log("EchoVault: Not all fields ready for loan $post_id - amount:$loan_amount term:$loan_term date:'$start_date'");
        }
    }
    
    /**
     * FORCE generate on save
     */
    public function force_generate_on_save($post_id, $post, $update): void {
        if ($update) {
            return; // Only for new loans
        }
        
        if ($post->post_type !== 'loans') {
            return;
        }
        
        if ($this->schedule_exists($post_id)) {
            return;
        }
        
        error_log("EchoVault: New loan saved (ID: $post_id), checking for schedule generation...");
        
        $loan_data = $this->get_loan_data($post_id);
        if ($loan_data) {
            error_log("EchoVault: Generating schedule for new loan $post_id");
            $this->auto_generate_schedule($post_id);
        }
    }

    /**
     * Auto-generate repayment schedule when loan is created or activated via REST API
     */
    public function maybe_generate_schedule($post, $request, $creating): void {
        if (!$creating) {
            return; // Only generate on creation
        }
        
        $loan_id = $post->ID;
        error_log("EchoVault: rest_after_insert_loans hook fired for loan $loan_id");
        
        // Check if schedule already exists
        if ($this->schedule_exists($loan_id)) {
            error_log("EchoVault: Schedule already exists for loan $loan_id, skipping");
            return;
        }
        
        // Try to get loan data from request first (faster)
        $loan_data = null;
        
        // Handle FormData (multipart/form-data) - check $_POST first
        if (isset($_POST['loan_amount']) && isset($_POST['loan_term']) && isset($_POST['start_date'])) {
            error_log("EchoVault: Found data in \$_POST for loan $loan_id");
            $loan_amount = $_POST['loan_amount'];
            $loan_term = $_POST['loan_term'];
            $loan_interest = $_POST['loan_interest'] ?? 0;
            $repayment_method = $_POST['repayment_method'] ?? 'Equal Principal';
            $repayment_frequency = $_POST['repayment_frequency'] ?? 'Monthly';
            $start_date = $_POST['start_date'];
            
            if ($loan_amount && $loan_term && $start_date) {
                // Handle arrays
                if (is_array($repayment_method)) $repayment_method = $repayment_method[0];
                if (is_array($repayment_frequency)) $repayment_frequency = $repayment_frequency[0];
                
                $loan_data = [
                    'loan_amount' => floatval($loan_amount),
                    'loan_term' => intval($loan_term),
                    'loan_interest' => floatval($loan_interest),
                    'repayment_method' => trim((string)$repayment_method),
                    'repayment_frequency' => trim((string)$repayment_frequency),
                    'start_date' => trim((string)$start_date),
                ];
                
                // Validate date format
                $date_obj = DateTime::createFromFormat('Y-m-d', $loan_data['start_date']);
                if (!$date_obj || $date_obj->format('Y-m-d') !== $loan_data['start_date']) {
                    error_log("EchoVault: Invalid date format for loan $loan_id: " . $loan_data['start_date']);
                    $loan_data = null; // Invalid date, will try from meta
                }
            }
        } elseif ($request instanceof WP_REST_Request) {
            error_log("EchoVault: Checking WP_REST_Request params for loan $loan_id");
            // Try REST request parameters
            $loan_amount = $request->get_param('loan_amount');
            $loan_term = $request->get_param('loan_term');
            $loan_interest = $request->get_param('loan_interest');
            $repayment_method = $request->get_param('repayment_method');
            $repayment_frequency = $request->get_param('repayment_frequency');
            $start_date = $request->get_param('start_date');
            
            if ($loan_amount && $loan_term && $start_date) {
                // Handle arrays
                if (is_array($repayment_method)) $repayment_method = $repayment_method[0];
                if (is_array($repayment_frequency)) $repayment_frequency = $repayment_frequency[0];
                
                $loan_data = [
                    'loan_amount' => floatval($loan_amount),
                    'loan_term' => intval($loan_term),
                    'loan_interest' => floatval($loan_interest ?: 0),
                    'repayment_method' => trim($repayment_method ?: 'Equal Principal'),
                    'repayment_frequency' => trim($repayment_frequency ?: 'Monthly'),
                    'start_date' => trim($start_date),
                ];
                
                // Validate date format
                $date_obj = DateTime::createFromFormat('Y-m-d', $loan_data['start_date']);
                if (!$date_obj || $date_obj->format('Y-m-d') !== $loan_data['start_date']) {
                    error_log("EchoVault: Invalid date format from REST request for loan $loan_id");
                    $loan_data = null; // Invalid date, will try from meta
                }
            }
        }
        
        // If we have data from request, generate immediately
        if ($loan_data && $loan_data['loan_amount'] > 0 && $loan_data['loan_term'] > 0) {
            error_log("EchoVault: Generating schedule immediately from request data for loan $loan_id");
            try {
                $count = $this->create_repayment_schedule($loan_id, $loan_data);
                error_log("EchoVault: Generated $count segments immediately for loan $loan_id");
                return;
            } catch (Exception $e) {
                error_log("EchoVault: Error generating schedule immediately: " . $e->getMessage());
                error_log("EchoVault: Stack trace: " . $e->getTraceAsString());
                // Fall through to shutdown hook as fallback
            }
        } else {
            error_log("EchoVault: No data in request for loan $loan_id, will try from meta");
        }
        
        // Otherwise, use shutdown hook to wait for meta to be saved
        add_action('shutdown', function() use ($loan_id) {
            // Verify data is available before generating
            $loan_data = $this->get_loan_data($loan_id);
            if ($loan_data && !$this->schedule_exists($loan_id)) {
                error_log("EchoVault: Generating schedule from meta (shutdown hook) for loan $loan_id");
            $this->auto_generate_schedule($loan_id);
            } else {
                error_log("EchoVault: Cannot generate schedule for loan $loan_id - data: " . ($loan_data ? 'available' : 'missing') . ", exists: " . ($this->schedule_exists($loan_id) ? 'yes' : 'no'));
            }
        }, 999);
    }

    /**
     * Auto-generate repayment schedule when loan is saved (fallback hook)
     */
    public function maybe_generate_schedule_on_save($post_id, $post, $update): void {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (wp_is_post_revision($post_id)) {
            return;
        }
        
        if ($post->post_type !== 'loans') {
            return;
        }
        
        // Only generate on creation, not updates
        if ($update) {
            return;
        }
        
        // Generate for both draft and published loans
        // Check if schedule already exists
        if ($this->schedule_exists($post_id)) {
            return;
        }
        
        // Use shutdown to ensure meta is saved
        add_action('shutdown', function() use ($post_id) {
            $loan_data = $this->get_loan_data($post_id);
            if ($loan_data && !$this->schedule_exists($post_id)) {
                error_log("EchoVault: Generating schedule via save_post hook for loan $post_id");
        $this->auto_generate_schedule($post_id);
            }
        }, 999);
    }

    /**
     * Auto-generate schedule when meta is updated or added (ensures data is saved)
     */
    public function maybe_generate_schedule_on_meta_update($meta_id, $post_id, $meta_key, $meta_value): void {
        // Only process loans post type
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'loans') {
            return;
        }
        
        // Only trigger on key loan fields
        $key_fields = ['loan_amount', 'loan_term', 'loan_interest', 'repayment_method', 'repayment_frequency', 'start_date'];
        if (!in_array($meta_key, $key_fields, true)) {
            return;
        }
        
        // Check if schedule already exists
        if ($this->schedule_exists($post_id)) {
            return;
        }
        
        error_log("EchoVault: Meta updated for loan $post_id - key: $meta_key");
        
        // Check if we now have all required data
        $loan_data = $this->get_loan_data($post_id);
        if ($loan_data) {
            // We have all data - generate immediately!
            error_log("EchoVault: All data available for loan $post_id, generating schedule immediately");
            $this->auto_generate_schedule($post_id);
            return;
        }
        
        // Not all data yet - use transient to debounce and wait for more meta updates
        $transient_key = 'echovault_generate_' . $post_id;
        if (get_transient($transient_key)) {
            return; // Already scheduled/processing
        }
        
        // Set transient for 3 seconds to allow all meta updates to complete
        set_transient($transient_key, true, 3);
        
        // Schedule generation with a delay to ensure all meta is saved
        add_action('shutdown', function() use ($post_id) {
            // Double-check that all required fields are now available
            $loan_data = $this->get_loan_data($post_id);
            if ($loan_data && !$this->schedule_exists($post_id)) {
                error_log("EchoVault: Generating schedule from meta_update shutdown hook for loan $post_id");
            $this->auto_generate_schedule($post_id);
            } else {
                error_log("EchoVault: Data still not complete for loan $post_id");
            }
        }, 999);
    }

    /**
     * Retry generating schedule after delay
     */
    public function retry_generate_schedule($loan_id): void {
        error_log("EchoVault: retry_generate_schedule called for loan $loan_id");
        if ($this->schedule_exists($loan_id)) {
            return;
        }
        
        $loan_data = $this->get_loan_data($loan_id);
        if ($loan_data) {
            error_log("EchoVault: Retry successful - generating schedule for loan $loan_id");
            $this->auto_generate_schedule($loan_id);
        } else {
            error_log("EchoVault: Retry failed - data still not available for loan $loan_id");
        }
    }
    
    /**
     * Check for pending loans that need schedule generation (final fallback)
     */
    public function check_pending_loans(): void {
        global $wpdb;
        
        // Find loans created in the last 10 minutes that might need schedules
        $recent_time = date('Y-m-d H:i:s', strtotime('-10 minutes'));
        $loan_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} 
            WHERE post_type = 'loans' 
            AND post_date >= %s
            AND post_status IN ('publish', 'draft')
            ORDER BY ID DESC
            LIMIT 20",
            $recent_time
        ));
        
        if (empty($loan_ids)) {
            return;
        }
        
        error_log("EchoVault: check_pending_loans found " . count($loan_ids) . " recent loans");
        
        foreach ($loan_ids as $loan_id) {
            // Skip if schedule already exists
            if ($this->schedule_exists($loan_id)) {
                continue;
            }
            
            // Check if we have all required data
            $loan_data = $this->get_loan_data($loan_id);
            if ($loan_data) {
                error_log("EchoVault: check_pending_loans generating schedule for loan $loan_id");
                // Try to generate schedule
                $this->auto_generate_schedule($loan_id);
            } else {
                error_log("EchoVault: check_pending_loans - loan $loan_id missing data");
            }
        }
    }

    /**
     * Get loan data from meta/fields (handles PODs and arrays)
     * 
     * @param int $loan_id Loan post ID
     * @return array|null Array with loan data or null if data is incomplete
     */
    private function get_loan_data(int $loan_id): ?array {
        $loan = get_post($loan_id);
        if (!$loan || $loan->post_type !== 'loans') {
            return null;
        }
        
        // Helper function to get meta field value (handles arrays, PODs, and multiple key formats)
        $get_meta_value = function($key, $default = null) use ($loan_id) {
            // Try PODs first if available
            if (function_exists('pods')) {
                $pod = pods('loans', $loan_id);
                if ($pod && $pod->id()) {
                    $value = $pod->field($key);
                    if ($value !== null && $value !== false && $value !== '') {
                        // Handle arrays from PODs
                        if (is_array($value)) {
                            if (!empty($value) && isset($value[0])) {
                                return is_object($value[0]) && isset($value[0]->ID) ? (string)$value[0]->ID : (string)$value[0];
                            }
                            return $default;
                        }
                        // Handle objects
                        if (is_object($value)) {
                            if (isset($value->ID)) return (string)$value->ID;
                            if (isset($value->id)) return (string)$value->id;
                            return $default;
                        }
                        return (string)$value;
                    }
                }
            }
            
            // Try multiple possible meta key formats
            $possible_keys = [$key, 'meta_' . $key, 'fields_' . $key];
            foreach ($possible_keys as $meta_key) {
                $value = get_post_meta($loan_id, $meta_key, true);
                
                // Handle arrays from post meta
                if (is_array($value)) {
                    if (!empty($value) && isset($value[0])) {
                        $val = (string)$value[0];
                        if ($val !== '' && $val !== '0') {
                            return $val;
                        }
                    }
                    continue;
                }
                
                // Return value if not empty
                if ($value !== null && $value !== false && $value !== '') {
                    return (string)$value;
                }
            }
            
            // Try getting all meta and check manually
            $all_meta = get_post_meta($loan_id);
            foreach ($all_meta as $meta_key => $meta_values) {
                if (strpos($meta_key, $key) !== false) {
                    $value = is_array($meta_values) && isset($meta_values[0]) ? $meta_values[0] : $meta_values;
                    if ($value !== null && $value !== false && $value !== '') {
                        return (string)$value;
                    }
                }
            }
            
            return $default;
        };
        
        // Try to get ALL meta to see what's available
        $all_meta = get_post_meta($loan_id);
        error_log("EchoVault: All meta keys for loan $loan_id: " . implode(', ', array_keys($all_meta)));
        
        // Get loan data from meta/fields - try multiple approaches
        $loan_amount_str = $get_meta_value('loan_amount', '0');
        $loan_term_str = $get_meta_value('loan_term', '0');
        $loan_interest_str = $get_meta_value('loan_interest', '0');
        $repayment_method_str = $get_meta_value('repayment_method', 'Equal Principal');
        $repayment_frequency_str = $get_meta_value('repayment_frequency', 'Monthly');
        $start_date = $get_meta_value('start_date', '');
        
        // Also check if values are in $_POST (for REST API FormData)
        if (empty($loan_amount_str) || $loan_amount_str === '0') {
            $loan_amount_str = isset($_POST['loan_amount']) ? $_POST['loan_amount'] : $loan_amount_str;
        }
        if (empty($loan_term_str) || $loan_term_str === '0') {
            $loan_term_str = isset($_POST['loan_term']) ? $_POST['loan_term'] : $loan_term_str;
        }
        if (empty($start_date)) {
            $start_date = isset($_POST['start_date']) ? $_POST['start_date'] : $start_date;
        }
        if (empty($loan_interest_str) || $loan_interest_str === '0') {
            $loan_interest_str = isset($_POST['loan_interest']) ? $_POST['loan_interest'] : $loan_interest_str;
        }
        if ($repayment_method_str === 'Equal Principal') {
            $repayment_method_str = isset($_POST['repayment_method']) ? $_POST['repayment_method'] : $repayment_method_str;
        }
        if ($repayment_frequency_str === 'Monthly') {
            $repayment_frequency_str = isset($_POST['repayment_frequency']) ? $_POST['repayment_frequency'] : $repayment_frequency_str;
        }
        
        // Convert to proper types
        $loan_amount = floatval($loan_amount_str);
        $loan_term = intval($loan_term_str);
        $loan_interest = floatval($loan_interest_str);
        $repayment_method = trim($repayment_method_str);
        $repayment_frequency = trim($repayment_frequency_str);
        $start_date = trim($start_date);
        
        // If interest rate is 0 or missing, try to get it from the loan product
        if ($loan_interest <= 0) {
            $loan_product_id = $get_meta_value('loan_product_id', '');
            if (!empty($loan_product_id)) {
                $product_interest = get_post_meta($loan_product_id, 'interest_rate', true);
                if (is_array($product_interest)) {
                    $product_interest = isset($product_interest[0]) ? $product_interest[0] : '';
                }
                if (!empty($product_interest) && floatval($product_interest) > 0) {
                    $loan_interest = floatval($product_interest);
                    error_log("EchoVault: Using interest rate from loan product: $loan_interest");
                }
            }
        }
        
        error_log("EchoVault: Extracted values - amount: $loan_amount, term: $loan_term, interest: $loan_interest, date: $start_date");
        
        // Validate required fields
        if ($loan_amount <= 0 || $loan_term <= 0 || empty($start_date)) {
            error_log("EchoVault: Missing required fields - amount: $loan_amount, term: $loan_term, date: '$start_date'");
            return null;
        }
        
        // Validate date format
        $date_obj = DateTime::createFromFormat('Y-m-d', $start_date);
        if (!$date_obj || $date_obj->format('Y-m-d') !== $start_date) {
            return null;
        }
        
        return [
            'loan_amount' => $loan_amount,
            'loan_term' => $loan_term,
            'loan_interest' => $loan_interest,
            'repayment_method' => $repayment_method,
            'repayment_frequency' => $repayment_frequency,
            'start_date' => $start_date,
        ];
    }

    /**
     * Auto-generate schedule for a loan
     */
    private function auto_generate_schedule(int $loan_id): void {
        // Check if schedule already exists
        if ($this->schedule_exists($loan_id)) {
            error_log("EchoVault: Schedule already exists for loan $loan_id");
            return;
        }
        
        // Get loan data using helper method
        $loan_data = $this->get_loan_data($loan_id);
        
        if (!$loan_data) {
            // Log detailed error for debugging
            $loan = get_post($loan_id);
            if (!$loan || $loan->post_type !== 'loans') {
                error_log("EchoVault: Loan $loan_id not found or wrong post type");
                return;
            }
            
            // Try to get raw meta for debugging
            $all_meta = get_post_meta($loan_id);
            $meta_keys = array_keys($all_meta);
            error_log("EchoVault: Missing or invalid data for loan $loan_id. Available meta keys: " . implode(', ', $meta_keys));
            
            // Log specific values for debugging
            $loan_amount = get_post_meta($loan_id, 'loan_amount', true);
            $loan_term = get_post_meta($loan_id, 'loan_term', true);
            $start_date = get_post_meta($loan_id, 'start_date', true);
            error_log("EchoVault: Raw values - amount:" . var_export($loan_amount, true) . " term:" . var_export($loan_term, true) . " date:" . var_export($start_date, true));
            return;
        }
        
        error_log("EchoVault: Auto-generating schedule for loan $loan_id - amount:{$loan_data['loan_amount']} term:{$loan_data['loan_term']} interest:{$loan_data['loan_interest']} method:{$loan_data['repayment_method']} frequency:{$loan_data['repayment_frequency']} start:{$loan_data['start_date']}");
        
        // Generate schedule
        try {
            $count = $this->create_repayment_schedule($loan_id, $loan_data);
            
            if ($count > 0) {
                error_log("EchoVault: Successfully generated $count segments for loan $loan_id");
                // Mark as processed to prevent duplicate attempts
                update_post_meta($loan_id, '_echovault_schedule_generated', time());
            } else {
                error_log("EchoVault: Warning - No segments generated for loan $loan_id (this may indicate an error)");
            }
        } catch (Exception $e) {
            error_log("EchoVault: Error generating schedule for loan $loan_id: " . $e->getMessage());
            error_log("EchoVault: Stack trace: " . $e->getTraceAsString());
        }
    }

    /**
     * Check if repayment schedule already exists for a loan
     */
    private function schedule_exists(int $loan_id): bool {
        global $wpdb;
        $table_name = $this->get_table_name();
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE related_loan = %d",
            $loan_id
        ));
        return (int)$count > 0;
    }

    /**
     * Handle generate repayment schedule API request
     */
    public function handle_generate_schedule(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers immediately - before anything else
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
        }
        
        // Handle OPTIONS preflight
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }

        try {
            $loan_id = intval($request->get_param('loan_id'));
            if (!$loan_id) {
                throw new WP_REST_Exception('invalid_loan_id', 'Loan ID is required.', ['status' => 400]);
            }

            // Get loan data using helper method
            $loan_data = $this->get_loan_data($loan_id);
            
            if (!$loan_data) {
                // Check if loan exists
            $loan = get_post($loan_id);
            if (!$loan || $loan->post_type !== 'loans') {
                throw new WP_REST_Exception('loan_not_found', 'Loan not found.', ['status' => 404]);
            }

                // Get raw values for better error message
                $loan_amount = get_post_meta($loan_id, 'loan_amount', true);
                $loan_term = get_post_meta($loan_id, 'loan_term', true);
            $start_date = get_post_meta($loan_id, 'start_date', true);

                $missing = [];
                if (empty($loan_amount) || floatval($loan_amount) <= 0) $missing[] = 'loan_amount';
                if (empty($loan_term) || intval($loan_term) <= 0) $missing[] = 'loan_term';
                if (empty($start_date)) $missing[] = 'start_date';
                
                $error_msg = 'Loan data is incomplete. Missing or invalid fields: ' . implode(', ', $missing);
                throw new WP_REST_Exception('missing_data', $error_msg, ['status' => 400]);
            }

            // Delete existing schedule if any
            $this->delete_existing_schedule($loan_id);

            // Create new schedule
            $count = $this->create_repayment_schedule($loan_id, $loan_data);

            $response = new WP_REST_Response(
                [
                    'success' => true,
                    'message' => "Repayment schedule generated successfully.",
                    'segments_created' => $count,
                ],
                200
            );
            
            // Ensure CORS headers are in response
            $response->header('Access-Control-Allow-Origin', '*');
            $response->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            $response->header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Requested-With');
            
            return $response;
        } catch (WP_REST_Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => $e->getMessage(),
                    'code' => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
        } catch (Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
        }
    }

    /**
     * Handle register payment API request
     */
    public function handle_register_payment(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers immediately
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }

        try {
            $loan_id = intval($request->get_param('loan_id'));
            $segment_id = intval($request->get_param('segment_id'));
            $paid_interest = floatval($request->get_param('paid_interest') ?: 0);
            $paid_principles = floatval($request->get_param('paid_principles') ?: 0);
            $payment_date = sanitize_text_field($request->get_param('payment_date') ?: date('Y-m-d'));
            $repayment_note = sanitize_text_field($request->get_param('repayment_note') ?: '');

            if (!$loan_id || !$segment_id) {
                throw new WP_REST_Exception('invalid_params', 'Loan ID and Segment ID are required.', ['status' => 400]);
            }

            error_log("EchoVault: Registering payment for loan $loan_id, segment $segment_id - interest: $paid_interest, principal: $paid_principles");

            // Update the segment
            $this->update_payment_segment($segment_id, $paid_interest, $paid_principles, $payment_date, $repayment_note);

            // Recalculate all future segments
            $this->recalculate_future_segments($loan_id, $segment_id);

            // Return updated schedule
            $schedule = $this->get_repayment_schedule_data($loan_id);

            $response = new WP_REST_Response(
                [
                    'success' => true,
                    'message' => 'Payment registered successfully.',
                    'schedule' => $schedule,
                ],
                200
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        } catch (WP_REST_Exception $e) {
            error_log("EchoVault: WP_REST_Exception in handle_register_payment: " . $e->getMessage());
            $response = new WP_REST_Response(
                [
                    'success' => false,
                    'error' => $e->getMessage(),
                    'code' => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        } catch (Exception $e) {
            error_log("EchoVault: Exception in handle_register_payment: " . $e->getMessage());
            error_log("EchoVault: Stack trace: " . $e->getTraceAsString());
            $response = new WP_REST_Response(
                [
                    'success' => false,
                    'error' => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        }
    }

    /**
     * FORCE GENERATE - Direct manual trigger endpoint
     */
    public function handle_force_generate(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers immediately
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
            header('Content-Type: application/json', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }
        
        try {
            $loan_id = intval($request->get_param('loan_id'));
            if (!$loan_id || $loan_id <= 0) {
                error_log("EchoVault: FORCE GENERATE - Invalid loan_id: " . $request->get_param('loan_id'));
                $response = new WP_REST_Response([
                    'success' => false,
                    'error' => 'Loan ID required and must be a positive number'
                ], 400);
                $response->header('Access-Control-Allow-Origin', '*');
                return $response;
            }
            
            error_log("EchoVault: FORCE GENERATE called for loan $loan_id");
            
            // Wait a moment for meta to be saved (if just created)
            sleep(1);
            
            // Delete existing schedule first
            $this->delete_existing_schedule($loan_id);
            
            // Get loan data - try multiple methods
            $loan_data = null;
            
            // Method 1: Direct meta access
            $all_meta = get_post_meta($loan_id);
            $loan_amount = null;
            $loan_term = null;
            $start_date = null;
            $loan_interest = null;
            $repayment_method = null;
            $repayment_frequency = null;
            
            // Check ALL meta keys for our fields
            foreach ($all_meta as $key => $values) {
                $value = is_array($values) && isset($values[0]) ? $values[0] : $values;
                
                if (stripos($key, 'loan_amount') !== false && !$loan_amount) {
                    $loan_amount = $value;
                }
                if (stripos($key, 'loan_term') !== false && !$loan_term) {
                    $loan_term = $value;
                }
                if (stripos($key, 'start_date') !== false && !$start_date) {
                    $start_date = $value;
                }
                if (stripos($key, 'loan_interest') !== false && !$loan_interest) {
                    $loan_interest = $value;
                }
                if (stripos($key, 'repayment_method') !== false && !$repayment_method) {
                    $repayment_method = $value;
                }
                if (stripos($key, 'repayment_frequency') !== false && !$repayment_frequency) {
                    $repayment_frequency = $value;
                }
            }
            
            // If found, build loan_data
            if ($loan_amount && $loan_term && $start_date) {
                $loan_data = [
                    'loan_amount' => floatval($loan_amount),
                    'loan_term' => intval($loan_term),
                    'loan_interest' => floatval($loan_interest ?: 0),
                    'repayment_method' => trim((string)($repayment_method ?: 'Equal Principal')),
                    'repayment_frequency' => trim((string)($repayment_frequency ?: 'Monthly')),
                    'start_date' => trim((string)$start_date),
                ];
                error_log("EchoVault: Found loan data from meta search: amount={$loan_data['loan_amount']}, term={$loan_data['loan_term']}, date={$loan_data['start_date']}");
            }
            
            // Method 2: Try get_loan_data function
            if (!$loan_data) {
                $loan_data = $this->get_loan_data($loan_id);
            }
            
            // Log what we found
            if (!$loan_data) {
                error_log("EchoVault: FORCE GENERATE - No loan data for loan $loan_id");
                error_log("EchoVault: Meta keys found: " . implode(', ', array_keys($all_meta)));
                error_log("EchoVault: Extracted - amount: " . var_export($loan_amount, true) . ", term: " . var_export($loan_term, true) . ", date: " . var_export($start_date, true));
                
                $response = new WP_REST_Response([
                    'success' => false,
                    'error' => 'Loan data not found. Required: loan_amount, loan_term, start_date',
                    'debug' => [
                        'meta_keys' => array_keys($all_meta),
                        'extracted' => [
                            'loan_amount' => $loan_amount,
                            'loan_term' => $loan_term,
                            'start_date' => $start_date,
                        ],
                    ]
                ], 400);
                $response->header('Access-Control-Allow-Origin', '*');
                return $response;
            }
            
            error_log("EchoVault: FORCE GENERATE - Data found: amount={$loan_data['loan_amount']}, term={$loan_data['loan_term']}, date={$loan_data['start_date']}");
            
            // Generate schedule
            $count = $this->create_repayment_schedule($loan_id, $loan_data);
            
            if ($count === 0) {
                error_log("EchoVault: FORCE GENERATE - create_repayment_schedule returned 0 segments");
                $response = new WP_REST_Response([
                    'success' => false,
                    'error' => 'Failed to generate schedule - no segments created'
                ], 500);
                $response->header('Access-Control-Allow-Origin', '*');
                return $response;
            }
            
            $schedule = $this->get_repayment_schedule_data($loan_id);
            
            error_log("EchoVault: FORCE GENERATE - Success! Generated $count segments for loan $loan_id");
            
            $response = new WP_REST_Response([
                'success' => true,
                'message' => "Generated $count segments",
                'segments_created' => $count,
                'schedule' => $schedule
            ], 200);
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
            
        } catch (Exception $e) {
            error_log("EchoVault: FORCE GENERATE error: " . $e->getMessage());
            error_log("EchoVault: FORCE GENERATE stack trace: " . $e->getTraceAsString());
            $response = new WP_REST_Response([
                'success' => false,
                'error' => $e->getMessage(),
                'trace' => WP_DEBUG ? $e->getTraceAsString() : null
            ], 500);
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        }
    }
    
    /**
     * Handle auto-generate schedule request (triggered on-demand)
     */
    public function handle_auto_generate(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers immediately
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }

        try {
            $loan_id = intval($request->get_param('loan_id'));
            if (!$loan_id) {
                throw new WP_REST_Exception('invalid_loan_id', 'Loan ID is required.', ['status' => 400]);
            }

            error_log("EchoVault: handle_auto_generate called for loan $loan_id");

            // Check if schedule already exists
            if ($this->schedule_exists($loan_id)) {
                error_log("EchoVault: Schedule already exists for loan $loan_id");
                $schedule = $this->get_repayment_schedule_data($loan_id);
                $response = new WP_REST_Response(
                    [
                        'success' => true,
                        'message' => 'Schedule already exists.',
                        'schedule' => $schedule,
                    ],
                    200
                );
                $response->header('Access-Control-Allow-Origin', '*');
                return $response;
            }

            // Get loan data and generate
            $loan_data = $this->get_loan_data($loan_id);
            if (!$loan_data) {
                error_log("EchoVault: Missing loan data for loan $loan_id");
                throw new WP_REST_Exception('missing_data', 'Loan data is incomplete. Required: loan_amount, loan_term, start_date', ['status' => 400]);
            }

            error_log("EchoVault: Generating schedule for loan $loan_id via auto-generate endpoint");
            
            // Generate schedule
            $count = $this->create_repayment_schedule($loan_id, $loan_data);
            
            if ($count === 0) {
                error_log("EchoVault: Failed to generate schedule segments for loan $loan_id");
                throw new WP_REST_Exception('generation_failed', 'Failed to generate schedule segments.', ['status' => 500]);
            }

            $schedule = $this->get_repayment_schedule_data($loan_id);

            $response = new WP_REST_Response(
                [
                    'success' => true,
                    'message' => "Repayment schedule generated successfully.",
                    'segments_created' => $count,
                    'schedule' => $schedule,
                ],
                200
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
            
        } catch (WP_REST_Exception $e) {
            error_log("EchoVault: WP_REST_Exception in handle_auto_generate: " . $e->getMessage());
            $response = new WP_REST_Response(
                [
                    'success' => false,
                    'error' => $e->getMessage(),
                    'code' => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        } catch (Exception $e) {
            error_log("EchoVault: Exception in handle_auto_generate: " . $e->getMessage());
            error_log("EchoVault: Stack trace: " . $e->getTraceAsString());
            $response = new WP_REST_Response(
                [
                    'success' => false,
                    'error' => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        }
    }

    /**
     * Handle delete repayment schedule API request
     */
    public function handle_delete_schedule(WP_REST_Request $request): WP_REST_Response {
        // Handle OPTIONS preflight
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }

        try {
            $loan_id = intval($request->get_param('loan_id'));
            if (!$loan_id || $loan_id <= 0) {
                throw new WP_REST_Exception('invalid_loan_id', 'Loan ID is required and must be a positive number.', ['status' => 400]);
            }

            // Delete all schedules for this loan
            $deleted = $this->delete_existing_schedule($loan_id);

            $response = new WP_REST_Response(
                [
                    'success' => true,
                    'message' => "Deleted $deleted repayment schedule row(s) for loan $loan_id",
                    'deleted_count' => $deleted,
                ],
                200
            );
            
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        } catch (WP_REST_Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => $e->getMessage(),
                    'code' => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
        } catch (Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
        }
    }

    /**
     * Handle get repayment schedule API request
     */
    public function handle_get_schedule(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers immediately
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS', false);
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }

        try {
            $loan_id = intval($request->get_param('loan_id'));
            if (!$loan_id) {
                throw new WP_REST_Exception('invalid_loan_id', 'Loan ID is required.', ['status' => 400]);
            }

            error_log("EchoVault: handle_get_schedule called for loan $loan_id");
            $schedule = $this->get_repayment_schedule_data($loan_id);
            error_log("EchoVault: handle_get_schedule returning " . count($schedule) . " segments");

            $response = new WP_REST_Response(
                [
                    'success' => true,
                    'schedule' => $schedule,
                    'count' => count($schedule),
                ],
                200
            );
            
            $response->header('Access-Control-Allow-Origin', '*');
            return $response;
        } catch (WP_REST_Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => $e->getMessage(),
                    'code' => $e->getErrorCode(),
                ],
                $e->getStatus()
            );
        } catch (Exception $e) {
            return new WP_REST_Response(
                [
                    'success' => false,
                    'error' => 'Internal server error: ' . $e->getMessage(),
                ],
                500
            );
        }
    }

    /**
     * Create repayment schedule segments for a loan
     */
    private function create_repayment_schedule(int $loan_id, array $loan_data): int {
        error_log("EchoVault: create_repayment_schedule called for loan $loan_id");
        
        // Verify post type is registered
        if (!post_type_exists(self::REPAYMENT_SCHEDULE_POST_TYPE)) {
            error_log("EchoVault: ERROR - post type '" . self::REPAYMENT_SCHEDULE_POST_TYPE . "' is not registered!");
            // Try to register it now
            $this->register_repayment_schedule_post_type();
            if (!post_type_exists(self::REPAYMENT_SCHEDULE_POST_TYPE)) {
                error_log("EchoVault: ERROR - Failed to register post type!");
                return 0;
            }
        }
        
        // Calculate theoretical schedule first
        $theoretical_schedule = $this->build_schedule($loan_data);
        
        if (empty($theoretical_schedule)) {
            error_log("EchoVault: No theoretical schedule generated for loan $loan_id");
            return 0;
        }
        
        error_log("EchoVault: Generated " . count($theoretical_schedule) . " theoretical schedule rows for loan $loan_id");

        $start_date = new DateTime($loan_data['start_date']);
        $monthly_rate = $loan_data['loan_interest'] / 100; // Monthly rate as decimal (e.g., 0.04 for 4% per month)
        $frequency = $loan_data['repayment_frequency'];
        $count = 0;
        $current_balance = $loan_data['loan_amount'];

        foreach ($theoretical_schedule as $index => $row) {
            // Use the exact dates from build_schedule() to ensure perfect match
            // This ensures the days calculation matches exactly what was used in the interest calculation
            if (isset($row['period_start']) && isset($row['period_end'])) {
                $segment_start = new DateTime($row['period_start']);
                $segment_end = new DateTime($row['period_end']);
                $loan_days = isset($row['days']) ? intval($row['days']) : $segment_start->diff($segment_end)->days;
            } else {
                // Fallback to recalculating (shouldn't happen, but safety net)
                $segment_start = $index === 0 
                    ? clone $start_date 
                    : $this->calculate_segment_start($start_date, $index, $frequency);
                $segment_end = $this->calculate_segment_end($segment_start, $frequency);
                $loan_days = $segment_start->diff($segment_end)->days;
            }

            // Use pre-calculated values from the schedule to ensure exact match
            // These values are calculated in build_schedule() using the correct formula
            $accrued_interest = floatval($row['interest']); // Interest amount for this period
            $principal_payment = floatval($row['principal']); // Principal payment amount for this period
            $remaining_balance = floatval($row['balance']); // Balance after principal payment
            $scheduled_total_payment = $accrued_interest + $principal_payment; // Total scheduled payment

            // Insert directly into custom table
            $this->ensure_table_exists(); // This will also run migration if needed
            global $wpdb;
            $table_name = $this->get_table_name();
            
            $result = $wpdb->insert(
                $table_name,
                [
                    'related_loan' => $loan_id,
                    'segment_start' => $segment_start->format('Y-m-d'),
                    'segment_end' => $segment_end->format('Y-m-d'),
                    'loan_days' => $loan_days,
                    'start_balance' => round($current_balance, 2),
                    'accrued_interest' => round($accrued_interest, 2), // Pre-calculated interest for this period
                    'scheduled_principal' => round($principal_payment, 2), // Scheduled principal payment
                    'scheduled_total_payment' => round($scheduled_total_payment, 2), // Scheduled total payment (Interest + Principal)
                    'paid_interest' => 0, // No payment made yet
                    'paid_principles' => 0, // No payment made yet
                    'total_payment' => 0, // No payment made yet (this is the paid total)
                    'outstanding_interest' => 0.00, // Set to 0.00 for new loans (only calculated when overdue)
                    'remain_balance' => round($remaining_balance, 2), // Balance after principal payment
                    'repayment_status' => 'Pending',
                    'repayment_note' => '',
                ],
                ['%d', '%s', '%s', '%d', '%f', '%f', '%f', '%f', '%f', '%f', '%f', '%f', '%f', '%s', '%s']
            );
            
            if ($result === false) {
                error_log("EchoVault: Failed to insert segment $index for loan $loan_id: " . $wpdb->last_error);
                continue;
            }
            
            $segment_id = $wpdb->insert_id;
            error_log("EchoVault: Successfully inserted segment $index (ID: $segment_id) for loan $loan_id - Start: $current_balance, Interest: $accrued_interest, Principal: $principal_payment, Remaining: $remaining_balance");
                $count++;

            // Update balance for next segment
            $current_balance = $remaining_balance;
        }

        error_log("EchoVault: create_repayment_schedule completed for loan $loan_id - created $count segments");
        return $count;
    }

    /**
     * Calculate segment start date
     */
    private function calculate_segment_start(DateTime $start, int $index, string $frequency): DateTime {
        $date = clone $start;
        switch ($frequency) {
            case 'Weekly':
                $date->modify('+' . $index * 7 . ' days');
                break;
            case 'Fortnightly':
                $date->modify('+' . $index * 14 . ' days');
                break;
            default: // Monthly
                $date->modify('+' . $index . ' months');
        }
        return $date;
    }

    /**
     * Calculate segment end date
     */
    private function calculate_segment_end(DateTime $start, string $frequency): DateTime {
        $end = clone $start;
        switch ($frequency) {
            case 'Weekly':
                $end->modify('+7 days');
                break;
            case 'Fortnightly':
                $end->modify('+14 days');
                break;
            default: // Monthly
                $end->modify('+1 month');
        }
        return $end;
    }

    /**
     * Calculate accrued interest using monthly rate
     * Formula: Balance × Monthly Rate × (Days / 30)
     * 
     * @param float $balance Opening balance for the period
     * @param float $monthly_rate Monthly interest rate as decimal (e.g., 0.04 for 4% per month)
     * @param int $days Number of days in the period
     * @return float Accrued interest amount
     */
    private function calculate_accrued_interest(float $balance, float $monthly_rate, int $days): float {
        return $balance * $monthly_rate * ($days / 30);
    }

    /**
     * Update payment segment
     */
    private function update_payment_segment(int $segment_id, float $paid_interest, float $paid_principles, string $payment_date, string $note): void {
        $this->ensure_table_exists();
        global $wpdb;
        $table_name = $this->get_table_name();
        
        // Get current segment data
        $segment = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE id = %d",
            $segment_id
        ), ARRAY_A);
        
        if (!$segment) {
            throw new WP_REST_Exception('segment_not_found', 'Repayment segment not found.', ['status' => 404]);
        }

        $start_balance = floatval($segment['start_balance']);
        $accrued_interest = floatval($segment['accrued_interest']);
        
        // Add to existing payments (accumulate)
        $existing_paid_interest = floatval($segment['paid_interest'] ?: 0);
        $existing_paid_principles = floatval($segment['paid_principles'] ?: 0);
        
        $new_paid_interest = $existing_paid_interest + $paid_interest;
        $new_paid_principles = $existing_paid_principles + $paid_principles;
        $total_payment = $new_paid_interest + $new_paid_principles;
        $outstanding_interest = max(0, $accrued_interest - $new_paid_interest);
        $remain_balance = max(0, $start_balance - $new_paid_principles);

        // Determine status
        $repayment_status = 'Pending';
        if ($total_payment > 0) {
            if ($new_paid_interest >= $accrued_interest && $new_paid_principles >= ($start_balance * 0.99)) {
                $repayment_status = 'Paid';
            } elseif ($total_payment > 0) {
                $repayment_status = 'Partial';
            }
        }

        // Update custom table
        $result = $wpdb->update(
            $table_name,
            [
                'paid_interest' => round($new_paid_interest, 2),
                'paid_principles' => round($new_paid_principles, 2),
                'total_payment' => round($total_payment, 2),
                'outstanding_interest' => round($outstanding_interest, 2),
                'remain_balance' => round($remain_balance, 2),
                'repayment_status' => $repayment_status,
                'repayment_note' => $note,
            ],
            ['id' => $segment_id],
            ['%f', '%f', '%f', '%f', '%f', '%s', '%s'],
            ['%d']
        );
        
        if ($result === false) {
            error_log("EchoVault: Failed to update segment $segment_id: " . $wpdb->last_error);
            throw new Exception('Failed to update payment segment');
        }
        
        error_log("EchoVault: Updated segment $segment_id - paid interest: $new_paid_interest, paid principal: $new_paid_principles, status: $repayment_status");
    }

    /**
     * Recalculate all future segments after a payment
     */
    private function recalculate_future_segments(int $loan_id, int $paid_segment_id): void {
        $this->ensure_table_exists();
        global $wpdb;
        $table_name = $this->get_table_name();
        
        // Get the paid segment to get the new balance
        $paid_segment = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE id = %d",
            $paid_segment_id
        ), ARRAY_A);
        
        if (!$paid_segment) {
            error_log("EchoVault: Paid segment $paid_segment_id not found for recalculation");
            return;
        }

        $new_balance = floatval($paid_segment['remain_balance']);
        $segment_end = $paid_segment['segment_end'];

        // Get loan interest rate from loan meta (monthly rate, not annual)
        $loan_interest = floatval(get_post_meta($loan_id, 'loan_interest', true) ?: 0);
        $monthly_rate = $loan_interest / 100; // Monthly rate as decimal (e.g., 0.04 for 4% per month)

        // Get all future segments (segment_start > paid_segment_end)
        $future_segments = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table_name 
            WHERE related_loan = %d 
            AND segment_start > %s 
            ORDER BY segment_start ASC",
            $loan_id,
            $segment_end
        ), ARRAY_A);

        $current_balance = $new_balance;
        error_log("EchoVault: Recalculating " . count($future_segments) . " future segments starting from balance: $current_balance");

        foreach ($future_segments as $segment) {
            $segment_id = $segment['id'];
            $segment_start_str = $segment['segment_start'];
            $segment_end_str = $segment['segment_end'];

            if (!$segment_start_str || !$segment_end_str) {
                continue;
            }

            $segment_start = new DateTime($segment_start_str);
            $segment_end = new DateTime($segment_end_str);
            $loan_days = $segment_start->diff($segment_end)->days;

            // Recalculate accrued interest with new balance using: Balance × Monthly Rate × (Days / 30)
            $accrued_interest = $this->calculate_accrued_interest($current_balance, $monthly_rate, $loan_days);

            // Recalculate outstanding interest
            $paid_interest = floatval($segment['paid_interest'] ?: 0);
            $outstanding_interest = max(0, $accrued_interest - $paid_interest);

            // Update remain_balance
            $paid_principles = floatval($segment['paid_principles'] ?: 0);
            $remain_balance = max(0, $current_balance - $paid_principles);

            // Update segment in custom table
            $wpdb->update(
                $table_name,
                [
                    'start_balance' => round($current_balance, 2),
                    'accrued_interest' => round($accrued_interest, 2),
                    'outstanding_interest' => round($outstanding_interest, 2),
                    'remain_balance' => round($remain_balance, 2),
                ],
                ['id' => $segment_id],
                ['%f', '%f', '%f', '%f'],
                ['%d']
            );

            // Update balance for next segment
            $current_balance = $remain_balance;
        }
        
        error_log("EchoVault: Recalculation complete");
    }

    /**
     * Get repayment schedule data for a loan
     */
    private function get_repayment_schedule_data(int $loan_id): array {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("EchoVault: get_repayment_schedule_data called for loan $loan_id");
        }

        global $wpdb;
        $table_name = $this->get_table_name();
        
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table_name WHERE related_loan = %d ORDER BY id ASC",
            $loan_id
        ), ARRAY_A);
        
        $schedule = [];
        foreach ($rows as $row) {
            // Calculate scheduled_principal if not in database (for backward compatibility)
            $scheduled_principal = isset($row['scheduled_principal']) && $row['scheduled_principal'] > 0
                ? (float)$row['scheduled_principal']
                : ((float)$row['start_balance'] - (float)$row['remain_balance']);
            
            // Calculate scheduled_total_payment if not in database (for backward compatibility)
            $scheduled_total_payment = isset($row['scheduled_total_payment']) && $row['scheduled_total_payment'] > 0
                ? (float)$row['scheduled_total_payment']
                : ((float)$row['accrued_interest'] + $scheduled_principal);
            
            $schedule[] = [
                'id' => (int)$row['id'],
                'related_loan' => (int)$row['related_loan'],
                'segment_start' => (string)$row['segment_start'],
                'segment_end' => (string)$row['segment_end'],
                'loan_days' => (int)$row['loan_days'],
                'start_balance' => (float)$row['start_balance'],
                'accrued_interest' => (float)$row['accrued_interest'],
                'scheduled_principal' => $scheduled_principal,
                'scheduled_total_payment' => $scheduled_total_payment,
                'paid_interest' => (float)$row['paid_interest'],
                'paid_principles' => (float)$row['paid_principles'],
                'total_payment' => (float)$row['total_payment'],
                'outstanding_interest' => (float)$row['outstanding_interest'],
                'remain_balance' => (float)$row['remain_balance'],
                'repayment_status' => (string)$row['repayment_status'],
                'repayment_note' => (string)$row['repayment_note'],
            ];
        }

        error_log("EchoVault: Returning " . count($schedule) . " segments for loan $loan_id from custom table");
        return $schedule;
    }

    /**
     * Delete existing repayment schedule rows for a loan from the custom table.
     * 
     * @param int $loan_id The loan post ID
     * @return int Number of rows deleted
     */
    private function delete_existing_schedule(int $loan_id): int {
        global $wpdb;
        $table_name = $this->get_table_name();
        
        // First check if table exists
        $table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name));
        if ($table_exists !== $table_name) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("EchoVault: Table $table_name does not exist, cannot delete schedules for loan $loan_id");
            }
            return 0;
        }
        
        // Count rows before deletion for logging
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE related_loan = %d",
            $loan_id
        ));
        
        if ($count > 0) {
            // Delete all schedule rows for this loan
            $deleted = $wpdb->delete(
                $table_name,
                ['related_loan' => $loan_id],
                ['%d']
            );
            
            if ($deleted === false) {
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log("EchoVault: Failed to delete schedules for loan $loan_id: " . $wpdb->last_error);
                }
                return 0;
            }
            
            return (int) $deleted;
        }
        
        return 0;
    }
}

// Instantiate the plugin class
if (class_exists('EchoVault_Loan_Schedule_API')) {
new EchoVault_Loan_Schedule_API();
} else {
    // Log error if class doesn't exist (shouldn't happen, but helps with debugging)
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('EchoVault: Failed to instantiate EchoVault_Loan_Schedule_API class');
    }
}

/**
 * EchoVault client API - return borrower profile for current logged-in user
 *
 * This endpoint looks up the borrower (Pods \"Borrower\" / borrower-profile)
 * whose email_address matches the current WordPress user's email. It is used
 * by the client portal so each user only ever sees their own borrower profile.
 *
 * Route: GET /wp-json/echovault/v1/me/borrower
 */
add_action('rest_api_init', function () {
    register_rest_route(
        'echovault/v1',
        '/me/borrower',
        [
            'methods'             => 'GET',
            'callback'            => 'echovault_get_current_user_borrower',
            // JWT authentication plugin will set the current user based on
            // the Authorization header. We also allow manual JWT decoding
            // in the callback, so no extra permission check here.
            'permission_callback' => '__return_true',
        ]
    );
});

/**
 * REST callback: return borrower profile linked to current user.
 *
 * Matching rule:
 *   borrower.email_address === wp_users.user_email
 *
 * If no borrower is found, returns 404 so the frontend can show a clear message.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function echovault_get_current_user_borrower( WP_REST_Request $request ) {
    $email = '';

    // 1) Try WordPress current user (works when logged in via cookies)
    $user = wp_get_current_user();
    if ( $user && ! empty( $user->user_email ) ) {
        $email = strtolower( trim( $user->user_email ) );
    }

    // 2) If no email yet, try to decode JWT from Authorization header
    if ( empty( $email ) ) {
        $auth_header = $request->get_header( 'authorization' );
        if ( $auth_header && stripos( $auth_header, 'bearer ' ) === 0 ) {
            $token = trim( substr( $auth_header, 7 ) );
            $parts = explode( '.', $token );
            if ( count( $parts ) === 3 ) {
                $payload = json_decode(
                    base64_decode( strtr( $parts[1], '-_', '+/' ) ),
                    true
                );
                if ( is_array( $payload ) ) {
                    $possible_email =
                        $payload['data']['user']['user_email'] ??
                        $payload['data']['user_email'] ??
                        $payload['user_email'] ??
                        $payload['email'] ??
                        '';
                    if ( ! empty( $possible_email ) ) {
                        $email = strtolower( trim( $possible_email ) );
                    }
                }
            }
        }
    }

    if ( empty( $email ) ) {
        return new WP_REST_Response(
            [
                'success' => false,
                'error'   => 'Unable to determine user email from session or token.',
            ],
            401
        );
    }

    // Query borrower-profile posts by PODS field \"email_address\"
    // Pods registers its fields as post meta with the same name.
    $query = new WP_Query(
        [
            'post_type'      => 'borrower-profile',
            'posts_per_page' => 1,
            'post_status'    => [ 'publish', 'draft' ],
            'meta_query'     => [
                [
                    'key'     => 'email_address',
                    'value'   => $email,
                    'compare' => '=',
                ],
            ],
        ]
    );

    if ( ! $query->have_posts() ) {
        // Nothing matched this email
        return new WP_REST_Response(
            [
                'success' => false,
                'error'   => 'No borrower profile found for this user.',
            ],
            404
        );
    }

    $post = $query->posts[0];

    // Build a simple payload with the same fields the frontend needs.
    $data = [
        'id'                => $post->ID,
        'title'             => get_the_title( $post ),
        'first_name'        => get_post_meta( $post->ID, 'first_name', true ),
        'last_name'         => get_post_meta( $post->ID, 'last_name', true ),
        'email_address'     => get_post_meta( $post->ID, 'email_address', true ),
        'borrower_id'       => get_post_meta( $post->ID, 'borrower_id', true ),
        'date_of_birth'     => get_post_meta( $post->ID, 'date_of_birth', true ),
        'mobile_number'     => get_post_meta( $post->ID, 'mobile_number', true ),
        'registration_number' => get_post_meta( $post->ID, 'registration_number', true ),
        'home_address'      => get_post_meta( $post->ID, 'home_address', true ),
        'social_link_1'     => get_post_meta( $post->ID, 'social_link_1', true ),
        'social_link_2'     => get_post_meta( $post->ID, 'social_link_2', true ),
        'visa_type'         => get_post_meta( $post->ID, 'visa_type', true ),
        'visa_expiry_date'  => get_post_meta( $post->ID, 'visa_expiry_date', true ),
        'employment_status' => get_post_meta( $post->ID, 'employment_status', true ),
        'work_rights'       => get_post_meta( $post->ID, 'work_rights', true ),
        'employer_name'     => get_post_meta( $post->ID, 'employer_name', true ),
        'job_title'         => get_post_meta( $post->ID, 'job_title', true ),
        'monthly_income_aud' => get_post_meta( $post->ID, 'monthly_income_aud', true ),
        'employment_start_date' => get_post_meta( $post->ID, 'employment_start_date', true ),
        'employer_phone'    => get_post_meta( $post->ID, 'employer_phone', true ),
        'employer_email'    => get_post_meta( $post->ID, 'employer_email', true ),
        'employer_address'  => get_post_meta( $post->ID, 'employer_address', true ),
        'marital_status'    => get_post_meta( $post->ID, 'marital_status', true ),
        'family_relationship' => get_post_meta( $post->ID, 'family_relationship', true ),
        'family_member_full_name' => get_post_meta( $post->ID, 'family_member_full_name', true ),
        'family_member_phone' => get_post_meta( $post->ID, 'family_member_phone', true ),
        'family_member_email' => get_post_meta( $post->ID, 'family_member_email', true ),
        'bank_name'         => get_post_meta( $post->ID, 'bank_name', true ),
        'account_name'      => get_post_meta( $post->ID, 'account_name', true ),
        'bsb_number'        => get_post_meta( $post->ID, 'bsb_number', true ),
        'account_number'    => get_post_meta( $post->ID, 'account_number', true ),
    ];

    return new WP_REST_Response(
        [
            'success'  => true,
            'borrower' => $data,
        ],
        200
    );
}

