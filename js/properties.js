// Properties Page JavaScript

// HTML escaping function for security
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load Properties from API
let allProperties = [];
let displayedProperties = 8;
let currentFilter = 'all';
let filteredProperties = [];
let currentPage = 1;
let hasMorePages = true;
const limit = 100; // Maximum allowed by API

// Filter state variables
let selectedCondition = null; // 'new' or 'resale'
let selectedBHK = null; // 1, 2, 3, 4, or 5
let selectedPropertyType = null; // property type from buttons
let selectedCategory = null; // 'residential' or 'commercial'

// Get only the numeric price and unit for display. ₹ and Cr/L are hardcoded in the template.
// Returns { value: "3.32", unit: "Cr" } or { value: "50", unit: "L" } or { value: null, unit: "Cr" }.
function getPriceForDisplay(property) {
    let num = null;
    let unit = 'Cr';

    if (property.price_text !== null && property.price_text !== undefined && property.price_text !== '') {
        const text = String(property.price_text).trim();
        const numMatch = text.match(/[\d,]+\.?[\d]*|[\d]+/);
        if (numMatch) {
            num = parseFloat(numMatch[0].replace(/,/g, ''));
            if (!isNaN(num) && num > 0) {
                if (text.toLowerCase().includes('lakh') || text.includes(' L')) unit = 'L';
                else unit = 'Cr';
                if (num >= 10000000) {
                    return { value: (num / 10000000).toFixed(2), unit: 'Cr' };
                }
                if (num >= 100000) {
                    return { value: (num / 100000).toFixed(2), unit: 'L' };
                }
                if (num >= 1 && num < 1000) {
                    return { value: num.toFixed(2), unit };
                }
            }
        }
    }
    if (typeof property.price === 'string' && property.price.trim() !== '') {
        num = parseFloat(property.price.replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
            if (num >= 10000000) {
                return { value: (num / 10000000).toFixed(2), unit: 'Cr' };
            }
            if (num >= 100000) {
                return { value: (num / 100000).toFixed(2), unit: 'L' };
            }
            if (num < 1000 && num >= 1) {
                return { value: num.toFixed(2), unit: 'Cr' };
            }
        }
    }
    if (typeof property.price === 'number' && property.price > 0) {
        if (property.price >= 10000000) {
            return { value: (property.price / 10000000).toFixed(2), unit: 'Cr' };
        }
        if (property.price >= 100000) {
            return { value: (property.price / 100000).toFixed(2), unit: 'L' };
        }
        if (property.price < 100 && property.price >= 1) {
            return { value: property.price.toFixed(2), unit: 'Cr' };
        }
        return { value: property.price.toLocaleString('en-IN'), unit: 'Cr' };
    }
    return { value: null, unit: 'Cr' };
}

// Show loading state
function showLoadingState() {
    const loadingEl = document.getElementById('propertiesLoading');
    const errorEl = document.getElementById('propertiesError');
    const gridEl = document.getElementById('propertiesGrid');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl) errorEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';
}

// Hide loading state
function hideLoadingState() {
    const loadingEl = document.getElementById('propertiesLoading');
    const gridEl = document.getElementById('propertiesGrid');

    if (loadingEl) loadingEl.style.display = 'none';
    if (gridEl) {
        gridEl.style.display = 'grid';
        // Remove any inline grid-template-columns to let CSS handle it
        gridEl.style.gridTemplateColumns = '';
    }
}

// Show error state
function showErrorState(message = 'Best of the properties are being selected for you, please wait...') {
    const loadingEl = document.getElementById('propertiesLoading');
    const errorEl = document.getElementById('propertiesError');
    const gridEl = document.getElementById('propertiesGrid');

    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
        errorEl.style.display = 'block';
        const errorMsg = errorEl.querySelector('p');
        if (errorMsg) errorMsg.textContent = message;
    }
    if (gridEl) gridEl.style.display = 'none';
}

