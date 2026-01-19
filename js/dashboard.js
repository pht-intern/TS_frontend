// Dashboard JavaScript

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize dashboard if we're on the dashboard page
    const isDashboardPage = document.getElementById('loginScreen') || document.getElementById('dashboardContainer');
    if (isDashboardPage) {
        checkAuthentication();
        initDashboard();
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

    // Property management
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', () => openPropertyModal());
    }

    // Property form
    const propertyForm = document.getElementById('propertyForm');
    if (propertyForm) {
        propertyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Validate step 3 before submitting
            if (validateStep3()) {
                handlePropertySubmit(e);
            }
        });
    }

    // Step navigation
    const nextStepBtn = document.getElementById('nextStepBtn');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const propertyTypeSelect = document.getElementById('propertyType');
    
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', handleNextStep);
    }
    if (prevStepBtn) {
        prevStepBtn.addEventListener('click', handlePrevStep);
    }
    if (propertyTypeSelect) {
        propertyTypeSelect.addEventListener('change', handlePropertyTypeChange);
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

    // Unit Type buttons (for old property form)
    const unitTypeButtons = document.querySelectorAll('#propertyForm .dashboard-unit-type-btn');
    unitTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            unitTypeButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update hidden input fields
            const bedroomsInput = document.getElementById('propertyBedrooms');
            const unitTypeInput = document.getElementById('propertyUnitType');
            
            if (bedroomsInput) {
                bedroomsInput.value = btn.dataset.bedrooms || '1';
            }
            if (unitTypeInput) {
                unitTypeInput.value = btn.dataset.unitType || '';
            }
        });
    });

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
    const propertyModal = document.getElementById('propertyModal');
    const propertyModalOverlay = document.getElementById('propertyModalOverlay');
    const propertyModalClose = document.getElementById('propertyModalClose');
    
    if (propertyModalOverlay) {
        propertyModalOverlay.addEventListener('click', closePropertyModal);
    }
    if (propertyModalClose) {
        propertyModalClose.addEventListener('click', closePropertyModal);
    }

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
function initUserProfile() {
    const profileBtn = document.getElementById('dashboardProfileBtn');
    const profileDropdown = document.getElementById('dashboardProfileDropdown');
    const profileName = document.getElementById('dashboardProfileName');
    const profileFullname = document.getElementById('dashboardProfileFullname');
    const profileEmail = document.getElementById('dashboardProfileEmail');
    const userProfile = document.getElementById('dashboardUserProfile');
    
    // Debug: Check if elements exist
    if (!profileBtn || !profileDropdown || !userProfile) {
        console.error('Profile elements not found:', {
            profileBtn: !!profileBtn,
            profileDropdown: !!profileDropdown,
            userProfile: !!userProfile
        });
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
    
    // Toggle dropdown
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileDropdown.classList.contains('active')) {
                profileDropdown.classList.remove('active');
            }
        });
    }
}

