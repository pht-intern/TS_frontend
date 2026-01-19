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
            'activity-logs.html': 'Activity Logs',
            'settings.html': 'Settings',
            'blogs.html': 'Blogs Page',
            'blog-details.html': 'Blog Details Page',
            'nri-property-investment.html': 'NRI Property Investment',
            'privacy-policy.html': 'Privacy Policy',
            'terms-and-conditions.html': 'Terms and Conditions'
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
        // Track all events (both authenticated and unauthenticated)
        // For unauthenticated users, user_email will be null
        try {
            const pageName = getPageName();
            const pageUrl = window.location.href;
            const userEmail = getUserEmail(); // Returns null if not authenticated
            
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
            .then(async response => {
                if (!response.ok) {
                    const text = await response.text();
                    let errorData = null;
                    try {
                        errorData = JSON.parse(text);
                    } catch {
                        errorData = { message: text || `HTTP ${response.status}: ${response.statusText}` };
                    }
                    console.warn('Tracking API error:', response.status, errorData);
                    return null;
                }
                try {
                    return await response.json();
                } catch {
                    return null;
                }
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
        // Track all page views (both authenticated and unauthenticated)
        const pageName = getPageName();
        const pageUrl = window.location.href;
        const referrer = document.referrer || 'Direct';
        const userEmail = getUserEmail();
        
        // Get property ID from URL if on property details page
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('id');
        
        await trackEvent('page_view', userEmail ? `User ${userEmail} viewed: ${pageName}` : `Page viewed: ${pageName}`, {
            page: pageName,
            page_url: pageUrl,
            referrer: referrer,
            property_id: propertyId || null,
            is_authenticated: !!userEmail
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
    
    // Initialize click tracking for property cards and navigation
    function initPropertyClickTracking() {
        // Track navigation link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                const href = link.getAttribute('href');
                // Only track internal links (same domain)
                if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    const linkText = link.textContent?.trim() || link.getAttribute('title') || 'Link';
                    const targetPage = href.split('/').pop() || href;
                    trackEvent('navigation_click', `User clicked navigation link: ${linkText}`, {
                        link_text: linkText,
                        link_href: href,
                        target_page: targetPage,
                        link_url: link.href
                    });
                }
            }
        });
        
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

