/**
 * Activity Logs Page JavaScript
 * Handles activity logs display, filtering, search, export, and import functionality
 */

// Global variables
let currentLogs = [];
let totalLogsCount = 0;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeActivityLogs();
});

/**
 * Check if user is authenticated
 */
function checkAuthentication() {
    // Helper function to clear all authentication data
    function clearAllAuthData() {
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        localStorage.removeItem('dashboard_authenticated');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
    }
    
    // Check if user is logged in (uses sessionStorage - clears when tab closes)
    // Also check localStorage for backward compatibility
    const isAuthenticated = sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                           sessionStorage.getItem('isAuthenticated') === 'true' ||
                           localStorage.getItem('dashboard_authenticated') === 'true' ||
                           localStorage.getItem('isAuthenticated') === 'true';
    const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
    
    // Validate user data exists and is valid JSON with required fields
    let user = null;
    if (userStr) {
        try {
            user = JSON.parse(userStr);
            // Ensure user has required fields (email is mandatory) and has admin role
            if (!user || !user.email || typeof user.email !== 'string' || user.email.trim() === '' || user.role !== 'admin') {
                user = null;
            }
        } catch (e) {
            // Invalid JSON, treat as not authenticated
            user = null;
        }
    }
    
    if (!isAuthenticated || !user) {
        // Clear any partial or invalid auth data from both storage types
        clearAllAuthData();
        // Redirect to index page (login) if not authenticated
        window.location.replace('/index.html');
    }
}

/**
 * Get admin email from localStorage (persistent) or sessionStorage
 */