// Fetch with timeout helper
function fetchWithTimeout(url, options = {}, timeout = 30000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

async function loadPropertiesFromAPI() {
    try {
        showLoadingState();

        // Fetch active properties from API
        let allFetchedProperties = [];
        let page = 1;
        let hasMore = true;
        const maxPages = 50; // Safety limit to prevent infinite loops
        const startTime = Date.now();

        while (hasMore && page <= maxPages) {
            const pageStartTime = Date.now();

            try {
                const response = await fetchWithTimeout(
                    `/api/properties?is_active=true&page=${page}&limit=${limit}`,
                    {},
                    30000 // 30 second timeout per request
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to fetch properties: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                const properties = data.items || [];
                allFetchedProperties = allFetchedProperties.concat(properties);

                const pageTime = Date.now() - pageStartTime;

                // Check if there are more pages
                hasMore = page < data.pages;
                page++;

                // If we have enough properties for initial display, show them progressively
                if (allFetchedProperties.length >= 8 && page === 2) {
                    // Show first batch immediately
                    allProperties = allFetchedProperties.map(property => {
                        // Convert API format to display format (same as below)
                        return convertPropertyToDisplayFormat(property);
                    });
                    filteredProperties = [...allProperties];
                    displayedProperties = 8;
                    hideLoadingState();
                    renderProperties();
                    updateLoadMoreButton();
                }
            } catch (error) {
                console.error(`Error fetching page ${page}:`, error);
                // If it's a timeout and we have some properties, use what we have
                if (error.message === 'Request timeout' && allFetchedProperties.length > 0) {
                    break;
                }
                throw error;
            }
        }

        const totalTime = Date.now() - startTime;

        // If no properties found, show message
        if (allFetchedProperties.length === 0) {
            hideLoadingState();
            const grid = document.getElementById('propertiesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="no-properties">
                        <i class="fas fa-spinner fa-spin"></i>
                        <h3>Best Properties Being Selected</h3>
                        <p>Best of the properties are being selected for you, please wait...</p>
                    </div>
                `;
            }
            return;
        }

        // Convert property from API format to display format
        function convertPropertyToDisplayFormat(property) {
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

            // Handle images - API returns array of objects with image_url, or primary_image string
            // Get image from database - no hardcoded fallback
            let imageUrl = null;
            if (property.primary_image) {
                imageUrl = normalizeImageUrl(property.primary_image);
            } else if (property.images && property.images.length > 0) {
                // If images is array of objects
                if (typeof property.images[0] === 'object' && property.images[0].image_url) {
                    imageUrl = normalizeImageUrl(property.images[0].image_url);
                } else if (typeof property.images[0] === 'string') {
                    imageUrl = normalizeImageUrl(property.images[0]);
                }
            }

            // Get price_text from property - check multiple possible locations
            let priceText = '';
            if (property.price_text !== null && property.price_text !== undefined && property.price_text !== '') {
                priceText = String(property.price_text).trim();
            }

            // Ensure price is a number (API might return it as string)
            let priceValue = property.price;
            if (typeof priceValue === 'string') {
                priceValue = parseFloat(priceValue);
            }
            if (isNaN(priceValue) || priceValue <= 0) {
                priceValue = 0;
            }

            // Guard: Ensure features is always an array
            let safeFeatures = [];
            if (property.features && Array.isArray(property.features)) {
                safeFeatures = property.features.filter(f => {
                    if (!f) return false;
                    if (typeof f === 'string') return f.trim().length > 0;
                    if (f && typeof f === 'object' && f.feature_name) {
                        return String(f.feature_name).trim().length > 0;
                    }
                    return false;
                }).map(f => {
                    if (typeof f === 'string') return f.trim();
                    if (f && typeof f === 'object' && f.feature_name) {
                        return String(f.feature_name).trim();
                    }
                    return String(f).trim();
                });
            }

            // Guard: Ensure images is always an array
            let safeImages = [];
            if (property.images && Array.isArray(property.images)) {
                safeImages = property.images.filter(img => {
                    if (!img) return false;
                    if (typeof img === 'string') return img.trim().length > 0;
                    if (img && typeof img === 'object' && img.image_url) {
                        return String(img.image_url).trim().length > 0;
                    }
                    return false;
                });
            }

            const propType = typeof property.type === 'string' ? property.type : property.type?.value || property.type || 'apartment';
            // Extract listing_type - handle enum objects or strings
            let listingType = null;
            if (property.listing_type) {
                if (typeof property.listing_type === 'string') {
                    listingType = property.listing_type;
                } else if (property.listing_type?.value) {
                    listingType = property.listing_type.value;
                } else if (property.listing_type) {
                    listingType = String(property.listing_type);
                }
            }
            const category = (property.property_category || (property.category || '').toLowerCase()) || 'residential';
            return {
                id: property.id,
                title: property.title || 'Untitled Property',
                location: property.location || 'Location not specified',
                price: priceValue,
                price_text: priceText,
                type: propType,
                property_type: property.property_type ?? propType,
                category,
                property_category: category,
                bedrooms: property.bedrooms || 0,
                bathrooms: property.bathrooms || 0,
                area: property.area || null,
                status: typeof property.status === 'string' ? property.status : property.status?.value || property.status || 'sale',
                listing_type: listingType,
                image: imageUrl,
                images: safeImages,
                description: property.description || '',
                features: safeFeatures
            };
        }

        // Convert API format to display format
        allProperties = allFetchedProperties.map(property => {
            return convertPropertyToDisplayFormat(property);
        });

        // Initialize filtered properties
        filteredProperties = [...allProperties];
        displayedProperties = 8;

        hideLoadingState();

        // Render properties
        renderProperties();

        // Update load more button visibility
        updateLoadMoreButton();

    } catch (error) {
        console.error('Error loading properties from API:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        hideLoadingState();

        // Provide more specific error messages
        let errorMessage = 'Best of the properties are being selected for you, please wait...';
        if (error.message === 'Request timeout') {
            errorMessage = 'Best of the properties are being selected for you, please wait...';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Best of the properties are being selected for you, please wait...';
        }

        showErrorState(errorMessage);

        // Set up retry button
        const retryBtn = document.getElementById('retryLoadBtn');
        if (retryBtn) {
            retryBtn.onclick = () => {
                loadPropertiesFromAPI();
            };
        }

        // Don't use fallback properties - let user retry or see error
        allProperties = [];
        filteredProperties = [];
        displayedProperties = 8;
    }
}

// Get Properties from localStorage or use defaults (fallback)
function getPropertiesFromStorage() {
    const stored = localStorage.getItem('dashboard_properties');
    if (stored) {
        const properties = JSON.parse(stored);
        // Convert images array to single image for compatibility
        // Use dynamic image from database, no hardcoded fallback
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
            status: "sale"
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
            status: "sale"
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
            status: "sale"
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
            status: "rent"
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
            status: "sale"
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
            status: "sale"
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
            status: "sale"
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
            status: "sale"
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
            status: "rent"
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
            status: "sale"
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
            status: "sale"
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
            status: "rent"
        }
    ];
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure category section starts with no active category (subcategories hidden)
    const categorySection = document.querySelector('.category-section-centered');
    if (categorySection) {
        categorySection.removeAttribute('data-active-category');
    }

    // Load properties from API first
    await loadPropertiesFromAPI();

    // Initialize UI components
    initFilters();
    initSearch();
    initMainSearch();
    initFilterTags();
    initLoadMore();

    // Check URL parameters and apply filters
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const categoryParam = urlParams.get('category');
    const statusParam = urlParams.get('status');
    const searchParam = urlParams.get('search');
    const directionParam = urlParams.get('direction');
    const amenitiesParam = urlParams.get('amenities');
    const priceParam = urlParams.get('price');
    const conditionParam = urlParams.get('condition');
    const bhkParam = urlParams.get('bhk');
    const lengthParam = urlParams.get('length');
    const breadthParam = urlParams.get('breadth');
    const carpetAreaParam = urlParams.get('carpet_area');
    const plotAreaParam = urlParams.get('plot_area');
    const villaTypeParam = urlParams.get('villa_type');
    const warehouseTypeParam = urlParams.get('warehouse_type');
    const superBuildupParam = urlParams.get('super_buildup_area');

    // Apply search parameter if present
    if (searchParam) {
        const navSearchInput = document.getElementById('navSearchInput');
        const mainSearchInput = document.getElementById('mainSearchInput');
        const navSearchClear = document.getElementById('navSearchClear');
        const mainSearchClear = document.getElementById('mainSearchClear');
        const searchValue = decodeURIComponent(searchParam);

        if (navSearchInput) {
            navSearchInput.value = searchValue;
            if (navSearchClear) {
                navSearchClear.style.display = 'flex';
            }
        }
        if (mainSearchInput) {
            mainSearchInput.value = searchValue;
            if (mainSearchClear) {
                mainSearchClear.style.display = 'flex';
            }
        }
    }

    // Apply status filter if present
    if (statusParam && (statusParam === 'sale' || statusParam === 'rent' || statusParam === 'all')) {
        const transactionTypeSelect = document.getElementById('searchTransactionType');
        if (transactionTypeSelect) {
            transactionTypeSelect.value = statusParam;
            currentFilter = statusParam;
        }
    }

    if (conditionParam && (conditionParam === 'new' || conditionParam === 'resale')) {
        const propertyConditionSelect = document.getElementById('searchPropertyCondition');
        if (propertyConditionSelect) {
            propertyConditionSelect.value = conditionParam;
            selectedCondition = conditionParam;
        }
    }

    if (typeof bhkParam === 'string' && bhkParam.trim() !== '') {
        const parsedBhk = parseInt(bhkParam, 10);
        if (!isNaN(parsedBhk)) {
            selectedBHK = parsedBhk;
        }
    }

    // Apply direction filter if present
    if (directionParam) {
        const directionSelect = document.getElementById('searchDirection') || document.getElementById('searchDirections');
        if (directionSelect && directionSelect.options) {
            const val = directionParam.toLowerCase();
            for (let i = 0; i < directionSelect.options.length; i++) {
                if (directionSelect.options[i].value === val) {
                    directionSelect.value = val;
                    break;
                }
            }
        }
    }

    if (amenitiesParam) {
        const amenitiesSelect = document.getElementById('searchAmenities');
        if (amenitiesSelect) {
            amenitiesSelect.value = amenitiesParam;
        }
    }

    if (priceParam) {
        const priceInput = document.getElementById('searchPrice');
        if (priceInput) {
            priceInput.value = priceParam;
        }

        const priceRangeDisplay = document.getElementById('priceRangeDisplay');
        if (priceRangeDisplay) {
            const [min, max] = String(priceParam).split('-').map(v => v === '' ? null : parseInt(v, 10));
            const formatNumber = (num) => {
                if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
                if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
                return `₹${num.toLocaleString('en-IN')}`;
            };
            if (min === null && max === null) {
                priceRangeDisplay.textContent = 'Any Price';
            } else if (min !== null && max !== null) {
                priceRangeDisplay.textContent = `${formatNumber(min)} - ${formatNumber(max)}`;
            } else if (min !== null && max === null) {
                priceRangeDisplay.textContent = `${formatNumber(min)}+`;
            } else {
                priceRangeDisplay.textContent = `Up to ${formatNumber(max)}`;
            }
        }
    }

    if (lengthParam) {
        const lengthInput = document.getElementById('searchLength');
        if (lengthInput) lengthInput.value = lengthParam;
    }

    if (breadthParam) {
        const breadthInput = document.getElementById('searchBreadth');
        if (breadthInput) breadthInput.value = breadthParam;
    }

    if (carpetAreaParam) {
        const carpetAreaInput = document.getElementById('searchCarpetArea');
        if (carpetAreaInput) carpetAreaInput.value = carpetAreaParam;
    }

    if (plotAreaParam) {
        const plotAreaInput = document.getElementById('searchPlotArea');
        if (plotAreaInput) plotAreaInput.value = plotAreaParam;
    }

    if (villaTypeParam) {
        const villaTypeInput = document.getElementById('searchVillaType');
        if (villaTypeInput) villaTypeInput.value = villaTypeParam;
    }

    if (warehouseTypeParam) {
        const warehouseTypeInput = document.getElementById('searchWarehouseType');
        if (warehouseTypeInput) warehouseTypeInput.value = warehouseTypeParam;
    }

    if (superBuildupParam) {
        const superBuildupInput = document.getElementById('searchSuperBuildupArea');
        if (superBuildupInput) superBuildupInput.value = superBuildupParam;
    }

    const propertyTypeToCategory = {
        'plots': 'residential',
        'apartment': 'residential',
        'house': 'residential',
        'villa': 'residential',
        'row-house': 'residential',
        'office-space': 'commercial',
        'warehouse': 'commercial',
        'showrooms': 'commercial'
    };

    if (typeParam) {
        selectedPropertyType = typeParam;
        selectedCategory = propertyTypeToCategory[typeParam] || selectedCategory;

        if (selectedCategory && categorySection) {
            categorySection.setAttribute('data-active-category', selectedCategory);
        }

        document.querySelectorAll('.subcategory-button[data-property-type]').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.category-text-button[data-category]').forEach(btn => btn.classList.remove('active'));

        const typeBtn = document.querySelector(`.subcategory-button[data-property-type="${typeParam}"]`);
        if (typeBtn) typeBtn.classList.add('active');

        if (selectedCategory) {
            const categoryBtn = document.querySelector(`.category-text-button[data-category="${selectedCategory}"]`);
            if (categoryBtn) categoryBtn.classList.add('active');
        }
    } else if (categoryParam && (categoryParam === 'residential' || categoryParam === 'commercial')) {
        selectedCategory = categoryParam;
        selectedPropertyType = null;
        if (categorySection) categorySection.setAttribute('data-active-category', categoryParam);

        document.querySelectorAll('.subcategory-button[data-property-type]').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.category-text-button[data-category]').forEach(btn => btn.classList.remove('active'));

        const categoryBtn = document.querySelector(`.category-text-button[data-category="${categoryParam}"]`);
        if (categoryBtn) categoryBtn.classList.add('active');
        
        // Explicitly hide filter-group-sidebar and filter-additional-sidebar when only category is selected (not subcategory)
        const container = document.getElementById('propertiesPropertiesFilters');
        if (container) {
            const groupSidebar = container.querySelector('.filter-group-sidebar');
            if (groupSidebar) {
                groupSidebar.style.display = 'none';
            }
            const additionalSidebar = container.querySelector('.filter-additional-sidebar');
            if (additionalSidebar) {
                additionalSidebar.style.display = 'none';
            }
        }
    }

    updateFilterGroupsByPropertyType();

    // Apply filters (required so category gate runs: no properties until Residential/Commercial is selected, unless URL has category/type)
    applyFilters();
    updateFilterGroupsByPropertyType();
    if (typeParam || categoryParam || statusParam || searchParam || directionParam || amenitiesParam || priceParam || conditionParam || bhkParam || lengthParam || breadthParam || carpetAreaParam || plotAreaParam || villaTypeParam || warehouseTypeParam || superBuildupParam || urlParams.get('city') || urlParams.get('area')) {
        setTimeout(() => {
            const propertiesSection = document.querySelector('.properties-section');
            if (propertiesSection) {
                propertiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
});

// Render Properties
function renderProperties(propertiesToRender = filteredProperties.slice(0, displayedProperties)) {
    const grid = document.getElementById('propertiesGrid');
    if (!grid) return;

    if (propertiesToRender.length === 0) {
        const noCategory = !selectedCategory && !selectedPropertyType;
        grid.innerHTML = noCategory
            ? `
            <div class="no-properties no-properties-select-category">
                <i class="fas fa-filter"></i>
                <h3>Select a category to view properties</h3>
                <p>Choose <strong>Residential</strong> or <strong>Commercial</strong> above to see properties.</p>
            </div>
            `
            : `
            <div class="no-properties">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Best Properties Being Selected</h3>
                <p>Best of the properties are being selected for you, please wait...</p>
            </div>
            `;
        return;
    }

    grid.innerHTML = propertiesToRender.map(property => {
        // Escape all user-generated content for security
        const title = escapeHtml(property.title || 'Untitled Property');
        const location = escapeHtml(property.location || 'Location not specified');
        // Use dynamic image from database, or placeholder if no image available
        const imageUrl = property.image ? escapeHtml(property.image) : '';
        const imagePlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23ddd\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'18\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image Available%3C/text%3E%3C/svg%3E';
        const finalImageUrl = imageUrl || imagePlaceholder;
        const propertyType = escapeHtml(property.type || 'apartment');
        const propertyStatus = escapeHtml(property.status || 'sale');
        const bedrooms = property.bedrooms || 0;
        const bathrooms = property.bathrooms || 0;
        const area = property.area || 0;
        const propertyId = property.id || 0;
        // Category required for property-details page (API uses category + id). Use category (display format) or property_category (raw API).
        const rawCategory = (property.category ?? property.property_category ?? property.project_category ?? 'residential').toLowerCase();
        const apiCategory = ['commercial', 'residential', 'plot'].includes(rawCategory) ? rawCategory : 'residential';
        const priceDisplay = getPriceForDisplay(property);
        const priceHtml = priceDisplay.value != null
            ? `₹ <span class="price-value">${priceDisplay.value}</span> <span class="price-unit">${priceDisplay.unit}</span>`
            : 'Price on request';

        // Get status badge text and class from database status field
        let badgeText = '';
        let badgeClass = '';
        const status = String(propertyStatus).toLowerCase();
        
        if (status === 'new') {
            badgeText = 'New';
            badgeClass = 'new';
        } else if (status === 'sell' || status === 'sale') {
            badgeText = 'For Sale';
            badgeClass = 'sale';
        } else if (status === 'resale') {
            badgeText = 'Resale';
            badgeClass = 'resale';
        } else if (status === 'rent') {
            badgeText = 'For Rent';
            badgeClass = 'rent';
        } else {
            // Default fallback
            badgeText = 'For Sale';
            badgeClass = 'sale';
        }

        return `
        <div class="property-card" data-type="${propertyType}" data-status="${propertyStatus}" data-id="${propertyId}" data-property-id="${propertyId}">
            <div class="property-image">
                <img src="${finalImageUrl}" alt="${title}" loading="lazy" onerror="this.src='${imagePlaceholder}'">
                <div class="property-badge ${badgeClass}">${escapeHtml(badgeText)}</div>
                <div class="property-actions">
                    <button class="property-action-btn" title="Share" aria-label="Share property" data-property-id="${propertyId}" data-property-category="${escapeHtml(apiCategory)}">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
            <div class="property-content">
                <h3 class="property-title">${title}</h3>
                <div class="property-price">${priceHtml}</div>
                <div class="property-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${location}</span>
                </div>
                <div class="property-footer">
                    <a href="/property-details.html?id=${propertyId}&category=${encodeURIComponent(apiCategory)}" class="btn-view-details" target="_blank">View Details</a>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Add share functionality - copy property link to clipboard
    grid.querySelectorAll('.property-action-btn').forEach(btn => {
        if (btn.querySelector('.fa-share-alt')) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const propertyId = btn.getAttribute('data-property-id');
                const category = btn.getAttribute('data-property-category') || 'residential';
                if (!propertyId) return;

                // Create the property URL (category required for API)
                const propertyUrl = `${window.location.origin}/property-details.html?id=${propertyId}&category=${encodeURIComponent(category)}`;

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

                    // Optional: Show a toast notification
                    showToastNotification('Property link copied to clipboard!');
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

                        showToastNotification('Property link copied to clipboard!');
                    } catch (fallbackErr) {
                        console.error('Fallback copy failed:', fallbackErr);
                        alert('Failed to copy link. Please copy manually: ' + propertyUrl);
                    }
                }
            });
        }
    });
}

