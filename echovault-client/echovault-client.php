<?php
/**
 * Plugin Name: EchoVault Client
 * Description: Client-related functionality including welcome emails with password reset link when new users are registered via REST API.
 * Version:     1.0.0
 * Author:      EchoVault
 * Text Domain: echovault-client
 */

if (!defined('ABSPATH')) {
    exit;
}

final class EchoVault_Client {
    
    /**
     * Constructor - Initialize hooks
     */
    public function __construct() {
        // Send welcome email when new user is created via REST API
        add_action('rest_after_insert_user', [$this, 'send_welcome_email_with_credentials'], 10, 3);
        
        // Fallback: Also hook into user_register for cases where REST API hook doesn't fire
        add_action('user_register', [$this, 'send_welcome_email_on_register'], 10, 1);
        
        // Register REST API routes for custom password reset
        add_action('rest_api_init', [$this, 'register_routes']);
        
        // Use template_redirect to serve HTML page directly (bypasses REST API JSON encoding)
        add_action('template_redirect', [$this, 'handle_password_reset_page_redirect']);
    }
    
    /**
     * Fallback method to send welcome email when user is registered
     * This handles cases where rest_after_insert_user might not fire
     * 
     * @param int $user_id The user ID that was just created
     */
    public function send_welcome_email_on_register($user_id): void {
        // Check if this is a REST API request to avoid duplicate emails
        if (defined('REST_REQUEST') && REST_REQUEST) {
            // Let rest_after_insert_user handle it
            return;
        }
        
        // Get the user object
        $user = get_userdata($user_id);
        if (!$user || !$user->user_email) {
            return;
        }
        
        // Call the main email function
        $request = new WP_REST_Request('POST', '/wp/v2/users');
        $this->send_welcome_email_with_credentials($user, $request, true);
    }
    
    /**
     * Handle password reset page via template_redirect (serves raw HTML)
     */
    public function handle_password_reset_page_redirect(): void {
        // Check if this is our password reset page request
        if (!isset($_GET['echovault_reset_password']) || $_GET['echovault_reset_password'] != '1' || empty($_GET['key']) || empty($_GET['login'])) {
            return;
        }
        
        $key = sanitize_text_field($_GET['key']);
        $login = sanitize_text_field($_GET['login']);
        
        // Validate reset key
        $user = check_password_reset_key($key, $login);
        $is_valid = !is_wp_error($user);
        $error_message = '';
        
        if (!$is_valid) {
            if (is_wp_error($user)) {
                $error_message = $user->get_error_message();
            } else {
                $error_message = 'Invalid or expired reset link.';
            }
        }
        
        // Get site name
        $site_name = get_bloginfo('name');
        
        // Set proper headers for HTML
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=UTF-8', true);
            status_header(200);
        }
        
        // Render and output HTML directly
        $this->render_password_reset_html($site_name, $key, $login, $is_valid, $error_message);
        exit;
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes(): void {
        // Password reset API endpoint (for form submission)
        register_rest_route(
            'echovault/v1',
            '/reset-password',
            [
                'methods' => ['POST', 'OPTIONS'],
                'callback' => [$this, 'handle_password_reset'],
                'permission_callback' => '__return_true',
            ]
        );
    }
    
