// Dashboard JavaScript
console.log('[DASHBOARD] dashboard.js script file loaded!');

// Safe JSON parsing helper - checks response.ok before parsing
async function safeJsonParse(response) {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
    }
    return await response.json();
}

// Format price for display (same logic as property-details.js)
function formatPropertyPrice(property) {
    // Get price_text from property object
    let displayPriceText = '';
    if (property.price_text !== null && property.price_text !== undefined && property.price_text !== '') {
        displayPriceText = String(property.price_text).trim();
    }
    
    // Check if this is a per sq.ft. price - if so, display price_text as-is or format the numeric price
    const isPerSqft = displayPriceText && (
        displayPriceText.toLowerCase().includes('sq.ft') || 
        displayPriceText.toLowerCase().includes('sqft') || 
        displayPriceText.toLowerCase().includes('per sq') ||
        displayPriceText.toLowerCase().includes('/sq')
    );
    
    if (isPerSqft) {
        // For per sq.ft. prices, show the price_text if available, otherwise format the numeric price
        if (displayPriceText) {
            return displayPriceText;
        } else if (typeof property.price === 'number' && property.price > 0) {
            return `Rs. ${property.price.toLocaleString('en-IN')}/- Sq.Ft.`;
        }
    }
    
    // Priority: price_text > string price > formatted numeric price
    if (displayPriceText && displayPriceText !== '' && displayPriceText !== String(property.price) && displayPriceText !== String(Math.round(property.price))) {
        // Use the price text if available
        if (displayPriceText.includes(',')) {
            return displayPriceText.split(',')[0].trim();
        }
        return displayPriceText;
    } else if (typeof property.price === 'string' && property.price.trim() !== '') {
        const priceStr = property.price.trim();
        if (priceStr.includes('Rs.') || priceStr.includes('₹') || priceStr.includes('Cr') || priceStr.includes('Lakh')) {
            return priceStr;
        }
        const numPrice = parseFloat(priceStr);
        if (!isNaN(numPrice)) {
            property.price = numPrice;
        } else {
            return priceStr;
        }
    }
    
    // Format numeric price
    if (typeof property.price === 'number' && property.price > 0) {
        if (property.price >= 10000000) {
            const crores = (property.price / 10000000).toFixed(2);
            return `Rs. ${crores} Cr`;
        } else if (property.price >= 100000) {
            const lakhs = (property.price / 100000).toFixed(2);
            return `Rs. ${lakhs} Lakh`;
        } else if (property.price >= 1000) {
            const thousands = (property.price / 1000).toFixed(2);
            return `Rs. ${thousands} K`;
        } else if (property.price < 100 && property.price > 0 && property.price < 10) {
            if (!displayPriceText) {
                return 'Price on request';
            }
            return displayPriceText || 'Price on request';
        } else if (property.price < 100 && property.price > 0) {
            return `Rs. ${property.price.toFixed(2)} Cr`;
        } else {
            return `Rs. ${property.price.toLocaleString('en-IN')}`;
        }
    }
    
    return 'Price on request';
}

// Authentication
// Note: Credentials are no longer hardcoded - login is handled via API
const AUTH_KEY = 'dashboard_authenticated';
const PROPERTIES_KEY = 'dashboard_properties';

// Store currently loaded properties for search
let currentProperties = [];
// Store currently loaded testimonials for search
let currentTestimonials = [];
// Store currently loaded partners for search
let currentPartners = [];
// Store currently loaded inquiries
let currentInquiries = [];
// Store currently loaded visitors
let currentVisitors = [];
// Store currently loaded logs

// Suppress Quill.js deprecation warnings
if (typeof console !== 'undefined') {
    const originalWarn = console.warn;
    console.warn = function(...args) {
        // Filter out Quill.js DOMNodeInserted deprecation warnings
        if (args.length > 0 && typeof args[0] === 'string' && 
            (args[0].includes('DOMNodeInserted') || args[0].includes('quill.js'))) {
            return; // Suppress this warning
        }
        originalWarn.apply(console, args);
    };
}

// Initialize - works regardless of when script loads
function initializeDashboard() {
    console.log('[DASHBOARD] Initializing...', 'readyState:', document.readyState);
    
    // Only initialize dashboard if we're on the dashboard page
    const isDashboardPage = document.getElementById('loginScreen') || document.getElementById('dashboardContainer');
    console.log('[DASHBOARD] isDashboardPage:', !!isDashboardPage);
    
    if (isDashboardPage) {
        console.log('[DASHBOARD] Dashboard page detected, starting initialization...');
        checkAuthentication();
        initDashboard();
        
        // Set up event delegation for edit buttons (fallback for inline onclick)
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.dashboard-action-btn.edit');
            if (editBtn && editBtn.hasAttribute('data-property-id')) {
                const propertyId = editBtn.getAttribute('data-property-id');
                if (propertyId && typeof editProperty === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Event delegation: calling editProperty with id:', propertyId);
                    editProperty(parseInt(propertyId));
                } else if (!propertyId) {
                    console.error('Edit button clicked but no property ID found');
                } else {
                    console.error('editProperty function not available');
                }
            }
        });
    } else {
        console.warn('[DASHBOARD] Dashboard page not detected, skipping initialization');
    }
}

// Try to initialize - handle all possible states
console.log('[DASHBOARD] Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    console.log('[DASHBOARD] DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[DASHBOARD] DOMContentLoaded fired');
        initializeDashboard();
    });
} else {
    // DOM is already loaded or interactive, initialize immediately
    console.log('[DASHBOARD] DOM already loaded, initializing immediately...');
    // Use setTimeout to ensure all scripts are ready
    setTimeout(function() {
        initializeDashboard();
    }, 0);
}

// Also try on window load as a fallback (in case script loads very late)
window.addEventListener('load', function() {
    console.log('[DASHBOARD] Window load event fired');
    // Only initialize if not already done (check if functions exist)
    const dashboardContainer = document.getElementById('dashboardContainer');
    if (dashboardContainer && typeof initDashboard === 'function') {
        // Check if already initialized by looking for a marker
        if (!dashboardContainer.dataset.initialized) {
            console.log('[DASHBOARD] Initializing on window load (fallback)');
            dashboardContainer.dataset.initialized = 'true';
            initializeDashboard();
        }
    }
});

// Check Authentication
function checkAuthentication() {
    const dashboardContainer = document.getElementById('dashboardContainer');
    
    // Only proceed if we're on the dashboard page
    if (!dashboardContainer) {
        return;
    }
    
    // Helper function to clear all authentication data
    function clearAllAuthData() {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem('dashboard_authenticated');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
    }
    
    // Check if user is authenticated - prioritize localStorage (persistent session)
    // Session now persists until explicit logout
    const isAuthenticated = localStorage.getItem('dashboard_authenticated') === 'true' ||
                           localStorage.getItem(AUTH_KEY) === 'true' ||
                           sessionStorage.getItem('dashboard_authenticated') === 'true' ||
                           sessionStorage.getItem(AUTH_KEY) === 'true';
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
                // Invalid user data
                user = null;
                hasValidUser = false;
            }
        } catch (e) {
            // Invalid JSON, treat as not authenticated
            user = null;
            hasValidUser = false;
        }
    }
    
    // CRITICAL: Verify both authentication flag AND valid user data exist
    // If either is missing or invalid, redirect immediately
    if (!isAuthenticated || !hasValidUser || !user) {
        // Clear any partial or invalid auth data from both storage types
        clearAllAuthData();
        // Redirect to index.html if not authenticated
        window.location.replace('/index.html');
        return;
    }
    
    // Sync localStorage to sessionStorage for immediate access
    // This ensures both storage types are in sync
    const localAuth = localStorage.getItem('dashboard_authenticated');
    const localUser = localStorage.getItem('user');
    const sessionAuth = sessionStorage.getItem('dashboard_authenticated');
    const sessionUser = sessionStorage.getItem('user');
    
    // If localStorage has auth but sessionStorage doesn't, sync it
    if (localAuth === 'true' && localUser && (!sessionAuth || !sessionUser)) {
        try {
            sessionStorage.setItem('dashboard_authenticated', 'true');
            sessionStorage.setItem('user', localUser);
        } catch (e) {
            console.error('Error syncing to sessionStorage:', e);
        }
    }
    
    // If sessionStorage has auth but localStorage doesn't, sync it (for consistency)
    if (sessionAuth === 'true' && sessionUser && (!localAuth || !localUser)) {
        try {
            localStorage.setItem('dashboard_authenticated', 'true');
            localStorage.setItem('user', sessionUser);
        } catch (e) {
            console.error('Error syncing to localStorage:', e);
        }
    }
    
    // Authentication check completed
    
    // Initialize session manager to track tabs and handle automatic logout
    if (window.SessionManager) {
        window.SessionManager.init();
    }
    
    // Set up listener to clear session when user navigates away
    setupSessionCleanup();
}

// Get admin email from localStorage (persistent) or sessionStorage
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

// Helper function to make authenticated fetch requests
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
    
    // Making authenticated request
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Setup session persistence - session now persists until explicit logout
function setupSessionCleanup() {
    // Session manager handles automatic logout when all tabs are closed
    // The session manager tracks active tabs and clears session when the last tab closes
    // This ensures sessions expire when the site is completely closed
}

// Initialize Dashboard
function initDashboard() {
    console.log('Initializing dashboard...');
    
    // Initialize navigation active states
    initDashboardNavigation();
    
    // Initialize user profile
    initUserProfile();
    
    // Logout
    const logoutBtn = document.getElementById('dashboardLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Export buttons for individual tables
    const exportPropertiesBtn = document.getElementById('exportPropertiesBtn');
    if (exportPropertiesBtn) {
        // Export combined properties (both residential and plot)
        exportPropertiesBtn.addEventListener('click', () => handleExportTable('properties', exportPropertiesBtn));
    }

    const exportTestimonialsBtn = document.getElementById('exportTestimonialsBtn');
    if (exportTestimonialsBtn) {
        exportTestimonialsBtn.addEventListener('click', () => handleExportTable('testimonials', exportTestimonialsBtn));
    }

    const exportPartnersBtn = document.getElementById('exportPartnersBtn');
    if (exportPartnersBtn) {
        exportPartnersBtn.addEventListener('click', () => handleExportTable('partners', exportPartnersBtn));
    }

    const exportScheduleVisitsBtn = document.getElementById('exportScheduleVisitsBtn');
    if (exportScheduleVisitsBtn) {
        exportScheduleVisitsBtn.addEventListener('click', () => handleExportTable('contact_inquiries', exportScheduleVisitsBtn));
    }

    const exportContactInquiriesBtn = document.getElementById('exportContactInquiriesBtn');
    if (exportContactInquiriesBtn) {
        exportContactInquiriesBtn.addEventListener('click', () => handleExportTable('contact_inquiries', exportContactInquiriesBtn));
    }

    const exportVisitorsBtn = document.getElementById('exportVisitorsBtn');
    if (exportVisitorsBtn) {
        exportVisitorsBtn.addEventListener('click', () => handleExportTable('visitor_info', exportVisitorsBtn));
    }

    // Import buttons for individual tables
    const importPropertiesBtn = document.getElementById('importPropertiesBtn');
    const importPropertiesFile = document.getElementById('importPropertiesFile');
    if (importPropertiesBtn && importPropertiesFile) {
        importPropertiesBtn.addEventListener('click', () => importPropertiesFile.click());
        importPropertiesFile.addEventListener('change', (e) => handleImportTable('properties', e.target.files[0], importPropertiesBtn));
    }

    const importTestimonialsBtn = document.getElementById('importTestimonialsBtn');
    const importTestimonialsFile = document.getElementById('importTestimonialsFile');
    if (importTestimonialsBtn && importTestimonialsFile) {
        importTestimonialsBtn.addEventListener('click', () => importTestimonialsFile.click());
        importTestimonialsFile.addEventListener('change', (e) => handleImportTable('testimonials', e.target.files[0], importTestimonialsBtn));
    }

    const importPartnersBtn = document.getElementById('importPartnersBtn');
    const importPartnersFile = document.getElementById('importPartnersFile');
    if (importPartnersBtn && importPartnersFile) {
        importPartnersBtn.addEventListener('click', () => importPartnersFile.click());
        importPartnersFile.addEventListener('change', (e) => handleImportTable('partners', e.target.files[0], importPartnersBtn));
    }

    const importScheduleVisitsBtn = document.getElementById('importScheduleVisitsBtn');
    const importScheduleVisitsFile = document.getElementById('importScheduleVisitsFile');
    if (importScheduleVisitsBtn && importScheduleVisitsFile) {
        importScheduleVisitsBtn.addEventListener('click', () => importScheduleVisitsFile.click());
        importScheduleVisitsFile.addEventListener('change', (e) => handleImportTable('contact_inquiries', e.target.files[0], importScheduleVisitsBtn));
    }

    const importContactInquiriesBtn = document.getElementById('importContactInquiriesBtn');
    const importContactInquiriesFile = document.getElementById('importContactInquiriesFile');
    if (importContactInquiriesBtn && importContactInquiriesFile) {
        importContactInquiriesBtn.addEventListener('click', () => importContactInquiriesFile.click());
        importContactInquiriesFile.addEventListener('change', (e) => handleImportTable('contact_inquiries', e.target.files[0], importContactInquiriesBtn));
    }

    const importVisitorsBtn = document.getElementById('importVisitorsBtn');
    const importVisitorsFile = document.getElementById('importVisitorsFile');
    if (importVisitorsBtn && importVisitorsFile) {
        importVisitorsBtn.addEventListener('click', () => importVisitorsFile.click());
        importVisitorsFile.addEventListener('change', (e) => handleImportTable('visitor_info', e.target.files[0], importVisitorsBtn));
    }


    // Residential Property form
    const residentialPropertyForm = document.getElementById('residentialPropertyForm');
    if (residentialPropertyForm) {
        residentialPropertyForm.addEventListener('submit', handleResidentialPropertySubmit);
    }

    // Residential Property modal controls
    const residentialPropertyModal = document.getElementById('residentialPropertyModal');
    const residentialPropertyModalOverlay = document.getElementById('residentialPropertyModalOverlay');
    const residentialPropertyModalClose = document.getElementById('residentialPropertyModalClose');
    const cancelResidentialPropertyBtn = document.getElementById('cancelResidentialPropertyBtn');
    
    if (residentialPropertyModalOverlay) {
        residentialPropertyModalOverlay.addEventListener('click', closeResidentialPropertyModal);
    }
    if (residentialPropertyModalClose) {
        residentialPropertyModalClose.addEventListener('click', closeResidentialPropertyModal);
    }
    if (cancelResidentialPropertyBtn) {
        cancelResidentialPropertyBtn.addEventListener('click', closeResidentialPropertyModal);
    }

    // Step navigation for residential property form
    const residentialNextStepBtn = document.getElementById('residentialNextStepBtn');
    const residentialPrevStepBtn = document.getElementById('residentialPrevStepBtn');
    const residentialSubmitBtn = document.getElementById('residentialSubmitBtn');
    const residentialPropertyTypeSelect = document.getElementById('residentialPropertyType');
    
    // Attach event listeners with proper event handling
    if (residentialNextStepBtn) {
        // Remove any existing listeners by using once or by storing reference
        residentialNextStepBtn.onclick = null; // Clear any inline handlers
        residentialNextStepBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Next button clicked');
            handleResidentialPropertyStepNavigation('next');
        }, { capture: false });
    }
    if (residentialPrevStepBtn) {
        residentialPrevStepBtn.onclick = null;
        residentialPrevStepBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleResidentialPropertyStepNavigation('prev');
        }, { capture: false });
    }
    if (residentialPropertyTypeSelect) {
        residentialPropertyTypeSelect.addEventListener('change', handleResidentialPropertyTypeChange);
    }

    // Location link validation with real-time feedback
    const residentialLocationLink = document.getElementById('residentialLocationLink');
    if (residentialLocationLink) {
        // Validate on blur (when user leaves the field)
        residentialLocationLink.addEventListener('blur', function() {
            validateLocationLinkField(this);
        });
        
        // Optional: Validate on input change (real-time feedback)
        residentialLocationLink.addEventListener('input', function() {
            // Clear previous error styling if URL becomes valid
            if (this.value.trim()) {
                const isValid = validateLocationLinkField(this, true); // true = silent mode (no notification)
                if (isValid) {
                    this.style.borderColor = '';
                    this.style.borderWidth = '';
                }
            } else {
                // Clear styling if field is empty
                this.style.borderColor = '';
                this.style.borderWidth = '';
            }
        });
    }

    // Gallery management for residential property form
    const residentialAddImageBtn = document.getElementById('residentialAddImageBtn');
    if (residentialAddImageBtn) {
        residentialAddImageBtn.addEventListener('click', addResidentialGalleryItem);
    }

    // Plot Property form
    const plotPropertyForm = document.getElementById('plotPropertyForm');
    if (plotPropertyForm) {
        plotPropertyForm.addEventListener('submit', handlePlotPropertySubmit);
    }

    // Image upload (old property form)
    const imageUploadArea = document.getElementById('imageUploadArea');
    const propertyImages = document.getElementById('propertyImages');
    if (imageUploadArea && propertyImages) {
        imageUploadArea.addEventListener('click', () => propertyImages.click());
        imageUploadArea.addEventListener('dragover', handleDragOver);
        imageUploadArea.addEventListener('drop', handleDrop);
        propertyImages.addEventListener('change', handleImageSelect);
    }

    // Helper function to initialize image upload area
    function initImageUploadArea(uploadAreaId, fileInputId, formType, imageCategory) {
        const uploadArea = document.getElementById(uploadAreaId);
        const fileInput = document.getElementById(fileInputId);
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
                handleImageFiles(e.dataTransfer.files, formType, imageCategory);
            });
            fileInput.addEventListener('change', (e) => {
                handleImageFiles(e.target.files, formType, imageCategory);
            });
        }
    }

    // Image upload (residential property form - Project Images)
    initImageUploadArea('residentialProjectImageUploadArea', 'residentialProjectImages', 'residential', 'project');
    
    // Image upload (residential property form - Floor Plan)
    initImageUploadArea('residentialFloorPlanImageUploadArea', 'residentialFloorPlanImages', 'residential', 'floorplan');
    
    // Image upload (residential property form - Master Plan)
    initImageUploadArea('residentialMasterPlanImageUploadArea', 'residentialMasterPlanImages', 'residential', 'masterplan');

    // Image upload (plot property form - Project Images)
    initImageUploadArea('plotProjectImageUploadArea', 'plotProjectImages', 'plot', 'project');
    
    // Image upload (plot property form - Floor Plan)
    initImageUploadArea('plotFloorPlanImageUploadArea', 'plotFloorPlanImages', 'plot', 'floorplan');
    
    // Image upload (plot property form - Master Plan)
    initImageUploadArea('plotMasterPlanImageUploadArea', 'plotMasterPlanImages', 'plot', 'masterplan');

    // Features management
    const addFeatureBtn = document.getElementById('addFeatureBtn');
    const featureInput = document.getElementById('featureInput');
    if (addFeatureBtn && featureInput) {
        addFeatureBtn.addEventListener('click', addFeature);
        featureInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addFeature();
            }
        });
    }


    // Unit Type buttons (for residential property form)
    const residentialUnitTypeButtons = document.querySelectorAll('#residentialPropertyForm .dashboard-unit-type-btn');
    residentialUnitTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons in this form
            residentialUnitTypeButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update hidden input fields
            const bedroomsInput = document.getElementById('residentialBedrooms');
            const unitTypeInput = document.getElementById('residentialUnitType');
            
            if (bedroomsInput) {
                bedroomsInput.value = btn.dataset.bedrooms || '1';
            }
            if (unitTypeInput) {
                unitTypeInput.value = btn.dataset.unitType || '';
            }
        });
    });

    // Modal controls

    // Delete modal
    const deleteModal = document.getElementById('deleteModal');
    const deleteModalOverlay = document.getElementById('deleteModalOverlay');
    const deleteModalClose = document.getElementById('deleteModalClose');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (deleteModalOverlay) {
        deleteModalOverlay.addEventListener('click', closeDeleteModal);
    }
    if (deleteModalClose) {
        deleteModalClose.addEventListener('click', closeDeleteModal);
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }

    // Add Property button
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', () => {
            // Open property type selection or default to residential
            // For now, we'll open residential property modal directly
            // You can add a property type selection modal later if needed
            openResidentialPropertyModal();
        });
    }

    // Search
    const propertySearch = document.getElementById('propertySearch');
    if (propertySearch) {
        propertySearch.addEventListener('input', handleSearch);
    }

    // Testimonial management
    const addTestimonialBtn = document.getElementById('addTestimonialBtn');
    if (addTestimonialBtn) {
        addTestimonialBtn.addEventListener('click', () => openTestimonialModal());
    }

    // Testimonial form
    const testimonialForm = document.getElementById('testimonialForm');
    if (testimonialForm) {
        testimonialForm.addEventListener('submit', handleTestimonialSubmit);
    }

    // Testimonial modal controls
    const testimonialModal = document.getElementById('testimonialModal');
    const testimonialModalOverlay = document.getElementById('testimonialModalOverlay');
    const testimonialModalClose = document.getElementById('testimonialModalClose');
    const cancelTestimonialBtn = document.getElementById('cancelTestimonialBtn');
    
    if (testimonialModalOverlay) {
        testimonialModalOverlay.addEventListener('click', closeTestimonialModal);
    }
    if (testimonialModalClose) {
        testimonialModalClose.addEventListener('click', closeTestimonialModal);
    }
    if (cancelTestimonialBtn) {
        cancelTestimonialBtn.addEventListener('click', closeTestimonialModal);
    }

    // Testimonial search
    const testimonialSearch = document.getElementById('testimonialSearch');
    if (testimonialSearch) {
        testimonialSearch.addEventListener('input', handleTestimonialSearch);
    }

    // Partner management
    const addPartnerBtn = document.getElementById('addPartnerBtn');
    if (addPartnerBtn) {
        addPartnerBtn.addEventListener('click', () => openPartnerModal());
    }

    // Partner form
    const partnerForm = document.getElementById('partnerForm');
    if (partnerForm) {
        partnerForm.addEventListener('submit', handlePartnerSubmit);
    }

    // Partner modal controls
    const partnerModal = document.getElementById('partnerModal');
    const partnerModalOverlay = document.getElementById('partnerModalOverlay');
    const partnerModalClose = document.getElementById('partnerModalClose');
    const cancelPartnerBtn = document.getElementById('cancelPartnerBtn');
    
    if (partnerModalOverlay) {
        partnerModalOverlay.addEventListener('click', closePartnerModal);
    }
    if (partnerModalClose) {
        partnerModalClose.addEventListener('click', closePartnerModal);
    }
    if (cancelPartnerBtn) {
        cancelPartnerBtn.addEventListener('click', closePartnerModal);
    }

    // Partner logo upload
    const partnerLogoUploadArea = document.getElementById('partnerLogoUploadArea');
    const partnerLogos = document.getElementById('partnerLogos');
    if (partnerLogoUploadArea && partnerLogos) {
        partnerLogoUploadArea.addEventListener('click', () => partnerLogos.click());
        partnerLogoUploadArea.addEventListener('dragover', handlePartnerLogoDragOver);
        partnerLogoUploadArea.addEventListener('drop', handlePartnerLogoDrop);
        partnerLogos.addEventListener('change', handlePartnerLogoSelect);
    }

    // Partner search
    const partnerSearch = document.getElementById('partnerSearch');
    if (partnerSearch) {
        partnerSearch.addEventListener('input', handlePartnerSearch);
    }

    // Blog management
    const addBlogBtn = document.getElementById('addBlogBtn');
    if (addBlogBtn) {
        addBlogBtn.addEventListener('click', () => openBlogModal());
    }

    // Blog form
    const blogForm = document.getElementById('blogForm');
    if (blogForm) {
        blogForm.addEventListener('submit', handleBlogSubmit);
    }

    // Blog tag management
    const addBlogTagBtn = document.getElementById('addBlogTagBtn');
    const blogTagInput = document.getElementById('blogTagInput');
    if (addBlogTagBtn && blogTagInput) {
        addBlogTagBtn.addEventListener('click', addBlogTag);
        blogTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addBlogTag();
            }
        });
    }

    // Blog image upload
    const blogImageUploadArea = document.getElementById('blogImageUploadArea');
    const blogImage = document.getElementById('blogImage');
    if (blogImageUploadArea && blogImage) {
        blogImageUploadArea.addEventListener('click', () => blogImage.click());
        blogImageUploadArea.addEventListener('dragover', handleBlogImageDragOver);
        blogImageUploadArea.addEventListener('drop', handleBlogImageDrop);
        blogImage.addEventListener('change', handleBlogImageSelect);
    }

    // Initialize Quill editor for blog content
    initBlogContentEditor();

    // Blog modal controls
    const blogModal = document.getElementById('blogModal');
    const blogModalOverlay = document.getElementById('blogModalOverlay');
    const blogModalClose = document.getElementById('blogModalClose');
    const cancelBlogBtn = document.getElementById('cancelBlogBtn');
    
    if (blogModalOverlay) {
        blogModalOverlay.addEventListener('click', closeBlogModal);
    }
    if (blogModalClose) {
        blogModalClose.addEventListener('click', closeBlogModal);
    }
    if (cancelBlogBtn) {
        cancelBlogBtn.addEventListener('click', closeBlogModal);
    }

    // Blog search
    const blogSearch = document.getElementById('blogSearch');
    if (blogSearch) {
        blogSearch.addEventListener('input', handleBlogSearch);
    }

    // Blog export/import
    const exportBlogsBtn = document.getElementById('exportBlogsBtn');
    if (exportBlogsBtn) {
        exportBlogsBtn.addEventListener('click', () => handleExportTable('blogs', exportBlogsBtn));
    }

    const importBlogsBtn = document.getElementById('importBlogsBtn');
    const importBlogsFile = document.getElementById('importBlogsFile');
    if (importBlogsBtn && importBlogsFile) {
        importBlogsBtn.addEventListener('click', () => importBlogsFile.click());
        importBlogsFile.addEventListener('change', (e) => handleImportTable('blogs', e.target.files[0], importBlogsBtn));
    }

    // Inquiry search
    const contactAgentSearch = document.getElementById('contactAgentSearch');
    if (contactAgentSearch) {
        contactAgentSearch.addEventListener('input', handleContactAgentSearch);
    }

    const scheduleVisitSearch = document.getElementById('scheduleVisitSearch');
    if (scheduleVisitSearch) {
        scheduleVisitSearch.addEventListener('input', handleScheduleVisitSearch);
    }

    const contactInquirySearch = document.getElementById('contactInquirySearch');
    if (contactInquirySearch) {
        contactInquirySearch.addEventListener('input', handleContactInquirySearch);
    }

    // Contact Inquiry View Modal
    const contactInquiryViewModal = document.getElementById('contactInquiryViewModal');
    const contactInquiryViewModalOverlay = document.getElementById('contactInquiryViewModalOverlay');
    const contactInquiryViewModalClose = document.getElementById('contactInquiryViewModalClose');
    const contactInquiryViewCloseBtn = document.getElementById('contactInquiryViewCloseBtn');
    const contactInquiryViewUpdateBtn = document.getElementById('contactInquiryViewUpdateBtn');
    
    if (contactInquiryViewModalOverlay) {
        contactInquiryViewModalOverlay.addEventListener('click', closeContactInquiryViewModal);
    }
    if (contactInquiryViewModalClose) {
        contactInquiryViewModalClose.addEventListener('click', closeContactInquiryViewModal);
    }
    if (contactInquiryViewCloseBtn) {
        contactInquiryViewCloseBtn.addEventListener('click', closeContactInquiryViewModal);
    }
    if (contactInquiryViewUpdateBtn) {
        contactInquiryViewUpdateBtn.addEventListener('click', updateContactInquiryStatusFromModal);
    }

    // Visitor search
    const visitorSearch = document.getElementById('visitorSearch');
    if (visitorSearch) {
        visitorSearch.addEventListener('input', handleVisitorSearch);
    }

    // Load properties, testimonials, partners, and blogs
    loadProperties();
    loadTestimonials();
    loadPartners();
    loadBlogs();
    loadInquiries();
    loadVisitorInfo();
    loadPageVisitStats(true); // Load page visit stats with loading indicator
    
    // Load categories for Property Type dropdown
    loadCategoriesForPropertyTypeDropdown();
    
    // Listen for category updates from settings page
    window.addEventListener('storage', function(e) {
        if (e.key === 'categories_updated') {
            // Reload categories when they are updated in settings
            loadCategoriesForPropertyTypeDropdown();
        }
    });
    
    // Also listen for custom event (for same-tab updates)
    window.addEventListener('categoriesUpdated', function() {
        loadCategoriesForPropertyTypeDropdown();
    });
    
    // Initialize stat card click tracking
    initStatCardTracking();
    
    // Start auto-refresh for visitor info and activity logs
    startAutoRefresh();
    
    // Initialize Application Monitoring (metrics, charts, cache logs)
    if (typeof initMetricsMonitoring === 'function') {
        initMetricsMonitoring();
    }
}

// Login is now handled in the main site login modal (index.html, properties.html, property-details.html)
// When dashboard credentials are used, it redirects to dashboard.html