// Show toast notification
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

// Load active cities and populate dropdown
async function loadActiveCities() {
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
            console.log('Cities API response:', data);
            // Try both ID mappings (old and new)
            const citySelect = document.getElementById('propertiesSearchCity') || document.getElementById('searchCity');
            if (!citySelect) {
                console.error('City select element not found: propertiesSearchCity or searchCity');
                return;
            }
            if (!data.cities) {
                console.error('Cities data not found in response:', data);
                return;
            }
            if (Array.isArray(data.cities)) {
                // Store current selection before clearing
                const currentValue = citySelect.value;

                // Clear existing options except the first "Any City" option
                citySelect.innerHTML = '<option value="">Any City</option>';

                // If no active cities, show message
                if (data.cities.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No active cities available';
                    option.disabled = true;
                    citySelect.appendChild(option);
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
                        citySelect.appendChild(option);
                    });
                });

                // Restore selected value from URL params if present, otherwise restore previous selection
                const urlParams = new URLSearchParams(window.location.search);
                const cityParam = urlParams.get('city');
                if (cityParam && citySelect.querySelector(`option[value="${cityParam}"]`)) {
                    citySelect.value = cityParam;
                    const cityName = cityParam.includes(',') ? cityParam.split(',')[0].trim() : cityParam.trim();
                    if (cityName) {
                        await loadLocalitiesForCity(cityName);
                    }
                    applyFilters();
                } else if (currentValue && citySelect.querySelector(`option[value="${currentValue}"]`)) {
                    citySelect.value = currentValue;
                }
            }
        } else {
            console.error('Failed to load cities:', response.status, response.statusText);
            const citySelect = document.getElementById('propertiesSearchCity') || document.getElementById('searchCity');
            if (citySelect) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading cities';
                option.disabled = true;
                citySelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading cities:', error);
        const citySelect = document.getElementById('propertiesSearchCity') || document.getElementById('searchCity');
        if (citySelect) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading cities';
            option.disabled = true;
            citySelect.appendChild(option);
        }
    }
}

