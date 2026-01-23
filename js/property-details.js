// Property Details Page JavaScript
// Version: 2.0 - Fixed propertyType duplicate declaration issue

// Utility function to safely access nested properties with informative warnings
function safeGetProperty(obj, path, defaultValue = null, warnOnMissing = true) {
    if (!obj) {
        if (warnOnMissing) {
            console.warn(`[Property Guard] Object is null/undefined for path: ${path}`);
        }
        return defaultValue;
    }
    
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length; i++) {
        if (current === null || current === undefined) {
            if (warnOnMissing) {
                console.warn(`[Property Guard] Missing property at path: ${keys.slice(0, i + 1).join('.')} (full path: ${path})`);
            }
            return defaultValue;
        }
        current = current[keys[i]];
    }
    
    if (current === null || current === undefined) {
        if (warnOnMissing) {
            console.warn(`[Property Guard] Property is null/undefined at path: ${path}`);
        }
        return defaultValue;
    }
    
    return current;
}

// Utility function to safely get array property, ensuring it's always an array
function safeGetArray(obj, path, defaultValue = []) {
    const value = safeGetProperty(obj, path, defaultValue, false);
    if (!Array.isArray(value)) {
        console.warn(`[Property Guard] Expected array at path: ${path}, got ${typeof value}. Using empty array.`);
        return defaultValue;
    }
    return value;
}

// HTML escaping function for security
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Store current property ID globally
let currentPropertyId = null;

// Store categorized images for filtering
let categorizedImages = {
    project: [],
    floorplan: [],
    masterplan: []
};

// Store all images for lightbox
let allImages = [];

// Show loading state
function showLoadingState() {
    const loadingEl = document.getElementById('propertyLoading');
    const errorEl = document.getElementById('propertyError');
    const headerEl = document.getElementById('propertyHeader');
    const contentEl = document.getElementById('propertyContent');
    
    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl) errorEl.style.display = 'none';
    if (headerEl) headerEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
}

// Hide loading state
function hideLoadingState() {
    const loadingEl = document.getElementById('propertyLoading');
    const headerEl = document.getElementById('propertyHeader');
    const contentEl = document.getElementById('propertyContent');
    
    console.log('[Property Details] hideLoadingState called');
    console.log('[Property Details] Elements found:', {
        loading: !!loadingEl,
        header: !!headerEl,
        content: !!contentEl
    });
    
    if (loadingEl) {
        loadingEl.style.display = 'none';
        console.log('[Property Details] Loading element hidden');
    }
    if (headerEl) {
        headerEl.style.display = 'block';
        console.log('[Property Details] Header element shown');
    }
    if (contentEl) {
        contentEl.style.display = 'flex';
        console.log('[Property Details] Content element shown');
    } else {
        console.error('[Property Details] Content element not found!');
    }
}

// Show error state
function showErrorState(message = 'Property not found') {
    const loadingEl = document.getElementById('propertyLoading');
    const errorEl = document.getElementById('propertyError');
    const headerEl = document.getElementById('propertyHeader');
    const contentEl = document.getElementById('propertyContent');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
        errorEl.style.display = 'block';
        const errorMsg = errorEl.querySelector('p');
        if (errorMsg) errorMsg.textContent = message;
    }
    if (headerEl) headerEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
}

