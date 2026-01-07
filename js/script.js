// Format price for display (same logic as property-details.js)
function formatPropertyPrice(property) {
    // Get price_text from property object
    let displayPriceText = '';
    if (property.price_text) {
        displayPriceText = String(property.price_text).trim();
    }
    
    // Priority: price_text > string price > formatted numeric price
    if (displayPriceText && displayPriceText !== '' && displayPriceText !== String(property.price) && displayPriceText !== String(Math.round(property.price))) {
        // Use the price text if available (e.g., "3BHK: Rs.3.32 Cr, 4BHK: Rs.3.72 Cr")
        // For card display, show first price or simplified version
        if (displayPriceText.includes('3BHK') && displayPriceText.includes('4BHK')) {
            // Extract first price for card view (e.g., "3BHK: Rs.3.32 Cr")
            const firstPriceMatch = displayPriceText.match(/(\d+BHK[^,]*?Rs\.?\s*[\d.]+[^,]*)/);
            if (firstPriceMatch) {
                return firstPriceMatch[1].trim();
            }
            // Fallback: extract any price
            const match = displayPriceText.match(/Rs\.?\s*[\d.]+[^,]*/);
            if (match) {
                return match[0].trim();
            }
        }
        // If it contains commas, show first part for card view
        if (displayPriceText.includes(',')) {
            return displayPriceText.split(',')[0].trim();
        }
        return displayPriceText;
    } else if (typeof property.price === 'string' && property.price.trim() !== '') {
        // Price is already a string - use it directly
        return property.price;
    } else if (typeof property.price === 'number' && property.price > 0) {
        // Price is a number - format it with Indian currency
        if (property.price >= 10000000) {
            // Crores
            const crores = (property.price / 10000000).toFixed(2);
            return `Rs. ${crores} Cr`;
        } else if (property.price >= 100000) {
            // Lakhs
            const lakhs = (property.price / 100000).toFixed(2);
            return `Rs. ${lakhs} Lakh`;
        } else {
            // For small numbers, check if it might be in crores (e.g., 3.32 could mean 3.32 Cr)
            if (property.price < 100 && property.price > 0) {
                return `Rs. ${property.price.toFixed(2)} Cr`;
            } else {
                // Regular formatting with commas
                return `Rs. ${property.price.toLocaleString('en-IN')}`;
            }
        }
    } else {
        // Fallback
        return 'Price on request';
    }
}

// Property Data
const properties = [
    {
        id: 1,
        title: "Luxury Modern Apartment",
        location: "Downtown District",
        price: 450000,
        type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        area: 1800,
        image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
        status: "sale"
    },
    {
        id: 2,
        title: "Spacious Family House",
        location: "Suburban Area",
        price: 650000,
        type: "house",
        bedrooms: 4,
        bathrooms: 3,
        area: 2500,
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        status: "sale"
    },
    {
        id: 3,
        title: "Elegant Villa with Pool",
        location: "Hillside View",
        price: 1200000,
        type: "villa",
        bedrooms: 5,
        bathrooms: 4,
        area: 4000,
        image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
        status: "sale"
    },
    {
        id: 4,
        title: "Modern Condo Unit",
        location: "City Center",
        price: 320000,
        type: "condo",
        bedrooms: 2,
        bathrooms: 2,
        area: 1200,
        image: "https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800",
        status: "rent"
    },
    {
        id: 5,
        title: "Cozy Townhouse",
        location: "Residential Zone",
        price: 380000,
        type: "townhouse",
        bedrooms: 3,
        bathrooms: 2.5,
        area: 1600,
        image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800",
        status: "sale"
    },
    {
        id: 6,
        title: "Premium Apartment Suite",
        location: "Waterfront",
        price: 550000,
        type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        area: 2000,
        image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800",
        status: "sale"
    },
    {
        id: 7,
        title: "Luxury House Estate",
        location: "Gated Community",
        price: 850000,
        type: "house",
        bedrooms: 5,
        bathrooms: 4,
        area: 3500,
        image: "https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?w=800",
        status: "sale"
    },
    {
        id: 8,
        title: "Beachfront Villa",
        location: "Coastal Area",
        price: 1500000,
        type: "villa",
        bedrooms: 6,
        bathrooms: 5,
        area: 5000,
        image: "https://images.unsplash.com/photo-1600607688969-a5fcd26a57f1?w=800",
        status: "sale"
    }
];