// Load localities/areas for a selected city
async function loadLocalitiesForCity(cityName) {
    try {
        if (!cityName || cityName.trim() === '') {
            // Clear area dropdown if no city is selected
            const areaSelect = document.getElementById('propertiesSearchArea') || document.getElementById('searchArea');
            if (areaSelect) {
                areaSelect.innerHTML = '<option value="">Any Area</option>';
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
            const areaSelect = document.getElementById('propertiesSearchArea') || document.getElementById('searchArea');
            if (!areaSelect) {
                console.error('Area select element not found: propertiesSearchArea or searchArea');
                return;
            }

            // Store current selection before clearing
            const currentValue = areaSelect.value;

            // Clear existing options except the first "Any Area" option
            areaSelect.innerHTML = '<option value="">Any Area</option>';

            if (data.localities && Array.isArray(data.localities)) {
                console.log('Processing localities array:', data.localities);
                // If no localities found, show message
                if (data.localities.length === 0) {
                    console.warn('No localities found for city:', cityName);
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No areas available for this city';
                    option.disabled = true;
                    areaSelect.appendChild(option);
                    return;
                }

                // Sort localities alphabetically
                const sortedLocalities = [...data.localities].sort();
                console.log('Sorted localities:', sortedLocalities);

                // Add localities to select dropdown
                let addedCount = 0;
                sortedLocalities.forEach(locality => {
                    if (locality && locality.trim()) {
                        const option = document.createElement('option');
                        option.value = locality.trim();
                        option.textContent = locality.trim();
                        areaSelect.appendChild(option);
                        addedCount++;
                    }
                });
                console.log(`Added ${addedCount} localities to dropdown`);

                // Restore previous selection if it still exists
                const urlParams = new URLSearchParams(window.location.search);
                const areaParam = urlParams.get('area');
                if (areaParam && areaSelect.querySelector(`option[value="${areaParam}"]`)) {
                    areaSelect.value = areaParam;
                } else if (currentValue && areaSelect.querySelector(`option[value="${currentValue}"]`)) {
                    areaSelect.value = currentValue;
                }

                applyFilters();
            }
        } else {
            console.error('Failed to load localities:', response.status, response.statusText);
            const areaSelect = document.getElementById('propertiesSearchArea') || document.getElementById('searchArea');
            if (areaSelect) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading areas';
                option.disabled = true;
                areaSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading localities:', error);
        const areaSelect = document.getElementById('propertiesSearchArea') || document.getElementById('searchArea');
        if (areaSelect) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading areas';
            option.disabled = true;
            areaSelect.appendChild(option);
        }
    }
}

// Load amenities and populate datalist
async function loadAmenities() {
    try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/amenities?_t=${timestamp}`, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Amenities API response:', data);
            const amenitiesSelect = document.getElementById('propertiesSearchAmenities') || document.getElementById('searchAmenities');
            if (!amenitiesSelect) {
                console.error('Amenities select element not found: propertiesSearchAmenities or searchAmenities');
                return;
            }
            if (!data.amenities) {
                console.error('Amenities data not found in response:', data);
                return;
            }
            if (Array.isArray(data.amenities)) {
                // Store current value before clearing
                const currentValue = amenitiesSelect.value;

                // Clear existing options except the first "Any Amenity" option
                amenitiesSelect.innerHTML = '<option value="">Any Amenity</option>';

                // Remove duplicates and sort amenities
                const uniqueAmenities = [...new Set(data.amenities.map(a => a && a.trim()).filter(Boolean))];
                uniqueAmenities.sort();

                // Add amenities to select dropdown
                if (uniqueAmenities.length > 0) {
                    uniqueAmenities.forEach(amenity => {
                        const option = document.createElement('option');
                        option.value = amenity;
                        // Format amenity name for display (replace underscores with spaces, capitalize)
                        const displayName = amenity
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                        option.textContent = displayName;
                        amenitiesSelect.appendChild(option);
                    });
                }

                // Restore selected value from URL params if present, otherwise restore previous selection
                const urlParams = new URLSearchParams(window.location.search);
                const amenitiesParam = urlParams.get('amenities');
                if (amenitiesParam) {
                    amenitiesSelect.value = amenitiesParam;
                    applyFilters();
                } else if (currentValue) {
                    amenitiesSelect.value = currentValue;
                }
            }
        } else {
            console.error('Failed to load amenities:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error loading amenities:', error);
    }
}

// Load unit types and populate dropdown
async function loadUnitTypes() {
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
            console.log('Unit Types API response:', data);
            // Try both ID mappings (old and new)
            const unitTypeSelect = document.getElementById('propertiesSearchUnitType') || document.getElementById('searchUnitType');
            if (!unitTypeSelect) {
                console.error('Unit Type select element not found: propertiesSearchUnitType or searchUnitType');
                return;
            }
            if (!data.unit_types) {
                console.error('Unit types data not found in response:', data);
                return;
            }
            if (Array.isArray(data.unit_types)) {
                // Store current selection before clearing
                const currentValue = unitTypeSelect.value;

                // Clear existing options except the first "Any Unit Type" option
                unitTypeSelect.innerHTML = '<option value="">Any Unit Type</option>';

                // If no unit types, show message
                if (data.unit_types.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No unit types available';
                    option.disabled = true;
                    unitTypeSelect.appendChild(option);
                    return;
                }

                // Add unit types sorted by bedrooms, then name
                data.unit_types.forEach(unitType => {
                    if (unitType && unitType.name && unitType.display_name) {
                        const option = document.createElement('option');
                        option.value = unitType.name;
                        option.textContent = unitType.display_name;
                        // Preserve data-bhk attribute for compatibility with existing code
                        if (unitType.bedrooms !== null && unitType.bedrooms !== undefined) {
                            option.setAttribute('data-bhk', unitType.bedrooms.toString());
                        }
                        unitTypeSelect.appendChild(option);
                    }
                });

                // Restore selected value from URL params if present, otherwise restore previous selection
                const urlParams = new URLSearchParams(window.location.search);
                const unitTypeParam = urlParams.get('unit_type');
                const bhkParam = urlParams.get('bhk');
                if (unitTypeParam && unitTypeSelect.querySelector(`option[value="${unitTypeParam}"]`)) {
                    unitTypeSelect.value = unitTypeParam;
                    const opt = unitTypeSelect.options[unitTypeSelect.selectedIndex];
                    const bhk = opt && opt.dataset ? parseInt(opt.dataset.bhk) : NaN;
                    if (!isNaN(bhk)) selectedBHK = bhk;
                    applyFilters();
                } else if (typeof bhkParam === 'string' && bhkParam.trim() !== '') {
                    const parsedBhk = parseInt(bhkParam, 10);
                    if (!isNaN(parsedBhk)) {
                        const matchOpt = Array.from(unitTypeSelect.options).find(o => parseInt(o.dataset.bhk, 10) === parsedBhk);
                        if (matchOpt) {
                            unitTypeSelect.value = matchOpt.value;
                            selectedBHK = parsedBhk;
                            applyFilters();
                        }
                    }
                } else if (currentValue && unitTypeSelect.querySelector(`option[value="${currentValue}"]`)) {
                    unitTypeSelect.value = currentValue;
                }
            }
        } else {
            console.error('Failed to load unit types:', response.status, response.statusText);
            const unitTypeSelect = document.getElementById('propertiesSearchUnitType') || document.getElementById('searchUnitType');
            if (unitTypeSelect) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading unit types';
                option.disabled = true;
                unitTypeSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading unit types:', error);
        const unitTypeSelect = document.getElementById('propertiesSearchUnitType') || document.getElementById('searchUnitType');
        if (unitTypeSelect) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading unit types';
            option.disabled = true;
            unitTypeSelect.appendChild(option);
        }
    }
}

// Update filter input visibility by selected category/subcategory (per dashboard add-property modal)
function updateFilterGroupsByPropertyType() {
    const container = document.getElementById('propertiesPropertiesFilters');
    if (!container) return;

    const hasCategoryOrType = selectedCategory || selectedPropertyType;
    if (hasCategoryOrType) {
        container.classList.add('filters-active');
    } else {
        container.classList.remove('filters-active');
    }

    const propertyType = typeof selectedPropertyType === 'string' ? selectedPropertyType : null;
    const residentialTypes = ['apartment', 'house', 'villa', 'plots'];
    // CRITICAL FIX: Use 'office_space' (underscore) to match backend/database format
    const commercialTypes = ['office_space', 'office-space', 'warehouse', 'showrooms'];
    const typesInCategory = selectedCategory === 'residential' ? residentialTypes : (selectedCategory === 'commercial' ? commercialTypes : []);

    container.querySelectorAll('.filter-group[data-filter-for]').forEach(el => {
        const forStr = (el.getAttribute('data-filter-for') || '').trim();
        const types = forStr.split(/\s+/);
        let show = false;

        if (types.includes('common')) {
            show = true;
        } else if (propertyType) {
            if (types.includes(propertyType)) show = true;
            else if (types.includes('residential') && residentialTypes.includes(propertyType)) show = true;
            else if (types.includes('commercial') && commercialTypes.includes(propertyType)) show = true;
        } else if (selectedCategory && typesInCategory.length > 0) {
            show = types.some(t => typesInCategory.includes(t));
        }

        el.style.display = show ? '' : 'none';
    });

    const additionalSidebar = container.querySelector('.filter-additional-sidebar');
    if (additionalSidebar) {
        // Only show filter-additional-sidebar when a subcategory (property type) is selected, not on category-only click
        const shouldShowAdditional = selectedPropertyType && typeof selectedPropertyType === 'string' && selectedPropertyType.trim() !== '';
        if (shouldShowAdditional) {
            const visibleAdditional = additionalSidebar.querySelectorAll('.filter-group').length > 0 &&
                Array.from(additionalSidebar.querySelectorAll('.filter-group')).some(child => child.style.display !== 'none');
            additionalSidebar.style.display = visibleAdditional ? 'flex' : 'none';
        } else {
            additionalSidebar.style.display = 'none';
        }
    }

    const groupSidebar = container.querySelector('.filter-group-sidebar');
    if (groupSidebar) {
        // Only show filter-group-sidebar when a subcategory (property type) is selected, not on category-only click
        // Explicitly check that selectedPropertyType is truthy and not just selectedCategory
        const shouldShowSidebar = selectedPropertyType && typeof selectedPropertyType === 'string' && selectedPropertyType.trim() !== '';
        groupSidebar.style.display = shouldShowSidebar ? 'flex' : 'none';
    }
}

// Load categories and populate dropdown
// Initialize Filters
function initFilters() {
    // Wait for DOM to be ready, then load cities, amenities, and unit types
    setTimeout(() => {
        loadActiveCities().catch(err => console.error('Error loading cities:', err));
        loadAmenities().catch(err => console.error('Error loading amenities:', err));
        loadUnitTypes().catch(err => console.error('Error loading unit types:', err));
    }, 100);

    // City select change handler
    const citySelect = document.getElementById('propertiesSearchCity') || document.getElementById('searchCity');
    if (citySelect) {
        citySelect.addEventListener('change', async () => {
            // Load localities for the selected city
            const selectedCity = citySelect.value;
            // Extract city name if it's in format "City, State"
            const cityName = selectedCity.includes(',') ? selectedCity.split(',')[0].trim() : selectedCity.trim();
            console.log('City selected:', selectedCity, 'Extracted city name:', cityName);
            await loadLocalitiesForCity(cityName);
            applyFilters();
        });
    }

    // Amenities select change handler
    const amenitiesSelect = document.getElementById('propertiesSearchAmenities') || document.getElementById('searchAmenities');
    if (amenitiesSelect) {
        amenitiesSelect.addEventListener('change', () => {
            applyFilters();
        });
    }

    // Transaction Type select (Buy/Rent/All)
    const transactionTypeSelect = document.getElementById('searchTransactionType');
    if (transactionTypeSelect) {
        transactionTypeSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value === 'all' ? 'all' : e.target.value;
            applyFilters();
        });
    }

    // Status select (New/Resale)
    const propertyConditionSelect = document.getElementById('searchPropertyCondition');
    if (propertyConditionSelect) {
        propertyConditionSelect.addEventListener('change', (e) => {
            selectedCondition = e.target.value || null;
            applyFilters();
        });
    }

    // Unit Type select (BHK/RK)
    const unitTypeSelect = document.getElementById('searchUnitType');
    if (unitTypeSelect) {
        unitTypeSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption.value === '') {
                selectedBHK = null;
            } else {
                const bhk = parseInt(selectedOption.dataset.bhk);
                selectedBHK = bhk;
            }
            applyFilters();
        });
    }

    // Category buttons (show subcategories and filter by category)
    const categoryButtons = document.querySelectorAll('.category-text-button[data-category]');
    const categorySection = document.querySelector('.category-section-centered');

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const category = btn.dataset.category;

            if (!categorySection) return;

            const currentActiveCategory = categorySection.getAttribute('data-active-category');

            // Toggle subcategories visibility
            if (currentActiveCategory === category) {
                // Hide subcategories if clicking the same category
                categorySection.removeAttribute('data-active-category');
                btn.classList.remove('active');
                selectedCategory = null;
                // Clear all subcategory buttons
                const allSubButtons = document.querySelectorAll('.subcategory-button');
                allSubButtons.forEach(b => b.classList.remove('active'));
            } else {
                // Show subcategories for selected category
                categorySection.setAttribute('data-active-category', category);

                // Update active state
                categoryButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Clear property type selection when switching categories
                const allSubButtons = document.querySelectorAll('.subcategory-button');
                allSubButtons.forEach(b => b.classList.remove('active'));

                selectedCategory = category;
                selectedPropertyType = null; // Clear specific property type when selecting category
            }
            
            // Explicitly hide filter-group-sidebar and filter-additional-sidebar when only category is selected (not subcategory)
            const container = document.getElementById('propertiesPropertiesFilters');
            if (container) {
                const groupSidebar = container.querySelector('.filter-group-sidebar');
                if (groupSidebar) {
                    groupSidebar.style.display = 'none';
                }
                const additionalSidebar = container.querySelector('.filter-additional-sidebar');
                if (additionalSidebar) {
                    additionalSidebar.style.display = 'none';
                }
            }
            
            updateFilterGroupsByPropertyType();
            applyFilters();
        });
    });

    // Property Type subcategory buttons
    const propertyTypeButtons = document.querySelectorAll('.subcategory-button[data-property-type]');
    propertyTypeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const propType = btn.dataset.propertyType;
            const parentCategory = btn.dataset.parentCategory;

            if (selectedPropertyType === propType && selectedCategory === parentCategory) {
                // Toggle off if already selected
                selectedPropertyType = null;
                selectedCategory = null;
                btn.classList.remove('active');
                // Also remove active from parent category button
                const categoryBtn = document.querySelector(`.category-text-button[data-category="${parentCategory}"]`);
                if (categoryBtn) categoryBtn.classList.remove('active');
                if (categorySection) categorySection.removeAttribute('data-active-category');
            } else {
                // Deselect all other property types and categories
                propertyTypeButtons.forEach(b => b.classList.remove('active'));
                categoryButtons.forEach(b => b.classList.remove('active'));

                // Select new property type and category
                selectedPropertyType = propType;
                selectedCategory = parentCategory;
                btn.classList.add('active');

                // Also activate parent category button and show subcategories
                const categoryBtn = document.querySelector(`.category-text-button[data-category="${parentCategory}"]`);
                if (categoryBtn) categoryBtn.classList.add('active');
                if (categorySection) categorySection.setAttribute('data-active-category', parentCategory);
            }
            updateFilterGroupsByPropertyType();
            applyFilters();
        });
    });

    // Also handle category button clicks to filter by category only (without specific property type)
    categoryButtons.forEach(btn => {
        // Add a separate handler for filtering (not just expand/collapse)
        // We'll use a double-click or add a separate filter action
        // For now, clicking category button only expands/collapses
        // Users should click subcategories to filter
    });

    // Initialize Price Range Dropdown
    initPriceRange();
    updateFilterGroupsByPropertyType();
}

// Initialize Price Range Dropdown
function initPriceRange() {
    const priceRangeBtn = document.getElementById('priceRangeBtn');
    const priceRangeDropdown = document.getElementById('priceRangeDropdown');
    const priceRangeDisplay = document.getElementById('priceRangeDisplay');
    const searchPriceInput = document.getElementById('searchPrice');
    const pricePresetBtns = document.querySelectorAll('.price-preset-btn');
    const priceMinInput = document.getElementById('priceMin');
    const priceMaxInput = document.getElementById('priceMax');
    const priceApplyBtn = document.getElementById('priceApplyBtn');

    if (!priceRangeBtn || !priceRangeDropdown) return;

    // Format price for display
    function formatPriceDisplay(value) {
        if (!value || value === '') return 'Any Price';

        const [min, max] = value.split('-').map(v => v === '' ? null : parseInt(v));

        if (min === null && max === null) return 'Any Price';

        // Format numbers with Indian locale
        function formatNumber(num) {
            if (num >= 10000000) {
                return `₹${(num / 10000000).toFixed(1)}Cr`;
            } else if (num >= 100000) {
                return `₹${(num / 100000).toFixed(1)}L`;
            } else {
                return `₹${num.toLocaleString('en-IN')}`;
            }
        }

        if (min !== null && max !== null) {
            return `${formatNumber(min)} - ${formatNumber(max)}`;
        } else if (min !== null && max === null) {
            return `${formatNumber(min)}+`;
        } else {
            return `Up to ${formatNumber(max)}`;
        }
    }

    // Toggle dropdown
    priceRangeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = priceRangeDropdown.classList.contains('active');

        if (isActive) {
            priceRangeDropdown.classList.remove('active');
            priceRangeBtn.classList.remove('active');
        } else {
            priceRangeDropdown.classList.add('active');
            priceRangeBtn.classList.add('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!priceRangeBtn.contains(e.target) && !priceRangeDropdown.contains(e.target)) {
            priceRangeDropdown.classList.remove('active');
            priceRangeBtn.classList.remove('active');
        }
    });

    // Handle preset button clicks
    pricePresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value || '';

            // Update active state
            pricePresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update hidden input and display
            searchPriceInput.value = value;
            priceRangeDisplay.textContent = formatPriceDisplay(value);

            // Clear custom inputs
            if (priceMinInput) priceMinInput.value = '';
            if (priceMaxInput) priceMaxInput.value = '';

            // Close dropdown
            priceRangeDropdown.classList.remove('active');
            priceRangeBtn.classList.remove('active');

            // Apply filters
            applyFilters();
        });
    });

    // Handle custom price input
    if (priceApplyBtn) {
        priceApplyBtn.addEventListener('click', () => {
            const min = priceMinInput?.value ? parseInt(priceMinInput.value) : null;
            const max = priceMaxInput?.value ? parseInt(priceMaxInput.value) : null;

            // Validate
            if (min !== null && max !== null && min > max) {
                alert('Minimum price cannot be greater than maximum price');
                return;
            }

            // Build value string
            let value = '';
            if (min !== null && max !== null) {
                value = `${min}-${max}`;
            } else if (min !== null) {
                value = `${min}-`;
            } else if (max !== null) {
                value = `0-${max}`;
            }

            // Update hidden input and display
            searchPriceInput.value = value;
            priceRangeDisplay.textContent = formatPriceDisplay(value);

            // Update active state
            pricePresetBtns.forEach(b => b.classList.remove('active'));

            // Close dropdown
            priceRangeDropdown.classList.remove('active');
            priceRangeBtn.classList.remove('active');

            // Apply filters
            applyFilters();
        });
    }

    // Update display on page load if value exists
    if (searchPriceInput && searchPriceInput.value) {
        priceRangeDisplay.textContent = formatPriceDisplay(searchPriceInput.value);

        // Set active preset if it matches
        pricePresetBtns.forEach(btn => {
            if (btn.dataset.value === searchPriceInput.value) {
                btn.classList.add('active');
            }
        });
    }
}

// Apply Filters
function applyFilters() {
    let filtered = [...allProperties];

    // Category / Property Type: show properties only when a category (Residential or Commercial) or a specific property type is selected
    const propertyTypeToCategory = {
        'plots': 'residential',
        'plot': 'residential',
        'apartment': 'residential',
        'house': 'residential',
        'villa': 'residential',
        'row-house': 'residential',
        'office-space': 'commercial',
        'office_space': 'commercial',
        'warehouse': 'commercial',
        'showrooms': 'commercial'
    };
    const residentialTypes = ['plots', 'plot', 'apartment', 'house', 'villa', 'row-house'];
    const commercialTypes = ['office-space', 'office_space', 'warehouse', 'showrooms'];

    if (!selectedCategory && !selectedPropertyType) {
        // No category selected: show no properties (user must select Residential or Commercial first)
        filtered = [];
    }

    // Buy/Rent filter (status)
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.status === currentFilter);
    }

    // New/Resale filter (condition)
    if (selectedCondition) {
        // Note: This assumes properties have a 'condition' or 'property_status' field
        // For now, we'll check if property has these fields, otherwise skip this filter
        filtered = filtered.filter(p => {
            if (p.condition !== undefined) {
                return p.condition === selectedCondition;
            }
            if (p.property_status !== undefined) {
                return p.property_status.toLowerCase() === selectedCondition;
            }
            // If field doesn't exist, include property (no filter applied)
            return true;
        });
    }

    // Unit Type filter (BHK/RK)
    if (selectedBHK !== null) {
        const unitTypeSelect = document.getElementById('searchUnitType');
        const selectedOption = unitTypeSelect?.options[unitTypeSelect.selectedIndex];
        const unitType = selectedOption?.value;

        filtered = filtered.filter(p => {
            if (unitType === 'rk') {
                // 1RK: filter for 0 bedrooms or properties marked as RK
                return p.bedrooms === 0 || p.bedrooms === null || p.unit_type === 'rk';
            } else if (unitType === '4plus') {
                // 4+BHK: filter for 4 or more bedrooms
                return p.bedrooms >= 4;
            } else {
                // Regular BHK: exact match
                return p.bedrooms === selectedBHK;
            }
        });
    }

    // Category and Property Type filter
    const typeMapping = {
        'plots': 'plots',
        'apartment': 'apartment',
        'office-space': 'office-space',
        'warehouse': 'warehouse',
        'showrooms': 'showrooms',
        'house': 'house',
        'villa': 'villa',
        'row-house': 'row-house'
    };

    // Normalize API type (API may return 'plot', 'office_space')
    function normalizeType(t) {
        if (t == null || t === '') return '';
        const s = String(t).toLowerCase().trim().replace(/_/g, '-');
        return s === 'plot' ? 'plots' : s;
    }

    // If property type (subcategory) is selected, filter to that type only
    if (selectedPropertyType) {
        if (!selectedCategory && propertyTypeToCategory[selectedPropertyType]) {
            selectedCategory = propertyTypeToCategory[selectedPropertyType];
        }
        const selNorm = normalizeType(selectedPropertyType);
        const mappedType = typeMapping[selectedPropertyType];

        filtered = filtered.filter(p => {
            const pType = p.property_type ?? p.type;
            const pNorm = normalizeType(pType);
            if (pNorm === selNorm) return true;
            if (mappedType === 'house' && (p.type === 'house' || pNorm === 'house')) return true;
            if (mappedType === 'villa' && (p.type === 'villa' || pNorm === 'villa')) return true;
            if ((mappedType === 'apartment' || selectedPropertyType === 'apartment') && (p.type === 'apartment' || p.type === 'apartments' || pNorm === 'apartment')) return true;
            return false;
        });
    }

    // If only category (Residential or Commercial) is selected, show all properties of that category
    if (selectedCategory && !selectedPropertyType) {
        const categoryPropertyTypes = {
            'residential': ['plots', 'plot', 'apartment', 'house', 'villa', 'row-house'],
            'commercial': ['office-space', 'office_space', 'warehouse', 'showrooms']
        };
        const typesForCategory = categoryPropertyTypes[selectedCategory] || [];

        filtered = filtered.filter(p => {
            if (p.category !== undefined) {
                return p.category.toLowerCase() === selectedCategory;
            }
            const pType = (p.property_type ?? p.type);
            if (pType == null) return false;
            const normalized = String(pType).toLowerCase().trim().replace(/_/g, '-');
            const asPlot = normalized === 'plot' ? 'plots' : normalized;
            if (typesForCategory.includes(pType)) return true;
            if (typesForCategory.includes(normalized)) return true;
            if (typesForCategory.includes(asPlot)) return true;
            if ((normalized === 'apartment' || normalized === 'apartments') && typesForCategory.includes('apartment')) return true;
            return typesForCategory.some(t => asPlot.includes(t.replace(/-/g, '')) || (t === 'plot' && normalized === 'plot'));
        });
    }

    // Main search bar filter (check both main search and nav search)
    const mainSearchInput = document.getElementById('mainSearchInput')?.value.toLowerCase().trim() || '';
    const navSearchInput = document.getElementById('navSearchInput')?.value.toLowerCase().trim() || '';
    const mainSearch = mainSearchInput || navSearchInput;
    if (mainSearch) {
        filtered = filtered.filter(p =>
            (p.title && p.title.toLowerCase().includes(mainSearch)) ||
            (p.location && p.location.toLowerCase().includes(mainSearch)) ||
            (p.type && p.type.toLowerCase().includes(mainSearch)) ||
            (p.status && p.status.toLowerCase().includes(mainSearch))
        );
    }

    // City filter
    const city = document.getElementById('propertiesSearchCity')?.value.toLowerCase().trim() || '';
    if (city) {
        filtered = filtered.filter(p =>
            (p.location && p.location.toLowerCase().includes(city)) ||
            (p.title && p.title.toLowerCase().includes(city))
        );
    }

    // Area filter
    const area = document.getElementById('propertiesSearchArea')?.value.toLowerCase().trim() || '';
    if (area) {
        filtered = filtered.filter(p =>
            (p.location && p.location.toLowerCase().includes(area)) ||
            (p.title && p.title.toLowerCase().includes(area))
        );
    }

    // Price filter
    const price = document.getElementById('propertiesSearchPrice')?.value || '';
    if (price) {
        const [min, max] = price.split('-').map(v => v === '' ? Infinity : parseInt(v));
        filtered = filtered.filter(p => {
            if (max === Infinity) {
                return p.price >= min;
            }
            return p.price >= min && p.price <= max;
        });
    }

    // Length filter
    const length = document.getElementById('propertiesSearchLength')?.value.toLowerCase().trim() || '';
    if (length) {
        filtered = filtered.filter(p => {
            if (p.length !== undefined) {
                return p.length.toString().toLowerCase().includes(length);
            }
            return p.dimensions && p.dimensions.toLowerCase().includes(length);
        });
    }

    // Breadth filter
    const breadth = document.getElementById('propertiesSearchBreadth')?.value.toLowerCase().trim() || '';
    if (breadth) {
        filtered = filtered.filter(p => {
            if (p.breadth !== undefined) {
                return p.breadth.toString().toLowerCase().includes(breadth);
            }
            return p.dimensions && p.dimensions.toLowerCase().includes(breadth);
        });
    }

    // Carpet Area filter
    const carpetArea = document.getElementById('propertiesSearchCarpetArea')?.value.toLowerCase().trim() || '';
    if (carpetArea) {
        filtered = filtered.filter(p => {
            return (p.carpet_area && p.carpet_area.toString().toLowerCase().includes(carpetArea)) ||
                (p.carpetArea && p.carpetArea.toString().toLowerCase().includes(carpetArea));
        });
    }

    // Direction filter
    const direction = document.getElementById('propertiesSearchDirection')?.value.toLowerCase().trim() || '';
    if (direction) {
        filtered = filtered.filter(p => {
            return (p.directions && p.directions.toLowerCase().includes(direction)) ||
                (p.direction && p.direction.toLowerCase().includes(direction));
        });
    }

    // Amenities filter
    const amenities = document.getElementById('propertiesSearchAmenities')?.value.toLowerCase().trim() || '';
    if (amenities) {
        filtered = filtered.filter(p => {
            if (p.amenities) {
                const propertyAmenities = Array.isArray(p.amenities)
                    ? p.amenities.join(' ').toLowerCase()
                    : p.amenities.toString().toLowerCase();
                return propertyAmenities.includes(amenities);
            }
            return false;
        });
    }

    // Villa Type filter (Step 2 - villa)
    const villaType = document.getElementById('propertiesSearchVillaType')?.value.trim() || '';
    if (villaType) {
        filtered = filtered.filter(p => {
            const pVilla = (p.villa_type || p.villaType || '').toLowerCase().replace(/-/g, '_');
            return pVilla === villaType.toLowerCase().replace(/-/g, '_');
        });
    }

    // Warehouse Type filter (Step 2 - warehouse)
    const warehouseType = document.getElementById('propertiesSearchWarehouseType')?.value.trim() || '';
    if (warehouseType) {
        filtered = filtered.filter(p => {
            const pWarehouse = (p.warehouse_type || p.warehouseType || '').toLowerCase().replace(/-/g, '_');
            return pWarehouse === warehouseType.toLowerCase().replace(/-/g, '_');
        });
    }

    // Plot Area filter (Step 2 - plots, villa, warehouse)
    const plotArea = document.getElementById('propertiesSearchPlotArea')?.value.trim() || '';
    if (plotArea) {
        const minPlot = parseFloat(plotArea);
        if (!isNaN(minPlot)) {
            filtered = filtered.filter(p => {
                const area = p.plot_area != null ? parseFloat(p.plot_area) : (p.plotArea != null ? parseFloat(p.plotArea) : null);
                return area != null && area >= minPlot;
            });
        }
    }

    // Super Builtup Area filter (Step 2 - apartment, office-space, showrooms, warehouse)
    const superBuildupArea = document.getElementById('propertiesSearchSuperBuildupArea')?.value.trim() || '';
    if (superBuildupArea) {
        const minSba = parseFloat(superBuildupArea);
        if (!isNaN(minSba)) {
            filtered = filtered.filter(p => {
                const sba = p.super_built_up_area != null ? parseFloat(p.super_built_up_area) : (p.superBuildupArea != null ? parseFloat(p.superBuildupArea) : null);
                return sba != null && sba >= minSba;
            });
        }
    }

    filteredProperties = filtered;
    displayedProperties = 8;
    renderProperties();
    updateFilterTags();
    updateLoadMoreButton();
}

// Update Filter Tags
function updateFilterTags() {
    const filterTagsContainer = document.getElementById('filterTagsContainer');
    const filterTags = document.getElementById('filterTags');

    if (!filterTagsContainer || !filterTags) return;

    // Only show filter tags when a subcategory (property type) is selected
    if (!selectedPropertyType || typeof selectedPropertyType !== 'string' || selectedPropertyType.trim() === '') {
        filterTagsContainer.style.display = 'none';
        filterTags.innerHTML = '';
        return;
    }

    const activeFilters = [];

    // Main search (check both main search and nav search)
    const mainSearchInput = document.getElementById('mainSearchInput')?.value.trim() || '';
    const navSearchInput = document.getElementById('navSearchInput')?.value.trim() || '';
    const mainSearch = mainSearchInput || navSearchInput;
    if (mainSearch) {
        activeFilters.push({
            type: 'mainSearch',
            label: `Search: "${mainSearch}"`,
            icon: 'fa-search',
            value: mainSearch
        });
    }

    // Condition filter (New/Resale)
    if (selectedCondition) {
        activeFilters.push({
            type: 'condition',
            label: selectedCondition === 'new' ? 'New' : 'Resale',
            icon: 'fa-certificate',
            value: selectedCondition
        });
    }

    // Status filter (Buy/Rent)
    if (currentFilter !== 'all') {
        activeFilters.push({
            type: 'status',
            label: currentFilter === 'sale' ? 'Buy' : 'Rent',
            icon: currentFilter === 'sale' ? 'fa-shopping-cart' : 'fa-key',
            value: currentFilter
        });
    }

    // Unit Type filter
    if (selectedBHK !== null) {
        const unitTypeSelect = document.getElementById('searchUnitType');
        const selectedOption = unitTypeSelect?.options[unitTypeSelect.selectedIndex];
        const unitType = selectedOption?.value;

        let unitTypeLabel = '';
        if (unitType === 'rk') {
            unitTypeLabel = '1RK';
        } else if (unitType === '4plus') {
            unitTypeLabel = '4+BHK';
        } else {
            unitTypeLabel = `${selectedBHK}BHK`;
        }

        activeFilters.push({
            type: 'bhk',
            label: `Unit Type: ${unitTypeLabel}`,
            icon: 'fa-bed',
            value: selectedBHK.toString()
        });
    }

    // Property type filter (shows both category and type if both are selected)
    if (selectedPropertyType) {
        const typeLabels = {
            'plots': 'Plots',
            'apartment': 'Apartments',
            'office-space': 'Office Space',
            'warehouse': 'Warehouse',
            'showrooms': 'Showrooms',
            'house': 'Individual House',
            'villa': 'Villas',
            'row-house': 'Row Houses'
        };
        const categoryLabel = selectedCategory === 'residential' ? 'Residential' :
            selectedCategory === 'commercial' ? 'Commercial' : '';
        const typeLabel = typeLabels[selectedPropertyType] || selectedPropertyType;

        activeFilters.push({
            type: 'propertyType',
            label: categoryLabel ? `${categoryLabel}: ${typeLabel}` : `Type: ${typeLabel}`,
            icon: 'fa-building',
            value: selectedPropertyType
        });
    }
    // Note: Category-only tags are not shown - tags only appear when a subcategory is selected

    // City filter
    const city = document.getElementById('searchCity')?.value.trim() || '';
    if (city) {
        activeFilters.push({
            type: 'city',
            label: `City: ${city}`,
            icon: 'fa-map-marker-alt',
            value: city
        });
    }

    // Area filter
    const area = document.getElementById('searchArea')?.value.trim() || '';
    if (area) {
        activeFilters.push({
            type: 'area',
            label: `Area: ${area}`,
            icon: 'fa-map-marker-alt',
            value: area
        });
    }

    // Price filter
    const price = document.getElementById('searchPrice')?.value || '';
    if (price) {
        // Format price for display
        function formatPriceLabel(value) {
            if (!value || value === '') return '';

            const [min, max] = value.split('-').map(v => v === '' ? null : parseInt(v));

            if (min === null && max === null) return '';

            function formatNumber(num) {
                if (num >= 10000000) {
                    return `₹${(num / 10000000).toFixed(1)}Cr`;
                } else if (num >= 100000) {
                    return `₹${(num / 100000).toFixed(1)}L`;
                } else {
                    return `₹${num.toLocaleString('en-IN')}`;
                }
            }

            if (min !== null && max !== null) {
                return `${formatNumber(min)} - ${formatNumber(max)}`;
            } else if (min !== null && max === null) {
                return `${formatNumber(min)}+`;
            } else {
                return `Up to ${formatNumber(max)}`;
            }
        }

        const priceLabel = formatPriceLabel(price);
        if (priceLabel) {
            activeFilters.push({
                type: 'price',
                label: `Price: ${priceLabel}`,
                icon: 'fa-rupee-sign',
                value: price
            });
        }
    }

    // Length filter
    const length = document.getElementById('searchLength')?.value.trim() || '';
    if (length) {
        activeFilters.push({
            type: 'length',
            label: `Length: ${length}`,
            icon: 'fa-ruler',
            value: length
        });
    }

    // Breadth filter
    const breadth = document.getElementById('searchBreadth')?.value.trim() || '';
    if (breadth) {
        activeFilters.push({
            type: 'breadth',
            label: `Breadth: ${breadth}`,
            icon: 'fa-ruler',
            value: breadth
        });
    }

    // Carpet Area filter
    const carpetArea = document.getElementById('searchCarpetArea')?.value.trim() || '';
    if (carpetArea) {
        activeFilters.push({
            type: 'carpetArea',
            label: `Carpet Area: ${carpetArea}`,
            icon: 'fa-vector-square',
            value: carpetArea
        });
    }

    // Villa Type filter
    const villaTypeTag = document.getElementById('propertiesSearchVillaType')?.value.trim() || '';
    if (villaTypeTag) {
        activeFilters.push({
            type: 'villaType',
            label: `Villa Type: ${villaTypeTag.replace(/_/g, ' ')}`,
            icon: 'fa-home',
            value: villaTypeTag
        });
    }

    // Warehouse Type filter
    const warehouseTypeTag = document.getElementById('propertiesSearchWarehouseType')?.value.trim() || '';
    if (warehouseTypeTag) {
        activeFilters.push({
            type: 'warehouseType',
            label: `Warehouse: ${warehouseTypeTag.replace(/_/g, ' ')}`,
            icon: 'fa-warehouse',
            value: warehouseTypeTag
        });
    }

    // Plot Area filter
    const plotAreaTag = document.getElementById('propertiesSearchPlotArea')?.value.trim() || '';
    if (plotAreaTag) {
        activeFilters.push({
            type: 'plotArea',
            label: `Plot Area: ${plotAreaTag} sq.ft`,
            icon: 'fa-map',
            value: plotAreaTag
        });
    }

    // Super Builtup Area filter
    const superBuildupTag = document.getElementById('propertiesSearchSuperBuildupArea')?.value.trim() || '';
    if (superBuildupTag) {
        activeFilters.push({
            type: 'superBuildupArea',
            label: `Super Builtup: ${superBuildupTag} sq.ft`,
            icon: 'fa-ruler-combined',
            value: superBuildupTag
        });
    }

    // Directions filter
    const directions = document.getElementById('searchDirections')?.value.trim() || '';
    if (directions) {
        activeFilters.push({
            type: 'directions',
            label: `Directions: ${directions}`,
            icon: 'fa-compass',
            value: directions
        });
    }

    // Amenities filter
    const amenities = document.getElementById('searchAmenities')?.value.trim() || '';
    if (amenities) {
        activeFilters.push({
            type: 'amenities',
            label: `Amenities: ${amenities}`,
            icon: 'fa-star',
            value: amenities
        });
    }

    // Render tags
    if (activeFilters.length > 0) {
        filterTags.innerHTML = activeFilters.map(filter => `
            <div class="filter-tag" data-filter-type="${filter.type}" data-filter-value="${filter.value}">
                <i class="fas ${filter.icon} filter-tag-icon"></i>
                <span class="filter-tag-text">${filter.label}</span>
                <button type="button" class="filter-tag-remove" data-filter-type="${filter.type}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        filterTagsContainer.style.display = 'block';

        // Add event listeners to remove buttons
        filterTags.querySelectorAll('.filter-tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterType = btn.dataset.filterType;
                removeFilter(filterType);
            });
        });
    } else {
        filterTagsContainer.style.display = 'none';
        filterTags.innerHTML = '';
    }
}