// Handle Logout
function handleLogout() {
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
        let page = 1;
        let hasMore = true;
        const limit = 100; // Maximum allowed by API
        
        // Add cache-busting timestamp if force refresh is requested
        const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
        
        while (hasMore) {
            const fetchOptions = forceRefresh ? {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            } : {};
            
            const response = await fetch(`/api/properties?page=${page}&limit=${limit}${cacheBuster}`, fetchOptions);
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
            const properties = data.items || [];
            allProperties = allProperties.concat(properties);
            
            // Check if there are more pages
            hasMore = page < data.pages;
            page++;
        }
        
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
        loadPageVisitStats();
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
            images: ["/images/img1.jpg"],
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

    // Helper function to normalize image URLs
    function normalizeImageUrl(url) {
        if (!url) return null;
        
        // If it's already a data URL (base64), return as is
        if (url.startsWith('data:')) {
            return url;
        }
        
        // If it's an absolute URL (http/https), return as is (external image)
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // If it's a relative path starting with /, return as is
        if (url.startsWith('/')) {
            return url;
        }
        
        // If it's a relative path without /, add /images/properties/ prefix
        // This handles cases where just the filename is stored
        if (url.includes('.jpeg') || url.includes('.jpg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
            // Check if it already has /images/ in the path
            if (url.includes('/images/')) {
                return url.startsWith('/') ? url : '/' + url;
            }
            // Otherwise, assume it's a property image
            return '/images/properties/' + url;
        }
        
        // Default: return as relative path with leading /
        return url.startsWith('/') ? url : '/' + url;
    }

    tbody.innerHTML = properties.map(property => {
        // Handle images - API returns array of objects with image_url, or primary_image string
        // Create a simple SVG placeholder as data URI
        const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
        let imageUrl = placeholderSvg;
        if (property.primary_image) {
            imageUrl = normalizeImageUrl(property.primary_image) || placeholderSvg;
        } else if (property.images && property.images.length > 0) {
            // If images is array of objects
            if (typeof property.images[0] === 'object' && property.images[0].image_url) {
                imageUrl = normalizeImageUrl(property.images[0].image_url) || placeholderSvg;
            } else if (typeof property.images[0] === 'string') {
                imageUrl = normalizeImageUrl(property.images[0]) || placeholderSvg;
            }
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
        
        return `
        <tr>
            <td>
                <div class="dashboard-table-image">
                    <img src="${escapeHtml(imageUrl)}" 
                         alt="${escapeHtml(property.title)}" 
                         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'">
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
                <span class="dashboard-table-status ${property.status}">${statusText}</span>
            </td>
            <td>
                <div class="dashboard-table-actions">
                    <button class="dashboard-action-btn edit" onclick="editProperty(${property.id})" title="Edit">
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

// Load and display page visit counts
async function loadPageVisitStats() {
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
        
        const tableBody = document.getElementById('pageVisitsTableBody');
        if (!tableBody) return;
        
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
        
        // Render page visits table with defensive checks
        tableBody.innerHTML = data.page_visits.map(page => {
            // Safely extract values with defaults
            const pageName = page.page || page.page_name || 'Unknown';
            const visitCount = Number(page.visits ?? page.visit_count ?? 0);
            const uniqueVisitors = Number(page.unique_visitors ?? 0);
            const authenticatedVisitors = Number(page.authenticated_visitors ?? 0);
            
            return `
            <tr>
                <td><strong>${escapeHtml(pageName)}</strong></td>
                <td>${visitCount.toLocaleString()}</td>
                <td>${uniqueVisitors.toLocaleString()}</td>
                <td>${authenticatedVisitors.toLocaleString()}</td>
            </tr>
        `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading page visit statistics:', error);
        const tableBody = document.getElementById('pageVisitsTableBody');
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

// Open Property Modal
async function openPropertyModal(propertyId = null) {
    const modal = document.getElementById('propertyModal');
    const form = document.getElementById('propertyForm');
    const modalTitle = document.getElementById('propertyModalTitle');
    
    if (!modal || !form) return;

    // Get property ID input reference BEFORE resetting form
    const propertyIdInput = document.getElementById('propertyId');
    const currentStepInput = document.getElementById('currentStep');
    
    // Store property ID temporarily (form.reset() will clear all inputs)
    const tempPropertyId = propertyId;
    
    // Reset form and steps (this clears ALL form fields including hidden propertyId)
    form.reset();
    
    // CRITICAL FIX: Restore property ID immediately after reset if in edit mode
    if (tempPropertyId && propertyIdInput) {
        propertyIdInput.value = tempPropertyId;
    } else if (propertyIdInput) {
        propertyIdInput.value = '';
    }
    
    if (currentStepInput) currentStepInput.value = '1';
    
    // Reset to step 1
    showStep(1);

    if (propertyId) {
        // Edit mode - ensure property ID is set (double-check after reset)
        if (propertyIdInput) propertyIdInput.value = propertyId;
        
        // Fetch property from API
        try {
            const response = await fetch(`/api/properties/${propertyId}`);
            if (!response.ok) {
                const text = await response.text();
                let errorMessage = 'Failed to fetch property';
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
                } catch {
                    errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const property = await response.json();
            
            // Populate step 1 fields first
    const projectNameInput = document.getElementById('propertyProjectName');
    const cityInput = document.getElementById('propertyCity');
    const localityInput = document.getElementById('propertyLocality');
    const locationLinkInput = document.getElementById('propertyLocationLink');
    const propertyTypeSelect = document.getElementById('propertyType');
    
    if (projectNameInput) projectNameInput.value = property.project_name || property.property_name || property.title || '';
    if (cityInput) cityInput.value = property.city || '';
    if (localityInput) localityInput.value = property.locality || '';
    if (locationLinkInput) locationLinkInput.value = property.location_link || '';
    
            // Populate price field (now in Step 1)
            const priceInput = document.getElementById('propertyPrice');
            const priceNegotiableInput = document.getElementById('propertyPriceNegotiable');
            if (priceInput) {
                priceInput.value = property.price_text || property.price || '';
            }
            if (priceNegotiableInput) {
                priceNegotiableInput.checked = property.price_negotiable || false;
            }
            
            // Map property type and trigger step 2 load
    if (propertyTypeSelect) {
        let typeValue = '';
        if (property.type) {
            const typeStr = typeof property.type === 'string' ? property.type.toLowerCase() : (property.type.value || '').toLowerCase();
            if (typeStr === 'plot' || typeStr === 'plots') {
                typeValue = 'plot_properties';
            } else if (typeStr === 'apartment' || typeStr === 'apartments') {
                typeValue = 'apartments';
            } else if (typeStr === 'villa' || typeStr === 'villas') {
                typeValue = 'villas';
            } else if (typeStr === 'house') {
                typeValue = 'individual_house';
            }
        }
        propertyTypeSelect.value = typeValue;
                
                // Navigate to step 2 to load step 2 content, then populate
                showStep(2);
                
                // Populate step 2 fields after content loads
                setTimeout(() => {
                    populateStep2Fields(property);
                    // Navigate to step 3 to load step 3 content
                    showStep(3);
                    // Populate step 3 fields after content loads
                    setTimeout(() => {
                        const descriptionInput = document.getElementById('propertyDescription');
                        if (descriptionInput) {
                            descriptionInput.value = property.description || '';
                        }
                        populateStep3Fields(property);
                    }, 100);
                }, 200);
            }
            
            // Ensure property ID is set after populating form
            if (propertyIdInput) propertyIdInput.value = property.id || propertyId;
            if (modalTitle) modalTitle.textContent = 'Edit Property';
        } catch (error) {
            console.error('Error loading property:', error);
            showNotification('Failed to load property details.', 'error');
            // Keep the property ID set even if fetch fails
            if (propertyIdInput) propertyIdInput.value = propertyId;
            return;
        }
    } else {
        // Add mode - clear property ID
        if (propertyIdInput) propertyIdInput.value = '';
        if (modalTitle) modalTitle.textContent = 'Add New Property';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Populate property form with data (called from openPropertyModal)
function populatePropertyForm(property) {
    // This function is kept for backward compatibility but the actual population
    // is now handled directly in openPropertyModal to ensure proper step loading order
    // Step 1 fields are populated in openPropertyModal
    // Step 2 and Step 3 fields are populated via populateStep2Fields and populateStep3Fields
}

// Populate step 2 fields based on property type
function populateStep2Fields(property) {
    const propertyType = document.getElementById('propertyType')?.value;
    if (!propertyType) return;
    
    // Common fields for all types (price is now in Step 1, so skip it here)
    const statusInput = document.getElementById('propertyStatus');
    
    if (statusInput) {
        // Map status - backend uses 'sale'/'rent' but property_status may have more details
        const statusValue = property.property_status || property.status || 'sale';
        statusInput.value = statusValue;
    }
    
    // Type-specific fields
    if (propertyType === 'apartments') {
        const superBuiltupAreaInput = document.getElementById('propertySuperBuiltupArea');
        const carpetAreaInput = document.getElementById('propertyCarpetArea');
        const listingTypeInput = document.getElementById('propertyListingType');
        const directionInput = document.getElementById('propertyDirection');
        const bedroomsInput = document.getElementById('propertyBedrooms');
        const unitTypeInput = document.getElementById('propertyUnitType');
        const amenitiesInput = document.getElementById('propertyAmenities');
        
        if (superBuiltupAreaInput) {
            superBuiltupAreaInput.value = property.super_built_up_area || property.super_builtup_area || '';
        }
        if (carpetAreaInput) {
            carpetAreaInput.value = property.carpet_area || '';
        }
        if (listingTypeInput) {
            listingTypeInput.value = property.listing_type || property.property_status || '';
        }
        if (directionInput) {
            directionInput.value = property.direction || '';
        }
        if (bedroomsInput) {
            bedroomsInput.value = property.bedrooms || 1;
        }
        if (unitTypeInput) {
            unitTypeInput.value = property.unit_type || 'bhk';
        }
        if (amenitiesInput && property.features) {
            // Select amenities that match property features
            const featureNames = property.features.map(f => f.feature_name || f).filter(Boolean);
            Array.from(amenitiesInput.options).forEach(option => {
                option.selected = featureNames.includes(option.value);
            });
        }
    } else if (propertyType === 'plot_properties') {
        const plotAreaInput = document.getElementById('propertyPlotArea');
        const plotLengthInput = document.getElementById('propertyPlotLength');
        const plotBreadthInput = document.getElementById('propertyPlotBreadth');
        
        if (plotAreaInput) {
            plotAreaInput.value = property.plot_area || '';
        }
        if (plotLengthInput) {
            plotLengthInput.value = property.plot_length || '';
        }
        if (plotBreadthInput) {
            plotBreadthInput.value = property.plot_breadth || '';
        }
    }
    // Add other property types as needed
}

// Populate step 3 fields (images and description)
function populateStep3Fields(property) {
    // Description is already populated in populatePropertyForm
    
    // Ensure gallery container exists before populating images
    const container = document.getElementById('galleryImagesContainer');
    if (!container) {
        // Wait a bit and try again
        setTimeout(() => populateStep3Fields(property), 100);
        return;
    }
    
    // Clear any existing empty rows first (keep only rows with images)
    const existingRows = container.querySelectorAll('.gallery-image-row');
    existingRows.forEach(row => {
        const previewContainer = row.querySelector('[id^="imagePreview_"]');
        if (previewContainer) {
            const computedStyle = window.getComputedStyle(previewContainer);
            const hasImage = previewContainer.getAttribute('data-image-url') || 
                           previewContainer.querySelector('img');
            // Remove empty rows (no image and hidden)
            if (!hasImage && (computedStyle.display === 'none' || !previewContainer.querySelector('img'))) {
                row.remove();
            }
        }
    });
    
    let imageIndex = 0;
    
    // Populate images if they exist
    if (property.project_images && property.project_images.length > 0) {
        property.project_images.forEach((image) => {
            const imageUrl = image.image_url || image;
            if (imageUrl) {
                // Add image preview to gallery
                setTimeout(() => {
                    addImagePreview(imageUrl, true, property.property_category || 'residential', 'project');
                }, imageIndex * 50);
                imageIndex++;
            }
        });
    }
    
    if (property.floorplan_images && property.floorplan_images.length > 0) {
        property.floorplan_images.forEach((image) => {
            const imageUrl = image.image_url || image;
            if (imageUrl) {
                setTimeout(() => {
                    addImagePreview(imageUrl, true, property.property_category || 'residential', 'floorplan');
                }, imageIndex * 50);
                imageIndex++;
            }
        });
    }
    
    if (property.masterplan_images && property.masterplan_images.length > 0) {
        property.masterplan_images.forEach((image) => {
            const imageUrl = image.image_url || image;
            if (imageUrl) {
                setTimeout(() => {
                    addImagePreview(imageUrl, true, property.property_category || 'residential', 'masterplan');
                }, imageIndex * 50);
                imageIndex++;
            }
        });
    }
    
    // Also check legacy images array
    if (property.images && property.images.length > 0) {
        property.images.forEach((image) => {
            const imageUrl = image.image_url || image;
            if (imageUrl) {
                setTimeout(() => {
                    addImagePreview(imageUrl, true, property.property_category || 'residential', 'project');
                }, imageIndex * 50);
                imageIndex++;
            }
        });
    }
    
    // If no images were added, add one empty row for new uploads
    if (imageIndex === 0) {
        addImageUploadRow();
    }
}

// Helper function to add image preview (for existing images from API)
function addImagePreview(imageUrl, isExisting, propertyCategory, imageType) {
    const container = document.getElementById('galleryImagesContainer');
    if (!container) return;
    
    // Normalize image URL
    let normalizedUrl = imageUrl;
    if (!normalizedUrl.startsWith('data:') && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        if (!normalizedUrl.startsWith('/')) {
            normalizedUrl = '/' + normalizedUrl;
        }
    }
    
    // Check if image already exists
    const existingPreviews = container.querySelectorAll('.gallery-image-preview img');
    for (const preview of existingPreviews) {
        const existingSrc = preview.src || preview.getAttribute('data-image-src');
        if (existingSrc === normalizedUrl || existingSrc === imageUrl || 
            existingSrc.includes(normalizedUrl.split('/').pop()) || 
            existingSrc.includes(imageUrl.split('/').pop())) {
            return; // Image already exists
        }
    }
    
    // Add new image row if needed
    const imageRows = container.querySelectorAll('.gallery-image-row');
    let imageRow = null;
    let imageIndex = imageRows.length;
    
    // Find first empty row or create new one
    for (let i = 0; i < imageRows.length; i++) {
        const row = imageRows[i];
        const previewContainer = row.querySelector('[id^="imagePreview_"]');
        if (previewContainer) {
            const computedStyle = window.getComputedStyle(previewContainer);
            const img = previewContainer.querySelector('img');
            // Check if preview is empty or hidden
            if ((computedStyle.display === 'none' || !img || !img.src) && 
                !previewContainer.getAttribute('data-image-url')) {
                imageRow = row;
                // Extract index from preview ID
                const previewIdMatch = previewContainer.id.match(/imagePreview_(\d+)/);
                imageIndex = previewIdMatch ? parseInt(previewIdMatch[1]) : i;
                break;
            }
        }
    }
    
    if (!imageRow) {
        addImageUploadRow();
        const newRows = container.querySelectorAll('.gallery-image-row');
        imageRow = newRows[newRows.length - 1];
        const newPreviewContainer = imageRow.querySelector('[id^="imagePreview_"]');
        if (newPreviewContainer) {
            const previewIdMatch = newPreviewContainer.id.match(/imagePreview_(\d+)/);
            imageIndex = previewIdMatch ? parseInt(previewIdMatch[1]) : imageRows.length;
        } else {
            imageIndex = imageRows.length;
        }
    }
    
    // Set image preview
    if (imageRow) {
        const preview = imageRow.querySelector(`#imagePreview_${imageIndex}`);
        const fileInput = imageRow.querySelector(`#imageFile_${imageIndex}`);
        const categorySelect = imageRow.querySelector(`#imageCategory_${imageIndex}`);
        
        if (preview) {
            preview.innerHTML = `
                <div style="position: relative; display: inline-block; margin-top: 0.5rem;">
                    <img src="${normalizedUrl}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 6px; object-fit: cover; border: 2px solid var(--border-color);" data-image-src="${normalizedUrl}">
                    <button type="button" class="remove-preview-btn" style="position: absolute; top: -8px; right: -8px; background: var(--danger-color); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            // Ensure preview is visible
            preview.style.display = 'block';
            preview.style.visibility = 'visible';
            // Store the URL in data attribute for easy access
            preview.setAttribute('data-image-url', normalizedUrl);
            preview.setAttribute('data-is-existing', 'true');
            
            // Set category based on image type
            if (categorySelect) {
                if (imageType === 'project' || imageType === 'project_image') {
                    categorySelect.value = 'project_image';
                } else if (imageType === 'floorplan' || imageType === 'floor_plan') {
                    categorySelect.value = 'floor_plan';
                } else if (imageType === 'masterplan' || imageType === 'master_plan') {
                    categorySelect.value = 'master_plan';
                }
            }
            
            // Clear file input since this is an existing image
            if (fileInput) {
                fileInput.value = '';
            }
            
            // Add remove handler
            const removeBtn = preview.querySelector('.remove-preview-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (fileInput) fileInput.value = '';
                    preview.innerHTML = '';
                    preview.style.display = 'none';
                    preview.removeAttribute('data-image-url');
                    preview.removeAttribute('data-is-existing');
                });
            }
        }
    }
}

// Close Property Modal
function closePropertyModal() {
    const modal = document.getElementById('propertyModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset to step 1
        showStep(1);
    }
}

// Show specific step
function showStep(stepNumber) {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const nextBtn = document.getElementById('nextStepBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    const submitBtn = document.getElementById('submitPropertyBtn');
    const currentStepInput = document.getElementById('currentStep');
    
    // Update step indicators
    const stepIndicators = document.querySelectorAll('.property-wizard-step');
    stepIndicators.forEach((indicator, index) => {
        const stepNum = parseInt(indicator.dataset.step);
        if (stepNum <= stepNumber) {
            indicator.classList.add('active');
            const numberDiv = indicator.querySelector('.property-wizard-step-number');
            const labelSpan = indicator.querySelector('.property-wizard-step-label');
            if (numberDiv) {
                numberDiv.style.background = 'var(--primary-color)';
                numberDiv.style.color = 'white';
                numberDiv.style.width = '40px';
                numberDiv.style.height = '40px';
                numberDiv.style.fontSize = '1.1rem';
            }
            if (labelSpan) {
                labelSpan.style.color = 'var(--text-color)';
                labelSpan.style.fontSize = '1rem';
            }
        } else {
            indicator.classList.remove('active');
            const numberDiv = indicator.querySelector('.property-wizard-step-number');
            const labelSpan = indicator.querySelector('.property-wizard-step-label');
            if (numberDiv) {
                numberDiv.style.background = 'var(--border-color)';
                numberDiv.style.color = 'var(--text-gray)';
                numberDiv.style.width = '40px';
                numberDiv.style.height = '40px';
                numberDiv.style.fontSize = '1.1rem';
            }
            if (labelSpan) {
                labelSpan.style.color = 'var(--text-gray)';
                labelSpan.style.fontSize = '1rem';
            }
        }
    });
    
    if (stepNumber === 1) {
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (step3) step3.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'inline-flex';
        if (prevBtn) prevBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
    } else if (stepNumber === 2) {
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        if (step3) step3.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'inline-flex';
        if (prevBtn) prevBtn.style.display = 'inline-flex';
        if (submitBtn) submitBtn.style.display = 'none';
        
        // Load step 2 content based on property type
        loadStep2Content();
    } else if (stepNumber === 3) {
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'none';
        if (step3) step3.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'inline-flex';
        if (submitBtn) submitBtn.style.display = 'inline-flex';
        
        // Load step 3 content (will be configured in next prompt)
        loadStep3Content();
    }
    
    if (currentStepInput) {
        currentStepInput.value = stepNumber.toString();
    }
}

// Handle next step
function handleNextStep() {
    const currentStepInput = document.getElementById('currentStep');
    const currentStep = currentStepInput ? parseInt(currentStepInput.value) : 1;
    
    if (currentStep === 1) {
        // Validate step 1
        const projectName = document.getElementById('propertyProjectName');
        const city = document.getElementById('propertyCity');
        const locality = document.getElementById('propertyLocality');
        const propertyType = document.getElementById('propertyType');
        const price = document.getElementById('propertyPrice');
        
        if (!projectName || !projectName.value.trim()) {
            showNotification('Please enter project name.', 'error');
            projectName.focus();
            return;
        }
        if (!city || !city.value.trim()) {
            showNotification('Please enter city.', 'error');
            city.focus();
            return;
        }
        if (!locality || !locality.value.trim()) {
            showNotification('Please enter locality/area.', 'error');
            locality.focus();
            return;
        }
        if (!propertyType || !propertyType.value) {
            showNotification('Please select property type.', 'error');
            propertyType.focus();
            return;
        }
        if (!price || !price.value.trim()) {
            showNotification('Please enter price.', 'error');
            price.focus();
            return;
        }
        
        showStep(2);
    } else if (currentStep === 2) {
        // Validate step 2 based on property type
        if (validateStep2()) {
            showStep(3);
        }
    }
}

// Validate step 2 based on property type
function validateStep2() {
    const propertyType = document.getElementById('propertyType');
    if (!propertyType || !propertyType.value) {
        showNotification('Please select property type.', 'error');
        return false;
    }
    
    const selectedType = propertyType.value;
    
    // Validate based on property type
    if (selectedType === 'apartments') {
        const status = document.getElementById('propertyStatus');
        const listingType = document.getElementById('propertyListingType');
        const superBuiltupArea = document.getElementById('propertySuperBuiltupArea');
        const carpetArea = document.getElementById('propertyCarpetArea');
        const direction = document.getElementById('propertyDirection');
        const amenities = document.getElementById('propertyAmenities');
        
        if (!status || !status.value) {
            showNotification('Please select status.', 'error');
            status?.focus();
            return false;
        }
        if (!listingType || !listingType.value) {
            showNotification('Please select listing type.', 'error');
            listingType?.focus();
            return false;
        }
        if (!superBuiltupArea || !superBuiltupArea.value) {
            showNotification('Please enter super builtup area.', 'error');
            superBuiltupArea?.focus();
            return false;
        }
        if (!carpetArea || !carpetArea.value) {
            showNotification('Please enter carpet area.', 'error');
            carpetArea?.focus();
            return false;
        }
        if (!direction || !direction.value) {
            showNotification('Please select direction.', 'error');
            direction?.focus();
            return false;
        }
        // Price is now validated in Step 1, so removed from here
        if (!amenities || !amenities.selectedOptions || amenities.selectedOptions.length === 0) {
            showNotification('Please select at least one amenity.', 'error');
            amenities?.focus();
            return false;
        }
    } else if (selectedType === 'villas') {
        const villaType = document.getElementById('propertyVillaType');
        const listingType = document.getElementById('propertyListingType');
        const status = document.getElementById('propertyStatus');
        const buildupArea = document.getElementById('propertyBuildupArea');
        const carpetArea = document.getElementById('propertyCarpetArea');
        const bedrooms = document.getElementById('propertyBedroomsCount');
        const bathrooms = document.getElementById('propertyBathrooms');
        const amenities = document.getElementById('propertyAmenities');
        
        if (!villaType || !villaType.value) {
            showNotification('Please select villa type.', 'error');
            villaType?.focus();
            return false;
        }
        if (villaType.value === 'independent_villa') {
            const plotArea = document.getElementById('propertyPlotArea');
            if (!plotArea || !plotArea.value) {
                showNotification('Please enter plot area for independent villa.', 'error');
                plotArea?.focus();
                return false;
            }
        }
        if (!listingType || !listingType.value) {
            showNotification('Please select listing type.', 'error');
            listingType?.focus();
            return false;
        }
        if (!status || !status.value) {
            showNotification('Please select status.', 'error');
            status?.focus();
            return false;
        }
        if (!buildupArea || !buildupArea.value) {
            showNotification('Please enter builtup area.', 'error');
            buildupArea?.focus();
            return false;
        }
        if (!carpetArea || !carpetArea.value) {
            showNotification('Please enter carpet area.', 'error');
            carpetArea?.focus();
            return false;
        }
        if (!bedrooms || !bedrooms.value) {
            showNotification('Please enter number of bedrooms.', 'error');
            bedrooms?.focus();
            return false;
        }
        if (!bathrooms || !bathrooms.value) {
            showNotification('Please enter number of bathrooms.', 'error');
            bathrooms?.focus();
            return false;
        }
        if (!amenities || !amenities.selectedOptions || amenities.selectedOptions.length === 0) {
            showNotification('Please select at least one amenity.', 'error');
            amenities?.focus();
            return false;
        }
    } else if (selectedType === 'individual_house') {
        const houseType = document.getElementById('propertyVillaType');
        const listingType = document.getElementById('propertyListingType');
        const status = document.getElementById('propertyStatus');
        const buildupArea = document.getElementById('propertyBuildupArea');
        const carpetArea = document.getElementById('propertyCarpetArea');
        const bedrooms = document.getElementById('propertyBedroomsCount');
        const bathrooms = document.getElementById('propertyBathrooms');
        
        if (!houseType || !houseType.value) {
            showNotification('Please select house type.', 'error');
            houseType?.focus();
            return false;
        }
        if (houseType.value === 'independent_villa') {
            const plotArea = document.getElementById('propertyPlotArea');
            if (!plotArea || !plotArea.value) {
                showNotification('Please enter plot area for independent house.', 'error');
                plotArea?.focus();
                return false;
            }
        }
        if (!listingType || !listingType.value) {
            showNotification('Please select listing type.', 'error');
            listingType?.focus();
            return false;
        }
        if (!status || !status.value) {
            showNotification('Please select status.', 'error');
            status?.focus();
            return false;
        }
        if (!buildupArea || !buildupArea.value) {
            showNotification('Please enter builtup area.', 'error');
            buildupArea?.focus();
            return false;
        }
        if (!carpetArea || !carpetArea.value) {
            showNotification('Please enter carpet area.', 'error');
            carpetArea?.focus();
            return false;
        }
        if (!bedrooms || !bedrooms.value) {
            showNotification('Please enter number of bedrooms.', 'error');
            bedrooms?.focus();
            return false;
        }
        if (!bathrooms || !bathrooms.value) {
            showNotification('Please enter number of bathrooms.', 'error');
            bathrooms?.focus();
            return false;
        }
    } else if (selectedType === 'plot_properties') {
        const plotSection = document.getElementById('propertyPlotSection');
        const status = document.getElementById('propertyStatus');
        
        if (!plotSection || !plotSection.value.trim()) {
            showNotification('Please enter plot section.', 'error');
            plotSection?.focus();
            return false;
        }
        if (!status || !status.value) {
            showNotification('Please select status.', 'error');
            status?.focus();
            return false;
        }
    }
    
    return true;
}

// Load step 3 content
function loadStep3Content() {
    const step3Content = document.getElementById('step3Content');
    if (!step3Content) return;
    
    // Clear existing content first to avoid duplicates
    const existingContainer = document.getElementById('galleryImagesContainer');
    const existingImages = [];
    
    // Store existing images before clearing (for edit mode)
    if (existingContainer) {
        const existingRows = existingContainer.querySelectorAll('.gallery-image-row');
        existingRows.forEach(row => {
            const previewContainer = row.querySelector('[id^="imagePreview_"]');
            if (previewContainer) {
                const img = previewContainer.querySelector('img');
                const imageUrl = previewContainer.getAttribute('data-image-url') || 
                                (img ? (img.getAttribute('data-image-src') || img.src) : null);
                const categorySelect = row.querySelector('.image-category-select');
                const category = categorySelect ? categorySelect.value : 'project_image';
                
                if (imageUrl) {
                    existingImages.push({
                        url: imageUrl,
                        category: category,
                        isExisting: previewContainer.getAttribute('data-is-existing') === 'true'
                    });
                }
            }
        });
    }
    
    step3Content.innerHTML = `
        <div class="dashboard-form-group" style="margin-bottom: 1.5rem;">
            <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                <i class="fas fa-video"></i>
                Video Preview Link
            </label>
            <input type="url" id="propertyVideoLink" name="video_link" placeholder="e.g., https://youtube.com/watch?v=... or https://vimeo.com/..." style="padding: 1rem 1.25rem; font-size: 1rem;">
        </div>

        <div class="dashboard-form-group" style="margin-bottom: 1.5rem;">
            <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                <i class="fas fa-images"></i>
                Gallery Images
            </label>
            <div id="galleryImagesContainer">
                <!-- Image upload rows will be added here -->
            </div>
            <button type="button" class="dashboard-btn-secondary" id="addImageRowBtn" style="margin-top: 1rem; padding: 0.75rem 1.5rem; font-size: 1rem;">
                <i class="fas fa-plus"></i>
                Add Image
            </button>
        </div>

        <div class="dashboard-form-group" style="margin-bottom: 0;">
            <label for="propertyDescription" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                <i class="fas fa-align-left"></i>
                Description *
            </label>
            <textarea id="propertyDescription" name="description" rows="8" placeholder="Enter detailed property description..." required style="padding: 1rem 1.25rem; font-size: 1rem; line-height: 1.6;"></textarea>
        </div>
    `;
    
    // Restore existing images if any (for edit mode)
    if (existingImages.length > 0) {
        existingImages.forEach((imgData, index) => {
            setTimeout(() => {
                const imageType = imgData.category === 'floor_plan' ? 'floorplan' : 
                                 imgData.category === 'master_plan' ? 'masterplan' : 'project';
                addImagePreview(imgData.url, imgData.isExisting, 'residential', imageType);
            }, index * 50);
        });
    } else {
        // Initialize gallery - add first image row only if no existing images
        addImageUploadRow();
    }
    
    // Add event listener for add image button
    const addImageBtn = document.getElementById('addImageRowBtn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', addImageUploadRow);
    }
}

// Add a new image upload row
function addImageUploadRow() {
    const container = document.getElementById('galleryImagesContainer');
    if (!container) return;
    
    const imageCount = container.children.length;
    const rowId = `imageRow_${imageCount}`;
    
    const imageRow = document.createElement('div');
    imageRow.className = 'gallery-image-row';
    imageRow.id = rowId;
    imageRow.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: var(--bg-light);';
    
    imageRow.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="color: var(--text-color); font-size: 0.95rem; font-weight: 500;">
                <i class="fas fa-image" style="margin-right: 0.4rem; font-size: 0.85rem;"></i>
                Image ${imageCount + 1}
            </span>
            ${imageCount > 0 ? `
                <button type="button" class="remove-image-row-btn" data-row-id="${rowId}" style="background: var(--danger-color); color: white; border: none; border-radius: 4px; padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                    <i class="fas fa-trash" style="font-size: 0.75rem;"></i> Remove
                </button>
            ` : ''}
        </div>
        
        <div class="dashboard-form-row" style="margin-bottom: 0.75rem;">
            <div class="dashboard-form-group" style="margin-bottom: 0;">
                <label for="imageTitle_${imageCount}" style="font-size: 0.9rem; margin-bottom: 0.4rem;">
                    <i class="fas fa-heading" style="font-size: 0.85rem;"></i>
                    Title
                </label>
                <input type="text" id="imageTitle_${imageCount}" name="image_titles[]" placeholder="e.g., Living Room" class="image-title-input" style="padding: 0.6rem 0.75rem; font-size: 0.9rem;">
            </div>
            <div class="dashboard-form-group" style="margin-bottom: 0;">
                <label for="imageCategory_${imageCount}" style="font-size: 0.9rem; margin-bottom: 0.4rem;">
                    <i class="fas fa-folder" style="font-size: 0.85rem;"></i>
                    Category *
                </label>
                <select id="imageCategory_${imageCount}" name="image_categories[]" class="image-category-select" required style="padding: 0.6rem 0.75rem; font-size: 0.9rem;">
                    <option value="">Select</option>
                    <option value="project_image">Project Image</option>
                    <option value="floor_plan">Floor Plan</option>
                    <option value="master_plan">Master Plan</option>
                </select>
            </div>
        </div>
        
        <div class="dashboard-form-group" style="margin-bottom: 0;">
            <label for="imageFile_${imageCount}" style="font-size: 0.9rem; margin-bottom: 0.4rem;">
                <i class="fas fa-upload" style="font-size: 0.85rem;"></i>
                Upload Image *
            </label>
            <input type="file" id="imageFile_${imageCount}" name="gallery_images[]" accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml" class="gallery-image-input" style="padding: 0.6rem 0.75rem; font-size: 0.9rem; width: 100%; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-color);">
            <div class="dashboard-image-preview-container gallery-image-preview" id="imagePreview_${imageCount}" style="display: none; margin-top: 0.75rem; padding: 0.5rem;"></div>
        </div>
    `;
    
    container.appendChild(imageRow);
    
    // Initialize image upload handlers for this row
    initializeImageUploadRow(rowId, imageCount);
    
    // Add remove button handler
    const removeBtn = imageRow.querySelector('.remove-image-row-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            const rowIdToRemove = this.dataset.rowId;
            const rowToRemove = document.getElementById(rowIdToRemove);
            if (rowToRemove) {
                rowToRemove.remove();
                // Renumber remaining images
                renumberImageRows();
            }
        });
    }
}

// Initialize image upload handlers for a specific row
function initializeImageUploadRow(rowId, index) {
    const fileInput = document.getElementById(`imageFile_${index}`);
    const preview = document.getElementById(`imagePreview_${index}`);
    
    if (!fileInput || !preview) return;
    
    // File input change handler
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Image size must be less than 5MB.', 'error');
                this.value = '';
                preview.style.display = 'none';
                preview.innerHTML = '';
                return;
            }
            
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
            if (!validTypes.includes(file.type)) {
                showNotification('Invalid file type. Please upload JPG, PNG, SVG, or WebP images.', 'error');
                this.value = '';
                preview.style.display = 'none';
                preview.innerHTML = '';
                return;
            }
            
            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                const dataUrl = e.target.result;
                preview.innerHTML = `
                    <div style="position: relative; display: inline-block; margin-top: 0.5rem;">
                        <img src="${dataUrl}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 6px; object-fit: cover; border: 2px solid var(--border-color);" data-image-src="${dataUrl}">
                        <button type="button" class="remove-preview-btn" style="position: absolute; top: -8px; right: -8px; background: var(--danger-color); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                // Ensure preview is visible
                preview.style.display = 'block';
                preview.style.visibility = 'visible';
                
                // Store the data URL in the preview container for easy access
                preview.setAttribute('data-image-url', dataUrl);
                
                // Remove preview button handler
                const removePreviewBtn = preview.querySelector('.remove-preview-btn');
                if (removePreviewBtn) {
                    removePreviewBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        fileInput.value = '';
                        preview.innerHTML = '';
                        preview.style.display = 'none';
                        preview.removeAttribute('data-image-url');
                    });
                }
            };
            reader.onerror = function() {
                showNotification('Error reading image file. Please try again.', 'error');
                fileInput.value = '';
                preview.style.display = 'none';
                preview.innerHTML = '';
                preview.removeAttribute('data-image-url');
            };
            reader.readAsDataURL(file);
        } else {
            // No file selected, hide preview
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    });
}

// Renumber image rows after removal
function renumberImageRows() {
    const container = document.getElementById('galleryImagesContainer');
    if (!container) return;
    
    const rows = container.querySelectorAll('.gallery-image-row');
    rows.forEach((row, index) => {
        const title = row.querySelector('h4');
        if (title) {
            title.innerHTML = `<i class="fas fa-image" style="margin-right: 0.5rem;"></i>Image ${index + 1}`;
        }
        
        // Update IDs and names
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            const oldId = input.id;
            if (oldId) {
                const baseId = oldId.split('_')[0] + '_' + oldId.split('_')[1];
                input.id = `${baseId}_${index}`;
            }
        });
    });
}

// Validate step 3 before form submission
function validateStep3() {
    const description = document.getElementById('propertyDescription');
    if (!description || !description.value.trim()) {
        showNotification('Please enter property description.', 'error');
        description?.focus();
        return false;
    }
    
    // Check if at least one image is uploaded
    // Check gallery images container for previews
    const galleryImagesContainer = document.getElementById('galleryImagesContainer');
    let hasAtLeastOneImage = false;
    
    if (galleryImagesContainer) {
        // Check all image rows for valid previews
        const imageRows = galleryImagesContainer.querySelectorAll('.gallery-image-row');
        
        imageRows.forEach((row) => {
            if (hasAtLeastOneImage) return; // Already found one
            
            // Find preview container
            const previewContainer = row.querySelector('[id^="imagePreview_"]');
            if (!previewContainer) return;
            
            // Check if preview is visible
            const computedStyle = window.getComputedStyle(previewContainer);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
            
            // Get the image element
            const img = previewContainer.querySelector('img');
            if (!img || !img.src) return;
            
            const imageSrc = img.src.trim();
            if (!imageSrc || imageSrc === '' || imageSrc === 'undefined' || imageSrc === 'null') return;
            
            // Skip placeholder/empty images
            if (imageSrc.includes('data:image/svg+xml') || 
                imageSrc.includes('placeholder') ||
                imageSrc.includes('blank')) {
                return;
            }
            
            // Valid image found
            if (imageSrc.startsWith('data:image/') || 
                imageSrc.startsWith('http') || 
                imageSrc.startsWith('/') ||
                imageSrc.startsWith('images/')) {
                hasAtLeastOneImage = true;
            }
        });
    }
    
    // Also check file inputs as fallback (in case preview hasn't been created yet)
    if (!hasAtLeastOneImage) {
        const imageInputs = document.querySelectorAll('.gallery-image-input');
        imageInputs.forEach(input => {
            if (input && input.files && input.files.length > 0) {
                hasAtLeastOneImage = true;
            }
        });
    }
    
    // Gallery images are optional for now - allow submission without images
    // if (!hasAtLeastOneImage) {
    //     showNotification('Please upload at least one gallery image.', 'error');
    //     return false;
    // }
    
    // Validate that all uploaded images have categories
    const imageRows = galleryImagesContainer ? galleryImagesContainer.querySelectorAll('.gallery-image-row') : [];
    let allCategoriesValid = true;
    let firstInvalidSelect = null;
    
    imageRows.forEach((row) => {
        const previewContainer = row.querySelector('[id^="imagePreview_"]');
        if (!previewContainer) return;
        
        // Check if preview is visible and has an image
        const computedStyle = window.getComputedStyle(previewContainer);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
        
        const img = previewContainer.querySelector('img');
        if (!img || !img.src) return;
        
        const imageSrc = img.src.trim();
        if (!imageSrc || imageSrc === '' || imageSrc === 'undefined' || imageSrc === 'null') return;
        
        // Skip placeholder/empty images
        if (imageSrc.includes('data:image/svg+xml') || 
            imageSrc.includes('placeholder') ||
            imageSrc.includes('blank')) {
            return;
        }
        
        // Extract index from preview ID
        const previewIdMatch = previewContainer.id.match(/imagePreview_(\d+)/);
        const previewIndex = previewIdMatch ? parseInt(previewIdMatch[1]) : null;
        
        if (previewIndex !== null) {
            const categorySelect = row.querySelector(`#imageCategory_${previewIndex}`);
            if (categorySelect && !categorySelect.value) {
                allCategoriesValid = false;
                if (!firstInvalidSelect) {
                    firstInvalidSelect = categorySelect;
                }
            }
        }
    });
    
    if (!allCategoriesValid) {
        showNotification('Please select category for all uploaded images.', 'error');
        if (firstInvalidSelect) {
            firstInvalidSelect.focus();
        }
        return false;
    }
    
    return true;
}