function getAdminEmail() {
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (user) {
        try {
            const userData = JSON.parse(user);
            return userData.email;
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    return null;
}

/**
 * Helper function to make authenticated fetch requests
 */
async function authenticatedFetch(url, options = {}) {
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
        console.error('Admin email not found in sessionStorage/localStorage');
        throw new Error('Admin email not found. Please login again.');
    }
    
    const headers = {
        'X-Admin-Email': adminEmail,
        ...options.headers
    };
    
    return fetch(url, {
        ...options,
        headers
    });
}

/**
 * Initialize Activity Logs Page
 */
function initializeActivityLogs() {
    console.log('Initializing Activity Logs page...');
    
    // Wait a bit to ensure DOM is fully ready
    setTimeout(() => {
        // Load logs on page load
        loadLogs();
        
        // Setup event listeners
        const logTypeFilter = document.getElementById('logTypeFilter');
        if (logTypeFilter) {
            logTypeFilter.addEventListener('change', handleLogFilter);
            console.log('Log type filter initialized');
        } else {
            console.warn('Log type filter element not found');
        }
        
        const logSearch = document.getElementById('logSearch');
        if (logSearch) {
            logSearch.addEventListener('input', handleLogSearch);
            console.log('Log search initialized');
        } else {
            console.warn('Log search element not found');
        }
        
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        if (exportLogsBtn) {
            exportLogsBtn.addEventListener('click', () => handleExportTable('logs', exportLogsBtn));
            console.log('Export button initialized');
        } else {
            console.warn('Export button not found');
        }
        
        const importLogsBtn = document.getElementById('importLogsBtn');
        const importLogsFile = document.getElementById('importLogsFile');
        if (importLogsBtn && importLogsFile) {
            importLogsBtn.addEventListener('click', () => importLogsFile.click());
            importLogsFile.addEventListener('change', (e) => handleImportTable('logs', e.target.files[0], importLogsBtn));
            console.log('Import button initialized');
        } else {
            console.warn('Import button or file input not found');
        }
        
        // Logout button handler
        const logoutBtn = document.getElementById('activityLogsLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
            console.log('Logout button initialized');
        } else {
            console.warn('Logout button not found');
        }
        
        // Auto-refresh logs every 30 seconds
        setInterval(() => {
            const logTypeFilter = document.getElementById('logTypeFilter');
            const logSearch = document.getElementById('logSearch');
            const isLogSearchActive = (logSearch && logSearch.value.trim() !== '') || 
                                      (logTypeFilter && logTypeFilter.value !== '');
            
            // Only refresh if not actively searching/filtering
            if (!isLogSearchActive) {
                const currentLogType = logTypeFilter ? logTypeFilter.value : null;
                console.log('Auto-refreshing logs...');
                loadLogs(currentLogType || null);
            }
        }, 30000);
        
        console.log('Activity Logs page initialized successfully');
    }, 100);
}

/**
 * Load Logs from API
 */
async function loadLogs(logType = null) {
    const tbody = document.getElementById('logsTableBody');
    
    // Show loading state
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
                    Loading logs...
                </td>
            </tr>
        `;
    }
    
    try {
        let url = '/api/admin/logs?limit=500';
        if (logType) {
            url += `&log_type=${encodeURIComponent(logType)}`;
        }
        
        console.log('Fetching logs from:', url);
        const response = await authenticatedFetch(url);
        
        if (!response.ok) {
            // Try to get error message from response
            const text = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = text || errorMessage;
            }
            
            console.error('Failed to fetch logs:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const logs = await response.json();
        console.log('Loaded logs:', logs.length, 'entries');
        
        // Ensure logs is an array
        if (!Array.isArray(logs)) {
            console.error('Invalid response format - expected array, got:', typeof logs);
            throw new Error('Invalid response format from server');
        }
        
        // Store logs for search
        currentLogs = logs;
        totalLogsCount = logs.length;
        
        // Render logs
        renderLogs(logs);
    } catch (error) {
        console.error('Error loading logs:', error);
        const errorMsg = error.message || 'Failed to load logs from server.';
        showNotification(errorMsg, 'error');
        
        // Show error in table
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--accent-color);">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                        Error loading logs: ${escapeHtml(errorMsg)}
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Render Logs
 */
function renderLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) {
        console.error('Logs table body not found');
        return;
    }
    
    // Ensure logs is an array
    if (!Array.isArray(logs)) {
        console.error('Invalid logs data - expected array, got:', typeof logs);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--accent-color);">Invalid data format</td></tr>';
        return;
    }
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-light);">No logs found.</td></tr>';
        return;
    }
    
    console.log('Rendering', logs.length, 'log entries');
    
    tbody.innerHTML = logs.map((log, index) => {
        try {
            // Format date - handle various date formats
            let dateStr = 'N/A';
            if (log.created_at) {
                try {
                    const date = new Date(log.created_at);
                    if (!isNaN(date.getTime())) {
                        dateStr = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });
                    }
                } catch (dateError) {
                    console.warn('Error parsing date for log:', log.id, dateError);
                    dateStr = log.created_at; // Fallback to raw value
                }
            }
            
            // Determine log type badge color
            let typeClass = 'log-type-info';
            const logType = (log.log_type || 'info').toLowerCase();
            if (logType === 'error') {
                typeClass = 'log-type-error';
            } else if (logType === 'warning') {
                typeClass = 'log-type-warning';
            } else if (logType === 'action') {
                typeClass = 'log-type-action';
            }
            
            // Format description with truncation
            let description = '';
            if (log.description) {
                const descText = String(log.description);
                if (descText.length > 100) {
                    description = escapeHtml(descText.substring(0, 100)) + '...';
                } else {
                    description = escapeHtml(descText);
                }
            } else {
                description = '<span style="color: var(--text-light); font-style: italic;">No description</span>';
            }
            
            // Format action
            const action = escapeHtml(log.action || 'N/A');
            
            // Format user email
            let userCell = '<span style="color: var(--text-light);">-</span>';
            if (log.user_email) {
                const email = escapeHtml(log.user_email);
                userCell = `<a href="mailto:${email}" style="color: var(--primary-color); text-decoration: none;">${email}</a>`;
            }
            
            // Format IP address
            const ipAddress = log.ip_address ? escapeHtml(log.ip_address) : '<span style="color: var(--text-light);">-</span>';
            
            return `
                <tr>
                    <td>
                        <span class="log-type-badge ${typeClass}">${escapeHtml(logType)}</span>
                    </td>
                    <td><strong>${action}</strong></td>
                    <td>${description}</td>
                    <td>${userCell}</td>
                    <td>${ipAddress}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        } catch (error) {
            console.error('Error rendering log entry:', error, log);
            return `
                <tr>
                    <td colspan="6" style="color: var(--accent-color);">
                        Error rendering log entry #${index + 1}
                    </td>
                </tr>
            `;
        }
    }).join('');
    
    console.log('Successfully rendered', logs.length, 'log entries');
    
    // Update log count display
    const logsCountElement = document.getElementById('logsCount');
    if (logsCountElement) {
        if (logs.length === totalLogsCount) {
            logsCountElement.textContent = `(${logs.length} ${logs.length === 1 ? 'entry' : 'entries'})`;
        } else {
            logsCountElement.textContent = `(${logs.length} of ${totalLogsCount} ${totalLogsCount === 1 ? 'entry' : 'entries'})`;
        }
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Log Search
 */
function handleLogSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const logTypeFilter = document.getElementById('logTypeFilter');
    const selectedType = logTypeFilter ? logTypeFilter.value : '';
    
    let filtered = currentLogs;
    
    // Filter by type if selected
    if (selectedType) {
        filtered = filtered.filter(log => log.log_type === selectedType);
    }
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(log => 
            (log.action && log.action.toLowerCase().includes(searchTerm)) ||
            (log.description && String(log.description).toLowerCase().includes(searchTerm)) ||
            (log.user_email && log.user_email.toLowerCase().includes(searchTerm)) ||
            (log.ip_address && log.ip_address && String(log.ip_address).toLowerCase().includes(searchTerm))
        );
    }
    
    renderLogs(filtered);
}