// Remove Filter
function removeFilter(filterType) {
    switch (filterType) {
        case 'mainSearch':
            const mainSearchInput = document.getElementById('mainSearchInput');
            const mainSearchClear = document.getElementById('mainSearchClear');
            const navSearchInput = document.getElementById('navSearchInput');
            const navSearchClear = document.getElementById('navSearchClear');
            if (mainSearchInput) {
                mainSearchInput.value = '';
                if (mainSearchClear) {
                    mainSearchClear.style.display = 'none';
                }
            }
            if (navSearchInput) {
                navSearchInput.value = '';
                if (navSearchClear) {
                    navSearchClear.style.display = 'none';
                }
            }
            break;
        case 'condition':
            selectedCondition = null;
            document.querySelectorAll('[data-filter-condition]').forEach(btn => btn.classList.remove('active'));
            break;
        case 'status':
            const allTab = document.querySelector('.filter-tab[data-filter="all"]');
            if (allTab) {
                document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
                allTab.classList.add('active');
                currentFilter = 'all';
            }
            break;
        case 'bhk':
            selectedBHK = null;
            document.querySelectorAll('[data-bhk]').forEach(btn => btn.classList.remove('active'));
            break;
        case 'propertyType':
            selectedPropertyType = null;
            // Also clear category if it was set by this property type
            selectedCategory = null;
            document.querySelectorAll('.subcategory-button[data-property-type]').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.category-text-button[data-category]').forEach(btn => btn.classList.remove('active'));
            const categorySection = document.querySelector('.category-section-centered');
            if (categorySection) categorySection.removeAttribute('data-active-category');
            break;
        case 'category':
            selectedCategory = null;
            // Also clear any property types under this category
            selectedPropertyType = null;
            document.querySelectorAll('.category-text-button[data-category]').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.subcategory-button[data-property-type]').forEach(btn => btn.classList.remove('active'));
            const categorySection2 = document.querySelector('.category-section-centered');
            if (categorySection2) categorySection2.removeAttribute('data-active-category');
            break;
        case 'city':
            const cityInput = document.getElementById('searchCity');
            if (cityInput) cityInput.value = '';
            break;
        case 'area':
            const areaInput = document.getElementById('searchArea');
            if (areaInput) areaInput.value = '';
            break;
        case 'direction':
        case 'directions':
            const directionInput = document.getElementById('searchDirection') || document.getElementById('searchDirections');
            if (directionInput) directionInput.value = '';
            break;
        case 'price':
            const priceSelect = document.getElementById('searchPrice');
            if (priceSelect) priceSelect.value = '';
            break;
        case 'length':
            const lengthInput = document.getElementById('searchLength');
            if (lengthInput) lengthInput.value = '';
            break;
        case 'breadth':
            const breadthInput = document.getElementById('searchBreadth');
            if (breadthInput) breadthInput.value = '';
            break;
        case 'carpetArea':
            const carpetAreaInput = document.getElementById('searchCarpetArea');
            if (carpetAreaInput) carpetAreaInput.value = '';
            break;
        case 'villaType':
            const villaTypeInput = document.getElementById('searchVillaType');
            if (villaTypeInput) villaTypeInput.value = '';
            break;
        case 'warehouseType':
            const warehouseTypeInput = document.getElementById('searchWarehouseType');
            if (warehouseTypeInput) warehouseTypeInput.value = '';
            break;
        case 'plotArea':
            const plotAreaInput = document.getElementById('searchPlotArea');
            if (plotAreaInput) plotAreaInput.value = '';
            break;
        case 'superBuildupArea':
            const superBuildupInput = document.getElementById('searchSuperBuildupArea');
            if (superBuildupInput) superBuildupInput.value = '';
            break;
        case 'directions':
            const directionsInput = document.getElementById('searchDirections');
            if (directionsInput) directionsInput.value = '';
            break;
        case 'amenities':
            const amenitiesInput = document.getElementById('searchAmenities');
            if (amenitiesInput) amenitiesInput.value = '';
            break;
    }
    applyFilters();
}