// Handle previous step
function handlePrevStep() {
    const currentStepInput = document.getElementById('currentStep');
    const currentStep = currentStepInput ? parseInt(currentStepInput.value) : 1;
    
    if (currentStep === 3) {
        showStep(2);
    } else if (currentStep === 2) {
        showStep(1);
    }
}

// Handle property type change
function handlePropertyTypeChange() {
    const propertyType = document.getElementById('propertyType');
    if (propertyType && propertyType.value) {
        // Step 2 content will be loaded when user navigates to step 2
        // This is just a placeholder for future implementation
    }
}

// Load step 2 content based on property type
function loadStep2Content() {
    const propertyType = document.getElementById('propertyType');
    const step2Content = document.getElementById('step2Content');
    
    if (!propertyType || !step2Content) return;
    
    const selectedType = propertyType.value;
    
    // Clear existing content
    step2Content.innerHTML = '';
    
    let content = '';
    
    switch(selectedType) {
        case 'apartments':
            content = generateApartmentsStep2();
            break;
        case 'villas':
            content = generateVillasStep2();
            break;
        case 'individual_house':
            content = generateIndividualHouseStep2();
            break;
        case 'plot_properties':
            content = generatePlotPropertiesStep2();
            break;
        default:
            content = '<div style="text-align: center; padding: 2rem; color: var(--text-gray);">Please select a property type in step 1.</div>';
    }
    
    step2Content.innerHTML = content;
    
    // Initialize any dynamic handlers after content is loaded
    initializeStep2Handlers(selectedType);
}

