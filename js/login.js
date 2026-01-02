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
        loginModal.classList.remove('active');
        document.body.style.overflow = '';
    }

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
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // SESSION CREATION: Only happens here after successful login
                    // Store user info in sessionStorage (clears when all tabs close)
                    // Also store in localStorage as backup, but session manager will clear it when last tab closes
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                    sessionStorage.setItem('dashboard_authenticated', 'true');
                    // Store in localStorage as well (session manager will manage clearing)
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('dashboard_authenticated', 'true');
                    
                    // Initialize session manager to track tabs
                    if (window.SessionManager) {
                        window.SessionManager.init();
                    }
                    
                    // Update button to Dashboard and show dashboard nav button
                    checkAuthentication();
                    updateDashboardNavButton();
                    
                    // Close modal and redirect
                    closeModal();
                    
                    // Redirect to dashboard if admin, otherwise show success
                    if (data.user && data.user.role === 'admin') {
                        window.location.href = '/dashboard.html';
                    } else {
                        alert('Login successful!');
                        // Optionally redirect to user dashboard or profile
                    }
                } else {
                    // Login failed - NO session created
                    // Show error message
                    const errorMsg = data.detail || data.error || 'Invalid email or password';
                    alert(errorMsg);
                }
            } catch (error) {
                // Network error - NO session created
                console.error('Login error:', error);
                alert('Network error. Please check your connection and try again.');
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
})();