// Initialize Filter Tags
function initFilterTags() {
    const clearAllBtn = document.getElementById('clearAllFilters');

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            // Clear main search
            const mainSearchInput = document.getElementById('mainSearchInput');
            const mainSearchClear = document.getElementById('mainSearchClear');
            if (mainSearchInput) {
                mainSearchInput.value = '';
                if (mainSearchClear) {
                    mainSearchClear.style.display = 'none';
                }
            }

            // Reset condition filter
            selectedCondition = null;
            const propertyConditionSelect = document.getElementById('searchPropertyCondition');
            if (propertyConditionSelect) propertyConditionSelect.value = '';

            // Reset status filter
            currentFilter = 'all';
            const transactionTypeSelect = document.getElementById('searchTransactionType');
            if (transactionTypeSelect) transactionTypeSelect.value = 'all';

            // Reset BHK filter
            selectedBHK = null;
            const unitTypeSelect = document.getElementById('searchUnitType');
            if (unitTypeSelect) unitTypeSelect.value = '';

            // Reset property type filter
            selectedPropertyType = null;
            document.querySelectorAll('.subcategory-button[data-property-type]').forEach(btn => btn.classList.remove('active'));

            // Reset category filter
            selectedCategory = null;
            document.querySelectorAll('.category-text-button[data-category]').forEach(btn => btn.classList.remove('active'));
            const categorySection = document.querySelector('.category-section-centered');
            if (categorySection) categorySection.removeAttribute('data-active-category');
            updateFilterGroupsByPropertyType();

            // Clear all form filters
            const cityInput = document.getElementById('searchCity');
            const areaInput = document.getElementById('searchArea');
            const directionInput = document.getElementById('searchDirection') || document.getElementById('searchDirections');
            const priceSelect = document.getElementById('searchPrice');
            const lengthInput = document.getElementById('searchLength');
            const breadthInput = document.getElementById('searchBreadth');
            const carpetAreaInput = document.getElementById('searchCarpetArea');
            const amenitiesInput = document.getElementById('searchAmenities');
            const villaTypeInput = document.getElementById('searchVillaType');
            const warehouseTypeInput = document.getElementById('searchWarehouseType');
            const plotAreaInput = document.getElementById('searchPlotArea');
            const superBuildupInput = document.getElementById('searchSuperBuildupArea');

            if (cityInput) cityInput.value = '';
            if (areaInput) areaInput.value = '';
            if (directionInput) directionInput.value = '';
            if (priceSelect) priceSelect.value = '';
            if (lengthInput) lengthInput.value = '';
            if (breadthInput) breadthInput.value = '';
            if (carpetAreaInput) carpetAreaInput.value = '';
            if (amenitiesInput) amenitiesInput.value = '';
            if (villaTypeInput) villaTypeInput.value = '';
            if (warehouseTypeInput) warehouseTypeInput.value = '';
            if (plotAreaInput) plotAreaInput.value = '';
            if (superBuildupInput) superBuildupInput.value = '';

            applyFilters();
        });
    }
}