// Generate Step 2 content for Apartments
function generateApartmentsStep2() {
    return `
        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bed"></i>
                    Unit Type *
                </label>
                <div class="dashboard-unit-type-buttons" style="gap: 0.75rem;">
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="1" id="unitType1BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>1BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="2" id="unitType2BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>2BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="3" id="unitType3BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>3BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="4" id="unitType4BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>4BHK</span>
                    </button>
                </div>
                <input type="hidden" id="propertyBedrooms" name="bedrooms" value="1" required>
                <input type="hidden" id="propertyUnitType" name="unit_type" value="bhk">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyStatus" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="propertyStatus" name="status" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Status</option>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyListingType" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="propertyListingType" name="listing_type" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertySuperBuiltupArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-combined"></i>
                    Super Builtup Area (SBA) *
                </label>
                <input type="number" id="propertySuperBuiltupArea" name="super_builtup_area" placeholder="e.g., 1500" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyCarpetArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler"></i>
                    Carpet Area *
                </label>
                <input type="number" id="propertyCarpetArea" name="carpet_area" placeholder="e.g., 1200" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyDirection" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-compass"></i>
                    Direction *
                </label>
                <select id="propertyDirection" name="direction" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Direction</option>
                    <option value="east">East</option>
                    <option value="west">West</option>
                    <option value="north">North</option>
                    <option value="south">South</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-group" style="margin-bottom: 0;">
            <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                <i class="fas fa-check-circle"></i>
                Amenities *
            </label>
            <select id="propertyAmenities" name="amenities" multiple size="8" required style="width: 100%; padding: 1rem 1.25rem; border: 2px solid var(--border-color); border-radius: 10px; font-size: 1rem; font-family: 'Inter', sans-serif; min-height: 200px;">
                <option value="club_house">Club House</option>
                <option value="security">Security</option>
                <option value="24hr_backup">24hr Backup</option>
                <option value="rain_water_harvesting">Rain Water Harvesting</option>
                <option value="maintenance_staff">Maintenance Staff</option>
                <option value="intercom">Intercom</option>
                <option value="garden">Garden</option>
                <option value="community_hall">Community Hall</option>
                <option value="electricity_full">Electricity Full</option>
                <option value="electricity_partial">Electricity Partial</option>
                <option value="basketball_court">Basketball Court</option>
                <option value="play_area">Play Area</option>
                <option value="badminton_court">Badminton Court</option>
                <option value="swimming_pool">Swimming Pool</option>
                <option value="tennis_court">Tennis Court</option>
                <option value="gymnasium">Gymnasium</option>
                <option value="indoor_games">Indoor Games</option>
                <option value="banks_atm">Banks/ATM</option>
                <option value="cafeteria">Cafeteria</option>
                <option value="library">Library</option>
                <option value="health_facilities">Health Facilities</option>
                <option value="recreation_facilities">Recreation Facilities</option>
                <option value="wifi_broadband">WiFi Broadband Internet</option>
                <option value="temple">Temple</option>
            </select>
            <small style="color: var(--text-gray); font-size: 0.9rem; margin-top: 0.75rem; display: block;">Hold Ctrl (Windows) or Cmd (Mac) to select multiple amenities</small>
        </div>
    `;
}

// Generate Step 2 content for Villas
function generateVillasStep2() {
    return `
        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyVillaType" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-home"></i>
                    Villa Type *
                </label>
                <select id="propertyVillaType" name="villa_type" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Villa Type</option>
                    <option value="independent_villa">Independent Villa</option>
                    <option value="row_villa">Row Villa</option>
                    <option value="villament">Villament</option>
                </select>
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bed"></i>
                    Unit Type *
                </label>
                <div class="dashboard-unit-type-buttons" style="gap: 0.75rem;">
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="3" id="villaUnitType3BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>3BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="4" id="villaUnitType4BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>4BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="4plus" data-bedrooms="5" id="villaUnitType5PlusBHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>5+BHK</span>
                    </button>
                </div>
                <input type="hidden" id="propertyBedrooms" name="bedrooms" value="3" required>
                <input type="hidden" id="propertyUnitType" name="unit_type" value="bhk">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyListingType" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="propertyListingType" name="listing_type" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyStatus" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="propertyStatus" name="status" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Status</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="ready_to_move">Ready to Move</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row" id="villaPlotAreaRow" style="display: none; margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyPlotArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-combined"></i>
                    Plot Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyPlotArea" name="plot_area" placeholder="e.g., 2400" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" id="villaLengthBreadthRow" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyLength" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-horizontal"></i>
                    Length (Ft.)
                </label>
                <input type="number" id="propertyLength" name="length" placeholder="e.g., 50" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyBreadth" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-vertical"></i>
                    Breadth (Ft.)
                </label>
                <input type="number" id="propertyBreadth" name="breadth" placeholder="e.g., 30" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyBuildupArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-combined"></i>
                    Builtup Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyBuildupArea" name="buildup_area" placeholder="e.g., 2000" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyCarpetArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler"></i>
                    Carpet Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyCarpetArea" name="carpet_area" placeholder="e.g., 1800" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyBedroomsCount" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bed"></i>
                    Bedrooms *
                </label>
                <input type="number" id="propertyBedroomsCount" name="bedrooms_count" placeholder="e.g., 3" min="1" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyBathrooms" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bath"></i>
                    Bathrooms *
                </label>
                <input type="number" id="propertyBathrooms" name="bathrooms" placeholder="e.g., 2" min="1" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-group" style="margin-bottom: 0;">
            <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                <i class="fas fa-check-circle"></i>
                Amenities *
            </label>
            <select id="propertyAmenities" name="amenities" multiple size="8" required style="width: 100%; padding: 1rem 1.25rem; border: 2px solid var(--border-color); border-radius: 10px; font-size: 1rem; font-family: 'Inter', sans-serif; min-height: 200px;">
                <option value="club_house">Club House</option>
                <option value="security">Security</option>
                <option value="24hr_backup">24hr Backup</option>
                <option value="rain_water_harvesting">Rain Water Harvesting</option>
                <option value="maintenance_staff">Maintenance Staff</option>
                <option value="intercom">Intercom</option>
                <option value="garden">Garden</option>
                <option value="community_hall">Community Hall</option>
                <option value="electricity_full">Electricity Full</option>
                <option value="electricity_partial">Electricity Partial</option>
                <option value="basketball_court">Basketball Court</option>
                <option value="play_area">Play Area</option>
                <option value="badminton_court">Badminton Court</option>
                <option value="swimming_pool">Swimming Pool</option>
                <option value="tennis_court">Tennis Court</option>
                <option value="gymnasium">Gymnasium</option>
                <option value="indoor_games">Indoor Games</option>
                <option value="banks_atm">Banks/ATM</option>
                <option value="cafeteria">Cafeteria</option>
                <option value="library">Library</option>
                <option value="health_facilities">Health Facilities</option>
                <option value="recreation_facilities">Recreation Facilities</option>
                <option value="wifi_broadband">WiFi Broadband Internet</option>
                <option value="temple">Temple</option>
            </select>
            <small style="color: var(--text-gray); font-size: 0.9rem; margin-top: 0.75rem; display: block;">Hold Ctrl (Windows) or Cmd (Mac) to select multiple amenities</small>
        </div>
    `;
}

// Generate Step 2 content for Individual House
function generateIndividualHouseStep2() {
    return `
        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyVillaType" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-home"></i>
                    House Type *
                </label>
                <select id="propertyVillaType" name="villa_type" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select House Type</option>
                    <option value="independent_villa">Independent House</option>
                    <option value="row_villa">Row House</option>
                    <option value="villament">Villament</option>
                </select>
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bed"></i>
                    Unit Type *
                </label>
                <div class="dashboard-unit-type-buttons" style="gap: 0.75rem;">
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="3" id="houseUnitType3BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>3BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="bhk" data-bedrooms="4" id="houseUnitType4BHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>4BHK</span>
                    </button>
                    <button type="button" class="dashboard-unit-type-btn" data-unit-type="4plus" data-bedrooms="5" id="houseUnitType5PlusBHK" style="padding: 0.875rem 1.5rem; font-size: 1rem;">
                        <span>5+BHK</span>
                    </button>
                </div>
                <input type="hidden" id="propertyBedrooms" name="bedrooms" value="3" required>
                <input type="hidden" id="propertyUnitType" name="unit_type" value="bhk">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyListingType" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-list"></i>
                    Listing Type *
                </label>
                <select id="propertyListingType" name="listing_type" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Listing Type</option>
                    <option value="new">New</option>
                    <option value="resell">Resell</option>
                </select>
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyStatus" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="propertyStatus" name="status" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Status</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="ready_to_move">Ready to Move</option>
                </select>
            </div>
        </div>

        <div class="dashboard-form-row" id="housePlotAreaRow" style="display: none; margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyPlotArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-combined"></i>
                    Plot Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyPlotArea" name="plot_area" placeholder="e.g., 2400" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" id="houseLengthBreadthRow" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyLength" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-horizontal"></i>
                    Length (Ft.)
                </label>
                <input type="number" id="propertyLength" name="length" placeholder="e.g., 50" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyBreadth" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-vertical"></i>
                    Breadth (Ft.)
                </label>
                <input type="number" id="propertyBreadth" name="breadth" placeholder="e.g., 30" step="0.01" style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 1.5rem;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyBuildupArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler-combined"></i>
                    Builtup Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyBuildupArea" name="buildup_area" placeholder="e.g., 2000" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyCarpetArea" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-ruler"></i>
                    Carpet Area (Sq.Ft.) *
                </label>
                <input type="number" id="propertyCarpetArea" name="carpet_area" placeholder="e.g., 1800" step="0.01" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>

        <div class="dashboard-form-row" style="margin-bottom: 0;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyBedroomsCount" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bed"></i>
                    Bedrooms *
                </label>
                <input type="number" id="propertyBedroomsCount" name="bedrooms_count" placeholder="e.g., 3" min="1" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyBathrooms" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-bath"></i>
                    Bathrooms *
                </label>
                <input type="number" id="propertyBathrooms" name="bathrooms" placeholder="e.g., 2" min="1" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
        </div>
    `;
}