// Initialize User Profile
function initUserProfile(retryCount = 0) {
    const MAX_RETRIES = 5;
    const profileBtn = document.getElementById('dashboardProfileBtn');
    const profileDropdown = document.getElementById('dashboardProfileDropdown');
    const profileName = document.getElementById('dashboardProfileName');
    const profileFullname = document.getElementById('dashboardProfileFullname');
    const profileEmail = document.getElementById('dashboardProfileEmail');
    const userProfile = document.getElementById('dashboardUserProfile');
    
    // Debug: Check if elements exist
    if (!profileBtn || !profileDropdown || !userProfile) {
        if (retryCount < MAX_RETRIES) {
            console.warn(`Profile elements not found, retrying (${retryCount + 1}/${MAX_RETRIES})...`, {
                profileBtn: !!profileBtn,
                profileDropdown: !!profileDropdown,
                userProfile: !!userProfile
            });
            // Retry after a short delay in case DOM isn't ready
            setTimeout(() => {
                initUserProfile(retryCount + 1);
            }, 100);
        } else {
            console.error('Profile elements not found after retries:', {
                profileBtn: !!profileBtn,
                profileDropdown: !!profileDropdown,
                userProfile: !!userProfile
            });
        }
        return;
    }
    
    // Initializing user profile
    
    // Get user info from storage
    const user = sessionStorage.getItem('user') || localStorage.getItem('user');
    if (user) {
        try {
            const userData = JSON.parse(user);
            const displayName = userData.full_name || userData.email || 'Admin';
            const email = userData.email || 'admin@example.com';
            
            // Update profile display
            if (profileName) {
                profileName.textContent = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
            }
            if (profileFullname) {
                profileFullname.textContent = displayName;
            }
            if (profileEmail) {
                profileEmail.textContent = email;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    
    // Toggle dropdown - ensure event listener is properly attached
    if (profileBtn && profileDropdown) {
        // Prevent multiple event listeners
        if (profileBtn.dataset.listenerAttached === 'true') {
            console.log('Profile button listener already attached');
            return;
        }
        
        // Mark as attached
        profileBtn.dataset.listenerAttached = 'true';
        
        // Attach click event to toggle dropdown
        profileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Profile button clicked, toggling dropdown');
            
            // Toggle active class
            const isActive = profileDropdown.classList.contains('active');
            if (isActive) {
                profileDropdown.classList.remove('active');
                userProfile.classList.remove('active');
            } else {
                profileDropdown.classList.add('active');
                userProfile.classList.add('active');
            }
        });
        
        // Close dropdown when clicking outside
        let clickOutsideHandler = null;
        clickOutsideHandler = (e) => {
            if (profileBtn && profileDropdown && 
                !profileBtn.contains(e.target) && 
                !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('active');
                if (userProfile) {
                    userProfile.classList.remove('active');
                }
            }
        };
        
        // Use capture phase to ensure it works
        document.addEventListener('click', clickOutsideHandler, true);
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileDropdown.classList.contains('active')) {
                profileDropdown.classList.remove('active');
                if (userProfile) {
                    userProfile.classList.remove('active');
                }
            }
        });
        
        console.log('Profile button event listener attached successfully');
    } else {
        console.error('Profile button or dropdown not found:', {
            profileBtn: !!profileBtn,
            profileDropdown: !!profileDropdown
        });
    }
}

// Handle Logout
async function handleLogout() {
    // Close profile dropdown
    const profileDropdown = document.getElementById('dashboardProfileDropdown');
    if (profileDropdown) {
        profileDropdown.classList.remove('active');
    }
    
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
        
        // Call backend logout endpoint to clear server-side session
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: userEmail })
            });
        } catch (error) {
            // Continue with logout even if API call fails
            console.warn('Logout API call failed, continuing with client-side logout:', error);
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
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem('dashboard_authenticated');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem('dashboard_authenticated');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        // Redirect to home page
        window.location.replace('/index.html');
    }
}

// Handle Table Export
async function handleExportTable(tableName, exportBtn) {
    if (!exportBtn) return;
    
    // Disable button and show loading state
    const originalContent = exportBtn.innerHTML;
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
        
        // Show success notification (you can replace this with a toast notification if available)
        alert('Table exported successfully!');
        
    } catch (error) {
        console.error('Export error:', error);
        alert(`Export failed: ${error.message}`);
    } finally {
        // Re-enable button
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalContent;
    }
}

// Handle Table Import
async function handleImportTable(tableName, file, importBtn) {
    if (!file || !importBtn) return;
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
        alert('Please select a CSV file.');
        return;
    }
    
    // Map table names to file input IDs
    const fileInputIdMap = {
        'properties': 'importPropertiesFile',
        'testimonials': 'importTestimonialsFile',
        'partners': 'importPartnersFile',
        'contact_inquiries': 'importScheduleVisitsFile', // Default, will be overridden if needed
        'visitor_info': 'importVisitorsFile',
        'logs': 'importLogsFile'
    };
    
    // For contact_inquiries, determine which file input based on button ID
    if (tableName === 'contact_inquiries' && importBtn.id === 'importContactInquiriesBtn') {
        fileInputIdMap['contact_inquiries'] = 'importContactInquiriesFile';
    }
    
    // Confirm import
    if (!confirm(`Are you sure you want to import data from ${file.name} into ${tableName}? This will add new rows to the table.`)) {
        // Reset file input
        const fileInputId = fileInputIdMap[tableName];
        const fileInput = document.getElementById(fileInputId);
        if (fileInput) fileInput.value = '';
        return;
    }
    
    // Disable button and show loading state
    const originalContent = importBtn.innerHTML;
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
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
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
        
        // Reload the table data
        const tableLoaders = {
            'properties': loadProperties,
            'residential_properties': loadProperties,
            'plot_properties': loadProperties,
            'testimonials': loadTestimonials,
            'partners': loadPartners,
            'contact_inquiries': loadInquiries,
            'visitor_info': loadVisitorInfo
        };
        
        if (tableLoaders[tableName]) {
            await tableLoaders[tableName]();
        }
        
    } catch (error) {
        console.error('Import error:', error);
        alert(`Import failed: ${error.message}`);
    } finally {
        // Re-enable button
        importBtn.disabled = false;
        importBtn.innerHTML = originalContent;
        
        // Reset file input
        const fileInputIdMap = {
            'properties': 'importPropertiesFile',
            'testimonials': 'importTestimonialsFile',
            'partners': 'importPartnersFile',
            'contact_inquiries': 'importScheduleVisitsFile',
            'visitor_info': 'importVisitorsFile',
            'logs': 'importLogsFile'
        };
        const fileInputId = fileInputIdMap[tableName];
        const fileInput = document.getElementById(fileInputId);
        if (fileInput) fileInput.value = '';
    }
}

// Load Properties from API
async function loadProperties(forceRefresh = false) {
    try {
        // Fetch all properties (both active and inactive) for dashboard management
        // API limit is 100, so we need to fetch multiple pages if needed
        let allProperties = [];
        const limit = 100; // Maximum allowed by API
        
        // Add cache-busting timestamp if force refresh is requested
        const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
        
        const fetchOptions = forceRefresh ? {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        } : {};
        
        // Helper function to fetch all pages for a given is_active status
        async function fetchAllPages(isActive) {
            const properties = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore) {
                const url = `/api/properties?page=${page}&limit=${limit}&is_active=${isActive}${cacheBuster}`;
                const response = await fetch(url, fetchOptions);
                
                if (!response.ok) {
                    const text = await response.text();
                    let errorMessage = 'Failed to fetch properties';
                    try {
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
                    } catch {
                        errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                const pageProperties = data.items || [];
                properties.push(...pageProperties);
                
                // Check if there are more pages
                hasMore = page < data.pages;
                page++;
            }
            
            return properties;
        }
        
        // Fetch both active and inactive properties in parallel
        const [activeProperties, inactiveProperties] = await Promise.all([
            fetchAllPages('true'),
            fetchAllPages('false')
        ]);
        
        // Combine and sort by created_at (newest first)
        allProperties = [...activeProperties, ...inactiveProperties].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA; // Descending order (newest first)
        });
        
        // Store properties for search functionality
        currentProperties = allProperties;
        renderProperties(allProperties);
        // Stats are now loaded separately from API
        loadStats();
        loadPageVisitStats();
    } catch (error) {
        console.error('Error loading properties:', error);
        // Fallback to localStorage if API fails
        const properties = getProperties();
        currentProperties = properties;
        renderProperties(properties);
        loadStats();
        loadPageVisitStats(true); // Show loading indicator on initial load
        showNotification('Failed to load properties from server. Showing cached data.', 'warning');
    }
}

// Get Properties
function getProperties() {
    const stored = localStorage.getItem(PROPERTIES_KEY);
    if (stored) {
        return JSON.parse(stored);
    }
    // Initialize with default properties from property-details.js structure
    const defaultProperties = [
        {
            id: 1,
            title: "Luxury Modern Apartment",
            location: "Downtown District, Bengaluru",
            price: 450000,
            type: "apartment",
            bedrooms: 3,
            bathrooms: 2,
            area: 1800,
            images: ["/images/img1.webp"],
            status: "sale",
            description: "This stunning modern apartment offers a perfect blend of luxury and comfort. Located in the heart of Downtown District, this property features spacious rooms, high-end finishes, and breathtaking city views.",
            features: ["Air Conditioning", "Balcony", "Parking", "Security", "Elevator", "Gym", "Swimming Pool"]
        }
    ];
    saveProperties(defaultProperties);
    return defaultProperties;
}

// Save Properties
function saveProperties(properties) {
    localStorage.setItem(PROPERTIES_KEY, JSON.stringify(properties));
}

// Render Properties
function renderProperties(properties) {
    const tbody = document.getElementById('propertiesTableBody');
    
    if (!tbody) return;

    if (properties.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No properties found</td></tr>';
        return;
    }

    // Helper function to normalize image URLs - handles ALL formats, no restrictions
    function normalizeImageUrl(url) {
        if (!url) return null;
        
        // Convert to string if it's not already (handles numbers, objects, etc.)
        if (typeof url !== 'string') {
            url = String(url);
        }
        
        // Trim whitespace
        url = url.trim();
        if (!url) return null;
        
        // If it's already a data URL (base64), return as is - accept any data: format
        if (url.toLowerCase().startsWith('data:')) {
            return url;
        }
        
        // If it's an absolute URL with any protocol, return as is (http, https, ftp, file, etc.)
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        
        // If it's a relative path starting with /, return as is
        if (url.startsWith('/')) {
            return url;
        }
        
        // Check if it already has /images/ in the path (anywhere in the path)
        if (url.includes('/images/')) {
            return '/' + url.replace(/^\/+/, ''); // Ensure single leading slash
        }
        
        // For any other string (filename, path, etc.), try to make it work
        // If it's a simple filename without path separators, assume it's in /images/properties/
        if (!url.includes('/') && !url.includes('\\') && !url.includes(':')) {
            return '/images/properties/' + url;
        }
        
        // Default: return as relative path with leading /
        // This handles ANY other format - just make sure it starts with /
        // Accept any string format - don't filter anything out
        return '/' + url.replace(/^\/+/, '');
    }

    tbody.innerHTML = properties.map(property => {
        // Guard: Ensure property exists
        if (!property) {
            console.warn('renderProperties: property is null or undefined');
            return '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Invalid property data</td></tr>';
        }
        
        // Handle images - API returns array of objects with image_url, or primary_image string
        // Create a simple SVG placeholder as data URI
        const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
        let imageUrl = placeholderSvg;
        
        // Guard: Handle primary_image
        if (property.primary_image && typeof property.primary_image === 'string' && property.primary_image.trim()) {
            const normalized = normalizeImageUrl(property.primary_image);
            if (normalized && typeof normalized === 'string' && normalized.trim()) {
                imageUrl = normalized;
            }
        } else if (property.images && Array.isArray(property.images) && property.images.length > 0) {
            // Guard: Ensure images array has valid entries
            const firstImage = property.images[0];
            if (firstImage) {
                // If images is array of objects
                if (typeof firstImage === 'object' && firstImage !== null && firstImage.image_url) {
                    const normalized = normalizeImageUrl(firstImage.image_url);
                    if (normalized && typeof normalized === 'string' && normalized.trim()) {
                        imageUrl = normalized;
                    }
                } else if (typeof firstImage === 'string' && firstImage.trim()) {
                    const normalized = normalizeImageUrl(firstImage);
                    if (normalized && typeof normalized === 'string' && normalized.trim()) {
                        imageUrl = normalized;
                    }
                }
            }
        }
        
        // Debug: Log image URL and property data for troubleshooting (only log first few to avoid spam)
        if (property.id && properties.indexOf(property) < 3) {
            console.log(`Property ${property.id} (${property.title || 'Untitled'}) image data:`, {
                hasPrimaryImage: !!property.primary_image,
                primaryImage: property.primary_image?.substring(0, 100),
                hasImagesArray: Array.isArray(property.images),
                imagesLength: property.images?.length || 0,
                firstImage: property.images?.[0],
                finalImageUrl: imageUrl !== placeholderSvg ? imageUrl.substring(0, 150) : 'placeholder',
                normalized: imageUrl !== placeholderSvg,
                rawProperty: {
                    primary_image: property.primary_image,
                    images: property.images
                }
            });
        }
        
        // Ensure imageUrl is always a valid string
        if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
            imageUrl = placeholderSvg;
        }
        
        // Handle type - ensure it's a string
        const propertyType = typeof property.type === 'string' 
            ? property.type.charAt(0).toUpperCase() + property.type.slice(1)
            : property.type || 'Unknown';
        
        // Handle status
        // Get status text from property_status if available, otherwise use status
        const actualStatus = property.property_status || property.status;
        let statusText = 'For Sale';
        if (actualStatus === 'rent') {
            statusText = 'Rent';
        } else if (actualStatus === 'sale') {
            statusText = 'Sell';
        } else if (actualStatus === 'resale') {
            statusText = 'Resale';
        } else if (actualStatus === 'new') {
            statusText = 'New';
        } else if (actualStatus === 'ready_to_move') {
            statusText = 'Ready to Move';
        } else if (actualStatus === 'under_construction') {
            statusText = 'Under Construction';
        }
        
        // Normalize status for CSS class (replace underscores with hyphens)
        const statusClass = actualStatus ? actualStatus.replace(/_/g, '-') : 'sale';
        
        // Prepare image URL for use in HTML attribute
        // Escape only what's needed for JavaScript template literal context
        let safeImageUrl = placeholderSvg; // Default to placeholder
        let useSingleQuotes = false;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
            try {
                const trimmedUrl = imageUrl.trim();
                // Check if URL contains double quotes - if so, use single quotes for attribute
                if (trimmedUrl.includes('"')) {
                    useSingleQuotes = true;
                    // Escape backslashes and single quotes for JavaScript template literal
                    safeImageUrl = trimmedUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/`/g, '\\`');
                } else {
                    // Use double quotes for attribute (default)
                    // Escape backslashes, double quotes, and template literal special chars
                    safeImageUrl = trimmedUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
                }
            } catch (e) {
                console.warn('Error processing image URL:', e, 'Using placeholder');
                safeImageUrl = placeholderSvg;
            }
        }
        
        // Use a more robust error handler that ensures an image is always displayed
        const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
        
        // Check if we're already using the placeholder
        const isPlaceholder = safeImageUrl === placeholderSvg || safeImageUrl === placeholderImage;
        
        // Final validation - ensure safeImageUrl is never empty
        if (!safeImageUrl || !safeImageUrl.trim()) {
            safeImageUrl = placeholderImage;
        }
        
        // Create a unique ID for this image to handle errors properly
        const imageId = `prop-img-${property.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Enhanced error handler that logs the failed URL and prevents infinite loops
        // Only set error handler if we're not already using the placeholder
        const errorHandler = isPlaceholder ? '' : `(function(imgId, failedUrl) { 
            const img = document.getElementById(imgId); 
            if (img && !img.dataset.errorHandled) { 
                img.dataset.errorHandled = 'true';
                console.warn('Image failed to load:', failedUrl.substring(0, 100));
                img.onerror = null; 
                img.src = '${placeholderImage}'; 
                img.alt = ''; 
                img.style.display = 'block'; 
            } 
        })(this.id, '${safeImageUrl.replace(/'/g, "\\'").replace(/"/g, '&quot;')}');`;
        
        return `
        <tr>
            <td>
                <div class="dashboard-table-image" style="width: 80px; height: 60px; overflow: hidden; border-radius: 4px; background: #f3f4f6; position: relative;">
                    <img id="${imageId}" 
                         src=${useSingleQuotes ? `'${safeImageUrl}'` : `"${safeImageUrl}"`} 
                         alt="" 
                         style="width: 100%; height: 100%; object-fit: cover; display: block;"
                         loading="lazy"${errorHandler ? ` onerror="${errorHandler}"` : ''}>
                    <noscript>
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 0.75rem;">
                            <i class="fas fa-image"></i>
                        </div>
                    </noscript>
                </div>
            </td>
            <td>
                <div class="dashboard-table-title">${escapeHtml(property.title || 'Untitled')}</div>
            </td>
            <td>
                <div class="dashboard-table-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${escapeHtml(property.location || 'N/A')}
                </div>
            </td>
            <td>
                <span class="dashboard-table-type">${escapeHtml(propertyType)}</span>
            </td>
            <td>
                <div class="dashboard-table-price">
                    ${property.price_text 
                        ? escapeHtml(property.price_text)
                        : (typeof property.price === 'number' && property.price > 0
                            ? formatPropertyPrice(property)
                            : 'N/A')}
                </div>
            </td>
            <td>
                <span class="dashboard-table-status ${statusClass}">${statusText}</span>
            </td>
            <td>
                <div class="dashboard-table-actions">
                    <button class="dashboard-action-btn edit" onclick="(function(id) { if(typeof window.editProperty === 'function') { window.editProperty(id); } else if(typeof editProperty === 'function') { editProperty(id); } else { console.error('editProperty not found'); alert('Edit function not available. Please refresh the page.'); } })(${property.id})" title="Edit" data-property-id="${property.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="dashboard-action-btn delete" onclick="deleteProperty(${property.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Load Stats from API
async function loadStats() {
    try {
        const response = await fetch('/api/stats/properties');
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to fetch statistics';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        const stats = await response.json();
        
        // Update stat cards with fetched data
        const totalEl = document.getElementById('totalProperties');
        const saleEl = document.getElementById('saleProperties');
        const rentEl = document.getElementById('rentProperties');

        if (totalEl) {
            animateCounter(totalEl, stats.total || 0);
        }
        if (saleEl) {
            animateCounter(saleEl, stats.for_sale || 0);
        }
        if (rentEl) {
            animateCounter(rentEl, stats.for_rent || 0);
        }
        
        // Fetch dashboard stats for clicks log
        try {
            const dashboardResponse = await authenticatedFetch('/api/admin/stats/dashboard');
            if (dashboardResponse.ok) {
                const dashboardStats = await dashboardResponse.json();
                const logsEl = document.getElementById('totalLogs');
                if (logsEl && dashboardStats.total_logs !== undefined) {
                    animateCounter(logsEl, dashboardStats.total_logs || 0);
                }
            }
        } catch (logsError) {
            // Non-critical error, just set to 0
            const logsEl = document.getElementById('totalLogs');
            if (logsEl) logsEl.textContent = '0';
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        // Fallback to showing 0 or using localStorage data
        const properties = getProperties();
        const total = properties.length;
        const sale = properties.filter(p => p.status === 'sale').length;
        const rent = properties.filter(p => p.status === 'rent').length;

        const totalEl = document.getElementById('totalProperties');
        const saleEl = document.getElementById('saleProperties');
        const rentEl = document.getElementById('rentProperties');
        const logsEl = document.getElementById('totalLogs');

        if (totalEl) totalEl.textContent = total;
        if (saleEl) saleEl.textContent = sale;
        if (rentEl) rentEl.textContent = rent;
        if (logsEl) logsEl.textContent = '0';
    }
}

// Animate counter for stat cards
function animateCounter(element, target, duration = 1500) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Load and display page visit counts with real-time updates
async function loadPageVisitStats(showLoadingIndicator = false) {
    const tableBody = document.getElementById('pageVisitsTableBody');
    if (!tableBody) return;
    
    // Show loading indicator if requested (for initial load)
    if (showLoadingIndicator) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-spinner fa-spin"></i> Loading page visit statistics...
                </td>
            </tr>
        `;
    }
    
    try {
        const response = await authenticatedFetch('/api/admin/stats/page-visits');
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to fetch page visit statistics';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        const data = await response.json();
        
        // Validate that page_visits is an array
        if (!Array.isArray(data.page_visits)) {
            console.error('Invalid page_visits data:', data);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                        <i class="fas fa-exclamation-triangle"></i> Invalid data format received.
                    </td>
                </tr>
            `;
            return;
        }
        
        if (data.page_visits.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-gray);">
                        <i class="fas fa-info-circle"></i> No page visit data available yet.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Store previous data for comparison (for animation)
        const previousRows = Array.from(tableBody.querySelectorAll('tr'));
        const previousData = new Map();
        previousRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const pageName = cells[0].textContent.trim();
                const visitCount = parseInt(cells[1].textContent.replace(/,/g, '')) || 0;
                previousData.set(pageName, visitCount);
            }
        });
        
        // Render page visits table with defensive checks and real-time update animation
        tableBody.innerHTML = data.page_visits.map(page => {
            // Safely extract values with defaults
            const pageName = page.page || page.page_name || 'Unknown';
            const visitCount = Number(page.visits ?? page.visit_count ?? 0);
            const uniqueVisitors = Number(page.unique_visitors ?? 0);
            const authenticatedVisitors = Number(page.authenticated_visitors ?? 0);
            
            // Check if this is a new or updated row for animation
            const previousCount = previousData.get(pageName);
            const isUpdated = previousCount !== undefined && previousCount !== visitCount;
            const rowClass = isUpdated ? 'page-visit-updated' : '';
            
            return `
            <tr class="${rowClass}">
                <td><strong>${escapeHtml(pageName)}</strong></td>
                <td class="visit-count">${visitCount.toLocaleString()}</td>
                <td class="unique-visitors">${uniqueVisitors.toLocaleString()}</td>
                <td class="authenticated-visitors">${authenticatedVisitors.toLocaleString()}</td>
            </tr>
        `;
        }).join('');
        
        // Add CSS animation for updated rows
        const updatedRows = tableBody.querySelectorAll('.page-visit-updated');
        if (updatedRows.length > 0) {
            // Remove animation class after animation completes
            setTimeout(() => {
                updatedRows.forEach(row => {
                    row.classList.remove('page-visit-updated');
                });
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error loading page visit statistics:', error);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                        <i class="fas fa-exclamation-triangle"></i> Failed to load page visit statistics.
                    </td>
                </tr>
            `;
        }
    }
}

// Property modal functions removed
async function openResidentialPropertyModal(propertyId = null) {
    const modal = document.getElementById('residentialPropertyModal');
    const form = document.getElementById('residentialPropertyForm');
    const modalTitle = document.getElementById('residentialModalTitle');
    
    if (!modal || !form) return;

    // Get property ID input reference BEFORE resetting form
    const propertyIdInput = document.getElementById('residentialPropertyId');
    const tempPropertyId = propertyId;
    
    // Clear gallery first to avoid conflicts
    clearResidentialImagePreviews();
    
    // Reset form (this clears all inputs including hidden propertyId)
    form.reset();
    
    // CRITICAL FIX: Restore property ID immediately after reset if in edit mode
    if (tempPropertyId && propertyIdInput) {
        propertyIdInput.value = tempPropertyId;
    } else if (propertyIdInput) {
        propertyIdInput.value = '';
    }
    
    // Initialize gallery (add one empty item if new property)
    if (!propertyId) {
        const galleryContainer = document.getElementById('residentialGalleryContainer');
        if (galleryContainer && galleryContainer.children.length === 0) {
            addResidentialGalleryItem();
        }
    }
    
    // Reset to step 1 first to ensure clean state
    resetResidentialPropertySteps();
    
    // Load amenities if not already loaded
    await loadAmenitiesForResidentialForm();
    
    // Load cities for the dropdown
    await loadCitiesForResidentialForm();
    
    // Add event listener for city change to load localities
    // Re-attach listener each time modal opens to ensure it works
    const cityInput = document.getElementById('residentialCity');
    if (cityInput) {
        // Remove any existing listener by cloning the element
        const oldCityInput = cityInput;
        const newCityInput = oldCityInput.cloneNode(true);
        oldCityInput.parentNode.replaceChild(newCityInput, oldCityInput);
        
        // Add input and blur event listeners to handle both typing and selection
        let cityChangeTimeout;
        newCityInput.addEventListener('input', async function() {
            // Clear previous timeout
            if (cityChangeTimeout) {
                clearTimeout(cityChangeTimeout);
            }
            
            // Debounce to avoid too many API calls while typing
            cityChangeTimeout = setTimeout(async () => {
                const selectedCity = this.value;
                if (selectedCity && selectedCity.trim()) {
                    // Extract city name if it's in format "City, State"
                    const cityName = selectedCity.includes(',') ? selectedCity.split(',')[0].trim() : selectedCity.trim();
                    console.log('City entered in modal:', selectedCity, 'Extracted city name:', cityName);
                    await loadLocalitiesForResidentialForm(cityName);
                } else {
                    // Clear localities if city is cleared
                    const localityDatalist = document.getElementById('residentialLocalityList');
                    const localityInput = document.getElementById('residentialLocality');
                    if (localityDatalist) {
                        localityDatalist.innerHTML = '';
                    }
                    if (localityInput) {
                        localityInput.value = '';
                    }
                }
            }, 500); // Wait 500ms after user stops typing
        });
        
        // Also listen for blur event to load localities when user selects from dropdown
        newCityInput.addEventListener('blur', async function() {
            const selectedCity = this.value;
            if (selectedCity && selectedCity.trim()) {
                // Extract city name if it's in format "City, State"
                const cityName = selectedCity.includes(',') ? selectedCity.split(',')[0].trim() : selectedCity.trim();
                console.log('City selected in modal:', selectedCity, 'Extracted city name:', cityName);
                await loadLocalitiesForResidentialForm(cityName);
            }
        });
    }
    
    // Load categories for Property Type dropdown
    await loadCategoriesForPropertyTypeDropdown();
    
    // Load unit types for the form
    await loadUnitTypesForResidentialForm();
    
    // If a city is already selected (e.g., from URL params or previous selection), load its localities
    const cityInputAfterLoad = document.getElementById('residentialCity');
    if (cityInputAfterLoad && cityInputAfterLoad.value) {
        const selectedCity = cityInputAfterLoad.value;
        const cityName = selectedCity.includes(',') ? selectedCity.split(',')[0].trim() : selectedCity.trim();
        if (cityName) {
            await loadLocalitiesForResidentialForm(cityName);
        }
    }

    if (propertyId) {
        modalTitle.textContent = 'Edit Property';
        // Fetch property data for editing
        try {
            const response = await fetch(`/api/properties/${propertyId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch property');
            }
            const property = await response.json();
            
            // CRITICAL: Ensure property ID is set BEFORE populating form
            const propertyIdInput = document.getElementById('residentialPropertyId');
            if (propertyIdInput) propertyIdInput.value = property.id || propertyId;
            
            // Populate all form fields with cached data
            populateResidentialForm(property);
            
            // Double-check property ID after population (in case form reset cleared it)
            if (propertyIdInput) propertyIdInput.value = property.id || propertyId;
        } catch (error) {
            console.error('Error loading property:', error);
            showNotification('Failed to load property details.', 'error');
            // Keep property ID set even if fetch fails
            const propertyIdInput = document.getElementById('residentialPropertyId');
            if (propertyIdInput) propertyIdInput.value = propertyId;
            return;
        }
    } else {
        modalTitle.textContent = 'Add Other Properties';
    }

    // Ensure buttons are in correct state for step 1
    updateResidentialPropertyStepButtons(1);

    // Show modal after everything is set up
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Residential Property Modal
function closeResidentialPropertyModal() {
    const modal = document.getElementById('residentialPropertyModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset to step 1 when closing
        resetResidentialPropertySteps();
    }
}

// Reset Residential Property Form Steps
function resetResidentialPropertySteps() {
    // Hide all steps first
    const allSteps = document.querySelectorAll('#residentialPropertyForm .dashboard-form-step');
    allSteps.forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none';
    });
    
    // Show step 1
    const currentStep = 1;
    const step1 = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="${currentStep}"]`);
    if (step1) {
        step1.style.display = '';
        step1.classList.add('active');
    }
    
    updateResidentialPropertyStepIndicators(currentStep);
    updateResidentialPropertyStepButtons(currentStep);
}

// Show specific step in Residential Property Form
function showResidentialPropertyStep(stepNumber) {
    console.log('Showing step:', stepNumber);
    
    // Hide all steps immediately (no delay to prevent layout issues)
    const allSteps = document.querySelectorAll('#residentialPropertyForm .dashboard-form-step');
    allSteps.forEach(step => {
        step.classList.remove('active');
        // Force immediate hide to prevent layout issues
        step.style.display = 'none';
        step.style.visibility = 'hidden';
        step.style.opacity = '0';
        // Force reflow for smooth transition
        step.offsetHeight;
    });
    
    // Show current step
    const currentStep = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="${stepNumber}"]`);
    if (currentStep) {
        console.log('Step element found:', stepNumber, currentStep);
        
        // For step 3, make it immediately visible with explicit styles
        if (stepNumber === 3) {
            // Remove any inline styles that might conflict
            currentStep.style.removeProperty('display');
            currentStep.style.removeProperty('visibility');
            currentStep.style.removeProperty('opacity');
            
            // Add active class first (CSS will handle display)
            currentStep.classList.add('active');
            
            // Then ensure it's visible with inline styles as backup
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(currentStep);
                if (computedStyle.display === 'none') {
                    currentStep.style.setProperty('display', 'block', 'important');
                }
                if (computedStyle.visibility === 'hidden') {
                    currentStep.style.setProperty('visibility', 'visible', 'important');
                }
                console.log('Step 3 made visible with active class and inline backup');
            }, 10);
        } else {
            // For other steps, use CSS transitions
            currentStep.style.display = '';
            currentStep.style.visibility = '';
            currentStep.style.opacity = '';
            
            // Small delay for smooth transition
            setTimeout(() => {
                currentStep.classList.add('active');
            }, 50);
        }
        
        // Ensure other steps are still hidden
        setTimeout(() => {
            allSteps.forEach(step => {
                if (step !== currentStep) {
                    step.classList.remove('active');
                    step.style.display = 'none';
                    step.style.visibility = 'hidden';
                    step.style.opacity = '0';
                }
            });
            
            // Verify step 3 is actually visible
            if (stepNumber === 3) {
                const step3Check = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="3"]`);
                if (step3Check) {
                    const computedStyle = window.getComputedStyle(step3Check);
                    console.log('Step 3 visibility check:', {
                        hasActive: step3Check.classList.contains('active'),
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity,
                        offsetHeight: step3Check.offsetHeight,
                        offsetWidth: step3Check.offsetWidth
                    });
                    
                    // Force visibility if still not visible
                    if (computedStyle.display === 'none' || step3Check.offsetHeight === 0) {
                        step3Check.style.display = 'block';
                        step3Check.style.visibility = 'visible';
                        step3Check.style.opacity = '1';
                        step3Check.classList.add('active');
                        console.log('Step 3 forced to be visible');
                    }
                }
            }
            
            // Scroll to top of step content smoothly
            const form = document.getElementById('residentialPropertyForm');
            if (form) {
                setTimeout(() => {
                    const formRect = form.getBoundingClientRect();
                    const stepRect = currentStep.getBoundingClientRect();
                    const scrollOffset = stepRect.top - formRect.top - 20;
                    
                    form.scrollTo({
                        top: form.scrollTop + scrollOffset,
                        behavior: 'smooth'
                    });
                }, stepNumber === 3 ? 0 : 100);
            }
        }, stepNumber === 3 ? 0 : 50);
    } else {
        console.error('Step element not found for step:', stepNumber);
    }
}

