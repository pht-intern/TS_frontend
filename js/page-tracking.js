// Page View and Click Tracking
// Tracks page opens/clicks and sends to logs API

(function() {
    // Get page name from URL or document title
    function getPageName() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        
        // Map page names to friendly names
        const pageNames = {
            'index.html': 'Homepage',
            '': 'Homepage',
            'properties.html': 'Properties Page',
            'property-details.html': 'Property Details Page',
            'dashboard.html': 'Dashboard',
            'database.html': 'Database Export',
            'blogs.html': 'Blogs Page',
            'blog-details.html': 'Blog Details Page'
        };
        
        return pageNames[page] || page.replace('.html', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Check if user is authenticated
    function isUserAuthenticated() {
        try {
            const isAuthenticated = localStorage.getItem('dashboard_authenticated') === 'true' ||
                                   sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                                   localStorage.getItem('isAuthenticated') === 'true' ||
                                   sessionStorage.getItem('isAuthenticated') === 'true';
            const user = localStorage.getItem('user') || sessionStorage.getItem('user');
            return isAuthenticated && user !== null;
        } catch (e) {
            return false;
        }
    }
    
    // Get user email if logged in
    function getUserEmail() {
        try {
            const user = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (user) {
                const userData = JSON.parse(user);
                return userData.email || null;
            }
        } catch (e) {
            return null;
        }
        return null;
    }
    
    // Generic function to track events
    async function trackEvent(action, description, metadata = {}) {
        // Only track events if user is authenticated
        if (!isUserAuthenticated()) {
            return;
        }
        
        try {
            const pageName = getPageName();
            const pageUrl = window.location.href;
            const userEmail = getUserEmail();
            
            const logData = {
                log_type: 'action',
                action: action,
                description: description,
                user_email: userEmail,
                metadata: {
                    page_name: pageName,
                    page_url: pageUrl,
                    timestamp: new Date().toISOString(),
                    ...metadata
                }
            };
            
            // Send to logs API (fire and forget - don't block page load)
            fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(logData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => null).then(errorData => {
                        console.warn('Tracking API error:', response.status, errorData);
                        return null;
                    });
                }
                return response.json().catch(() => null);
            })
            .catch(error => {
                console.warn('Tracking network error:', error);
            });
        } catch (error) {
            console.warn('Tracking error:', error);
        }
    }
    
    // Track page view
    async function trackPageView() {
        // Only track page views if user is authenticated
        if (!isUserAuthenticated()) {
            return;
        }
        
        const pageName = getPageName();
        const pageUrl = window.location.href;
        const referrer = document.referrer || 'Direct';
        
        // Get property ID from URL if on property details page
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('id');
        
        await trackEvent('page_view', `Page viewed: ${pageName}`, {
            referrer: referrer,
            property_id: propertyId || null
        });
    }
    
    // Track property card clicks
    function trackPropertyClick(propertyId, propertyTitle, action = 'property_click') {
        trackEvent(action, `Property clicked: ${propertyTitle}`, {
            property_id: propertyId,
            property_title: propertyTitle
        });
    }
    
    // Track button/link clicks
    function trackButtonClick(buttonText, buttonType = 'button_click', metadata = {}) {
        trackEvent(buttonType, `Button clicked: ${buttonText}`, metadata);
    }
    
    // Initialize click tracking for property cards
    function initPropertyClickTracking() {
        // Track property card clicks on properties page
        document.addEventListener('click', (e) => {
            // Skip if clicking on buttons or links (they have their own tracking)
            if (e.target.closest('button, a.btn-view-details')) {
                return;
            }
            
            const propertyCard = e.target.closest('.property-card');
            if (propertyCard) {
                const propertyId = propertyCard.getAttribute('data-property-id') || 
                                 propertyCard.getAttribute('data-id');
                const propertyTitle = propertyCard.querySelector('.property-title')?.textContent?.trim() ||
                                    propertyCard.querySelector('h3')?.textContent?.trim() ||
                                    'Unknown Property';
                
                if (propertyId) {
                    trackPropertyClick(propertyId, propertyTitle, 'property_card_click');
                }
            }
            
            // Track "View Details" button clicks
            const viewDetailsBtn = e.target.closest('.btn-view-details, a[href*="property-details"]');
            if (viewDetailsBtn) {
                const href = viewDetailsBtn.getAttribute('href') || '';
                const propertyIdMatch = href.match(/[?&]id=(\d+)/);
                const propertyCard = viewDetailsBtn.closest('.property-card');
                const propertyId = propertyIdMatch ? propertyIdMatch[1] : 
                                 (propertyCard?.getAttribute('data-property-id') ||
                                  propertyCard?.getAttribute('data-id'));
                const propertyTitle = propertyCard?.querySelector('.property-title')?.textContent?.trim() ||
                                    propertyCard?.querySelector('h3')?.textContent?.trim() ||
                                    'Unknown Property';
                
                trackButtonClick('View Details', 'view_details_click', {
                    property_id: propertyId,
                    property_title: propertyTitle,
                    button_text: 'View Details'
                });
            }
            
            // Track property type card clicks
            const typeCard = e.target.closest('.type-card');
            if (typeCard) {
                const type = typeCard.getAttribute('data-type');
                const typeName = typeCard.querySelector('h3')?.textContent?.trim() || type || 'Unknown';
                trackButtonClick(typeName, 'property_type_click', {
                    property_type: type
                });
            }
        });
    }
    
    // Track page view when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Small delay to ensure page is fully loaded
            setTimeout(trackPageView, 500);
            // Initialize click tracking
            setTimeout(initPropertyClickTracking, 500);
        });
    } else {
        // Page already loaded
        setTimeout(trackPageView, 500);
        setTimeout(initPropertyClickTracking, 500);
    }
    
    // Also track when page becomes visible (for single-page app navigation)
    // Only track if user is authenticated
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isUserAuthenticated()) {
            // Page became visible - track again if it's a new navigation
            setTimeout(trackPageView, 100);
        }
    });
    
    // Expose tracking functions globally for use in other scripts
    window.trackEvent = trackEvent;
    window.trackPropertyClick = trackPropertyClick;
    window.trackButtonClick = trackButtonClick;
})();