// Generate Step 2 content for Plot Properties
function generatePlotPropertiesStep2() {
    return `
        <div class="dashboard-form-row" style="margin-bottom: 0;">
            <div class="dashboard-form-group" style="flex: 1; margin-right: 1.5rem;">
                <label for="propertyPlotSection" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-map"></i>
                    Plot Section *
                </label>
                <input type="text" id="propertyPlotSection" name="plot_section" placeholder="e.g., Section A, Block 5" required style="padding: 1rem 1.25rem; font-size: 1rem;">
            </div>
            <div class="dashboard-form-group" style="flex: 1;">
                <label for="propertyStatus" style="font-size: 1rem; margin-bottom: 0.75rem; font-weight: 500;">
                    <i class="fas fa-tag"></i>
                    Status *
                </label>
                <select id="propertyStatus" name="status" required style="padding: 1rem 1.25rem; font-size: 1rem;">
                    <option value="">Select Status</option>
                    <option value="ready_to_move">Ready to Move</option>
                    <option value="under_development">Under Development</option>
                </select>
            </div>
        </div>
    `;
}

// Initialize step 2 handlers based on property type
function initializeStep2Handlers(propertyType) {
    // Initialize unit type buttons
    const unitTypeButtons = document.querySelectorAll('#step2 .dashboard-unit-type-btn');
    unitTypeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons in this group
            const parent = this.closest('.dashboard-form-group');
            if (parent) {
                const allButtons = parent.querySelectorAll('.dashboard-unit-type-btn');
                allButtons.forEach(b => b.classList.remove('active'));
            }
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update hidden inputs
            const bedroomsInput = document.getElementById('propertyBedrooms');
            const unitTypeInput = document.getElementById('propertyUnitType');
            if (bedroomsInput) bedroomsInput.value = this.dataset.bedrooms || '';
            if (unitTypeInput) unitTypeInput.value = this.dataset.unitType || '';
        });
        
        // Set first button as active by default
        if (btn === unitTypeButtons[0]) {
            btn.classList.add('active');
        }
    });
    
    // Handle villa type change for conditional plot area field and length/breadth fields
    if (propertyType === 'villas' || propertyType === 'individual_house') {
        const villaTypeSelect = document.getElementById('propertyVillaType');
        if (villaTypeSelect) {
            villaTypeSelect.addEventListener('change', function() {
                const plotAreaRow = document.getElementById(propertyType === 'villas' ? 'villaPlotAreaRow' : 'housePlotAreaRow');
                const plotAreaInput = document.getElementById('propertyPlotArea');
                const lengthBreadthRow = document.getElementById(propertyType === 'villas' ? 'villaLengthBreadthRow' : 'houseLengthBreadthRow');
                const lengthInput = document.getElementById('propertyLength');
                const breadthInput = document.getElementById('propertyBreadth');
                
                if (this.value === 'independent_villa') {
                    if (plotAreaRow) plotAreaRow.style.display = 'flex';
                    if (plotAreaInput) plotAreaInput.required = true;
                    if (lengthBreadthRow) lengthBreadthRow.style.display = 'flex';
                } else {
                    if (plotAreaRow) plotAreaRow.style.display = 'none';
                    if (plotAreaInput) {
                        plotAreaInput.required = false;
                        plotAreaInput.value = '';
                    }
                    // Hide Length and Breadth for row_villa and villament
                    if (lengthBreadthRow) lengthBreadthRow.style.display = 'none';
                    if (lengthInput) lengthInput.value = '';
                    if (breadthInput) breadthInput.value = '';
                }
            });
            
            // Trigger change event on page load to set initial state
            villaTypeSelect.dispatchEvent(new Event('change'));
        }
    }
}

// Populate Form
function populateForm(property) {
    const propertyId = document.getElementById('propertyId');
    const propertyTitle = document.getElementById('propertyTitle');
    const propertyLocation = document.getElementById('propertyLocation');
    const propertyPrice = document.getElementById('propertyPrice');
    const propertyType = document.getElementById('propertyType');
    const propertyStatus = document.getElementById('propertyStatus');
    const propertyDescription = document.getElementById('propertyDescription');
    
    // New fields
    const propertyBuilder = document.getElementById('propertyBuilder');
    const propertyConfiguration = document.getElementById('propertyConfiguration');
    const propertyPlotArea = document.getElementById('propertyPlotArea');
    const propertySuperBuiltUpArea = document.getElementById('propertySuperBuiltUpArea');
    const propertyTotalFlats = document.getElementById('propertyTotalFlats');
    const propertyTotalFloors = document.getElementById('propertyTotalFloors');
    const propertyTotalAcres = document.getElementById('propertyTotalAcres');
    
    if (propertyId) propertyId.value = property.id;
    if (propertyTitle) propertyTitle.value = property.title || '';
    if (propertyLocation) propertyLocation.value = property.location || '';
    // Price can be text or number - display as text
    if (propertyPrice) {
        // Use price_text if available (original text), otherwise use price (could be number or text)
        propertyPrice.value = property.price_text || property.price || '';
    }
    // Handle type - could be string or enum value
    if (propertyType) propertyType.value = typeof property.type === 'string' ? property.type : property.type?.value || '';
    // Handle status - could be string or enum value
    // Check if property_status exists (for ready_to_move), otherwise use status
    let statusValue = property.property_status || property.status;
    if (propertyStatus) {
        if (typeof statusValue === 'string') {
            propertyStatus.value = statusValue;
        } else {
            propertyStatus.value = statusValue?.value || '';
        }
    }
    
    // Extract description and additional details
    let descriptionText = property.description || '';
    if (propertyDescription) {
        // Check if description contains "--- Property Details ---"
        const detailsSeparator = '--- Property Details ---';
        if (descriptionText.includes(detailsSeparator)) {
            const parts = descriptionText.split(detailsSeparator);
            descriptionText = parts[0].trim();
            propertyDescription.value = descriptionText;
            
            // Parse additional details from the second part
            if (parts[1]) {
                const details = parts[1].trim().split('\n');
                details.forEach(detail => {
                    if (detail.includes(':')) {
                        const [key, ...valueParts] = detail.split(':');
                        const value = valueParts.join(':').trim();
                        const keyLower = key.trim().toLowerCase();
                        
                        if (keyLower.includes('builder') && propertyBuilder) {
                            propertyBuilder.value = value;
                        } else if (keyLower.includes('configuration') && propertyConfiguration) {
                            propertyConfiguration.value = value;
                        } else if (keyLower.includes('plot area') && propertyPlotArea) {
                            propertyPlotArea.value = value;
                        } else if (keyLower.includes('super built-up area') && propertySuperBuiltUpArea) {
                            propertySuperBuiltUpArea.value = value;
                        } else if (keyLower.includes('total flats') && propertyTotalFlats) {
                            propertyTotalFlats.value = value;
                        } else if (keyLower.includes('total floors') && propertyTotalFloors) {
                            propertyTotalFloors.value = value;
                        } else if (keyLower.includes('total acres') && propertyTotalAcres) {
                            propertyTotalAcres.value = value;
                        }
                    }
                });
            }
        } else {
            propertyDescription.value = descriptionText;
        }
    }
    
    // Populate new fields if they exist directly in property object (for future backend support)
    if (propertyBuilder && !propertyBuilder.value) propertyBuilder.value = property.builder || '';
    if (propertyConfiguration && !propertyConfiguration.value) propertyConfiguration.value = property.configuration || '';
    if (propertyPlotArea && !propertyPlotArea.value) propertyPlotArea.value = property.plot_area || '';
    if (propertySuperBuiltUpArea && !propertySuperBuiltUpArea.value) propertySuperBuiltUpArea.value = property.super_built_up_area || '';
    if (propertyTotalFlats && !propertyTotalFlats.value) propertyTotalFlats.value = property.total_flats || '';
    if (propertyTotalFloors && !propertyTotalFloors.value) propertyTotalFloors.value = property.total_floors || '';
    if (propertyTotalAcres && !propertyTotalAcres.value) propertyTotalAcres.value = property.total_acres || '';
    
    // Populate Unit Type based on bedrooms
    const bedrooms = property.bedrooms;
    const unitTypeInput = document.getElementById('propertyUnitType');
    const bedroomsInput = document.getElementById('propertyBedrooms');
    const unitTypeButtons = document.querySelectorAll('.dashboard-unit-type-btn');
    
    // Reset all unit type buttons
    unitTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    if (bedrooms !== undefined && bedrooms !== null) {
        let selectedButton = null;
        
        if (bedrooms === 0 || property.unit_type === 'rk') {
            // 1RK
            selectedButton = document.getElementById('dashboardUnitTypeRK');
            if (unitTypeInput) unitTypeInput.value = 'rk';
            if (bedroomsInput) bedroomsInput.value = '0';
        } else if (bedrooms >= 4) {
            // 4+BHK
            selectedButton = document.getElementById('dashboardUnitType4PlusBHK');
            if (unitTypeInput) unitTypeInput.value = '4plus';
            if (bedroomsInput) bedroomsInput.value = bedrooms.toString();
        } else if (bedrooms >= 1 && bedrooms <= 3) {
            // 1BHK, 2BHK, or 3BHK
            const buttonId = `dashboardUnitType${bedrooms}BHK`;
            selectedButton = document.getElementById(buttonId);
            if (unitTypeInput) unitTypeInput.value = 'bhk';
            if (bedroomsInput) bedroomsInput.value = bedrooms.toString();
        }
        
        if (selectedButton) {
            selectedButton.classList.add('active');
        } else {
            // Default to 1BHK if no match
            const defaultButton = document.getElementById('dashboardUnitType1BHK');
            if (defaultButton) {
                defaultButton.classList.add('active');
                if (unitTypeInput) unitTypeInput.value = 'bhk';
                if (bedroomsInput) bedroomsInput.value = '1';
            }
        }
    } else {
        // Default to 1BHK if no bedrooms value
        const defaultButton = document.getElementById('dashboardUnitType1BHK');
        if (defaultButton) {
            defaultButton.classList.add('active');
            if (unitTypeInput) unitTypeInput.value = 'bhk';
            if (bedroomsInput) bedroomsInput.value = '1';
        }
    }

    // Helper function to normalize image URLs (reuse from renderProperties)
    function normalizeImageUrl(url) {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return url;
        if (url.includes('.jpeg') || url.includes('.jpg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
            if (url.includes('/images/')) {
                return url.startsWith('/') ? url : '/' + url;
            }
            return '/images/properties/' + url;
        }
        return url.startsWith('/') ? url : '/' + url;
    }
    
    // Load images - handle API format (array of objects with image_url)
    if (property.images && property.images.length > 0) {
        property.images.forEach(image => {
            let imageUrl = null;
            if (typeof image === 'string') {
                imageUrl = image;
            } else if (image && image.image_url) {
                imageUrl = image.image_url;
            }
            if (imageUrl) {
                const normalizedUrl = normalizeImageUrl(imageUrl);
                if (normalizedUrl) {
                    addImagePreview(normalizedUrl, true);
                }
            }
        });
    }

    // Load features - handle API format (array of objects with feature_name)
    if (property.features && property.features.length > 0) {
        property.features.forEach(feature => {
            let featureName = null;
            if (typeof feature === 'string') {
                featureName = feature;
            } else if (feature && feature.feature_name) {
                featureName = feature.feature_name;
            }
            if (featureName) {
                addFeatureToList(featureName);
            }
        });
    }
}

// Populate Residential Form
function populateResidentialForm(property) {
    // Set property ID
    const propertyId = document.getElementById('residentialPropertyId');
    if (propertyId) propertyId.value = property.id || '';
    
    // Location fields - check if city/locality exist, otherwise parse from location
    const cityInput = document.getElementById('residentialCity');
    const localityInput = document.getElementById('residentialLocality');
    if (property.city && cityInput) {
        cityInput.value = property.city;
    } else if (property.location && cityInput) {
        // Try to extract city from location (e.g., "Bengaluru, Whitefield" -> "Bengaluru")
        const parts = property.location.split(',');
        cityInput.value = parts[0]?.trim() || '';
    }
    if (property.locality && localityInput) {
        localityInput.value = property.locality;
    } else if (property.location && localityInput) {
        // Try to extract locality from location
        const parts = property.location.split(',');
        localityInput.value = parts.length > 1 ? parts.slice(1).join(',').trim() : property.location;
    }
    
    // Other location fields
    const locationLinkInput = document.getElementById('residentialLocationLink');
    if (locationLinkInput) locationLinkInput.value = property.location_link || '';
    
    const directionsInput = document.getElementById('residentialDirections');
    if (directionsInput) directionsInput.value = property.directions || '';
    
    // Property name/title
    const propertyNameInput = document.getElementById('residentialPropertyName');
    if (propertyNameInput) propertyNameInput.value = property.property_name || property.title || '';
    
    // Property type
    const propertyTypeSelect = document.getElementById('residentialPropertyType');
    if (propertyTypeSelect) {
        const typeValue = typeof property.type === 'string' ? property.type : property.type?.value || '';
        propertyTypeSelect.value = typeValue;
    }
    
    // Unit type and bedrooms
    const bedrooms = property.bedrooms;
    const unitTypeInput = document.getElementById('residentialUnitType');
    const bedroomsInput = document.getElementById('residentialBedrooms');
    const unitTypeButtons = document.querySelectorAll('#residentialPropertyForm .dashboard-unit-type-btn');
    
    // Reset all unit type buttons
    unitTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    if (bedrooms !== undefined && bedrooms !== null) {
        let selectedButton = null;
        
        if (bedrooms === 0 || property.unit_type === 'rk') {
            selectedButton = document.getElementById('residentialUnitTypeRK');
            if (unitTypeInput) unitTypeInput.value = 'rk';
            if (bedroomsInput) bedroomsInput.value = '0';
        } else if (bedrooms >= 4) {
            selectedButton = document.getElementById('residentialUnitType4PlusBHK');
            if (unitTypeInput) unitTypeInput.value = '4plus';
            if (bedroomsInput) bedroomsInput.value = bedrooms.toString();
        } else if (bedrooms >= 1 && bedrooms <= 3) {
            const buttonId = `residentialUnitType${bedrooms}BHK`;
            selectedButton = document.getElementById(buttonId);
            if (unitTypeInput) unitTypeInput.value = 'bhk';
            if (bedroomsInput) bedroomsInput.value = bedrooms.toString();
        }
        
        if (selectedButton) {
            selectedButton.classList.add('active');
        } else {
            const defaultButton = document.getElementById('residentialUnitType1BHK');
            if (defaultButton) {
                defaultButton.classList.add('active');
                if (unitTypeInput) unitTypeInput.value = 'bhk';
                if (bedroomsInput) bedroomsInput.value = '1';
            }
        }
    }
    
    // Status
    const statusSelect = document.getElementById('residentialStatus');
    if (statusSelect) {
        const statusValue = property.property_status || property.status;
        statusSelect.value = typeof statusValue === 'string' ? statusValue : statusValue?.value || '';
    }
    
    // Area fields
    const buildupAreaInput = document.getElementById('residentialBuildupArea');
    if (buildupAreaInput) buildupAreaInput.value = property.buildup_area || property.area || '';
    
    const carpetAreaInput = document.getElementById('residentialCarpetArea');
    if (carpetAreaInput) carpetAreaInput.value = property.carpet_area || '';
    
    const lengthInput = document.getElementById('residentialLength');
    if (lengthInput) lengthInput.value = property.length || '';
    
    const breadthInput = document.getElementById('residentialBreadth');
    if (breadthInput) breadthInput.value = property.breadth || '';
    
    // Price
    const priceInput = document.getElementById('residentialPrice');
    if (priceInput) priceInput.value = property.price_text || property.price || '';
    
    // Price checkboxes
    const priceNegotiableCheckbox = document.getElementById('residentialPriceNegotiable');
    if (priceNegotiableCheckbox) priceNegotiableCheckbox.checked = property.price_negotiable || false;
    
    const priceIncludesRegistrationCheckbox = document.getElementById('residentialPriceIncludesRegistration');
    if (priceIncludesRegistrationCheckbox) priceIncludesRegistrationCheckbox.checked = property.price_includes_registration || false;
    
    // Description
    const descriptionTextarea = document.getElementById('residentialDescription');
    if (descriptionTextarea) descriptionTextarea.value = property.description || '';
    
    // Amenities
    const amenitiesSelect = document.getElementById('residentialAmenities');
    if (amenitiesSelect && property.amenities) {
        // Clear previous selections
        Array.from(amenitiesSelect.options).forEach(option => option.selected = false);
        
        // Handle amenities as array or string
        let amenitiesArray = [];
        if (Array.isArray(property.amenities)) {
            amenitiesArray = property.amenities.map(a => typeof a === 'string' ? a : a.value || a.amenity_name || '');
        } else if (typeof property.amenities === 'string') {
            try {
                amenitiesArray = JSON.parse(property.amenities);
            } catch (e) {
                amenitiesArray = property.amenities.split(',').map(a => a.trim());
            }
        }
        
        // Select matching options
        amenitiesArray.forEach(amenity => {
            const option = Array.from(amenitiesSelect.options).find(opt => opt.value === amenity);
            if (option) option.selected = true;
        });
    }
    
    // Load images
    if (property.images && property.images.length > 0) {
        property.images.forEach(image => {
            let imageUrl = null;
            if (typeof image === 'string') {
                imageUrl = image;
            } else if (image && image.image_url) {
                imageUrl = image.image_url;
            }
            if (imageUrl) {
                // Normalize image URL
                if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                    if (!imageUrl.startsWith('/')) {
                        imageUrl = '/' + imageUrl;
                    }
                }
                // Add to project images preview container
                addImagePreview(imageUrl, true, 'residential', 'project');
            }
        });
    }
}

