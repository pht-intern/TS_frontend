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
        const user = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        if (isAuthenticated && user) {
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
        const user = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        // Determine desired button state
        const desiredState = (isAuthenticated && user) ? 'dashboard' : 'login';
        
        // Only update if state has changed
        if (currentButtonState === desiredState) {
            return; // Already in correct state, no need to update
        }
        
        currentButtonState = desiredState;
        
        if (isAuthenticated && user) {
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

    // Check authentication on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkAuthentication();
            updateDashboardNavButton();
        });
    } else {
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
                    
                    // Verify storage was successful
                    const storedUser = rememberMe ? localStorage.getItem('user') : sessionStorage.getItem('user');
                    const storedAuth = rememberMe ? localStorage.getItem('dashboard_authenticated') : sessionStorage.getItem('dashboard_authenticated');
                    if (!storedUser || storedAuth !== 'true') {
                        console.error('Failed to verify session storage');
                        alert('Error saving session. Please try again.');
                        return;
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
                    
                    // Small delay to ensure all storage operations are complete
                    // Then redirect to dashboard for successful login
                    // (Only admin users can login based on backend validation)
                    setTimeout(() => {
                        window.location.replace('/dashboard.html');
                    }, 100);
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