// Load Property from API by ID
async function loadPropertyFromAPI(propertyId) {
    try {
        const response = await fetch(`/api/properties/${propertyId}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Property not found');
            }
            const errorText = await response.text();
            throw new Error(`Failed to fetch property: ${response.status} ${errorText}`);
        }
        const property = await response.json();
        
        // Convert API format to display format
        return convertPropertyFromAPI(property);
    } catch (error) {
        console.error('Error loading property from API:', error);
        throw error; // Re-throw to let caller handle it
    }
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

// Convert API property format to display format
function convertPropertyFromAPI(property) {
    // Guard: Ensure property exists
    if (!property) {
        console.warn('convertPropertyFromAPI: property is null or undefined');
        property = {};
    }
    
    // Handle images - API returns array of objects with image_url
    // Guard: Always ensure images is an array, even if null/undefined
    let images = [];
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
        images = property.images.map(img => {
            // Guard: Handle null/undefined image objects
            if (!img) return null;
            
            let imageUrl = null;
            if (typeof img === 'string') {
                imageUrl = img;
            } else if (img && typeof img === 'object' && img.image_url) {
                imageUrl = img.image_url;
            }
            // Normalize the URL (handles null gracefully)
            return imageUrl ? normalizeImageUrl(imageUrl) : null;
        }).filter(Boolean); // Remove null/undefined entries
    }
    // Ensure images is always an array (even if empty)
    if (!Array.isArray(images)) {
        images = [];
    }
    
    // Handle features - API returns array of objects with feature_name
    // Guard: Always ensure features is an array, even if null/undefined
    let features = [];
    if (property.features && Array.isArray(property.features) && property.features.length > 0) {
        features = property.features.map(feature => {
            // Guard: Handle null/undefined feature objects
            if (!feature) return null;
            
            if (typeof feature === 'string') {
                return feature.trim() || null; // Return null for empty strings
            } else if (feature && typeof feature === 'object' && feature.feature_name) {
                return feature.feature_name ? String(feature.feature_name).trim() : null;
            }
            return null;
        }).filter(Boolean); // Remove null/undefined/empty entries
    }
    // Ensure features is always an array (even if empty)
    if (!Array.isArray(features)) {
        features = [];
    }
    
    // Construct location from city and locality if location is not provided
    let location = property.location;
    if (!location && (property.city || property.locality)) {
        const city = property.city || '';
        const locality = property.locality || '';
        if (city && locality) {
            location = `${city}, ${locality}`;
        } else if (city) {
            location = city;
        } else if (locality) {
            location = locality;
        }
    }
    if (!location) {
        location = 'Location not specified';
    }
    
    // Get title - check property_name or project_name if title is not available
    let title = property.title;
    if (!title) {
        title = property.property_name || property.project_name || 'Untitled Property';
    }
    
    // Get area - check multiple possible fields (area, buildup_area, plot_area)
    let area = property.area;
    if (!area && property.buildup_area) {
        area = property.buildup_area;
    }
    if (!area && property.plot_area) {
        area = property.plot_area;
    }
    
    // Get bedrooms - default to 0 if not available (for plots)
    let bedrooms = property.bedrooms;
    if (bedrooms === null || bedrooms === undefined) {
        bedrooms = 0;
    }
    
    // Get bathrooms - default to 0 if not available
    let bathrooms = property.bathrooms;
    if (bathrooms === null || bathrooms === undefined) {
        bathrooms = 0;
    }
    
    // Get property details directly from property object (not from description)
    let descriptionText = property.description || '';
    
    // Remove "--- Property Details ---" section from description if it exists
    const detailsSeparator = '--- Property Details ---';
    if (descriptionText.includes(detailsSeparator)) {
        const parts = descriptionText.split(detailsSeparator);
        descriptionText = parts[0].trim();
    }
    
    // Get fields from property object
    let builder = property.builder || '';
    let configuration = property.configuration || '';
    let plotArea = property.plot_area || '';
    let superBuiltUpArea = property.super_built_up_area || '';
    let totalFlats = property.total_flats || '';
    let totalFloors = property.total_floors || '';
    let totalAcres = property.total_acres || '';
    
    // Get unit_type for configuration if available
    if (!configuration && property.unit_type) {
        configuration = property.unit_type.toUpperCase();
    }
    
    // Get price_text from property - check multiple possible locations
    let priceText = '';
    if (property.price_text) {
        priceText = String(property.price_text).trim();
    } else if (property.price_text === null || property.price_text === undefined) {
        // price_text is explicitly null/undefined - don't use price as fallback
        priceText = '';
    }
    
    // If fields are not in property object, try to extract from description (for backward compatibility)
    // but don't display them in description
    if (!builder || !configuration || !superBuiltUpArea) {
        const tempDescription = property.description || '';
        if (tempDescription.includes(detailsSeparator)) {
            const parts = tempDescription.split(detailsSeparator);
            if (parts[1]) {
                const details = parts[1].trim().split('\n');
                details.forEach(detail => {
                    if (detail.includes(':')) {
                        const [key, ...valueParts] = detail.split(':');
                        const value = valueParts.join(':').trim();
                        const keyLower = key.trim().toLowerCase();
                        
                        if (keyLower.includes('builder') && !builder) builder = value;
                        else if (keyLower.includes('configuration') && !configuration) configuration = value;
                        else if (keyLower.includes('plot area') && !plotArea) plotArea = value;
                        else if (keyLower.includes('super built-up area') && !superBuiltUpArea) superBuiltUpArea = value;
                        else if (keyLower.includes('total flats') && !totalFlats) totalFlats = value;
                        else if (keyLower.includes('total floors') && !totalFloors) totalFloors = value;
                        else if (keyLower.includes('total acres') && !totalAcres) totalAcres = value;
                    }
                });
            }
        }
    }
    
    // Get status - check for property_status (ready_to_move) or use status
    let statusValue = property.property_status || property.status;
    if (typeof statusValue !== 'string') {
        statusValue = statusValue?.value || statusValue;
    }
    
    // Get type - handle enum values
    let convertedPropertyType = property.type;
    if (typeof convertedPropertyType !== 'string') {
        convertedPropertyType = convertedPropertyType?.value || convertedPropertyType || 'apartment';
    }
    
    // Create placeholder image for properties without images
    const imagePlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image Available%3C/text%3E%3C/svg%3E';
    
    return {
        id: property.id,
        title: title,
        location: location,
        price: property.price, // Numeric value for backend
        price_text: priceText, // Text value for display
        type: convertedPropertyType,
        status: statusValue,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        area: area,
        image: images.length > 0 ? images[0] : null,
        images: images,
        description: descriptionText,
        features: features,
        // New fields
        builder: builder,
        configuration: configuration,
        plot_area: plotArea,
        super_built_up_area: superBuiltUpArea,
        total_flats: totalFlats,
        total_floors: totalFloors,
        total_acres: totalAcres,
        // Additional database fields
        city: property.city || '',
        locality: property.locality || '',
        unit_type: property.unit_type || '',
        buildup_area: property.buildup_area || '',
        carpet_area: property.carpet_area || '',
        plot_length: property.plot_length || '',
        plot_breadth: property.plot_breadth || '',
        property_category: property.property_category || '',
        listing_type: property.listing_type || '',
        price_negotiable: property.price_negotiable || false,
        video_link: property.video_link || '',
        location_link: property.location_link || '',
        direction: property.direction || property.facing || property.orientation || ''
    };
}

// Get Properties from localStorage or use defaults (fallback)
function getPropertiesFromStorage() {
    const stored = localStorage.getItem('dashboard_properties');
    if (stored) {
        const properties = JSON.parse(stored);
        // Extract images from database fields - no hardcoded fallback
        return properties.map(p => {
            let imageUrl = null;
            if (p.primary_image) {
                imageUrl = p.primary_image;
            } else if (p.images && p.images.length > 0) {
                if (typeof p.images[0] === 'object' && p.images[0].image_url) {
                    imageUrl = p.images[0].image_url;
                } else if (typeof p.images[0] === 'string') {
                    imageUrl = p.images[0];
                }
            }
            return {
                ...p,
                image: imageUrl
            };
        });
    }
    // Return empty array instead of default properties with hardcoded images
    // Properties should come from API, not hardcoded defaults
    return [];
}

function getDefaultProperties() {
    return [
    {
        id: 1,
        title: "Luxury Modern Apartment",
        location: "Downtown District, Bengaluru",
        price: 450000,
        type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        area: 1800,
        image: "/images/img1.webp",
        status: "sale",
        description: "This stunning modern apartment offers a perfect blend of luxury and comfort. Located in the heart of Downtown District, this property features spacious rooms, high-end finishes, and breathtaking city views. The open-concept living area is perfect for entertaining, while the master suite provides a private retreat. The building includes premium amenities such as a fitness center, rooftop terrace, and 24/7 security.",
        features: ["Air Conditioning", "Balcony", "Parking", "Security", "Elevator", "Gym", "Swimming Pool", "Garden", "Rooftop Terrace", "24/7 Security"]
    },
    {
        id: 2,
        title: "Spacious Family House",
        location: "Suburban Area, Bengaluru",
        price: 650000,
        type: "house",
        bedrooms: 4,
        bathrooms: 3,
        area: 2500,
        image: "/images/img2.webp",
        status: "sale",
        description: "Perfect for growing families, this spacious house offers ample living space and a beautiful backyard. The property features a modern kitchen, large family room, and multiple bedrooms with walk-in closets. The master bedroom includes an ensuite bathroom and private balcony. The backyard is perfect for outdoor activities and gardening.",
        features: ["Garage", "Garden", "Fireplace", "Central Heating", "Storage", "Patio", "Security System", "Pet Friendly", "Walk-in Closets", "Modern Kitchen"]
    },
    {
        id: 3,
        title: "Elegant Villa with Pool",
        location: "Hillside View, Bengaluru",
        price: 1200000,
        type: "villa",
        bedrooms: 5,
        bathrooms: 4,
        area: 4000,
        image: "/images/img3.jpg",
        status: "sale",
        description: "An exquisite villa offering the ultimate in luxury living. This property features a private swimming pool, landscaped gardens, and stunning hillside views. The interior boasts high ceilings, marble floors, and designer finishes throughout. Multiple living areas provide space for both relaxation and entertainment.",
        features: ["Swimming Pool", "Garden", "Garage", "Security", "Home Theater", "Wine Cellar", "Guest House", "Maid's Room"]
    },
    {
        id: 4,
        title: "Modern Condo Unit",
        location: "City Center, Bengaluru",
        price: 320000,
        type: "condo",
        bedrooms: 2,
        bathrooms: 2,
        area: 1200,
        image: "/images/img4.jpg",
        status: "rent",
        description: "A contemporary condo unit in the vibrant city center. This property offers modern amenities and easy access to shopping, dining, and entertainment. The unit features an open floor plan, updated kitchen, and large windows that flood the space with natural light.",
        features: ["Air Conditioning", "Balcony", "Parking", "Security", "Elevator", "Gym", "Concierge", "Rooftop Access", "Open Floor Plan", "Natural Light"]
    },
    {
        id: 5,
        title: "Cozy Townhouse",
        location: "Residential Zone, Bengaluru",
        price: 380000,
        type: "townhouse",
        bedrooms: 3,
        bathrooms: 2.5,
        area: 1600,
        image: "/images/img5.jpg",
        status: "sale",
        description: "A charming townhouse in a quiet residential neighborhood. This property offers a perfect balance of privacy and community living. Features include a private garage, small garden, and modern interior finishes. Ideal for first-time buyers or small families.",
        features: ["Garage", "Garden", "Storage", "Security", "Pet Friendly", "Modern Kitchen", "Hardwood Floors", "Private Entrance", "Community Living"]
    },
    {
        id: 6,
        title: "Premium Apartment Suite",
        location: "Waterfront, Bengaluru",
        price: 550000,
        type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        area: 2000,
        image: "/images/img1.webp",
        status: "sale",
        description: "A premium apartment suite with stunning waterfront views. This property features luxury finishes, spacious rooms, and access to exclusive building amenities. The location offers easy access to the waterfront promenade and nearby attractions.",
        features: ["Waterfront View", "Balcony", "Parking", "Security", "Elevator", "Gym", "Swimming Pool", "Concierge"]
    },
    {
        id: 7,
        title: "Luxury House Estate",
        location: "Gated Community, Bengaluru",
        price: 850000,
        type: "house",
        bedrooms: 5,
        bathrooms: 4,
        area: 3500,
        image: "/images/img2.webp",
        status: "sale",
        description: "A magnificent estate in a prestigious gated community. This property offers unparalleled luxury with extensive grounds, multiple living areas, and premium finishes. The estate includes a private pool, tennis court, and guest accommodations.",
        features: ["Swimming Pool", "Tennis Court", "Garage", "Garden", "Security", "Home Theater", "Guest House", "Wine Cellar"]
    },
    {
        id: 8,
        title: "Beachfront Villa",
        location: "Coastal Area, Bengaluru",
        price: 1500000,
        type: "villa",
        bedrooms: 6,
        bathrooms: 5,
        area: 5000,
        image: "/images/img3.jpg",
        status: "sale",
        description: "An extraordinary beachfront villa offering direct access to the beach. This property features multiple levels, panoramic ocean views, and luxury amenities throughout. Perfect for those seeking a premium coastal lifestyle.",
        features: ["Beachfront", "Swimming Pool", "Garden", "Garage", "Security", "Home Theater", "Guest House", "Ocean View"]
    },
    {
        id: 9,
        title: "Contemporary Apartment",
        location: "Business District, Bengaluru",
        price: 420000,
        type: "apartment",
        bedrooms: 2,
        bathrooms: 2,
        area: 1500,
        image: "/images/img4.jpg",
        status: "rent",
        description: "A contemporary apartment in the bustling business district. Perfect for professionals, this property offers modern design, convenient location, and access to business amenities. The unit features smart home technology and energy-efficient systems.",
        features: ["Air Conditioning", "Balcony", "Parking", "Security", "Elevator", "Gym", "Business Center", "Smart Home"]
    },
    {
        id: 10,
        title: "Family-Friendly House",
        location: "Quiet Neighborhood, Bengaluru",
        price: 580000,
        type: "house",
        bedrooms: 4,
        bathrooms: 3,
        area: 2200,
        image: "/images/img5.jpg",
        status: "sale",
        description: "A family-friendly house in a peaceful neighborhood. This property offers a safe environment for children, nearby schools, and community parks. The house features a large backyard, play area, and family-oriented design.",
        features: ["Garage", "Garden", "Play Area", "Storage", "Security", "Pet Friendly", "Family Room", "Modern Kitchen"]
    },
    {
        id: 11,
        title: "Executive Villa",
        location: "Prestigious Area, Bengaluru",
        price: 1350000,
        type: "villa",
        bedrooms: 6,
        bathrooms: 5,
        area: 4500,
        image: "/images/img1.webp",
        status: "sale",
        description: "An executive villa in a prestigious area, designed for luxury living and entertaining. This property features grand architecture, premium materials, and extensive grounds. Perfect for high-profile individuals and families.",
        features: ["Swimming Pool", "Garden", "Garage", "Security", "Home Theater", "Wine Cellar", "Guest House", "Helipad"]
    },
    {
        id: 12,
        title: "Modern Condo with View",
        location: "City Skyline, Bengaluru",
        price: 350000,
        type: "condo",
        bedrooms: 2,
        bathrooms: 2,
        area: 1300,
        image: "/images/img2.webp",
        status: "rent",
        description: "A modern condo with spectacular city skyline views. This property offers contemporary design, premium finishes, and access to building amenities. The location provides easy access to urban attractions and transportation.",
        features: ["City View", "Balcony", "Parking", "Security", "Elevator", "Gym", "Rooftop Terrace", "Concierge"]
    }
    ];
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadPropertyDetails();
});

// Load Property Details
async function loadPropertyDetails() {
    console.log('[Property Details] Starting to load property details...');
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = parseInt(urlParams.get('id'));
    
    console.log('[Property Details] Property ID from URL:', propertyId);
    
    if (!propertyId || isNaN(propertyId)) {
        console.error('[Property Details] Invalid property ID');
        showErrorState('Invalid property ID');
        return;
    }
    
    showLoadingState();
    console.log('[Property Details] Loading state shown');
    
    try {
    // Try to load from API first
    let property = await loadPropertyFromAPI(propertyId);
    
    if (!property) {
            showErrorState('Property not found');
        return;
    }
    
    // Store property ID for contact form
    currentPropertyId = property.id;
    
    // Hide loading and show content before rendering
    console.log('[Property Details] Hiding loading state, showing content');
    hideLoadingState();
    
    // Render property details (this will populate the content)
    console.log('[Property Details] Rendering property details...');
    renderPropertyDetails(property);
    console.log('[Property Details] Property details rendered successfully');
    
    // Initialize modals
    console.log('[Property Details] Initializing modals...');
    initContactAgentModal();
    initScheduleVisitModal();
    console.log('[Property Details] Modals initialized');
        
    console.log(`[Property Details] Successfully loaded property ${propertyId} from database`);
        
    } catch (error) {
        console.error('[Property Details] Error loading property details:', error);
        
        // Check error type
        if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
            showErrorState('Property not found. It may have been removed.');
        } else {
            // For other errors (like rendering errors), ensure content is visible
            // The content might be partially rendered, so show it instead of hiding everything
            console.warn('[Property Details] Rendering error, but showing content anyway');
            hideLoadingState();
            // Don't call showErrorState here - let the partially rendered content show
            // Only show error if it's a critical API error
            if (error.message && error.message.includes('fetch')) {
                showErrorState('Failed to load property. Please try again later.');
            }
        }
    }
}

// Render Property Details
function renderPropertyDetails(property) {
    try {
        // Guard: Ensure property exists
        if (!property) {
            console.error('[Property Details] Property is null or undefined');
            showErrorState('Property data is missing. Please try refreshing the page.');
            return;
        }
        
        // Update page title - Guard: Handle missing title
        const propertyTitle = property.title || property.property_name || 'Untitled Property';
        document.title = `${propertyTitle} - Tirumakudalu Properties`;
        
        // Get images first - Guard: Ensure images is always an array
        let images = [];
        if (property.images && Array.isArray(property.images) && property.images.length > 0) {
            // Filter out null/undefined/invalid images
            images = property.images.filter(img => {
                if (!img) return false;
                if (typeof img === 'string') return img.trim().length > 0;
                if (typeof img === 'object' && img.image_url) return String(img.image_url).trim().length > 0;
                return false;
            }).map(img => {
                if (typeof img === 'string') return img.trim();
                if (typeof img === 'object' && img.image_url) return String(img.image_url).trim();
                return String(img);
            });
        }
        
        // Fallback to single image property
        if (images.length === 0 && property.image) {
            images = [String(property.image).trim()];
        }
        
        // Create placeholder image for properties without images
        const imagePlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image Available%3C/text%3E%3C/svg%3E';
        
        // Get main image (first image) - use placeholder if no image available
        const mainImage = images.length > 0 ? images[0] : imagePlaceholder;
        const normalizedMainImage = normalizeImageUrl(mainImage) || imagePlaceholder;
        
        // Render Header Image Section
        const headerImageSection = document.getElementById('propertyHeaderImage');
        if (headerImageSection) {
            headerImageSection.innerHTML = `
                <img src="${normalizedMainImage}" alt="${escapeHtml(property.title || 'Property')}" class="property-header-main-image">
            `;
        }
        
        // Render Header Description Section
        const title = escapeHtml(property.title || 'Untitled Property');
        const location = escapeHtml(property.location || 'Location not specified');
        const features = property.features && property.features.length > 0 ? property.features : [];
    
    // Get property details for bottom right section
    const amenitiesCount = features.length;
    const bhk = property.bedrooms || 0;
    const displayPropertyType = property.type || 'N/A';
    const direction = property.facing || property.orientation || property.direction || 'N/A';
    
    // Format property type
    const formatPropertyType = (type) => {
        if (!type) return 'N/A';
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };
    
    // Format direction (handle all 8 directions)
    const formatDirection = (dir) => {
        if (!dir || dir === 'N/A') return 'N/A';
        const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
        const dirLower = dir.toLowerCase();
        for (const d of directions) {
            if (dirLower.includes(d)) {
                return d.replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        return dir.replace(/\b\w/g, l => l.toUpperCase());
    };
    
    const headerDescriptionSection = document.getElementById('propertyHeaderDescription');
    if (headerDescriptionSection) {
        headerDescriptionSection.innerHTML = `
        <div class="property-header-description-content">
            <div class="property-header-info">
                <h1 class="property-details-title">${title}</h1>
                <div class="property-details-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${location}</span>
                </div>
            </div>
            ${features.length > 0 ? `
            <div class="property-header-amenities">
                ${features.filter(f => f && typeof f === 'string' && f.trim()).map(feature => {
                    const featureName = escapeHtml(String(feature).trim());
                    return `<button class="amenity-btn">${featureName}</button>`;
                }).join('')}
            </div>
            ` : ''}
            <div class="property-header-stats">
                <div class="property-stat-item">
                    <span class="stat-label">Amenities</span>
                    <span class="stat-value">${amenitiesCount}</span>
                </div>
                <div class="property-stat-item">
                    <span class="stat-label">BHK</span>
                    <span class="stat-value">${bhk}</span>
                </div>
                <div class="property-stat-item">
                    <span class="stat-label">Type</span>
                    <span class="stat-value">${formatPropertyType(displayPropertyType)}</span>
                </div>
                <div class="property-stat-item">
                    <span class="stat-label">Direction</span>
                    <span class="stat-value">${formatDirection(direction)}</span>
                </div>
            </div>
        </div>
    `;
    }
    
    // Categorize images
    
    // Store all images for lightbox (guard: ensure it's an array)
    allImages = Array.isArray(images) ? images : [];
    
    // Categorize images based on URL patterns or default to "project"
    categorizedImages = {
        project: [],
        floorplan: [],
        masterplan: []
    };
    
    // Guard: Only process if images array exists and has items
    if (Array.isArray(images) && images.length > 0) {
        images.forEach(img => {
            // Guard: Skip null/undefined images
            if (!img) return;
            
            const imgUrl = String(img || '').toLowerCase();
            // Check if image URL contains keywords for floor plan or master plan
            if (imgUrl.includes('floor') || imgUrl.includes('floorplan') || imgUrl.includes('floor-plan')) {
                categorizedImages.floorplan.push(img);
            } else if (imgUrl.includes('master') || imgUrl.includes('masterplan') || imgUrl.includes('master-plan') || imgUrl.includes('site-plan')) {
                categorizedImages.masterplan.push(img);
            } else {
                // Default to project images
                categorizedImages.project.push(img);
            }
        });
    }
    
    // If no images in a category, ensure at least project has images (or empty array)
    if (categorizedImages.project.length === 0 && images.length > 0) {
        categorizedImages.project = images;
    }
    
    // Render Gallery with default filter (project)
    renderGallery('project', property.title || 'Property');
    
    // Initialize filter buttons (after gallery is rendered)
    setTimeout(() => {
        initImageFilters();
    }, 100);
    
    // Render Description (clean description - remove property details section if it exists)
    const description = document.getElementById('propertyDescription');
    let cleanDescription = property.description || 'No description available.';
    // Remove "--- Property Details ---" section if it exists
    const detailsSeparator = '--- Property Details ---';
    if (cleanDescription.includes(detailsSeparator)) {
        const parts = cleanDescription.split(detailsSeparator);
        cleanDescription = parts[0].trim();
    }
    // Escape HTML but preserve line breaks
    const escapedDescription = escapeHtml(cleanDescription).replace(/\n/g, '<br>');
    description.innerHTML = `<p>${escapedDescription}</p>`;
    
    // Render Video Preview if available
    const videoSection = document.getElementById('propertyVideoSection');
    const videoContainer = document.getElementById('propertyVideoContainer');
    if (videoSection && videoContainer && property.video_link) {
        const videoLink = escapeHtml(property.video_link);
        let videoEmbedHtml = '';
        
        // Check if it's a YouTube link
        if (videoLink.includes('youtube.com') || videoLink.includes('youtu.be')) {
            let videoId = '';
            if (videoLink.includes('youtube.com/watch?v=')) {
                videoId = videoLink.split('v=')[1]?.split('&')[0];
            } else if (videoLink.includes('youtu.be/')) {
                videoId = videoLink.split('youtu.be/')[1]?.split('?')[0];
            }
            if (videoId) {
                videoEmbedHtml = `
                    <div class="property-video-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 8px;">
                        <iframe 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            }
        } else if (videoLink.includes('vimeo.com')) {
            // Handle Vimeo links
            let videoId = '';
            const vimeoMatch = videoLink.match(/vimeo.com\/(\d+)/);
            if (vimeoMatch) {
                videoId = vimeoMatch[1];
            }
            if (videoId) {
                videoEmbedHtml = `
                    <div class="property-video-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 8px;">
                        <iframe 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="https://player.vimeo.com/video/${videoId}" 
                            frameborder="0" 
                            allow="autoplay; fullscreen; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            }
        }
        
        // If we couldn't embed, show a link
        if (!videoEmbedHtml) {
            videoEmbedHtml = `
                <div class="property-video-link" style="padding: 1.5rem; background: var(--bg-light, #f9fafb); border-radius: 8px; text-align: center;">
                    <i class="fas fa-video" style="font-size: 2rem; color: var(--primary-color, #3b82f6); margin-bottom: 1rem;"></i>
                    <p style="margin-bottom: 1rem; color: var(--text-color, #1f2937);">Video preview available</p>
                    <a href="${videoLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--primary-color, #3b82f6); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                        <i class="fas fa-external-link-alt" style="margin-right: 0.5rem;"></i>
                        Watch Video
                    </a>
                </div>
            `;
        }
        
        videoContainer.innerHTML = videoEmbedHtml;
        videoSection.style.display = 'block';
    }
    
    // Render Features
    const featuresElement = document.getElementById('propertyFeatures');
    if (featuresElement) {
        // Guard: Ensure features is an array and has valid entries
        const safeFeatures = Array.isArray(features) && features.length > 0 
            ? features.filter(f => f && typeof f === 'string' && f.trim())
            : [];
        
        if (safeFeatures.length > 0) {
            featuresElement.innerHTML = safeFeatures.map(feature => {
                const featureName = escapeHtml(String(feature).trim());
                return `
        <div class="property-feature-item">
            <i class="fas fa-check-circle"></i>
                <span>${featureName}</span>
        </div>
            `;
            }).join('');
        } else {
            featuresElement.innerHTML = '<p class="no-features" style="color: #6b7280; font-style: italic;">No features listed for this property. Features may not have been added during property creation.</p>';
        }
    }
    
    // Render Sidebar - Price Display
    const price = document.getElementById('propertyPrice');
    
    // Get price text from property object (set in convertPropertyFromAPI)
    // Ensure it's a string and not empty/null
    let displayPriceText = '';
    if (property.price_text) {
        displayPriceText = String(property.price_text).trim();
    }
    
    // If no price_text, check if price is a string
    if (!displayPriceText && typeof property.price === 'string' && property.price.trim() !== '') {
        displayPriceText = property.price.trim();
    }
    
    // Check if this is a per sq.ft. price - if so, display price_text as-is or format the numeric price
    const isPerSqft = displayPriceText && (
        displayPriceText.toLowerCase().includes('sq.ft') || 
        displayPriceText.toLowerCase().includes('sqft') || 
        displayPriceText.toLowerCase().includes('per sq') ||
        displayPriceText.toLowerCase().includes('/sq')
    );
    
    // Display price with proper formatting and heading
    // Priority: price_text > string price > formatted numeric price
    let priceContent = '';
    
    // Handle per sq.ft. prices first
    if (isPerSqft) {
        // For per sq.ft. prices, show the price_text if available, otherwise format the numeric price
        if (displayPriceText) {
            priceContent = displayPriceText;
        } else if (typeof property.price === 'number' && property.price > 0) {
            priceContent = `Rs. ${property.price.toLocaleString('en-IN')}/- Sq.Ft.`;
        } else {
            priceContent = 'Price on request';
        }
    } else if (displayPriceText && displayPriceText !== '' && displayPriceText !== String(property.price) && displayPriceText !== String(Math.round(property.price))) {
        // Use the price text if available (e.g., "3BHK: Rs.3.32 Cr, 4BHK: Rs.3.72 Cr")
        // Format it nicely with line breaks if it contains multiple prices
        let formattedPrice = displayPriceText;
        // If it contains "3BHK" and "4BHK", format with line breaks
        if (displayPriceText.includes('3BHK') && displayPriceText.includes('4BHK')) {
            formattedPrice = displayPriceText
                .replace(/(3BHK[^4]*?)(4BHK)/g, '$1<br>$2')
                .replace(/,/g, '<br>');
        } else if (displayPriceText.includes(',')) {
            // If it has commas, replace with line breaks
            formattedPrice = displayPriceText.replace(/,/g, '<br>');
        }
        priceContent = formattedPrice;
    } else if (typeof property.price === 'string' && property.price.trim() !== '') {
        // Price is already a string - use it directly
        priceContent = property.price;
    } else if (typeof property.price === 'number' && property.price > 0) {
        // Price is a number - format it with Indian currency
        if (property.price >= 10000000) {
            // Crores
            const crores = (property.price / 10000000).toFixed(2);
            priceContent = `Rs. ${crores} Cr`;
        } else if (property.price >= 100000) {
            // Lakhs
            const lakhs = (property.price / 100000).toFixed(2);
            priceContent = `Rs. ${lakhs} Lakh`;
        } else {
            // For small numbers, check if it might be in crores (e.g., 3.32 could mean 3.32 Cr)
            if (property.price < 100 && property.price > 0) {
                priceContent = `Rs. ${property.price.toFixed(2)} Cr`;
            } else {
                // Regular formatting with commas
                priceContent = `Rs. ${property.price.toLocaleString('en-IN')}`;
            }
        }
    } else {
        // Fallback
        priceContent = 'Price on request';
    }
    
    // Wrap price content with heading and appropriately sized font
    // Note: priceContent may contain HTML (line breaks), so we don't escape it
    price.innerHTML = `
        <div style="margin-bottom: 0.5rem;">
            <h3 style="font-size: 26px; font-weight: 600; margin: 0 0 0.75rem 0; color: #1f2937; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-tag" style="font-size: 22px;"></i>
                <span>Price</span>
            </h3>
        </div>
        <div style="font-size: 22px; line-height: 1.6; color: #374151;">
            ${priceContent}
        </div>
    `;
    
    const status = document.getElementById('propertyStatus');
    let statusText = 'For Sale';
    let statusClass = 'sale';
    if (property.status === 'rent') {
        statusText = 'For Rent';
        statusClass = 'rent';
    } else if (property.status === 'ready_to_move') {
        statusText = 'Ready to Move';
        statusClass = 'ready-to-move';
    } else if (property.status === 'under_construction') {
        statusText = 'Under Construction';
        statusClass = 'under-construction';
    }
    status.innerHTML = `<span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>`;
    
    // Display Listing Type if available
    const listingType = document.getElementById('propertyListingType');
    if (listingType && property.listing_type) {
        const listingTypeText = property.listing_type === 'new' ? 'New' : 
                               property.listing_type === 'resell' ? 'Resell' : 
                               property.listing_type;
        listingType.innerHTML = `
            <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-light, #f9fafb); border-radius: 8px; border-left: 3px solid var(--primary-color, #3b82f6);">
                <span style="font-size: 0.9rem; color: var(--text-gray, #6b7280);">Listing Type:</span>
                <span style="font-weight: 600; color: var(--text-color, #1f2937); margin-left: 0.5rem;">${escapeHtml(listingTypeText)}</span>
            </div>
        `;
        listingType.style.display = 'block';
    }
    
    // Display Price Negotiable if applicable
    const priceNegotiable = document.getElementById('propertyPriceNegotiable');
    if (priceNegotiable && property.price_negotiable) {
        priceNegotiable.innerHTML = `
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;">
                <i class="fas fa-handshake" style="color: #f59e0b; margin-right: 0.5rem;"></i>
                <span style="font-weight: 600; color: #92400e;">Price is Negotiable</span>
            </div>
        `;
        priceNegotiable.style.display = 'block';
    }
    
    const quickInfo = document.getElementById('propertyQuickInfo');
    const propertyTypeFormatted = escapeHtml((property.type || 'apartment').charAt(0).toUpperCase() + (property.type || 'apartment').slice(1));
    const isPlot = property.type === 'plot' || property.property_category === 'plot';
    
    let quickInfoHTML = `
        <div class="quick-info-item">
            <i class="fas fa-building"></i>
            <div>
                <span class="quick-info-label">Type</span>
                <span class="quick-info-value">${propertyTypeFormatted}</span>
            </div>
        </div>
    `;
    
    // For residential properties, show bedrooms and bathrooms
    if (!isPlot && property.bedrooms !== null && property.bedrooms !== undefined && property.bedrooms > 0) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-bed"></i>
            <div>
                <span class="quick-info-label">Bedrooms</span>
                <span class="quick-info-value">${property.bedrooms}</span>
            </div>
        </div>
        `;
    }
    
    if (!isPlot && property.bathrooms !== null && property.bathrooms !== undefined && property.bathrooms > 0) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-bath"></i>
            <div>
                <span class="quick-info-label">Bathrooms</span>
                <span class="quick-info-value">${property.bathrooms}</span>
            </div>
        </div>
        `;
    }
    
    // Show area (buildup_area for residential, plot_area for plots)
    if (property.area) {
        const areaLabel = isPlot ? 'Plot Area' : 'Area';
        const areaValue = isPlot ? (property.plot_area || property.area) : (property.buildup_area || property.area);
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-ruler-combined"></i>
            <div>
                <span class="quick-info-label">${areaLabel}</span>
                <span class="quick-info-value">${escapeHtml(String(areaValue))} sq.ft.</span>
            </div>
        </div>
        `;
    }
    
    // For plots, show plot dimensions
    if (isPlot && property.plot_length && property.plot_breadth) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-ruler"></i>
            <div>
                <span class="quick-info-label">Dimensions</span>
                <span class="quick-info-value">${escapeHtml(String(property.plot_length))} × ${escapeHtml(String(property.plot_breadth))} ft</span>
            </div>
        </div>
        `;
    }
    
    // For residential, show carpet area if available
    if (!isPlot && property.carpet_area) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-ruler"></i>
            <div>
                <span class="quick-info-label">Carpet Area</span>
                <span class="quick-info-value">${escapeHtml(String(property.carpet_area))} sq.ft.</span>
            </div>
        </div>
        `;
    }
    
    // Show direction if available
    if (property.direction || property.facing || property.orientation) {
        const direction = property.direction || property.facing || property.orientation;
        const formatDirection = (dir) => {
            if (!dir) return 'N/A';
            const dirLower = dir.toLowerCase();
            const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
            for (const d of directions) {
                if (dirLower.includes(d)) {
                    return d.replace(/\b\w/g, l => l.toUpperCase());
                }
            }
            return dir.replace(/\b\w/g, l => l.toUpperCase());
        };
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-compass"></i>
            <div>
                <span class="quick-info-label">Direction</span>
                <span class="quick-info-value">${escapeHtml(formatDirection(direction))}</span>
            </div>
        </div>
        `;
    }
    
    // Add new fields if available (with proper escaping)
    if (property.builder) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-building"></i>
            <div>
                <span class="quick-info-label">Builder</span>
                <span class="quick-info-value">${escapeHtml(property.builder)}</span>
            </div>
        </div>
        `;
    }
    
    
    if (property.super_built_up_area) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-ruler-combined"></i>
            <div>
                <span class="quick-info-label">Super Built-up Area</span>
                <span class="quick-info-value">${escapeHtml(property.super_built_up_area)}</span>
            </div>
        </div>
        `;
    }
    
    if (property.total_flats) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-building"></i>
            <div>
                <span class="quick-info-label">Total Flats</span>
                <span class="quick-info-value">${escapeHtml(String(property.total_flats))}</span>
            </div>
        </div>
        `;
    }
    
    if (property.total_floors) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-layer-group"></i>
            <div>
                <span class="quick-info-label">Total Floors</span>
                <span class="quick-info-value">${escapeHtml(String(property.total_floors))}</span>
            </div>
        </div>
        `;
    }
    
    if (property.total_acres) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-map"></i>
            <div>
                <span class="quick-info-label">Total Acres</span>
                <span class="quick-info-value">${escapeHtml(String(property.total_acres))}</span>
            </div>
        </div>
        `;
    }
    
    // Show plot_area separately if it's different from area (for plots)
    if (isPlot && property.plot_area && property.plot_area !== property.area) {
        quickInfoHTML += `
        <div class="quick-info-item">
            <i class="fas fa-ruler"></i>
            <div>
                <span class="quick-info-label">Plot Area</span>
                <span class="quick-info-value">${escapeHtml(String(property.plot_area))} sq.ft.</span>
            </div>
        </div>
        `;
    }
    
    quickInfo.innerHTML = quickInfoHTML;
    
    // Render Location and Directions Links
    const locationLinks = document.getElementById('propertyLocationLinks');
    const propertyLocation = property.location || 'Location not specified';
    const locationEncoded = encodeURIComponent(propertyLocation);
    
    // Use location_link if available, otherwise create Google Maps links
    let mapsSearchUrl = '';
    let mapsDirectionsUrl = '';
    
    if (property.location_link) {
        // Use the provided location link
        mapsSearchUrl = property.location_link;
        mapsDirectionsUrl = property.location_link;
    } else {
        // Create Google Maps links from location text
        mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${locationEncoded}`;
        mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${locationEncoded}`;
    }
    
    locationLinks.innerHTML = `
        <div class="property-location-links-content">
            <a href="${escapeHtml(mapsSearchUrl)}" target="_blank" rel="noopener noreferrer" class="property-location-link">
                <i class="fas fa-map-marker-alt"></i>
                <span>${escapeHtml(propertyLocation)}</span>
            </a>
            <a href="${escapeHtml(mapsDirectionsUrl)}" target="_blank" rel="noopener noreferrer" class="property-directions-link">
                <i class="fas fa-directions"></i>
                <span>Get Directions</span>
            </a>
        </div>
    `;
    
    } catch (error) {
        console.error('Error rendering property details:', error);
        // Ensure content is still shown even if rendering fails
        hideLoadingState();
        throw error; // Re-throw to let caller handle it
    }
}

