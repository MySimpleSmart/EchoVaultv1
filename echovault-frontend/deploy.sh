#!/bin/bash

# EchoVault Deployment Script
# This script helps deploy the React app to Hostinger

echo "🚀 EchoVault Deployment Script"
echo "================================"

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Build directory not found. Running npm run build..."
    npm run build
fi

echo "✅ Build directory found"
echo "📁 Build contents:"
ls -la build/

echo ""
echo "📋 Deployment Instructions:"
echo "=========================="
echo "1. Log into your Hostinger control panel"
echo "2. Go to File Manager"
echo "3. Navigate to your app.echovault.space directory"
echo "4. Delete all existing files (except .htaccess if you have one)"
echo "5. Upload ALL contents from the build/ directory"
echo "6. Make sure index.html is in the root directory"
echo ""
echo "📁 Files to upload:"
echo "- index.html (main file)"
echo "- static/ directory (CSS and JS files)"
echo "- avatars/ directory (avatar images)"
echo "- Logo/ directory (echologo.png)"
echo "- favicon.ico, manifest.json, robots.txt"
echo "(Note: logo192.png and logo512.png are intentionally not used)"
echo ""
echo "🔧 Alternative: Use FTP/SFTP"
echo "Host: 93.127.165.86"
echo "Upload the build/ directory contents to the root"
echo ""
echo "✅ After deployment, your app will be available at:"
echo "https://app.echovault.space"
