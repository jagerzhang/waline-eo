/**
 * Waline Admin UI
 * A complete admin dashboard for Waline EdgeOne
 * Single HTML file with embedded CSS and JavaScript
 */

export function adminUI(request) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waline 管理后台</title>
  <style>
    /* CSS Variables */
    :root {
      --primary: #27ae60;
      --primary-dark: #219a52;
      --danger: #e74c3c;
      --danger-dark: #c0392b;
      --warning: #f39c12;
      --warning-dark: #d68910;
      --info: #3498db;
      --info-dark: #2980b9;
      --text: #2c3e50;
      --text-light: #7f8c8d;
      --bg: #f5f6fa;
      --card-bg: #ffffff;
      --border: #e1e8ed;
      --shadow: 0 2px 8px rgba(0,0,0,0.1);
      --shadow-lg: 0 4px 16px rgba(0,0,0,0.15);
      --sidebar-width: 240px;
      --header-height: 64px;
      --transition: all 0.3s ease;
    }

    [data-theme="dark"] {
      --text: #ecf0f1;
      --text-light: #95a5a6;
      --bg: #1a1a2e;
      --card-bg: #16213e;
      --border: #0f3460;
      --shadow: 0 2px 8px rgba(0,0,0,0.3);
      --shadow-lg: 0 4px 16px rgba(0,0,0,0.4);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    /* Login Page */
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      padding: 20px;
    }

    .login-box {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    }

    .login-box h1 {
      text-align: center;
      margin-bottom: 8px;
      color: var(--primary);
    }

    .login-box .subtitle {
      text-align: center;
      color: var(--text-light);
      margin-bottom: 30px;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      font-size: 14px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-bg);
      color: var(--text);
      font-size: 14px;
      transition: var(--transition);
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.1);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-danger:hover {
      background: var(--danger-dark);
    }

    .btn-warning {
      background: var(--warning);
      color: white;
    }

    .btn-warning:hover {
      background: var(--warning-dark);
    }

    .btn-info {
      background: var(--info);
      color: white;
    }

    .btn-info:hover {
      background: var(--info-dark);
    }

    .btn-secondary {
      background: var(--border);
      color: var(--text);
    }

    .btn-secondary:hover {
      background: var(--text-light);
      color: white;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-block {
      width: 100%;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Layout */
    .admin-layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--card-bg);
      border-right: 1px solid var(--border);
      position: fixed;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
      transition: var(--transition);
    }

    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-logo {
      width: 40px;
      height: 40px;
      background: var(--primary);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }

    .sidebar-title {
      font-size: 18px;
      font-weight: 600;
    }

    .sidebar-nav {
      padding: 16px 0;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: var(--text);
      text-decoration: none;
      transition: var(--transition);
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      font-size: 14px;
    }

    .nav-item:hover {
      background: var(--bg);
      color: var(--primary);
    }

    .nav-item.active {
      background: rgba(39, 174, 96, 0.1);
      color: var(--primary);
      border-right: 3px solid var(--primary);
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      position: absolute;
      bottom: 0;
      width: 100%;
      background: var(--card-bg);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 500;
    }

    .user-details {
      flex: 1;
      overflow: hidden;
    }

    .user-name {
      font-weight: 500;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 12px;
      color: var(--text-light);
    }

    /* Main Content */
    .main-content {
      flex: 1;
      margin-left: var(--sidebar-width);
      min-height: 100vh;
    }

    /* Header */
    .header {
      height: var(--header-height);
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      color: var(--text);
      font-size: 20px;
      cursor: pointer;
    }

    .header-title {
      font-size: 20px;
      font-weight: 600;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .theme-toggle {
      background: none;
      border: none;
      color: var(--text);
      font-size: 20px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: var(--transition);
    }

    .theme-toggle:hover {
      background: var(--bg);
    }

    .logout-btn {
      background: none;
      border: none;
      color: var(--danger);
      cursor: pointer;
      padding: 8px 12px;
      border-radius: 8px;
      transition: var(--transition);
      font-size: 14px;
    }

    .logout-btn:hover {
      background: rgba(231, 76, 60, 0.1);
    }

    /* Content Area */
    .content {
      padding: 24px;
    }

    /* Page Sections */
    .page {
      display: none;
    }

    .page.active {
      display: block;
    }

    /* Stats Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 20px;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .stat-icon.primary { background: rgba(39, 174, 96, 0.1); color: var(--primary); }
    .stat-icon.warning { background: rgba(243, 156, 18, 0.1); color: var(--warning); }
    .stat-icon.danger { background: rgba(231, 76, 60, 0.1); color: var(--danger); }
    .stat-icon.info { background: rgba(52, 152, 219, 0.1); color: var(--info); }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    .stat-label {
      color: var(--text-light);
      font-size: 14px;
      margin-top: 4px;
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }

    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
    }

    .card-body {
      padding: 24px;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      min-width: 240px;
    }

    .search-box input {
      width: 100%;
      padding: 10px 16px 10px 40px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-bg);
      color: var(--text);
      font-size: 14px;
    }

    .search-box .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-light);
    }

    .filter-select {
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-bg);
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      font-weight: 600;
      color: var(--text-light);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    td {
      font-size: 14px;
    }

    tr:hover {
      background: var(--bg);
    }

    .checkbox-col {
      width: 40px;
    }

    /* Status Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge-approved {
      background: rgba(39, 174, 96, 0.1);
      color: var(--primary);
    }

    .badge-waiting {
      background: rgba(243, 156, 18, 0.1);
      color: var(--warning);
    }

    .badge-spam {
      background: rgba(231, 76, 60, 0.1);
      color: var(--danger);
    }

    .badge-admin {
      background: rgba(52, 152, 219, 0.1);
      color: var(--info);
    }

    .badge-user {
      background: var(--bg);
      color: var(--text-light);
    }

    /* Comment Content */
    .comment-content {
      max-width: 300px;
    }

    .comment-text {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      color: var(--text);
    }

    .comment-meta {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }

    .comment-page {
      color: var(--primary);
      text-decoration: none;
    }

    .comment-page:hover {
      text-decoration: underline;
    }

    /* User Info in Table */
    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-cell-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 500;
      font-size: 14px;
    }

    .user-cell-info {
      display: flex;
      flex-direction: column;
    }

    .user-cell-name {
      font-weight: 500;
    }

    .user-cell-email {
      font-size: 12px;
      color: var(--text-light);
    }

    /* Actions */
    .actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      background: none;
      border: none;
      color: var(--text-light);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: var(--transition);
    }

    .action-btn:hover {
      background: var(--bg);
      color: var(--primary);
    }

    .action-btn.danger:hover {
      color: var(--danger);
    }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 0;
      flex-wrap: wrap;
      gap: 16px;
    }

    .pagination-info {
      color: var(--text-light);
      font-size: 14px;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .page-btn {
      padding: 8px 12px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      border-radius: 6px;
      cursor: pointer;
      transition: var(--transition);
      font-size: 14px;
    }

    .page-btn:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary);
    }

    .page-btn.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: var(--transition);
    }

    .modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .modal {
      background: var(--card-bg);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow: hidden;
      transform: scale(0.9);
      transition: var(--transition);
    }

    .modal-overlay.active .modal {
      transform: scale(1);
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-light);
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Form Styles */
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .form-hint {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }

    .form-check {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .form-check input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    /* Settings Tabs */
    .settings-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      flex-wrap: wrap;
    }

    .settings-tab {
      padding: 10px 20px;
      border: none;
      background: none;
      color: var(--text-light);
      cursor: pointer;
      border-radius: 8px;
      transition: var(--transition);
      font-size: 14px;
    }

    .settings-tab:hover {
      background: var(--bg);
      color: var(--text);
    }

    .settings-tab.active {
      background: var(--primary);
      color: white;
    }

    .settings-panel {
      display: none;
    }

    .settings-panel.active {
      display: block;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .empty-desc {
      color: var(--text-light);
    }

    /* Toast Notifications */
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .toast {
      padding: 16px 20px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--shadow-lg);
      animation: slideIn 0.3s ease;
      min-width: 300px;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast.success { background: var(--primary); }
    .toast.error { background: var(--danger); }
    .toast.warning { background: var(--warning); }
    .toast.info { background: var(--info); }

    /* Loading */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Bulk Actions Bar */
    .bulk-bar {
      display: none;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .bulk-bar.active {
      display: flex;
    }

    .bulk-actions {
      display: flex;
      gap: 8px;
    }

    .bulk-bar .btn {
      background: rgba(255,255,255,0.2);
      color: white;
    }

    .bulk-bar .btn:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Responsive */
    @media (max-width: 768px) {
      :root {
        --sidebar-width: 0;
      }

      .sidebar {
        transform: translateX(-100%);
        width: 260px;
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .main-content {
        margin-left: 0;
      }

      .menu-toggle {
        display: block;
      }

      .header-title {
        font-size: 16px;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .search-box {
        min-width: auto;
      }

      .card-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .pagination {
        flex-direction: column;
        align-items: center;
      }

      .modal {
        width: 95%;
        margin: 20px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }

    /* Chart Placeholder */
    .chart-container {
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
      border-radius: 8px;
      margin-bottom: 24px;
    }

    /* Recent Activity */
    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      transition: var(--transition);
    }

    .activity-item:hover {
      background: var(--bg);
    }

    .activity-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .activity-content {
      flex: 1;
    }

    .activity-text {
      font-size: 14px;
    }

    .activity-time {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }

    /* Toggle Switch */
    .toggle {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--border);
      transition: var(--transition);
      border-radius: 24px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      transition: var(--transition);
      border-radius: 50%;
    }

    .toggle input:checked + .toggle-slider {
      background: var(--primary);
    }

    .toggle input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }

    /* 导入/导出 */
    .file-dropzone {
      border: 2px dashed var(--border);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      transition: var(--transition);
      cursor: pointer;
    }

    .file-dropzone:hover,
    .file-dropzone.dragover {
      border-color: var(--primary);
      background: rgba(39, 174, 96, 0.05);
    }

    .file-dropzone-icon {
      font-size: 48px;
      margin-bottom: 16px;
      color: var(--text-light);
    }

    .file-dropzone-text {
      color: var(--text-light);
      margin-bottom: 8px;
    }

    .file-dropzone-hint {
      font-size: 12px;
      color: var(--text-light);
    }

    /* Hidden */
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <!-- Login Page -->
  <div id="loginPage" class="login-page">
    <div class="login-box">
      <h1>Waline 管理后台</h1>
      <p class="subtitle" id="authSubtitle">登录以管理评论</p>
      <div id="authHint" style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px; color: #1565c0;">
        <strong>首次使用？</strong><br>
        第一个注册的用户将自动成为管理员。<br>
        已有账号？请直接登录。
      </div>
      
      <!-- Login Form -->
      <form id="loginForm">
        <div class="form-group">
          <label for="loginEmail">邮箱</label>
          <input type="email" id="loginEmail" placeholder="请输入邮箱" required>
        </div>
        <div class="form-group">
          <label for="loginPassword">密码</label>
          <input type="password" id="loginPassword" placeholder="请输入密码" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">登录</button>
        <div style="text-align: center; margin-top: 16px;">
          <a href="#" id="showRegister" style="color: var(--primary); text-decoration: none; font-size: 14px;">还没有账号？立即注册</a>
        </div>
      </form>
      
      <!-- Register Form (Hidden by default) -->
      <form id="registerForm" style="display: none;">
        <div class="form-group">
          <label for="registerEmail">邮箱</label>
          <input type="email" id="registerEmail" placeholder="请输入邮箱" required>
        </div>
        <div class="form-group">
          <label for="registerNick">昵称</label>
          <input type="text" id="registerNick" placeholder="请输入昵称" required>
        </div>
        <div class="form-group">
          <label for="registerPassword">密码</label>
          <input type="password" id="registerPassword" placeholder="请输入密码（至少6位）" required minlength="6">
        </div>
        <div class="form-group">
          <label for="registerPasswordConfirm">确认密码</label>
          <input type="password" id="registerPasswordConfirm" placeholder="请再次输入密码" required minlength="6">
        </div>
        <button type="submit" class="btn btn-primary btn-block">注册</button>
        <div style="text-align: center; margin-top: 16px;">
          <a href="#" id="showLogin" style="color: var(--primary); text-decoration: none; font-size: 14px;">已有账号？立即登录</a>
        </div>
      </form>
    </div>
  </div>

  <!-- Admin Layout -->
  <div id="adminLayout" class="admin-layout hidden">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">W</div>
        <span class="sidebar-title">Waline</span>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-item active" data-page="dashboard">
          <span class="nav-icon">📊</span>
          <span>概览</span>
        </button>
        <button class="nav-item" data-page="comments">
          <span class="nav-icon">💬</span>
          <span>评论管理</span>
        </button>
        <button class="nav-item" data-page="users">
          <span class="nav-icon">👥</span>
          <span>用户管理</span>
        </button>
        <button class="nav-item" data-page="settings">
          <span class="nav-icon">⚙️</span>
          <span>系统设置</span>
        </button>
        <button class="nav-item" data-page="data">
          <span class="nav-icon">📁</span>
          <span>数据管理</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar" id="userAvatar">A</div>
          <div class="user-details">
            <div class="user-name" id="userName">Admin</div>
            <div class="user-role" id="userRole">Administrator</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <button class="menu-toggle" id="menuToggle">☰</button>
          <h1 class="header-title" id="pageTitle">概览</h1>
        </div>
        <div class="header-right">
          <button class="theme-toggle" id="themeToggle">🌙</button>
          <button class="logout-btn" id="logoutBtn">退出登录</button>
        </div>
      </header>

      <!-- Content -->
      <div class="content">
        <!-- Dashboard Page -->
        <div id="dashboardPage" class="page active">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon primary">💬</div>
              <div class="stat-content">
                <div class="stat-value" id="statTotalComments">0</div>
                <div class="stat-label">总评论数</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon warning">⏳</div>
              <div class="stat-content">
                <div class="stat-value" id="statPendingComments">0</div>
                <div class="stat-label">待审核</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon danger">🚫</div>
              <div class="stat-content">
                <div class="stat-value" id="statSpamComments">0</div>
                <div class="stat-label">垃圾评论</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon info">👥</div>
              <div class="stat-content">
                <div class="stat-value" id="statTotalUsers">0</div>
                <div class="stat-label">总用户数</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">最近活动</h3>
            </div>
            <div class="card-body">
              <div class="activity-list" id="recentActivity">
                <!-- Activity items will be loaded here -->
              </div>
            </div>
          </div>
        </div>

        <!-- Comments Page -->
        <div id="commentsPage" class="page">
          <div class="bulk-bar" id="bulkBar">
            <span>已选择 <span id="selectedCount">0</span> 项</span>
            <div class="bulk-actions">
              <button class="btn btn-sm" onclick="bulkAction('approve')">通过</button>
              <button class="btn btn-sm" onclick="bulkAction('spam')">标记垃圾</button>
              <button class="btn btn-sm" onclick="bulkAction('delete')">删除</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">评论列表</h3>
              <div class="toolbar">
                <div class="search-box">
                  <span class="search-icon">🔍</span>
                  <input type="text" id="commentSearch" placeholder="搜索评论...">
                </div>
                <select class="filter-select" id="commentFilter">
                  <option value="">全部状态</option>
                  <option value="approved">已通过</option>
                  <option value="waiting">待审核</option>
                  <option value="spam">垃圾评论</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="refreshComments()">🔄 刷新</button>
              </div>
            </div>
            <div class="card-body">
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input type="checkbox" id="selectAll">
                      </th>
                      <th>作者</th>
                      <th>评论内容</th>
                      <th>状态</th>
                      <th>时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody id="commentsTable">
                    <!-- Comments will be loaded here -->
                  </tbody>
                </table>
              </div>
              <div class="pagination">
                <div class="pagination-info">
                  显示 <span id="showingFrom">0</span>-<span id="showingTo">0</span> 条，共 <span id="totalItems">0</span> 条
                </div>
                <div class="pagination-controls" id="paginationControls">
                  <!-- Pagination buttons will be generated here -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Users Page -->
        <div id="usersPage" class="page">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">用户列表</h3>
              <div class="toolbar">
                <div class="search-box">
                  <span class="search-icon">🔍</span>
                  <input type="text" id="userSearch" placeholder="搜索用户...">
                </div>
                <button class="btn btn-primary btn-sm" onclick="refreshUsers()">🔄 刷新</button>
              </div>
            </div>
            <div class="card-body">
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>角色</th>
                      <th>评论数</th>
                      <th>注册时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody id="usersTable">
                    <!-- Users will be loaded here -->
                  </tbody>
                </table>
              </div>
              <div class="pagination">
                <div class="pagination-info">
                  显示 <span id="usersShowingFrom">0</span>-<span id="usersShowingTo">0</span> 条，共 <span id="usersTotalItems">0</span> 条
                </div>
                <div class="pagination-controls" id="usersPaginationControls">
                  <!-- Pagination buttons will be generated here -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Page -->
        <div id="settingsPage" class="page">
          <div class="settings-tabs">
            <button class="settings-tab active" data-tab="site">站点设置</button>
            <button class="settings-tab" data-tab="notification">邮件通知</button>
            <button class="settings-tab" data-tab="security">安全设置</button>
          </div>

          <!-- Site Settings -->
          <div id="siteSettings" class="settings-panel active">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">站点配置</h3>
              </div>
              <div class="card-body">
                <form id="siteSettingsForm">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="siteName">站点名称</label>
                      <input type="text" id="siteName" placeholder="我的博客">
                    </div>
                    <div class="form-group">
                      <label for="siteUrl">站点地址</label>
                      <input type="url" id="siteUrl" placeholder="https://example.com">
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="siteDescription">站点描述</label>
                    <textarea id="siteDescription" rows="3" placeholder="站点描述..."></textarea>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="defaultAvatar">默认头像</label>
                      <select id="defaultAvatar">
                        <option value="identicon">几何图案</option>
                        <option value="mp">神秘人</option>
                        <option value="monsterid">怪物</option>
                        <option value="wavatar">Wavatar</option>
                        <option value="retro">复古</option>
                        <option value="robohash">机器人</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="commentOrder">评论排序</label>
                      <select id="commentOrder">
                        <option value="newest">最新优先</option>
                        <option value="oldest">最早优先</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="requireApproval">
                      <span>新评论需要审核</span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="allowAnonymous">
                      <span>允许匿名评论</span>
                    </label>
                  </div>
                  <button type="submit" class="btn btn-primary">保存设置</button>
                </form>
              </div>
            </div>
          </div>

          <!-- Notification Settings -->
          <div id="notificationSettings" class="settings-panel">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">邮件通知设置</h3>
              </div>
              <div class="card-body">
                <form id="notificationSettingsForm">
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="notifyNewComment">
                      <span>新评论时通知管理员</span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="notifyReply">
                      <span>回复时通知用户</span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label for="adminEmail">管理员邮箱</label>
                    <input type="email" id="adminEmail" placeholder="admin@example.com">
                    <p class="form-hint">接收通知的邮箱地址</p>
                  </div>
                  <div class="form-group">
                    <label for="smtpHost">SMTP 服务器</label>
                    <input type="text" id="smtpHost" placeholder="smtp.example.com">
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="smtpPort">SMTP 端口</label>
                      <input type="number" id="smtpPort" placeholder="587">
                    </div>
                    <div class="form-group">
                      <label for="smtpSecure">安全类型</label>
                      <select id="smtpSecure">
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                        <option value="none">无</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="smtpUser">SMTP 用户名</label>
                      <input type="text" id="smtpUser" placeholder="用户名">
                    </div>
                    <div class="form-group">
                      <label for="smtpPass">SMTP 密码</label>
                      <input type="password" id="smtpPass" placeholder="••••••••">
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">保存设置</button>
                </form>
              </div>
            </div>
          </div>

          <!-- Security Settings -->
          <div id="securitySettings" class="settings-panel">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">安全设置</h3>
              </div>
              <div class="card-body">
                <form id="securitySettingsForm">
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="enableCaptcha">
                      <span>启用验证码</span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label class="form-check">
                      <input type="checkbox" id="enableAkismet">
                      <span>启用 Akismet 垃圾评论检测</span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label for="akismetKey">Akismet API Key</label>
                    <input type="text" id="akismetKey" placeholder="你的 Akismet API 密钥">
                  </div>
                  <div class="form-group">
                    <label for="wordFilter">关键词过滤</label>
                    <textarea id="wordFilter" rows="3" placeholder="垃圾, 广告, 敏感词"></textarea>
                    <p class="form-hint">用逗号分隔要过滤的关键词</p>
                  </div>
                  <div class="form-group">
                    <label for="ipBlacklist">IP 黑名单</label>
                    <textarea id="ipBlacklist" rows="3" placeholder="192.168.1.1, 10.0.0.1"></textarea>
                    <p class="form-hint">用逗号分隔要屏蔽的 IP 地址</p>
                  </div>
                  <div class="form-group">
                    <label for="maxLinks">每条评论最大链接数</label>
                    <input type="number" id="maxLinks" value="3" min="0">
                  </div>
                  <button type="submit" class="btn btn-primary">保存设置</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Management Page -->
        <div id="dataPage" class="page">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">导出数据</h3>
            </div>
            <div class="card-body">
              <p style="margin-bottom: 20px; color: var(--text-light);">以 JSON 格式导出所有评论和用户数据。</p>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="exportData('comments')">导出评论</button>
                <button class="btn btn-primary" onclick="exportData('users')">导出用户</button>
                <button class="btn btn-secondary" onclick="exportData('all')">导出全部</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">导入数据</h3>
            </div>
            <div class="card-body">
              <p style="margin-bottom: 20px; color: var(--text-light);">从 JSON 文件导入评论和用户数据。</p>
              <div class="file-dropzone" id="importDropzone">
                <div class="file-dropzone-icon">📁</div>
                <div class="file-dropzone-text">拖放 JSON 文件到此处或点击浏览</div>
                <div class="file-dropzone-hint">支持 Waline JSON 导出格式</div>
                <input type="file" id="importFile" accept=".json" style="display: none;">
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">危险区域</h3>
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(231, 76, 60, 0.05); border-radius: 8px; border: 1px solid rgba(231, 76, 60, 0.2);">
                  <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">清空所有评论</div>
                    <div style="font-size: 14px; color: var(--text-light);">永久删除所有评论，此操作不可撤销。</div>
                  </div>
                  <button class="btn btn-danger" onclick="confirmClearData('comments')">清空评论</button>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(231, 76, 60, 0.05); border-radius: 8px; border: 1px solid rgba(231, 76, 60, 0.2);">
                  <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">清空所有数据</div>
                    <div style="font-size: 14px; color: var(--text-light);">永久删除所有评论和用户，此操作不可撤销。</div>
                  </div>
                  <button class="btn btn-danger" onclick="confirmClearData('all')">清空全部</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Edit Comment Modal -->
  <div class="modal-overlay" id="editCommentModal">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">编辑评论</h3>
        <button class="modal-close" onclick="closeModal('editCommentModal')">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editCommentForm">
          <input type="hidden" id="editCommentId">
          <div class="form-group">
            <label for="editCommentNick">昵称</label>
            <input type="text" id="editCommentNick">
          </div>
          <div class="form-group">
            <label for="editCommentMail">邮箱</label>
            <input type="email" id="editCommentMail">
          </div>
          <div class="form-group">
            <label for="editCommentLink">网站</label>
            <input type="url" id="editCommentLink">
          </div>
          <div class="form-group">
            <label for="editCommentContent">内容</label>
            <textarea id="editCommentContent" rows="5"></textarea>
          </div>
          <div class="form-group">
            <label for="editCommentStatus">状态</label>
            <select id="editCommentStatus">
              <option value="approved">已通过</option>
              <option value="waiting">待审核</option>
              <option value="spam">垃圾评论</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('editCommentModal')">取消</button>
        <button class="btn btn-primary" onclick="saveComment()">保存修改</button>
      </div>
    </div>
  </div>

  <!-- Edit User Modal -->
  <div class="modal-overlay" id="editUserModal">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">编辑用户</h3>
        <button class="modal-close" onclick="closeModal('editUserModal')">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editUserForm">
          <input type="hidden" id="editUserId">
          <div class="form-group">
            <label for="editUserDisplayName">显示名称</label>
            <input type="text" id="editUserDisplayName">
          </div>
          <div class="form-group">
            <label for="editUserEmail">邮箱</label>
            <input type="email" id="editUserEmail">
          </div>
          <div class="form-group">
            <label for="editUserRole">角色</label>
            <select id="editUserRole">
              <option value="administrator">管理员</option>
              <option value="moderator">版主</option>
              <option value="user">普通用户</option>
            </select>
          </div>
          <div class="form-group">
            <label for="editUserUrl">网站</label>
            <input type="url" id="editUserUrl">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('editUserModal')">取消</button>
        <button class="btn btn-primary" onclick="saveUser()">保存修改</button>
      </div>
    </div>
  </div>

  <!-- Toast Container -->
  <div class="toast-container" id="toastContainer"></div>

  <script>
    // Global State
    const state = {
      token: localStorage.getItem('waline_token'),
      user: JSON.parse(localStorage.getItem('waline_user') || 'null'),
      currentPage: 'dashboard',
      comments: [],
      users: [],
      commentPage: 1,
      userPage: 1,
      commentFilter: '',
      commentSearch: '',
      userSearch: '',
      selectedComments: new Set(),
      darkMode: localStorage.getItem('waline_dark_mode') === 'true'
    };

    // API Client
    const api = {
      async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : \`/api/\${endpoint}\`;
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers
        };
        
        if (state.token) {
          headers['Authorization'] = \`Bearer \${state.token}\`;
        }

        try {
          const response = await fetch(url, {
            ...options,
            headers
          });

          if (response.status === 401) {
            logout();
            return null;
          }

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Request failed');
          }

          return data;
        } catch (error) {
          showToast(error.message, 'error');
          throw error;
        }
      },

      login(email, password) {
        return this.request('token', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
      },

      register(email, password, nick) {
        return this.request('register', {
          method: 'POST',
          body: JSON.stringify({ email, password, nick })
        });
      },

      getComments(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(\`comment?\${query}\`);
      },

      updateComment(id, data) {
        return this.request(\`comment/\${id}\`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      },

      deleteComment(id) {
        return this.request(\`comment/\${id}\`, {
          method: 'DELETE'
        });
      },

      getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(\`user?\${query}\`);
      },

      updateUser(id, data) {
        return this.request(\`user/\${id}\`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      },

      deleteUser(id) {
        return this.request(\`user/\${id}\`, {
          method: 'DELETE'
        });
      },

      getStatistics() {
        return this.request('statistics');
      },

      getSettings() {
        return this.request('settings');
      },

      updateSettings(data) {
        return this.request('settings', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initEventListeners();
      
      if (state.token && state.user) {
        showAdmin();
        loadDashboard();
      } else {
        showLogin();
      }
    });

    // Theme
    function initTheme() {
      if (state.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').textContent = '☀️';
      }
    }

    function toggleTheme() {
      state.darkMode = !state.darkMode;
      localStorage.setItem('waline_dark_mode', state.darkMode);
      
      if (state.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').textContent = '☀️';
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('themeToggle').textContent = '🌙';
      }
    }

    // Event Listeners
    function initEventListeners() {
      // Login & Register
      document.getElementById('loginForm').addEventListener('submit', handleLogin);
      document.getElementById('registerForm').addEventListener('submit', handleRegister);
      
      // Toggle between login and register forms
      document.getElementById('showRegister').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
      });
      document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
      });
      
      // Navigation
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
      });
      
      // Settings tabs
      document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
      });
      
      // Header
      document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
      document.getElementById('themeToggle').addEventListener('click', toggleTheme);
      document.getElementById('logoutBtn').addEventListener('click', logout);
      
      // Comments
      document.getElementById('commentSearch').addEventListener('input', debounce(handleCommentSearch, 300));
      document.getElementById('commentFilter').addEventListener('change', handleCommentFilter);
      document.getElementById('selectAll').addEventListener('change', handleSelectAll);
      
      // Users
      document.getElementById('userSearch').addEventListener('input', debounce(handleUserSearch, 300));
      
      // Settings forms
      document.getElementById('siteSettingsForm').addEventListener('submit', saveSiteSettings);
      document.getElementById('notificationSettingsForm').addEventListener('submit', saveNotificationSettings);
      document.getElementById('securitySettingsForm').addEventListener('submit', saveSecuritySettings);
      
      // Import
      const dropzone = document.getElementById('importDropzone');
      const fileInput = document.getElementById('importFile');
      
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleImport(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          handleImport(e.target.files[0]);
        }
      });
    }

    // Auth
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      try {
        const data = await api.login(email, password);
        if (data && data.data) {
          state.token = data.data.token;
          state.user = data.data;
          localStorage.setItem('waline_token', state.token);
          localStorage.setItem('waline_user', JSON.stringify(state.user));
          showAdmin();
          loadDashboard();
          showToast('欢迎回来！', 'success');
        }
      } catch (error) {
        // Error handled by api client
      }
    }

    async function handleRegister(e) {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value;
      const nick = document.getElementById('registerNick').value;
      const password = document.getElementById('registerPassword').value;
      const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
      
      // Validate password match
      if (password !== passwordConfirm) {
        showToast('两次输入的密码不一致', 'error');
        return;
      }
      
      // Validate password length
      if (password.length < 6) {
        showToast('密码至少需要6位', 'error');
        return;
      }
      
      try {
        const data = await api.register(email, password, nick);
        if (data && data.data) {
          state.token = data.data.token;
          state.user = data.data;
          localStorage.setItem('waline_token', state.token);
          localStorage.setItem('waline_user', JSON.stringify(state.user));
          showAdmin();
          loadDashboard();
          showToast('注册成功！欢迎成为管理员', 'success');
        }
      } catch (error) {
        // Error handled by api client
      }
    }

    function showRegisterForm() {
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'block';
      document.getElementById('authSubtitle').textContent = '注册成为管理员';
      document.getElementById('authHint').innerHTML = '<strong>注册须知</strong><br>第一个注册的用户将自动成为管理员';
    }

    function showLoginForm() {
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('authSubtitle').textContent = '登录以管理评论';
      document.getElementById('authHint').innerHTML = '<strong>首次使用？</strong><br>第一个注册的用户将自动成为管理员。<br>已有账号？请直接登录。';
    }

    function logout() {
      state.token = null;
      state.user = null;
      localStorage.removeItem('waline_token');
      localStorage.removeItem('waline_user');
      showLogin();
    }

    function showLogin() {
      document.getElementById('loginPage').classList.remove('hidden');
      document.getElementById('adminLayout').classList.add('hidden');
    }

    function showAdmin() {
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('adminLayout').classList.remove('hidden');
      
      // Update user info
      if (state.user) {
        document.getElementById('userName').textContent = state.user.display_name || state.user.email;
        document.getElementById('userRole').textContent = state.user.type || 'User';
        document.getElementById('userAvatar').textContent = (state.user.display_name || state.user.email || 'A').charAt(0).toUpperCase();
      }
    }

    // Navigation
    function navigateTo(page) {
      state.currentPage = page;
      
      // Update nav items
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
      });
      
      // Update page title
      const titles = {
        dashboard: '概览',
        comments: '评论管理',
        users: '用户管理',
        settings: '系统设置',
        data: '数据管理'
      };
      document.getElementById('pageTitle').textContent = titles[page];
      
      // Show page
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(page + 'Page').classList.add('active');
      
      // Load data
      if (page === 'dashboard') loadDashboard();
      if (page === 'comments') loadComments();
      if (page === 'users') loadUsers();
      if (page === 'settings') loadSettings();
      
      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
    }

    // Dashboard
    async function loadDashboard() {
      try {
        const stats = await api.getStatistics();
        if (stats && stats.data) {
          document.getElementById('statTotalComments').textContent = stats.data.totalComments || 0;
          document.getElementById('statPendingComments').textContent = stats.data.pendingComments || 0;
          document.getElementById('statSpamComments').textContent = stats.data.spamComments || 0;
          document.getElementById('statTotalUsers').textContent = stats.data.totalUsers || 0;
        }
        
        // Load recent activity
        const comments = await api.getComments({ pageSize: 5 });
        renderRecentActivity(comments?.data?.data || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    }

    function renderRecentActivity(comments) {
      const container = document.getElementById('recentActivity');
      
      if (comments.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-title">暂无最近活动</div></div>';
        return;
      }
      
      container.innerHTML = comments.map(comment => {
        const icons = {
          approved: '✅',
          waiting: '⏳',
          spam: '🚫'
        };
        const iconClass = comment.status || 'waiting';
        
        return \`
          <div class="activity-item">
            <div class="activity-icon \${iconClass}">\${icons[iconClass]}</div>
            <div class="activity-content">
              <div class="activity-text">
                <strong>\${escapeHtml(comment.nick)}</strong> 评论了 <a href="\${comment.url}" class="comment-page" target="_blank">\${escapeHtml(comment.url)}</a>
              </div>
              <div class="activity-time">\${formatDate(comment.createdAt)}</div>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Comments
    async function loadComments() {
      try {
        const params = {
          page: state.commentPage,
          pageSize: 10
        };
        
        if (state.commentFilter) {
          params.status = state.commentFilter;
        }
        
        if (state.commentSearch) {
          params.keyword = state.commentSearch;
        }
        
        const response = await api.getComments(params);
        state.comments = response?.data?.data || [];
        const pagination = response?.data || {};
        
        renderComments(state.comments);
        renderPagination('paginationControls', pagination, 'comment');
        updateShowingInfo('showingFrom', 'showingTo', 'totalItems', pagination);
      } catch (error) {
        console.error('Failed to load comments:', error);
      }
    }

    function renderComments(comments) {
      const tbody = document.getElementById('commentsTable');
      
      if (comments.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6">
              <div class="empty-state">
                <div class="empty-icon">💬</div>
                <div class="empty-title">暂无评论</div>
                <div class="empty-desc">尝试调整筛选条件或搜索关键词</div>
              </div>
            </td>
          </tr>
        \`;
        return;
      }
      
      tbody.innerHTML = comments.map(comment => {
        const statusBadges = {
          approved: '<span class="badge badge-approved">● 已通过</span>',
          waiting: '<span class="badge badge-waiting">● 待审核</span>',
          spam: '<span class="badge badge-spam">● 垃圾评论</span>'
        };
        
        return \`
          <tr>
            <td><input type="checkbox" class="comment-checkbox" value="\${comment.objectId}" \${state.selectedComments.has(comment.objectId) ? 'checked' : ''}></td>
            <td>
              <div class="user-cell">
                <div class="user-cell-avatar">\${(comment.nick || 'A').charAt(0).toUpperCase()}</div>
                <div class="user-cell-info">
                  <span class="user-cell-name">\${escapeHtml(comment.nick)}</span>
                  <span class="user-cell-email">\${escapeHtml(comment.mail)}</span>
                </div>
              </div>
            </td>
            <td>
              <div class="comment-content">
                <div class="comment-text">\${escapeHtml(comment.comment)}</div>
                <div class="comment-meta">
                  On <a href="\${comment.url}" class="comment-page" target="_blank">\${escapeHtml(comment.url)}</a>
                </div>
              </div>
            </td>
            <td>\${statusBadges[comment.status] || statusBadges.waiting}</td>
            <td>\${formatDate(comment.createdAt)}</td>
            <td>
              <div class="actions">
                <button class="action-btn" onclick="editComment('\${comment.objectId}')" title="编辑">✏️</button>
                <button class="action-btn" onclick="approveComment('\${comment.objectId}')" title="通过">✅</button>
                <button class="action-btn" onclick="spamComment('\${comment.objectId}')" title="标记垃圾">🚫</button>
                <button class="action-btn danger" onclick="deleteComment('\${comment.objectId}')" title="删除">🗑️</button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
      
      // Add checkbox listeners
      document.querySelectorAll('.comment-checkbox').forEach(cb => {
        cb.addEventListener('change', handleCommentSelect);
      });
    }

    function handleCommentSearch(e) {
      state.commentSearch = e.target.value;
      state.commentPage = 1;
      loadComments();
    }

    function handleCommentFilter(e) {
      state.commentFilter = e.target.value;
      state.commentPage = 1;
      loadComments();
    }

    function handleCommentSelect(e) {
      const id = e.target.value;
      if (e.target.checked) {
        state.selectedComments.add(id);
      } else {
        state.selectedComments.delete(id);
      }
      updateBulkBar();
    }

    function handleSelectAll(e) {
      const checkboxes = document.querySelectorAll('.comment-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          state.selectedComments.add(cb.value);
        } else {
          state.selectedComments.delete(cb.value);
        }
      });
      updateBulkBar();
    }

    function updateBulkBar() {
      const bulkBar = document.getElementById('bulkBar');
      const count = state.selectedComments.size;
      
      document.getElementById('selectedCount').textContent = count;
      
      if (count > 0) {
        bulkBar.classList.add('active');
      } else {
        bulkBar.classList.remove('active');
        document.getElementById('selectAll').checked = false;
      }
    }

    async function bulkAction(action) {
      const ids = Array.from(state.selectedComments);
      if (ids.length === 0) return;
      
      try {
        for (const id of ids) {
          if (action === 'delete') {
            await api.deleteComment(id);
          } else {
            await api.updateComment(id, { status: action });
          }
        }
        
        state.selectedComments.clear();
        updateBulkBar();
        loadComments();
        showToast(\`\${ids.length} 条评论已\${action === 'delete' ? '删除' : '更新'}\`, 'success');
      } catch (error) {
        console.error('Bulk action failed:', error);
      }
    }

    async function editComment(id) {
      const comment = state.comments.find(c => c.objectId === id);
      if (!comment) return;
      
      document.getElementById('editCommentId').value = comment.objectId;
      document.getElementById('editCommentNick').value = comment.nick || '';
      document.getElementById('editCommentMail').value = comment.mail || '';
      document.getElementById('editCommentLink').value = comment.link || '';
      document.getElementById('editCommentContent').value = comment.comment || '';
      document.getElementById('editCommentStatus').value = comment.status || 'waiting';
      
      openModal('editCommentModal');
    }

    async function saveComment() {
      const id = document.getElementById('editCommentId').value;
      const data = {
        nick: document.getElementById('editCommentNick').value,
        mail: document.getElementById('editCommentMail').value,
        link: document.getElementById('editCommentLink').value,
        comment: document.getElementById('editCommentContent').value,
        status: document.getElementById('editCommentStatus').value
      };
      
      try {
        await api.updateComment(id, data);
        closeModal('editCommentModal');
        loadComments();
        showToast('评论更新成功', 'success');
      } catch (error) {
        console.error('Failed to update comment:', error);
      }
    }

    async function approveComment(id) {
      try {
        await api.updateComment(id, { status: 'approved' });
        loadComments();
        showToast('评论已通过', 'success');
      } catch (error) {
        console.error('Failed to approve comment:', error);
      }
    }

    async function spamComment(id) {
      try {
        await api.updateComment(id, { status: 'spam' });
        loadComments();
        showToast('评论已标记为垃圾', 'success');
      } catch (error) {
        console.error('Failed to mark comment as spam:', error);
      }
    }

    async function deleteComment(id) {
      if (!confirm('确定要删除这条评论吗？')) return;
      
      try {
        await api.deleteComment(id);
        loadComments();
        showToast('评论已删除', 'success');
      } catch (error) {
        console.error('Failed to delete comment:', error);
      }
    }

    function refreshComments() {
      loadComments();
    }

    // Users
    async function loadUsers() {
      try {
        const params = {
          page: state.userPage,
          pageSize: 10
        };
        
        if (state.userSearch) {
          params.keyword = state.userSearch;
        }
        
        const response = await api.getUsers(params);
        state.users = response?.data?.data || [];
        const pagination = response?.data || {};
        
        renderUsers(state.users);
        renderPagination('usersPaginationControls', pagination, 'user');
        updateShowingInfo('usersShowingFrom', 'usersShowingTo', 'usersTotalItems', pagination);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    }

    function renderUsers(users) {
      const tbody = document.getElementById('usersTable');
      
      if (users.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="5">
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-title">暂无用户</div>
                <div class="empty-desc">尝试调整搜索关键词</div>
              </div>
            </td>
          </tr>
        \`;
        return;
      }
      
      tbody.innerHTML = users.map(user => {
        const roleBadges = {
          administrator: '<span class="badge badge-admin">管理员</span>',
          moderator: '<span class="badge badge-info">版主</span>',
          user: '<span class="badge badge-user">用户</span>'
        };
        
        return \`
          <tr>
            <td>
              <div class="user-cell">
                <div class="user-cell-avatar">\${(user.display_name || user.email || 'A').charAt(0).toUpperCase()}</div>
                <div class="user-cell-info">
                  <span class="user-cell-name">\${escapeHtml(user.display_name || user.email)}</span>
                  <span class="user-cell-email">\${escapeHtml(user.email)}</span>
                </div>
              </div>
            </td>
            <td>\${roleBadges[user.type] || roleBadges.user}</td>
            <td>\${user.commentCount || 0}</td>
            <td>\${formatDate(user.createdAt)}</td>
            <td>
              <div class="actions">
                <button class="action-btn" onclick="editUser('\${user.objectId}')" title="编辑">✏️</button>
                <button class="action-btn danger" onclick="deleteUser('\${user.objectId}')" title="删除">🗑️</button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function handleUserSearch(e) {
      state.userSearch = e.target.value;
      state.userPage = 1;
      loadUsers();
    }

    async function editUser(id) {
      const user = state.users.find(u => u.objectId === id);
      if (!user) return;
      
      document.getElementById('editUserId').value = user.objectId;
      document.getElementById('editUserDisplayName').value = user.display_name || '';
      document.getElementById('editUserEmail').value = user.email || '';
      document.getElementById('editUserRole').value = user.type || 'user';
      document.getElementById('editUserUrl').value = user.url || '';
      
      openModal('editUserModal');
    }

    async function saveUser() {
      const id = document.getElementById('editUserId').value;
      const data = {
        display_name: document.getElementById('editUserDisplayName').value,
        email: document.getElementById('editUserEmail').value,
        type: document.getElementById('editUserRole').value,
        url: document.getElementById('editUserUrl').value
      };
      
      try {
        await api.updateUser(id, data);
        closeModal('editUserModal');
        loadUsers();
        showToast('用户更新成功', 'success');
      } catch (error) {
        console.error('Failed to update user:', error);
      }
    }

    async function deleteUser(id) {
      if (!confirm('确定要删除这个用户吗？该用户的所有评论也将被删除。')) return;
      
      try {
        await api.deleteUser(id);
        loadUsers();
        showToast('用户已删除', 'success');
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }

    function refreshUsers() {
      loadUsers();
    }

    // Settings
    async function loadSettings() {
      try {
        const response = await api.getSettings();
        const settings = response?.data || {};
        
        // Site settings
        document.getElementById('siteName').value = settings.siteName || '';
        document.getElementById('siteUrl').value = settings.siteUrl || '';
        document.getElementById('siteDescription').value = settings.siteDescription || '';
        document.getElementById('defaultAvatar').value = settings.defaultAvatar || 'identicon';
        document.getElementById('commentOrder').value = settings.commentOrder || 'newest';
        document.getElementById('requireApproval').checked = settings.requireApproval || false;
        document.getElementById('allowAnonymous').checked = settings.allowAnonymous !== false;
        
        // Notification settings
        document.getElementById('notifyNewComment').checked = settings.notifyNewComment || false;
        document.getElementById('notifyReply').checked = settings.notifyReply !== false;
        document.getElementById('adminEmail').value = settings.adminEmail || '';
        document.getElementById('smtpHost').value = settings.smtpHost || '';
        document.getElementById('smtpPort').value = settings.smtpPort || '';
        document.getElementById('smtpSecure').value = settings.smtpSecure || 'tls';
        document.getElementById('smtpUser').value = settings.smtpUser || '';
        document.getElementById('smtpPass').value = settings.smtpPass || '';
        
        // Security settings
        document.getElementById('enableCaptcha').checked = settings.enableCaptcha || false;
        document.getElementById('enableAkismet').checked = settings.enableAkismet || false;
        document.getElementById('akismetKey').value = settings.akismetKey || '';
        document.getElementById('wordFilter').value = settings.wordFilter || '';
        document.getElementById('ipBlacklist').value = settings.ipBlacklist || '';
        document.getElementById('maxLinks').value = settings.maxLinks || 3;
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }

    function switchSettingsTab(tab) {
      document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
      
      document.querySelectorAll('.settings-panel').forEach(p => {
        p.classList.toggle('active', p.id === tab + 'Settings');
      });
    }

    async function saveSiteSettings(e) {
      e.preventDefault();
      await saveSettings({
        siteName: document.getElementById('siteName').value,
        siteUrl: document.getElementById('siteUrl').value,
        siteDescription: document.getElementById('siteDescription').value,
        defaultAvatar: document.getElementById('defaultAvatar').value,
        commentOrder: document.getElementById('commentOrder').value,
        requireApproval: document.getElementById('requireApproval').checked,
        allowAnonymous: document.getElementById('allowAnonymous').checked
      });
    }

    async function saveNotificationSettings(e) {
      e.preventDefault();
      await saveSettings({
        notifyNewComment: document.getElementById('notifyNewComment').checked,
        notifyReply: document.getElementById('notifyReply').checked,
        adminEmail: document.getElementById('adminEmail').value,
        smtpHost: document.getElementById('smtpHost').value,
        smtpPort: document.getElementById('smtpPort').value,
        smtpSecure: document.getElementById('smtpSecure').value,
        smtpUser: document.getElementById('smtpUser').value,
        smtpPass: document.getElementById('smtpPass').value
      });
    }

    async function saveSecuritySettings(e) {
      e.preventDefault();
      await saveSettings({
        enableCaptcha: document.getElementById('enableCaptcha').checked,
        enableAkismet: document.getElementById('enableAkismet').checked,
        akismetKey: document.getElementById('akismetKey').value,
        wordFilter: document.getElementById('wordFilter').value,
        ipBlacklist: document.getElementById('ipBlacklist').value,
        maxLinks: parseInt(document.getElementById('maxLinks').value) || 3
      });
    }

    async function saveSettings(data) {
      try {
        await api.updateSettings(data);
        showToast('设置保存成功', 'success');
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }

    // Data Management
    async function exportData(type) {
      try {
        let data = {};
        
        if (type === 'comments' || type === 'all') {
          const commentsRes = await api.getComments({ pageSize: 10000 });
          data.comments = commentsRes?.data?.data || [];
        }
        
        if (type === 'users' || type === 'all') {
          const usersRes = await api.getUsers({ pageSize: 10000 });
          data.users = usersRes?.data?.data || [];
        }
        
        data.exportedAt = new Date().toISOString();
        data.version = '1.0';
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`waline-\${type}-\${new Date().toISOString().split('T')[0]}.json\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('数据导出成功', 'success');
      } catch (error) {
        console.error('Export failed:', error);
        showToast('导出失败', 'error');
      }
    }

    async function handleImport(file) {
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!confirm(\`导入 \${data.comments?.length || 0} 条评论和 \${data.users?.length || 0} 个用户？\`)) {
          return;
        }
        
        // Import comments
        if (data.comments && Array.isArray(data.comments)) {
          for (const comment of data.comments) {
            delete comment.objectId; // Let server generate new ID
            await api.request('comment', {
              method: 'POST',
              body: JSON.stringify(comment)
            });
          }
        }
        
        // Import users
        if (data.users && Array.isArray(data.users)) {
          for (const user of data.users) {
            delete user.objectId;
            await api.request('user', {
              method: 'POST',
              body: JSON.stringify(user)
            });
          }
        }
        
        showToast('数据导入成功', 'success');
        loadDashboard();
      } catch (error) {
        console.error('Import failed:', error);
        showToast('导入失败：' + error.message, 'error');
      }
    }

    async function confirmClearData(type) {
      const message = type === 'all' 
        ? '确定要删除所有数据吗？此操作不可撤销！'
        : '确定要删除所有评论吗？此操作不可撤销！';
      
      if (!confirm(message)) return;
      if (!confirm('这是最后一次确认，真的要全部删除吗？')) return;
      
      try {
        if (type === 'comments' || type === 'all') {
          const comments = await api.getComments({ pageSize: 10000 });
          for (const comment of (comments?.data?.data || [])) {
            await api.deleteComment(comment.objectId);
          }
        }
        
        if (type === 'all') {
          const users = await api.getUsers({ pageSize: 10000 });
          for (const user of (users?.data?.data || [])) {
            if (user.objectId !== state.user?.objectId) {
              await api.deleteUser(user.objectId);
            }
          }
        }
        
        showToast('数据清空成功', 'success');
        loadDashboard();
      } catch (error) {
        console.error('Clear data failed:', error);
        showToast('清空数据失败', 'error');
      }
    }

    // Pagination
    function renderPagination(containerId, pagination, type) {
      const container = document.getElementById(containerId);
      const total = pagination?.count || 0;
      const pageSize = pagination?.pageSize || 10;
      const currentPage = type === 'comment' ? state.commentPage : state.userPage;
      const totalPages = Math.ceil(total / pageSize);
      
      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }
      
      let html = '';
      
      // Previous
      html += \`<button class="page-btn" \${currentPage === 1 ? 'disabled' : ''} onclick="goToPage('\${type}', \${currentPage - 1})">←</button>\`;
      
      // Page numbers
      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      
      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }
      
      if (startPage > 1) {
        html += \`<button class="page-btn" onclick="goToPage('\${type}', 1)">1</button>\`;
        if (startPage > 2) html += \`<span class="page-btn" disabled>...</span>\`;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        html += \`<button class="page-btn \${i === currentPage ? 'active' : ''}" onclick="goToPage('\${type}', \${i})">\${i}</button>\`;
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += \`<span class="page-btn" disabled>...</span>\`;
        html += \`<button class="page-btn" onclick="goToPage('\${type}', \${totalPages})">\${totalPages}</button>\`;
      }
      
      // Next
      html += \`<button class="page-btn" \${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage('\${type}', \${currentPage + 1})">→</button>\`;
      
      container.innerHTML = html;
    }

    function goToPage(type, page) {
      if (type === 'comment') {
        state.commentPage = page;
        loadComments();
      } else {
        state.userPage = page;
        loadUsers();
      }
    }

    function updateShowingInfo(fromId, toId, totalId, pagination) {
      const total = pagination?.count || 0;
      const pageSize = pagination?.pageSize || 10;
      const currentPage = pagination?.page || 1;
      const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
      const to = Math.min(currentPage * pageSize, total);
      
      document.getElementById(fromId).textContent = from;
      document.getElementById(toId).textContent = to;
      document.getElementById(totalId).textContent = total;
    }

    // Modal
    function openModal(modalId) {
      document.getElementById(modalId).classList.add('active');
    }

    function closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
    }

    // Toast
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = \`toast \${type}\`;
      toast.textContent = message;
      
      container.appendChild(toast);
      
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Utilities
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatDate(dateString) {
      if (!dateString) return '未知';
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      
      // Less than 1 minute
      if (diff < 60000) return '刚刚';
      
      // Less than 1 hour
      if (diff < 3600000) return \`\${Math.floor(diff / 60000)} 分钟前\`;
      
      // Less than 24 hours
      if (diff < 86400000) return \`\${Math.floor(diff / 3600000)} 小时前\`;
      
      // Less than 7 days
      if (diff < 604800000) return \`\${Math.floor(diff / 86400000)} 天前\`;
      
      return date.toLocaleDateString('zh-CN');
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

export default adminUI;