/**
 * Log Filter by Type
 */
function handleLogFilter(e) {
    const selectedType = e.target.value;
    const logSearch = document.getElementById('logSearch');
    const searchTerm = logSearch ? logSearch.value.toLowerCase() : '';
    
    let filtered = currentLogs;
    
    // Filter by type if selected
    if (selectedType) {
        filtered = filtered.filter(log => log.log_type === selectedType);
    }
    
    // Apply search term if exists
    if (searchTerm) {
        filtered = filtered.filter(log => 
            (log.action && log.action.toLowerCase().includes(searchTerm)) ||
            (log.description && String(log.description).toLowerCase().includes(searchTerm)) ||
            (log.user_email && log.user_email.toLowerCase().includes(searchTerm)) ||
            (log.ip_address && log.ip_address && String(log.ip_address).toLowerCase().includes(searchTerm))
        );
    }
    
    renderLogs(filtered);
}

/**
 * Handle Table Export
 */
async function handleExportTable(tableName, exportBtn) {
    if (!exportBtn) return;
    
    const originalContent = exportBtn.innerHTML;
    
    // Disable button and show loading state
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> EXPORTING...';
    
    try {
        // Make request to export endpoint
        const response = await authenticatedFetch(`/api/admin/export/table/${tableName}`, {
            method: 'GET',
            headers: {
                'Accept': 'text/csv'
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Export failed: ${response.statusText}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        // Get the blob from response
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${tableName}_export.csv`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Export completed successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification(`Export failed: ${error.message}`, 'error');
    } finally {
        // Re-enable button
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalContent;
    }
}

/**
 * Handle Table Import
 */
async function handleImportTable(tableName, file, importBtn) {
    if (!file || !importBtn) return;
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
        showNotification('Please select a CSV file.', 'error');
        return;
    }
    
    // Confirm import
    if (!confirm(`Are you sure you want to import data from ${file.name} into ${tableName}? This will add new rows to the table.`)) {
        // Reset file input
        const fileInput = document.getElementById('importLogsFile');
        if (fileInput) fileInput.value = '';
        return;
    }
    
    const originalContent = importBtn.innerHTML;
    
    // Disable button and show loading state
    importBtn.disabled = true;
    importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> IMPORTING...';
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // Make request to import endpoint
        const response = await authenticatedFetch(`/api/admin/import/table/${tableName}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Import failed: ${response.statusText}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Show success message with details
        let message = `Import completed successfully!\n\nRows inserted: ${result.rows_inserted}`;
        if (result.total_rows) {
            message += `\nTotal rows processed: ${result.total_rows}`;
        }
        if (result.errors && result.errors.length > 0) {
            message += `\n\nErrors encountered: ${result.error_count}`;
            if (result.errors.length <= 5) {
                message += `\n${result.errors.join('\n')}`;
            } else {
                message += `\nFirst 5 errors:\n${result.errors.slice(0, 5).join('\n')}`;
            }
        }
        alert(message);
        
        // Reload the logs
        await loadLogs();
        
    } catch (error) {
        console.error('Import error:', error);
        showNotification(`Import failed: ${error.message}`, 'error');
    } finally {
        // Re-enable button
        importBtn.disabled = false;
        importBtn.innerHTML = originalContent;
        
        // Reset file input
        const fileInput = document.getElementById('importLogsFile');
        if (fileInput) fileInput.value = '';
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: Inter, sans-serif;
        font-size: 16px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        notification.style.background = '#d4edda';
        notification.style.color = '#155724';
        notification.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        notification.style.background = '#f8d7da';
        notification.style.color = '#721c24';
        notification.style.border = '1px solid #f5c6cb';
    } else {
        notification.style.background = 'var(--primary-lightest)';
        notification.style.color = 'var(--primary-color)';
        notification.style.border = '1px solid var(--primary-lighter)';
    }
    
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Get user email before clearing session
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
        let userEmail = null;
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                userEmail = user.email || null;
            } catch (e) {
                // Ignore parse errors
            }
        }
        
        // Track logout event before clearing session
        if (userEmail && window.trackEvent) {
            window.trackEvent('user_logout', `User logged out: ${userEmail}`, {
                logout_timestamp: new Date().toISOString(),
                logout_page: window.location.pathname
            });
        }
        
        // Cleanup session manager
        if (window.SessionManager) {
            window.SessionManager.cleanup();
        }
        
        // Clear all authentication data from both sessionStorage and localStorage
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        localStorage.removeItem('dashboard_authenticated');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('userEmail');
        // Redirect to home page
        window.location.href = '/index.html';
    }
}
