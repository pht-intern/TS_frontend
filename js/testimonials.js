// Testimonials Page JavaScript

// Testimonials data
let testimonials = [];

// Load Testimonials from API
async function loadTestimonialsFromAPI() {
    try {
        // Fetch approved testimonials (API defaults to is_approved=true)
        const url = '/api/testimonials?is_approved=true';
        console.log('Loading testimonials from API:', url);
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        let fetchedTestimonials = [];
        if (response.ok) {
            try {
                const data = await response.json();
                // Validate response is an array
                if (Array.isArray(data)) {
                    fetchedTestimonials = data;
                    console.log('Testimonials loaded successfully:', fetchedTestimonials.length);
                } else {
                    console.warn('Testimonials API returned non-array response:', data);
                }
            } catch (parseError) {
                console.error('Error parsing testimonials response:', parseError);
            }
        } else {
            // Log error but don't throw - use empty array
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                // Ignore JSON parse errors
            }
            console.error('Failed to fetch testimonials:', errorMessage);
        }
        
        // Convert API format to display format with validation
        testimonials = fetchedTestimonials
            .filter(t => t && t.message) // Only include testimonials with messages
            .map(testimonial => ({
                id: testimonial.id || 0,
                name: testimonial.client_name || 'Anonymous',
                serviceType: testimonial.service_type || 'General',
                rating: testimonial.rating || 5,
                message: testimonial.message || '',
                date: testimonial.created_at ? new Date(testimonial.created_at).toLocaleDateString() : ''
            }));
        
        console.log('Final testimonials count after filtering:', testimonials.length);
        renderTestimonials();
    } catch (error) {
        // Log error for debugging
        console.error('Error loading testimonials from API:', error);
        testimonials = [];
        renderTestimonials();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadTestimonialsFromAPI();
    initTestimonialForm();
    initRatingStars();
});

// Render Testimonials
function renderTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;

    if (testimonials.length === 0) {
        grid.innerHTML = `
            <div class="testimonials-empty">
                <div class="empty-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h3>Testimonials Coming Soon</h3>
                <p>We're collecting testimonials from our satisfied clients. Check back soon to read about their experiences with Tirumakudalu Properties.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = testimonials.map(testimonial => `
        <div class="testimonial-card">
            <div class="testimonial-header">
                <div class="testimonial-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="testimonial-info">
                    <h4 class="testimonial-name">${escapeHtml(testimonial.name)}</h4>
                    <div class="testimonial-meta">
                        <span class="testimonial-service">${escapeHtml(testimonial.serviceType)}</span>
                        <span class="testimonial-date">${escapeHtml(testimonial.date)}</span>
                    </div>
                </div>
            </div>
            <div class="testimonial-rating">
                ${generateStars(testimonial.rating)}
            </div>
            <div class="testimonial-content">
                <p>"${escapeHtml(testimonial.message)}"</p>
            </div>
        </div>
    `).join('');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Generate Star Rating
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
}

// Initialize Testimonial Form
function initTestimonialForm() {
    const form = document.getElementById('testimonialForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const clientName = document.getElementById('clientName')?.value.trim();
        const clientEmail = document.getElementById('clientEmail')?.value.trim();
        const clientPhone = document.getElementById('clientPhone')?.value.trim();
        const serviceType = document.getElementById('serviceType')?.value.trim();
        const rating = document.querySelector('input[name="rating"]:checked')?.value;
        const message = document.getElementById('testimonialMessage')?.value.trim();
        
        // Validate required fields
        if (!clientName || !message) {
            alert('Please fill in your name and testimonial message.');
            return;
        }
        
        // Prepare data for API
        const testimonialData = {
            client_name: clientName,
            message: message,
            client_email: clientEmail || null,
            client_phone: clientPhone || null,
            service_type: serviceType || null,
            rating: rating ? parseInt(rating) : null,
            is_approved: false, // New testimonials need admin approval
            is_featured: false
        };
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }
        
        try {
            const response = await fetch('/api/testimonials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testimonialData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to submit testimonial');
            }
            
            // Show success message
            showSuccessMessage();
            
            // Reset form
            form.reset();
            resetRatingStars();
            
            // Note: The testimonial won't appear immediately since it needs admin approval
        } catch (error) {
            console.error('Error submitting testimonial:', error);
            alert(error.message || 'Failed to submit testimonial. Please try again.');
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    });
}

// Initialize Rating Stars
function initRatingStars() {
    const starLabels = document.querySelectorAll('.star-label');
    const starInputs = document.querySelectorAll('input[name="rating"]');
    
    starLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            const rating = 5 - index;
            document.getElementById(`star${rating}`).checked = true;
            updateStarDisplay(rating);
        });
    });
    
    starInputs.forEach(input => {
        input.addEventListener('change', () => {
            updateStarDisplay(parseInt(input.value));
        });
    });
}

// Update Star Display
function updateStarDisplay(rating) {
    const starLabels = document.querySelectorAll('.star-label i');
    starLabels.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('far');
            star.classList.add('fas');
        } else {
            star.classList.remove('fas');
            star.classList.add('far');
        }
    });
}

// Reset Rating Stars
function resetRatingStars() {
    const starLabels = document.querySelectorAll('.star-label i');
    starLabels.forEach(star => {
        star.classList.remove('fas');
        star.classList.add('far');
    });
    document.querySelectorAll('input[name="rating"]').forEach(input => {
        input.checked = false;
    });
}

// Show Success Message
function showSuccessMessage() {
    const form = document.getElementById('testimonialForm');
    if (!form) return;
    
    const successMsg = document.createElement('div');
    successMsg.className = 'form-success-message';
    successMsg.style.cssText = 'background: #10b981; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;';
    successMsg.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <p style="margin: 0;">Thank you for your testimonial! We'll review it and publish it soon.</p>
    `;
    
    form.parentNode.insertBefore(successMsg, form);
    
    setTimeout(() => {
        successMsg.remove();
    }, 5000);
}

