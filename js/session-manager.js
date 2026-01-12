/**
 * Session Manager
 * Tracks active tabs/windows and automatically logs out when all tabs are closed
 * Uses BroadcastChannel API for cross-tab communication
 */

(function() {
    'use strict';

    const CHANNEL_NAME = 'tsproperties_session_channel';
    const HEARTBEAT_INTERVAL = 2000; // 2 seconds
    const TAB_TIMEOUT = 5000; // 5 seconds - if no heartbeat, consider tab dead
    const INITIAL_CHECK_TIMEOUT = 3000; // 3 seconds to wait for other tabs to respond
    const SESSION_KEY = 'dashboard_authenticated';
    const USER_KEY = 'user';

    let broadcastChannel = null;
    let heartbeatInterval = null;
    let tabId = null;
    let activeTabs = new Map(); // Map<tabId, lastHeartbeat>
    let isInitialized = false;
    let initialCheckDone = false;

    /**
     * Initialize the session manager
     */
    function init() {
        if (isInitialized) return;
        
        // Only initialize if there's a valid active session with user data
        const hasSession = sessionStorage.getItem(SESSION_KEY) === 'true' ||
                          sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                          localStorage.getItem(SESSION_KEY) === 'true' ||
                          localStorage.getItem('dashboard_authenticated') === 'true';
        
        // Also verify user data exists and is valid
        const userStr = sessionStorage.getItem(USER_KEY) || sessionStorage.getItem('user') ||
                       localStorage.getItem(USER_KEY) || localStorage.getItem('user');
        
        let hasValidUser = false;
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                // Ensure user has required fields (email is mandatory) and has admin role
                if (user && user.email && typeof user.email === 'string' && user.email.trim() !== '' && user.role === 'admin') {
                    hasValidUser = true;
                }
            } catch (e) {
                // Invalid JSON, treat as no valid user
                hasValidUser = false;
            }
        }
        
        // Only initialize if there's both a session flag AND valid user data
        if (!hasSession || !hasValidUser) {
            // No valid session, don't initialize
            // Clear any invalid session data
            if (hasSession && !hasValidUser) {
                clearSession();
            }
            return;
        }
        
        // Check if BroadcastChannel is supported
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('BroadcastChannel not supported, falling back to sessionStorage only');
            // Fallback: use sessionStorage only (clears when tab closes)
            useSessionStorageOnly();
            return;
        }

        try {
            broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
            tabId = generateTabId();
            
            // Set up message listener
            broadcastChannel.addEventListener('message', handleMessage);
            
            // Send initial presence message
            sendMessage('tab-opened', { tabId });
            
            // Start heartbeat
            startHeartbeat();
            
            // Set up page unload handler
            setupUnloadHandler();
            
            // Request active tabs list
            sendMessage('request-active-tabs', { tabId });
            
            isInitialized = true;
        } catch (error) {
            console.error('Error initializing session manager:', error);
            useSessionStorageOnly();
        }
    }

    /**
     * Generate a unique ID for this tab
     */
    function generateTabId() {
        return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Send a message to other tabs
     */
    function sendMessage(type, data = {}) {
        if (!broadcastChannel) return;
        
        try {
            broadcastChannel.postMessage({
                type,
                tabId,
                timestamp: Date.now(),
                ...data
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    /**
     * Handle messages from other tabs
     */
    function handleMessage(event) {
        const { type, tabId: senderTabId, timestamp } = event.data;
        
        if (!senderTabId || senderTabId === tabId) return; // Ignore own messages
        
        switch (type) {
            case 'tab-opened':
                activeTabs.set(senderTabId, Date.now());
                // Respond with our presence
                sendMessage('tab-present', { tabId });
                break;
                
            case 'tab-present':
                activeTabs.set(senderTabId, Date.now());
                // Mark that we found other tabs
                initialCheckDone = true;
                break;
                
            case 'tab-closed':
            case 'tab-closing':
                activeTabs.delete(senderTabId);
                // When a tab closes, check if we're the last one
                // Use a small delay to allow other tabs to respond
                setTimeout(() => {
                    checkIfLastTab();
                }, 500);
                break;
                
            case 'heartbeat':
                activeTabs.set(senderTabId, Date.now());
                // Mark that we found other tabs
                initialCheckDone = true;
                break;
                
            case 'request-active-tabs':
                // Respond with our presence
                sendMessage('tab-present', { tabId });
                break;
                
            case 'session-cleared':
                // Another tab cleared the session, clear ours too
                clearSession();
                break;
        }
    }

    /**
     * Start sending heartbeat messages
     */
    function startHeartbeat() {
        if (heartbeatInterval) return;
        
        heartbeatInterval = setInterval(() => {
            sendMessage('heartbeat', { tabId });
            
            // Also update localStorage timestamp to mark this tab as active
            try {
                const tabData = {
                    tabId: tabId,
                    timestamp: Date.now(),
                    closing: false
                };
                localStorage.setItem(`tab_${tabId}`, JSON.stringify(tabData));
            } catch (e) {
                // Ignore storage errors
            }
            
            // Clean up stale tabs (no heartbeat for TAB_TIMEOUT)
            const now = Date.now();
            activeTabs.forEach((lastHeartbeat, tabId) => {
                if (now - lastHeartbeat > TAB_TIMEOUT) {
                    activeTabs.delete(tabId);
                }
            });
            
            // Clean up stale localStorage entries
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('tab_')) {
                        try {
                            const tabData = JSON.parse(localStorage.getItem(key) || '{}');
                            if (tabData.timestamp && (now - tabData.timestamp) > TAB_TIMEOUT * 2) {
                                localStorage.removeItem(key);
                            }
                        } catch (e) {
                            // Remove invalid entries
                            localStorage.removeItem(key);
                        }
                    }
                }
            } catch (e) {
                // Ignore storage errors
            }
            
            // Check if we're the last tab after cleanup
            const otherTabsCount = Array.from(activeTabs.keys()).filter(id => id !== tabId).length;
            if (otherTabsCount === 0 && activeTabs.size > 0) {
                // We're the only tab left - double check with localStorage
                checkIfLastTab();
            }
        }, HEARTBEAT_INTERVAL);
    }

    /**
     * Stop heartbeat
     */
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    /**
     * Set up unload handler to detect tab closure
     */
    function setupUnloadHandler() {
        // Use pagehide for better browser support - this fires when tab is actually closing
        window.addEventListener('pagehide', (event) => {
            // event.persisted is false when the page is being unloaded (tab closing)
            // event.persisted is true when the page is being cached (e.g., back/forward navigation)
            if (!event.persisted) {
                // Tab is actually closing, not just navigating
                sendMessage('tab-closing', { tabId });
                
                // Also update localStorage timestamp to mark this tab as closing
                try {
                    const tabData = {
                        tabId: tabId,
                        closing: true,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(`tab_${tabId}`, JSON.stringify(tabData));
                    // Remove after a short delay to allow other tabs to see it
                    setTimeout(() => {
                        localStorage.removeItem(`tab_${tabId}`);
                    }, 100);
                } catch (e) {
                    // Ignore storage errors
                }
            }
        });

        // Use beforeunload as backup (fires earlier than pagehide)
        window.addEventListener('beforeunload', () => {
            sendMessage('tab-closing', { tabId });
        });

        // Use visibilitychange to detect when tab becomes hidden/visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab is hidden, but not closed
                // Don't send tab-closed yet
            } else {
                // Tab is visible again, send presence
                sendMessage('tab-opened', { tabId });
            }
        });

        // Listen for storage events (when other tabs modify localStorage)
        window.addEventListener('storage', (e) => {
            // If another tab cleared the session, clear ours too
            if (e.key && (e.key === 'session_cleared' || e.key.startsWith('tab_'))) {
                if (e.key === 'session_cleared') {
                    clearSession();
                } else if (e.key.startsWith('tab_')) {
                    // Another tab is active, update our tracking
                    try {
                        const tabData = JSON.parse(e.newValue || '{}');
                        if (tabData.tabId && tabData.tabId !== tabId) {
                            activeTabs.set(tabData.tabId, Date.now());
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        });
    }

    /**
     * Check if this is the last active tab
     */
    function checkIfLastTab() {
        // Remove stale tabs first
        const now = Date.now();
        activeTabs.forEach((lastHeartbeat, tabIdToCheck) => {
            if (now - lastHeartbeat > TAB_TIMEOUT) {
                activeTabs.delete(tabIdToCheck);
            }
        });
        
        // Check for other tabs via localStorage (more reliable than BroadcastChannel alone)
        let otherTabsFound = false;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tab_') && key !== `tab_${tabId}`) {
                    try {
                        const tabData = JSON.parse(localStorage.getItem(key) || '{}');
                        // Check if tab data is recent (within last 5 seconds)
                        if (tabData.timestamp && (now - tabData.timestamp) < TAB_TIMEOUT) {
                            if (!tabData.closing) {
                                otherTabsFound = true;
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        } catch (e) {
            // Ignore storage errors
        }
        
        // Count active tabs from BroadcastChannel
        const otherTabs = Array.from(activeTabs.keys()).filter(id => id !== tabId);
        
        // If no other tabs found via either method, clear session
        if (otherTabs.length === 0 && !otherTabsFound) {
            clearSession();
        }
    }

    /**
     * Clear session data
     */
    function clearSession() {
        // Always clear sessionStorage
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem('user');
        
        // Check if "Remember Me" was set - if so, don't clear localStorage
        const rememberMe = localStorage.getItem('remember_me') === 'true';
        
        if (!rememberMe) {
            // Remember Me not set - clear localStorage
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem('dashboard_authenticated');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem('user');
        }
        // If rememberMe is true, keep localStorage intact for persistent login
        
        // Mark session as cleared in localStorage (triggers storage event for other tabs)
        try {
            localStorage.setItem('session_cleared', Date.now().toString());
            // Remove after a short delay
            setTimeout(() => {
                localStorage.removeItem('session_cleared');
            }, 1000);
        } catch (e) {
            // Ignore storage errors
        }
        
        // Notify other tabs (if any) via BroadcastChannel
        sendMessage('session-cleared', { tabId });
        
        // Clean up all tab tracking data
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tab_')) {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            // Ignore storage errors
        }
        
        // Update UI if login.js functions are available
        if (window.checkAuthentication) {
            window.checkAuthentication();
        }
        if (window.updateDashboardNavButton) {
            window.updateDashboardNavButton();
        }
    }

    /**
     * Fallback: Use sessionStorage only (clears when tab closes)
     */
    function useSessionStorageOnly() {
        // Just use sessionStorage - it automatically clears when tab closes
        // This is a simpler fallback for browsers without BroadcastChannel support
        console.log('Using sessionStorage-only mode');
    }

    /**
     * Check if session should be cleared on page load
     */
    function checkSessionOnLoad() {
        // Check if session was already cleared by another tab
        try {
            const sessionCleared = localStorage.getItem('session_cleared');
            if (sessionCleared) {
                // Session was cleared, but check if it was recent (within last 10 seconds)
                const clearedTime = parseInt(sessionCleared, 10);
                if (Date.now() - clearedTime < 10000) {
                    clearSession();
                    return;
                }
            }
        } catch (e) {
            // Ignore storage errors
        }
        
        // If we're using BroadcastChannel, wait for other tabs to respond
        if (broadcastChannel) {
            setTimeout(() => {
                // Check for other tabs via localStorage
                let otherTabsFound = false;
                try {
                    const now = Date.now();
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('tab_') && key !== `tab_${tabId}`) {
                            try {
                                const tabData = JSON.parse(localStorage.getItem(key) || '{}');
                                if (tabData.timestamp && (now - tabData.timestamp) < TAB_TIMEOUT * 2 && !tabData.closing) {
                                    otherTabsFound = true;
                                    break;
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                } catch (e) {
                    // Ignore storage errors
                }
                
                // If no other tabs responded and none found in localStorage, clear session
                if (!initialCheckDone && activeTabs.size === 0 && !otherTabsFound) {
                    // No other tabs found - clear session
                    clearSession();
                }
            }, INITIAL_CHECK_TIMEOUT);
        }
    }

    /**
     * Cleanup function
     */
    function cleanup() {
        stopHeartbeat();
        
        // Remove our tab tracking from localStorage
        try {
            localStorage.removeItem(`tab_${tabId}`);
        } catch (e) {
            // Ignore storage errors
        }
        
        if (broadcastChannel) {
            // Remove ourselves from active tabs
            activeTabs.delete(tabId);
            
            // Notify other tabs that we're closing
            sendMessage('tab-closing', { tabId });
            
            // Wait a moment to see if other tabs respond
            setTimeout(() => {
                // Check if we're the last tab before closing
                const otherTabs = Array.from(activeTabs.keys()).filter(id => id !== tabId);
                let otherTabsFound = false;
                
                // Also check localStorage for other active tabs
                try {
                    const now = Date.now();
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('tab_') && key !== `tab_${tabId}`) {
                            try {
                                const tabData = JSON.parse(localStorage.getItem(key) || '{}');
                                if (tabData.timestamp && (now - tabData.timestamp) < TAB_TIMEOUT && !tabData.closing) {
                                    otherTabsFound = true;
                                    break;
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                } catch (e) {
                    // Ignore storage errors
                }
                
                if (otherTabs.length === 0 && !otherTabsFound) {
                    // We're the last tab - clear session
                    clearSession();
                }
            }, 500);
            
            broadcastChannel.close();
            broadcastChannel = null;
        }
        activeTabs.clear();
        isInitialized = false;
    }

    // Initialize when DOM is ready
    // Only initialize if we're not on the login page (index.html)
    // Sessions should only be managed after successful login
    function shouldInitializeSessionManager() {
        // Don't initialize on login page unless there's a valid session
        const path = window.location.pathname;
        const isLoginPage = path === '/' || path === '/index.html' || path.endsWith('/index.html');
        
        if (isLoginPage) {
            // On login page, only initialize if there's already a valid session
            // This handles the case where user is already logged in and visits the homepage
            const hasSession = sessionStorage.getItem(SESSION_KEY) === 'true' ||
                              sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                              localStorage.getItem(SESSION_KEY) === 'true' ||
                              localStorage.getItem('dashboard_authenticated') === 'true';
            
            if (!hasSession) {
                // No session on login page - don't initialize
                return false;
            }
            
            // Verify user data exists and is valid
            const userStr = sessionStorage.getItem(USER_KEY) || sessionStorage.getItem('user') ||
                           localStorage.getItem(USER_KEY) || localStorage.getItem('user');
            
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user && user.email && typeof user.email === 'string' && user.email.trim() !== '' && user.role === 'admin') {
                        return true; // Valid session exists
                    }
                } catch (e) {
                    // Invalid user data
                }
            }
            
            // Invalid session data on login page - clear it
            clearSession();
            return false;
        }
        
        // Not on login page - check for valid session
        return true;
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (shouldInitializeSessionManager()) {
                init();
                checkSessionOnLoad();
            }
        });
    } else {
        if (shouldInitializeSessionManager()) {
            init();
            checkSessionOnLoad();
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        cleanup();
    });

        // Expose API
    window.SessionManager = {
        init,
        cleanup,
        clearSession,
        isInitialized: () => isInitialized,
        getActiveTabsCount: () => {
            // Exclude self from count
            return Array.from(activeTabs.keys()).filter(id => id !== tabId).length;
        }
    };
})();

