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
        
        // Only initialize if there's an active session
        const hasSession = sessionStorage.getItem(SESSION_KEY) === 'true' ||
                          sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                          localStorage.getItem(SESSION_KEY) === 'true' ||
                          localStorage.getItem('dashboard_authenticated') === 'true';
        
        if (!hasSession) {
            // No active session, don't initialize
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
                activeTabs.delete(senderTabId);
                checkIfLastTab();
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
            
            // Clean up stale tabs (no heartbeat for TAB_TIMEOUT)
            const now = Date.now();
            activeTabs.forEach((lastHeartbeat, tabId) => {
                if (now - lastHeartbeat > TAB_TIMEOUT) {
                    activeTabs.delete(tabId);
                }
            });
            
            // Check if we're the last tab after cleanup
            const otherTabsCount = Array.from(activeTabs.keys()).filter(id => id !== tabId).length;
            if (otherTabsCount === 0 && activeTabs.size > 0) {
                // We're the only tab left
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
        // Use beforeunload to send message before tab closes
        window.addEventListener('beforeunload', () => {
            sendMessage('tab-closed', { tabId });
            
            // Small delay to ensure message is sent
            // Note: This is not guaranteed to work in all browsers
            // But it's the best we can do
        });

        // Also use pagehide for better browser support
        window.addEventListener('pagehide', () => {
            sendMessage('tab-closed', { tabId });
        });

        // Use visibilitychange to detect when tab becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab is hidden, but not closed
                // Don't send tab-closed yet
            } else {
                // Tab is visible again, send presence
                sendMessage('tab-opened', { tabId });
            }
        });
    }

    /**
     * Check if this is the last active tab
     */
    function checkIfLastTab() {
        // Wait a bit to see if other tabs respond
        setTimeout(() => {
            // Remove stale tabs
            const now = Date.now();
            activeTabs.forEach((lastHeartbeat, tabIdToCheck) => {
                if (now - lastHeartbeat > TAB_TIMEOUT) {
                    activeTabs.delete(tabIdToCheck);
                }
            });
            
            // If no other tabs are active (or we're the only one), clear session
            const otherTabs = Array.from(activeTabs.keys()).filter(id => id !== tabId);
            if (otherTabs.length === 0) {
                clearSession();
            }
        }, 1000); // 1 second delay to allow other tabs to respond
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
        
        // Notify other tabs (if any)
        sendMessage('session-cleared', { tabId });
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
        // If we're using BroadcastChannel, wait for other tabs to respond
        if (broadcastChannel) {
            setTimeout(() => {
                // If no other tabs responded, it means all tabs were closed
                // Clear the session since we're the first tab after all were closed
                if (!initialCheckDone && activeTabs.size === 0) {
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
        if (broadcastChannel) {
            // Remove ourselves from active tabs
            activeTabs.delete(tabId);
            
            // Check if we're the last tab before closing
            const otherTabs = Array.from(activeTabs.keys()).filter(id => id !== tabId);
            if (otherTabs.length === 0) {
                // We're the last tab - clear session
                clearSession();
            } else {
                // Notify other tabs that we're closing
                sendMessage('tab-closed', { tabId });
            }
            
            broadcastChannel.close();
            broadcastChannel = null;
        }
        activeTabs.clear();
        isInitialized = false;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            checkSessionOnLoad();
        });
    } else {
        init();
        checkSessionOnLoad();
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

