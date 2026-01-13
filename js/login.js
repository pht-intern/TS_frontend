// Login Modal Functionality
(function() {
    // Get button reference - will be updated when button is replaced
    let loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const loginModalClose = document.getElementById('loginModalClose');
    const loginModalOverlay = document.getElementById('loginModalOverlay');
    const loginForm = document.getElementById('loginForm');
    const passwordToggle = document.getElementById('passwordToggle');
    const loginPassword = document.getElementById('loginPassword');
    
    // Helper function to get current login button reference
    function getLoginBtn() {
        loginBtn = document.getElementById('loginBtn');
        return loginBtn;
    }

    // Update dashboard navigation button visibility
    // NOTE: This function only READS from storage - it does NOT create sessions
    function updateDashboardNavButton() {
        const dashboardNavItem = document.getElementById('navDashboardItem');
        if (!dashboardNavItem) return;
        
        // Only read from storage - never write during this check
        const isAuthenticated = localStorage.getItem('dashboard_authenticated') === 'true' ||
                               sessionStorage.getItem('dashboard_authenticated') === 'true';
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        // Validate user data exists and is valid JSON with required fields
        let hasValidUser = false;
        
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                // Ensure user has required fields (email is mandatory) and has admin role
                if (user && 
                    user.email && 
                    typeof user.email === 'string' && 
                    user.email.trim() !== '' && 
                    user.role === 'admin') {
                    hasValidUser = true;
                }
            } catch (e) {
                // Invalid JSON, treat as not authenticated
                hasValidUser = false;
            }
        }
        
        // Only show dashboard button if both auth flag AND valid user exist
        if (isAuthenticated && hasValidUser) {
            // Show dashboard button in nav
            dashboardNavItem.style.display = '';
        } else {
            // Hide dashboard button in nav
            dashboardNavItem.style.display = 'none';
        }
    }

    // Track current button state to prevent duplicate event listeners
    let currentButtonState = null; // 'login' or 'dashboard'
    
    // Check if user is authenticated and update button accordingly
    // NOTE: This function only READS from storage - it does NOT create sessions or track events
    // Sessions are only created after successful login via the login form
    function checkAuthentication() {
        const currentBtn = getLoginBtn();
        if (!currentBtn) return;
        
        // Only read from storage - never write during this check
        // This is a passive check that does not create any sessions
        const isAuthenticated = localStorage.getItem('dashboard_authenticated') === 'true' ||
                               sessionStorage.getItem('dashboard_authenticated') === 'true';
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        // Validate user data exists and is valid JSON with required fields
        let user = null;
        let hasValidUser = false;
        
        if (userStr) {
            try {
                user = JSON.parse(userStr);
                // Ensure user has required fields (email is mandatory) and has admin role
                if (user && 
                    user.email && 
                    typeof user.email === 'string' && 
                    user.email.trim() !== '' && 
                    user.role === 'admin') {
                    hasValidUser = true;
                } else {
                    // Invalid user data - clear it
                    user = null;
                    hasValidUser = false;
                    // Clear invalid session data
                    sessionStorage.removeItem('dashboard_authenticated');
                    sessionStorage.removeItem('user');
                    localStorage.removeItem('dashboard_authenticated');
                    localStorage.removeItem('user');
                }
            } catch (e) {
                // Invalid JSON, treat as not authenticated
                user = null;
                hasValidUser = false;
                // Clear invalid session data
                sessionStorage.removeItem('dashboard_authenticated');
                sessionStorage.removeItem('user');
                localStorage.removeItem('dashboard_authenticated');
                localStorage.removeItem('user');
            }
        }
        
        // Determine desired button state - require both auth flag AND valid user
        // STRICT: Only show dashboard if BOTH authentication flag AND valid user exist
        const desiredState = (isAuthenticated && hasValidUser && user) ? 'dashboard' : 'login';
        
        // Only update if state has changed
        if (currentButtonState === desiredState) {
            return; // Already in correct state, no need to update
        }
        
        currentButtonState = desiredState;
        
        // STRICT CHECK: Only show dashboard button if authenticated AND has valid user
        if (isAuthenticated && hasValidUser && user) {
            // User is logged in - change button from LOGIN to DASHBOARD
            const icon = currentBtn.querySelector('i');
            const span = currentBtn.querySelector('span');
            
            // Change icon from user icon to dashboard icon
            if (icon) {
                icon.className = 'fas fa-tachometer-alt';
            }
            
            // Change text from LOGIN to DASHBOARD
            if (span) {
                span.textContent = 'DASHBOARD';
            }
            
            // Remove any existing event listeners by cloning and replacing the button
            const newLoginBtn = currentBtn.cloneNode(true);
            currentBtn.parentNode.replaceChild(newLoginBtn, currentBtn);
            
            // Update reference to the new button
            loginBtn = getLoginBtn();
            
            // Add click handler to navigate to dashboard
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // No tracking or session creation on button click - just navigation
                window.location.href = '/dashboard.html';
            });
            
            // Show dashboard nav button
            updateDashboardNavButton();
        } else {
            // User is not logged in - keep button as LOGIN
            // Reset icon and text to default LOGIN state
            const icon = currentBtn.querySelector('i');
            const span = currentBtn.querySelector('span');
            
            // Reset icon to user icon
            if (icon) {
                icon.className = 'fas fa-user';
            }
            
            // Reset text to LOGIN
            if (span) {
                span.textContent = 'LOGIN';
            }
            
            // Remove any existing event listeners by cloning and replacing the button
            const newLoginBtn = currentBtn.cloneNode(true);
            currentBtn.parentNode.replaceChild(newLoginBtn, currentBtn);
            
            // Update reference to the new button
            loginBtn = getLoginBtn();
            
            // Add click handler to open login modal
            // No tracking or session creation on button click
            loginBtn.addEventListener('click', () => {
                if (loginModal) {
                    loginModal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    // Initialize Remember Me checkbox when modal opens
                    initializeRememberMe();
                }
            });
            
            // Hide dashboard nav button
            updateDashboardNavButton();
        }
    }

    // Clear any invalid session data on page load before checking authentication
    // This ensures sessions are only created after successful login
    function clearInvalidSessionData() {
        // Check if there's session data but no valid user
        const hasSessionFlag = sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                              localStorage.getItem('dashboard_authenticated') === 'true';
        
        if (hasSessionFlag) {
            const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
            let hasValidUser = false;
            
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user && user.email && typeof user.email === 'string' && user.email.trim() !== '' && user.role === 'admin') {
                        hasValidUser = true;
                    }
                } catch (e) {
                    // Invalid JSON
                }
            }
            
            // If there's a session flag but no valid user, clear it
            if (!hasValidUser) {
                sessionStorage.removeItem('dashboard_authenticated');
                sessionStorage.removeItem('isAuthenticated');
                sessionStorage.removeItem('user');
                localStorage.removeItem('dashboard_authenticated');
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('user');
            }
        }
        
        // ALWAYS hide dashboard button initially - it will be shown only if valid session exists
        const dashboardNavItem = document.getElementById('navDashboardItem');
        if (dashboardNavItem) {
            dashboardNavItem.style.display = 'none';
        }
    }
    
    // Check authentication on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            clearInvalidSessionData();
            checkAuthentication();
            updateDashboardNavButton();
        });
    } else {
        clearInvalidSessionData();
        checkAuthentication();
        updateDashboardNavButton();
    }
    
    // Expose functions globally so they can be called from other scripts (e.g., on logout)
    window.updateDashboardNavButton = updateDashboardNavButton;
    window.checkAuthentication = checkAuthentication;

    // Close modal
    function closeModal() {
        if (loginModal) {
            loginModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Initialize Remember Me checkbox state when modal opens
    function initializeRememberMe() {
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (!rememberMeCheckbox) return;
        
        // Check if user previously selected "Remember Me"
        const rememberMe = localStorage.getItem('remember_me') === 'true';
        rememberMeCheckbox.checked = rememberMe;
        
        // If Remember Me was previously set, autofill email and password
        if (rememberMe) {
            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            
            // Autofill email from saved credentials
            const savedEmail = localStorage.getItem('saved_email');
            if (emailInput && savedEmail) {
                emailInput.value = savedEmail;
            }
            
            // Autofill password from saved credentials
            const savedPassword = localStorage.getItem('saved_password');
            if (passwordInput && savedPassword) {
                passwordInput.value = savedPassword;
            }
        } else {
            // Clear any saved credentials if remember me is not checked
            localStorage.removeItem('saved_email');
            localStorage.removeItem('saved_password');
        }
    }

    // Watch for modal opening via MutationObserver or event
    if (loginModal) {
        // Use MutationObserver to detect when modal becomes active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (loginModal.classList.contains('active')) {
                        initializeRememberMe();
                    }
                }
            });
        });
        
        observer.observe(loginModal, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Handle Remember Me checkbox change to clear credentials if unchecked
    // Use event delegation to handle checkbox changes
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'rememberMe') {
            if (!e.target.checked) {
                // Clear saved credentials when unchecked
                localStorage.removeItem('saved_email');
                localStorage.removeItem('saved_password');
                localStorage.removeItem('remember_me');
            }
        }
    });

    if (loginModalClose) {
        loginModalClose.addEventListener('click', closeModal);
    }

    if (loginModalOverlay) {
        loginModalOverlay.addEventListener('click', closeModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loginModal && loginModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Password toggle
    if (passwordToggle && loginPassword) {
        passwordToggle.addEventListener('click', () => {
            const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPassword.setAttribute('type', type);
            const icon = passwordToggle.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    }

    // Form submission
    // NOTE: Sessions are ONLY created here after successful login
    // No sessions are created before this point
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = loginPassword.value;
            const submitBtn = loginForm.querySelector('.btn-login-submit');
            const originalText = submitBtn.innerHTML;
            
            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });
                
                // Check if response is ok before parsing JSON
                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    alert('Server error. Please try again.');
                    return;
                }
                
                if (response.ok && data.success && data.user) {
                    // SESSION CREATION: Only happens here after successful login
                    const userData = data.user;
                    
                    // Ensure user data is valid before storing
                    if (!userData || !userData.email) {
                        console.error('Invalid user data received:', userData);
                        alert('Server error: Invalid user data received. Please try again.');
                        return;
                    }
                    
                    // Verify user has admin role
                    if (userData.role !== 'admin') {
                        console.error('User does not have admin role:', userData);
                        alert('Access denied: Admin role required. Please contact administrator.');
                        return;
                    }
                    
                    // Check if "Remember Me" is checked
                    const rememberMeCheckbox = document.getElementById('rememberMe');
                    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
                    
                    // Store authentication data synchronously (localStorage/sessionStorage are synchronous)
                    try {
                        if (rememberMe) {
                            // Remember Me checked: Use localStorage for persistent storage
                            localStorage.setItem('user', JSON.stringify(userData));
                            localStorage.setItem('dashboard_authenticated', 'true');
                            localStorage.setItem('remember_me', 'true'); // Flag for session manager
                            // Save email and password for autofill
                            localStorage.setItem('saved_email', email);
                            localStorage.setItem('saved_password', password);
                            // Also store in sessionStorage for immediate access
                            sessionStorage.setItem('user', JSON.stringify(userData));
                            sessionStorage.setItem('dashboard_authenticated', 'true');
                        } else {
                            // Remember Me not checked: Use sessionStorage (clears when tab closes)
                            sessionStorage.setItem('user', JSON.stringify(userData));
                            sessionStorage.setItem('dashboard_authenticated', 'true');
                            // Store in localStorage as backup, but session manager will clear it when last tab closes
                            localStorage.setItem('user', JSON.stringify(userData));
                            localStorage.setItem('dashboard_authenticated', 'true');
                            localStorage.removeItem('remember_me'); // Clear flag if unchecked
                            // Clear saved credentials
                            localStorage.removeItem('saved_email');
                            localStorage.removeItem('saved_password');
                        }
                    } catch (storageError) {
                        console.error('Error storing session data:', storageError);
                        alert('Error saving session. Please check your browser settings and try again.');
                        return;
                    }
                    
                    // Verify storage was successful - check both storage types
                    const storedUserLocal = localStorage.getItem('user');
                    const storedAuthLocal = localStorage.getItem('dashboard_authenticated');
                    const storedUserSession = sessionStorage.getItem('user');
                    const storedAuthSession = sessionStorage.getItem('dashboard_authenticated');
                    
                    // Ensure data exists in at least one storage type
                    const hasValidStorage = (storedUserLocal && storedAuthLocal === 'true') || 
                                          (storedUserSession && storedAuthSession === 'true');
                    
                    if (!hasValidStorage) {
                        console.error('Failed to verify session storage', {
                            local: { user: !!storedUserLocal, auth: storedAuthLocal },
                            session: { user: !!storedUserSession, auth: storedAuthSession }
                        });
                        alert('Error saving session. Please try again.');
                        return;
                    }
                    
                    // Double-check: Parse and validate stored user data
                    try {
                        const verifyUser = JSON.parse(storedUserLocal || storedUserSession || '{}');
                        if (!verifyUser.email || verifyUser.role !== 'admin') {
                            console.error('Stored user data is invalid:', verifyUser);
                            alert('Error: Invalid user data stored. Please try again.');
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing stored user data:', e);
                        alert('Error: Could not verify stored data. Please try again.');
                        return;
                    }
                    
                    // Force a synchronous flush to ensure storage is committed
                    // This is a workaround for browsers that delay storage commits
                    try {
                        // Trigger a storage event to ensure it's committed
                        if (rememberMe) {
                            localStorage.setItem('_auth_verify', Date.now().toString());
                            localStorage.removeItem('_auth_verify');
                        } else {
                            sessionStorage.setItem('_auth_verify', Date.now().toString());
                            sessionStorage.removeItem('_auth_verify');
                        }
                    } catch (e) {
                        console.warn('Storage verification flush failed:', e);
                    }
                    
                    // Initialize session manager to track tabs
                    if (window.SessionManager) {
                        window.SessionManager.init();
                    }
                    
                    // Update button to Dashboard and show dashboard nav button
                    checkAuthentication();
                    updateDashboardNavButton();
                    
                    // Close modal
                    closeModal();
                    
                    // CRITICAL FIX: Use a longer delay and ensure storage is committed
                    // Also add a query parameter to help dashboard verify the redirect
                    setTimeout(() => {
                        // Final verification before redirect
                        const finalCheckLocal = localStorage.getItem('dashboard_authenticated') === 'true';
                        const finalCheckSession = sessionStorage.getItem('dashboard_authenticated') === 'true';
                        const finalCheckUser = localStorage.getItem('user') || sessionStorage.getItem('user');
                        
                        if (finalCheckLocal || finalCheckSession) {
                            // Add timestamp to prevent caching issues
                            const redirectUrl = '/dashboard.html?_login=' + Date.now();
                            console.log('Redirecting to dashboard with verified auth:', {
                                local: finalCheckLocal,
                                session: finalCheckSession,
                                hasUser: !!finalCheckUser
                            });
                            window.location.replace(redirectUrl);
                        } else {
                            console.error('Storage lost before redirect!', {
                                local: localStorage.getItem('dashboard_authenticated'),
                                session: sessionStorage.getItem('dashboard_authenticated')
                            });
                            alert('Session storage error. Please try logging in again.');
                        }
                    }, 200); // Increased delay to 200ms for better reliability
                } else {
                    // Login failed - NO session created
                    // Show error message based on status code
                    let errorMsg = 'Invalid email or password';
                    
                    if (response.status === 401) {
                        errorMsg = data.detail || data.error || data.message || 'Invalid email or password';
                    } else if (response.status === 403) {
                        errorMsg = data.detail || data.error || data.message || 'Access denied: Admin role required';
                    } else if (response.status === 400) {
                        errorMsg = data.detail || data.error || data.message || 'Invalid request. Please check your input.';
                    } else if (response.status === 500) {
                        errorMsg = data.detail || data.error || data.message || 'Server error. Please try again later.';
                    } else {
                        errorMsg = data.detail || data.error || data.message || 'Login failed. Please try again.';
                    }
                    
                    alert(errorMsg);
                }
            } catch (error) {
                // Network error - NO session created
                console.error('Login error:', error);
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    alert('Network error. Please check your connection and try again.');
                } else {
                    alert('An error occurred. Please try again.');
                }
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
})();




