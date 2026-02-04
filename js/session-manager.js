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
    const SESSION_MAX_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours - auto-logout only when session time ends
    const SESSION_START_TIME_KEY = 'session_start_time';
    const SESSION_KEY = 'dashboard_authenticated';
    const USER_KEY = 'user';

    let broadcastChannel = null;
    let heartbeatInterval = null;
    let tabId = null;
    let activeTabs = new Map(); // Map<tabId, lastHeartbeat>
    let isInitialized = false;
    let initialCheckDone = false;

    /**
     * Lightweight UI confirm dialog (uses existing dashboard modal CSS).
     * Returns Promise<boolean>.
     *
     * NOTE: Designed for production/cPanel: no dependencies, no frameworks.
     */
    function uiConfirm(options) {
        const opts = options || {};
        const title = (typeof opts.title === 'string' && opts.title.trim()) ? opts.title.trim() : 'Confirm';
        const message = (typeof opts.message === 'string' && opts.message.trim()) ? opts.message.trim() : 'Are you sure?';
        const confirmText = (typeof opts.confirmText === 'string' && opts.confirmText.trim()) ? opts.confirmText.trim() : 'Confirm';
        const cancelText = (typeof opts.cancelText === 'string' && opts.cancelText.trim()) ? opts.cancelText.trim() : 'Cancel';

        return new Promise((resolve) => {
            const existingModal = document.getElementById('tsConfirmModal');
            const useExisting = existingModal && existingModal.getAttribute('aria-hidden') !== null;

            if (useExisting) {
                const titleEl = document.getElementById('tsConfirmTitle');
                const messageEl = document.getElementById('tsConfirmMessage');
                const okTextEl = document.getElementById('tsConfirmOkText');
                const overlayEl = document.getElementById('tsConfirmModalOverlay');
                const closeBtn = document.getElementById('tsConfirmCloseBtn');
                const cancelBtn = document.getElementById('tsConfirmCancelBtn');
                const okBtn = document.getElementById('tsConfirmOkBtn');
                if (titleEl) titleEl.textContent = title;
                if (messageEl) messageEl.textContent = message;
                if (okTextEl) okTextEl.textContent = confirmText;

                function done(value) {
                    try { document.removeEventListener('keydown', onKeyDown, true); } catch (e) { /* ignore */ }
                    try { existingModal.classList.remove('active'); existingModal.setAttribute('aria-hidden', 'true'); } catch (e) { /* ignore */ }
                    try { document.body.style.overflow = ''; } catch (e) { /* ignore */ }
                    resolve(value === true);
                }

                function onKeyDown(e) {
                    if (!e) return;
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        done(false);
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        done(true);
                    }
                }

                if (overlayEl) overlayEl.addEventListener('click', function() { done(false); });
                if (closeBtn) closeBtn.addEventListener('click', function() { done(false); });
                if (cancelBtn) cancelBtn.addEventListener('click', function() { done(false); });
                if (okBtn) okBtn.addEventListener('click', function() { done(true); });
                document.addEventListener('keydown', onKeyDown, true);

                try { document.body.style.overflow = 'hidden'; } catch (e) { /* ignore */ }
                existingModal.classList.add('active');
                existingModal.removeAttribute('aria-hidden');
                setTimeout(function() {
                    try { if (cancelBtn) cancelBtn.focus(); } catch (e) { /* ignore */ }
                }, 0);
                return;
            }

            try {
                const existing = document.getElementById('tsConfirmModal');
                if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            } catch (e) { /* ignore */ }

            const modal = document.createElement('div');
            modal.className = 'dashboard-modal';
            modal.id = 'tsConfirmModal';

            const overlay = document.createElement('div');
            overlay.className = 'dashboard-modal-overlay';
            overlay.id = 'tsConfirmModalOverlay';

            const content = document.createElement('div');
            content.className = 'dashboard-modal-content dashboard-modal-small';

            const header = document.createElement('div');
            header.className = 'dashboard-modal-header';
            header.innerHTML = `
                <h2 style="display:flex;align-items:center;gap:.5rem;">
                    <i class="fas fa-question-circle" style="color: var(--primary-color);"></i>
                    <span>${title}</span>
                </h2>
                <button class="dashboard-modal-close" type="button" id="tsConfirmCloseBtn" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            `;

            const body = document.createElement('div');
            body.className = 'dashboard-modal-body';
            body.innerHTML = `<p id="tsConfirmMessage" style="margin:0;">${message}</p>`;

            const actions = document.createElement('div');
            actions.className = 'dashboard-modal-actions';
            actions.innerHTML = `
                <button type="button" class="dashboard-btn-secondary" id="tsConfirmCancelBtn">${cancelText}</button>
                <button type="button" class="dashboard-btn-danger" id="tsConfirmOkBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    ${confirmText}
                </button>
            `;

            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(actions);
            modal.appendChild(overlay);
            modal.appendChild(content);

            function cleanupAndResolve(value) {
                try {
                    document.removeEventListener('keydown', onKeyDown, true);
                } catch (e) { /* ignore */ }
                try {
                    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
                } catch (e) { /* ignore */ }
                resolve(value === true);
            }

            function onKeyDown(e) {
                if (!e) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cleanupAndResolve(false);
                }
                if (e.key === 'Enter') {
                    // Only treat Enter as confirm when modal is visible
                    e.preventDefault();
                    cleanupAndResolve(true);
                }
            }

            // Wire up events
            overlay.addEventListener('click', () => cleanupAndResolve(false));
            content.addEventListener('click', (e) => e.stopPropagation());
            header.querySelector('#tsConfirmCloseBtn').addEventListener('click', () => cleanupAndResolve(false));
            actions.querySelector('#tsConfirmCancelBtn').addEventListener('click', () => cleanupAndResolve(false));
            actions.querySelector('#tsConfirmOkBtn').addEventListener('click', () => cleanupAndResolve(true));
            document.addEventListener('keydown', onKeyDown, true);

            // Add to DOM and show
            (document.body || document.documentElement).appendChild(modal);
            // Trigger layout then activate (ensures CSS animation works)
            setTimeout(() => {
                try { modal.classList.add('active'); } catch (e) { /* ignore */ }
                try { actions.querySelector('#tsConfirmCancelBtn').focus(); } catch (e) { /* ignore */ }
            }, 0);
        });
    }

    /**
     * Lightweight UI alert dialog (single OK button, same styling as confirm).
     * Returns Promise<void> (resolves when user closes).
     *
     * NOTE: Designed for production/cPanel: no dependencies, no frameworks.
     */
    function uiAlert(options) {
        const opts = options || {};
        const title = (typeof opts.title === 'string' && opts.title.trim()) ? opts.title.trim() : 'Notice';
        const message = (typeof opts.message === 'string') ? opts.message : '';

        return new Promise((resolve) => {
            const existingModal = document.getElementById('tsAlertModal');
            const useExisting = existingModal && existingModal.getAttribute('aria-hidden') !== null;

            if (useExisting) {
                const titleEl = document.getElementById('tsAlertTitle');
                const messageEl = document.getElementById('tsAlertMessage');
                const overlayEl = document.getElementById('tsAlertModalOverlay');
                const closeBtn = document.getElementById('tsAlertCloseBtn');
                const okBtn = document.getElementById('tsAlertOkBtn');
                if (titleEl) titleEl.textContent = title;
                if (messageEl) messageEl.textContent = message;

                function done() {
                    try { document.removeEventListener('keydown', onKeyDown, true); } catch (e) { /* ignore */ }
                    try { existingModal.classList.remove('active'); existingModal.setAttribute('aria-hidden', 'true'); } catch (e) { /* ignore */ }
                    try { document.body.style.overflow = ''; } catch (e) { /* ignore */ }
                    resolve();
                }

                function onKeyDown(e) {
                    if (!e) return;
                    if (e.key === 'Escape' || e.key === 'Enter') {
                        e.preventDefault();
                        done();
                    }
                }

                if (overlayEl) overlayEl.addEventListener('click', done);
                if (closeBtn) closeBtn.addEventListener('click', done);
                if (okBtn) okBtn.addEventListener('click', done);
                document.addEventListener('keydown', onKeyDown, true);

                try { document.body.style.overflow = 'hidden'; } catch (e) { /* ignore */ }
                existingModal.classList.add('active');
                existingModal.removeAttribute('aria-hidden');
                setTimeout(function() {
                    try { if (okBtn) okBtn.focus(); } catch (e) { /* ignore */ }
                }, 0);
                return;
            }

            try {
                const existing = document.getElementById('tsAlertModal');
                if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            } catch (e) { /* ignore */ }

            const modal = document.createElement('div');
            modal.className = 'dashboard-modal';
            modal.id = 'tsAlertModal';

            const overlay = document.createElement('div');
            overlay.className = 'dashboard-modal-overlay';
            overlay.id = 'tsAlertModalOverlay';

            const content = document.createElement('div');
            content.className = 'dashboard-modal-content dashboard-modal-small';

            const header = document.createElement('div');
            header.className = 'dashboard-modal-header';
            header.innerHTML = `
                <h2 style="display:flex;align-items:center;gap:.5rem;">
                    <i class="fas fa-info-circle" style="color: var(--primary-color);"></i>
                    <span>${title}</span>
                </h2>
                <button class="dashboard-modal-close" type="button" id="tsAlertCloseBtn" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            `;

            const body = document.createElement('div');
            body.className = 'dashboard-modal-body';
            const msgEl = document.createElement('p');
            msgEl.id = 'tsAlertMessage';
            msgEl.style.margin = '0';
            msgEl.textContent = message;
            body.appendChild(msgEl);

            const actions = document.createElement('div');
            actions.className = 'dashboard-modal-actions';
            actions.innerHTML = `
                <button type="button" class="dashboard-btn-primary" id="tsAlertOkBtn">
                    <i class="fas fa-check"></i>
                    OK
                </button>
            `;

            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(actions);
            modal.appendChild(overlay);
            modal.appendChild(content);

            function cleanupAndResolve() {
                try {
                    document.removeEventListener('keydown', onKeyDown, true);
                } catch (e) { /* ignore */ }
                try {
                    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
                } catch (e) { /* ignore */ }
                try { document.body.style.overflow = ''; } catch (e) { /* ignore */ }
                resolve();
            }

            function onKeyDown(e) {
                if (!e) return;
                if (e.key === 'Escape' || e.key === 'Enter') {
                    e.preventDefault();
                    cleanupAndResolve();
                }
            }

            overlay.addEventListener('click', cleanupAndResolve);
            content.addEventListener('click', (e) => e.stopPropagation());
            header.querySelector('#tsAlertCloseBtn').addEventListener('click', cleanupAndResolve);
            actions.querySelector('#tsAlertOkBtn').addEventListener('click', cleanupAndResolve);
            document.addEventListener('keydown', onKeyDown, true);

            (document.body || document.documentElement).appendChild(modal);
            try { document.body.style.overflow = 'hidden'; } catch (e) { /* ignore */ }
            setTimeout(() => {
                try { modal.classList.add('active'); } catch (e) { /* ignore */ }
                try { actions.querySelector('#tsAlertOkBtn').focus(); } catch (e) { /* ignore */ }
            }, 0);
        });
    }

    /**
     * Initialize the session manager
     * CRITICAL: Only initializes after successful login - never before
     */
    function init() {
        if (isInitialized) return;
        
        // STRICT CHECK: Only initialize if there's a valid active session with user data
        // This prevents any session tracking before login
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
                // STRICT VALIDATION: Must have email (non-empty string) AND admin role
                if (user && 
                    user.email && 
                    typeof user.email === 'string' && 
                    user.email.trim() !== '' && 
                    user.role === 'admin') {
                    hasValidUser = true;
                } else {
                    // Invalid user data - don't initialize
                    hasValidUser = false;
                }
            } catch (e) {
                // Invalid JSON, treat as no valid user
                hasValidUser = false;
            }
        }
        
        // CRITICAL: Only initialize if there's BOTH a session flag AND valid user data
        // If either is missing, do NOT initialize and do NOT create any tracking data
        if (!hasSession || !hasValidUser) {
            // No valid session - end server session if we had invalid data, then don't initialize
            if (hasSession && !hasValidUser) {
                // Use clearSession so backend logout is called (ends server session properly)
                clearSession();
            }
            return;
        }
        
        // Set session start time if not already set (e.g. existing session before this feature)
        try {
            const existingStart = localStorage.getItem(SESSION_START_TIME_KEY) || sessionStorage.getItem(SESSION_START_TIME_KEY);
            if (!existingStart) {
                const now = Date.now().toString();
                localStorage.setItem(SESSION_START_TIME_KEY, now);
                sessionStorage.setItem(SESSION_START_TIME_KEY, now);
            }
        } catch (e) { /* ignore */ }
        
        // DEBUG: Log successful initialization
        console.log('[SessionManager] Initializing session manager', {
            tabId: tabId || 'generating...',
            hasSession,
            hasValidUser
        });
        
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
                // But only if initial check is done to prevent premature clearing during startup
                if (initialCheckDone && isInitialized) {
                    clearSession();
                }
                break;
        }
    }

    /**
     * Start sending heartbeat messages
     * Only runs if session manager is initialized (user is logged in)
     */
    function startHeartbeat() {
        if (heartbeatInterval) return;
        // Only start heartbeat if session manager is initialized
        if (!isInitialized) return;
        
        heartbeatInterval = setInterval(() => {
            // Double-check session manager is still initialized before sending heartbeat
            if (!isInitialized) {
                stopHeartbeat();
                return;
            }
            
            // Session time ended: auto-logout when max duration exceeded (production/cPanel)
            try {
                const startStr = localStorage.getItem(SESSION_START_TIME_KEY) || sessionStorage.getItem(SESSION_START_TIME_KEY);
                if (startStr) {
                    const startTime = parseInt(startStr, 10);
                    if (!isNaN(startTime) && (Date.now() - startTime) > SESSION_MAX_DURATION_MS) {
                        stopHeartbeat();
                        clearSession();
                        window.location.replace('/index.html');
                        return;
                    }
                }
            } catch (e) { /* ignore */ }
            
            sendMessage('heartbeat', { tabId });
            
            // Also update localStorage timestamp to mark this tab as active
            // Only if session manager is initialized
            if (isInitialized && tabId) {
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
            
            // Tab cleanup only (no session clear - session ends only on manual logout or 4h)
            if (initialCheckDone) {
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
     * Only sets up handlers if session manager is initialized (meaning user is logged in)
     */
    function setupUnloadHandler() {
        // Only set up handlers if session manager is initialized
        if (!isInitialized) return;
        
        // Use pagehide for better browser support - this fires when tab is actually closing
        window.addEventListener('pagehide', (event) => {
            // Only process if session manager is still initialized
            if (!isInitialized) return;
            
            // CRITICAL FIX: Check if this is a page reload (not a tab closure)
            // Check both storages for reliability
            let isPageReload = false;
            try {
                isPageReload = sessionStorage.getItem('_page_reload') === 'true' ||
                              localStorage.getItem('_page_reload') === 'true';
            } catch (e) {
                // Ignore storage errors
            }
            
            // event.persisted is false when the page is being unloaded (tab closing/refresh)
            // cleanup() on beforeunload saves _session_restore and clears when last tab
            if (!event.persisted && !isPageReload) {
                // Tab is actually closing, not just navigating or reloading
                sendMessage('tab-closing', { tabId });
                
                // Also update localStorage timestamp to mark this tab as closing
                // Only if session manager is initialized
                if (isInitialized && tabId) {
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
            }
        });

        // Use beforeunload as backup (fires earlier than pagehide)
        // CRITICAL FIX: Don't treat page reloads as tab closures
        // Regular refreshes (F5, Ctrl+R) also fire beforeunload, so we need to be careful
        window.addEventListener('beforeunload', () => {
            // Only process if session manager is initialized
            if (isInitialized && tabId) {
                // Only skip if explicit reload flag is set
                let isPageReload = false;
                try {
                    isPageReload = sessionStorage.getItem('_page_reload') === 'true' ||
                                  localStorage.getItem('_page_reload') === 'true';
                } catch (e) {
                    // Ignore storage errors
                }
                if (isPageReload) {
                    return;
                }
                
                // Mark tab as closing (cleanup() will save _session_restore and clear when last tab)
                try {
                    const tabData = {
                        tabId: tabId,
                        closing: true,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(`tab_${tabId}`, JSON.stringify(tabData));
                } catch (e) {
                    // Ignore storage errors
                }
                
                sendMessage('tab-closing', { tabId });
                
                // Don't immediately check if we're the last tab - let the cleanup function handle it
                // This prevents premature session clearing during refreshes
            }
        });

        // Use visibilitychange to detect when tab becomes hidden/visible
        document.addEventListener('visibilitychange', () => {
            // Only process if session manager is initialized
            if (!isInitialized) return;
            
            if (document.hidden) {
                // Tab is hidden, but not closed
                // Don't send tab-closed yet
            } else {
                // Tab is visible again, send presence
                if (isInitialized && tabId) {
                    sendMessage('tab-opened', { tabId });
                }
            }
        });

        // Listen for storage events (when other tabs modify localStorage)
        window.addEventListener('storage', (e) => {
            // Only process storage events if session manager is initialized
            if (!isInitialized) return;
            
            // If another tab cleared the session, clear ours too
            if (e.key && (e.key === 'session_cleared' || e.key.startsWith('tab_'))) {
                if (e.key === 'session_cleared') {
                    // Only clear if session manager is initialized and initial check is done
                    // This prevents premature clearing during initialization
                    if (isInitialized && initialCheckDone) {
                        clearSession();
                    }
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
     * Check if this is the last active tab (for tab tracking only).
     * Session is NOT cleared here: user stays logged in until manual logout or 4h timeout.
     * This avoids logging out app@tirumakudaluproperties.com (or any user) as soon as they login.
     */
    function checkIfLastTab() {
        if (!isInitialized) return;
        if (!initialCheckDone) return;
        // Remove stale tabs from our map only
        const now = Date.now();
        activeTabs.forEach((lastHeartbeat, tabIdToCheck) => {
            if (now - lastHeartbeat > TAB_TIMEOUT) {
                activeTabs.delete(tabIdToCheck);
            }
        });
        // Do NOT clear session when we're the only tab - session ends only on manual logout or 4h expiry
    }

    /**
     * Clear session data and end session properly.
     * CRITICAL: Always clears session when all tabs close, regardless of "Remember Me"
     * "Remember Me" only preserves saved email/password for autofill, not the active session
     * Also calls backend logout endpoint to clear server-side session (unless skipBackendLogout).
     * @param {Object} [options] - Optional: { skipBackendLogout: true } when caller already called logout API
     */
    function clearSession(options) {
        const skipBackendLogout = options && options.skipBackendLogout === true;

        // End session properly: stop heartbeat, notify other tabs, then close channel
        stopHeartbeat();
        if (broadcastChannel && tabId) {
            sendMessage('session-cleared', { tabId });
            try {
                broadcastChannel.removeEventListener('message', handleMessage);
                broadcastChannel.close();
            } catch (e) {
                // Ignore if already closed
            }
            broadcastChannel = null;
        }
        tabId = null;
        activeTabs.clear();
        initialCheckDone = false;
        isInitialized = false;

        // Get user email before clearing session (for backend logout)
        let userEmail = null;
        try {
            const userStr = sessionStorage.getItem(USER_KEY) || sessionStorage.getItem('user') ||
                           localStorage.getItem(USER_KEY) || localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                userEmail = user.email || null;
            }
        } catch (e) {
            // Ignore parse errors
        }

        // Call backend logout endpoint to clear server-side session (unless caller already did)
        if (!skipBackendLogout && userEmail) {
            try {
                const logoutData = JSON.stringify({ email: userEmail });
                fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: logoutData,
                    keepalive: true // Critical: keeps request alive even during page unload
                }).catch(error => {
                    console.warn('Logout API call failed during tab close (this is normal if page is unloading):', error);
                });
            } catch (error) {
                console.warn('Error calling logout endpoint:', error);
            }
        }

        // Always clear sessionStorage
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem(SESSION_START_TIME_KEY);
        
        // CRITICAL FIX: Always clear session from localStorage when all tabs close
        // "Remember Me" only saves email/password for autofill, NOT the active session
        // The session must be cleared when all tabs close for security
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('dashboard_authenticated');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('user');
        localStorage.removeItem(SESSION_START_TIME_KEY);
        
        // Note: We keep 'remember_me', 'saved_email', and 'saved_password' in localStorage
        // if "Remember Me" was checked, so the user can easily log back in with autofill
        // But the actual session/authentication is cleared
        
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
     * Only called when there's a valid session
     */
    function checkSessionOnLoad() {
        // Only proceed if session manager is initialized (meaning there's a valid session)
        if (!isInitialized || !broadcastChannel) {
            return;
        }
        
        // Check if session was already cleared by another tab
        // CRITICAL FIX: Don't check for session_cleared on initial load
        // This prevents stale session_cleared flags from clearing new sessions
        // Only check for session_cleared after we've initialized and confirmed we're not the only tab
        // We'll check this later, after initial check completes
        // (Removed premature session_cleared check to prevent false positives)
        
        // CRITICAL FIX: Don't clear session just because we're the only tab
        // The session should only be cleared when ALL tabs are closed, not when we're the first/only tab
        // We'll mark that we've done the initial check, but we won't clear the session
        // The session will only be cleared when tabs actually close (via cleanup/checkIfLastTab)
        
        // Wait a bit to see if other tabs respond, but don't clear session if none found
        // This allows the session to persist even if we're the only tab
        setTimeout(() => {
            // Mark that initial check is done
            initialCheckDone = true;
            
            // Check for other tabs via localStorage (for tracking purposes only)
            try {
                const now = Date.now();
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('tab_') && key !== `tab_${tabId}`) {
                        try {
                            const tabData = JSON.parse(localStorage.getItem(key) || '{}');
                            if (tabData.timestamp && (now - tabData.timestamp) < TAB_TIMEOUT * 2 && !tabData.closing) {
                                // Found other active tabs - mark that we found them
                                initialCheckDone = true;
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
            
            // DO NOT clear session here - even if we're the only tab
            // Session should only be cleared when tabs actually close, not on initial load
        }, INITIAL_CHECK_TIMEOUT);
    }

    /**
     * Cleanup function - called when tab is closing or refreshing
     * CRITICAL: Do NOT clear session on beforeunload. We cannot reliably tell refresh from tab-close,
     * and clearing on refresh was logging users out. Session now ends only on explicit logout or 4h expiry.
     */
    const SESSION_RESTORE_KEY = '_session_restore';
    const SESSION_RESTORE_TTL_MS = 5000; // Restore only if saved within last 5 seconds (refresh fallback)

    function cleanup() {
        // Only cleanup if session manager was initialized
        if (!isInitialized) return;
        
        // Save session for possible restore on refresh (fallback - we no longer clear on unload)
        let hasSessionData = false;
        try {
            hasSessionData = localStorage.getItem('dashboard_authenticated') === 'true' ||
                            localStorage.getItem('user') !== null;
            if (hasSessionData) {
                const restore = {
                    user: localStorage.getItem('user'),
                    dashboard_authenticated: localStorage.getItem('dashboard_authenticated'),
                    session_start_time: localStorage.getItem(SESSION_START_TIME_KEY),
                    saved_at: Date.now()
                };
                const restoreStr = JSON.stringify(restore);
                sessionStorage.setItem(SESSION_RESTORE_KEY, restoreStr);
                localStorage.setItem(SESSION_RESTORE_KEY, restoreStr);
            }
        } catch (e) {
            // Ignore storage errors
        }
        
        stopHeartbeat();
        
        // Mark this tab as closing in localStorage (for other tabs' tracking only)
        if (tabId) {
            try {
                const tabData = {
                    tabId: tabId,
                    closing: true,
                    timestamp: Date.now()
                };
                localStorage.setItem(`tab_${tabId}`, JSON.stringify(tabData));
            } catch (e) {
                // Ignore storage errors
            }
        }
        
        if (broadcastChannel) {
            activeTabs.delete(tabId);
            sendMessage('tab-closing', { tabId });
            setTimeout(() => {
                if (broadcastChannel) {
                    broadcastChannel.close();
                    broadcastChannel = null;
                }
            }, 500);
        }
        
        if (tabId) {
            try {
                localStorage.removeItem(`tab_${tabId}`);
            } catch (e) {
                // Ignore storage errors
            }
        }
        
        activeTabs.clear();
        isInitialized = false;
        
        // Do NOT clear session here. We cannot tell refresh from tab-close in beforeunload.
        // Session ends only on: explicit logout, or 4-hour expiry (heartbeat check).
    }

    // Initialize when DOM is ready
    // Only initialize if we're not on the login page (index.html)
    // Sessions should only be managed after successful login
    function shouldInitializeSessionManager() {
        // Don't initialize on login page unless there's a valid session
        const path = window.location.pathname;
        const isLoginPage = path === '/' || path === '/index.html' || path.endsWith('/index.html');
        
        // First check if there's a valid session with user data
        const hasSession = sessionStorage.getItem(SESSION_KEY) === 'true' ||
                          sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                          localStorage.getItem(SESSION_KEY) === 'true' ||
                          localStorage.getItem('dashboard_authenticated') === 'true';
        
        // Verify user data exists and is valid
        const userStr = sessionStorage.getItem(USER_KEY) || sessionStorage.getItem('user') ||
                       localStorage.getItem(USER_KEY) || localStorage.getItem('user');
        
        let hasValidUser = false;
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.email && typeof user.email === 'string' && user.email.trim() !== '' && user.role === 'admin') {
                    hasValidUser = true;
                }
            } catch (e) {
                // Invalid user data
            }
        }
        
        // Only proceed if there's both a session flag AND valid user data
        if (!hasSession || !hasValidUser) {
            // No valid session - clear any invalid data and don't initialize
            if (hasSession && !hasValidUser) {
                clearSession();
            }
            return false;
        }
        
        if (isLoginPage) {
            // On login page with valid session - allow initialization
            // This handles the case where user is already logged in and visits the homepage
            return true;
        }
        
        // Not on login page - valid session exists, allow initialization
        return true;
    }
    
    // Only initialize and set up handlers if there's a valid session
    function setupSessionManager() {
        // CRITICAL FIX: Clear any reload flag from previous page load
        // This ensures the flag doesn't persist incorrectly
        // Clear from both storages
        try {
            sessionStorage.removeItem('_page_reload');
            localStorage.removeItem('_page_reload');
        } catch (e) {
            // Ignore storage errors
        }
        
        if (!shouldInitializeSessionManager()) {
            // No valid session - don't initialize anything
            return;
        }
        
        // Valid session exists - initialize
        init();
        checkSessionOnLoad();
        
        // Only attach cleanup handler if session manager is initialized
        // This prevents cleanup from running when there's no session
        window.addEventListener('beforeunload', () => {
            if (isInitialized) {
                cleanup();
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSessionManager);
    } else {
        setupSessionManager();
    }

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

    // Expose UI modals globally (used by dashboards for alerts and confirmations)
    window.TSPropertiesUI = window.TSPropertiesUI || {};
    window.TSPropertiesUI.confirm = uiConfirm;
    window.TSPropertiesUI.alert = uiAlert;
})();

