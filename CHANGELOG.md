# Changelog

All notable changes to EchoVault LMS will be documented in this file.

## [1.2.1] - 2025-01-27

### 🐛 Fixed
- **Bank Accounts Display**: Fixed issue where bank names were not showing for Australian accounts
- **API Array Handling**: Added proper handling for API response fields returned as arrays
- **Table & Modal Views**: Both table and modal now correctly display bank names for all account types

### 🔧 Technical Changes
- Enhanced array detection for `account_type`, `bank_name_au`, and `bank_name_mn` fields
- Updated display logic to handle both string and array formats from API responses
- Improved data extraction for consistent bank name display

### 📁 Files Modified
- `src/BankAccounts.js`: Fixed bank name display logic for Australian and Mongolian accounts

## [1.2.0] - 2025-10-21

### 🎯 Added
- **Sidebar Collapse/Expand**: Complete sidebar collapse functionality with smooth transitions
- **Dynamic Logo Switching**: echologo.png (expanded) ↔ echologo_short.png (collapsed)
- **Smooth Tooltips**: Custom animated tooltips for all collapsed menu items
- **Copyright Footer**: Added '© 2025 EchoVault LMS. Developed by SimpleSmart' with clickable link

### 🔧 Changed
- **Responsive Design**: Sidebar width changes from 256px (w-64) to 64px (w-16)
- **Icon-Only Mode**: Menu items show only icons when collapsed with tooltips
- **Conditional Rendering**: Loans submenu and footer hidden when collapsed
- **Accessibility**: All collapsed elements clickable with proper tooltips

### 🎨 Enhanced
- **Smooth Transitions**: 300ms transition for width changes
- **Hover Effects**: Enhanced hover states for better user feedback
- **Tooltip Animation**: 200ms opacity transitions for smooth tooltips
- **Logo Integration**: Clickable logo expands sidebar when collapsed

### 📁 Files Modified
- `src/Sidebar.js`: Complete sidebar collapse implementation
- `src/Header.js`: Updated notification and help icons
- `public/Logo/echologo_short.png`: Added collapsed sidebar logo
- `public/favicon.ico`: Updated favicon

## [1.1.0] - 2025-10-21

### 🎯 Added
- **Notes Pagination**: Added pagination with 5, 10, 50, 100 items per page
- **@Mention Functionality**: Type @ to mention borrowers in notes
- **Loan Products Layout**: Changed to match Bank Accounts page layout
- **Unsaved Changes Modal**: Fixed modal functionality for Notes section

### 🔧 Changed
- **Notes Per Page**: Default changed to 50 items
- **Button Positioning**: Save/Cancel buttons positioned on right side
- **API Endpoints**: Enhanced error handling for note creation

### 🎨 Enhanced
- **Search/Filter Layout**: 3-column grid layout for better organization
- **Results Display**: Shows filtered results count
- **Mention Dropdown**: Real-time borrower search and selection

## [1.0.0] - 2025-10-21

### 🎯 Initial Release
- **Core Features**: Dashboard, Borrowers, Loans, Bank Accounts, Notes, Reports, Settings
- **User Management**: Admin profiles and borrower management
- **Loan Management**: Loan products, contracts, and calculations
- **Document Management**: File uploads and document viewing
- **Responsive Design**: Mobile-friendly interface