// Update step indicators
function updateResidentialPropertyStepIndicators(currentStep) {
    const stepItems = document.querySelectorAll('#residentialPropertyForm .dashboard-step-item');
    stepItems.forEach((item, index) => {
        const stepNum = index + 1;
        item.classList.remove('active', 'completed');
        
        if (stepNum < currentStep) {
            item.classList.add('completed');
        } else if (stepNum === currentStep) {
            item.classList.add('active');
        }
    });
}

// Update step navigation buttons
function updateResidentialPropertyStepButtons(currentStep) {
    const nextBtn = document.getElementById('residentialNextStepBtn');
    const prevBtn = document.getElementById('residentialPrevStepBtn');
    const submitBtn = document.getElementById('residentialSubmitBtn');
    
    console.log('Updating step buttons:', { currentStep, nextBtn: !!nextBtn, prevBtn: !!prevBtn, submitBtn: !!submitBtn });
    
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
    }
    
    if (nextBtn && submitBtn) {
        if (currentStep === 3) {
            // On step 3, hide Next button and show Submit button
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            // On steps 1 and 2, show Next button and hide Submit button
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    } else {
        console.error('Next or Submit button not found:', { nextBtn: !!nextBtn, submitBtn: !!submitBtn });
    }
}

// Handle step navigation
function handleResidentialPropertyStepNavigation(direction) {
    const currentStep = getCurrentResidentialPropertyStep();
    let newStep = currentStep;
    
    console.log('Step navigation:', { direction, currentStep });
    
    if (direction === 'next') {
        // Validate current step before proceeding
        const isValid = validateResidentialPropertyStep(currentStep);
        console.log('Step validation result:', { currentStep, isValid });
        
        if (!isValid) {
            // Add shake animation to indicate error
            const activeStep = document.querySelector('#residentialPropertyForm .dashboard-form-step.active');
            if (activeStep) {
                activeStep.style.animation = 'shakeStep 0.5s ease';
                setTimeout(() => {
                    activeStep.style.animation = '';
                }, 500);
            }
            return;
        }
        newStep = Math.min(currentStep + 1, 3);
    } else if (direction === 'prev') {
        newStep = Math.max(currentStep - 1, 1);
    }
    
    if (newStep !== currentStep) {
        console.log('Moving from step', currentStep, 'to step', newStep);
        
        // Update indicators first
        updateResidentialPropertyStepIndicators(newStep);
        
        // Then show the step (with transition)
        showResidentialPropertyStep(newStep);
        
        // Update buttons - ensure this happens after step is shown
        setTimeout(() => {
            updateResidentialPropertyStepButtons(newStep);
        }, 100);
        
        // Focus first input in new step and ensure step 3 is accessible
        setTimeout(() => {
            const newStepElement = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="${newStep}"]`);
            if (newStepElement) {
                // Ensure step 3 is visible and accessible
                if (newStep === 3) {
                    newStepElement.style.display = 'block';
                    newStepElement.style.visibility = 'visible';
                    newStepElement.style.opacity = '1';
                    newStepElement.classList.add('active');
                    
                    // Double-check visibility
                    const computedStyle = window.getComputedStyle(newStepElement);
                    if (computedStyle.display === 'none' || newStepElement.offsetHeight === 0) {
                        newStepElement.style.setProperty('display', 'block', 'important');
                        newStepElement.style.setProperty('visibility', 'visible', 'important');
                        newStepElement.style.setProperty('opacity', '1', 'important');
                        console.log('Step 3 forced to be visible with !important');
                    }
                    
                    console.log('Step 3 accessibility check:', {
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity,
                        offsetHeight: newStepElement.offsetHeight,
                        hasActive: newStepElement.classList.contains('active')
                    });
                }
                
                const firstInput = newStepElement.querySelector('input:not([type="hidden"]):not([type="file"]), select, textarea');
                if (firstInput && firstInput.offsetParent !== null) {
                    firstInput.focus();
                }
            } else {
                console.error('Step element not found after navigation:', newStep);
            }
        }, newStep === 3 ? 150 : 400);
    } else {
        console.warn('Step navigation: newStep === currentStep, no navigation occurred');
    }
}

// Get current step number
function getCurrentResidentialPropertyStep() {
    const activeStep = document.querySelector('#residentialPropertyForm .dashboard-form-step.active');
    if (activeStep) {
        return parseInt(activeStep.getAttribute('data-step')) || 1;
    }
    return 1;
}

// Validate step before proceeding
function validateResidentialPropertyStep(stepNumber) {
    if (stepNumber === 1) {
        // Validate Step 1 fields
        const propertyName = document.getElementById('residentialPropertyName');
        const city = document.getElementById('residentialCity');
        const locality = document.getElementById('residentialLocality');
        const propertyType = document.getElementById('residentialPropertyType');
        
        if (!propertyName || !propertyName.value.trim()) {
            showNotification('Please enter project name', 'error');
            propertyName?.focus();
            return false;
        }
        
        if (!city || !city.value.trim()) {
            showNotification('Please enter city', 'error');
            city?.focus();
            return false;
        }
        
        if (!locality || !locality.value.trim()) {
            showNotification('Please enter locality/area', 'error');
            locality?.focus();
            return false;
        }
        
        if (!propertyType || !propertyType.value) {
            showNotification('Please select property type', 'error');
            propertyType?.focus();
            return false;
        }
        
        const price = document.getElementById('residentialPrice');
        if (!price || !price.value.trim()) {
            showNotification('Please enter price', 'error');
            price?.focus();
            return false;
        }
        
        // Validate location link if provided
        const locationLink = document.getElementById('residentialLocationLink');
        if (locationLink && locationLink.value.trim()) {
            const linkValue = locationLink.value.trim();
            
            // Check if it's a valid URL
            try {
                const url = new URL(linkValue);
                
                // Validate URL scheme (must be http or https)
                if (!['http:', 'https:'].includes(url.protocol)) {
                    showNotification('Location link must be a valid HTTP or HTTPS URL', 'error');
                    locationLink.focus();
                    return false;
                }
                
                // Optional: Check if it's a map service URL (Google Maps, Apple Maps, etc.)
                const hostname = url.hostname.toLowerCase();
                const isMapService = hostname.includes('google.com') || 
                                   hostname.includes('maps.google.com') ||
                                   hostname.includes('maps.apple.com') ||
                                   hostname.includes('openstreetmap.org') ||
                                   hostname.includes('bing.com/maps') ||
                                   hostname.includes('mapbox.com');
                
                // If it's not a recognized map service, show a warning but allow it
                // (user might be using a custom map service or shortened URL)
                if (!isMapService) {
                    console.warn('Location link does not appear to be from a recognized map service:', hostname);
                }
            } catch (error) {
                // Invalid URL format
                showNotification('Please enter a valid location link URL (e.g., https://maps.google.com/...)', 'error');
                locationLink.focus();
                return false;
            }
        }
        
        return true;
    }
    
    if (stepNumber === 2) {
        // Validate Step 2 fields based on property type
        const step2Container = document.getElementById('residentialStep2');
        if (step2Container && step2Container.children.length === 0) {
            showNotification('Please select a property type first', 'error');
            return false;
        }
        
        const propertyType = document.getElementById('residentialPropertyType')?.value;
        
        if (!propertyType) {
            showNotification('Please select a property type first', 'error');
            return false;
        }
        
        if (propertyType === 'apartments') {
            // Validate apartments fields
            const status = document.getElementById('residentialStatus');
            const listingType = document.getElementById('residentialListingType');
            
            if (!status || !status.value) {
                showNotification('Please select status', 'error');
                status?.focus();
                return false;
            }
            
            if (!listingType || !listingType.value) {
                showNotification('Please select listing type', 'error');
                listingType?.focus();
                return false;
            }
            
            // Price is now in Step 1, so validation is handled there
        } else if (propertyType === 'villas' || propertyType === 'individual_house') {
            // Validate villas/individual house fields
            const villaType = document.getElementById('residentialVillaType');
            const listingType = document.getElementById('residentialListingType');
            const status = document.getElementById('residentialStatus');
            
            if (!villaType || !villaType.value) {
                showNotification('Please select villa type', 'error');
                villaType?.focus();
                return false;
            }
            
            // Check if plot area is required (for independent villa)
            if (villaType.value === 'independent_villa') {
                const plotArea = document.getElementById('residentialPlotArea');
                if (plotArea && plotArea.offsetParent !== null) {
                    // Only validate if plot area field is visible
                    if (!plotArea.value || parseFloat(plotArea.value) <= 0) {
                        showNotification('Please enter plot area for independent villa', 'error');
                        plotArea?.focus();
                        return false;
                    }
                }
            }
            
            if (!listingType || !listingType.value) {
                showNotification('Please select listing type', 'error');
                listingType?.focus();
                return false;
            }
            
            if (!status || !status.value) {
                showNotification('Please select status', 'error');
                status?.focus();
                return false;
            }
        } else if (propertyType === 'plot_properties') {
            // Validate plot properties fields
            const status = document.getElementById('residentialStatus');
            
            if (!status || !status.value) {
                showNotification('Please select status', 'error');
                status?.focus();
                return false;
            }
            
            // Plot area validation - only if field exists and is visible
            const plotArea = document.getElementById('residentialPlotArea');
            if (plotArea && plotArea.offsetParent !== null && plotArea.hasAttribute('required')) {
                if (!plotArea.value || parseFloat(plotArea.value) <= 0) {
                    showNotification('Please enter plot area', 'error');
                    plotArea?.focus();
                    return false;
                }
            }
        } else {
            // Unknown property type - allow navigation anyway
            console.warn('Unknown property type in validation:', propertyType);
        }
        
        // If we get here, validation passed
        console.log('Step 2 validation passed');
        return true;
    }
    
    if (stepNumber === 3) {
        // Step 3 validation (optional fields, so just return true)
        return true;
    }
    
    return true;
}

// Validate location link field with visual feedback
function validateLocationLinkField(field, silent = false) {
    if (!field) return true;
    
    const linkValue = field.value.trim();
    
    // If field is empty, it's valid (field is optional)
    if (!linkValue) {
        field.style.borderColor = '';
        field.style.borderWidth = '';
        return true;
    }
    
    // Check if it's a valid URL
    try {
        const url = new URL(linkValue);
        
        // Validate URL scheme (must be http or https)
        if (!['http:', 'https:'].includes(url.protocol)) {
            if (!silent) {
                showNotification('Location link must be a valid HTTP or HTTPS URL', 'error');
            }
            field.style.borderColor = '#dc3545';
            field.style.borderWidth = '2px';
            return false;
        }
        
        // URL is valid
        field.style.borderColor = '#28a745';
        field.style.borderWidth = '2px';
        
        // Reset border color after a short delay to avoid permanent green border
        setTimeout(() => {
            if (field.value.trim() === linkValue) {
                field.style.borderColor = '';
                field.style.borderWidth = '';
            }
        }, 2000);
        
        return true;
    } catch (error) {
        // Invalid URL format
        if (!silent) {
            showNotification('Please enter a valid location link URL (e.g., https://maps.google.com/...)', 'error');
        }
        field.style.borderColor = '#dc3545';
        field.style.borderWidth = '2px';
        return false;
    }
}

// Handle property type change - dynamically load Step 2 content
function handleResidentialPropertyTypeChange() {
    const propertyType = document.getElementById('residentialPropertyType');
    const step2Container = document.getElementById('residentialStep2');
    
    if (!propertyType || !step2Container) return;
    
    const selectedType = propertyType.value;
    
    // Get current step to ensure we're on step 1 or 2
    const currentStep = getCurrentResidentialPropertyStep();
    
    // Clear existing content
    step2Container.innerHTML = '';
    
    if (!selectedType) {
        return;
    }
    
    // Load Step 2 content based on property type
    loadStep2Content(selectedType, step2Container);
    
    // Ensure Step 3 is hidden after Step 2 content is loaded
    const step3 = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="3"]`);
    if (step3 && currentStep !== 3) {
        step3.classList.remove('active');
        step3.style.display = 'none';
    }
}

// Load Step 2 content based on property type
function loadStep2Content(propertyType, container) {
    let html = '';
    
    switch(propertyType) {
        case 'apartments':
            html = getApartmentsStep2HTML();
            break;
        case 'villas':
            html = getVillasStep2HTML();
            break;
        case 'individual_house':
            html = getIndividualHouseStep2HTML();
            break;
        case 'plot_properties':
            html = getPlotPropertiesStep2HTML();
            break;
        default:
            html = '<div class="dashboard-form-group"><p style="color: var(--text-gray); padding: 2rem; text-align: center;">Please select a property type</p></div>';
    }
    
    container.innerHTML = html;
    
    // Ensure Step 3 is hidden after loading Step 2 content
    // But only if we're not currently on step 3
    const currentStep = getCurrentResidentialPropertyStep();
    if (currentStep !== 3) {
        const step3 = document.querySelector(`#residentialPropertyForm .dashboard-form-step[data-step="3"]`);
        if (step3) {
            step3.classList.remove('active');
            step3.style.display = 'none';
        }
    }
    
    // Initialize event listeners after content is loaded
    initializeStep2EventListeners(propertyType);
}

// Get HTML for Apartments Step 2
function getApartmentsStep2HTML() {
    // Get first unit type as default
    const defaultUnitType = allUnitTypes && allUnitTypes.length > 0 
        ? allUnitTypes.find(ut => {
            const name = (ut.name || '').toUpperCase();
            const bedrooms = ut.bedrooms || 0;
            return name.includes('BHK') || (bedrooms >= 1 && bedrooms <= 4);
        }) || allUnitTypes[0]
        : null;
    
    const defaultBedrooms = defaultUnitType ? (defaultUnitType.bedrooms || 1) : 1;
    const defaultUnitTypeValue = defaultUnitType ? (() => {
        const nameUpper = (defaultUnitType.name || '').toUpperCase();
        if (nameUpper.includes('RK') || nameUpper.includes('ROOM')) return 'rk';
        if (nameUpper.includes('VILLA')) return 'villa';
        if (nameUpper.includes('BHK')) return 'bhk';
        if ((defaultUnitType.bedrooms || 0) >= 4) return '4plus';
        return 'bhk';
    })() : 'bhk';
    
    return `
        <div class="dashboard-form-group">
            <label>
                <i class="fas fa-home"></i>
                Unit Type *
            </label>
            <div class="dashboard-unit-type-buttons">
                ${generateUnitTypeButtonsHTML('apartments')}
            </div>
            <input type="hidden" id="residentialUnitType" name="unit_type" value="${defaultUnitTypeValue}">
            <input type="hidden" id="residentialBedrooms" name="bedrooms" value="${defaultBedrooms}">
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialStatus">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="residentialStatus" name="status" required>
                    <option value="">Select Status</option>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                </select>
            </div>
            <div class="dashboard-form-group">
                <label for="residentialListingType">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="residentialListingType" name="listing_type" required>
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialSuperBuildupArea">
                    <i class="fas fa-ruler-combined"></i>
                    Super Builtup Area (SBA) (sq.ft.)
                </label>
                <input type="number" id="residentialSuperBuildupArea" name="super_buildup_area" placeholder="e.g., 1500" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialCarpetArea">
                    <i class="fas fa-ruler"></i>
                    Carpet Area (sq.ft.)
                </label>
                <input type="number" id="residentialCarpetArea" name="carpet_area" placeholder="e.g., 1200" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-group">
            <label for="residentialDirection">
                <i class="fas fa-compass"></i>
                Direction
            </label>
            <select id="residentialDirection" name="direction">
                <option value="">Select Direction</option>
                <option value="east">East</option>
                <option value="west">West</option>
                <option value="north">North</option>
                <option value="south">South</option>
            </select>
        </div>

        <div class="dashboard-form-group">
            <label for="residentialAmenities">
                <i class="fas fa-star"></i>
                Amenities/Features
            </label>
            <select id="residentialAmenities" name="amenities" multiple style="min-height: 150px;">
                <!-- Options will be populated dynamically -->
            </select>
            <small style="color: #6b7280; margin-top: 0.5rem; display: block;">Hold Ctrl/Cmd to select multiple amenities</small>
        </div>
    `;
}

// Get HTML for Villas Step 2
function getVillasStep2HTML() {
    return `
        <div class="dashboard-form-group">
            <label for="residentialVillaType">
                <i class="fas fa-home"></i>
                Villa Type *
            </label>
            <select id="residentialVillaType" name="villa_type" required>
                <option value="">Select Villa Type</option>
                <option value="independent_villa">Independent Villa</option>
                <option value="row_villa">Row Villa</option>
                <option value="villament">Villament</option>
            </select>
        </div>

        <div class="dashboard-form-group" id="residentialPlotAreaContainer" style="display: none;">
            <label for="residentialPlotArea">
                <i class="fas fa-map"></i>
                Plot Area (sq.ft.) *
            </label>
            <input type="number" id="residentialPlotArea" name="plot_area" placeholder="e.g., 2400" step="0.01" min="0">
        </div>

        <div class="dashboard-form-group">
            <label>
                <i class="fas fa-home"></i>
                Unit Type *
            </label>
            <div class="dashboard-unit-type-buttons">
                ${generateUnitTypeButtonsHTML('villas')}
            </div>
            <input type="hidden" id="residentialUnitType" name="unit_type" value="bhk">
            <input type="hidden" id="residentialBedrooms" name="bedrooms" value="3">
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialListingType">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="residentialListingType" name="listing_type" required>
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
            <div class="dashboard-form-group">
                <label for="residentialStatus">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="residentialStatus" name="status" required>
                    <option value="">Select Status</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="ready_to_move">Ready to Move</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialLength">
                    <i class="fas fa-arrows-alt-h"></i>
                    Length (ft.)
                </label>
                <input type="number" id="residentialLength" name="length" placeholder="e.g., 30" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialBreadth">
                    <i class="fas fa-arrows-alt-v"></i>
                    Breadth (ft.)
                </label>
                <input type="number" id="residentialBreadth" name="breadth" placeholder="e.g., 40" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialBuildupArea">
                    <i class="fas fa-ruler-combined"></i>
                    Builtup Area (sq.ft.)
                </label>
                <input type="number" id="residentialBuildupArea" name="buildup_area" placeholder="e.g., 2000" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialCarpetArea">
                    <i class="fas fa-ruler"></i>
                    Carpet Area (sq.ft.)
                </label>
                <input type="number" id="residentialCarpetArea" name="carpet_area" placeholder="e.g., 1800" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialBedroomsCount">
                    <i class="fas fa-bed"></i>
                    Bedrooms
                </label>
                <input type="number" id="residentialBedroomsCount" name="bedrooms_count" placeholder="e.g., 3" min="0" max="10">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialBathrooms">
                    <i class="fas fa-bath"></i>
                    Bathrooms
                </label>
                <input type="number" id="residentialBathrooms" name="bathrooms" placeholder="e.g., 2" min="0" max="10">
            </div>
        </div>

        <div class="dashboard-form-group">
            <label for="residentialAmenities">
                <i class="fas fa-star"></i>
                Amenities/Features
            </label>
            <select id="residentialAmenities" name="amenities" multiple style="min-height: 150px;">
                <!-- Options will be populated dynamically -->
            </select>
            <small style="color: #6b7280; margin-top: 0.5rem; display: block;">Hold Ctrl/Cmd to select multiple amenities</small>
        </div>
    `;
}

// Get HTML for Individual House Step 2 (same as Villa but without amenities)
function getIndividualHouseStep2HTML() {
    return `
        <div class="dashboard-form-group">
            <label for="residentialVillaType">
                <i class="fas fa-home"></i>
                Villa Type *
            </label>
            <select id="residentialVillaType" name="villa_type" required>
                <option value="">Select Villa Type</option>
                <option value="independent_villa">Independent Villa</option>
                <option value="row_villa">Row Villa</option>
                <option value="villament">Villament</option>
            </select>
        </div>

        <div class="dashboard-form-group" id="residentialPlotAreaContainer" style="display: none;">
            <label for="residentialPlotArea">
                <i class="fas fa-map"></i>
                Plot Area (sq.ft.) *
            </label>
            <input type="number" id="residentialPlotArea" name="plot_area" placeholder="e.g., 2400" step="0.01" min="0">
        </div>

        <div class="dashboard-form-group">
            <label>
                <i class="fas fa-home"></i>
                Unit Type *
            </label>
            <div class="dashboard-unit-type-buttons">
                ${generateUnitTypeButtonsHTML('villas')}
            </div>
            <input type="hidden" id="residentialUnitType" name="unit_type" value="bhk">
            <input type="hidden" id="residentialBedrooms" name="bedrooms" value="3">
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialListingType">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="residentialListingType" name="listing_type" required>
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
            <div class="dashboard-form-group">
                <label for="residentialStatus">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="residentialStatus" name="status" required>
                    <option value="">Select Status</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="ready_to_move">Ready to Move</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialLength">
                    <i class="fas fa-arrows-alt-h"></i>
                    Length (ft.)
                </label>
                <input type="number" id="residentialLength" name="length" placeholder="e.g., 30" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialBreadth">
                    <i class="fas fa-arrows-alt-v"></i>
                    Breadth (ft.)
                </label>
                <input type="number" id="residentialBreadth" name="breadth" placeholder="e.g., 40" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialBuildupArea">
                    <i class="fas fa-ruler-combined"></i>
                    Builtup Area (sq.ft.)
                </label>
                <input type="number" id="residentialBuildupArea" name="buildup_area" placeholder="e.g., 2000" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialCarpetArea">
                    <i class="fas fa-ruler"></i>
                    Carpet Area (sq.ft.)
                </label>
                <input type="number" id="residentialCarpetArea" name="carpet_area" placeholder="e.g., 1800" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialBedroomsCount">
                    <i class="fas fa-bed"></i>
                    Bedrooms
                </label>
                <input type="number" id="residentialBedroomsCount" name="bedrooms_count" placeholder="e.g., 3" min="0" max="10">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialBathrooms">
                    <i class="fas fa-bath"></i>
                    Bathrooms
                </label>
                <input type="number" id="residentialBathrooms" name="bathrooms" placeholder="e.g., 2" min="0" max="10">
            </div>
        </div>
    `;
}

// Get HTML for Plot Properties Step 2
function getPlotPropertiesStep2HTML() {
    return `
        <div class="dashboard-form-group">
            <label for="residentialPlotArea">
                <i class="fas fa-map"></i>
                Plot Area (sq.ft.) *
            </label>
            <input type="number" id="residentialPlotArea" name="plot_area" placeholder="e.g., 2400" step="0.01" min="0" required>
        </div>

        <div class="dashboard-form-row">
            <div class="dashboard-form-group">
                <label for="residentialLength">
                    <i class="fas fa-arrows-alt-h"></i>
                    Length (ft.)
                </label>
                <input type="number" id="residentialLength" name="length" placeholder="e.g., 30" step="0.01" min="0">
            </div>
            <div class="dashboard-form-group">
                <label for="residentialBreadth">
                    <i class="fas fa-arrows-alt-v"></i>
                    Breadth (ft.)
                </label>
                <input type="number" id="residentialBreadth" name="breadth" placeholder="e.g., 40" step="0.01" min="0">
            </div>
        </div>

        <div class="dashboard-form-group">
            <label for="residentialStatus">
                <i class="fas fa-tag"></i>
                Status *
            </label>
            <select id="residentialStatus" name="status" required>
                <option value="">Select Status</option>
                <option value="ready_to_move">Ready to Register</option>
                <option value="under_development">Under Development</option>
            </select>
        </div>
    `;
}

// Initialize event listeners for Step 2 content
function initializeStep2EventListeners(propertyType) {
    // Initialize unit type buttons for apartments and villas
    const unitTypeButtons = document.querySelectorAll('#residentialStep2 .dashboard-unit-type-btn');
    
    // Set first button as active by default if no button is already active
    if (unitTypeButtons.length > 0) {
        const hasActiveButton = Array.from(unitTypeButtons).some(btn => btn.classList.contains('active'));
        if (!hasActiveButton) {
            const firstButton = unitTypeButtons[0];
            firstButton.classList.add('active');
            
            // Update hidden input fields with first button's values
            const bedroomsInput = document.getElementById('residentialBedrooms');
            const unitTypeInput = document.getElementById('residentialUnitType');
            
            if (bedroomsInput && firstButton.dataset.bedrooms) {
                bedroomsInput.value = firstButton.dataset.bedrooms;
            }
            if (unitTypeInput && firstButton.dataset.unitType) {
                unitTypeInput.value = firstButton.dataset.unitType;
            }
        }
    }
    
    unitTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons in Step 2
            unitTypeButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update hidden input fields
            const bedroomsInput = document.getElementById('residentialBedrooms');
            const unitTypeInput = document.getElementById('residentialUnitType');
            
            if (bedroomsInput) {
                bedroomsInput.value = btn.dataset.bedrooms || '1';
            }
            if (unitTypeInput) {
                unitTypeInput.value = btn.dataset.unitType || 'bhk';
            }
        });
    });
    
    // Handle villa type change to show/hide plot area
    const villaTypeSelect = document.getElementById('residentialVillaType');
    if (villaTypeSelect) {
        villaTypeSelect.addEventListener('change', () => {
            const plotAreaContainer = document.getElementById('residentialPlotAreaContainer');
            const plotAreaInput = document.getElementById('residentialPlotArea');
            
            if (villaTypeSelect.value === 'independent_villa') {
                if (plotAreaContainer) plotAreaContainer.style.display = 'block';
                if (plotAreaInput) plotAreaInput.setAttribute('required', 'required');
            } else {
                if (plotAreaContainer) plotAreaContainer.style.display = 'none';
                if (plotAreaInput) {
                    plotAreaInput.removeAttribute('required');
                    plotAreaInput.value = '';
                }
            }
        });
    }
    
    // Auto-calculate length and breadth from plot area
    const plotAreaInput = document.getElementById('residentialPlotArea');
    const lengthInput = document.getElementById('residentialLength');
    const breadthInput = document.getElementById('residentialBreadth');
    
    if (plotAreaInput && lengthInput && breadthInput) {
        // Track if user has manually edited length or breadth after form load
        let lengthManuallyEdited = false;
        let breadthManuallyEdited = false;
        let isAutoCalculating = false; // Flag to prevent triggering manual edit during auto-calculation
        let lastCalculatedPlotArea = null; // Track last calculated plot area to detect changes
        
        // Track manual changes to length (only if not auto-calculating)
        lengthInput.addEventListener('input', () => {
            if (!isAutoCalculating && lengthInput.value && lengthInput.value.trim() !== '') {
                lengthManuallyEdited = true;
            }
        });
        
        // Track manual changes to breadth (only if not auto-calculating)
        breadthInput.addEventListener('input', () => {
            if (!isAutoCalculating && breadthInput.value && breadthInput.value.trim() !== '') {
                breadthManuallyEdited = true;
            }
        });
        
        // Auto-calculate when plot area is entered or changed
        plotAreaInput.addEventListener('input', () => {
            const plotArea = parseFloat(plotAreaInput.value);
            
            if (plotArea && plotArea > 0) {
                // Calculate assuming square plot: length = breadth = sqrt(plot_area)
                const calculatedDimension = Math.sqrt(plotArea);
                
                // Check if plot area has changed (for existing properties)
                const plotAreaChanged = lastCalculatedPlotArea === null || 
                                       Math.abs(plotArea - lastCalculatedPlotArea) > 0.01;
                lastCalculatedPlotArea = plotArea;
                
                // Set flag to prevent triggering manual edit detection
                isAutoCalculating = true;
                
                // Auto-fill length if:
                // 1. Field is empty, OR
                // 2. Plot area changed and length hasn't been manually edited
                if (lengthInput.value === '' || (plotAreaChanged && !lengthManuallyEdited)) {
                    lengthInput.value = calculatedDimension.toFixed(2);
                }
                
                // Auto-fill breadth if:
                // 1. Field is empty, OR
                // 2. Plot area changed and breadth hasn't been manually edited
                if (breadthInput.value === '' || (plotAreaChanged && !breadthManuallyEdited)) {
                    breadthInput.value = calculatedDimension.toFixed(2);
                }
                
                // Reset flag after auto-calculation
                setTimeout(() => {
                    isAutoCalculating = false;
                }, 0);
            } else if (!plotArea || plotArea <= 0) {
                // Clear length and breadth if plot area is cleared (only if not manually edited)
                isAutoCalculating = true;
                lastCalculatedPlotArea = null;
                
                if (!lengthManuallyEdited) {
                    lengthInput.value = '';
                }
                if (!breadthManuallyEdited) {
                    breadthInput.value = '';
                }
                
                setTimeout(() => {
                    isAutoCalculating = false;
                }, 0);
            }
        });
        
        // Initialize last calculated plot area if plot area already has a value
        if (plotAreaInput.value) {
            const existingPlotArea = parseFloat(plotAreaInput.value);
            if (existingPlotArea && existingPlotArea > 0) {
                lastCalculatedPlotArea = existingPlotArea;
            }
        }
        
        // Reset manual edit flags when plot area is cleared completely
        plotAreaInput.addEventListener('blur', () => {
            const plotArea = parseFloat(plotAreaInput.value);
            if (!plotArea || plotArea <= 0) {
                // Reset flags when plot area is empty
                if (lengthInput.value === '') {
                    lengthManuallyEdited = false;
                }
                if (breadthInput.value === '') {
                    breadthManuallyEdited = false;
                }
            }
        });
    }
    
    // Auto-calculate carpet area from super builtup area (75% of super builtup area)
    const superBuildupAreaInput = document.getElementById('residentialSuperBuildupArea');
    const carpetAreaInput = document.getElementById('residentialCarpetArea');
    
    if (superBuildupAreaInput && carpetAreaInput) {
        // Track if user has manually edited carpet area after form load
        let carpetAreaManuallyEdited = false;
        let isAutoCalculating = false; // Flag to prevent triggering manual edit during auto-calculation
        let lastCalculatedSuperBuildupArea = null; // Track last calculated super builtup area to detect changes
        
        // Track manual changes to carpet area (only if not auto-calculating)
        carpetAreaInput.addEventListener('input', () => {
            if (!isAutoCalculating && carpetAreaInput.value && carpetAreaInput.value.trim() !== '') {
                carpetAreaManuallyEdited = true;
            }
        });
        
        // Auto-calculate when super builtup area is entered or changed
        superBuildupAreaInput.addEventListener('input', () => {
            const superBuildupArea = parseFloat(superBuildupAreaInput.value);
            
            if (superBuildupArea && superBuildupArea > 0) {
                // Calculate carpet area as 75% of super builtup area
                const calculatedCarpetArea = superBuildupArea * 0.75;
                
                // Check if super builtup area has changed (for existing properties)
                const superBuildupAreaChanged = lastCalculatedSuperBuildupArea === null || 
                                               Math.abs(superBuildupArea - lastCalculatedSuperBuildupArea) > 0.01;
                lastCalculatedSuperBuildupArea = superBuildupArea;
                
                // Set flag to prevent triggering manual edit detection
                isAutoCalculating = true;
                
                // Auto-fill carpet area if:
                // 1. Field is empty, OR
                // 2. Super builtup area changed and carpet area hasn't been manually edited
                if (carpetAreaInput.value === '' || (superBuildupAreaChanged && !carpetAreaManuallyEdited)) {
                    carpetAreaInput.value = calculatedCarpetArea.toFixed(2);
                }
                
                // Reset flag after auto-calculation
                setTimeout(() => {
                    isAutoCalculating = false;
                }, 0);
            } else if (!superBuildupArea || superBuildupArea <= 0) {
                // Clear carpet area if super builtup area is cleared (only if not manually edited)
                isAutoCalculating = true;
                lastCalculatedSuperBuildupArea = null;
                
                if (!carpetAreaManuallyEdited) {
                    carpetAreaInput.value = '';
                }
                
                setTimeout(() => {
                    isAutoCalculating = false;
                }, 0);
            }
        });
        
        // Initialize last calculated super builtup area if it already has a value
        if (superBuildupAreaInput.value) {
            const existingSuperBuildupArea = parseFloat(superBuildupAreaInput.value);
            if (existingSuperBuildupArea && existingSuperBuildupArea > 0) {
                lastCalculatedSuperBuildupArea = existingSuperBuildupArea;
            }
        }
        
        // Reset manual edit flag when super builtup area is cleared completely
        superBuildupAreaInput.addEventListener('blur', () => {
            const superBuildupArea = parseFloat(superBuildupAreaInput.value);
            if (!superBuildupArea || superBuildupArea <= 0) {
                // Reset flag when super builtup area is empty
                if (carpetAreaInput.value === '') {
                    carpetAreaManuallyEdited = false;
                }
            }
        });
    }
    
    // Load amenities for apartments and villas
    if (propertyType === 'apartments' || propertyType === 'villas') {
        loadAmenitiesForResidentialForm().then(() => {
            // After amenities are loaded, check if we're in edit mode and populate them
            const propertyId = document.getElementById('residentialPropertyId')?.value;
            if (propertyId) {
                // This will be handled by populateStep2Fields if needed
            }
        });
    }
}