// Render Gallery with Filter
function renderGallery(filterType, propertyTitle) {
    const gallery = document.getElementById('propertyGallery');
    if (!gallery) return;
    
    // Get images for the selected filter
    const filteredImages = categorizedImages[filterType] || categorizedImages.project;
    
    // If no images in this category, show a message
    if (filteredImages.length === 0) {
        gallery.innerHTML = `
            <div class="property-main-image" style="display: flex; align-items: center; justify-content: center; min-height: 300px;">
                <p style="color: var(--text-light); font-size: 18px;">No ${filterType === 'floorplan' ? 'Floor Plan' : filterType === 'masterplan' ? 'Master Plan' : 'Project'} images available</p>
            </div>
            <div class="property-thumbnails"></div>
        `;
        return;
    }
    
    // Create placeholder image for properties without images
    const imagePlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image Available%3C/text%3E%3C/svg%3E';
    
    const mainImage = filteredImages.length > 0 ? filteredImages[0] : imagePlaceholder;
    const escapedTitle = escapeHtml(propertyTitle || 'Property');
    
    gallery.innerHTML = `
        <div class="property-main-image">
            <img src="${escapeHtml(mainImage)}" alt="${escapedTitle}" loading="lazy" onerror="this.src='${imagePlaceholder}'">
        </div>
        <div class="property-thumbnails">
            ${filteredImages.map((img, index) => `
                <div class="property-thumbnail ${index === 0 ? 'active' : ''}" data-image-type="${filterType}">
                    <img src="${escapeHtml(img || imagePlaceholder)}" alt="${escapedTitle}" loading="lazy" onerror="this.src='${imagePlaceholder}'">
                </div>
            `).join('')}
        </div>
    `;
    
    // Add thumbnail click handlers
    const thumbnails = gallery.querySelectorAll('.property-thumbnail');
    const mainImageElement = gallery.querySelector('.property-main-image img');
    
    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            const imgSrc = thumbnail.querySelector('img').src;
            mainImageElement.src = imgSrc;
        });
    });
    
    // Update lightbox images for current filter
    currentLightboxImages = filteredImages;
    currentLightboxTitle = escapedTitle;
    
    // Initialize lightbox if not already done
    if (!window.lightboxInitialized) {
        initImageLightbox();
        window.lightboxInitialized = true;
    }
}

