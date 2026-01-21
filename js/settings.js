// Settings Page JavaScript
(function() {
    // Get user data
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let user = null;
    if (userStr) {
        try {
            user = JSON.parse(userStr);
            if (user && user.name) {
                document.getElementById('dashboardProfileName').textContent = user.name;
            }
            if (user && user.full_name) {
                document.getElementById('dashboardProfileFullname').textContent = user.full_name;
            }
            if (user && user.email) {
                document.getElementById('dashboardProfileEmail').textContent = user.email;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }

    // Notification function (matching dashboard style)
    function showNotification(message, type = 'success') {
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

    // Get auth headers
    function getAuthHeaders() {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        let user = null;
        if (userStr) {
            try {
                user = JSON.parse(userStr);
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        return {
            'Content-Type': 'application/json',
            'X-Admin-Email': user ? user.email : ''
        };
    }

let allStates = [];
    let allCities = [];

    // Load States from backend and merge with comprehensive list
    async function loadStates() {
        // Initialize cityMap immediately at function scope to avoid ReferenceError
        const cityMap = new Map();
        
        try {
            // Build city map from comprehensive list first
            // Check if indianCities is defined
            if (typeof indianCities !== 'undefined' && Array.isArray(indianCities)) {
                indianCities.forEach(city => {
                    const key = city.name.toLowerCase();
                    cityMap.set(key, {
                        name: city.name,
                        state: city.state,
                        is_active: false,
                        properties_count: 0
                    });
                });
            } else {
                console.error('indianCities is not defined or is not an array');
            }

            // Load cities from backend to determine state activation
            const response = await fetch('/api/admin/cities', {
                method: 'GET',
                headers: getAuthHeaders()
            });

            // Update with backend data if available
            // Note: /api/admin/cities returns an array directly, not an object with cities property
            if (response.ok) {
                const citiesData = await response.json();
                // Handle both array response and object with cities property
                const cities = Array.isArray(citiesData) ? citiesData : (citiesData.cities || []);
                if (Array.isArray(cities)) {
                    cities.forEach(city => {
                        const key = city.name.toLowerCase();
                        if (cityMap.has(key)) {
                            const cityEntry = cityMap.get(key);
                            if (cityEntry) {
                                cityEntry.is_active = city.is_active;
                                cityEntry.properties_count = city.properties_count || 0;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error loading city data from backend:', error);
            // If error occurs, still build city map from comprehensive list if empty
            if (cityMap.size === 0 && typeof indianCities !== 'undefined' && Array.isArray(indianCities)) {
                indianCities.forEach(city => {
                    const key = city.name.toLowerCase();
                    cityMap.set(key, {
                        name: city.name,
                        state: city.state,
                        is_active: false,
                        properties_count: 0
                    });
                });
            }
        }

        // Store all cities for later use
        // Ensure cityMap has data before proceeding
        if (cityMap.size === 0) {
            console.error('cityMap is empty, initializing from indianCities');
            if (typeof indianCities !== 'undefined' && Array.isArray(indianCities)) {
                indianCities.forEach(city => {
                    const key = city.name.toLowerCase();
                    cityMap.set(key, {
                        name: city.name,
                        state: city.state,
                        is_active: false,
                        properties_count: 0
                    });
                });
            } else {
                console.error('Cannot initialize cityMap: indianCities is not defined');
                // Return early if we can't build the city map
                return;
            }
        }
        
        allCities = Array.from(cityMap.values());

        // Extract unique states and determine their activation status
        const stateMap = new Map();
        
        allCities.forEach(city => {
            const stateName = city.state;
            if (!stateMap.has(stateName)) {
                stateMap.set(stateName, {
                    name: stateName,
                    is_active: false,
                    properties_count: 0,
                    cities: []
                });
            }
            const state = stateMap.get(stateName);
            state.cities.push(city);
            state.properties_count += city.properties_count || 0;
            // State is active if at least one city in it is active
            if (city.is_active) {
                state.is_active = true;
            }
        });

        allStates = Array.from(stateMap.values()).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        renderStates();
    }

    // Render states in table
    function renderStates(filterText = '') {
        const tbody = document.getElementById('statesTableBody');
        tbody.innerHTML = '';

        const filtered = filterText 
            ? allStates.filter(state => 
                state.name.toLowerCase().includes(filterText.toLowerCase())
              )
            : allStates;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No states found</td></tr>';
            return;
        }

        filtered.forEach(state => {
            const row = document.createElement('tr');
            const stateKey = state.name.toLowerCase();
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="state-checkbox" data-state="${stateKey}" ${state.is_active ? 'checked' : ''}>
                </td>
                <td>${state.name || '-'}</td>
                <td><span class="status-badge ${state.is_active ? 'sale' : 'rent'}">${state.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${state.properties_count || 0}</td>
            `;
            tbody.appendChild(row);
        });

        // Update select all checkbox
        updateSelectAllCheckbox();
    }

    // Update select all checkbox state
    function updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('.state-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllStatesCheckbox');
        if (checkboxes.length === 0) return;

        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        selectAllCheckbox.checked = checkedCount === checkboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }

    // State search
    document.getElementById('stateSearch').addEventListener('input', (e) => {
        renderStates(e.target.value);
    });

    // Select all states
    document.getElementById('selectAllStatesBtn').addEventListener('click', () => {
        document.querySelectorAll('.state-checkbox').forEach(cb => {
            cb.checked = true;
            const stateKey = cb.dataset.state;
            const state = allStates.find(s => s.name.toLowerCase() === stateKey);
            if (state) {
                state.is_active = true;
                // Activate all cities in this state
                state.cities.forEach(city => {
                    city.is_active = true;
                });
            }
        });
        updateSelectAllCheckbox();
        renderStates(document.getElementById('stateSearch').value);
    });

    // Deselect all states
    document.getElementById('deselectAllStatesBtn').addEventListener('click', () => {
        document.querySelectorAll('.state-checkbox').forEach(cb => {
            cb.checked = false;
            const stateKey = cb.dataset.state;
            const state = allStates.find(s => s.name.toLowerCase() === stateKey);
            if (state) {
                state.is_active = false;
                // Deactivate all cities in this state
                state.cities.forEach(city => {
                    city.is_active = false;
                });
            }
        });
        updateSelectAllCheckbox();
        renderStates(document.getElementById('stateSearch').value);
    });

    // Select all checkbox
    document.getElementById('selectAllStatesCheckbox').addEventListener('change', (e) => {
        document.querySelectorAll('.state-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
            const stateKey = cb.dataset.state;
            const state = allStates.find(s => s.name.toLowerCase() === stateKey);
            if (state) {
                state.is_active = e.target.checked;
                // Activate/deactivate all cities in this state
                state.cities.forEach(city => {
                    city.is_active = e.target.checked;
                });
            }
        });
    });

    // Individual state checkbox change
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('state-checkbox')) {
            const stateKey = e.target.dataset.state;
            const state = allStates.find(s => s.name.toLowerCase() === stateKey);
            if (state) {
                state.is_active = e.target.checked;
                // Activate/deactivate all cities in this state
                state.cities.forEach(city => {
                    city.is_active = e.target.checked;
                });
                // Update status badge
                const row = e.target.closest('tr');
                const badge = row.querySelector('.status-badge');
                if (badge) {
                    badge.className = `status-badge ${state.is_active ? 'sale' : 'rent'}`;
                    badge.textContent = state.is_active ? 'Active' : 'Inactive';
                }
            }
            updateSelectAllCheckbox();
        }
    });

    // Save states (activates/deactivates all cities in each state)
    document.getElementById('saveStatesBtn').addEventListener('click', async () => {
        const activeStateNames = allStates.filter(s => s.is_active).map(s => s.name);
        
        try {
            // Save all cities (bulk update) - cities are activated/deactivated based on their state
            const response = await fetch('/api/admin/cities/bulk', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cities: allCities.map(city => ({
                        name: city.name,
                        state: city.state,
                        is_active: city.is_active
                    }))
                })
            });

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `Failed to save states (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON (e.g., HTML 404 page), get text
                    const text = await response.text();
                    console.error('Non-JSON error response:', text.substring(0, 200));
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                showNotification(errorMessage, 'error');
                return;
            }

            const data = await response.json();
            if (data.success) {
                showNotification(`Successfully saved ${activeStateNames.length} active states`, 'success');
                loadStates();
            } else {
                showNotification(data.message || 'Failed to save states', 'error');
            }
        } catch (error) {
            console.error('Error saving states:', error);
            showNotification('Error saving states. Please try again.', 'error');
        }
    });

    // Load Categories
    async function loadCategories() {
        try {
            // Note: This endpoint would need to be created in the backend
            const response = await fetch('/api/admin/categories', {
                method: 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            const tbody = document.getElementById('categoriesTableBody');
            tbody.innerHTML = '';

            if (response.ok && data.categories) {
                if (data.categories.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No categories found. Click "Add Category" to create one.</td></tr>';
                } else {
                    data.categories.forEach(category => {
                        const row = document.createElement('tr');
                        // Escape HTML to prevent XSS
                        const categoryName = (category.name || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const displayName = (category.display_name || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const isActive = category.is_active !== undefined ? category.is_active : true;
                        const propertiesCount = category.properties_count || 0;
                        
                        row.innerHTML = `
                            <td>${categoryName}</td>
                            <td>${displayName}</td>
                            <td><span class="status-badge ${isActive ? 'sale' : 'rent'}">${isActive ? 'Active' : 'Inactive'}</span></td>
                            <td>${propertiesCount}</td>
                            <td>
                                <button class="dashboard-btn-secondary edit-category" data-id="${category.id}" style="margin-right: 0.5rem;" title="Edit Category">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="dashboard-btn-danger delete-category" data-id="${category.id}" title="Delete Category">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            } else {
                const errorMsg = data?.error || data?.message || 'Failed to load categories';
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #e74c3c; padding: 2rem;">Error: ${errorMsg}</td></tr>`;
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            showNotification('Error loading categories', 'error');
        }
    }

    // Load Unit Types
    async function loadUnitTypes() {
        try {
            // Note: This endpoint would need to be created in the backend
            const response = await fetch('/api/admin/unit-types', {
                method: 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            const tbody = document.getElementById('unitTypesTableBody');
            tbody.innerHTML = '';

            if (response.ok && data.unit_types) {
                if (data.unit_types.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No unit types found. Click "Add Unit Type" to create one.</td></tr>';
                } else {
                    data.unit_types.forEach(unitType => {
                        const row = document.createElement('tr');
                        // Escape HTML to prevent XSS
                        const unitTypeName = (unitType.name || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const displayName = (unitType.display_name || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const bedrooms = unitType.bedrooms !== undefined ? unitType.bedrooms : 0;
                        const isActive = unitType.is_active !== undefined ? unitType.is_active : true;
                        const propertiesCount = unitType.properties_count || 0;
                        
                        row.innerHTML = `
                            <td>${unitTypeName}</td>
                            <td>${displayName}</td>
                            <td>${bedrooms}</td>
                            <td><span class="status-badge ${isActive ? 'sale' : 'rent'}">${isActive ? 'Active' : 'Inactive'}</span></td>
                            <td>${propertiesCount}</td>
                            <td>
                                <button class="dashboard-btn-secondary edit-unit-type" data-id="${unitType.id}" style="margin-right: 0.5rem;" title="Edit Unit Type">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="dashboard-btn-danger delete-unit-type" data-id="${unitType.id}" title="Delete Unit Type">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            } else {
                const errorMsg = data?.error || data?.message || 'Failed to load unit types';
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #e74c3c; padding: 2rem;">Error: ${errorMsg}</td></tr>`;
            }
        } catch (error) {
            console.error('Error loading unit types:', error);
            showNotification('Error loading unit types', 'error');
        }
    }


    // Category Modal Handlers
    const categoryModal = document.getElementById('categoryModal');
    const categoryForm = document.getElementById('categoryForm');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
    const categoryModalClose = document.getElementById('categoryModalClose');
    const categoryModalOverlay = document.getElementById('categoryModalOverlay');

    if (addCategoryBtn && categoryModal && categoryForm) {
        addCategoryBtn.addEventListener('click', () => {
            const modalTitle = document.getElementById('categoryModalTitle');
            const categoryIdInput = document.getElementById('categoryId');
            const categoryNameInput = document.getElementById('categoryName');
            if (modalTitle) modalTitle.textContent = 'Add Category';
            if (categoryIdInput) categoryIdInput.value = '';
            if (categoryNameInput) {
                categoryNameInput.disabled = false; // Enable name input for new categories
                categoryNameInput.value = '';
            }
            categoryForm.reset();
            // Ensure is_active checkbox is checked by default
            const categoryIsActiveInput = document.getElementById('categoryIsActive');
            if (categoryIsActiveInput) categoryIsActiveInput.checked = true;
            categoryModal.classList.add('active');
        });
    }

    if (cancelCategoryBtn && categoryModal) {
        cancelCategoryBtn.addEventListener('click', () => categoryModal.classList.remove('active'));
    }
    if (categoryModalClose && categoryModal) {
        categoryModalClose.addEventListener('click', () => categoryModal.classList.remove('active'));
    }
    if (categoryModalOverlay && categoryModal) {
        categoryModalOverlay.addEventListener('click', () => categoryModal.classList.remove('active'));
    }

    if (categoryForm && categoryModal) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryNameInput = document.getElementById('categoryName');
            const categoryDisplayNameInput = document.getElementById('categoryDisplayName');
            const categoryIsActiveInput = document.getElementById('categoryIsActive');
            const categoryIdInput = document.getElementById('categoryId');
            
            if (!categoryNameInput || !categoryDisplayNameInput || !categoryIsActiveInput) {
                showNotification('Form fields not found', 'error');
                return;
            }
            
            const categoryName = categoryNameInput.value.trim();
            const displayName = categoryDisplayNameInput.value.trim();
            
            if (!categoryName || !displayName) {
                showNotification('Category name and display name are required', 'error');
                return;
            }
            
            // Normalize category name: lowercase and replace spaces with underscores
            const normalizedName = categoryName.toLowerCase().replace(/\s+/g, '_');
            
            // Validate category name format (alphanumeric and underscores only)
            if (!/^[a-z0-9_]+$/.test(normalizedName)) {
                showNotification('Category name can only contain lowercase letters, numbers, and underscores', 'error');
                return;
            }
            
            const formData = {
                name: normalizedName,
                display_name: displayName,
                is_active: categoryIsActiveInput.checked
            };
            
            const categoryId = categoryIdInput ? categoryIdInput.value : '';
            const url = categoryId ? `/api/admin/categories/${categoryId}` : '/api/admin/categories';
            const method = 'POST';

            try {
                // Show loading state
                const submitBtn = categoryForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
                if (submitBtn) {
                    submitBtn.setAttribute('data-original-text', originalBtnText);
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                }
                
                const response = await fetch(url, {
                    method: method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                
                // Restore button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
                
                if (response.ok) {
                    showNotification(categoryId ? 'Category updated successfully' : 'Category added successfully', 'success');
                    categoryModal.classList.remove('active');
                    categoryForm.reset();
                    loadCategories();
                } else {
                    const errorMsg = data.error || data.message || 'Failed to save category';
                    showNotification(errorMsg, 'error');
                }
            } catch (error) {
                console.error('Error saving category:', error);
                // Restore button state
                const submitBtn = categoryForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    const originalBtnText = submitBtn.getAttribute('data-original-text') || '<i class="fas fa-save"></i> Save Category';
                    submitBtn.innerHTML = originalBtnText;
                }
                showNotification('Error saving category. Please check your connection and try again.', 'error');
            }
        });
    }

    // Unit Type Modal Handlers
    const unitTypeModal = document.getElementById('unitTypeModal');
    const unitTypeForm = document.getElementById('unitTypeForm');
    const addUnitTypeBtn = document.getElementById('addUnitTypeBtn');
    const cancelUnitTypeBtn = document.getElementById('cancelUnitTypeBtn');
    const unitTypeModalClose = document.getElementById('unitTypeModalClose');
    const unitTypeModalOverlay = document.getElementById('unitTypeModalOverlay');

    if (addUnitTypeBtn && unitTypeModal && unitTypeForm) {
        addUnitTypeBtn.addEventListener('click', () => {
            const modalTitle = document.getElementById('unitTypeModalTitle');
            const unitTypeIdInput = document.getElementById('unitTypeId');
            const unitTypeNameInput = document.getElementById('unitTypeName');
            if (modalTitle) modalTitle.textContent = 'Add Unit Type';
            if (unitTypeIdInput) unitTypeIdInput.value = '';
            if (unitTypeNameInput) {
                unitTypeNameInput.disabled = false; // Enable name input for new unit types
                unitTypeNameInput.value = '';
            }
            unitTypeForm.reset();
            // Ensure is_active checkbox is checked by default
            const unitTypeIsActiveInput = document.getElementById('unitTypeIsActive');
            if (unitTypeIsActiveInput) unitTypeIsActiveInput.checked = true;
            // Set default bedrooms to 0
            const unitTypeBedroomsInput = document.getElementById('unitTypeBedrooms');
            if (unitTypeBedroomsInput) unitTypeBedroomsInput.value = '0';
            unitTypeModal.classList.add('active');
        });
    }

    if (cancelUnitTypeBtn && unitTypeModal) {
        cancelUnitTypeBtn.addEventListener('click', () => unitTypeModal.classList.remove('active'));
    }
    if (unitTypeModalClose && unitTypeModal) {
        unitTypeModalClose.addEventListener('click', () => unitTypeModal.classList.remove('active'));
    }
    if (unitTypeModalOverlay && unitTypeModal) {
        unitTypeModalOverlay.addEventListener('click', () => unitTypeModal.classList.remove('active'));
    }

    if (unitTypeForm && unitTypeModal) {
        unitTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const unitTypeNameInput = document.getElementById('unitTypeName');
            const unitTypeDisplayNameInput = document.getElementById('unitTypeDisplayName');
            const unitTypeBedroomsInput = document.getElementById('unitTypeBedrooms');
            const unitTypeIsActiveInput = document.getElementById('unitTypeIsActive');
            const unitTypeIdInput = document.getElementById('unitTypeId');
            
            if (!unitTypeNameInput || !unitTypeDisplayNameInput || !unitTypeBedroomsInput || !unitTypeIsActiveInput) {
                showNotification('Form fields not found', 'error');
                return;
            }
            
            const unitTypeId = unitTypeIdInput ? unitTypeIdInput.value : '';
            const isEdit = !!unitTypeId;
            const unitTypeName = unitTypeNameInput.value.trim();
            const displayName = unitTypeDisplayNameInput.value.trim();
            const bedrooms = parseInt(unitTypeBedroomsInput.value);
            
            // Validate display name (always required)
            if (!displayName) {
                showNotification('Display name is required', 'error');
                return;
            }
            
            // Validate name only when creating (not editing)
            if (!isEdit) {
                if (!unitTypeName) {
                    showNotification('Unit type name is required', 'error');
                    return;
                }
                
                // Normalize unit type name: uppercase and remove spaces
                const normalizedName = unitTypeName.toUpperCase().replace(/\s+/g, '');
                
                // Validate unit type name format (alphanumeric and + character, no spaces)
                if (!/^[A-Z0-9+]+$/.test(normalizedName)) {
                    showNotification('Unit type name can only contain uppercase letters, numbers, and + character', 'error');
                    return;
                }
            }
            
            if (isNaN(bedrooms) || bedrooms < 0) {
                showNotification('Bedrooms must be a valid non-negative number', 'error');
                return;
            }
            
            // Build form data based on whether we're creating or editing
            let formData;
            if (!isEdit) {
                // When creating, include normalized name
                const normalizedName = unitTypeName.toUpperCase().replace(/\s+/g, '');
                formData = {
                    name: normalizedName,
                    display_name: displayName,
                    bedrooms: bedrooms,
                    is_active: unitTypeIsActiveInput.checked
                };
            } else {
                // When editing, don't send name (backend doesn't update it anyway)
                formData = {
                    display_name: displayName,
                    bedrooms: bedrooms,
                    is_active: unitTypeIsActiveInput.checked
                };
            }
            
            const url = unitTypeId ? `/api/admin/unit-types/${unitTypeId}` : '/api/admin/unit-types';
            const method = 'POST';

            try {
                // Show loading state
                const submitBtn = unitTypeForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
                if (submitBtn) {
                    submitBtn.setAttribute('data-original-text', originalBtnText);
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                }
                
                const response = await fetch(url, {
                    method: method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                
                // Restore button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
                
                if (response.ok) {
                    showNotification(unitTypeId ? 'Unit type updated successfully' : 'Unit type added successfully', 'success');
                    unitTypeModal.classList.remove('active');
                    unitTypeForm.reset();
                    loadUnitTypes();
                } else {
                    const errorMsg = data.error || data.message || 'Failed to save unit type';
                    showNotification(errorMsg, 'error');
                }
            } catch (error) {
                console.error('Error saving unit type:', error);
                // Restore button state
                const submitBtn = unitTypeForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    const originalBtnText = submitBtn.getAttribute('data-original-text') || '<i class="fas fa-save"></i> Save Unit Type';
                    submitBtn.innerHTML = originalBtnText;
                }
                showNotification('Error saving unit type. Please check your connection and try again.', 'error');
            }
        });
    }

    // Event delegation for edit/delete buttons
    document.addEventListener('click', async (e) => {
        // Edit Category
        if (e.target.closest('.edit-category')) {
            const categoryId = e.target.closest('.edit-category').dataset.id;
            try {
                const response = await fetch(`/api/admin/categories/${categoryId}`, {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                if (response.ok && data.category) {
                    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
                    document.getElementById('categoryId').value = data.category.id;
                    const categoryNameInput = document.getElementById('categoryName');
                    categoryNameInput.value = data.category.name || '';
                    categoryNameInput.disabled = true; // Prevent changing category name to avoid breaking references
                    document.getElementById('categoryDisplayName').value = data.category.display_name || '';
                    document.getElementById('categoryIsActive').checked = data.category.is_active !== false;
                    categoryModal.classList.add('active');
                } else {
                    showNotification(data?.error || data?.message || 'Failed to load category data', 'error');
                }
            } catch (error) {
                console.error('Error loading category:', error);
                showNotification('Error loading category data', 'error');
            }
        }

        // Delete Category
        if (e.target.closest('.delete-category')) {
            const categoryId = e.target.closest('.delete-category').dataset.id;
            const categoryRow = e.target.closest('tr');
            const categoryName = categoryRow ? categoryRow.querySelector('td:first-child')?.textContent || 'this category' : 'this category';
            
            if (confirm(`Are you sure you want to delete the category "${categoryName}"? This action cannot be undone.`)) {
                const deleteBtn = e.target.closest('.delete-category');
                const originalBtnHtml = deleteBtn.innerHTML;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                try {
                    const response = await fetch(`/api/admin/categories/${categoryId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();
                    
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalBtnHtml;
                    
                    if (response.ok) {
                        showNotification('Category deleted successfully', 'success');
                        loadCategories();
                    } else {
                        const errorMsg = data.error || data.message || 'Failed to delete category';
                        showNotification(errorMsg, 'error');
                    }
                } catch (error) {
                    console.error('Error deleting category:', error);
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalBtnHtml;
                    showNotification('Error deleting category. Please check your connection and try again.', 'error');
                }
            }
        }

        // Edit Unit Type
        if (e.target.closest('.edit-unit-type')) {
            const unitTypeId = e.target.closest('.edit-unit-type').dataset.id;
            try {
                const response = await fetch(`/api/admin/unit-types/${unitTypeId}`, {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                if (response.ok && data.unit_type) {
                    document.getElementById('unitTypeModalTitle').textContent = 'Edit Unit Type';
                    document.getElementById('unitTypeId').value = data.unit_type.id;
                    const unitTypeNameInput = document.getElementById('unitTypeName');
                    unitTypeNameInput.value = data.unit_type.name || '';
                    unitTypeNameInput.disabled = true; // Prevent changing unit type name to avoid breaking references
                    document.getElementById('unitTypeDisplayName').value = data.unit_type.display_name || '';
                    document.getElementById('unitTypeBedrooms').value = data.unit_type.bedrooms || 0;
                    document.getElementById('unitTypeIsActive').checked = data.unit_type.is_active !== false;
                    unitTypeModal.classList.add('active');
                } else {
                    showNotification(data?.error || data?.message || 'Failed to load unit type data', 'error');
                }
            } catch (error) {
                console.error('Error loading unit type:', error);
                showNotification('Error loading unit type data', 'error');
            }
        }

        // Delete Unit Type
        if (e.target.closest('.delete-unit-type')) {
            const unitTypeId = e.target.closest('.delete-unit-type').dataset.id;
            const unitTypeRow = e.target.closest('tr');
            const unitTypeName = unitTypeRow ? unitTypeRow.querySelector('td:first-child')?.textContent || 'this unit type' : 'this unit type';
            
            if (confirm(`Are you sure you want to delete the unit type "${unitTypeName}"? This action cannot be undone.`)) {
                const deleteBtn = e.target.closest('.delete-unit-type');
                const originalBtnHtml = deleteBtn.innerHTML;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                try {
                    const response = await fetch(`/api/admin/unit-types/${unitTypeId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();
                    
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalBtnHtml;
                    
                    if (response.ok) {
                        showNotification('Unit type deleted successfully', 'success');
                        loadUnitTypes();
                    } else {
                        const errorMsg = data.error || data.message || 'Failed to delete unit type';
                        showNotification(errorMsg, 'error');
                    }
                } catch (error) {
                    console.error('Error deleting unit type:', error);
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalBtnHtml;
                    showNotification('Error deleting unit type. Please check your connection and try again.', 'error');
                }
            }
        }
    });

    // Profile Dropdown Toggle - Complete Implementation
    const profileBtn = document.getElementById('dashboardProfileBtn');
    const profileDropdown = document.getElementById('dashboardProfileDropdown');
    const userProfile = document.getElementById('dashboardUserProfile');
    const profileName = document.getElementById('dashboardProfileName');
    const profileFullname = document.getElementById('dashboardProfileFullname');
    const profileEmail = document.getElementById('dashboardProfileEmail');
    
    // Initialize user profile data
    if (profileName || profileFullname || profileEmail) {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            try {
                const userData = JSON.parse(userStr);
                const displayName = userData.full_name || userData.name || userData.email || 'Admin';
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
    }
    
    // Toggle dropdown functionality
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
            if (userProfile) {
                userProfile.classList.toggle('active');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('active');
                if (userProfile) {
                    userProfile.classList.remove('active');
                }
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && profileDropdown.classList.contains('active')) {
                profileDropdown.classList.remove('active');
                if (userProfile) {
                    userProfile.classList.remove('active');
                }
            }
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('dashboardLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('dashboard_authenticated');
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('user');
                sessionStorage.removeItem('dashboard_authenticated');
                sessionStorage.removeItem('isAuthenticated');
                sessionStorage.removeItem('user');
                window.location.replace('/index.html');
            }
        });
    }

    // Load data on page load
    window.addEventListener('load', function() {
        loadStates();
        loadCategories();
        loadUnitTypes();
    });
})();
