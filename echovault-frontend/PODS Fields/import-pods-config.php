<?php
/**
 * PODS Configuration Import Script
 * 
 * This script imports the borrower-profile.json configuration into WordPress PODS
 * Run this script in your WordPress admin or via WP-CLI
 * 
 * Usage:
 * 1. Place this file in your WordPress root directory
 * 2. Access it via browser: yoursite.com/import-pods-config.php
 * 3. Or run via WP-CLI: wp eval-file import-pods-config.php
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    // If running directly, load WordPress
    require_once('wp-config.php');
    require_once('wp-load.php');
}

// Check if PODS is active
if (!function_exists('pods')) {
    die('PODS plugin is not active. Please install and activate PODS plugin first.');
}

// Read the JSON configuration
$config_file = __DIR__ . '/borrower-profile.json';
if (!file_exists($config_file)) {
    die('Configuration file not found: ' . $config_file);
}

$config = json_decode(file_get_contents($config_file), true);
if (!$config) {
    die('Invalid JSON configuration file.');
}

echo "<h2>Importing PODS Configuration</h2>\n";

foreach ($config['pods'] as $pod_config) {
    echo "<h3>Processing Pod: {$pod_config['name']}</h3>\n";
    
    // Check if pod already exists
    $existing_pod = pods($pod_config['name']);
    if ($existing_pod->exists()) {
        echo "Pod '{$pod_config['name']}' already exists. Updating fields...\n";
        
        // Update existing pod
        $pod_data = array(
            'label' => $pod_config['label'],
            'description' => $pod_config['description'],
            'type' => $pod_config['type'],
            'public' => $pod_config['public'],
            'show_ui' => $pod_config['show_ui'],
            'show_in_rest' => $pod_config['show_in_rest'],
            'menu_icon' => $pod_config['menu_icon'],
            'supports' => array('title') // Add other supports as needed
        );
        
        $existing_pod->save($pod_data);
    } else {
        echo "Creating new pod: {$pod_config['name']}\n";
        
        // Create new pod
        $pod_data = array(
            'name' => $pod_config['name'],
            'label' => $pod_config['label'],
            'description' => $pod_config['description'],
            'type' => $pod_config['type'],
            'public' => $pod_config['public'],
            'show_ui' => $pod_config['show_ui'],
            'show_in_rest' => $pod_config['show_in_rest'],
            'menu_icon' => $pod_config['menu_icon'],
            'supports' => array('title') // Add other supports as needed
        );
        
        $new_pod = pods_api()->save_pod($pod_data);
        if (!$new_pod) {
            echo "Failed to create pod: {$pod_config['name']}\n";
            continue;
        }
    }
    
    // Process fields
    foreach ($pod_config['fields'] as $field_config) {
        echo "  Processing field: {$field_config['name']}\n";
        
        $field_data = array(
            'name' => $field_config['name'],
            'label' => $field_config['label'],
            'type' => $field_config['type'],
            'required' => isset($field_config['required']) ? $field_config['required'] : false,
            'pod' => $pod_config['name']
        );
        
        // Add field-specific configurations
        if (isset($field_config['pick_custom'])) {
            $field_data['pick_custom'] = $field_config['pick_custom'];
        }
        if (isset($field_config['pick_format_type'])) {
            $field_data['pick_format_type'] = $field_config['pick_format_type'];
        }
        if (isset($field_config['pick_object'])) {
            $field_data['pick_object'] = $field_config['pick_object'];
        }
        
        // Save field
        $field_result = pods_api()->save_field($field_data);
        if ($field_result) {
            echo "    ✓ Field '{$field_config['name']}' saved successfully\n";
        } else {
            echo "    ✗ Failed to save field '{$field_config['name']}'\n";
        }
    }
    
    echo "Completed pod: {$pod_config['name']}\n\n";
}

echo "<h3>Configuration Import Complete!</h3>\n";
echo "<p>Please check your WordPress admin to verify the borrower-profile post type and fields are created correctly.</p>\n";
echo "<p>If you're still having issues, try:</p>\n";
echo "<ul>\n";
echo "<li>Flushing rewrite rules: Go to Settings > Permalinks and click 'Save Changes'</li>\n";
echo "<li>Clearing any caching plugins</li>\n";
echo "<li>Checking that the PODS plugin is active</li>\n";
echo "</ul>\n";

// Flush rewrite rules
flush_rewrite_rules();
echo "<p>Rewrite rules flushed.</p>\n";
?>