// Load Amenities for Residential Property Form
async function loadAmenitiesForResidentialForm() {
    try {
        const response = await fetch('/api/amenities');
        if (response.ok) {
            const data = await response.json();
            const amenitiesSelect = document.getElementById('residentialAmenities');
            if (amenitiesSelect && data.amenities && Array.isArray(data.amenities)) {
                // Clear existing options
                amenitiesSelect.innerHTML = '';
                
                // Add amenities
                const uniqueAmenities = [...new Set(data.amenities.map(a => a && a.trim()).filter(Boolean))];
                uniqueAmenities.sort();
                
                uniqueAmenities.forEach(amenity => {
                    const option = document.createElement('option');
                    option.value = amenity;
                    const displayName = amenity
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    option.textContent = displayName;
                    amenitiesSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading amenities:', error);
    }
}

// Load cities for residential property form dropdown
async function loadCitiesForResidentialForm() {
    try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/cities?_t=${timestamp}`, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const cityInput = document.getElementById('residentialCity');
            const cityDatalist = document.getElementById('residentialCityList');
            if (cityInput && cityDatalist && data.cities && Array.isArray(data.cities)) {
                // Store current value before clearing
                const currentValue = cityInput.value;
                
                // Clear existing options
                cityDatalist.innerHTML = '';
                
                // If no active cities, show message
                if (data.cities.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No active cities available';
                    cityDatalist.appendChild(option);
                    return;
                }
                
                // Group cities by state
                const citiesByState = {};
                data.cities.forEach(city => {
                    // Handle both string and object formats
                    const cityName = typeof city === 'string' ? city : (city.name || '');
                    const state = typeof city === 'object' ? (city.state || 'Other') : 'Other';
                    
                    if (cityName && cityName.trim()) {
                        if (!citiesByState[state]) {
                            citiesByState[state] = [];
                        }
                        citiesByState[state].push(cityName.trim());
                    }
                });
                
                // Sort states and cities
                const sortedStates = Object.keys(citiesByState).sort();
                sortedStates.forEach(state => {
                    const cities = citiesByState[state].sort();
                    cities.forEach(cityName => {
                        const option = document.createElement('option');
                        option.value = cityName;
                        option.textContent = `${cityName}, ${state}`;
                        cityDatalist.appendChild(option);
                    });
                });
                
                // Restore previous value if it exists
                if (currentValue) {
                    cityInput.value = currentValue;
                }
            }
        } else {
            console.error('Failed to load cities:', response.status, response.statusText);
            const cityDatalist = document.getElementById('residentialCityList');
            if (cityDatalist) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading cities';
                cityDatalist.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading cities:', error);
        const cityDatalist = document.getElementById('residentialCityList');
        if (cityDatalist) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading cities';
            cityDatalist.appendChild(option);
        }
    }
}

// Load localities/areas for a selected city in residential form
async function loadLocalitiesForResidentialForm(cityName) {
    try {
        if (!cityName || cityName.trim() === '') {
            // Clear locality datalist if no city is selected
            const localityDatalist = document.getElementById('residentialLocalityList');
            const localityInput = document.getElementById('residentialLocality');
            if (localityDatalist) {
                localityDatalist.innerHTML = '';
            }
            if (localityInput) {
                localityInput.value = '';
            }
            return;
        }
        
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const apiUrl = `/api/localities?city=${encodeURIComponent(cityName)}&_t=${timestamp}`;
        console.log('Fetching localities from:', apiUrl);
        const response = await fetch(apiUrl, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Localities API response for city "' + cityName + '":', data);
            console.log('Number of localities received:', data.localities ? data.localities.length : 0);
            const localityInput = document.getElementById('residentialLocality');
            const localityDatalist = document.getElementById('residentialLocalityList');
            if (!localityInput || !localityDatalist) {
                console.error('Locality input or datalist element not found: residentialLocality');
                return;
            }
            
            // Store current value before clearing
            const currentValue = localityInput.value;
            
            // Clear existing options
            localityDatalist.innerHTML = '';
            
            if (data.localities && Array.isArray(data.localities)) {
                console.log('Processing localities array:', data.localities);
                // If no localities found, show message
                if (data.localities.length === 0) {
                    console.warn('No localities found for city:', cityName);
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No areas available for this city';
                    localityDatalist.appendChild(option);
                    return;
                }
                
                // Sort localities alphabetically
                const sortedLocalities = [...data.localities].sort();
                console.log('Sorted localities:', sortedLocalities);
                
                // Add localities to datalist
                let addedCount = 0;
                sortedLocalities.forEach(locality => {
                    if (locality && locality.trim()) {
                        const option = document.createElement('option');
                        option.value = locality.trim();
                        option.textContent = locality.trim();
                        localityDatalist.appendChild(option);
                        addedCount++;
                    }
                });
                console.log(`Added ${addedCount} localities to datalist`);
                
                // Restore previous value if it exists
                if (currentValue) {
                    localityInput.value = currentValue;
                }
            }
        } else {
            console.error('Failed to load localities:', response.status, response.statusText);
            const localityDatalist = document.getElementById('residentialLocalityList');
            if (localityDatalist) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading areas';
                localityDatalist.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading localities:', error);
        const localityDatalist = document.getElementById('residentialLocalityList');
        if (localityDatalist) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading areas';
            localityDatalist.appendChild(option);
        }
    }
}

// Store unit types globally
let allUnitTypes = [];

// Store categories globally
let allCategories = [];

// Load categories and populate Property Type dropdown
async function loadCategoriesForPropertyTypeDropdown() {
    try {
        // Define default property types (original categories)
        const defaultPropertyTypes = [
            { value: 'apartments', label: 'Apartments' },
            { value: 'villas', label: 'Villas' },
            { value: 'plot_properties', label: 'Plot Properties' },
            { value: 'individual_house', label: 'Individual House' }
        ];
        
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/categories?_t=${timestamp}`, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.categories && Array.isArray(data.categories)) {
                // Store categories globally (only active categories are returned from /api/categories)
                allCategories = data.categories.filter(cat => cat && cat.name && cat.display_name);
                // Sort by display name
                allCategories.sort((a, b) => {
                    return (a.display_name || '').localeCompare(b.display_name || '');
                });
                
                // Populate Property Type dropdown
                const propertyTypeSelect = document.getElementById('residentialPropertyType');
                if (propertyTypeSelect) {
                    // Store current selection
                    const currentValue = propertyTypeSelect.value;
                    
                    // Clear existing options except the first "Select Property Type" option
                    propertyTypeSelect.innerHTML = '<option value="">Select Property Type</option>';
                    
                    // Get default values to avoid duplicates
                    const defaultValues = defaultPropertyTypes.map(d => d.value);
                    
                    // First, add default property types
                    defaultPropertyTypes.forEach(defaultType => {
                        const option = document.createElement('option');
                        option.value = defaultType.value;
                        option.textContent = defaultType.label;
                        propertyTypeSelect.appendChild(option);
                    });
                    
                    // Then, add categories from API (excluding any that match default values)
                    allCategories.forEach(category => {
                        // Skip if category name matches any default property type
                        if (!defaultValues.includes(category.name)) {
                            const option = document.createElement('option');
                            option.value = category.name;
                            option.textContent = category.display_name;
                            propertyTypeSelect.appendChild(option);
                        }
                    });
                    
                    // Restore previous selection if it still exists
                    if (currentValue) {
                        const optionExists = Array.from(propertyTypeSelect.options).some(opt => opt.value === currentValue);
                        if (optionExists) {
                            propertyTypeSelect.value = currentValue;
                        }
                    }
                }
            }
        } else {
            console.error('Failed to load categories:', response.status, response.statusText);
            // Fallback: ensure default property types are present
            const propertyTypeSelect = document.getElementById('residentialPropertyType');
            if (propertyTypeSelect) {
                const currentValue = propertyTypeSelect.value;
                propertyTypeSelect.innerHTML = '<option value="">Select Property Type</option>';
                
                defaultPropertyTypes.forEach(defaultType => {
                    const option = document.createElement('option');
                    option.value = defaultType.value;
                    option.textContent = defaultType.label;
                    propertyTypeSelect.appendChild(option);
                });
                
                if (currentValue) {
                    const optionExists = Array.from(propertyTypeSelect.options).some(opt => opt.value === currentValue);
                    if (optionExists) {
                        propertyTypeSelect.value = currentValue;
                    }
                }
            }
            // Fallback to empty array
            allCategories = [];
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Fallback: ensure default property types are present
        const propertyTypeSelect = document.getElementById('residentialPropertyType');
        if (propertyTypeSelect) {
            const defaultPropertyTypes = [
                { value: 'apartments', label: 'Apartments' },
                { value: 'villas', label: 'Villas' },
                { value: 'plot_properties', label: 'Plot Properties' },
                { value: 'individual_house', label: 'Individual House' }
            ];
            
            const currentValue = propertyTypeSelect.value;
            propertyTypeSelect.innerHTML = '<option value="">Select Property Type</option>';
            
            defaultPropertyTypes.forEach(defaultType => {
                const option = document.createElement('option');
                option.value = defaultType.value;
                option.textContent = defaultType.label;
                propertyTypeSelect.appendChild(option);
            });
            
            if (currentValue) {
                const optionExists = Array.from(propertyTypeSelect.options).some(opt => opt.value === currentValue);
                if (optionExists) {
                    propertyTypeSelect.value = currentValue;
                }
            }
        }
        // Fallback to empty array
        allCategories = [];
    }
}

// Load unit types for residential property form
async function loadUnitTypesForResidentialForm() {
    try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/unit-types?_t=${timestamp}`, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.unit_types && Array.isArray(data.unit_types)) {
                // Store unit types globally
                allUnitTypes = data.unit_types.filter(ut => ut && ut.name && ut.display_name);
                // Sort by bedrooms, then by name
                allUnitTypes.sort((a, b) => {
                    const bedroomsA = a.bedrooms || 0;
                    const bedroomsB = b.bedrooms || 0;
                    if (bedroomsA !== bedroomsB) {
                        return bedroomsA - bedroomsB;
                    }
                    return (a.name || '').localeCompare(b.name || '');
                });
            }
        } else {
            console.error('Failed to load unit types:', response.status, response.statusText);
            // Fallback to empty array
            allUnitTypes = [];
        }
    } catch (error) {
        console.error('Error loading unit types:', error);
        // Fallback to empty array
        allUnitTypes = [];
    }
}

// Generate unit type buttons HTML based on property type
function generateUnitTypeButtonsHTML(propertyType) {
    if (!allUnitTypes || allUnitTypes.length === 0) {
        // Fallback to default buttons if unit types not loaded
        if (propertyType === 'apartments') {
            return `
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType1BHK" data-bedrooms="1" data-unit-type="bhk">1 BHK</button>
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType2BHK" data-bedrooms="2" data-unit-type="bhk">2 BHK</button>
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType3BHK" data-bedrooms="3" data-unit-type="bhk">3 BHK</button>
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType4BHK" data-bedrooms="4" data-unit-type="bhk">4 BHK</button>
            `;
        } else if (propertyType === 'villas' || propertyType === 'individual_house') {
            return `
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType3BHK" data-bedrooms="3" data-unit-type="bhk">3 BHK</button>
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType4BHK" data-bedrooms="4" data-unit-type="4plus">4 BHK</button>
                <button type="button" class="dashboard-unit-type-btn" id="residentialUnitType5PlusBHK" data-bedrooms="5" data-unit-type="4plus">5+ BHK</button>
            `;
        }
        return '';
    }
    
    // Filter unit types based on property type
    let filteredUnitTypes = [];
    
    if (propertyType === 'apartments') {
        // For apartments, show BHK types (typically 1-4 bedrooms)
        filteredUnitTypes = allUnitTypes.filter(ut => {
            const name = (ut.name || '').toUpperCase();
            const bedrooms = ut.bedrooms || 0;
            // Include BHK types and unit types with 1-4 bedrooms
            return name.includes('BHK') || (bedrooms >= 1 && bedrooms <= 4);
        });
    } else if (propertyType === 'villas' || propertyType === 'individual_house') {
        // For villas/houses, show larger unit types (typically 3+ bedrooms)
        filteredUnitTypes = allUnitTypes.filter(ut => {
            const bedrooms = ut.bedrooms || 0;
            // Include unit types with 3+ bedrooms
            return bedrooms >= 3;
        });
    } else {
        // For other types, show all unit types
        filteredUnitTypes = allUnitTypes;
    }
    
    // If no filtered unit types, use all unit types as fallback
    if (filteredUnitTypes.length === 0) {
        filteredUnitTypes = allUnitTypes;
    }
    
    // Generate buttons HTML
    let buttonsHTML = '';
    filteredUnitTypes.forEach((unitType, index) => {
        const unitTypeName = unitType.name || '';
        const displayName = unitType.display_name || unitTypeName;
        const bedrooms = unitType.bedrooms || 0;
        
        // Determine unit_type value based on name
        // Note: unit_type must be one of: 'rk', 'bhk', '4plus' (database constraint)
        // 'villa' is NOT a valid unit_type - it should be in the 'type' field instead
        let unitTypeValue = 'bhk';
        const nameUpper = unitTypeName.toUpperCase();
        if (nameUpper.includes('RK') || nameUpper.includes('ROOM')) {
            unitTypeValue = 'rk';
        } else if (nameUpper.includes('BHK')) {
            unitTypeValue = 'bhk';
        } else if (bedrooms >= 4) {
            unitTypeValue = '4plus';
        } else if (nameUpper.includes('VILLA')) {
            // For villas, use bhk or 4plus based on bedrooms
            // The 'villa' type is set in the 'type' field, not 'unit_type'
            unitTypeValue = bedrooms >= 4 ? '4plus' : 'bhk';
        }
        
        // Create unique ID for button
        const buttonId = `residentialUnitType${unitTypeName.replace(/[^a-zA-Z0-9]/g, '')}${index}`;
        
        buttonsHTML += `<button type="button" class="dashboard-unit-type-btn" id="${buttonId}" data-bedrooms="${bedrooms}" data-unit-type="${unitTypeValue}" data-unit-type-name="${unitTypeName}">${displayName}</button>`;
    });
    
    return buttonsHTML || '<button type="button" class="dashboard-unit-type-btn" disabled>No unit types available</button>';
}

// Populate Residential Property Form
function populateResidentialForm(property) {
    // Guard: Ensure property exists
    if (!property) {
        console.error('[Dashboard] populateResidentialForm: property is null or undefined');
        return;
    }
    
    // Guard: Check if elements exist before setting values
    const propertyIdInput = document.getElementById('residentialPropertyId');
    if (propertyIdInput) propertyIdInput.value = property.id || '';
    
    const cityInput = document.getElementById('residentialCity');
    const cityDatalist = document.getElementById('residentialCityList');
    if (cityInput && property.city) {
        // Set the city value directly (input field allows free text)
        cityInput.value = property.city;
        
        // If city doesn't exist in datalist, add it as a new option
        if (cityDatalist) {
            const existingOption = cityDatalist.querySelector(`option[value="${property.city}"]`);
            if (!existingOption) {
                const option = document.createElement('option');
                option.value = property.city;
                option.textContent = property.city;
                cityDatalist.appendChild(option);
            }
        }
        
        // Load localities for the selected city
        const cityName = property.city.includes(',') ? property.city.split(',')[0].trim() : property.city.trim();
        loadLocalitiesForResidentialForm(cityName).then(() => {
            // Set locality value after localities are loaded
            const localityInput = document.getElementById('residentialLocality');
            const localityDatalist = document.getElementById('residentialLocalityList');
            if (localityInput && property.locality) {
                // Set the locality value directly (input field allows free text)
                localityInput.value = property.locality;
                
                // If locality doesn't exist in datalist, add it as a new option
                if (localityDatalist) {
                    const existingOption = localityDatalist.querySelector(`option[value="${property.locality}"]`);
                    if (!existingOption) {
                        const option = document.createElement('option');
                        option.value = property.locality;
                        option.textContent = property.locality;
                        localityDatalist.appendChild(option);
                    }
                }
            }
        });
    } else {
        const localityInput = document.getElementById('residentialLocality');
        if (localityInput) localityInput.value = property.locality || '';
    }
    
    const propertyNameInput = document.getElementById('residentialPropertyName');
    if (propertyNameInput) propertyNameInput.value = property.property_name || '';
    
    const typeInput = document.getElementById('residentialType');
    if (typeInput) typeInput.value = property.type || 'residential';
    
    const locationLinkInput = document.getElementById('residentialLocationLink');
    if (locationLinkInput) {
        locationLinkInput.value = property.location_link || '';
        // Validate location link after populating (in case existing data is invalid)
        if (locationLinkInput.value.trim()) {
            // Use setTimeout to ensure validation runs after DOM is ready
            setTimeout(() => {
                validateLocationLinkField(locationLinkInput, true); // Silent mode - no notification, just visual feedback
            }, 100);
        }
    }
    
    // Set price in Step 1 - ensure it's always populated if available
    const priceInput = document.getElementById('residentialPrice');
    if (priceInput) {
        if (property.price_text) {
            priceInput.value = property.price_text;
        } else if (property.price) {
            // Format price if it's a number
            if (typeof property.price === 'number') {
                priceInput.value = 'Rs. ' + property.price.toLocaleString('en-IN');
            } else {
                priceInput.value = property.price;
            }
        }
    }
    
    // Set price negotiable checkbox in Step 1 (right below price input)
    if (property.price_negotiable !== undefined) {
        const priceNegotiableInput = document.getElementById('residentialPriceNegotiable');
        if (priceNegotiableInput) {
            if (priceNegotiableInput.type === 'checkbox') {
                priceNegotiableInput.checked = Boolean(property.price_negotiable);
            } else {
                priceNegotiableInput.value = property.price_negotiable ? '1' : '0';
            }
        }
    }
    
    // Set property type (if available) or infer from existing data
    const propertyTypeSelect = document.getElementById('residentialPropertyType');
    if (propertyTypeSelect) {
        // Try to get property_type from property, or infer from type and unit_type
        let inferredPropertyType = null;
        
        if (property.property_type) {
            inferredPropertyType = property.property_type;
        } else if (property.type) {
            // Map DB type to frontend property_type
            const typeMap = {
                'apartment': 'apartments',
                'villa': 'villas',
                'house': 'individual_house',
                'plot': 'plot_properties'
            };
            inferredPropertyType = typeMap[property.type] || property.type;
        } else if (property.type === 'villa') {
            inferredPropertyType = 'villas';
        } else if (property.unit_type === 'bhk') {
            inferredPropertyType = 'apartments';
        }
        
        if (inferredPropertyType) {
            propertyTypeSelect.value = inferredPropertyType;
            // Trigger change to load Step 2 content
            handleResidentialPropertyTypeChange();
            
            // Wait for Step 2 content to load, then populate fields
            // Use a more reliable approach with fewer retries
            let attempts = 0;
            const maxAttempts = 5;
            const checkAndPopulate = () => {
                attempts++;
                const step2Content = document.getElementById('residentialStep2');
                const hasContent = step2Content && step2Content.innerHTML.trim() !== '';
                
                if (hasContent) {
                    // Step 2 content is loaded, populate all fields
                    populateStep2Fields(property);
                } else if (attempts < maxAttempts) {
                    // Step 2 not ready yet, try again
                    setTimeout(checkAndPopulate, 150);
                } else {
                    // Max attempts reached, try to populate anyway
                    console.warn('Step 2 content may not be fully loaded, attempting to populate fields anyway');
                    populateStep2Fields(property);
                }
            };
            // Start checking after a short delay to allow Step 2 to start loading
            setTimeout(checkAndPopulate, 200);
        }
    }
    
    // Populate Step 3 fields - ensure all fields are set
    // These fields should always exist, so populate them directly
    const descriptionInput = document.getElementById('residentialDescription');
    if (descriptionInput) {
        descriptionInput.value = property.description || '';
    }
    
    const videoLinkInput = document.getElementById('residentialVideoPreviewLink');
    if (videoLinkInput) {
        videoLinkInput.value = property.video_preview_link || '';
    }
    
    const isFeaturedInput = document.getElementById('residentialIsFeatured');
    if (isFeaturedInput) {
        if (isFeaturedInput.type === 'checkbox') {
            isFeaturedInput.checked = Boolean(property.is_featured);
        } else {
            isFeaturedInput.value = property.is_featured ? '1' : '0';
        }
    }

    // Set unit type buttons
    const unitTypeButtons = document.querySelectorAll('#residentialPropertyForm .dashboard-unit-type-btn');
    unitTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    const bedrooms = property.bedrooms || 1;
    const unitType = property.unit_type || 'bhk';
    let activeButton = null;
    
    // unit_type can never be 'villa' - it must be 'rk', 'bhk', or '4plus'
    // For villas, check the 'type' field instead
    if (property.type === 'villa') {
        // For villas, find button by bedrooms
        activeButton = Array.from(unitTypeButtons).find(btn => 
            parseInt(btn.dataset.bedrooms) === bedrooms
        );
    } else {
        activeButton = Array.from(unitTypeButtons).find(btn => 
            btn.dataset.unitType === unitType && parseInt(btn.dataset.bedrooms) === bedrooms
        );
    }
    
    if (!activeButton) {
        // Fallback: find by bedrooms only
        activeButton = Array.from(unitTypeButtons).find(btn => 
            parseInt(btn.dataset.bedrooms) === bedrooms
        );
    }
    
    if (activeButton) {
        activeButton.classList.add('active');
    } else {
        // Default to 1BHK if no match
        const defaultButton = document.getElementById('residentialUnitType1BHK');
        if (defaultButton) defaultButton.classList.add('active');
    }

    // Load gallery images
    // Guard: Handle image_gallery with null checks for image_category/image_type
    if (property.image_gallery && Array.isArray(property.image_gallery) && property.image_gallery.length > 0) {
        // Load gallery items with titles and categories
        property.image_gallery.forEach(galleryItem => {
            // Guard: Ensure galleryItem exists and has image_url
            if (galleryItem && galleryItem.image_url) {
                // Guard: Handle missing category/image_type gracefully
                const category = galleryItem.category || galleryItem.image_type || galleryItem.image_category || 'project';
                addResidentialGalleryItem(
                    galleryItem.image_url,
                    galleryItem.title || '',
                    category
                );
            }
        });
    } else if (property.images && Array.isArray(property.images) && property.images.length > 0) {
        // Fallback: Load images in old format (for backward compatibility)
        property.images.forEach(img => {
            // Guard: Handle both string URLs and image objects
            if (img) {
                const imageUrl = typeof img === 'string' ? img : (img.image_url || null);
                if (imageUrl) {
                    // Guard: Handle missing category/image_type
                    const category = (img.category || img.image_type || img.image_category || 'project');
                    addResidentialGalleryItem(imageUrl, '', category);
                }
            }
        });
    }

    // Load amenities/features (will be populated in Step 2 for apartments/villas)
    // This is handled in populateStep2Fields
}

// Populate Step 2 fields after content is loaded
function populateStep2Fields(property) {
    // Guard: Ensure property exists
    if (!property) {
        console.warn('[Dashboard] populateStep2Fields: property is null or undefined');
        return;
    }
    
    const propertyType = document.getElementById('residentialPropertyType')?.value;
    
    // Common fields
    if (property.status) {
        const statusInput = document.getElementById('residentialStatus');
        if (statusInput) {
            // Map property_status to status if status is sale/rent
            if (property.property_status && (property.status === 'sale' || property.status === 'rent')) {
                statusInput.value = property.property_status;
            } else {
                statusInput.value = property.status;
            }
        }
    }
    
    // Infer listing_type from property_status
    if (property.property_status) {
        const listingTypeMap = {
            'new': 'new',
            'resell': 'resell',
            'ready_to_move': 'new',
            'under_construction': 'new'
        };
        const listingType = listingTypeMap[property.property_status];
        if (listingType) {
            const listingTypeInput = document.getElementById('residentialListingType');
            if (listingTypeInput) listingTypeInput.value = listingType;
        }
    } else if (property.listing_type) {
        const listingTypeInput = document.getElementById('residentialListingType');
        if (listingTypeInput) listingTypeInput.value = property.listing_type;
    }
    
    // Price is now in Step 1, so it's already populated
    
    if (property.direction) {
        const directionInput = document.getElementById('residentialDirection');
        if (directionInput) directionInput.value = property.direction;
    }
    
    // Property type specific fields
    if (propertyType === 'apartments') {
        if (property.super_buildup_area || property.super_built_up_area) {
            const sbaInput = document.getElementById('residentialSuperBuildupArea');
            if (sbaInput) sbaInput.value = property.super_buildup_area || property.super_built_up_area;
        }
        if (property.carpet_area) {
            const carpetInput = document.getElementById('residentialCarpetArea');
            if (carpetInput) carpetInput.value = property.carpet_area;
        }
        
        // Set unit type buttons - match by bedrooms and unit_type
        const bedrooms = property.bedrooms || 1;
        const unitType = property.unit_type || 'bhk';
        const unitTypeButtons = document.querySelectorAll('#residentialStep2 .dashboard-unit-type-btn');
        unitTypeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Find button matching bedrooms and unit_type
        const activeButton = Array.from(unitTypeButtons).find(btn => {
            const btnBedrooms = parseInt(btn.dataset.bedrooms) || 0;
            const btnUnitType = btn.dataset.unitType || '';
            return btnBedrooms === bedrooms && btnUnitType === unitType;
        });
        
        if (activeButton) {
            activeButton.classList.add('active');
            const bedroomsInput = document.getElementById('residentialBedrooms');
            const unitTypeInput = document.getElementById('residentialUnitType');
            if (bedroomsInput) bedroomsInput.value = bedrooms;
            if (unitTypeInput) unitTypeInput.value = unitType;
        } else {
            // Fallback: select first button if no match found
            if (unitTypeButtons.length > 0) {
                const firstButton = unitTypeButtons[0];
                firstButton.classList.add('active');
                const bedroomsInput = document.getElementById('residentialBedrooms');
                const unitTypeInput = document.getElementById('residentialUnitType');
                if (bedroomsInput && firstButton.dataset.bedrooms) {
                    bedroomsInput.value = firstButton.dataset.bedrooms;
                }
                if (unitTypeInput && firstButton.dataset.unitType) {
                    unitTypeInput.value = firstButton.dataset.unitType;
                }
            }
        }
        
        // Load amenities (wait for them to be loaded)
        // Guard: Ensure features is an array and filter out null/undefined/empty values
        const safeFeatures = property.features && Array.isArray(property.features) 
            ? property.features.filter(f => f && (typeof f === 'string' ? f.trim() : true))
            : [];
        
        if (safeFeatures.length > 0) {
            // Wait a bit for amenities to load, then select them
            setTimeout(() => {
                const amenitiesSelect = document.getElementById('residentialAmenities');
                if (amenitiesSelect && amenitiesSelect.options.length > 0) {
                    safeFeatures.forEach(feature => {
                        // Guard: Handle both string features and feature objects
                        const featureValue = typeof feature === 'string' 
                            ? feature.trim() 
                            : (feature && feature.feature_name ? String(feature.feature_name).trim() : null);
                        
                        if (featureValue) {
                            const option = Array.from(amenitiesSelect.options).find(opt => opt.value === featureValue);
                            if (option) {
                                option.selected = true;
                            }
                        }
                    });
                }
            }, 200);
        }
    } else if (propertyType === 'villas' || propertyType === 'individual_house') {
        // Villa type
        const villaTypeInput = document.getElementById('residentialVillaType');
        if (villaTypeInput && property.villa_type) {
            villaTypeInput.value = property.villa_type;
            // Trigger change to show/hide plot area
            villaTypeInput.dispatchEvent(new Event('change'));
        }
        
        // Plot area
        const plotAreaInput = document.getElementById('residentialPlotArea');
        if (plotAreaInput) {
            plotAreaInput.value = property.plot_area || '';
        }
        
        // Length
        const lengthInput = document.getElementById('residentialLength');
        if (lengthInput) {
            lengthInput.value = property.length || property.plot_length || '';
        }
        
        // Breadth
        const breadthInput = document.getElementById('residentialBreadth');
        if (breadthInput) {
            breadthInput.value = property.breadth || property.plot_breadth || '';
        }
        
        // Buildup area
        const buildupInput = document.getElementById('residentialBuildupArea');
        if (buildupInput) {
            buildupInput.value = property.buildup_area || '';
        }
        
        // Carpet area
        const carpetInput = document.getElementById('residentialCarpetArea');
        if (carpetInput) {
            carpetInput.value = property.carpet_area || '';
        }
        
        // Bedrooms count (for villas)
        const bedroomsCountInput = document.getElementById('residentialBedroomsCount');
        if (bedroomsCountInput) {
            bedroomsCountInput.value = property.bedrooms_count || property.bedrooms || '';
        }
        
        // Bedrooms (hidden field)
        const bedroomsInput = document.getElementById('residentialBedrooms');
        if (bedroomsInput) {
            bedroomsInput.value = property.bedrooms || property.bedrooms_count || 1;
        }
        
        // Bathrooms
        const bathroomsInput = document.getElementById('residentialBathrooms');
        if (bathroomsInput) {
            bathroomsInput.value = property.bathrooms || '';
        }
        
        // Set unit type buttons - match by bedrooms and unit_type
        const bedrooms = property.bedrooms || 3;
        const unitType = property.unit_type || 'bhk';
        const unitTypeButtons = document.querySelectorAll('#residentialStep2 .dashboard-unit-type-btn');
        unitTypeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Find button matching bedrooms and unit_type
        let activeButton = Array.from(unitTypeButtons).find(btn => {
            const btnBedrooms = parseInt(btn.dataset.bedrooms) || 0;
            const btnUnitType = btn.dataset.unitType || '';
            return btnBedrooms === bedrooms && btnUnitType === unitType;
        });
        
        if (activeButton) {
            activeButton.classList.add('active');
            const bedroomsInput = document.getElementById('residentialBedrooms');
            const unitTypeInput = document.getElementById('residentialUnitType');
            if (bedroomsInput) bedroomsInput.value = bedrooms;
            if (unitTypeInput) unitTypeInput.value = unitType;
        } else {
            // Fallback: select first button if no match found
            if (unitTypeButtons.length > 0) {
                const firstButton = unitTypeButtons[0];
                firstButton.classList.add('active');
                const bedroomsInput = document.getElementById('residentialBedrooms');
                const unitTypeInput = document.getElementById('residentialUnitType');
                if (bedroomsInput && firstButton.dataset.bedrooms) {
                    bedroomsInput.value = firstButton.dataset.bedrooms;
                }
                if (unitTypeInput && firstButton.dataset.unitType) {
                    unitTypeInput.value = firstButton.dataset.unitType;
                }
            }
        }
        
        // Load amenities (only for villas, not individual house)
        // Guard: Ensure features is an array and filter out null/undefined/empty values
        const safeVillaFeatures = property.features && Array.isArray(property.features) 
            ? property.features.filter(f => f && (typeof f === 'string' ? f.trim() : true))
            : [];
        
        if (propertyType === 'villas' && safeVillaFeatures.length > 0) {
            // Wait a bit for amenities to load, then select them
            setTimeout(() => {
                const amenitiesSelect = document.getElementById('residentialAmenities');
                if (amenitiesSelect && amenitiesSelect.options.length > 0) {
                    safeVillaFeatures.forEach(feature => {
                        // Guard: Handle both string features and feature objects
                        const featureValue = typeof feature === 'string' 
                            ? feature.trim() 
                            : (feature && feature.feature_name ? String(feature.feature_name).trim() : null);
                        
                        if (featureValue) {
                            const option = Array.from(amenitiesSelect.options).find(opt => opt.value === featureValue);
                            if (option) {
                                option.selected = true;
                            }
                        }
                    });
                }
            }, 200);
        }
    } else if (propertyType === 'plot_properties') {
        // Plot area
        const plotAreaInput = document.getElementById('residentialPlotArea');
        if (plotAreaInput) {
            plotAreaInput.value = property.plot_area || property.total_acres || '';
        }
        
        // Length
        const lengthInput = document.getElementById('residentialLength');
        if (lengthInput) {
            lengthInput.value = property.length || property.plot_length || '';
        }
        
        // Breadth
        const breadthInput = document.getElementById('residentialBreadth');
        if (breadthInput) {
            breadthInput.value = property.breadth || property.plot_breadth || '';
        }
    }
}

// Handle Residential Property Submit
async function handleResidentialPropertySubmit(e) {
    e.preventDefault();
    
    // Validate Step 3 before submitting
    if (!validateResidentialPropertyStep(3)) {
        // If validation fails, show step 3
        showResidentialPropertyStep(3);
        updateResidentialPropertyStepIndicators(3);
        updateResidentialPropertyStepButtons(3);
        return;
    }
    
    const formData = new FormData(e.target);
    // Get property ID from form data
    let propertyId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    if (!propertyId || propertyId === '' || propertyId === 'null') {
        const propertyIdInput = document.getElementById('residentialPropertyId');
        if (propertyIdInput && propertyIdInput.value) {
            propertyId = propertyIdInput.value;
        }
    }
    
    // Normalize propertyId
    if (propertyId) {
        propertyId = String(propertyId).trim();
        if (propertyId === '' || propertyId === 'null' || propertyId === 'undefined') {
            propertyId = null;
        }
    } else {
        propertyId = null;
    }
    
    const submitBtn = document.getElementById('residentialSubmitBtn');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Extract form data from all steps
    let propertyType = formData.get('property_type') || '';
    
    // If property_type is not set, infer from other fields
    if (!propertyType) {
        // Try to infer from type field or other indicators
        const typeField = formData.get('type');
        if (typeField === 'villa') {
            propertyType = 'villas';
        } else if (typeField === 'house') {
            propertyType = 'individual_house';
        } else {
            // Default to apartments if we have unit_type or bedrooms
            const unitType = formData.get('unit_type');
            const bedrooms = formData.get('bedrooms');
            if (unitType || bedrooms) {
                propertyType = 'apartments';
            } else {
                propertyType = 'apartments'; // Safe default
            }
        }
    }
    
    // Extract form data
    const data = {
        city: formData.get('city'),
        locality: formData.get('locality'),
        location_link: formData.get('location_link') || null,
        directions: formData.get('directions') || null,
        property_name: formData.get('property_name'),
        type: formData.get('type') || 'residential',
        property_type: propertyType, // Required by backend to identify property type
        unit_type: (() => {
            const unitType = formData.get('unit_type') || 'bhk';
            // Ensure unit_type is always one of: 'rk', 'bhk', '4plus' (database constraint)
            // 'villa' is NOT a valid unit_type - it should be in the 'type' field instead
            if (unitType === 'villa') {
                // For villas, determine unit_type based on bedrooms
                const bedrooms = formData.get('bedrooms') ? parseInt(formData.get('bedrooms')) : 3;
                return bedrooms >= 4 ? '4plus' : 'bhk';
            }
            // Validate against allowed values
            if (['rk', 'bhk', '4plus'].includes(unitType)) {
                return unitType;
            }
            // Default to 'bhk' if invalid
            return 'bhk';
        })(),
        bedrooms: formData.get('bedrooms') ? parseInt(formData.get('bedrooms')) : null,
        bedrooms_count: formData.get('bedrooms_count') ? parseInt(formData.get('bedrooms_count')) : null,
        bathrooms: formData.get('bathrooms') ? parseInt(formData.get('bathrooms')) : null,
        super_buildup_area: formData.get('super_buildup_area') ? parseFloat(formData.get('super_buildup_area')) : null,
        buildup_area: formData.get('buildup_area') ? parseFloat(formData.get('buildup_area')) : null,
        carpet_area: formData.get('carpet_area') ? parseFloat(formData.get('carpet_area')) : null,
        plot_area: formData.get('plot_area') ? parseFloat(formData.get('plot_area')) : null,
        length: formData.get('length') ? parseFloat(formData.get('length')) : null,
        breadth: formData.get('breadth') ? parseFloat(formData.get('breadth')) : null,
        direction: formData.get('direction') || null,
        villa_type: formData.get('villa_type') || null,
        plot_section: formData.get('plot_section') || null,
        listing_type: formData.get('listing_type') || null,
        price: formData.get('price') ? parseFloat(formData.get('price')?.replace(/[^\d.]/g, '') || '0') : 0,
        price_text: formData.get('price') || null,
        price_negotiable: formData.get('price_negotiable') === 'on',
        price_includes_registration: formData.get('price_includes_registration') === 'on',
        status: (() => {
            const statusValue = formData.get('status');
            if (!statusValue) return 'sale';
            // status field only accepts: sale, rent, resale, new
            // Map ready_to_move and under_construction to 'sale' for status field
            if (statusValue === 'ready_to_move' || statusValue === 'under_construction' || statusValue === 'under_development') {
                return 'sale';
            }
            return statusValue; // sale, rent, resale, or new
        })(),
        property_status: (() => {
            const statusValue = formData.get('status');
            // property_status stores: resale, new, ready_to_move, under_construction, under_development
            if (statusValue === 'ready_to_move' || statusValue === 'under_construction' || 
                statusValue === 'under_development' || statusValue === 'resale' || statusValue === 'new') {
                return statusValue;
            }
            return null; // For 'sale' and 'rent', property_status is null
        })(),
        description: formData.get('description') || null,
        is_featured: formData.get('is_featured') === 'on',
        is_active: true,
        images: [],
        features: []
    };
    
    // Get gallery images with titles and categories
    const galleryItems = document.querySelectorAll('#residentialGalleryContainer .dashboard-gallery-item');
    data.images = [];
    data.image_gallery = [];
    
    galleryItems.forEach((item, index) => {
        const imageInput = item.querySelector('input[type="file"]');
        const imagePreview = item.querySelector('.dashboard-gallery-item-image img');
        const titleInput = item.querySelector('input[name="gallery_image_title"]');
        const categorySelect = item.querySelector('select[name="gallery_image_category"]');
        const hiddenImageUrl = item.querySelector('input[type="hidden"][name="gallery_image_url"]');
        
        let imageUrl = null;
        let imageFile = null;
        
        // Priority: 1. data attribute, 2. hidden input, 3. preview src, 4. file input
        // Check data-image-url attribute (set after successful upload)
        if (item.hasAttribute('data-image-url')) {
            imageUrl = item.getAttribute('data-image-url');
        }
        // Check hidden input (also set after successful upload)
        else if (hiddenImageUrl && hiddenImageUrl.value) {
            imageUrl = hiddenImageUrl.value;
        }
        // Check if image is already uploaded (has preview with non-data URL)
        else if (imagePreview && imagePreview.src && !imagePreview.src.includes('data:')) {
            imageUrl = imagePreview.src;
        }
        // Fallback: check if there's a file selected but not yet uploaded
        else if (imageInput && imageInput.files && imageInput.files.length > 0) {
            // Note: Files should be uploaded immediately when selected, but this is a fallback
            imageFile = imageInput.files[0];
        }
        
        // Only include items with uploaded images (imageUrl) or files ready to upload
        if (imageUrl || imageFile) {
            const galleryItem = {
                title: titleInput ? titleInput.value : '',
                category: categorySelect ? categorySelect.value : 'project',
                image_url: imageUrl,
                image_file: imageFile,
                order: index
            };
            data.image_gallery.push(galleryItem);
            
            // For backward compatibility, also add to images array
            if (imageUrl) {
                data.images.push(imageUrl);
            }
        }
    });
    
    // Fallback: Get images from old format (for backward compatibility)
    if (data.images.length === 0) {
    const projectImages = document.querySelectorAll('#residentialProjectImagePreviewContainer .dashboard-image-preview img');
    const floorPlanImages = document.querySelectorAll('#residentialFloorPlanImagePreviewContainer .dashboard-image-preview img');
    const masterPlanImages = document.querySelectorAll('#residentialMasterPlanImagePreviewContainer .dashboard-image-preview img');
    
    data.images = [
        ...Array.from(projectImages).map(img => img.src),
        ...Array.from(floorPlanImages).map(img => img.src),
        ...Array.from(masterPlanImages).map(img => img.src)
    ];
    }
    
    // Get video preview link
    const videoLink = formData.get('video_preview_link');
    if (videoLink) {
        data.video_preview_link = videoLink;
    }
    
    // Get features/amenities from Step 2 (for apartments and villas)
    // Guard: Ensure features is always an array, even if empty
    data.features = [];
    const amenitiesSelect = document.getElementById('residentialAmenities');
    if (amenitiesSelect && amenitiesSelect.selectedOptions && amenitiesSelect.selectedOptions.length > 0) {
        data.features = Array.from(amenitiesSelect.selectedOptions)
            .map(opt => opt && opt.value ? String(opt.value).trim() : null)
            .filter(Boolean); // Remove null/empty values
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (propertyId) {
            // Update existing property - use PUT to /api/properties/{id}
            response = await authenticatedFetch(`/api/properties/${propertyId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new property
            response = await authenticatedFetch('/api/properties', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to save property';
            try {
                const errorData = JSON.parse(text);
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => {
                            const field = err.loc ? err.loc.join('.') : 'field';
                            return `${field}: ${err.msg}`;
                        }).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    } else {
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                } else {
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Force refresh to bypass cache and show newly added/updated property
        await loadProperties(true);
        closeResidentialPropertyModal();
        showNotification(propertyId ? 'Residential property updated successfully!' : 'Residential property added successfully!');
    } catch (error) {
        console.error('Error saving residential property:', error);
        showNotification(error.message || 'Failed to save property. Please try again.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Open Plot Property Modal
async function openPlotPropertyModal(propertyId = null) {
    const modal = document.getElementById('plotPropertyModal');
    const form = document.getElementById('plotPropertyForm');
    const modalTitle = document.getElementById('plotModalTitle');
    
    if (!modal || !form) return;

    // Get property ID input reference BEFORE resetting form
    const propertyIdInput = document.getElementById('plotPropertyId');
    const tempPropertyId = propertyId;
    
    // Reset form (this clears all inputs including hidden propertyId)
    form.reset();
    
    // CRITICAL FIX: Restore property ID immediately after reset if in edit mode
    if (tempPropertyId && propertyIdInput) {
        propertyIdInput.value = tempPropertyId;
    } else if (propertyIdInput) {
        propertyIdInput.value = '';
    }
    
    clearPlotImagePreviews();

    if (propertyId) {
        modalTitle.textContent = 'Edit Plot Property';
        // Fetch property data for editing
        try {
            const response = await fetch(`/api/properties/${propertyId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch property');
            }
            const property = await response.json();
            populatePlotForm(property);
            // CRITICAL: Ensure property ID is set after populating form
            const propertyIdInput = document.getElementById('plotPropertyId');
            if (propertyIdInput) propertyIdInput.value = property.id || propertyId;
        } catch (error) {
            console.error('Error loading property:', error);
            showNotification('Failed to load property details.', 'error');
            // Keep property ID set even if fetch fails
            const propertyIdInput = document.getElementById('plotPropertyId');
            if (propertyIdInput) propertyIdInput.value = propertyId;
            return;
        }
    } else {
        modalTitle.textContent = 'Add Plot Property';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Plot Property Modal
function closePlotPropertyModal() {
    const modal = document.getElementById('plotPropertyModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Handle Plot Property Submit
async function handlePlotPropertySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    // Get property ID from form data
    let propertyId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    if (!propertyId || propertyId === '' || propertyId === 'null') {
        const propertyIdInput = document.getElementById('plotPropertyId');
        if (propertyIdInput && propertyIdInput.value) {
            propertyId = propertyIdInput.value;
        }
    }
    
    // Normalize propertyId
    if (propertyId) {
        propertyId = String(propertyId).trim();
        if (propertyId === '' || propertyId === 'null' || propertyId === 'undefined') {
            propertyId = null;
        }
    } else {
        propertyId = null;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Extract form data
    const data = {
        property_type: 'plot_properties', // Required by backend to identify plot properties
        city: formData.get('city'),
        locality: formData.get('locality'),
        location_link: formData.get('location_link') || null,
        directions: formData.get('directions') || null,
        project_name: formData.get('project_name'),
        property_name: formData.get('project_name'), // Backend accepts both project_name and property_name
        plot_area: parseFloat(formData.get('plot_area') || '0'),
        plot_length: parseFloat(formData.get('plot_length') || '0'),
        plot_breadth: parseFloat(formData.get('plot_breadth') || '0'),
        price: parseFloat(formData.get('price')?.replace(/[^\d.]/g, '') || '0'),
        price_text: formData.get('price'),
        price_negotiable: formData.get('price_negotiable') === 'on',
        price_includes_registration: formData.get('price_includes_registration') === 'on',
        status: (() => {
            const statusValue = formData.get('status');
            // status field only accepts: sale, rent, resale, new
            // Map ready_to_move and under_construction to 'sale' for status field
            if (statusValue === 'ready_to_move' || statusValue === 'under_construction') {
                return 'sale';
            }
            return statusValue; // sale, rent, resale, or new
        })(),
        property_status: (() => {
            const statusValue = formData.get('status');
            // property_status stores: resale, new, ready_to_move, under_construction
            if (statusValue === 'ready_to_move' || statusValue === 'under_construction' || 
                statusValue === 'resale' || statusValue === 'new') {
                return statusValue;
            }
            return null; // For 'sale' and 'rent', property_status is null
        })(),
        description: formData.get('description'),
        builder: formData.get('builder') || null,
        total_acres: formData.get('total_acres') ? parseFloat(formData.get('total_acres')) : null,
        is_featured: formData.get('is_featured') === 'on',
        is_active: true,
        images: [],
        features: []
    };
    
    // Get images from all three categories
    const projectImages = document.querySelectorAll('#plotProjectImagePreviewContainer .dashboard-image-preview img');
    const floorPlanImages = document.querySelectorAll('#plotFloorPlanImagePreviewContainer .dashboard-image-preview img');
    const masterPlanImages = document.querySelectorAll('#plotMasterPlanImagePreviewContainer .dashboard-image-preview img');
    
    // Combine all images (project images first, then floor plan, then master plan)
    data.images = [
        ...Array.from(projectImages).map(img => img.src),
        ...Array.from(floorPlanImages).map(img => img.src),
        ...Array.from(masterPlanImages).map(img => img.src)
    ];
    
    // Get features/amenities
    // Guard: Ensure features is always an array, even if empty
    data.features = [];
    const amenitiesSelect = document.getElementById('plotAmenities');
    if (amenitiesSelect && amenitiesSelect.selectedOptions && amenitiesSelect.selectedOptions.length > 0) {
        data.features = Array.from(amenitiesSelect.selectedOptions)
            .map(opt => opt && opt.value ? String(opt.value).trim() : null)
            .filter(Boolean); // Remove null/empty values
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (propertyId) {
            // Update existing property - use PUT to /api/properties/{id}
            response = await authenticatedFetch(`/api/properties/${propertyId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new property
            response = await authenticatedFetch('/api/properties', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to save property';
            try {
                const errorData = JSON.parse(text);
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => {
                            const field = err.loc ? err.loc.join('.') : 'field';
                            return `${field}: ${err.msg}`;
                        }).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    } else {
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                } else {
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Force refresh to bypass cache and show newly added/updated property
        await loadProperties(true);
        closePlotPropertyModal();
        showNotification(propertyId ? 'Plot property updated successfully!' : 'Plot property added successfully!');
    } catch (error) {
        console.error('Error saving plot property:', error);
        showNotification(error.message || 'Failed to save property. Please try again.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Edit Property
async function editProperty(id) {
    console.log('editProperty called with id:', id);
    
    // Validate input
    if (!id) {
        console.error('editProperty: No ID provided');
        showNotification('Property ID is missing. Please try again.', 'error');
        return;
    }
    
    try {
        // Show loading notification
        showNotification('Loading property details...', 'info');
        
        // Fetch property to determine its type
        const response = await fetch(`/api/properties/${id}`);
        
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = 'Failed to fetch property';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            
            // Provide more specific error messages based on status code
            if (response.status === 404) {
                errorMessage = 'Property not found. It may have been deleted.';
            } else if (response.status === 500) {
                errorMessage = 'Server error while loading property. Please try again.';
            }
            
            throw new Error(errorMessage);
        }
        
        const property = await response.json();
        console.log('Property fetched:', property);
        
        // Validate property data
        if (!property || !property.id) {
            throw new Error('Invalid property data received');
        }
        
        // Check if modal function exists
        if (typeof openResidentialPropertyModal !== 'function') {
            console.error('openResidentialPropertyModal is not a function');
            throw new Error('Modal function not available. Please refresh the page.');
        }
        
        // Open residential property modal (handles all property types: apartments, villas, plot_properties, individual_house)
        // The modal uses a 3-step wizard and dynamically loads Step 2 content based on property_type
        console.log('Opening modal for property:', property.id);
        openResidentialPropertyModal(property.id);
    } catch (error) {
        console.error('Error in editProperty:', error);
        const errorMsg = error.message || 'Failed to load property details.';
        showNotification(errorMsg, 'error');
    }
}

// Delete Property
function deleteProperty(id) {
    // Update delete modal for property
    const deleteModalTitle = document.getElementById('deleteModalTitle');
    const deleteModalMessage = document.getElementById('deleteModalMessage');
    if (deleteModalTitle) deleteModalTitle.textContent = 'Delete Property';
    if (deleteModalMessage) deleteModalMessage.textContent = 'Are you sure you want to delete this property? This action cannot be undone.';
    
    window.currentDeleteId = id;
    window.currentDeleteType = 'property';
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Close Delete Modal
function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    window.currentDeleteId = null;
    window.currentDeleteType = null;
}

// Confirm Delete (removed duplicate - see updated version below)

// Image Handling
let selectedImages = [];

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('imageUploadArea');
    if (area) area.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('imageUploadArea');
    if (area) area.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    handleImageFiles(files);
}

function handleImageSelect(e) {
    const files = e.target.files;
    handleImageFiles(files);
}


async function handleImageFiles(files, formType = 'property', imageCategory = 'project') {
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    
    // Process files sequentially to avoid overwhelming the server
    for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/') || !allowedTypes.includes(file.type)) {
            showNotification(`File "${file.name}" is not a valid image format. Please use JPG, PNG, SVG, or WebP.`, 'error');
            continue;
        }
        
        // Validate file size
        if (file.size > maxFileSize) {
            showNotification(`File "${file.name}" is too large. Maximum size is 5MB.`, 'error');
            continue;
        }
        
        // Read image file as base64
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
            reader.readAsDataURL(file);
        });
        
        // Show temporary preview with loading indicator
        const tempPreviewId = addImagePreview(base64Data, false, formType, imageCategory, true);
        
        // Automatically upload image
        try {
            const response = await authenticatedFetch('/api/upload-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Data
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to upload image');
            }
            
            const result = await response.json();
            const uploadedUrl = result.data?.image_url || result.image_url;
            
            if (!uploadedUrl) {
                throw new Error('Server did not return image URL');
            }
            
            // Update preview with uploaded URL
            updateImagePreview(tempPreviewId, uploadedUrl, formType, imageCategory);
            
            showNotification(`Image "${file.name}" uploaded successfully`, 'success');
        } catch (error) {
            console.error('Error uploading image:', error);
            // Remove the failed preview
            removeImagePreviewById(tempPreviewId, formType, imageCategory);
            showNotification(`Failed to upload "${file.name}": ${error.message}`, 'error');
        }
    }
}

function addImagePreview(imageSrc, isExisting, formType = 'property', imageCategory = 'project', isUploading = false) {
    // Determine container and placeholder IDs based on form type and image category
    let containerId, placeholderId;
    
    if (formType === 'residential') {
        if (imageCategory === 'project') {
            containerId = 'residentialProjectImagePreviewContainer';
            placeholderId = 'residentialProjectImageUploadPlaceholder';
        } else if (imageCategory === 'floorplan') {
            containerId = 'residentialFloorPlanImagePreviewContainer';
            placeholderId = 'residentialFloorPlanImageUploadPlaceholder';
        } else if (imageCategory === 'masterplan') {
            containerId = 'residentialMasterPlanImagePreviewContainer';
            placeholderId = 'residentialMasterPlanImageUploadPlaceholder';
        } else {
            containerId = 'residentialImagePreviewContainer';
            placeholderId = 'residentialImageUploadPlaceholder';
        }
    } else if (formType === 'plot') {
        if (imageCategory === 'project') {
            containerId = 'plotProjectImagePreviewContainer';
            placeholderId = 'plotProjectImageUploadPlaceholder';
        } else if (imageCategory === 'floorplan') {
            containerId = 'plotFloorPlanImagePreviewContainer';
            placeholderId = 'plotFloorPlanImageUploadPlaceholder';
        } else if (imageCategory === 'masterplan') {
            containerId = 'plotMasterPlanImagePreviewContainer';
            placeholderId = 'plotMasterPlanImageUploadPlaceholder';
        } else {
            containerId = 'plotImagePreviewContainer';
            placeholderId = 'plotImageUploadPlaceholder';
        }
    } else {
        containerId = 'imagePreviewContainer';
        placeholderId = 'imageUploadPlaceholder';
    }
    
    const container = document.getElementById(containerId);
    const placeholder = document.getElementById(placeholderId);
    
    if (!container) return null;

    if (placeholder) placeholder.style.display = 'none';

    // Generate unique ID for this preview
    const previewId = 'preview_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const preview = document.createElement('div');
    preview.className = 'dashboard-image-preview';
    preview.id = previewId;
    preview.setAttribute('data-image-src', imageSrc);
    
    // Show loading indicator if uploading
    const loadingHtml = isUploading ? '<div class="dashboard-image-uploading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: 4px; z-index: 10;"><i class="fas fa-spinner fa-spin"></i> Uploading...</div>' : '';
    
    // Create a unique ID for the image to handle errors properly
    const imageId = 'preview-img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    preview.innerHTML = `
        <div style="position: relative;">
            <img id="${imageId}" src="${imageSrc}" alt="Property image" loading="lazy" 
                 onerror="if (!this.dataset.errorHandled) { this.dataset.errorHandled = 'true'; console.warn('Image failed to load:', this.src.substring(0, 100)); this.style.display = 'none'; const errorDiv = document.createElement('div'); errorDiv.style.cssText = 'width: 100%; height: 100%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.75rem; text-align: center; padding: 0.5rem;'; errorDiv.textContent = 'Image failed to load'; this.parentElement.appendChild(errorDiv); }">
            ${loadingHtml}
        </div>
        <button type="button" class="dashboard-image-remove" onclick="removeImagePreview(this, '${formType}', '${imageCategory}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(preview);
    
    return previewId;
}

function updateImagePreview(previewId, newImageSrc, formType = 'property', imageCategory = 'project') {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    // Update the image source
    const img = preview.querySelector('img');
    if (img) {
        // Reset error handling flag when updating to new image
        img.dataset.errorHandled = 'false';
        img.style.display = 'block';
        
        // Remove any existing error divs
        const errorDivs = preview.querySelectorAll('div[style*="Image failed to load"]');
        errorDivs.forEach(div => div.remove());
        
        // Set new image source
        img.src = newImageSrc;
        
        // Add error handler if not already present
        if (!img.onerror || img.onerror.toString().indexOf('errorHandled') === -1) {
            img.onerror = function() {
                if (!this.dataset.errorHandled || this.dataset.errorHandled === 'false') {
                    this.dataset.errorHandled = 'true';
                    console.warn('Image failed to load:', this.src.substring(0, 100));
                    this.style.display = 'none';
                    
                    // Create error message div
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = 'width: 100%; height: 100%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.75rem; text-align: center; padding: 0.5rem; position: absolute; top: 0; left: 0;';
                    errorDiv.textContent = 'Image failed to load';
                    this.parentElement.appendChild(errorDiv);
                }
            };
        }
    }
    
    // Update data attribute
    preview.setAttribute('data-image-src', newImageSrc);
    
    // Remove loading indicator
    const loadingIndicator = preview.querySelector('.dashboard-image-uploading');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

function removeImagePreviewById(previewId, formType = 'property', imageCategory = 'project') {
    const preview = document.getElementById(previewId);
    if (preview) {
        const container = preview.parentElement;
        preview.remove();
        
        // Show placeholder if container is empty
        let placeholderId;
        if (formType === 'residential') {
            if (imageCategory === 'project') {
                placeholderId = 'residentialProjectImageUploadPlaceholder';
            } else if (imageCategory === 'floorplan') {
                placeholderId = 'residentialFloorPlanImageUploadPlaceholder';
            } else if (imageCategory === 'masterplan') {
                placeholderId = 'residentialMasterPlanImageUploadPlaceholder';
            } else {
                placeholderId = 'residentialImageUploadPlaceholder';
            }
        } else if (formType === 'plot') {
            if (imageCategory === 'project') {
                placeholderId = 'plotProjectImageUploadPlaceholder';
            } else if (imageCategory === 'floorplan') {
                placeholderId = 'plotFloorPlanImageUploadPlaceholder';
            } else if (imageCategory === 'masterplan') {
                placeholderId = 'plotMasterPlanImageUploadPlaceholder';
            } else {
                placeholderId = 'plotImageUploadPlaceholder';
            }
        } else {
            placeholderId = 'imageUploadPlaceholder';
        }
        
        const placeholder = document.getElementById(placeholderId);
        if (placeholder && container && container.children.length === 0) {
            placeholder.style.display = 'block';
        }
    }
}

function removeImagePreview(btn, formType = 'property', imageCategory = 'project') {
    const preview = btn.closest('.dashboard-image-preview');
    if (preview) {
        const container = preview.parentElement;
        preview.remove();
        
        // Determine placeholder ID based on container ID
        let placeholderId;
        if (container) {
            const containerId = container.id;
            if (containerId.includes('Project')) {
                placeholderId = containerId.replace('PreviewContainer', 'UploadPlaceholder');
            } else if (containerId.includes('FloorPlan')) {
                placeholderId = containerId.replace('PreviewContainer', 'UploadPlaceholder');
            } else if (containerId.includes('MasterPlan')) {
                placeholderId = containerId.replace('PreviewContainer', 'UploadPlaceholder');
            } else {
                // Fallback for old containers
                placeholderId = formType === 'residential' ? 'residentialImageUploadPlaceholder' : 
                               formType === 'plot' ? 'plotImageUploadPlaceholder' : 'imageUploadPlaceholder';
            }
        } else {
            placeholderId = formType === 'residential' ? 'residentialImageUploadPlaceholder' : 
                           formType === 'plot' ? 'plotImageUploadPlaceholder' : 'imageUploadPlaceholder';
        }
        
        const placeholder = document.getElementById(placeholderId);
        if (container && container.children.length === 0 && placeholder) {
            placeholder.style.display = 'flex';
        }
    }
}

function clearImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    const placeholder = document.getElementById('imageUploadPlaceholder');
    if (container) {
        container.innerHTML = '';
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    const fileInput = document.getElementById('propertyImages');
    if (fileInput) fileInput.value = '';
}

function clearResidentialImagePreviews() {
    // Clear gallery items
    const galleryContainer = document.getElementById('residentialGalleryContainer');
    if (galleryContainer) {
        galleryContainer.innerHTML = '';
    }
    
    // Clear old image previews (for backward compatibility)
    const projectContainer = document.getElementById('residentialProjectImagePreviewContainer');
    const projectPlaceholder = document.getElementById('residentialProjectImageUploadPlaceholder');
    const projectInput = document.getElementById('residentialProjectImages');
    if (projectContainer) projectContainer.innerHTML = '';
    if (projectPlaceholder) projectPlaceholder.style.display = 'flex';
    if (projectInput) projectInput.value = '';
    
    // Clear floor plan images
    const floorPlanContainer = document.getElementById('residentialFloorPlanImagePreviewContainer');
    const floorPlanPlaceholder = document.getElementById('residentialFloorPlanImageUploadPlaceholder');
    const floorPlanInput = document.getElementById('residentialFloorPlanImages');
    if (floorPlanContainer) floorPlanContainer.innerHTML = '';
    if (floorPlanPlaceholder) floorPlanPlaceholder.style.display = 'flex';
    if (floorPlanInput) floorPlanInput.value = '';
    
    // Clear master plan images
    const masterPlanContainer = document.getElementById('residentialMasterPlanImagePreviewContainer');
    const masterPlanPlaceholder = document.getElementById('residentialMasterPlanImageUploadPlaceholder');
    const masterPlanInput = document.getElementById('residentialMasterPlanImages');
    if (masterPlanContainer) masterPlanContainer.innerHTML = '';
    if (masterPlanPlaceholder) masterPlanPlaceholder.style.display = 'flex';
    if (masterPlanInput) masterPlanInput.value = '';
}

// Add new gallery item
function addResidentialGalleryItem(imageUrl = null, title = '', category = 'project') {
    const galleryContainer = document.getElementById('residentialGalleryContainer');
    if (!galleryContainer) return;
    
    const itemId = 'gallery-item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Ensure imageUrl is a string and escape for HTML attribute
    const imageUrlString = imageUrl ? String(imageUrl) : null;
    const safeImageUrl = imageUrlString ? imageUrlString.replace(/"/g, '&quot;') : '';
    const dataImageUrlAttr = imageUrlString ? `data-image-url="${safeImageUrl}"` : '';
    
    const galleryItemHTML = `
        <div class="dashboard-gallery-item" data-item-id="${itemId}" ${dataImageUrlAttr}>
            <div class="dashboard-gallery-item-header">
                <span class="dashboard-gallery-item-title">Image ${galleryContainer.children.length + 1}</span>
                <button type="button" class="dashboard-gallery-item-remove" onclick="removeResidentialGalleryItem('${itemId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="dashboard-gallery-item-content">
                <div class="dashboard-gallery-item-image">
                    ${imageUrlString ? 
                        `<img src="${imageUrlString}" alt="Gallery Image" loading="lazy" style="width: 100%; height: auto; border-radius: 8px;">` : 
                        `<div class="dashboard-gallery-item-image-placeholder">
                            <i class="fas fa-image"></i>
                            <p>No image selected</p>
                        </div>`
                    }
                </div>
                <div class="dashboard-gallery-item-fields">
                    ${imageUrlString ? `<input type="hidden" name="gallery_image_url" value="${safeImageUrl}">` : ''}
                    <div class="dashboard-form-group">
                        <label>
                            <i class="fas fa-heading"></i>
                            Image Title
                        </label>
                        <input type="text" name="gallery_image_title" placeholder="e.g., Living Room View" value="${String(title || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
                    </div>
                    <div class="dashboard-form-group">
                        <label>
                            <i class="fas fa-tag"></i>
                            Image Category *
                        </label>
                        <select name="gallery_image_category" required>
                            <option value="project" ${category === 'project' ? 'selected' : ''}>Project Image</option>
                            <option value="floorplan" ${category === 'floorplan' ? 'selected' : ''}>Floor Plan</option>
                            <option value="masterplan" ${category === 'masterplan' ? 'selected' : ''}>Master Plan</option>
                        </select>
                    </div>
                    <div class="dashboard-form-group">
                        <label>
                            <i class="fas fa-upload"></i>
                            Upload Image
                        </label>
                        <div class="dashboard-gallery-item-upload-btn" onclick="document.getElementById('${itemId}-file-input').click()">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <span>Click to upload or drag and drop</span>
                            <input type="file" id="${itemId}-file-input" accept="image/*" onchange="handleResidentialGalleryImageUpload('${itemId}', this)">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    galleryContainer.insertAdjacentHTML('beforeend', galleryItemHTML);
}

// Remove gallery item
function removeResidentialGalleryItem(itemId) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (item) {
        item.remove();
        // Update item numbers
        updateGalleryItemNumbers();
    }
}

// Update gallery item numbers
function updateGalleryItemNumbers() {
    const galleryContainer = document.getElementById('residentialGalleryContainer');
    if (!galleryContainer) return;
    
    const items = galleryContainer.querySelectorAll('.dashboard-gallery-item');
    items.forEach((item, index) => {
        const titleElement = item.querySelector('.dashboard-gallery-item-title');
        if (titleElement) {
            titleElement.textContent = `Image ${index + 1}`;
        }
    });
}

// Handle gallery image upload
async function handleResidentialGalleryImageUpload(itemId, fileInput) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (!item || !fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    if (!file.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }
    
    // Check file size (5MB max)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
        showNotification('Image size should be less than 5MB', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
        showNotification(`File "${file.name}" is not a valid image format. Please use JPG, PNG, SVG, or WebP.`, 'error');
        return;
    }
    
    const imageContainer = item.querySelector('.dashboard-gallery-item-image');
    if (!imageContainer) return;
    
    // Show loading indicator
    imageContainer.innerHTML = `
        <div style="position: relative; width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border-radius: 8px;">
            <div style="text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                <p style="color: #6b7280; font-size: 0.875rem;">Uploading image...</p>
            </div>
        </div>
    `;
    
    try {
        // Get category from the form before uploading
        const categorySelect = item.querySelector('select[name="gallery_image_category"]');
        const imageCategory = categorySelect ? categorySelect.value : 'project';
        
        // Read image file as base64
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
            reader.readAsDataURL(file);
        });
        
        // Upload image to server with category
        const response = await authenticatedFetch('/api/upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Data,
                image_category: imageCategory,
                property_category: 'residential'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Failed to upload image');
        }
        
        const result = await response.json();
        const uploadedUrl = result.data?.image_url || result.image_url;
        
        if (!uploadedUrl) {
            throw new Error('Server did not return image URL');
        }
        
        // Store the uploaded URL in the gallery item as a data attribute
        item.setAttribute('data-image-url', uploadedUrl);
        
        // Update the image preview with the uploaded URL
        imageContainer.innerHTML = `<img src="${uploadedUrl}" alt="Gallery Image" loading="lazy" style="width: 100%; height: auto; border-radius: 8px;">`;
        
        // Also store in a hidden input for form submission (if needed)
        let hiddenInput = item.querySelector('input[type="hidden"][name="gallery_image_url"]');
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'gallery_image_url';
            item.querySelector('.dashboard-gallery-item-fields')?.appendChild(hiddenInput);
        }
        hiddenInput.value = uploadedUrl;
        
        showNotification(`Image "${file.name}" uploaded successfully`, 'success');
        
    } catch (error) {
        console.error('Error uploading image:', error);
        
        // Show error state in the image container
        imageContainer.innerHTML = `
            <div style="position: relative; width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background: #fee2e2; border: 2px dashed #ef4444; border-radius: 8px;">
                <div style="text-align: center; padding: 1rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ef4444; margin-bottom: 0.5rem;"></i>
                    <p style="color: #dc2626; font-size: 0.875rem; margin-bottom: 0.5rem;">Upload failed</p>
                    <p style="color: #991b1b; font-size: 0.75rem;">${error.message || 'Please try again'}</p>
                </div>
            </div>
        `;
        
        showNotification(`Failed to upload "${file.name}": ${error.message}`, 'error');
        
        // Clear the stored URL if upload failed
        item.removeAttribute('data-image-url');
        const hiddenInput = item.querySelector('input[type="hidden"][name="gallery_image_url"]');
        if (hiddenInput) {
            hiddenInput.value = '';
        }
    }
}

function clearPlotImagePreviews() {
    // Clear project images
    const projectContainer = document.getElementById('plotProjectImagePreviewContainer');
    const projectPlaceholder = document.getElementById('plotProjectImageUploadPlaceholder');
    const projectInput = document.getElementById('plotProjectImages');
    if (projectContainer) projectContainer.innerHTML = '';
    if (projectPlaceholder) projectPlaceholder.style.display = 'flex';
    if (projectInput) projectInput.value = '';
    
    // Clear floor plan images
    const floorPlanContainer = document.getElementById('plotFloorPlanImagePreviewContainer');
    const floorPlanPlaceholder = document.getElementById('plotFloorPlanImageUploadPlaceholder');
    const floorPlanInput = document.getElementById('plotFloorPlanImages');
    if (floorPlanContainer) floorPlanContainer.innerHTML = '';
    if (floorPlanPlaceholder) floorPlanPlaceholder.style.display = 'flex';
    if (floorPlanInput) floorPlanInput.value = '';
    
    // Clear master plan images
    const masterPlanContainer = document.getElementById('plotMasterPlanImagePreviewContainer');
    const masterPlanPlaceholder = document.getElementById('plotMasterPlanImageUploadPlaceholder');
    const masterPlanInput = document.getElementById('plotMasterPlanImages');
    if (masterPlanContainer) masterPlanContainer.innerHTML = '';
    if (masterPlanPlaceholder) masterPlanPlaceholder.style.display = 'flex';
    if (masterPlanInput) masterPlanInput.value = '';
}

// Features Handling
function addFeature() {
    const input = document.getElementById('featureInput');
    if (!input || !input.value.trim()) return;

    const featureText = input.value.trim();
    
    // Check for duplicates (case-insensitive)
    const existingFeatures = Array.from(document.querySelectorAll('.dashboard-feature-text'));
    const isDuplicate = existingFeatures.some(existing => 
        existing.textContent.toLowerCase() === featureText.toLowerCase()
    );
    
    if (isDuplicate) {
        showNotification('This feature already exists!', 'warning');
        input.focus();
        return;
    }

    addFeatureToList(featureText);
    input.value = '';
    input.focus();
}

function addFeatureToList(feature) {
    const list = document.getElementById('featuresList');
    if (!list) return;

    // Validate feature text
    if (!feature || feature.length === 0) return;

    const item = document.createElement('div');
    item.className = 'dashboard-feature-item';
    item.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span class="dashboard-feature-text">${escapeHtml(feature)}</span>
        <button type="button" class="dashboard-feature-remove" onclick="removeFeature(this)" title="Remove feature">
            <i class="fas fa-times"></i>
        </button>
    `;
    list.appendChild(item);
    
    // Add animation
    item.style.opacity = '0';
    item.style.transform = 'scale(0.9)';
    setTimeout(() => {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '1';
        item.style.transform = 'scale(1)';
    }, 10);
}

function removeFeature(btn) {
    const item = btn.closest('.dashboard-feature-item');
    if (item) {
        // Animate removal
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '0';
        item.style.transform = 'scale(0.9)';
        setTimeout(() => item.remove(), 300);
    }
}

function clearFeatures() {
    const list = document.getElementById('featuresList');
    if (list) {
        // Animate removal
        const items = list.querySelectorAll('.dashboard-feature-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '0';
                item.style.transform = 'scale(0.9)';
                setTimeout(() => item.remove(), 300);
            }, index * 50);
        });
        // Clear immediately if no items
        if (items.length === 0) {
            list.innerHTML = '';
        }
    }
    const input = document.getElementById('featureInput');
    if (input) input.value = '';
}

// Search
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query.trim()) {
        // Show all properties if search is empty
        renderProperties(currentProperties);
        return;
    }
    
    const filtered = currentProperties.filter(p => {
        const title = (p.title || '').toLowerCase();
        const location = (p.location || '').toLowerCase();
        const type = (typeof p.type === 'string' ? p.type : p.type?.value || '').toLowerCase();
        
        return title.includes(query) || location.includes(query) || type.includes(query);
    });
    renderProperties(filtered);
}

// Notification
function showNotification(message, type = 'success') {
    // Simple notification - can be enhanced
    const notification = document.createElement('div');
    notification.className = `dashboard-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// TESTIMONIALS MANAGEMENT
// ============================================

// Flag to prevent concurrent testimonials loading
let isLoadingTestimonials = false;

// Load Testimonials from API
async function loadTestimonials(forceRefresh = false) {
    // Prevent concurrent calls
    if (isLoadingTestimonials) {
        return;
    }
    
    isLoadingTestimonials = true;
    try {
        // Add cache-busting timestamp if force refresh is requested
        const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : '';
        
        const fetchOptions = forceRefresh ? {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        } : {};
        
        const response = await authenticatedFetch(`/api/admin/testimonials${cacheBuster}`, fetchOptions);
        
        if (!response.ok) {
            // Try to get error message from response
            const text = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                // If not JSON, use the text as error message
                errorMessage = text || errorMessage;
            }
            
            console.error('Failed to fetch testimonials:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const testimonials = await response.json();
        // Store testimonials for search functionality
        currentTestimonials = testimonials;
        renderTestimonials(testimonials);
    } catch (error) {
        console.error('Error loading testimonials:', error);
        const errorMsg = error.message || 'Failed to load testimonials from server.';
        showNotification(errorMsg, 'error');
    } finally {
        isLoadingTestimonials = false;
    }
}

// Render Testimonials
function renderTestimonials(testimonials) {
    const tbody = document.getElementById('testimonialsTableBody');
    
    if (!tbody) {
        console.error('Testimonials table body not found!');
        return;
    }

    console.log(`Rendering ${testimonials.length} testimonials...`);

    if (testimonials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No testimonials found</td></tr>';
        console.log('No testimonials to render');
        return;
    }

    tbody.innerHTML = testimonials.map(testimonial => {
        const rating = testimonial.rating || 0;
        const ratingStars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        
        // Truncate message for table display
        const message = testimonial.message || '';
        const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        // Render table row with 6 columns: Client Name, Email, Service Type, Rating, Message, Actions
        return `
        <tr>
            <td>
                <div class="dashboard-table-title">${escapeHtml(testimonial.client_name || 'N/A')}</div>
            </td>
            <td>
                <div class="dashboard-table-location">${escapeHtml(testimonial.client_email || 'N/A')}</div>
            </td>
            <td>
                <span class="dashboard-table-type">${escapeHtml(testimonial.service_type || 'N/A')}</span>
            </td>
            <td>
                <div style="color: #fbbf24;">${ratingStars}</div>
            </td>
            <td>
                <div class="dashboard-table-title" title="${escapeHtml(message)}">${escapeHtml(truncatedMessage)}</div>
            </td>
            <td>
                <div class="dashboard-table-actions">
                    <button class="dashboard-action-btn edit" onclick="editTestimonial(${testimonial.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="dashboard-action-btn delete" onclick="deleteTestimonial(${testimonial.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Open Testimonial Modal
function openTestimonialModal(testimonialId = null) {
    const modal = document.getElementById('testimonialModal');
    const form = document.getElementById('testimonialForm');
    const modalTitle = document.getElementById('testimonialModalTitle');
    
    if (!modal || !form) return;

    // Get testimonial ID input reference BEFORE resetting form
    const testimonialIdInput = document.getElementById('testimonialId');
    const tempTestimonialId = testimonialId;
    
    // Reset form (this clears all inputs including hidden testimonialId)
    form.reset();
    
    // CRITICAL FIX: Restore testimonial ID immediately after reset if in edit mode
    if (tempTestimonialId && testimonialIdInput) {
        testimonialIdInput.value = tempTestimonialId;
    } else if (testimonialIdInput) {
        testimonialIdInput.value = '';
    }

    if (testimonialId) {
        // Edit mode - ensure ID is set, then find testimonial from current list
        if (testimonialIdInput) testimonialIdInput.value = testimonialId;
        
        const testimonial = currentTestimonials.find(t => t.id === testimonialId);
        if (testimonial) {
            populateTestimonialForm(testimonial);
            // CRITICAL: Ensure ID is set after populating form
            if (testimonialIdInput) testimonialIdInput.value = testimonial.id || testimonialId;
            modalTitle.textContent = 'Edit Testimonial';
        }
    } else {
        // Add mode
        modalTitle.textContent = 'Add New Testimonial';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Testimonial Modal
function closeTestimonialModal() {
    const modal = document.getElementById('testimonialModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Populate Testimonial Form
function populateTestimonialForm(testimonial) {
    document.getElementById('testimonialId').value = testimonial.id;
    document.getElementById('testimonialClientName').value = testimonial.client_name || '';
    document.getElementById('testimonialClientEmail').value = testimonial.client_email || '';
    document.getElementById('testimonialClientPhone').value = testimonial.client_phone || '';
    document.getElementById('testimonialServiceType').value = testimonial.service_type || '';
    document.getElementById('testimonialRating').value = testimonial.rating || '';
    document.getElementById('testimonialMessage').value = testimonial.message || '';
    document.getElementById('testimonialIsApproved').checked = testimonial.is_approved || false;
}

// Handle Testimonial Submit
async function handleTestimonialSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    // Get testimonial ID from form data
    let testimonialId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    if (!testimonialId || testimonialId === '' || testimonialId === 'null') {
        const testimonialIdInput = document.getElementById('testimonialId');
        if (testimonialIdInput && testimonialIdInput.value) {
            testimonialId = testimonialIdInput.value;
        }
    }
    
    // Normalize testimonialId
    if (testimonialId) {
        testimonialId = String(testimonialId).trim();
        if (testimonialId === '' || testimonialId === 'null' || testimonialId === 'undefined') {
            testimonialId = null;
        }
    } else {
        testimonialId = null;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Validate required fields
    const clientName = formData.get('client_name')?.trim();
    const message = formData.get('message')?.trim();
    
    if (!clientName || !message) {
        showNotification('Please fill in all required fields (Client Name and Message).', 'error');
        return;
    }

    // Get rating - ensure it's a valid integer between 1-5 or null
    const ratingValue = formData.get('rating');
    let rating = null;
    if (ratingValue) {
        const parsedRating = parseInt(ratingValue);
        if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
            rating = parsedRating;
        }
    }
    
    // Get email - ensure it's a valid email or null (not empty string)
    const emailValue = formData.get('client_email')?.trim();
    let clientEmail = null;
    if (emailValue && emailValue.length > 0) {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(emailValue)) {
            clientEmail = emailValue;
        } else {
            showNotification('Please enter a valid email address or leave it empty.', 'error');
            return;
        }
    }
    
    // Get phone - ensure it's null if empty (not empty string)
    const phoneValue = formData.get('client_phone')?.trim();
    const clientPhone = phoneValue && phoneValue.length > 0 ? phoneValue : null;
    
    // Get service type - ensure it's null if empty (not empty string)
    const serviceTypeValue = formData.get('service_type')?.trim();
    const serviceType = serviceTypeValue && serviceTypeValue.length > 0 ? serviceTypeValue : null;
    
    const testimonialData = {
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        service_type: serviceType,
        rating: rating,
        message: message,
        is_approved: formData.get('is_approved') === 'on',
        is_featured: false
    };

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (testimonialId) {
            // Update existing testimonial
            response = await authenticatedFetch(`/api/testimonials/${testimonialId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testimonialData)
            });
        } else {
            // Create new testimonial
            response = await authenticatedFetch('/api/testimonials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testimonialData)
            });
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to save testimonial';
            try {
                const errorData = JSON.parse(text);
                // Handle Pydantic validation errors (422)
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        // Pydantic validation errors are in array format
                        errorMessage = errorData.detail.map(err => {
                            const field = err.loc ? err.loc.join('.') : 'field';
                            return `${field}: ${err.msg}`;
                        }).join(', ');
                    } else {
                        errorMessage = errorData.detail;
                    }
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch {
                // If not JSON, use the text as error message
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Reload testimonials with force refresh to bypass cache
        await loadTestimonials(true);
        closeTestimonialModal();
        
        // Show success message
        showNotification(testimonialId ? 'Testimonial updated successfully!' : 'Testimonial added successfully!');
    } catch (error) {
        console.error('Error saving testimonial:', error);
        showNotification(error.message || 'Failed to save testimonial. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Edit Testimonial
function editTestimonial(id) {
    openTestimonialModal(id);
}

// Delete Testimonial
function deleteTestimonial(id) {
    if (!confirm('Are you sure you want to delete this testimonial?')) {
        return;
    }
    
    // Update delete modal for testimonial
    const deleteModalTitle = document.getElementById('deleteModalTitle');
    const deleteModalMessage = document.getElementById('deleteModalMessage');
    if (deleteModalTitle) deleteModalTitle.textContent = 'Delete Testimonial';
    if (deleteModalMessage) deleteModalMessage.textContent = 'Are you sure you want to delete this testimonial? This action cannot be undone.';
    
    window.currentDeleteId = id;
    window.currentDeleteType = 'testimonial';
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Toggle Testimonial Approval
async function toggleTestimonialApproval(id, isApproved) {
    try {
        const response = await authenticatedFetch(`/api/testimonials/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_approved: isApproved })
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to update testimonial';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        await loadTestimonials(true); // Force refresh after approval change
        showNotification(isApproved ? 'Testimonial approved!' : 'Testimonial unapproved!');
    } catch (error) {
        console.error('Error updating testimonial:', error);
        showNotification('Failed to update testimonial.', 'error');
    }
}

// Toggle Testimonial Featured
async function toggleTestimonialFeatured(id, isFeatured) {
    try {
        const response = await authenticatedFetch(`/api/testimonials/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_featured: isFeatured })
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to update testimonial';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        await loadTestimonials(true); // Force refresh after featured change
        showNotification(isFeatured ? 'Testimonial featured!' : 'Testimonial unfeatured!');
    } catch (error) {
        console.error('Error updating testimonial:', error);
        showNotification('Failed to update testimonial.', 'error');
    }
}

// Testimonial Search
function handleTestimonialSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query.trim()) {
        renderTestimonials(currentTestimonials);
        return;
    }
    
    const filtered = currentTestimonials.filter(t => {
        const name = (t.client_name || '').toLowerCase();
        const email = (t.client_email || '').toLowerCase();
        const serviceType = (t.service_type || '').toLowerCase();
        const message = (t.message || '').toLowerCase();
        
        return name.includes(query) || email.includes(query) || serviceType.includes(query) || message.includes(query);
    });
    renderTestimonials(filtered);
}


// ============================================
// PARTNERS MANAGEMENT
// ============================================

// Load Partners from API
async function loadPartners() {
    try {
        const response = await fetch('/api/partners');
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to fetch partners';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        const partners = await response.json();
        // Store partners for search functionality
        currentPartners = partners;
        renderPartners(partners);
    } catch (error) {
        console.error('Error loading partners:', error);
        showNotification('Failed to load partners from server.', 'error');
    }
}

// Render Partners
function renderPartners(partners) {
    const tbody = document.getElementById('partnersTableBody');
    
    if (!tbody) {
        console.error('Partners table body not found!');
        return;
    }

    console.log(`Rendering ${partners.length} partners...`);

    if (partners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No partners found</td></tr>';
        console.log('No partners to render');
        return;
    }

    // Render table row with 5 columns: Logo, Name, Website, Display Order, Actions (NO STATUS COLUMN)
    tbody.innerHTML = partners.map(partner => {
        return `
        <tr>
            <td>
                <div class="dashboard-table-image">
                    ${partner.logo_url 
                        ? `<img src="${escapeHtml(partner.logo_url)}" alt="${escapeHtml(partner.name)}" style="max-width: 80px; max-height: 60px; object-fit: contain;" loading="lazy" onerror="this.style.display='none'; const fallback = this.nextElementSibling; if (fallback && fallback.style) fallback.style.display='flex';">
                    <div style="width: 80px; height: 60px; background: #f3f4f6; display: none; align-items: center; justify-content: center; color: #9ca3af; border-radius: 4px;">No Logo</div>`
                        : '<div style="width: 80px; height: 60px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; border-radius: 4px;">No Logo</div>'
                    }
                </div>
            </td>
            <td>
                <div class="dashboard-table-title">${escapeHtml(partner.name || 'N/A')}</div>
            </td>
            <td>
                <div class="dashboard-table-location">
                    ${partner.website_url 
                        ? `<a href="${escapeHtml(partner.website_url)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none;">
                            <i class="fas fa-external-link-alt"></i> ${escapeHtml(partner.website_url)}
                           </a>`
                        : '<span style="color: #9ca3af;">N/A</span>'
                    }
                </div>
            </td>
            <td>
                <span class="dashboard-table-type">${partner.display_order || 0}</span>
            </td>
            <td>
                <div class="dashboard-table-actions">
                    <button class="dashboard-action-btn edit" onclick="editPartner(${partner.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="dashboard-action-btn delete" onclick="deletePartner(${partner.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Open Partner Modal
function openPartnerModal(partnerId = null) {
    const modal = document.getElementById('partnerModal');
    const form = document.getElementById('partnerForm');
    const modalTitle = document.getElementById('partnerModalTitle');
    
    if (!modal || !form) return;

    // Get partner ID input reference BEFORE resetting form
    const partnerIdInput = document.getElementById('partnerId');
    const tempPartnerId = partnerId;
    
    // Reset form (this clears all inputs including hidden partnerId)
    form.reset();
    
    // CRITICAL FIX: Restore partner ID immediately after reset if in edit mode
    if (tempPartnerId && partnerIdInput) {
        partnerIdInput.value = tempPartnerId;
    } else if (partnerIdInput) {
        partnerIdInput.value = '';
    }
    
    document.getElementById('partnerIsActive').checked = true;
    clearPartnerLogoPreviews();

    if (partnerId) {
        // Edit mode - ensure ID is set, then find partner from current list
        if (partnerIdInput) partnerIdInput.value = partnerId;
        
        const partner = currentPartners.find(p => p.id === partnerId);
        if (partner) {
            populatePartnerForm(partner);
            // CRITICAL: Ensure ID is set after populating form
            if (partnerIdInput) partnerIdInput.value = partner.id || partnerId;
            modalTitle.textContent = 'Edit Partner';
        }
    } else {
        // Add mode
        modalTitle.textContent = 'Add New Partner';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Partner Modal
function closePartnerModal() {
    const modal = document.getElementById('partnerModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Populate Partner Form
function populatePartnerForm(partner) {
    document.getElementById('partnerId').value = partner.id;
    document.getElementById('partnerName').value = partner.name || '';
    document.getElementById('partnerWebsite').value = partner.website_url || '';
    document.getElementById('partnerDisplayOrder').value = partner.display_order || 0;
    document.getElementById('partnerIsActive').checked = partner.is_active !== false;

    // Load logo if exists
    if (partner.logo_url) {
        addPartnerLogoPreview(partner.logo_url, true);
    }
}

// Handle Partner Submit
async function handlePartnerSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    // Get partner ID from form data
    let partnerId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    if (!partnerId || partnerId === '' || partnerId === 'null') {
        const partnerIdInput = document.getElementById('partnerId');
        if (partnerIdInput && partnerIdInput.value) {
            partnerId = partnerIdInput.value;
        }
    }
    
    // Normalize partnerId
    if (partnerId) {
        partnerId = String(partnerId).trim();
        if (partnerId === '' || partnerId === 'null' || partnerId === 'undefined') {
            partnerId = null;
        }
    } else {
        partnerId = null;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Validate required fields
    const name = formData.get('name')?.trim();
    
    if (!name) {
        showNotification('Please fill in the partner name.', 'error');
        return;
    }
    
    // Get logos - extract URLs from logo previews
    const logoPreviews = document.querySelectorAll('#partnerLogoPreviewContainer .dashboard-image-preview');
    const logos = Array.from(logoPreviews).map(preview => {
        if (!preview) return null;
        const img = preview.querySelector('img');
        return img ? img.src : null;
    }).filter(Boolean);

    // Validate logo count (max 2)
    if (logos.length > 2) {
        showNotification('Maximum 2 logos allowed. Please remove extra logos.', 'error');
        return;
    }

    // For new partners, require at least one logo
    // For editing, if no new logos are added, don't update logo_url (keep existing)
    let logoUrl = null;
    if (logos.length > 0) {
        // Use first logo as logo_url (backend will convert base64 to file if needed)
        logoUrl = logos[0];
    } else if (!partnerId) {
        // New partner must have a logo
        showNotification('Please add at least one partner logo.', 'error');
        return;
    }
    // If editing and no new logos, logoUrl remains null and we won't include it in update

    const partnerData = {
        name: name,
        is_active: formData.get('is_active') === 'on',
        display_order: parseInt(formData.get('display_order') || '0')
    };
    
    // Only include website_url if it's a valid non-empty URL
    const websiteUrl = formData.get('website_url')?.trim();
    if (websiteUrl && websiteUrl.length > 0) {
        // Validate URL format
        try {
            new URL(websiteUrl);
            partnerData.website_url = websiteUrl;
        } catch (e) {
            showNotification('Please enter a valid website URL (e.g., https://example.com)', 'error');
            return;
        }
    }
    
    // Only include logo_url if a new logo is provided (for both create and update)
    if (logoUrl) {
        partnerData.logo_url = logoUrl;
    }

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (partnerId) {
            // Update existing partner
            response = await authenticatedFetch(`/api/partners/${partnerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(partnerData)
            });
        } else {
            // Create new partner
            response = await authenticatedFetch('/api/partners', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(partnerData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            // Handle validation errors - Pydantic returns detailed error info
            let errorMessage = 'Failed to save partner';
            if (errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    // Pydantic validation errors
                    const errors = errorData.detail.map(err => {
                        const field = err.loc ? err.loc.join('.') : 'field';
                        return `${field}: ${err.msg}`;
                    }).join(', ');
                    errorMessage = `Validation error: ${errors}`;
                } else if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else {
                    errorMessage = JSON.stringify(errorData.detail);
                }
            }
            throw new Error(errorMessage);
        }

        // Reload partners
        await loadPartners();
        closePartnerModal();
        
        // Show success message
        showNotification(partnerId ? 'Partner updated successfully!' : 'Partner added successfully!');
    } catch (error) {
        console.error('Error saving partner:', error);
        showNotification(error.message || 'Failed to save partner. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Edit Partner
function editPartner(id) {
    openPartnerModal(id);
}

// Delete Partner
function deletePartner(id) {
    // Update delete modal for partner
    const deleteModalTitle = document.getElementById('deleteModalTitle');
    const deleteModalMessage = document.getElementById('deleteModalMessage');
    if (deleteModalTitle) deleteModalTitle.textContent = 'Delete Partner';
    if (deleteModalMessage) deleteModalMessage.textContent = 'Are you sure you want to delete this partner? This action cannot be undone.';
    
    window.currentDeleteId = id;
    window.currentDeleteType = 'partner';
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Partner Search
function handlePartnerSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query.trim()) {
        renderPartners(currentPartners);
        return;
    }
    
    const filtered = currentPartners.filter(p => {
        const name = (p.name || '').toLowerCase();
        const website = (p.website_url || '').toLowerCase();
        
        return name.includes(query) || website.includes(query);
    });
    renderPartners(filtered);
}

// Partner Logo Handling
function handlePartnerLogoDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('partnerLogoUploadArea');
    if (area) area.classList.add('dragover');
}

function handlePartnerLogoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('partnerLogoUploadArea');
    if (area) area.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    handlePartnerLogoFiles(files);
}

function handlePartnerLogoSelect(e) {
    const files = e.target.files;
    handlePartnerLogoFiles(files);
}

async function handlePartnerLogoFiles(files) {
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/png', 'image/svg+xml'];
    const allowedExtensions = ['.png', '.svg'];
    
    // Check current logo count
    const currentLogos = document.querySelectorAll('#partnerLogoPreviewContainer .dashboard-image-preview');
    const remainingSlots = 2 - currentLogos.length;
    
    if (remainingSlots <= 0) {
        showNotification('Maximum 2 logos allowed. Please remove existing logos first.', 'error');
        return;
    }
    
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    for (const file of filesToProcess) {
        // Validate file type
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            showNotification(`File "${file.name}" is not a valid format. Please use PNG or SVG only.`, 'error');
            continue;
        }
        
        // Validate file size
        if (file.size > maxFileSize) {
            showNotification(`File "${file.name}" is too large. Maximum size is 5MB.`, 'error');
            continue;
        }
        
        // Read image file as base64
        const reader = new FileReader();
        reader.onload = (e) => {
            addPartnerLogoPreview(e.target.result, false);
        };
        reader.onerror = () => {
            showNotification(`Failed to read file "${file.name}".`, 'error');
        };
        reader.readAsDataURL(file);
    }
}

function addPartnerLogoPreview(imageSrc, isExisting) {
    const container = document.getElementById('partnerLogoPreviewContainer');
    const placeholder = document.getElementById('partnerLogoUploadPlaceholder');
    
    if (!container) return;

    // Check if we've reached the max (2 logos)
    const currentLogos = container.querySelectorAll('.dashboard-image-preview');
    if (currentLogos.length >= 2) {
        showNotification('Maximum 2 logos allowed.', 'error');
        return;
    }

    if (placeholder) placeholder.style.display = 'none';

    const preview = document.createElement('div');
    preview.className = 'dashboard-image-preview';
    preview.innerHTML = `
        <img src="${imageSrc}" alt="Partner logo" loading="lazy">
        <button type="button" class="dashboard-image-remove" onclick="removePartnerLogoPreview(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(preview);
}

function removePartnerLogoPreview(btn) {
    const preview = btn.closest('.dashboard-image-preview');
    if (preview) {
        preview.remove();
        const container = document.getElementById('partnerLogoPreviewContainer');
        const placeholder = document.getElementById('partnerLogoUploadPlaceholder');
        if (container && container.children.length === 0 && placeholder) {
            placeholder.style.display = 'flex';
        }
    }
}

function clearPartnerLogoPreviews() {
    const container = document.getElementById('partnerLogoPreviewContainer');
    const placeholder = document.getElementById('partnerLogoUploadPlaceholder');
    if (container) {
        container.innerHTML = '';
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    const fileInput = document.getElementById('partnerLogos');
    if (fileInput) fileInput.value = '';
}

// Confirm Delete - Immediately updates UI without page reload
async function confirmDelete() {
    const id = window.currentDeleteId;
    const type = window.currentDeleteType || 'property';
    if (!id) return;

    // Validate and sanitize ID - ensure it's a valid integer
    let sanitizedId = id;
    if (typeof id === 'string') {
        // Extract numeric part if ID contains non-numeric characters
        const numericMatch = id.match(/^\d+/);
        if (numericMatch) {
            sanitizedId = parseInt(numericMatch[0], 10);
        } else {
            console.error(`Invalid ID format: ${id}`);
            showNotification('Invalid property ID. Please try again.', 'error');
            return;
        }
    } else if (typeof id !== 'number') {
        sanitizedId = parseInt(id, 10);
        if (isNaN(sanitizedId)) {
            console.error(`Invalid ID format: ${id}`);
            showNotification('Invalid property ID. Please try again.', 'error');
            return;
        }
    }

    try {
        let response;
        if (type === 'testimonial') {
            response = await authenticatedFetch(`/api/testimonials/${sanitizedId}`, {
                method: 'DELETE'
            });
        } else if (type === 'partner') {
            response = await authenticatedFetch(`/api/partners/${sanitizedId}`, {
                method: 'DELETE'
            });
        } else if (type === 'blog') {
            response = await authenticatedFetch(`/api/blogs/${sanitizedId}`, {
                method: 'DELETE'
            });
        } else {
            response = await authenticatedFetch(`/api/properties/${sanitizedId}`, {
                method: 'DELETE'
            });
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Failed to delete ${type}`;
            try {
                const errorData = JSON.parse(text);
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    } else if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => {
                            const field = err.loc ? err.loc.join('.') : 'field';
                            return `${field}: ${err.msg}`;
                        }).join(', ');
                    } else {
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                } else {
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Close modal immediately
        closeDeleteModal();
        
        // Immediately update the UI without page reload
        if (type === 'property') {
            // Remove from currentProperties array for immediate UI update
            currentProperties = currentProperties.filter(p => p.id !== sanitizedId);
            // Re-render properties table immediately
            renderProperties(currentProperties);
            // Reload from database to ensure consistency and update stats
            await loadProperties(true);
        } else if (type === 'testimonial') {
            // Remove from currentTestimonials array
            currentTestimonials = currentTestimonials.filter(t => t.id !== sanitizedId);
            // Re-render testimonials table
            renderTestimonials(currentTestimonials);
        } else if (type === 'partner') {
            // Remove from currentPartners array
            currentPartners = currentPartners.filter(p => p.id !== sanitizedId);
            // Re-render partners table
            renderPartners(currentPartners);
        } else if (type === 'blog') {
            // Remove from currentBlogs array
            currentBlogs = currentBlogs.filter(b => b.id !== sanitizedId);
            // Re-render blogs table
            renderBlogs(currentBlogs);
        }
        
        // Show success notification
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`, 'success');
    } catch (error) {
        console.error(`Error deleting ${type}:`, error);
        showNotification(error.message || `Failed to delete ${type}. Please try again.`, 'error');
    }
}

// ============================================
// BLOGS MANAGEMENT
// ============================================

// Store currently loaded blogs for search
let currentBlogs = [];

// Quill editor instance for blog content
let blogContentEditor = null;

// Load Blogs from API
async function loadBlogs() {
    try {
        // Fetch all blogs (both active and inactive) for admin dashboard
        // API has max limit of 100, so we need to fetch multiple pages if needed
        let allBlogs = [];
        let page = 1;
        let hasMore = true;
        const limit = 100; // Maximum allowed by API
        
        while (hasMore) {
            const response = await fetch(`/api/blogs?limit=${limit}&page=${page}`);
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = typeof errorData.detail === 'string' 
                            ? errorData.detail 
                            : JSON.stringify(errorData.detail);
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else {
                        errorMessage = JSON.stringify(errorData);
                    }
                } catch (e) {
                    // If JSON parsing fails, use the status text
                    errorMessage = `Failed to fetch blogs: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            const blogs = data.items || [];
            allBlogs = allBlogs.concat(blogs);
            
            // Check if there are more pages
            hasMore = page < (data.pages || 1) && blogs.length === limit;
            page++;
        }
        
        // Store blogs for search functionality
        currentBlogs = allBlogs;
        renderBlogs(allBlogs);
    } catch (error) {
        console.error('Error loading blogs:', error);
        // Extract error message properly
        let errorMessage = 'Failed to load blogs from server.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            errorMessage = error.message || error.detail || JSON.stringify(error);
        }
        showNotification(errorMessage, 'error');
    }
}

// Render Blogs
function renderBlogs(blogs) {
    const tbody = document.getElementById('blogsTableBody');
    
    if (!tbody) return;

    if (blogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No blogs found</td></tr>';
        return;
    }

    tbody.innerHTML = blogs.map(blog => {
        // Parse tags if they're a JSON string
        let tags = [];
        if (blog.tags) {
            if (Array.isArray(blog.tags)) {
                tags = blog.tags;
            } else if (typeof blog.tags === 'string') {
                try {
                    tags = JSON.parse(blog.tags);
                } catch (e) {
                    tags = [];
                }
            }
        }
        
        // Format date
        const createdDate = blog.created_at ? new Date(blog.created_at).toLocaleDateString() : 'N/A';
        
        // Truncate title for table display
        const title = blog.title || 'Untitled';
        const truncatedTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;
        
        return `
        <tr>
            <td>
                <div class="dashboard-table-image">
                    ${blog.image_url 
                        ? `<img src="${escapeHtml(blog.image_url)}" alt="${escapeHtml(title)}" style="max-width: 80px; max-height: 60px; object-fit: cover; border-radius: 4px;" loading="lazy" onerror="this.style.display='none'; const fallback = this.nextElementSibling; if (fallback && fallback.style) fallback.style.display='flex';">
                    <div style="width: 80px; height: 60px; background: #f3f4f6; display: none; align-items: center; justify-content: center; color: #9ca3af; border-radius: 4px; font-size: 0.75rem;">No Image</div>`
                        : '<div style="width: 80px; height: 60px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; border-radius: 4px; font-size: 0.75rem;">No Image</div>'
                    }
                </div>
            </td>
            <td>
                <div class="dashboard-table-title" title="${escapeHtml(title)}">${escapeHtml(truncatedTitle)}</div>
            </td>
            <td>
                <span class="dashboard-table-type">${escapeHtml(formatCategory(blog.category || 'N/A'))}</span>
            </td>
            <td>
                <div class="dashboard-table-location">${escapeHtml(blog.author || 'N/A')}</div>
            </td>
            <td>
                <div class="dashboard-table-location">${Number(blog.views ?? 0).toLocaleString()}</div>
            </td>
            <td>
                <span class="dashboard-status ${blog.is_active ? 'active' : 'inactive'}">
                    ${blog.is_active ? 'Active' : 'Inactive'}
                </span>
                ${blog.is_featured ? '<span class="dashboard-status featured" style="margin-left: 0.5rem;">Featured</span>' : ''}
            </td>
            <td>
                <div class="dashboard-table-location">${createdDate}</div>
            </td>
            <td>
                <div class="dashboard-table-actions">
                    <button class="dashboard-action-btn edit" onclick="editBlog(${blog.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="dashboard-action-btn delete" onclick="deleteBlog(${blog.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Format category name
function formatCategory(category) {
    if (!category || category === 'N/A') return 'N/A';
    return category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Initialize Blog Content Editor
function initBlogContentEditor() {
    const editorContainer = document.getElementById('blogContentEditor');
    if (!editorContainer) return;

    // Lazy load Quill if not already loaded
    if (typeof Quill === 'undefined') {
        if (window.loadQuillEditor) {
            window.loadQuillEditor();
            // Wait for Quill to load, then initialize
            const checkQuill = setInterval(() => {
                if (typeof Quill !== 'undefined') {
                    clearInterval(checkQuill);
                    initializeQuillEditor();
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => clearInterval(checkQuill), 5000);
        } else {
            console.error('Quill.js not available');
            return;
        }
    } else {
        initializeQuillEditor();
    }
}

function initializeQuillEditor() {
    const editorContainer = document.getElementById('blogContentEditor');
    if (!editorContainer) return;

    // Initialize Quill editor with formatting toolbar
    blogContentEditor = new Quill('#blogContentEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['blockquote', 'code-block'],
                ['clean']
            ]
        },
        placeholder: 'Enter your blog content here...'
    });

    // Sync editor content with hidden textarea on text change
    blogContentEditor.on('text-change', function() {
        const content = blogContentEditor.root.innerHTML;
        const textarea = document.getElementById('blogContent');
        if (textarea) {
            textarea.value = content;
        }
    });
}

// Open Blog Modal
function openBlogModal(blogId = null) {
    const modal = document.getElementById('blogModal');
    const form = document.getElementById('blogForm');
    const modalTitle = document.getElementById('blogModalTitle');
    
    if (!modal || !form) return;

    // Lazy load Quill editor when modal opens
    if (window.loadQuillEditor && typeof Quill === 'undefined') {
        window.loadQuillEditor();
    }

    // Get blog ID input reference BEFORE resetting form
    const blogIdInput = document.getElementById('blogId');
    const tempBlogId = blogId;
    
    // Reset form (this clears all inputs including hidden blogId)
    form.reset();
    
    // CRITICAL FIX: Restore blog ID immediately after reset if in edit mode
    if (tempBlogId && blogIdInput) {
        blogIdInput.value = tempBlogId;
    } else if (blogIdInput) {
        blogIdInput.value = '';
    }
    
    document.getElementById('blogAuthor').value = 'Tirumakudalu Properties';
    document.getElementById('blogIsActive').checked = true;
    clearBlogTags();
    clearBlogImagePreview();
    
    // Clear editor content
    if (blogContentEditor) {
        blogContentEditor.setContents([]);
    }

    if (blogId) {
        // Edit mode - ensure ID is set, then find blog from current list
        if (blogIdInput) blogIdInput.value = blogId;
        
        const blog = currentBlogs.find(b => b.id === blogId);
        if (blog) {
            populateBlogForm(blog);
            // CRITICAL: Ensure ID is set after populating form
            if (blogIdInput) blogIdInput.value = blog.id || blogId;
            modalTitle.textContent = 'Edit Blog';
        }
    } else {
        // Add mode
        modalTitle.textContent = 'Add New Blog';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Blog Modal
function closeBlogModal() {
    const modal = document.getElementById('blogModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Populate Blog Form
function populateBlogForm(blog) {
    document.getElementById('blogId').value = blog.id;
    document.getElementById('blogTitle').value = blog.title || '';
    document.getElementById('blogCategory').value = blog.category || '';
    document.getElementById('blogAuthor').value = blog.author || 'Tirumakudalu Properties';
    document.getElementById('blogExcerpt').value = blog.excerpt || '';
    
    // Set content in editor
    if (blogContentEditor && blog.content) {
        blogContentEditor.root.innerHTML = blog.content;
        // Sync with hidden textarea
        const textarea = document.getElementById('blogContent');
        if (textarea) {
            textarea.value = blog.content;
        }
    } else if (blogContentEditor) {
        blogContentEditor.setContents([]);
    }
    
    document.getElementById('blogIsFeatured').checked = blog.is_featured || false;
    document.getElementById('blogIsActive').checked = blog.is_active !== undefined ? blog.is_active : true;
    
    // Load image if exists
    if (blog.image_url) {
        // Normalize image URL
        let imageUrl = blog.image_url;
        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            if (!imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
            }
        }
        addBlogImagePreview(imageUrl, true);
    }
    
    // Parse and populate tags
    let tags = [];
    if (blog.tags) {
        if (Array.isArray(blog.tags)) {
            tags = blog.tags;
        } else if (typeof blog.tags === 'string') {
            try {
                tags = JSON.parse(blog.tags);
            } catch (e) {
                tags = [];
            }
        }
    }
    renderBlogTags(tags);
}

// Render Blog Tags
function renderBlogTags(tags) {
    const tagsList = document.getElementById('blogTagsList');
    if (!tagsList) return;
    
    if (tags.length === 0) {
        tagsList.innerHTML = '';
        return;
    }
    
    tagsList.innerHTML = tags.map(tag => `
        <div class="dashboard-feature-item">
            <span>${escapeHtml(tag)}</span>
            <button type="button" class="dashboard-feature-remove" onclick="removeBlogTag(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Clear Blog Tags
function clearBlogTags() {
    const tagsList = document.getElementById('blogTagsList');
    if (tagsList) {
        tagsList.innerHTML = '';
    }
    const tagInput = document.getElementById('blogTagInput');
    if (tagInput) {
        tagInput.value = '';
    }
}

// Add Blog Tag
function addBlogTag() {
    const tagInput = document.getElementById('blogTagInput');
    if (!tagInput) return;
    
    const tag = tagInput.value.trim();
    if (!tag) return;
    
    const tagsList = document.getElementById('blogTagsList');
    if (!tagsList) return;
    
    // Check if tag already exists
    const existingTags = Array.from(tagsList.querySelectorAll('.dashboard-feature-item span')).map(span => span.textContent.trim());
    if (existingTags.includes(tag)) {
        showNotification('Tag already exists.', 'error');
        return;
    }
    
    // Add tag
    const tagItem = document.createElement('div');
    tagItem.className = 'dashboard-feature-item';
    tagItem.innerHTML = `
        <span>${escapeHtml(tag)}</span>
        <button type="button" class="dashboard-feature-remove" onclick="removeBlogTag(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    tagsList.appendChild(tagItem);
    tagInput.value = '';
}

// Remove Blog Tag
function removeBlogTag(btn) {
    const tagItem = btn.closest('.dashboard-feature-item');
    if (tagItem) {
        tagItem.remove();
    }
}

// Get Blog Tags from Form
function getBlogTagsFromForm() {
    const tagsList = document.getElementById('blogTagsList');
    if (!tagsList) return [];
    
    const tagItems = tagsList.querySelectorAll('.dashboard-feature-item span');
    return Array.from(tagItems).map(span => span.textContent.trim()).filter(tag => tag.length > 0);
}

// Handle Blog Submit
async function handleBlogSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    // Get blog ID from form data
    let blogId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    if (!blogId || blogId === '' || blogId === 'null') {
        const blogIdInput = document.getElementById('blogId');
        if (blogIdInput && blogIdInput.value) {
            blogId = blogIdInput.value;
        }
    }
    
    // Normalize blogId
    if (blogId) {
        blogId = String(blogId).trim();
        if (blogId === '' || blogId === 'null' || blogId === 'undefined') {
            blogId = null;
        }
    } else {
        blogId = null;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Validate required fields
    const title = formData.get('title')?.trim();
    const excerpt = formData.get('excerpt')?.trim();
    
    // Get content from editor
    let content = '';
    if (blogContentEditor) {
        content = blogContentEditor.root.innerHTML.trim();
        // Also update hidden textarea
        const textarea = document.getElementById('blogContent');
        if (textarea) {
            textarea.value = content;
        }
    } else {
        content = formData.get('content')?.trim() || '';
    }
    
    if (!title || !excerpt || !content) {
        showNotification('Please fill in all required fields (Title, Excerpt, and Content).', 'error');
        return;
    }
    
    // Check if content is just empty HTML tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    if (tempDiv.textContent.trim().length === 0) {
        showNotification('Please add some content to your blog post.', 'error');
        return;
    }

    // Get tags
    const tags = getBlogTagsFromForm();
    
    // Get image from preview
    const imagePreview = document.querySelector('#blogImagePreviewContainer .dashboard-image-preview img');
    let imageUrl = null;
    if (imagePreview) {
        imageUrl = imagePreview.src;
        // Validate base64 data URL size if it's a new upload
        if (imageUrl.startsWith('data:') && imageUrl.length > 5000000) {
            showNotification('Image is too large. Please use a smaller image (max 5MB).', 'error');
            return;
        }
    }
    
    // For new blogs, require an image
    if (!blogId && !imageUrl) {
        showNotification('Please add a blog image.', 'error');
        return;
    }
    
    // Get optional fields
    const category = formData.get('category')?.trim() || null;
    const author = formData.get('author')?.trim() || 'Tirumakudalu Properties';
    const isFeatured = formData.get('is_featured') === 'on';
    const isActive = formData.get('is_active') === 'on';
    
    const blogData = {
        title: title,
        excerpt: excerpt,
        content: content,
        category: category,
        tags: tags,
        author: author,
        image_url: imageUrl,
        is_featured: isFeatured,
        is_active: isActive
    };

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (blogId) {
            // Update existing blog
            response = await authenticatedFetch(`/api/blogs/${blogId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(blogData)
            });
        } else {
            // Create new blog
            response = await authenticatedFetch('/api/blogs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(blogData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = 'Failed to save blog';
            if (errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map(err => {
                        const field = err.loc ? err.loc.join('.') : 'field';
                        return `${field}: ${err.msg}`;
                    }).join(', ');
                } else {
                    errorMessage = errorData.detail;
                }
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
            throw new Error(errorMessage);
        }

        // Reload blogs
        await loadBlogs();
        closeBlogModal();
        
        // Show success message
        showNotification(blogId ? 'Blog updated successfully!' : 'Blog added successfully!');
    } catch (error) {
        console.error('Error saving blog:', error);
        showNotification(error.message || 'Failed to save blog. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Edit Blog
function editBlog(id) {
    openBlogModal(id);
}

// Delete Blog
function deleteBlog(id) {
    if (!confirm('Are you sure you want to delete this blog?')) {
        return;
    }
    
    // Update delete modal for blog
    const deleteModalTitle = document.getElementById('deleteModalTitle');
    const deleteModalMessage = document.getElementById('deleteModalMessage');
    if (deleteModalTitle) deleteModalTitle.textContent = 'Delete Blog';
    if (deleteModalMessage) deleteModalMessage.textContent = 'Are you sure you want to delete this blog? This action cannot be undone.';
    
    window.currentDeleteId = id;
    window.currentDeleteType = 'blog';
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Blog Search
function handleBlogSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query.trim()) {
        renderBlogs(currentBlogs);
        return;
    }
    
    const filtered = currentBlogs.filter(blog => {
        const title = (blog.title || '').toLowerCase();
        const excerpt = (blog.excerpt || '').toLowerCase();
        const content = (blog.content || '').toLowerCase();
        const category = (blog.category || '').toLowerCase();
        const author = (blog.author || '').toLowerCase();
        
        // Check tags
        let tags = [];
        if (blog.tags) {
            if (Array.isArray(blog.tags)) {
                tags = blog.tags;
            } else if (typeof blog.tags === 'string') {
                try {
                    tags = JSON.parse(blog.tags);
                } catch (e) {
                    tags = [];
                }
            }
        }
        const tagsStr = tags.join(' ').toLowerCase();
        
        return title.includes(query) || excerpt.includes(query) || content.includes(query) || 
               category.includes(query) || author.includes(query) || tagsStr.includes(query);
    });
    renderBlogs(filtered);
}

// Blog Image Upload Handlers
function handleBlogImageDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('blogImageUploadArea');
    if (area) area.classList.add('dragover');
}

function handleBlogImageDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const area = document.getElementById('blogImageUploadArea');
    if (area) area.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    handleBlogImageFiles(files);
}

function handleBlogImageSelect(e) {
    const files = e.target.files;
    handleBlogImageFiles(files);
}

async function handleBlogImageFiles(files) {
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    // Only process the first file (single image for blog)
    const file = files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/') || !allowedTypes.includes(file.type)) {
        showNotification(`File "${file.name}" is not a valid image format. Please use JPG, PNG, GIF, or WebP.`, 'error');
        return;
    }
    
    // Validate file size
    if (file.size > maxFileSize) {
        showNotification(`File "${file.name}" is too large. Maximum size is 5MB.`, 'error');
        return;
    }
    
    // Clear existing preview first (only one image allowed)
    clearBlogImagePreview();
    
    // Read image file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
        addBlogImagePreview(e.target.result, false);
    };
    reader.onerror = () => {
        showNotification(`Failed to read file "${file.name}".`, 'error');
    };
    reader.readAsDataURL(file);
}

function addBlogImagePreview(imageSrc, isExisting) {
    const container = document.getElementById('blogImagePreviewContainer');
    const placeholder = document.getElementById('blogImageUploadPlaceholder');
    
    if (!container) return;

    if (placeholder) placeholder.style.display = 'none';

    const preview = document.createElement('div');
    preview.className = 'dashboard-image-preview';
    preview.innerHTML = `
        <img src="${imageSrc}" alt="Blog image" loading="lazy">
        <button type="button" class="dashboard-image-remove" onclick="removeBlogImagePreview(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(preview);
}

function removeBlogImagePreview(btn) {
    const preview = btn.closest('.dashboard-image-preview');
    if (preview) {
        preview.remove();
        const container = document.getElementById('blogImagePreviewContainer');
        const placeholder = document.getElementById('blogImageUploadPlaceholder');
        if (container && container.children.length === 0 && placeholder) {
            placeholder.style.display = 'flex';
        }
    }
    // Clear file input
    const fileInput = document.getElementById('blogImage');
    if (fileInput) fileInput.value = '';
}

function clearBlogImagePreview() {
    const container = document.getElementById('blogImagePreviewContainer');
    const placeholder = document.getElementById('blogImageUploadPlaceholder');
    if (container) {
        container.innerHTML = '';
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    const fileInput = document.getElementById('blogImage');
    if (fileInput) fileInput.value = '';
}

// Make blog functions globally available
window.editBlog = editBlog;
window.deleteBlog = deleteBlog;
window.removeBlogTag = removeBlogTag;
window.removeBlogImagePreview = removeBlogImagePreview;

// Make functions globally available (set immediately, not waiting for DOMContentLoaded)
window.editProperty = editProperty;
window.deleteProperty = deleteProperty;
window.updateInquiryStatus = updateInquiryStatus;

// Also ensure editProperty is available as a direct reference
if (typeof window.editProperty === 'undefined') {
    window.editProperty = editProperty;
}

// ============================================
// INQUIRIES MANAGEMENT
// ============================================

// Load Inquiries from API
async function loadInquiries(forceRefresh = false) {
    try {
        console.log('Loading inquiries from API...');
        // Add cache-busting timestamp if force refresh is requested
        const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : '';
        
        const fetchOptions = forceRefresh ? {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        } : {};
        
        const response = await authenticatedFetch(`/api/admin/inquiries${cacheBuster}`, fetchOptions);
        
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
                } else {
                    const text = await response.text();
                    if (text) {
                        errorMessage = `${errorMessage} - ${text.substring(0, 100)}`;
                    }
                }
            } catch (parseError) {
                console.warn('Could not parse error response:', parseError);
            }
            
            console.error('Failed to fetch inquiries:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const inquiries = await response.json();
        
        // Store inquiries for search
        currentInquiries = inquiries;
        
        // Render inquiries
        renderInquiries(inquiries);
    } catch (error) {
        console.error('Error loading inquiries:', error);
        const errorMsg = error.message || 'Failed to load inquiries from server.';
        showNotification(errorMsg, 'error');
    }
}

// Render Inquiries
function renderInquiries(inquiries) {
    // Separate inquiries by type
    const contactAgentInquiries = inquiries.filter(inq => 
        inq.property_id && inq.subject && inq.subject.toLowerCase() === 'contact agent'
    );
    // Filter schedule visit inquiries and exclude closed ones
    const scheduleVisitInquiries = inquiries.filter(inq => 
        inq.subject && inq.subject.toLowerCase() === 'schedule visit' && inq.status !== 'closed'
    );
    // Filter contact inquiries (exclude schedule visit and contact agent)
    const contactInquiries = inquiries.filter(inq => {
        const subject = inq.subject ? inq.subject.toLowerCase() : '';
        return subject !== 'schedule visit' && 
               !(inq.property_id && subject === 'contact agent');
    });
    
    // Render Contact Agent inquiries
    renderContactAgentInquiries(contactAgentInquiries);
    
    // Render Schedule Visit inquiries (closed ones are already filtered out)
    renderScheduleVisitInquiries(scheduleVisitInquiries);
    
    // Render Contact Inquiries
    renderContactInquiries(contactInquiries);
}

// Render Contact Agent Inquiries
function renderContactAgentInquiries(inquiries) {
    const tbody = document.getElementById('contactAgentTableBody');
    if (!tbody) return;
    
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No contact agent inquiries found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = inquiries.map(inquiry => {
        const date = new Date(inquiry.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = inquiry.status === 'new' ? 'new' : 
                           inquiry.status === 'read' ? 'read' : 
                           inquiry.status === 'replied' ? 'replied' : 'closed';
        
        const statusBadge = `<span class="status-badge ${statusClass}">${inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}</span>`;
        
        // Get property title if available
        const propertyTitle = inquiry.property_id ? 
            (currentProperties.find(p => p.id === inquiry.property_id)?.title || `Property #${inquiry.property_id}`) : 
            'N/A';
        
        // Truncate message
        const messagePreview = inquiry.message.length > 100 ? 
            inquiry.message.substring(0, 100) + '...' : 
            inquiry.message;
        
        return `
            <tr>
                <td>${inquiry.name}</td>
                <td><a href="mailto:${inquiry.email}">${inquiry.email}</a></td>
                <td>${inquiry.phone || 'N/A'}</td>
                <td>${propertyTitle}</td>
                <td title="${inquiry.message.replace(/"/g, '&quot;')}">${messagePreview}</td>
                <td>${date}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="dashboard-action-buttons">
                        <select class="dashboard-status-select" onchange="updateInquiryStatus(${inquiry.id}, this.value)" data-inquiry-id="${inquiry.id}">
                            <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>New</option>
                            <option value="read" ${inquiry.status === 'read' ? 'selected' : ''}>Read</option>
                            <option value="replied" ${inquiry.status === 'replied' ? 'selected' : ''}>Replied</option>
                            <option value="closed" ${inquiry.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Schedule Visit Inquiries
function renderScheduleVisitInquiries(inquiries) {
    const tbody = document.getElementById('scheduleVisitTableBody');
    if (!tbody) return;
    
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No schedule visit requests found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = inquiries.map(inquiry => {
        const date = new Date(inquiry.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = inquiry.status === 'new' ? 'new' : 
                           inquiry.status === 'read' ? 'read' : 
                           inquiry.status === 'replied' ? 'replied' : 'closed';
        
        const statusBadge = `<span class="status-badge ${statusClass}">${inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}</span>`;
        
        // Get property title if available
        const propertyTitle = inquiry.property_id ? 
            (currentProperties.find(p => p.id === inquiry.property_id)?.title || `Property #${inquiry.property_id}`) : 
            'N/A';
        
        // Extract visit details from message
        const visitDetails = extractVisitDetails(inquiry.message);
        
        const ipAddress = inquiry.ip_address || '<span style="color: var(--text-light); font-style: italic;">N/A</span>';
        
        return `
            <tr>
                <td>${inquiry.name}</td>
                <td><a href="mailto:${inquiry.email}">${inquiry.email}</a></td>
                <td>${inquiry.phone || 'N/A'}</td>
                <td>${propertyTitle}</td>
                <td title="${inquiry.message.replace(/"/g, '&quot;')}">${visitDetails}</td>
                <td>${ipAddress}</td>
                <td>${date}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="dashboard-action-buttons">
                        <select class="dashboard-status-select" onchange="updateInquiryStatus(${inquiry.id}, this.value)" data-inquiry-id="${inquiry.id}">
                            <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>New</option>
                            <option value="read" ${inquiry.status === 'read' ? 'selected' : ''}>Read</option>
                            <option value="replied" ${inquiry.status === 'replied' ? 'selected' : ''}>Replied</option>
                            <option value="closed" ${inquiry.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Extract visit details from message
function extractVisitDetails(message) {
    if (!message) return 'N/A';
    
    // Look for date and time patterns
    const dateMatch = message.match(/Preferred Date:\s*(.+)/i);
    const timeMatch = message.match(/Preferred Time:\s*(.+)/i);
    
    if (dateMatch && timeMatch) {
        return `${dateMatch[1].trim()} at ${timeMatch[1].trim()}`;
    } else if (dateMatch) {
        return dateMatch[1].trim();
    } else {
        // Return first line or truncated message
        const firstLine = message.split('\n')[0];
        return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to get property title
async function getPropertyTitle(propertyId) {
    if (!propertyId) return 'N/A';
    
    // First check if property is in currentProperties
    const property = currentProperties.find(p => p.id === propertyId);
    if (property && property.title) {
        return property.title;
    }
    
    // If not found, try to fetch it from API
    try {
        const response = await authenticatedFetch(`/api/properties/${propertyId}`);
        if (response.ok) {
            const prop = await response.json();
            if (prop.title) {
                // Cache it in currentProperties for future use
                if (!currentProperties.find(p => p.id === propertyId)) {
                    currentProperties.push(prop);
                }
                return prop.title;
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch property ${propertyId}:`, error);
    }
    
    return `Property #${propertyId}`;
}

// Render Contact Inquiries
function renderContactInquiries(inquiries) {
    const tbody = document.getElementById('contactInquiryTableBody');
    if (!tbody) {
        console.warn('Contact inquiry table body not found');
        return;
    }
    
    if (!inquiries || inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No contact inquiries found.</td></tr>';
        return;
    }
    
    // Render inquiries with property titles
    tbody.innerHTML = inquiries.map(inquiry => {
        try {
            const date = new Date(inquiry.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const statusClass = inquiry.status === 'new' ? 'new' : 
                               inquiry.status === 'read' ? 'read' : 
                               inquiry.status === 'replied' ? 'replied' : 'closed';
            
            const statusBadge = `<span class="status-badge ${statusClass}">${inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}</span>`;
            
            // Get property title if available
            const propertyTitle = inquiry.property_id ? 
                (currentProperties.find(p => p.id === inquiry.property_id)?.title || `Property #${inquiry.property_id}`) : 
                'N/A';
            
            // Truncate message
            const messagePreview = inquiry.message && inquiry.message.length > 100 ? 
                inquiry.message.substring(0, 100) + '...' : 
                (inquiry.message || 'No message');
            
            const subject = inquiry.subject || 'N/A';
            const phone = inquiry.phone || 'N/A';
            const ipAddress = inquiry.ip_address || '<span style="color: var(--text-light); font-style: italic;">N/A</span>';
            
            // Escape HTML in message for tooltip
            const messageTooltip = (inquiry.message || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            return `
                <tr>
                    <td>${escapeHtml(inquiry.name || 'N/A')}</td>
                    <td><a href="mailto:${inquiry.email || ''}">${escapeHtml(inquiry.email || 'N/A')}</a></td>
                    <td>${escapeHtml(phone)}</td>
                    <td>${escapeHtml(subject)}</td>
                    <td title="${messageTooltip}">${escapeHtml(messagePreview)}</td>
                    <td>${escapeHtml(propertyTitle)}</td>
                    <td>${ipAddress}</td>
                    <td>${date}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="dashboard-action-buttons" style="display: flex; gap: 0.5rem; align-items: center;">
                            <button class="dashboard-btn-view" onclick="viewContactInquiry(${inquiry.id})" title="View Details" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                <i class="fas fa-eye"></i>
                            </button>
                            <select class="dashboard-status-select" onchange="updateInquiryStatus(${inquiry.id}, this.value)" data-inquiry-id="${inquiry.id}">
                                <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>New</option>
                                <option value="read" ${inquiry.status === 'read' ? 'selected' : ''}>Read</option>
                                <option value="replied" ${inquiry.status === 'replied' ? 'selected' : ''}>Replied</option>
                                <option value="closed" ${inquiry.status === 'closed' ? 'selected' : ''}>Closed</option>
                            </select>
                        </div>
                    </td>
                </tr>
            `;
        } catch (error) {
            console.error('Error rendering inquiry:', inquiry, error);
            return `<tr><td colspan="10" style="color: red;">Error rendering inquiry: ${error.message}</td></tr>`;
        }
    }).join('');
}

// Update Inquiry Status
async function updateInquiryStatus(inquiryId, newStatus) {
    try {
        const response = await authenticatedFetch(`/api/admin/inquiries/${inquiryId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update inquiry status');
        }
        
        // Reload inquiries to reflect the change with force refresh
        await loadInquiries(true);
        showNotification('Inquiry status updated successfully.', 'success');
    } catch (error) {
        console.error('Error updating inquiry status:', error);
        showNotification('Failed to update inquiry status.', 'error');
        // Reload to reset the select with force refresh
        await loadInquiries(true);
    }
}

// Search Handlers
function handleContactAgentSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const contactAgentInquiries = currentInquiries.filter(inq => 
        inq.property_id && inq.subject && inq.subject.toLowerCase() === 'contact agent'
    );
    
    const filtered = contactAgentInquiries.filter(inq => 
        inq.name.toLowerCase().includes(searchTerm) ||
        inq.email.toLowerCase().includes(searchTerm) ||
        (inq.phone && inq.phone.toLowerCase().includes(searchTerm)) ||
        inq.message.toLowerCase().includes(searchTerm)
    );
    
    renderContactAgentInquiries(filtered);
}

function handleScheduleVisitSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    // Filter schedule visit inquiries and exclude closed ones
    const scheduleVisitInquiries = currentInquiries.filter(inq => 
        inq.subject && inq.subject.toLowerCase() === 'schedule visit' && inq.status !== 'closed'
    );
    
    const filtered = scheduleVisitInquiries.filter(inq => 
        inq.name.toLowerCase().includes(searchTerm) ||
        inq.email.toLowerCase().includes(searchTerm) ||
        (inq.phone && inq.phone.toLowerCase().includes(searchTerm)) ||
        inq.message.toLowerCase().includes(searchTerm)
    );
    
    renderScheduleVisitInquiries(filtered);
}

function handleContactInquirySearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    // Filter contact inquiries (exclude schedule visit and contact agent)
    const contactInquiries = currentInquiries.filter(inq => {
        const subject = inq.subject ? inq.subject.toLowerCase() : '';
        return subject !== 'schedule visit' && 
               !(inq.property_id && subject === 'contact agent');
    });
    
    const filtered = contactInquiries.filter(inq => 
        inq.name.toLowerCase().includes(searchTerm) ||
        inq.email.toLowerCase().includes(searchTerm) ||
        (inq.phone && inq.phone.toLowerCase().includes(searchTerm)) ||
        (inq.subject && inq.subject.toLowerCase().includes(searchTerm)) ||
        inq.message.toLowerCase().includes(searchTerm)
    );
    
    renderContactInquiries(filtered);
}

// View Contact Inquiry Modal
async function viewContactInquiry(inquiryId) {
    try {
        // Find the inquiry in currentInquiries
        const inquiry = currentInquiries.find(inq => inq.id === inquiryId);
        
        if (!inquiry) {
            // If not found, fetch from API
            const response = await authenticatedFetch(`/api/admin/inquiries/${inquiryId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch inquiry details');
            }
            const fetchedInquiry = await response.json();
            populateContactInquiryModal(fetchedInquiry);
        } else {
            populateContactInquiryModal(inquiry);
        }
        
        // Open modal
        const modal = document.getElementById('contactInquiryViewModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Error viewing contact inquiry:', error);
        showNotification('Failed to load inquiry details.', 'error');
    }
}

// Populate Contact Inquiry Modal with data
function populateContactInquiryModal(inquiry) {
    // Format dates
    const createdDate = new Date(inquiry.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const updatedDate = inquiry.updated_at ? 
        new Date(inquiry.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : createdDate;
    
    // Get property title
    const propertyTitle = inquiry.property_id ? 
        (currentProperties.find(p => p.id === inquiry.property_id)?.title || `Property #${inquiry.property_id}`) : 
        'N/A (General Inquiry)';
    
    // Set status badge
    const statusClass = inquiry.status === 'new' ? 'new' : 
                       inquiry.status === 'read' ? 'read' : 
                       inquiry.status === 'replied' ? 'replied' : 'closed';
    const statusText = inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1);
    
    // Populate fields
    document.getElementById('contactInquiryViewStatus').textContent = statusText;
    document.getElementById('contactInquiryViewStatus').className = `status-badge ${statusClass}`;
    document.getElementById('contactInquiryViewName').textContent = inquiry.name || 'N/A';
    
    const emailLink = document.getElementById('contactInquiryViewEmail');
    emailLink.textContent = inquiry.email || 'N/A';
    emailLink.href = inquiry.email ? `mailto:${inquiry.email}` : '#';
    
    document.getElementById('contactInquiryViewPhone').textContent = inquiry.phone || 'N/A';
    document.getElementById('contactInquiryViewSubject').textContent = inquiry.subject || 'N/A';
    document.getElementById('contactInquiryViewProperty').textContent = propertyTitle;
    document.getElementById('contactInquiryViewIpAddress').textContent = inquiry.ip_address || 'N/A';
    document.getElementById('contactInquiryViewDate').textContent = createdDate;
    document.getElementById('contactInquiryViewUpdated').textContent = updatedDate;
    
    // Set message (preserve line breaks)
    const messageBox = document.getElementById('contactInquiryViewMessage');
    if (inquiry.message) {
        messageBox.textContent = inquiry.message;
    } else {
        messageBox.textContent = 'No message provided.';
    }
    
    // Set status select
    const statusSelect = document.getElementById('contactInquiryViewStatusSelect');
    if (statusSelect) {
        statusSelect.value = inquiry.status || 'new';
    }
    
    // Store inquiry ID for update
    statusSelect.dataset.inquiryId = inquiry.id;
}

// Close Contact Inquiry View Modal
function closeContactInquiryViewModal() {
    const modal = document.getElementById('contactInquiryViewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Update status from view modal
async function updateContactInquiryStatusFromModal() {
    const statusSelect = document.getElementById('contactInquiryViewStatusSelect');
    if (!statusSelect) return;
    
    const inquiryId = statusSelect.dataset.inquiryId;
    const newStatus = statusSelect.value;
    
    if (!inquiryId) {
        showNotification('Invalid inquiry ID.', 'error');
        return;
    }
    
    try {
        await updateInquiryStatus(inquiryId, newStatus);
        // Update the status badge in the modal
        const statusBadge = document.getElementById('contactInquiryViewStatus');
        const statusClass = newStatus === 'new' ? 'new' : 
                           newStatus === 'read' ? 'read' : 
                           newStatus === 'replied' ? 'replied' : 'closed';
        const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        statusBadge.textContent = statusText;
        statusBadge.className = `status-badge ${statusClass}`;
    } catch (error) {
        console.error('Error updating status from modal:', error);
    }
}

// Make functions globally available
window.viewContactInquiry = viewContactInquiry;

// ============================================
// VISITOR INFO MANAGEMENT
// ============================================

// Load Visitor Info from API
async function loadVisitorInfo() {
    try {
        const response = await authenticatedFetch('/api/admin/visitor-info');
        
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
                } else {
                    const text = await response.text();
                    if (text) {
                        errorMessage = `${errorMessage} - ${text.substring(0, 100)}`;
                    }
                }
            } catch (parseError) {
                console.warn('Could not parse error response:', parseError);
            }
            
            console.error('Failed to fetch visitor info:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const visitors = await response.json();
        
        // Store visitors for search
        currentVisitors = visitors;
        
        // Render visitors
        renderVisitorInfo(visitors);
    } catch (error) {
        console.error('Error loading visitor info:', error);
        const errorMsg = error.message || 'Failed to load visitor info from server.';
        showNotification(errorMsg, 'error');
    }
}

// Render Visitor Info
function renderVisitorInfo(visitors) {
    const tbody = document.getElementById('visitorInfoTableBody');
    if (!tbody) return;
    
    if (visitors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No visitor information found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = visitors.map(visitor => {
        const date = new Date(visitor.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const lookingFor = visitor.looking_for && visitor.looking_for.trim() !== '' 
            ? (visitor.looking_for.length > 50 
                ? visitor.looking_for.substring(0, 50) + '...' 
                : visitor.looking_for)
            : '<span style="color: var(--text-light); font-style: italic;">Not specified</span>';
        
        const ipAddress = visitor.ip_address || '<span style="color: var(--text-light); font-style: italic;">N/A</span>';
        
        return `
            <tr>
                <td>${escapeHtml(visitor.full_name)}</td>
                <td>
                    <a href="mailto:${escapeHtml(visitor.email)}" style="color: var(--primary-color); text-decoration: none;">
                        ${escapeHtml(visitor.email)}
                    </a>
                </td>
                <td>
                    <a href="tel:${escapeHtml(visitor.phone)}" style="color: var(--primary-color); text-decoration: none;">
                        ${escapeHtml(visitor.phone)}
                    </a>
                </td>
                <td>${lookingFor}</td>
                <td>${ipAddress}</td>
                <td>${date}</td>
            </tr>
        `;
    }).join('');
}

// Visitor Search
function handleVisitorSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    const filtered = currentVisitors.filter(visitor => 
        visitor.full_name.toLowerCase().includes(searchTerm) ||
        visitor.email.toLowerCase().includes(searchTerm) ||
        visitor.phone.toLowerCase().includes(searchTerm) ||
        (visitor.looking_for && visitor.looking_for.toLowerCase().includes(searchTerm))
    );
    
    renderVisitorInfo(filtered);
}

// ============================================
// STAT CARD CLICK TRACKING
// ============================================

// Track stat card clicks
async function trackStatCardClick(statType, statLabel) {
    try {
        // Get user email if logged in
        const user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
        const userEmail = user ? user.email : null;
        
        const logData = {
            log_type: 'action',
            action: 'stat_card_click',
            description: `Stat card clicked: ${statLabel}`,
            user_email: userEmail,
            metadata: {
                stat_type: statType,
                stat_label: statLabel,
                page_name: 'Dashboard',
                page_url: window.location.href,
                timestamp: new Date().toISOString()
            }
        };
        
        // Send to logs API (fire and forget)
        fetch('/api/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData)
        }).catch(error => {
        });
    } catch (error) {
        // Stat card tracking error (non-critical)
    }
}

// Initialize stat card click tracking
function initStatCardTracking() {
    const statCards = document.querySelectorAll('.dashboard-stat-card');
    statCards.forEach(card => {
        // Make cards look clickable
        card.style.cursor = 'pointer';
        card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '';
        });
        
        // Track click
        card.addEventListener('click', () => {
            const statType = card.getAttribute('data-stat-type');
            const statLabel = card.getAttribute('data-stat-label') || card.querySelector('p')?.textContent || 'Unknown';
            
            // Track the click
            trackStatCardClick(statType, statLabel);
            
            // Optional: Add visual feedback
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = 'translateY(-2px)';
            }, 100);
        });
    });
}

// Initialize Dashboard Navigation Active States
function initDashboardNavigation() {
    const navLinks = document.querySelectorAll('.dashboard-nav-menu a');
    const currentPath = window.location.pathname;
    
    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        
        // Remove active class from all links
        link.classList.remove('active');
        
        // Add active class if current path matches
        if (currentPath === linkPath || 
            (currentPath === '/' && linkPath.includes('index.html')) ||
            (currentPath.includes('dashboard.html') && linkPath.includes('dashboard.html'))) {
            link.classList.add('active');
        }
    });
}

// ============================================
// AUTO-REFRESH FOR VISITOR INFO AND ACTIVITY LOGS
// ============================================

let refreshIntervalId = null;
const REFRESH_INTERVAL = 5000; // 5 seconds

// Start auto-refresh for visitor info and activity logs
function startAutoRefresh() {
    // Clear any existing interval
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
    }
    
    // Start refreshing every REFRESH_INTERVAL milliseconds
    refreshIntervalId = setInterval(() => {
        // Only refresh if page is visible (not in background tab)
        if (!document.hidden) {
            refreshVisitorInfoAndLogs();
        }
    }, REFRESH_INTERVAL);
    
    // Pause refresh when page is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, pause refresh
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
                refreshIntervalId = null;
            }
        } else {
            // Page is visible, resume refresh
            if (!refreshIntervalId) {
                startAutoRefresh();
                // Also refresh immediately when page becomes visible
                refreshVisitorInfoAndLogs();
            }
        }
    });
}

// Refresh visitor info, activity logs, and inquiries
async function refreshVisitorInfoAndLogs() {
    // Check if visitor info section is visible (not filtered/searched)
    const visitorSearch = document.getElementById('visitorSearch');
    const isVisitorSearchActive = visitorSearch && visitorSearch.value.trim() !== '';
    
    // Only refresh if not actively searching/filtering
    // This prevents interrupting user interactions
    if (!isVisitorSearchActive) {
        try {
            await loadVisitorInfo();
        } catch (error) {
            // Silently fail - don't show errors for background refresh
            console.debug('Background refresh of visitor info failed:', error);
        }
    }
    
    // Also refresh inquiries periodically to catch new submissions
    try {
        await loadInquiries(true); // Force refresh to bypass cache
    } catch (error) {
        // Silently fail - don't show errors for background refresh
        console.debug('Background refresh of inquiries failed:', error);
    }
    
    // Also refresh testimonials periodically to catch new submissions
    try {
        await loadTestimonials(true); // Force refresh to bypass cache
    } catch (error) {
        // Silently fail - don't show errors for background refresh
        console.debug('Background refresh of testimonials failed:', error);
    }
    
    // Refresh page visit stats for real-time updates
    try {
        await loadPageVisitStats();
    } catch (error) {
        // Silently fail - don't show errors for background refresh
        console.debug('Background refresh of page visit stats failed:', error);
    }
}

// Stop auto-refresh (useful for cleanup)
function stopAutoRefresh() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
}

window.removeFeature = removeFeature;
window.editTestimonial = editTestimonial;
window.deleteTestimonial = deleteTestimonial;
window.toggleTestimonialApproval = toggleTestimonialApproval;
window.toggleTestimonialFeatured = toggleTestimonialFeatured;
window.editPartner = editPartner;
window.deletePartner = deletePartner;
window.removePartnerLogoPreview = removePartnerLogoPreview;