// Initialize Search
function initSearch() {
    const searchForm = document.getElementById('propertiesSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        // Real-time search on input change
        const searchInputs = searchForm.querySelectorAll('input, select');
        searchInputs.forEach(input => {
            input.addEventListener('change', () => {
                applyFilters();
            });

            // Also listen to input events for text inputs
            if (input.tagName === 'INPUT' && input.type === 'text') {
                let inputTimeout;
                input.addEventListener('input', () => {
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => {
                        applyFilters();
                    }, 300);
                });
            }
        });
    }
}

// Initialize Main Search Bar
function initMainSearch() {
    const mainSearchInput = document.getElementById('mainSearchInput');
    const mainSearchClear = document.getElementById('mainSearchClear');
    const navSearchInput = document.getElementById('navSearchInput');
    const navSearchClear = document.getElementById('navSearchClear');

    // Function to initialize search input
    function initSearchInput(input, clearBtn) {
        if (!input) return;

        // Real-time search as user types
        let searchTimeout;
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const value = e.target.value.trim();

            // Show/hide clear button
            if (clearBtn) {
                clearBtn.style.display = value ? 'flex' : 'none';
            }

            // Sync with other search input if both exist
            if (input === mainSearchInput && navSearchInput) {
                navSearchInput.value = value;
                if (navSearchClear) {
                    navSearchClear.style.display = value ? 'flex' : 'none';
                }
            } else if (input === navSearchInput && mainSearchInput) {
                mainSearchInput.value = value;
                if (mainSearchClear) {
                    mainSearchClear.style.display = value ? 'flex' : 'none';
                }
            }

            // Debounce search for better performance
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 300);
        });

        // Search on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyFilters();
            }
        });
    }

    // Initialize both search inputs
    initSearchInput(mainSearchInput, mainSearchClear);
    initSearchInput(navSearchInput, navSearchClear);

    // Clear button functionality for main search
    if (mainSearchClear) {
        mainSearchClear.addEventListener('click', () => {
            if (mainSearchInput) {
                mainSearchInput.value = '';
                mainSearchClear.style.display = 'none';
                if (navSearchInput) {
                    navSearchInput.value = '';
                    if (navSearchClear) {
                        navSearchClear.style.display = 'none';
                    }
                }
                applyFilters();
                mainSearchInput.focus();
            }
        });
    }

    // Clear button functionality for nav search
    if (navSearchClear) {
        navSearchClear.addEventListener('click', () => {
            if (navSearchInput) {
                navSearchInput.value = '';
                navSearchClear.style.display = 'none';
                if (mainSearchInput) {
                    mainSearchInput.value = '';
                    if (mainSearchClear) {
                        mainSearchClear.style.display = 'none';
                    }
                }
                applyFilters();
                navSearchInput.focus();
            }
        });
    }
}