// Populate Plot Form
function populatePlotForm(property) {
    // Set property ID
    const propertyId = document.getElementById('plotPropertyId');
    if (propertyId) propertyId.value = property.id || '';
    
    // Location fields
    const cityInput = document.getElementById('plotCity');
    const localityInput = document.getElementById('plotLocality');
    if (property.city && cityInput) {
        cityInput.value = property.city;
    } else if (property.location && cityInput) {
        const parts = property.location.split(',');
        cityInput.value = parts[0]?.trim() || '';
    }
    if (property.locality && localityInput) {
        localityInput.value = property.locality;
    } else if (property.location && localityInput) {
        const parts = property.location.split(',');
        localityInput.value = parts.length > 1 ? parts.slice(1).join(',').trim() : property.location;
    }
    
    // Other location fields
    const locationLinkInput = document.getElementById('plotLocationLink');
    if (locationLinkInput) locationLinkInput.value = property.location_link || '';
    
    const directionsInput = document.getElementById('plotDirections');
    if (directionsInput) directionsInput.value = property.directions || '';
    
    // Project name/title
    const projectNameInput = document.getElementById('plotProjectName');
    if (projectNameInput) projectNameInput.value = property.project_name || property.title || '';
    
    // Status
    const statusSelect = document.getElementById('plotStatus');
    if (statusSelect) {
        const statusValue = property.property_status || property.status;
        statusSelect.value = typeof statusValue === 'string' ? statusValue : statusValue?.value || '';
    }
    
    // Area fields
    const plotAreaInput = document.getElementById('plotArea');
    if (plotAreaInput) plotAreaInput.value = property.plot_area || property.area || '';
    
    const plotLengthInput = document.getElementById('plotLength');
    if (plotLengthInput) plotLengthInput.value = property.plot_length || property.length || '';
    
    const plotBreadthInput = document.getElementById('plotBreadth');
    if (plotBreadthInput) plotBreadthInput.value = property.plot_breadth || property.breadth || '';
    
    // Price
    const priceInput = document.getElementById('plotPrice');
    if (priceInput) priceInput.value = property.price_text || property.price || '';
    
    // Price checkboxes
    const priceNegotiableCheckbox = document.getElementById('plotPriceNegotiable');
    if (priceNegotiableCheckbox) priceNegotiableCheckbox.checked = property.price_negotiable || false;
    
    const priceIncludesRegistrationCheckbox = document.getElementById('plotPriceIncludesRegistration');
    if (priceIncludesRegistrationCheckbox) priceIncludesRegistrationCheckbox.checked = property.price_includes_registration || false;
    
    // Description
    const descriptionTextarea = document.getElementById('plotDescription');
    if (descriptionTextarea) descriptionTextarea.value = property.description || '';
    
    // Amenities
    const amenitiesSelect = document.getElementById('plotAmenities');
    if (amenitiesSelect && property.amenities) {
        // Clear previous selections
        Array.from(amenitiesSelect.options).forEach(option => option.selected = false);
        
        // Handle amenities as array or string
        let amenitiesArray = [];
        if (Array.isArray(property.amenities)) {
            amenitiesArray = property.amenities.map(a => typeof a === 'string' ? a : a.value || a.amenity_name || '');
        } else if (typeof property.amenities === 'string') {
            try {
                amenitiesArray = JSON.parse(property.amenities);
            } catch (e) {
                amenitiesArray = property.amenities.split(',').map(a => a.trim());
            }
        }
        
        // Select matching options
        amenitiesArray.forEach(amenity => {
            const option = Array.from(amenitiesSelect.options).find(opt => opt.value === amenity);
            if (option) option.selected = true;
        });
    }
    
    // Load images
    if (property.images && property.images.length > 0) {
        property.images.forEach(image => {
            let imageUrl = null;
            if (typeof image === 'string') {
                imageUrl = image;
            } else if (image && image.image_url) {
                imageUrl = image.image_url;
            }
            if (imageUrl) {
                // Normalize image URL
                if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                    if (!imageUrl.startsWith('/')) {
                        imageUrl = '/' + imageUrl;
                    }
                }
                // Add to project images preview container
                addImagePreview(imageUrl, true, 'plot', 'project');
            }
        });
    }
}