// Navigation scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    const navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
}

// Dropdown menu toggle for mobile
document.addEventListener('DOMContentLoaded', () => {
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            // Only prevent default on mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                const dropdown = toggle.closest('.nav-dropdown');
                dropdown.classList.toggle('active');
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Skip #contact links - they are handled by page-specific code to open modals
        if (href === '#contact') {
            return; // Let the page-specific handler take over
        }
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Hero Slider
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-slide');

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
}

// Auto-advance slides
if (slides.length > 0) {
    setInterval(nextSlide, 5000);
}

// Search Tabs
const searchTabs = document.querySelectorAll('.search-tab');
searchTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        searchTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// Render Properties
function renderProperties(propertiesToRender = properties) {
    const grid = document.getElementById('propertiesGrid');
    if (!grid) return;

    grid.innerHTML = propertiesToRender.map(property => `
        <div class="property-card" data-type="${property.type}">
            <div class="property-image">
                <img src="${property.image}" alt="${property.title}" onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                <div class="property-badge ${property.status}">${property.status === 'sale' ? 'For Sale' : 'For Rent'}</div>
                <div class="property-actions">
                    <button class="property-action-btn" title="Share" aria-label="Share property" data-property-id="${property.id || 0}">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
            <div class="property-content">
                <h3 class="property-title">${property.title}</h3>
                <div class="property-price">${formatPropertyPrice(property)}</div>
                <div class="property-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${property.location}</span>
                </div>
                <div class="property-features">
                    <div class="property-feature">
                        <i class="fas fa-bed"></i>
                        <span>${property.bedrooms} Beds</span>
                    </div>
                    <div class="property-feature">
                        <i class="fas fa-bath"></i>
                        <span>${property.bathrooms} Baths</span>
                    </div>
                    <div class="property-feature">
                        <i class="fas fa-ruler-combined"></i>
                        <span>${property.area} sqft</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add share functionality - copy property link to clipboard
    grid.querySelectorAll('.property-action-btn').forEach(btn => {
        if (btn.querySelector('.fa-share-alt')) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const propertyId = btn.getAttribute('data-property-id');
                if (!propertyId || propertyId === '0') return;
                
                // Create the property URL
                const propertyUrl = `${window.location.origin}/property-details.html?id=${propertyId}`;
                
                try {
                    // Copy to clipboard using Clipboard API
                    await navigator.clipboard.writeText(propertyUrl);
                    
                    // Show success feedback
                    const icon = btn.querySelector('i');
                    const originalClass = icon.className;
                    icon.className = 'fas fa-check';
                    icon.style.color = '#4caf50';
                    btn.title = 'Link copied!';
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        icon.className = originalClass;
                        icon.style.color = '';
                        btn.title = 'Share';
                    }, 2000);
                    
                    // Show toast notification
                    if (typeof showToastNotification === 'function') {
                        showToastNotification('Property link copied to clipboard!');
                    }
                } catch (err) {
                    console.error('Failed to copy link:', err);
                    // Fallback: Use the older method
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = propertyUrl;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        
                        // Show success feedback
                        const icon = btn.querySelector('i');
                        const originalClass = icon.className;
                        icon.className = 'fas fa-check';
                        icon.style.color = '#4caf50';
                        btn.title = 'Link copied!';
                        
                        setTimeout(() => {
                            icon.className = originalClass;
                            icon.style.color = '';
                            btn.title = 'Share';
                        }, 2000);
                        
                        if (typeof showToastNotification === 'function') {
                            showToastNotification('Property link copied to clipboard!');
                        }
                    } catch (fallbackErr) {
                        console.error('Fallback copy failed:', fallbackErr);
                        alert('Failed to copy link. Please copy manually: ' + propertyUrl);
                    }
                }
            });
        }
    });
}

// Show toast notification (shared function)
function showToastNotification(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: #4caf50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    if (!document.querySelector('style[data-toast-animations]')) {
        style.setAttribute('data-toast-animations', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// Property Filter
const filterButtons = document.querySelectorAll('.filter-btn');
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.getAttribute('data-filter');
        let filtered = properties;
        
        if (filter !== 'all') {
            filtered = properties.filter(p => p.type === filter);
        }
        
        renderProperties(filtered);
    });
});

// Load property type counts from API
async function loadPropertyTypeCounts() {
    try {
        // Add timeout to fetch request (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        let response;
        try {
            response = await fetch('/api/stats/properties', {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // Handle network errors, CORS errors, or timeout
            if (fetchError.name === 'AbortError') {
                console.warn('Request timeout while fetching property statistics');
            } else if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                console.warn('Network error or CORS issue while fetching property statistics:', fetchError.message);
            } else {
                console.warn('Error fetching property statistics:', fetchError.message);
            }
            throw fetchError;
        }
        
        // Check if response is ok
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            let errorData = null;
            
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                    errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
                } else {
                    // Try to read as text if not JSON
                    const text = await response.text();
                    if (text) {
                        errorMessage = `${errorMessage} - ${text.substring(0, 100)}`;
                    }
                }
            } catch (parseError) {
                // If we can't parse the error response, use status text
                console.warn('Could not parse error response:', parseError);
            }
            
            // Log the error but don't throw - just use fallback values
            console.warn(`API returned error ${response.status}:`, errorMessage);
            throw new Error(`HTTP ${response.status}: ${errorMessage}`);
        }
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.warn('Response is not JSON, skipping property statistics');
            throw new Error('Invalid response format');
        }
        
        const stats = await response.json();
        
        // Validate stats structure
        if (!stats || typeof stats !== 'object') {
            throw new Error('Invalid statistics data');
        }
        
        // Update each type card with the count
        const typeCards = document.querySelectorAll('.type-card');
        typeCards.forEach(card => {
            const type = card.getAttribute('data-type');
            const countElement = card.querySelector('.type-count');
            
            if (countElement && stats.by_type && typeof stats.by_type === 'object' && stats.by_type[type] !== undefined) {
                const count = parseInt(stats.by_type[type]) || 0;
                countElement.textContent = `${count} ${count === 1 ? 'Property' : 'Properties'}`;
            } else if (countElement) {
                countElement.textContent = '0 Properties';
            }
        });
    } catch (error) {
        // Silently handle errors - don't break the page
        // Only log if it's not a network/HTTP error we've already logged
        if (error.name !== 'AbortError' && !error.message.includes('HTTP')) {
            console.error('Error loading property type counts:', error);
        }
        // Set default values on error
        const typeCards = document.querySelectorAll('.type-card');
        typeCards.forEach(card => {
            const countElement = card.querySelector('.type-count');
            if (countElement) {
                countElement.textContent = '0 Properties';
            }
        });
    }
}

// Load property type counts when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPropertyTypeCounts);
} else {
    loadPropertyTypeCounts();
}

// Property Type Cards - Navigate to properties page with filter
function initPropertyTypeCards() {
    const typeCards = document.querySelectorAll('.type-card');
    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            if (type) {
                // Open properties page with type filter in a new tab
                window.open(`/properties.html?type=${type}`, '_blank');
            }
        });
    });
}

// Initialize property type cards when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPropertyTypeCards);
} else {
    initPropertyTypeCards();
}

// Search Form
const searchForm = document.getElementById('searchForm');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const location = document.getElementById('location').value.toLowerCase();
        const propertyType = document.getElementById('propertyType').value;
        const bedrooms = document.getElementById('bedrooms').value;
        const priceRange = document.getElementById('priceRange').value;
        
        let filtered = properties;
        
        if (location) {
            filtered = filtered.filter(p => 
                p.location.toLowerCase().includes(location) || 
                p.title.toLowerCase().includes(location)
            );
        }
        
        if (propertyType) {
            filtered = filtered.filter(p => p.type === propertyType);
        }
        
        if (bedrooms) {
            const beds = parseInt(bedrooms);
            filtered = filtered.filter(p => {
                if (beds === 4) {
                    return p.bedrooms >= 4;
                }
                return p.bedrooms === beds;
            });
        }
        
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(v => v === '' ? Infinity : parseInt(v));
            filtered = filtered.filter(p => {
                if (max === Infinity) {
                    return p.price >= min;
                }
                return p.price >= min && p.price <= max;
            });
        }
        
        renderProperties(filtered);
        document.getElementById('properties').scrollIntoView({ behavior: 'smooth' });
    });
}

// Contact Form
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('contactSubmitBtn');
        const btnText = submitBtn?.querySelector('.btn-text');
        const btnLoader = submitBtn?.querySelector('.btn-loader');
        const messageDiv = document.getElementById('contactFormMessage');
        
        if (!submitBtn) return;
        
        // Get form values
        const formData = {
            name: document.getElementById('contactName').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            subject: document.getElementById('contactSubject').value.trim(),
            message: document.getElementById('contactMessage').value.trim(),
            phone: document.getElementById('contactPhone').value.trim() || null
        };
        
        // Validate required fields
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            showContactMessage('Please fill in all required fields.', 'error');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showContactMessage('Please enter a valid email address.', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        if (messageDiv) messageDiv.style.display = 'none';
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Success
                showContactMessage('Thank you for your message! We will get back to you soon.', 'success');
                contactForm.reset();
            } else {
                // Error from server
                const errorMessage = data.detail || data.error || 'Failed to send message. Please try again.';
                showContactMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error submitting contact form:', error);
            showContactMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });
}

// Initialize contact form when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
} else {
    initContactForm();
}

// Expose function globally for modal initialization
window.initContactForm = initContactForm;

// Helper function to show contact form messages
function showContactMessage(message, type) {
    const messageDiv = document.getElementById('contactFormMessage');
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `form-message ${type}`;
    messageDiv.style.display = 'block';
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Newsletter Form
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for subscribing to our newsletter!');
        newsletterForm.reset();
    });
}

// Counter Animation
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start);
        }
    }, 16);
}

// Animate stats when they come into view
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target.querySelector('.stat-number');
            const target = parseInt(statNumber.getAttribute('data-target'));
            if (target && !statNumber.classList.contains('animated')) {
                statNumber.classList.add('animated');
                statNumber.textContent = '0';
                animateCounter(statNumber, target);
            }
        }
    });
}, { threshold: 0.5 });

// Fetch and load statistics from API
async function loadStatistics() {
    try {
        let stats = null;
        
        try {
            const response = await fetch('/api/stats/frontend', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                try {
                    const data = await response.json();
                    // Validate response structure
                    if (data && typeof data === 'object') {
                        stats = data;
                    } else {
                        console.warn('Statistics API returned invalid data format');
                    }
                } catch (parseError) {
                    console.warn('Error parsing statistics response:', parseError);
                }
            } else {
                // Log error but don't throw - use fallback values
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.error || errorMessage;
                } catch (e) {
                    // Ignore JSON parse errors
                }
                console.warn('Failed to fetch statistics:', errorMessage);
            }
        } catch (fetchError) {
            // Handle network errors, CORS errors, or other fetch failures
            if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                console.warn('Network error fetching statistics:', fetchError.message);
            } else {
                console.warn('Error fetching statistics:', fetchError);
            }
        }
        
        // Use fetched stats or fallback to default values
        const finalStats = stats || {
            properties_listed: 0,
            happy_clients: 0,
            years_experience: 15,
            deals_closed: 0
        };
        
        // Update each stat card with the fetched data
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            const statType = card.getAttribute('data-stat');
            const statNumber = card.querySelector('.stat-number');
            
            if (statType && statNumber && finalStats[statType] !== undefined) {
                const value = parseInt(finalStats[statType]) || 0;
                statNumber.setAttribute('data-target', value);
                statNumber.textContent = '0';
            }
        });
        
        // Set up observer after statistics are loaded
        statCards.forEach(stat => {
            statsObserver.observe(stat);
        });
    } catch (error) {
        // Silently handle any unexpected errors - don't break the page
        console.warn('Unexpected error loading statistics:', error);
        // Fallback to default values if API fails
        const defaultStats = {
            properties_listed: 0,
            happy_clients: 0,
            years_experience: 15,
            deals_closed: 0
        };
        
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            const statType = card.getAttribute('data-stat');
            const statNumber = card.querySelector('.stat-number');
            
            if (statType && statNumber && defaultStats[statType] !== undefined) {
                statNumber.setAttribute('data-target', defaultStats[statType]);
                statNumber.textContent = '0';
            }
        });
        
        // Set up observer even if API fails
        statCards.forEach(stat => {
            statsObserver.observe(stat);
        });
    }
}

// Load statistics when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStatistics);
} else {
    loadStatistics();
}

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.type-card, .testimonial-card, .feature-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Initialize Services Section - Fade in animation
function initServicesSection() {
    const serviceCards = document.querySelectorAll('.service-card');
    
    if (serviceCards.length > 0) {
        const cardsObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * 100);
                }
            });
        }, { threshold: 0.1 });
        
        serviceCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            cardsObserver.observe(card);
        });
    }
}

// Smooth scroll to next section (for button click)
function scrollToNextSection() {
    const nextSection = document.querySelector('.property-types');
    
    if (nextSection) {
        const nextSectionTop = nextSection.offsetTop;
        
        // Smooth scroll
        window.scrollTo({
            top: nextSectionTop - 80, // Offset for better visibility
            behavior: 'smooth'
        });
    }
}

// Global Navigation Search Handler
function initGlobalNavSearch() {
    const navSearchInput = document.getElementById('navSearchInput');
    const navSearchClear = document.getElementById('navSearchClear');
    const navSearchIcon = document.querySelector('.nav-search-icon');
    const isPropertiesPage = window.location.pathname.includes('properties.html');
    
    if (!navSearchInput) return;
    
    // Function to handle search
    function handleSearch() {
        const searchQuery = navSearchInput.value.trim();
        
        if (!searchQuery) {
            // If empty, just focus the input
            navSearchInput.focus();
            return;
        }
        
        // If on properties page, let properties.js handle it
        if (isPropertiesPage) {
            // Trigger the search by dispatching an input event
            // This will be handled by properties.js initMainSearch()
            navSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
            // Also trigger applyFilters if it exists
            if (typeof applyFilters === 'function') {
                applyFilters();
            }
        } else {
            // Navigate to properties page with search query
            window.location.href = `/properties.html?search=${encodeURIComponent(searchQuery)}`;
        }
    }
    
    // Handle Enter key
    navSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });
    
    // Handle search icon click
    if (navSearchIcon) {
        navSearchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSearch();
        });
        
        // Make search icon clickable (cursor pointer)
        navSearchIcon.style.cursor = 'pointer';
    }
    
    // Make search wrapper clickable to focus input (but don't trigger search)
    const navSearchWrapper = document.querySelector('.nav-search-wrapper');
    if (navSearchWrapper) {
        navSearchWrapper.addEventListener('click', (e) => {
            // Only focus if clicking on the wrapper itself, not on child elements
            if (e.target === navSearchWrapper) {
                navSearchInput.focus();
            }
        });
    }
    
    // Handle clear button
    if (navSearchClear) {
        navSearchClear.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navSearchInput.value = '';
            navSearchClear.style.display = 'none';
            navSearchInput.focus();
            
            // If on properties page, apply filters to clear search
            if (isPropertiesPage && typeof applyFilters === 'function') {
                applyFilters();
            }
        });
        
        // Show/hide clear button based on input
        navSearchInput.addEventListener('input', () => {
            if (navSearchInput.value.trim()) {
                navSearchClear.style.display = 'flex';
            } else {
                navSearchClear.style.display = 'none';
            }
        });
    }
    
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderProperties();
    // initServicesSection(); // Disabled scroll animation for Services Section
    initGlobalNavSearch();
    
    // Hero scroll indicator with enhanced animation
    const scrollIndicator = document.querySelector('.hero-scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            // Add click animation
            scrollIndicator.style.transform = 'scale(0.9)';
            setTimeout(() => {
                scrollIndicator.style.transform = '';
            }, 150);
            
            // Scroll to next section
            scrollToNextSection();
        });
    }
    
    // Scroll-based animation for all sections (excluding services section)
    const sectionsToAnimate = document.querySelectorAll('section:not(.hero):not(.services-showcase)');
    
    if (sectionsToAnimate.length > 0) {
        // Initially hide all sections
        sectionsToAnimate.forEach(section => {
            section.classList.add('section-coming-into-view');
        });
        
        // Intersection Observer for scroll-triggered animations
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add visible class when section comes into view
                    entry.target.classList.add('section-visible');
                    entry.target.classList.remove('section-coming-into-view');
                } else if (window.scrollY < entry.target.offsetTop) {
                    // Reset animation if scrolled back up
                    entry.target.classList.remove('section-visible');
                    entry.target.classList.add('section-coming-into-view');
                }
            });
        }, observerOptions);
        
        // Observe all sections
        sectionsToAnimate.forEach(section => {
            sectionObserver.observe(section);
        });
    }
    
    // Individual service section animations (Investment, Management, Value Added) - DISABLED
    // const serviceSubsections = document.querySelectorAll('.service-investment, .service-management, .service-value');
    
    // if (serviceSubsections.length > 0) {
    //     // Initially hide service subsections
    //     serviceSubsections.forEach(subsection => {
    //         subsection.classList.add('section-coming-into-view');
    //     });
        
    //     // Intersection Observer for individual service sections
    //     const serviceObserverOptions = {
    //         threshold: 0.2,
    //         rootMargin: '0px 0px -100px 0px'
    //     };
        
    //     const serviceSectionObserver = new IntersectionObserver((entries) => {
    //         entries.forEach(entry => {
    //             if (entry.isIntersecting) {
    //                 entry.target.classList.add('section-visible');
    //                 entry.target.classList.remove('section-coming-into-view');
    //             } else if (window.scrollY < entry.target.offsetTop) {
    //                 entry.target.classList.remove('section-visible');
    //                 entry.target.classList.add('section-coming-into-view');
    //             }
    //         });
    //     }, serviceObserverOptions);
        
    //     // Observe each service subsection
    //     serviceSubsections.forEach(subsection => {
    //         serviceSectionObserver.observe(subsection);
    //     });
    // }
});

// ============================================
// Hero Image Sliders - Automatic Rotation
// ============================================
(function() {
    'use strict';
    
    const SLIDER_INTERVAL = 4000; // 4 seconds per image
    
    /**
     * Initialize slider for a hero image section
     */
    function initHeroSlider(sliderContainer) {
        if (!sliderContainer) return;
        
        const slides = sliderContainer.querySelectorAll('.hero-slide');
        if (slides.length === 0) return;
        
        let currentIndex = 0;
        
        // Set first slide as active
        slides[currentIndex].classList.add('active');
        
        // Function to show next slide
        function showNextSlide() {
            // Remove active class from current slide
            slides[currentIndex].classList.remove('active');
            
            // Move to next slide
            currentIndex = (currentIndex + 1) % slides.length;
            
            // Add active class to new slide
            slides[currentIndex].classList.add('active');
        }
        
        // Start automatic sliding
        let intervalId = setInterval(showNextSlide, SLIDER_INTERVAL);
        
        // Pause on hover
        const section = sliderContainer.closest('.hero-image-section');
        if (section) {
            section.addEventListener('mouseenter', () => {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            });
            
            section.addEventListener('mouseleave', () => {
                // Restart interval
                if (!intervalId) {
                    intervalId = setInterval(showNextSlide, SLIDER_INTERVAL);
                }
            });
        }
    }
    
    /**
     * Initialize all hero sliders
     */
    function initAllHeroSliders() {
        const sliders = document.querySelectorAll('.hero-image-slider');
        sliders.forEach(slider => {
            initHeroSlider(slider);
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllHeroSliders);
    } else {
        initAllHeroSliders();
    }
})();

// ============================================
// Automatic Cache Clearing - Every 60 seconds
// ============================================
(function() {
    'use strict';
    
    const CACHE_CLEAR_INTERVAL = 60000; // 60 seconds in milliseconds
    
    /**
     * Clear all application caches
     */
    async function clearApplicationCache() {
        try {
            // Clear Cache API caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
                console.log(`[Cache Clear] Cleared ${cacheNames.length} cache(s) at ${new Date().toLocaleTimeString()}`);
            }
            
            // Clear localStorage (optional - uncomment if needed)
            // localStorage.clear();
            
            // Clear sessionStorage (optional - uncomment if needed)
            // sessionStorage.clear();
            
            // Clear IndexedDB (optional - uncomment if needed)
            // if ('indexedDB' in window) {
            //     const databases = await indexedDB.databases();
            //     await Promise.all(
            //         databases.map(db => {
            //             return new Promise((resolve, reject) => {
            //                 const deleteReq = indexedDB.deleteDatabase(db.name);
            //                 deleteReq.onsuccess = () => resolve();
            //                 deleteReq.onerror = () => reject(deleteReq.error);
            //             });
            //         })
            //     );
            // }
            
        } catch (error) {
            console.error('[Cache Clear] Error clearing cache:', error);
        }
    }
    
    /**
     * Initialize automatic cache clearing
     */
    function initCacheClearing() {
        // Clear cache immediately on page load
        clearApplicationCache();
        
        // Set up interval to clear cache every 60 seconds
        setInterval(() => {
            clearApplicationCache();
        }, CACHE_CLEAR_INTERVAL);
        
        console.log('[Cache Clear] Automatic cache clearing initialized (every 60 seconds)');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCacheClearing);
    } else {
        initCacheClearing();
    }
})();