// Update Load More Button Visibility
function updateLoadMoreButton() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        const loadMoreContainer = loadMoreBtn.closest('.properties-load-more');

        if (displayedProperties >= filteredProperties.length || filteredProperties.length === 0) {
            // Hide button if all properties are displayed or no properties
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        } else {
            // Show button if there are more properties to load
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'block';
            }
            loadMoreBtn.style.display = 'inline-flex';

            // Update button text to show remaining count (only if not in loading state)
            if (!loadMoreBtn.disabled) {
                const remaining = filteredProperties.length - displayedProperties;
                const buttonText = loadMoreBtn.querySelector('span');
                if (buttonText && remaining > 0) {
                    // Store original text if not already stored
                    if (!loadMoreBtn.dataset.originalText) {
                        loadMoreBtn.dataset.originalText = buttonText.textContent;
                    }
                    const originalText = loadMoreBtn.dataset.originalText;
                    buttonText.textContent = remaining <= 8
                        ? originalText
                        : `${originalText} (${remaining} remaining)`;
                }
            }
        }
    }
}

// Load More Properties
function initLoadMore() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            // Disable button during load
            loadMoreBtn.disabled = true;
            const buttonText = loadMoreBtn.querySelector('span');
            const buttonIcon = loadMoreBtn.querySelector('i');
            const originalText = buttonText ? buttonText.textContent : '';

            // Show loading state
            if (buttonText) {
                buttonText.textContent = 'Loading...';
            }
            if (buttonIcon) {
                buttonIcon.className = 'fas fa-spinner fa-spin';
            }

            // Small delay for smooth UX
            await new Promise(resolve => setTimeout(resolve, 300));

            // Calculate how many to show (8 more, or remaining if less)
            const remaining = filteredProperties.length - displayedProperties;
            const toShow = Math.min(8, remaining);
            displayedProperties += toShow;

            // Get current scroll position
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

            // Render properties
            renderProperties();

            // Smooth scroll to show newly loaded properties
            setTimeout(() => {
                const propertiesGrid = document.getElementById('propertiesGrid');
                if (propertiesGrid) {
                    const newProperties = propertiesGrid.querySelectorAll('.property-card');
                    if (newProperties.length > 0) {
                        // Scroll to the first newly loaded property
                        const firstNewProperty = newProperties[Math.max(0, displayedProperties - toShow - 1)];
                        if (firstNewProperty) {
                            firstNewProperty.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                                inline: 'nearest'
                            });
                        }
                    }
                }
            }, 100);

            // Update button state
            updateLoadMoreButton();

            // Re-enable button
            loadMoreBtn.disabled = false;
            if (buttonText) {
                // Restore original text or update with remaining count
                const remaining = filteredProperties.length - displayedProperties;
                if (remaining > 0 && remaining > 8) {
                    buttonText.textContent = `${originalText} (${remaining} remaining)`;
                } else {
                    buttonText.textContent = originalText;
                }
            }
            if (buttonIcon) {
                buttonIcon.className = 'fas fa-arrow-down';
            }
        });
    }
}

// Price Range Modal Functionality
(function initPriceRangeModal() {
    const priceRangeBtn = document.getElementById('priceRangeBtn');
    const priceRangeModal = document.getElementById('priceRangeModal');
    const priceRangeModalOverlay = document.getElementById('priceRangeModalOverlay');
    const priceRangeModalClose = document.getElementById('priceRangeModalClose');
    const priceRangeMin = document.getElementById('priceRangeMin');
    const priceRangeMax = document.getElementById('priceRangeMax');
    const priceRangeMinInput = document.getElementById('priceRangeMinInput');
    const priceRangeMaxInput = document.getElementById('priceRangeMaxInput');
    const priceRangeProgress = document.getElementById('priceRangeProgress');
    const priceRangeLabelMin = document.getElementById('priceRangeLabelMin');
    const priceRangeLabelMax = document.getElementById('priceRangeLabelMax');
    const priceRangeDisplay = document.getElementById('priceRangeDisplay');
    const priceRangeBtnClear = document.getElementById('priceRangeBtnClear');
    const priceRangeBtnApply = document.getElementById('priceRangeBtnApply');
    const searchPriceInput = document.getElementById('searchPrice');

    if (!priceRangeBtn || !priceRangeModal) return;

    let minValue = 0;
    let maxValue = 100;

    // Convert Cr to actual price (in rupees)
    function crToPrice(cr) {
        return cr * 10000000; // 1 Cr = 10,000,000
    }

    // Convert price to Cr
    function priceToCr(price) {
        return price / 10000000;
    }

    // Format price for display
    function formatPriceDisplay(minCr, maxCr) {
        if (minCr === 0 && maxCr === 100) {
            return 'Any Price';
        }
        if (maxCr >= 100) {
            return `₹${minCr > 0 ? minCr.toFixed(1) : '0'} Cr+`;
        }
        return `₹${minCr > 0 ? minCr.toFixed(1) : '0'} Cr - ₹${maxCr.toFixed(1)} Cr`;
    }

    // Update progress bar
    function updateProgress() {
        const minPercent = (minValue / 100) * 100;
        const maxPercent = (maxValue / 100) * 100;
        if (priceRangeProgress) {
            priceRangeProgress.style.left = minPercent + '%';
            priceRangeProgress.style.right = (100 - maxPercent) + '%';
        }
    }

    // Update labels
    function updateLabels() {
        if (priceRangeLabelMin) {
            priceRangeLabelMin.textContent = minValue === 0 ? '₹0' : `₹${minValue.toFixed(1)} Cr`;
        }
        if (priceRangeLabelMax) {
            priceRangeLabelMax.textContent = maxValue >= 100 ? '₹100+ Cr' : `₹${maxValue.toFixed(1)} Cr`;
        }
    }

    // Update slider from input
    function updateSliderFromInput() {
        if (priceRangeMin) {
            priceRangeMin.value = minValue;
        }
        if (priceRangeMax) {
            priceRangeMax.value = maxValue;
        }
        updateProgress();
        updateLabels();
    }

    // Update input from slider
    function updateInputFromSlider() {
        if (priceRangeMinInput) {
            priceRangeMinInput.value = minValue;
        }
        if (priceRangeMaxInput) {
            priceRangeMaxInput.value = maxValue;
        }
        updateProgress();
        updateLabels();
    }

    // Ensure min <= max
    function validateRange() {
        if (minValue > maxValue) {
            const temp = minValue;
            minValue = maxValue;
            maxValue = temp;
        }
        if (minValue < 0) minValue = 0;
        if (maxValue > 100) maxValue = 100;
    }

    // Open modal
    function openModal() {
        if (priceRangeModal) {
            priceRangeModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Close modal
    function closeModal() {
        if (priceRangeModal) {
            priceRangeModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Apply price range filter
    function applyPriceRange() {
        validateRange();
        const minPrice = crToPrice(minValue);
        const maxPrice = maxValue >= 100 ? '' : crToPrice(maxValue);
        const priceValue = maxPrice === '' ? `${minPrice}-` : `${minPrice}-${maxPrice}`;

        if (searchPriceInput) {
            if (minValue === 0 && maxValue >= 100) {
                searchPriceInput.value = '';
            } else {
                searchPriceInput.value = priceValue;
            }
        }

        if (priceRangeDisplay) {
            priceRangeDisplay.textContent = formatPriceDisplay(minValue, maxValue);
        }

        closeModal();
        applyFilters();
    }

    // Clear price range
    function clearPriceRange() {
        minValue = 0;
        maxValue = 100;
        updateSliderFromInput();
        if (searchPriceInput) {
            searchPriceInput.value = '';
        }
        if (priceRangeDisplay) {
            priceRangeDisplay.textContent = 'Any Price';
        }
        closeModal();
        applyFilters();
    }

    // Event listeners
    if (priceRangeBtn) {
        priceRangeBtn.addEventListener('click', openModal);
    }

    if (priceRangeModalOverlay) {
        priceRangeModalOverlay.addEventListener('click', closeModal);
    }

    if (priceRangeModalClose) {
        priceRangeModalClose.addEventListener('click', closeModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && priceRangeModal && priceRangeModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Slider events
    if (priceRangeMin) {
        priceRangeMin.addEventListener('input', (e) => {
            minValue = parseFloat(e.target.value);
            validateRange();
            updateInputFromSlider();
        });
    }

    if (priceRangeMax) {
        priceRangeMax.addEventListener('input', (e) => {
            maxValue = parseFloat(e.target.value);
            validateRange();
            updateInputFromSlider();
        });
    }

    // Number input events
    if (priceRangeMinInput) {
        priceRangeMinInput.addEventListener('input', (e) => {
            minValue = parseFloat(e.target.value) || 0;
            validateRange();
            updateSliderFromInput();
        });
    }

    if (priceRangeMaxInput) {
        priceRangeMaxInput.addEventListener('input', (e) => {
            maxValue = parseFloat(e.target.value) || 100;
            validateRange();
            updateSliderFromInput();
        });
    }

    // Button events
    if (priceRangeBtnClear) {
        priceRangeBtnClear.addEventListener('click', clearPriceRange);
    }

    if (priceRangeBtnApply) {
        priceRangeBtnApply.addEventListener('click', applyPriceRange);
    }

    // Initialize display from existing filter value
    function initializeFromFilter() {
        if (searchPriceInput && searchPriceInput.value) {
            const priceValue = searchPriceInput.value;
            if (priceValue.includes('-')) {
                const [min, max] = priceValue.split('-').map(v => v === '' ? Infinity : parseFloat(v));
                minValue = priceToCr(min || 0);
                maxValue = max === Infinity ? 100 : priceToCr(max);
                validateRange();
                updateSliderFromInput();
                if (priceRangeDisplay) {
                    priceRangeDisplay.textContent = formatPriceDisplay(minValue, maxValue);
                }
            }
        }
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeFromFilter();
            updateProgress();
            updateLabels();
        });
    } else {
        initializeFromFilter();
        updateProgress();
        updateLabels();
    }
})();