    /**
     * Render password reset HTML page
     */
    private function render_password_reset_html(string $site_name, string $key, string $login, bool $is_valid, string $error_message): void {
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Your Password - <?php echo esc_html($site_name); ?></title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            max-width: 450px;
            width: 100%;
            padding: 32px;
        }
        .logo {
            text-align: center;
            margin-bottom: 32px;
        }
        .logo h1 {
            color: #111827;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .logo p {
            color: #6B7280;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 16px;
        }
        .form-group label {
            display: block;
            color: #374151;
            font-weight: 500;
            margin-bottom: 4px;
            font-size: 14px;
        }
        .input-wrapper {
            position: relative;
        }
        .form-group input {
            width: 100%;
            padding: 8px 12px;
            padding-right: 40px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 16px;
        }
        .form-group input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 1px #2563eb;
        }
        .eye-icon {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            color: #9ca3af;
            width: 20px;
            height: 20px;
        }
        .eye-icon:hover {
            color: #6b7280;
        }
        .error-message {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .success-message {
            background-color: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .btn {
            width: 100%;
            padding: 8px 16px;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 16px;
        }
        .btn:hover {
            background-color: #1d4ed8;
        }
        .btn:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
        }
        .password-requirements {
            background-color: #f9fafb;
            border-left: 3px solid #2563eb;
            padding: 12px;
            margin-top: 12px;
            border-radius: 4px;
            font-size: 12px;
            color: #6b7280;
        }
        .password-requirements ul {
            margin-left: 20px;
            margin-top: 8px;
        }
        .password-requirements li {
            margin-bottom: 4px;
        }
        .back-link {
            text-align: center;
            margin-top: 20px;
        }
        .back-link a {
            color: #2563eb;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1><?php echo esc_html($site_name); ?></h1>
            <p>Set Your Password</p>
        </div>
        
        <?php if (!$is_valid): ?>
            <div class="error-message">
                <?php echo esc_html($error_message); ?>
            </div>
            <div class="back-link">
                <a href="<?php echo esc_url(home_url('/')); ?>">← Back to Home</a>
            </div>
        <?php else: ?>
            <form id="passwordResetForm" method="POST">
                <input type="hidden" name="key" value="<?php echo esc_attr($key); ?>">
                <input type="hidden" name="login" value="<?php echo esc_attr($login); ?>">
                
                <div class="form-group">
                    <label for="password">New Password</label>
                    <div class="input-wrapper">
                        <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
                        <svg id="togglePassword" class="eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="password_confirm">Confirm Password</label>
                    <div class="input-wrapper">
                        <input type="password" id="password_confirm" name="password_confirm" required minlength="8" autocomplete="new-password">
                        <svg id="togglePasswordConfirm" class="eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </div>
                </div>
                
                <div class="password-requirements">
                    <strong>Password Requirements:</strong>
                    <ul>
                        <li>At least 8 characters long</li>
                        <li>Include uppercase and lowercase letters</li>
                        <li>Include at least one number</li>
                    </ul>
                </div>
                
                <div id="errorMessage" class="error-message" style="display: none;"></div>
                <div id="successMessage" class="success-message" style="display: none;"></div>
                
                <button type="submit" class="btn" id="submitBtn">Set Password</button>
            </form>
            
            <div class="back-link">
                <a href="<?php echo esc_url(home_url('/')); ?>">← Back to Home</a>
            </div>
            
            <script>
                // Toggle password visibility
                const passwordInput = document.getElementById('password');
                const passwordConfirmInput = document.getElementById('password_confirm');
                const togglePassword = document.getElementById('togglePassword');
                const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
                
                let showPassword = false;
                let showPasswordConfirm = false;
                
                togglePassword.addEventListener('click', function() {
                    showPassword = !showPassword;
                    passwordInput.type = showPassword ? 'text' : 'password';
                    togglePassword.innerHTML = showPassword ? 
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />' :
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />';
                });
                
                togglePasswordConfirm.addEventListener('click', function() {
                    showPasswordConfirm = !showPasswordConfirm;
                    passwordConfirmInput.type = showPasswordConfirm ? 'text' : 'password';
                    togglePasswordConfirm.innerHTML = showPasswordConfirm ? 
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />' :
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />';
                });
                
                document.getElementById('passwordResetForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const password = passwordInput.value;
                    const passwordConfirm = passwordConfirmInput.value;
                    const errorDiv = document.getElementById('errorMessage');
                    const successDiv = document.getElementById('successMessage');
                    const submitBtn = document.getElementById('submitBtn');
                    
                    // Hide previous messages
                    errorDiv.style.display = 'none';
                    successDiv.style.display = 'none';
                    
                    // Validate passwords match
                    if (password !== passwordConfirm) {
                        errorDiv.textContent = 'Passwords do not match.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Validate password length
                    if (password.length < 8) {
                        errorDiv.textContent = 'Password must be at least 8 characters long.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Disable button
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Setting Password...';
                    
                    try {
                        const formData = new FormData(this);
                        const response = await fetch('<?php echo esc_url(rest_url('echovault/v1/reset-password')); ?>', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            successDiv.textContent = data.message || 'Password set successfully! Redirecting to login...';
                            successDiv.style.display = 'block';
                            
                            // Redirect to login after 2 seconds
                            setTimeout(() => {
                                window.location.href = '<?php echo esc_url(home_url('/')); ?>';
                            }, 2000);
                        } else {
                            errorDiv.textContent = data.message || 'Failed to set password. Please try again.';
                            errorDiv.style.display = 'block';
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Set Password';
                        }
                    } catch (error) {
                        errorDiv.textContent = 'An error occurred. Please try again.';
                        errorDiv.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Set Password';
                    }
                });
            </script>
        <?php endif; ?>
    </div>
</body>
</html>
        <?php
    }
    
    /**
     * Send welcome email with username and password reset link when new user is created
     * Hook: rest_after_insert_user
     * 
     * @param WP_User $user The user object that was just created
     * @param WP_REST_Request $request The REST API request
     * @param bool $creating Whether the user was being created (true) or updated (false)
     */
    public function send_welcome_email_with_credentials($user, $request, $creating): void {
        try {
            // Log that the hook was triggered
            error_log("EchoVault Client: send_welcome_email_with_credentials called - creating: " . ($creating ? 'true' : 'false') . ", user ID: " . ($user ? $user->ID : 'null'));
            
            // Only send email when creating a new user (not updating)
            if (!$creating) {
                error_log("EchoVault Client: Not creating a new user, skipping email");
                return;
            }
            
            if (!$user || !is_a($user, 'WP_User')) {
                error_log("EchoVault Client: Invalid user object");
                return;
            }
            
            if (empty($user->user_email)) {
                error_log("EchoVault Client: User email is empty for user ID: " . $user->ID);
                return;
            }
            
            // Get user details
            $username = $user->user_login;
            $email = $user->user_email;
            
            error_log("EchoVault Client: Preparing to send welcome email to {$email} for username: {$username}");
            
            // Generate password reset link so user can create their own password
            $reset_key = get_password_reset_key($user);
            
            // Check if reset key generation failed
            if (is_wp_error($reset_key)) {
                error_log("EchoVault Client: Failed to generate password reset key for user {$username}: " . $reset_key->get_error_message());
                return;
            }
            
            if (empty($reset_key)) {
                error_log("EchoVault Client: Password reset key is empty for user {$username}");
                return;
            }
            
            // Use custom styled password reset page instead of default WordPress page
            $reset_link = network_site_url("?echovault_reset_password=1&key={$reset_key}&login=" . rawurlencode($username), 'login');
            $first_name = get_user_meta($user->ID, 'first_name', true);
            $last_name = get_user_meta($user->ID, 'last_name', true);
            $display_name = trim($first_name . ' ' . $last_name);
            if (empty($display_name)) {
                $display_name = $username;
            }
            
            // Get site name and domain
            $site_name = get_bloginfo('name');
            $site_url = get_site_url();
            
            if (empty($site_name)) {
                $site_name = 'EchoVault';
            }
            
            // Extract domain from site URL for no-reply email
            $domain = parse_url($site_url, PHP_URL_HOST);
            if (empty($domain)) {
                // Fallback to admin email domain if parsing fails
                $admin_email = get_option('admin_email');
                if (empty($admin_email)) {
                    error_log("EchoVault Client: Cannot determine email domain");
                    return;
                }
                $domain = substr(strrchr($admin_email, "@"), 1);
            }
            
            // Create no-reply email address
            $from_email = 'no-reply@' . $domain;
            
            // Email subject
            $subject = sprintf('[%s] Welcome! Set Your Password', $site_name);
            
            // Email body (HTML format)
            $message = sprintf(
                '<html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f3f4f6; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); overflow: hidden; }
                        .header { background-color: white; padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
                        .header h1 { color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 8px 0; }
                        .header p { color: #6B7280; font-size: 14px; margin: 0; }
                        .content { padding: 32px; background-color: white; }
                        .content p { color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
                        .button-container { text-align: center; margin: 32px 0; }
                        .button { display: inline-block; background-color: #fb8500; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; }
                        .button:hover { background-color: #fca311; }
                        .credentials { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0; }
                        .credentials-label { font-weight: 500; color: #374151; margin-bottom: 8px; font-size: 14px; }
                        .credentials-value { font-size: 16px; color: #111827; font-weight: 500; }
                        .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin: 24px 0; border-radius: 4px; }
                        .warning strong { color: #92400E; }
                        .warning p { color: #92400E; margin: 0; font-size: 14px; }
                        .footer { text-align: center; padding: 24px 32px; color: #6B7280; font-size: 12px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
                        .link-text { font-size: 12px; color: #6B7280; word-break: break-all; margin-top: 8px; }
                        .link-text a { color: #2563eb; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div style="padding: 20px;">
                        <div class="container">
                            <div class="header">
                                <h1>Welcome to %s</h1>
                                <p>Loan Management System</p>
                            </div>
                            <div class="content">
                                <p>Hello %s,</p>
                                <p>Your account has been successfully created. You can log in using the username shown below and a password you create yourself.
                                <br>Please note that the username cannot be changed — you will only be setting a new password.</br>
                                <br>Click the button below to set your password and activate your account.</br></p>
                                
                                <div class="button-container">
                                    <a href="%s" class="button">Create Your Password</a>
                                </div>
                                
                                <div class="credentials">
                                    <div class="credentials-label">Your Username:</div>
                                    <div class="credentials-value">%s</div>
                                </div>
                                
                                <div class="warning">
                                    <strong>Important:</strong>
                                    <p>Please use the button above to set your password. This link will expire in 24 hours for security purposes.</p>
                                </div>
                                
                                <p class="link-text">If the button doesn\'t work, you can click this link:<br><a href="%s">%s</a></p>
                                
                                <p>If you have any questions or need assistance, please don\'t hesitate to contact us.</p>
                                
                                <p style="margin-top: 24px;">Best regards,<br><strong>The %s Team</strong></p>
                            </div>
                            <div class="footer">
                                <p>This is an automated email from %s. Please do not reply to this email.</p>
                            </div>
                        </div>
                    </div>
                </body>
                                </html>',
                esc_html($site_name),      // 1. Welcome to %s
                esc_html($display_name),   // 2. Hello %s
                esc_url($reset_link),      // 3. Button href
                esc_html($username),       // 4. Username value
                esc_url($reset_link),      // 5. Link href
                esc_url($reset_link),      // 6. Link text
                esc_html($site_name),      // 7. The %s Team
                esc_html($site_name)       // 8. Footer text
            );
            
            // Email headers for HTML
            $headers = array(
                'Content-Type: text/html; charset=UTF-8',
                'From: ' . $site_name . ' <' . $from_email . '>'
            );
            
            // Send email
            error_log("EchoVault Client: Attempting to send email to {$email} with subject: {$subject}");
            $mail_sent = wp_mail($email, $subject, $message, $headers);
            
            if (!$mail_sent) {
                error_log("EchoVault Client: wp_mail() returned false - failed to send welcome email to {$email}");
            } else {
                error_log("EchoVault Client: Welcome email sent successfully to {$email} with username: {$username}, reset link: {$reset_link}");
            }
        } catch (Exception $e) {
            error_log("EchoVault Client: Exception in send_welcome_email_with_credentials: " . $e->getMessage() . " - Trace: " . $e->getTraceAsString());
        }
    }
    
    /**
     * Render custom styled password reset page
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|string
     */
    public function render_password_reset_page(WP_REST_Request $request) {
        // Send CORS headers
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS', false);
            header('Access-Control-Allow-Headers: Content-Type, Accept', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }
        
        $key = $request->get_param('key');
        $login = $request->get_param('login');
        
        // Validate reset key
        $user = check_password_reset_key($key, $login);
        $is_valid = !is_wp_error($user);
        $error_message = '';
        
        if (!$is_valid) {
            if (is_wp_error($user)) {
                $error_message = $user->get_error_message();
            } else {
                $error_message = 'Invalid or expired reset link.';
            }
        }
        
        // Get site name
        $site_name = get_bloginfo('name');
        
        // Set proper headers for HTML content BEFORE any output
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=UTF-8', true);
            status_header(200);
        }
        
        // Start output buffering
        ob_start();
        
        // Render custom styled HTML page
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Your Password - <?php echo esc_html($site_name); ?></title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 450px;
            width: 100%;
            padding: 40px;
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo h1 {
            color: #4F46E5;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .logo p {
            color: #6B7280;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            color: #374151;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 16px;
            transition: all 0.3s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #4F46E5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .error-message {
            background-color: #FEE2E2;
            border: 1px solid #FCA5A5;
            color: #DC2626;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .success-message {
            background-color: #D1FAE5;
            border: 1px solid #6EE7B7;
            color: #059669;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .btn {
            width: 100%;
            padding: 14px;
            background-color: #4F46E5;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }
        .btn:hover {
            background-color: #4338CA;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
        }
        .btn:active {
            transform: translateY(0);
        }
        .btn:disabled {
            background-color: #9CA3AF;
            cursor: not-allowed;
            transform: none;
        }
        .password-requirements {
            background-color: #F9FAFB;
            border-left: 3px solid #4F46E5;
            padding: 12px;
            margin-top: 12px;
            border-radius: 4px;
            font-size: 12px;
            color: #6B7280;
        }
        .password-requirements ul {
            margin-left: 20px;
            margin-top: 8px;
        }
        .password-requirements li {
            margin-bottom: 4px;
        }
        .back-link {
            text-align: center;
            margin-top: 20px;
        }
        .back-link a {
            color: #4F46E5;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1><?php echo esc_html($site_name); ?></h1>
            <p>Set Your Password</p>
        </div>
        
        <?php if (!$is_valid): ?>
            <div class="error-message">
                <?php echo esc_html($error_message); ?>
            </div>
            <div class="back-link">
                <a href="<?php echo esc_url(home_url('/')); ?>">← Back to Home</a>
            </div>
        <?php else: ?>
            <form id="passwordResetForm" method="POST">
                <input type="hidden" name="key" value="<?php echo esc_attr($key); ?>">
                <input type="hidden" name="login" value="<?php echo esc_attr($login); ?>">
                
                <div class="form-group">
                    <label for="password">New Password</label>
                    <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
                </div>
                
                <div class="form-group">
                    <label for="password_confirm">Confirm Password</label>
                    <input type="password" id="password_confirm" name="password_confirm" required minlength="8" autocomplete="new-password">
                </div>
                
                <div class="password-requirements">
                    <strong>Password Requirements:</strong>
                    <ul>
                        <li>At least 8 characters long</li>
                        <li>Include uppercase and lowercase letters</li>
                        <li>Include at least one number</li>
                    </ul>
                </div>
                
                <div id="errorMessage" class="error-message" style="display: none;"></div>
                <div id="successMessage" class="success-message" style="display: none;"></div>
                
                <button type="submit" class="btn" id="submitBtn">Set Password</button>
            </form>
            
            <div class="back-link">
                <a href="<?php echo esc_url(home_url('/')); ?>">← Back to Home</a>
            </div>
            
            <script>
                document.getElementById('passwordResetForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const password = document.getElementById('password').value;
                    const passwordConfirm = document.getElementById('password_confirm').value;
                    const errorDiv = document.getElementById('errorMessage');
                    const successDiv = document.getElementById('successMessage');
                    const submitBtn = document.getElementById('submitBtn');
                    
                    // Hide previous messages
                    errorDiv.style.display = 'none';
                    successDiv.style.display = 'none';
                    
                    // Validate passwords match
                    if (password !== passwordConfirm) {
                        errorDiv.textContent = 'Passwords do not match.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Validate password length
                    if (password.length < 8) {
                        errorDiv.textContent = 'Password must be at least 8 characters long.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Disable button
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Setting Password...';
                    
                    try {
                        const formData = new FormData(this);
                        const response = await fetch('<?php echo esc_url(rest_url('echovault/v1/reset-password')); ?>', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            successDiv.textContent = data.message || 'Password set successfully! Redirecting to login...';
                            successDiv.style.display = 'block';
                            
                            // Redirect to login after 2 seconds
                            setTimeout(() => {
                                window.location.href = '<?php echo esc_url(home_url('/')); ?>';
                            }, 2000);
                        } else {
                            errorDiv.textContent = data.message || 'Failed to set password. Please try again.';
                            errorDiv.style.display = 'block';
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Set Password';
                        }
                    } catch (error) {
                        errorDiv.textContent = 'An error occurred. Please try again.';
                        errorDiv.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Set Password';
                    }
                });
            </script>
        <?php endif; ?>
    </div>
</body>
</html>
        <?php
    }
    
    /**
     * Handle password reset submission
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function handle_password_reset(WP_REST_Request $request): WP_REST_Response {
        // Send CORS headers
        if (!headers_sent()) {
            header('Access-Control-Allow-Origin: *', false);
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS', false);
            header('Access-Control-Allow-Headers: Content-Type, Accept', false);
        }
        
        if ($request->get_method() === 'OPTIONS') {
            if (!headers_sent()) {
                status_header(200);
            }
            exit(0);
        }
        
        try {
            $key = $request->get_param('key');
            $login = $request->get_param('login');
            $password = $request->get_param('password');
            $password_confirm = $request->get_param('password_confirm');
            
            // Validate required fields
            if (empty($key) || empty($login) || empty($password)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Missing required fields.'
                ], 400);
            }
            
            // Validate passwords match
            if ($password !== $password_confirm) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Passwords do not match.'
                ], 400);
            }
            
            // Validate password strength
            if (strlen($password) < 8) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Password must be at least 8 characters long.'
                ], 400);
            }
            
            // Check reset key
            $user = check_password_reset_key($key, $login);
            
            if (is_wp_error($user)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => $user->get_error_message() ?: 'Invalid or expired reset link.'
                ], 400);
            }
            
            // Reset password
            reset_password($user, $password);
            
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Password has been set successfully!'
            ], 200);
            
        } catch (Exception $e) {
            error_log("EchoVault Client: Password reset error - " . $e->getMessage());
            return new WP_REST_Response([
                'success' => false,
                'message' => 'An error occurred. Please try again.'
            ], 500);
        }
    }
}

// Instantiate the plugin class
if (class_exists('EchoVault_Client')) {
    new EchoVault_Client();
} else {
    // Log error if class doesn't exist (shouldn't happen, but helps with debugging)
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('EchoVault Client: Failed to instantiate EchoVault_Client class');
    }
}