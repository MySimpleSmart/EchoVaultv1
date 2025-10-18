<?php
/*
Plugin Name: Borrower Fields Viewer
Description: Automatically show all Pods custom fields for Borrowers in admin list view.
Version: 1.0
Author: Sean + GPT
*/

if (!defined('ABSPATH')) exit;

// Register admin columns automatically
add_filter('manage_borrowers_posts_columns', function ($columns) {
    global $wpdb;

    // fetch all meta keys related to borrowers CPT
    $meta_keys = $wpdb->get_col("
        SELECT DISTINCT meta_key 
        FROM {$wpdb->postmeta} 
        INNER JOIN {$wpdb->posts} ON {$wpdb->posts}.ID = {$wpdb->postmeta}.post_id
        WHERE {$wpdb->posts}.post_type = 'borrowers'
        AND meta_key NOT LIKE '\_%'
        LIMIT 20
    ");

    // Start new column set
    $new_columns = ['cb' => $columns['cb'] ?? ''];

    // Add each meta key as a column
    foreach ($meta_keys as $key) {
        $label = ucwords(str_replace('_', ' ', $key));
        $new_columns[$key] = $label;
    }

    // Add default Title and Date columns at the end
    $new_columns['title'] = 'Title';
    $new_columns['date'] = 'Date';

    return $new_columns;
});

// Display the field values
add_action('manage_borrowers_posts_custom_column', function ($column, $post_id) {
    $value = get_post_meta($post_id, $column, true);
    if (is_array($value)) {
        $value = implode(', ', $value);
    }
    echo esc_html($value);
}, 10, 2);