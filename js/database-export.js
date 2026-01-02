/**
 * Database Export Page JavaScript
 * Handles database export functionality
 */

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    
    // Export button click handler
    const exportBtn = document.getElementById('exportDatabaseBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportDatabase);
    }
    
    // Logout button handler
    const logoutBtn = document.getElementById('databaseLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
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
            // Ensure user has required fields (email is mandatory)
            if (!user || !user.email || typeof user.email !== 'string' || user.email.trim() === '') {
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
 * Handle database export
 */
async function handleExportDatabase() {
    const exportBtn = document.getElementById('exportDatabaseBtn');
    const exportStatus = document.getElementById('exportStatus');
    const exportMessage = document.getElementById('exportMessage');
    
    // Disable button and show loading state
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Exporting...';
    
    // Show status message
    exportStatus.style.display = 'block';
    exportMessage.textContent = 'Preparing export...';
    exportMessage.style.background = 'var(--primary-lightest)';
    exportMessage.style.color = 'var(--primary-color)';
    exportMessage.style.border = '1px solid var(--primary-lighter)';
    
    try {
        // Make request to export endpoint
        const response = await authenticatedFetch('/api/admin/export/database', {
            method: 'GET',
            headers: {
                'Accept': 'text/csv'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }
        
        // Get the blob from response
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'database_export.csv';
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
        
        // Show success message
        exportMessage.textContent = '✓ Database exported successfully!';
        exportMessage.style.background = '#d4edda';
        exportMessage.style.color = '#155724';
        exportMessage.style.border = '1px solid #c3e6cb';
        
    } catch (error) {
        console.error('Export error:', error);
        
        // Show error message
        exportMessage.textContent = `✗ Export failed: ${error.message}`;
        exportMessage.style.background = '#f8d7da';
        exportMessage.style.color = '#721c24';
        exportMessage.style.border = '1px solid #f5c6cb';
        
    } finally {
        // Re-enable button
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-download" style="margin-right: 0.5rem;"></i>Export Database to CSV';
        
        // Hide status message after 5 seconds
        setTimeout(() => {
            exportStatus.style.display = 'none';
        }, 5000);
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
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