// Initialize Image Filter Buttons
function initImageFilters() {
    const filterButtons = document.querySelectorAll('.image-filter-btn');
    if (!filterButtons || filterButtons.length === 0) return;
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filterType = button.getAttribute('data-filter');
            
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Get property title for rendering
            const propertyTitle = document.querySelector('.property-details-title')?.textContent || 'Property';
            
            // Render gallery with selected filter
            renderGallery(filterType, propertyTitle);
        });
    });
}

// Store current lightbox state
let currentLightboxImages = [];
let currentLightboxTitle = '';
let currentLightboxIndex = 0;

// Initialize Image Lightbox (using event delegation - only called once)
function initImageLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCounter = document.getElementById('lightboxCounter');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    
    if (!lightbox || !lightboxImage) return;
    
    // Function to update lightbox image
    function updateLightboxImage() {
        const totalImages = currentLightboxImages.length;
        if (currentLightboxIndex < 0 || currentLightboxIndex >= totalImages) return;
        
        // Create placeholder image for properties without images
        const imagePlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image Available%3C/text%3E%3C/svg%3E';
        
        const imageUrl = currentLightboxImages[currentLightboxIndex] || imagePlaceholder;
        lightboxImage.src = imageUrl;
        lightboxImage.alt = `${currentLightboxTitle} - Image ${currentLightboxIndex + 1}`;
        if (lightboxCounter) {
            lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${totalImages}`;
        }
        
        // Update navigation buttons visibility
        if (lightboxPrev) {
            lightboxPrev.style.display = currentLightboxIndex === 0 ? 'none' : 'flex';
        }
        if (lightboxNext) {
            lightboxNext.style.display = currentLightboxIndex >= totalImages - 1 ? 'none' : 'flex';
        }
    }
    
    // Function to open lightbox
    function openLightbox(index) {
        const totalImages = currentLightboxImages.length;
        if (index < 0 || index >= totalImages) return;
        currentLightboxIndex = index;
        updateLightboxImage();
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Function to close lightbox
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Function to go to previous image
    function prevImage() {
        if (currentLightboxIndex > 0) {
            currentLightboxIndex--;
            updateLightboxImage();
        }
    }
    
    // Function to go to next image
    function nextImage() {
        if (currentLightboxIndex < currentLightboxImages.length - 1) {
            currentLightboxIndex++;
            updateLightboxImage();
        }
    }
    
    // Use event delegation on gallery container (only set up once)
    const gallery = document.getElementById('propertyGallery');
    if (gallery && !gallery.hasAttribute('data-lightbox-initialized')) {
        gallery.setAttribute('data-lightbox-initialized', 'true');
        gallery.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (!img || !img.closest('.property-gallery')) return;
            
            e.stopPropagation();
            img.style.cursor = 'pointer';
            
            // Find which image was clicked
            let clickedIndex = 0;
            if (img.closest('.property-main-image')) {
                // Main image clicked
                clickedIndex = 0;
            } else if (img.closest('.property-thumbnail')) {
                // Thumbnail clicked - find its index
                const thumbnails = gallery.querySelectorAll('.property-thumbnail');
                thumbnails.forEach((thumb, idx) => {
                    if (thumb.contains(img)) {
                        clickedIndex = idx;
                    }
                });
            }
            
            openLightbox(clickedIndex);
        });
    }
    
    // Close button (only add once)
    if (lightboxClose && !lightboxClose.hasAttribute('data-listener-added')) {
        lightboxClose.setAttribute('data-listener-added', 'true');
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    // Overlay click to close (only add once)
    if (lightboxOverlay && !lightboxOverlay.hasAttribute('data-listener-added')) {
        lightboxOverlay.setAttribute('data-listener-added', 'true');
        lightboxOverlay.addEventListener('click', closeLightbox);
    }
    
    // Navigation buttons (only add once)
    if (lightboxPrev && !lightboxPrev.hasAttribute('data-listener-added')) {
        lightboxPrev.setAttribute('data-listener-added', 'true');
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            prevImage();
        });
    }
    
    if (lightboxNext && !lightboxNext.hasAttribute('data-listener-added')) {
        lightboxNext.setAttribute('data-listener-added', 'true');
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            nextImage();
        });
    }
    
    // Keyboard navigation (only add once)
    if (!window.lightboxKeyboardListenerAdded) {
        window.lightboxKeyboardListenerAdded = true;
        document.addEventListener('keydown', (e) => {
            if (!lightbox || lightbox.style.display === 'none' || lightbox.style.display === '') return;
            
            switch(e.key) {
                case 'Escape':
                    closeLightbox();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevImage();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextImage();
                    break;
            }
        });
    }
    
    // Prevent lightbox content clicks from closing (only add once)
    if (lightboxImage && !lightboxImage.hasAttribute('data-listener-added')) {
        lightboxImage.setAttribute('data-listener-added', 'true');
        lightboxImage.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Initialize Contact Agent Modal
function initContactAgentModal() {
    const contactAgentBtn = document.getElementById('contactAgentBtn');
    const contactInfoModal = document.getElementById('contactInfoModal');
    const contactInfoModalClose = document.getElementById('contactInfoModalClose');
    const contactInfoModalOverlay = document.getElementById('contactInfoModalOverlay');
    const contactAgentModal = document.getElementById('contactAgentModal');
    const contactAgentModalClose = document.getElementById('contactAgentModalClose');
    const contactAgentModalOverlay = document.getElementById('contactAgentModalOverlay');
    const contactAgentForm = document.getElementById('contactAgentForm');
    const contactAgentMessage = document.getElementById('contactAgentMessage');

    // Detect if device is mobile
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    // Open contact info modal
    function openContactInfoModal() {
        if (contactInfoModal) {
            contactInfoModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Close contact info modal
    function closeContactInfoModal() {
        if (contactInfoModal) {
            contactInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Handle Contact Agent button click
    if (contactAgentBtn) {
        contactAgentBtn.addEventListener('click', (e) => {
            // If mobile device, open dialer directly
            if (isMobileDevice()) {
                window.location.href = 'tel:+919741111756';
            } else {
                // If desktop, show contact info modal
                e.preventDefault();
                openContactInfoModal();
            }
        });
    }

    // Close contact info modal handlers
    if (contactInfoModalClose) {
        contactInfoModalClose.addEventListener('click', closeContactInfoModal);
    }

    if (contactInfoModalOverlay) {
        contactInfoModalOverlay.addEventListener('click', closeContactInfoModal);
    }

    // Close contact info modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && contactInfoModal && contactInfoModal.classList.contains('active')) {
            closeContactInfoModal();
        }
    });

    // Handle navigation contact link - intercept #contact hash links
    const contactNavLink = document.querySelector('a[href="#contact"]');
    if (contactNavLink) {
        contactNavLink.addEventListener('click', (e) => {
            e.preventDefault();
            openContactInfoModal();
        });
    }

    // Copy phone number to clipboard on click
    const contactInfoLink = document.querySelector('#contactInfoModal .contact-info-link');
    if (contactInfoLink) {
        contactInfoLink.addEventListener('click', async (e) => {
            // On mobile, let the tel: link work normally
            if (isMobileDevice()) {
                return; // Allow default tel: behavior
            }
            
            // On desktop, copy to clipboard
            e.preventDefault();
            const phoneNumber = '+91 97411 11756';
            
            try {
                await navigator.clipboard.writeText(phoneNumber);
                
                // Show feedback
                const originalText = contactInfoLink.textContent;
                contactInfoLink.textContent = 'Copied!';
                contactInfoLink.style.color = '#22c55e';
                
                setTimeout(() => {
                    contactInfoLink.textContent = originalText;
                    contactInfoLink.style.color = '';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = phoneNumber;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const originalText = contactInfoLink.textContent;
                    contactInfoLink.textContent = 'Copied!';
                    contactInfoLink.style.color = '#22c55e';
                    setTimeout(() => {
                        contactInfoLink.textContent = originalText;
                        contactInfoLink.style.color = '';
                    }, 2000);
                } catch (fallbackErr) {
                    console.error('Fallback copy failed:', fallbackErr);
                }
                document.body.removeChild(textArea);
            }
        });
    }

    // Close modal
    function closeModal() {
        contactAgentModal.classList.remove('active');
        document.body.style.overflow = '';
        contactAgentMessage.style.display = 'none';
        contactAgentForm.reset();
    }

    if (contactAgentModalClose) {
        contactAgentModalClose.addEventListener('click', closeModal);
    }

    if (contactAgentModalOverlay) {
        contactAgentModalOverlay.addEventListener('click', closeModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && contactAgentModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Form submission
    if (contactAgentForm) {
        contactAgentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('agentContactName').value.trim();
            const email = document.getElementById('agentContactEmail').value.trim();
            const phone = document.getElementById('agentContactPhone').value.trim();
            const subject = document.getElementById('agentContactSubject').value.trim();
            const message = document.getElementById('agentContactMessage').value.trim();
            
            const submitBtn = contactAgentForm.querySelector('.btn-login-submit');
            const originalText = submitBtn.innerHTML;
            
            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            contactAgentMessage.style.display = 'none';
            
            try {
                // Build form data - set specific subject for Contact Agent inquiries
                const formData = {
                    name: name,
                    email: email,
                    message: message,
                    subject: 'Contact Agent', // Set specific subject to identify Contact Agent inquiries
                    phone: phone || null
                };
                
                // Add property_id only if it exists
                if (currentPropertyId !== null && currentPropertyId !== undefined) {
                    formData.property_id = parseInt(currentPropertyId);
                }
                
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    throw new Error('Invalid response from server');
                }
                
                if (response.ok) {
                    // Success
                    contactAgentMessage.style.display = 'block';
                    contactAgentMessage.className = 'form-message success';
                    contactAgentMessage.textContent = 'Thank you for your message! Our agent will get back to you soon.';
                    contactAgentForm.reset();
                    
                    // Close modal after 2 seconds
                    setTimeout(() => {
                        closeModal();
                    }, 2000);
                } else {
                    // Error from server - handle validation errors
                    let errorMsg = 'Failed to send message. Please try again.';
                    
                    if (data.detail) {
                        // FastAPI validation errors come as a list
                        if (Array.isArray(data.detail)) {
                            const errors = data.detail.map(err => {
                                const field = err.loc ? err.loc.join('.') : 'field';
                                return `${field}: ${err.msg}`;
                            }).join(', ');
                            errorMsg = `Validation error: ${errors}`;
                        } else if (typeof data.detail === 'string') {
                            errorMsg = data.detail;
                        } else {
                            errorMsg = JSON.stringify(data.detail);
                        }
                    } else if (data.error) {
                        errorMsg = data.error;
                    }
                    
                    contactAgentMessage.style.display = 'block';
                    contactAgentMessage.className = 'form-message error';
                    contactAgentMessage.textContent = errorMsg;
                }
            } catch (error) {
                console.error('Error submitting contact form:', error);
                contactAgentMessage.style.display = 'block';
                contactAgentMessage.className = 'form-message error';
                contactAgentMessage.textContent = 'Network error. Please check your connection and try again.';
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
}

// Initialize Schedule Visit Modal
function initScheduleVisitModal() {
    const scheduleVisitBtn = document.getElementById('scheduleVisitBtn');
    const scheduleVisitModal = document.getElementById('scheduleVisitModal');
    const scheduleVisitModalClose = document.getElementById('scheduleVisitModalClose');
    const scheduleVisitModalOverlay = document.getElementById('scheduleVisitModalOverlay');
    const scheduleVisitForm = document.getElementById('scheduleVisitForm');
    const scheduleVisitMessage = document.getElementById('scheduleVisitMessage');
    const visitDateInput = document.getElementById('visitDate');

    // Set minimum date to today
    if (visitDateInput) {
        const today = new Date().toISOString().split('T')[0];
        visitDateInput.setAttribute('min', today);
    }

    // Open modal
    if (scheduleVisitBtn) {
        scheduleVisitBtn.addEventListener('click', () => {
            scheduleVisitModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modal
    function closeModal() {
        scheduleVisitModal.classList.remove('active');
        document.body.style.overflow = '';
        scheduleVisitMessage.style.display = 'none';
        scheduleVisitForm.reset();
    }

    if (scheduleVisitModalClose) {
        scheduleVisitModalClose.addEventListener('click', closeModal);
    }

    if (scheduleVisitModalOverlay) {
        scheduleVisitModalOverlay.addEventListener('click', closeModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && scheduleVisitModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Form submission
    if (scheduleVisitForm) {
        scheduleVisitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('visitName').value.trim();
            const email = document.getElementById('visitEmail').value.trim();
            const phone = document.getElementById('visitPhone').value.trim();
            const visitDate = document.getElementById('visitDate').value;
            const visitTime = document.getElementById('visitTime').value;
            const message = document.getElementById('visitMessage').value.trim();
            
            const submitBtn = scheduleVisitForm.querySelector('.btn-login-submit');
            const originalText = submitBtn.innerHTML;
            
            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
            scheduleVisitMessage.style.display = 'none';
            
            try {
                // Format date and time for display
                const dateObj = new Date(visitDate);
                const formattedDate = dateObj.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const formattedTime = visitTime ? new Date(`2000-01-01T${visitTime}`).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }) : '';
                
                // Build message with visit details
                let fullMessage = `I would like to schedule a visit for:\n\n`;
                fullMessage += `Preferred Date: ${formattedDate}\n`;
                fullMessage += `Preferred Time: ${formattedTime}\n\n`;
                
                if (message) {
                    fullMessage += `Additional Notes:\n${message}`;
                }
                
                // Build form data - match the pattern from existing contact form
                const formData = {
                    name: name,
                    email: email,
                    message: fullMessage,
                    subject: 'Schedule Visit',
                    phone: phone || null
                };
                
                // Add property_id only if it exists
                if (currentPropertyId !== null && currentPropertyId !== undefined) {
                    formData.property_id = parseInt(currentPropertyId);
                }
                
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    throw new Error('Invalid response from server');
                }
                
                if (response.ok) {
                    // Success
                    scheduleVisitMessage.style.display = 'block';
                    scheduleVisitMessage.className = 'form-message success';
                    scheduleVisitMessage.textContent = 'Visit scheduled successfully! Our agent will confirm the appointment and contact you soon.';
                    scheduleVisitForm.reset();
                    
                    // Close modal after 3 seconds
                    setTimeout(() => {
                        closeModal();
                    }, 3000);
                } else {
                    // Error from server - handle validation errors
                    let errorMsg = 'Failed to schedule visit. Please try again.';
                    
                    if (data.detail) {
                        // FastAPI validation errors come as a list
                        if (Array.isArray(data.detail)) {
                            const errors = data.detail.map(err => {
                                const field = err.loc ? err.loc.join('.') : 'field';
                                return `${field}: ${err.msg}`;
                            }).join(', ');
                            errorMsg = `Validation error: ${errors}`;
                        } else if (typeof data.detail === 'string') {
                            errorMsg = data.detail;
                        } else {
                            errorMsg = JSON.stringify(data.detail);
                        }
                    } else if (data.error) {
                        errorMsg = data.error;
                    }
                    
                    scheduleVisitMessage.style.display = 'block';
                    scheduleVisitMessage.className = 'form-message error';
                    scheduleVisitMessage.textContent = errorMsg;
                }
            } catch (error) {
                console.error('Error submitting schedule visit form:', error);
                scheduleVisitMessage.style.display = 'block';
                scheduleVisitMessage.className = 'form-message error';
                scheduleVisitMessage.textContent = 'Network error. Please check your connection and try again.';
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
}