// Handle Property Submit
async function handlePropertySubmit(e) {
    e.preventDefault();
    
    // Ensure we're on step 3 before submitting
    const currentStepInput = document.getElementById('currentStep');
    const currentStep = currentStepInput ? parseInt(currentStepInput.value) : 1;
    
    if (currentStep !== 3) {
        // Navigate to step 3 first
        showStep(3);
        showNotification('Please complete all steps before submitting. Navigated to Step 3.', 'warning');
        return;
    }
    
    const formData = new FormData(e.target);
    // Get property ID from form data
    let propertyId = formData.get('id');
    
    // CRITICAL FIX: Also check the input element directly as fallback
    // form.reset() might have cleared it from FormData, so check the actual input value
    if (!propertyId || propertyId === '' || propertyId === 'null') {
        const propertyIdInput = document.getElementById('propertyId');
        if (propertyIdInput && propertyIdInput.value) {
            propertyId = propertyIdInput.value;
        }
    }
    
    // Normalize propertyId - convert to string and trim
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
    
    // Extract form data from actual form fields (multi-step form)
    const projectNameInput = document.getElementById('propertyProjectName');
    const cityInput = document.getElementById('propertyCity');
    const localityInput = document.getElementById('propertyLocality');
    const propertyTypeSelect = document.getElementById('propertyType');
    const descriptionInput = document.getElementById('propertyDescription');
    
    const projectName = projectNameInput?.value?.trim();
    const city = cityInput?.value?.trim();
    const locality = localityInput?.value?.trim();
    const propertyType = propertyTypeSelect?.value;
    const description = descriptionInput?.value?.trim();
    
    // Step 1 fields - Price moved to Step 1
    const priceInput = document.getElementById('propertyPrice');
    const price = priceInput?.value?.trim();
    
    // Step 2 fields (dynamically loaded based on property type)
    const statusSelect = document.getElementById('propertyStatus');
    const status = statusSelect?.value;
    
    // Build title and location from available fields
    const title = projectName || formData.get('title')?.trim() || '';
    const location = (city && locality) ? `${city}, ${locality}` : (city || locality || formData.get('location')?.trim() || '');
    
    // Extract type from propertyType select
    const type = propertyType || formData.get('type') || '';
    
    // Optional fields (may not exist for all property types)
    const builder = document.getElementById('propertyBuilder')?.value?.trim() || formData.get('builder')?.trim() || '';
    const configuration = document.getElementById('propertyConfiguration')?.value?.trim() || formData.get('configuration')?.trim() || '';
    const plotArea = document.getElementById('propertyPlotArea')?.value?.trim() || formData.get('plot_area')?.trim() || '';
    const superBuiltUpArea = document.getElementById('propertySuperBuiltupArea')?.value?.trim() || formData.get('super_builtup_area')?.trim() || formData.get('super_built_up_area')?.trim() || '';
    const totalFlats = document.getElementById('propertyTotalFlats')?.value?.trim() || formData.get('total_flats')?.trim() || '';
    const totalFloors = document.getElementById('propertyTotalFloors')?.value?.trim() || formData.get('total_floors')?.trim() || '';
    const totalAcres = document.getElementById('propertyTotalAcres')?.value?.trim() || formData.get('total_acres')?.trim() || '';
    
    // Validate required fields from step 1
    const missingStep1Fields = [];
    if (!projectName) missingStep1Fields.push('Project Name');
    if (!city) missingStep1Fields.push('City');
    if (!locality) missingStep1Fields.push('Locality');
    if (!propertyType) missingStep1Fields.push('Property Type');
    if (!price) missingStep1Fields.push('Price');
    
    if (missingStep1Fields.length > 0) {
        showNotification(`Please fill in all required fields from Step 1: ${missingStep1Fields.join(', ')}.`, 'error');
        // Navigate to step 1 and focus on first missing field
        showStep(1);
        setTimeout(() => {
            if (!projectName && projectNameInput) projectNameInput.focus();
            else if (!city && cityInput) cityInput.focus();
            else if (!locality && localityInput) localityInput.focus();
            else if (!propertyType && propertyTypeSelect) propertyTypeSelect.focus();
            else if (!price && priceInput) priceInput.focus();
        }, 100);
        return;
    }
    
    // Validate required fields from step 2 (varies by property type)
    const missingStep2Fields = [];
    if (!status) missingStep2Fields.push('Status');
    
    if (missingStep2Fields.length > 0) {
        showNotification(`Please fill in all required fields from Step 2: ${missingStep2Fields.join(', ')}.`, 'error');
        // Navigate to step 2 and focus on first missing field
        showStep(2);
        setTimeout(() => {
            if (!status && statusSelect) statusSelect.focus();
        }, 100);
        return;
    }
    
    // Validate required fields from step 3 (description is already validated by validateStep3, but double-check)
    if (!description) {
        showNotification('Please fill in the property description.', 'error');
        // Stay on step 3 and focus on description
        if (descriptionInput) descriptionInput.focus();
        return;
    }
    
    // Note: builder, configuration, superBuiltUpArea, totalFlats, totalFloors, totalAcres are optional
    // They may not be required for all property types, so we don't validate them here
    
    // Get images - extract URLs from image previews with categories
    // Check gallery images from Step 3 (gallery-image-preview containers)
    const galleryImagesContainer = document.getElementById('galleryImagesContainer');
    const images = [];
    
    if (galleryImagesContainer) {
        // Get all image rows in the gallery
        const imageRows = galleryImagesContainer.querySelectorAll('.gallery-image-row');
        
        imageRows.forEach((row) => {
            // Find preview container - search for any preview container in this row
            const previewContainer = row.querySelector('[id^="imagePreview_"]');
            if (!previewContainer) return;
            
            // Check if preview is visible (not display: none)
            const computedStyle = window.getComputedStyle(previewContainer);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
            
            // Get the image element or data URL from attribute
            const img = previewContainer.querySelector('img');
            let imageSrc = null;
            
            // Check data attribute first (for existing images)
            if (previewContainer.getAttribute('data-image-url')) {
                imageSrc = previewContainer.getAttribute('data-image-url');
            } else if (img) {
                // Check img src attribute or data-image-src
                imageSrc = img.getAttribute('data-image-src') || img.src;
            }
            
            if (!imageSrc || imageSrc.trim() === '') return;
            
            // Skip placeholder/empty images
            if (imageSrc.includes('data:image/svg+xml') || 
                imageSrc.includes('placeholder') ||
                imageSrc.includes('blank') ||
                imageSrc === 'undefined' ||
                imageSrc === 'null') {
                return;
            }
            
            // Extract index from preview ID for getting category
            const previewIdMatch = previewContainer.id.match(/imagePreview_(\d+)/);
            const previewIndex = previewIdMatch ? parseInt(previewIdMatch[1]) : null;
            
            // Get the category for this image
            let imageCategory = 'project_image'; // Default
            if (previewIndex !== null) {
                const categorySelect = row.querySelector(`#imageCategory_${previewIndex}`);
                if (categorySelect && categorySelect.value) {
                    imageCategory = categorySelect.value;
                }
            }
            
            // Check if it's a base64 data URL (data:image/...)
            if (imageSrc.startsWith('data:')) {
                // Base64 data URL - check if it's too long
                if (imageSrc.length > 5000000) { // ~5MB base64 (very large)
                    showNotification('Image is too large. Please use a smaller image (max 5MB).', 'error');
                    return;
                }
            }
            
            // Add image with category info
            const imageTitle = previewIndex !== null ? (row.querySelector(`#imageTitle_${previewIndex}`)?.value || '') : '';
            images.push({
                url: imageSrc,
                category: imageCategory,
                title: imageTitle
            });
        });
    }
    
    // Double-check: If we have file inputs with files but no previews collected, 
    // trigger the preview creation (this shouldn't normally happen, but ensures completeness)
    const imageInputs = document.querySelectorAll('.gallery-image-input');
    imageInputs.forEach((input) => {
        if (input.files && input.files.length > 0) {
            const row = input.closest('.gallery-image-row');
            if (!row) return;
            
            const inputIdMatch = input.id.match(/imageFile_(\d+)/);
            const inputIndex = inputIdMatch ? parseInt(inputIdMatch[1]) : null;
            
            if (inputIndex !== null) {
                const previewContainer = row.querySelector(`#imagePreview_${inputIndex}`);
                const hasPreview = previewContainer && 
                                 previewContainer.style.display !== 'none' && 
                                 previewContainer.querySelector('img');
                
                // If file exists but no preview, trigger change event to create preview
                // This ensures the preview is created before collection
                if (!hasPreview) {
                    // Trigger change event to create preview
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    });
    
    // Extract just the URLs for backward compatibility (backend currently expects flat array)
    const imageUrls = images.map(img => img.url);

    // Gallery images are optional for now - allow submission without images
    // if (imageUrls.length === 0) {
    //     if (!propertyId) {
    //         // New property must have at least one image
    //         showNotification('Please add at least one property image.', 'error');
    //         return;
    //     } else {
    //         // When editing, check if property already has images from API
    //         // If we're editing and no images in preview, we should still require at least one
    //         // This prevents accidentally removing all images
    //         showNotification('Please add at least one property image. You can keep existing images or upload new ones.', 'error');
    //         return;
    //     }
    // }

    // Get features
    const featureItems = document.querySelectorAll('.dashboard-feature-item');
    const features = Array.from(featureItems).map(item => {
        if (!item) return null;
        const textElement = item.querySelector('.dashboard-feature-text');
        return textElement ? textElement.textContent : null;
    }).filter(Boolean);

    // Keep description clean - don't append additional details
    let fullDescription = description;
    
    // Ensure price is a valid number for backend (must be > 0)
    // If price is text, try to extract a numeric value, otherwise use a default
    let finalPrice = 1; // Default value (backend requires > 0)
    if (price) {
        const priceStr = String(price).trim();
        
        // Try to extract price value from text like "3BHK: Rs.3.32 Cr, 4BHK: Rs.3.72 Cr"
        // or "Rs. 3.32 Cr" or "3.32 Cr" etc.
        // Strategy: Look for prices after "Rs." and convert based on unit (Cr/Lakh)
        
        let bestValue = 0;
        
        // Pattern 1: Match "Rs. 3.32 Cr" or "Rs.3.32 Cr" (crores) - most common
        // IMPORTANT: Use a more specific pattern that requires decimal point or is clearly a price
        const croreMatch = priceStr.match(/Rs\.?\s*([\d,]+\.\d+)\s*Cr/i);
        if (croreMatch) {
            const numericStr = croreMatch[1].replace(/,/g, '');
            const parsedValue = parseFloat(numericStr);
            if (!isNaN(parsedValue) && parsedValue > 0) {
                bestValue = parsedValue * 10000000; // Convert crores to actual value
            }
        }
        
        // Pattern 1b: Match "Rs. 3 Cr" (integer crores) - but only if it's clearly a price (not part of BHK)
        if (bestValue === 0) {
            const croreMatchInt = priceStr.match(/Rs\.?\s*(\d{2,})\s*Cr/i);
            if (croreMatchInt) {
                // Check that this is not part of "3BHK" pattern
                const beforeMatch = priceStr.substring(Math.max(0, priceStr.indexOf(croreMatchInt[0]) - 10), priceStr.indexOf(croreMatchInt[0]));
                if (!beforeMatch.match(/\d+BHK/i)) {
                    const numericStr = croreMatchInt[1].replace(/,/g, '');
                    const parsedValue = parseFloat(numericStr);
                    if (!isNaN(parsedValue) && parsedValue > 0 && parsedValue >= 10) {
                        bestValue = parsedValue * 10000000;
                    }
                }
            }
        }
        
        // Pattern 2: Match "Rs. 3.32 Lakh" or "Rs.3.32 Lakh" (lakhs)
        if (bestValue === 0) {
            const lakhMatch = priceStr.match(/Rs\.?\s*([\d,]+\.\d+)\s*Lakh/i);
            if (lakhMatch) {
                const numericStr = lakhMatch[1].replace(/,/g, '');
                const parsedValue = parseFloat(numericStr);
                if (!isNaN(parsedValue) && parsedValue > 0) {
                    bestValue = parsedValue * 100000; // Convert lakhs to actual value
                }
            }
        }
        
        // Pattern 3: Match standalone "3.32 Cr" or "3.32 Lakh" (without Rs.) - but NOT if it's part of BHK
        if (bestValue === 0) {
            const standaloneMatch = priceStr.match(/([\d,]+\.\d+)\s*(Cr|Lakh|Crore)/i);
            if (standaloneMatch) {
                // Check that this is not part of "3BHK" pattern
                const matchIndex = priceStr.indexOf(standaloneMatch[0]);
                const beforeMatch = priceStr.substring(Math.max(0, matchIndex - 10), matchIndex);
                if (!beforeMatch.match(/\d+BHK/i)) {
                    const numericStr = standaloneMatch[1].replace(/,/g, '');
                    const parsedValue = parseFloat(numericStr);
                    const unit = standaloneMatch[2].toLowerCase();
                    if (!isNaN(parsedValue) && parsedValue > 0) {
                        if (unit.includes('cr') || unit.includes('crore')) {
                            bestValue = parsedValue * 10000000;
                        } else if (unit.includes('lakh')) {
                            bestValue = parsedValue * 100000;
                        }
                    }
                }
            }
        }
        
        // Pattern 4: Match "Rs. 3.32" (decimal with Rs., assume crores if < 100)
        // This should only match if there's a decimal point to avoid matching "Rs. 3" from "3BHK: Rs.3.32"
        if (bestValue === 0) {
            const rsMatch = priceStr.match(/Rs\.?\s*([\d,]+\.\d+)(?!\s*(Cr|Lakh|K|BHK))/i);
            if (rsMatch) {
                const numericStr = rsMatch[1].replace(/,/g, '');
                const parsedValue = parseFloat(numericStr);
                if (!isNaN(parsedValue) && parsedValue > 0 && parsedValue < 100) {
                    bestValue = parsedValue * 10000000; // Assume crores
                }
            }
        }
        
        // Pattern 5: Last resort - find decimal numbers that are NOT part of "3BHK" pattern
        // Only use this if we haven't found anything yet
        if (bestValue === 0) {
            // Find all decimal numbers (must have decimal point)
            const decimalMatches = priceStr.matchAll(/([\d,]+\.\d+)/g);
            for (const match of decimalMatches) {
                // Check if this is NOT part of "3BHK" pattern
                const beforeMatch = priceStr.substring(Math.max(0, match.index - 10), match.index);
                const afterMatch = priceStr.substring(match.index + match[0].length, match.index + match[0].length + 10);
                
                // Skip if it's clearly part of BHK pattern
                if (!beforeMatch.match(/\d+BHK$/i) && !afterMatch.match(/^BHK/i)) {
                    // Also check if it's near "Rs." which makes it more likely to be a price
                    const context = priceStr.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20);
                    if (context.includes('Rs.') || context.includes('Cr') || context.includes('Lakh')) {
                        const numericStr = match[1].replace(/,/g, '');
                        const parsedValue = parseFloat(numericStr);
                        if (!isNaN(parsedValue) && parsedValue > 0 && parsedValue < 100) {
                            // Small decimal numbers are likely in crores
                            const candidateValue = parsedValue * 10000000;
                            if (candidateValue > bestValue) {
                                bestValue = candidateValue;
                            }
                        }
                    }
                }
            }
        }
        
        if (bestValue > 0) {
            finalPrice = bestValue;
        } else {
            // Final fallback: if no pattern matches, use 1 (backend requires > 0)
            // The price_text will still be stored correctly for display
            console.warn('Could not extract numeric price from:', priceStr, '- using default value 1');
            console.warn('This usually means the price format is not recognized. Please use formats like:');
            console.warn('  - "Rs. 3.32 Cr"');
            console.warn('  - "3BHK: Rs.3.32 Cr, 4BHK: Rs.3.72 Cr"');
            console.warn('  - "Rs. 3.32 Lakh"');
        }
    }
    
    // Validate extracted price - if it's suspiciously small and price_text doesn't look right, warn user
    if (finalPrice < 100 && price) {
        const priceStr = String(price).trim();
        // Check if price_text looks like it might be wrong (just "Rs.3" or similar)
        if (priceStr.match(/^Rs\.?\s*\d\s*$/i) || priceStr.match(/^Rs\.?\s*\d\s*Cr$/i)) {
            showNotification('Warning: The price appears to be incorrectly extracted. Please use a format like "Rs. 3.32 Cr" or "3BHK: Rs.3.32 Cr".', 'warning');
        }
    }
    
    // Get Step 1 additional fields
    const locationLinkInput = document.getElementById('propertyLocationLink');
    const locationLink = locationLinkInput?.value?.trim() || '';
    
    // Get Step 2 fields based on property type
    const bedroomsInput = document.getElementById('propertyBedrooms');
    const unitTypeInput = document.getElementById('propertyUnitType');
    const bedrooms = bedroomsInput ? parseInt(bedroomsInput.value) || 1 : 1;
    const unitType = unitTypeInput ? unitTypeInput.value : 'bhk';
    
    // Get Step 2 specific fields
    const superBuiltupAreaInput = document.getElementById('propertySuperBuiltupArea');
    const carpetAreaInput = document.getElementById('propertyCarpetArea');
    const buildupAreaInput = document.getElementById('propertyBuildupArea');
    const listingTypeInput = document.getElementById('propertyListingType');
    const directionInput = document.getElementById('propertyDirection');
    const bathroomsInput = document.getElementById('propertyBathrooms');
    const bedroomsCountInput = document.getElementById('propertyBedroomsCount');
    const lengthInput = document.getElementById('propertyLength');
    const breadthInput = document.getElementById('propertyBreadth');
    const priceNegotiableInput = document.getElementById('propertyPriceNegotiable');
    const amenitiesSelect = document.getElementById('propertyAmenities');
    
    // Extract Step 2 values
    const superBuiltupArea = superBuiltupAreaInput?.value?.trim() || '';
    const carpetArea = carpetAreaInput?.value?.trim() || '';
    const buildupArea = buildupAreaInput?.value?.trim() || '';
    const listingType = listingTypeInput?.value || '';
    const direction = directionInput?.value || '';
    const bathrooms = bathroomsInput ? parseFloat(bathroomsInput.value) || 1.0 : 1.0;
    const bedroomsCount = bedroomsCountInput ? parseInt(bedroomsCountInput.value) || bedrooms : bedrooms;
    const length = lengthInput?.value ? parseFloat(lengthInput.value) : null;
    const breadth = breadthInput?.value ? parseFloat(breadthInput.value) : null;
    const priceNegotiable = priceNegotiableInput?.checked || false;
    
    // Get amenities/features from select (if exists)
    let amenitiesArray = [];
    if (amenitiesSelect) {
        amenitiesArray = Array.from(amenitiesSelect.selectedOptions).map(opt => opt.value);
    }
    // Use amenities if available, otherwise use features from step 3
    const finalFeatures = amenitiesArray.length > 0 ? amenitiesArray : features;
    
    // Ensure bedrooms is at least 1 for backend (except for RK which is 0)
    const finalBedrooms = (unitType === 'rk') ? 0 : Math.max(1, bedroomsCount || bedrooms);
    
    // Determine which endpoint to use based on property type
    const isPlotProperty = propertyType === 'plot_properties';
    
    // Build property data with all Step 1 and Step 2 fields
    const propertyData = {
        // Step 1 fields - REQUIRED by backend
        city: city,
        locality: locality,
        property_name: isPlotProperty ? null : projectName, // For residential properties
        project_name: isPlotProperty ? projectName : null, // For plot properties
        location_link: locationLink || null,
        
        // Step 2 common fields
        price: finalPrice, // Must be a float > 0 for backend
        price_text: price ? String(price).trim() : null,
        price_negotiable: priceNegotiable,
        status: (() => {
            if (status === 'resale' || status === 'new' || status === 'ready_to_move' || status === 'under_construction') {
                return 'sale'; // These are all sale-related statuses
            }
            return status || 'sale';
        })(),
        property_status: status || null, // Store the actual status (resale, new, ready_to_move, under_construction, sale, rent)
        listing_type: listingType || null,
        direction: direction || null,
        
        // Step 2 fields for residential properties
        type: isPlotProperty ? 'plot' : (type || 'apartment'),
        unit_type: isPlotProperty ? null : (unitType || 'bhk'),
        bedrooms: isPlotProperty ? null : finalBedrooms,
        bathrooms: isPlotProperty ? null : bathrooms,
        buildup_area: isPlotProperty ? null : (buildupArea ? parseFloat(buildupArea) : null),
        carpet_area: isPlotProperty ? null : (carpetArea ? parseFloat(carpetArea) : null),
        super_built_up_area: isPlotProperty ? null : (superBuiltupArea ? parseFloat(superBuiltupArea) : null),
        length: isPlotProperty ? null : length,
        breadth: isPlotProperty ? null : breadth,
        
        // Step 2 fields for plot properties
        plot_area: isPlotProperty ? (plotArea ? parseFloat(plotArea) : null) : null,
        plot_length: isPlotProperty ? (document.getElementById('propertyPlotLength')?.value ? parseFloat(document.getElementById('propertyPlotLength').value) : null) : null,
        plot_breadth: isPlotProperty ? (document.getElementById('propertyPlotBreadth')?.value ? parseFloat(document.getElementById('propertyPlotBreadth').value) : null) : null,
        
        // Common optional fields
        builder: builder || null,
        configuration: configuration || null,
        total_flats: totalFlats ? parseInt(totalFlats) : null,
        total_floors: totalFloors ? parseInt(totalFloors) : null,
        total_acres: totalAcres ? parseFloat(totalAcres) : null,
        
        // Step 3 fields
        description: fullDescription,
        images: imageUrls.length > 0 ? imageUrls : null,
        features: finalFeatures,
        
        // Metadata
        is_active: true,
        is_featured: false
    };

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        let response;
        if (propertyId) {
            // Update existing property - use generic endpoint (backend handles both types)
            response = await authenticatedFetch(`/api/properties/${propertyId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(propertyData)
            });
        } else {
            // Create new property - use specific endpoint based on property type
            const endpoint = isPlotProperty ? '/api/plot-properties' : '/api/residential-properties';
            response = await authenticatedFetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(propertyData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            // Handle Pydantic validation errors (422)
            let errorMessage = 'Failed to save property';
            if (errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    // Pydantic validation errors are in array format
                    errorMessage = errorData.detail.map(err => {
                        const field = err.loc ? err.loc.join('.') : 'field';
                        return `${field}: ${err.msg}`;
                    }).join(', ');
                } else if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else {
                    errorMessage = JSON.stringify(errorData.detail);
                }
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
            throw new Error(errorMessage);
        }

        // Reload properties and stats with force refresh to bypass cache
        await loadProperties(true);
        closePropertyModal();
        
        // Show success message
        showNotification(propertyId ? 'Property updated successfully!' : 'Property added successfully!');
    } catch (error) {
        console.error('Error saving property:', error);
        showNotification(error.message || 'Failed to save property. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Open Residential Property Modal
async function openResidentialPropertyModal(propertyId = null) {
    const modal = document.getElementById('residentialPropertyModal');
    const form = document.getElementById('residentialPropertyForm');
    const modalTitle = document.getElementById('residentialModalTitle');
    
    if (!modal || !form) return;

    // Get property ID input reference BEFORE resetting form
    const propertyIdInput = document.getElementById('residentialPropertyId');
    const tempPropertyId = propertyId;
    
    // Reset form (this clears all inputs including hidden propertyId)
    form.reset();
    
    // CRITICAL FIX: Restore property ID immediately after reset if in edit mode
    if (tempPropertyId && propertyIdInput) {
        propertyIdInput.value = tempPropertyId;
    } else if (propertyIdInput) {
        propertyIdInput.value = '';
    }
    
    clearResidentialImagePreviews();
    
    // Reset unit type buttons
    const unitTypeButtons = document.querySelectorAll('#residentialPropertyForm .dashboard-unit-type-btn');
    unitTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    // Set default to 1BHK
    const defaultButton = document.getElementById('residentialUnitType1BHK');
    const bedroomsInput = document.getElementById('residentialBedrooms');
    const unitTypeInput = document.getElementById('residentialUnitType');
    if (defaultButton) {
        defaultButton.classList.add('active');
        if (bedroomsInput) bedroomsInput.value = '1';
        if (unitTypeInput) unitTypeInput.value = 'bhk';
    }

    if (propertyId) {
        modalTitle.textContent = 'Edit Other Property';
        // Fetch property data for editing
        try {
            const response = await fetch(`/api/properties/${propertyId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch property');
            }
            const property = await response.json();
            populateResidentialForm(property);
            // CRITICAL: Ensure property ID is set after populating form
            const propertyIdInput = document.getElementById('residentialPropertyId');
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

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Residential Property Modal
function closeResidentialPropertyModal() {
    const modal = document.getElementById('residentialPropertyModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Handle Residential Property Submit
async function handleResidentialPropertySubmit(e) {
    e.preventDefault();
    
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
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    
    // Extract form data
    const data = {
        city: formData.get('city'),
        locality: formData.get('locality'),
        location_link: formData.get('location_link') || null,
        directions: formData.get('directions') || null,
        property_name: formData.get('property_name'),
        type: formData.get('type'),
        unit_type: formData.get('unit_type') || 'bhk',
        bedrooms: parseInt(formData.get('bedrooms') || '1'),
        buildup_area: parseFloat(formData.get('buildup_area') || '0'),
        carpet_area: parseFloat(formData.get('carpet_area') || '0'),
        length: formData.get('length') ? parseFloat(formData.get('length')) : null,
        breadth: formData.get('breadth') ? parseFloat(formData.get('breadth')) : null,
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
        is_featured: formData.get('is_featured') === 'on',
        is_active: true,
        images: [],
        features: []
    };
    
    // Get images from all three categories
    const projectImages = document.querySelectorAll('#residentialProjectImagePreviewContainer .dashboard-image-preview img');
    const floorPlanImages = document.querySelectorAll('#residentialFloorPlanImagePreviewContainer .dashboard-image-preview img');
    const masterPlanImages = document.querySelectorAll('#residentialMasterPlanImagePreviewContainer .dashboard-image-preview img');
    
    // Combine all images (project images first, then floor plan, then master plan)
    data.images = [
        ...Array.from(projectImages).map(img => img.src),
        ...Array.from(floorPlanImages).map(img => img.src),
        ...Array.from(masterPlanImages).map(img => img.src)
    ];
    
    // Get features/amenities
    const amenitiesSelect = document.getElementById('residentialAmenities');
    if (amenitiesSelect) {
        data.features = Array.from(amenitiesSelect.selectedOptions).map(opt => opt.value);
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
            response = await authenticatedFetch('/api/residential-properties', {
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
        city: formData.get('city'),
        locality: formData.get('locality'),
        location_link: formData.get('location_link') || null,
        directions: formData.get('directions') || null,
        project_name: formData.get('project_name'),
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
    const amenitiesSelect = document.getElementById('plotAmenities');
    if (amenitiesSelect) {
        data.features = Array.from(amenitiesSelect.selectedOptions).map(opt => opt.value);
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
            response = await authenticatedFetch('/api/plot-properties', {
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
    try {
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
        
        // Validate property data
        if (!property || !property.id) {
            throw new Error('Invalid property data received');
        }
        
        // Use unified property modal for editing
        openPropertyModal(id);
    } catch (error) {
        console.error('Error loading property:', error);
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

// Confirm Delete
async function confirmDelete() {
    const id = window.currentDeleteId;
    const type = window.currentDeleteType || 'property';
    if (!id) return;

    try {
        let response;
        if (type === 'testimonial') {
            response = await authenticatedFetch(`/api/testimonials/${id}`, {
                method: 'DELETE'
            });
        } else if (type === 'partner') {
            response = await authenticatedFetch(`/api/partners/${id}`, {
                method: 'DELETE'
            });
        } else {
            response = await authenticatedFetch(`/api/properties/${id}`, {
                method: 'DELETE'
            });
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Failed to delete ${type}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Close modal and reload page instead of updating display immediately
        closeDeleteModal();
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`, 'success');
        
        // CRITICAL FIX: Set flag to indicate this is a page reload, not a tab closure
        // This prevents the session manager from clearing the session during reload
        // Set in BOTH sessionStorage and localStorage for maximum reliability
        try {
            sessionStorage.setItem('_page_reload', 'true');
            localStorage.setItem('_page_reload', 'true');
        } catch (e) {
            console.error('Error setting reload flag:', e);
        }
        
        // Reload the page after a short delay to show the notification
        // Use a shorter delay to ensure flag is set before any cleanup runs
        setTimeout(() => {
            window.location.reload();
        }, 100);
    } catch (error) {
        console.error(`Error deleting ${type}:`, error);
        showNotification(error.message || `Failed to delete ${type}. Please try again.`, 'error');
    }
}

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
        
        // Read file as base64
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
            const uploadedUrl = result.image_url;
            
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
    
    preview.innerHTML = `
        <div style="position: relative;">
            <img src="${imageSrc}" alt="Property image">
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
        img.src = newImageSrc;
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
    // Clear project images
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
    
    if (!tbody) return;

    if (testimonials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No testimonials found</td></tr>';
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
                    <button class="dashboard-action-btn ${testimonial.is_approved ? 'delete' : 'edit'}" 
                            onclick="toggleTestimonialApproval(${testimonial.id}, ${!testimonial.is_approved})" 
                            title="${testimonial.is_approved ? 'Unapprove' : 'Approve'}">
                        <i class="fas fa-${testimonial.is_approved ? 'check-circle' : 'clock'}"></i>
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
            // Create new testimonial (public endpoint, no auth needed)
            response = await fetch('/api/testimonials', {
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
    
    if (!tbody) return;

    if (partners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No partners found</td></tr>';
        return;
    }

    // Render table row with 5 columns: Logo, Name, Website, Display Order, Actions (NO STATUS COLUMN)
    tbody.innerHTML = partners.map(partner => {
        return `
        <tr>
            <td>
                <div class="dashboard-table-image">
                    ${partner.logo_url 
                        ? `<img src="${escapeHtml(partner.logo_url)}" alt="${escapeHtml(partner.name)}" style="max-width: 80px; max-height: 60px; object-fit: contain;" onerror="this.style.display='none'; const fallback = this.nextElementSibling; if (fallback && fallback.style) fallback.style.display='flex';">
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

function handlePartnerLogoFiles(files) {
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
    
    filesToProcess.forEach(file => {
        // Validate file type
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            showNotification(`File "${file.name}" is not a valid format. Please use PNG or SVG only.`, 'error');
            return;
        }
        
        // Validate file size
        if (file.size > maxFileSize) {
            showNotification(`File "${file.name}" is too large. Maximum size is 5MB.`, 'error');
            return;
        }
        
        // Read and preview logo
        const reader = new FileReader();
        reader.onload = (e) => {
            addPartnerLogoPreview(e.target.result, false);
        };
        reader.onerror = () => {
            showNotification(`Failed to read file "${file.name}".`, 'error');
        };
        reader.readAsDataURL(file);
    });
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
        <img src="${imageSrc}" alt="Partner logo">
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

// Update confirmDelete to handle partners and blogs
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
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to delete ${type}`);
        }

        // Close modal and reload page instead of updating display immediately
        closeDeleteModal();
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`, 'success');
        
        // CRITICAL FIX: Set flag to indicate this is a page reload, not a tab closure
        // This prevents the session manager from clearing the session during reload
        // Set in BOTH sessionStorage and localStorage for maximum reliability
        try {
            sessionStorage.setItem('_page_reload', 'true');
            localStorage.setItem('_page_reload', 'true');
        } catch (e) {
            console.error('Error setting reload flag:', e);
        }
        
        // Reload the page after a short delay to show the notification
        // Use a shorter delay to ensure flag is set before any cleanup runs
        setTimeout(() => {
            window.location.reload();
        }, 100);
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
                        ? `<img src="${escapeHtml(blog.image_url)}" alt="${escapeHtml(title)}" style="max-width: 80px; max-height: 60px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; const fallback = this.nextElementSibling; if (fallback && fallback.style) fallback.style.display='flex';">
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

function handleBlogImageFiles(files) {
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
    
    // Read and preview image
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
        <img src="${imageSrc}" alt="Blog image">
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

// Make functions globally available
window.editProperty = editProperty;
window.deleteProperty = deleteProperty;
window.updateInquiryStatus = updateInquiryStatus;

// ============================================
// INQUIRIES MANAGEMENT
// ============================================

// Load Inquiries from API
async function loadInquiries(forceRefresh = false) {
    try {
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

