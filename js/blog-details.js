// Blog Details Page JavaScript

// Store current blog ID globally
let currentBlogId = null;
let allBlogs = [];

// Load Blog from API by ID
async function loadBlogFromAPI(blogId) {
    try {
        const response = await fetch(`/api/blogs/${blogId}`);
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Failed to fetch blog';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        const blog = await response.json();
        // Normalize blog data
        return {
            ...blog,
            date: blog.created_at || blog.date,
            image: blog.image_url || blog.image || '/images/img1.jpg'
        };
    } catch (error) {
        console.error('Error loading blog from API:', error);
        // Fallback to mock data
        return getMockBlogById(blogId);
    }
}

// Load all blogs for related posts
async function loadAllBlogs() {
    try {
        const response = await fetch('/api/blogs?is_active=true&limit=100');
        if (response.ok) {
            const data = await response.json();
            if (data.items) {
                allBlogs = data.items.map(blog => ({
                    ...blog,
                    date: blog.created_at || blog.date,
                    image: blog.image_url || blog.image || '/images/img1.jpg'
                }));
            } else if (Array.isArray(data)) {
                allBlogs = data.map(blog => ({
                    ...blog,
                    date: blog.created_at || blog.date,
                    image: blog.image_url || blog.image || '/images/img1.jpg'
                }));
            }
        } else {
            allBlogs = getMockBlogs();
        }
    } catch (error) {
        console.error('Error loading blogs:', error);
        allBlogs = getMockBlogs();
    }
}

// Get mock blog by ID
function getMockBlogById(blogId) {
    const blogs = getMockBlogs();
    return blogs.find(blog => blog.id === parseInt(blogId));
}

// Get mock blogs (same as blogs.js)
function getMockBlogs() {
    return [
        {
            id: 1,
            title: "Top 10 Real Estate Investment Tips for 2025",
            excerpt: "Discover the latest strategies and insights for making smart real estate investments in Bengaluru. Learn about market trends, property valuation, and investment opportunities.",
            content: `<p>Real estate investment in Bengaluru has become increasingly attractive in 2025, with the city's growing economy and expanding infrastructure. Whether you're a first-time investor or looking to expand your portfolio, these tips will help you make informed decisions.</p>
            
            <h3>1. Research the Market Thoroughly</h3>
            <p>Before investing, conduct comprehensive market research. Understand the current property prices, rental yields, and future development plans in the area. Bengaluru's real estate market varies significantly across different localities.</p>
            
            <h3>2. Location is Key</h3>
            <p>Choose locations with good connectivity, proximity to IT hubs, schools, hospitals, and shopping centers. Areas like Whitefield, Electronic City, and Koramangala continue to show strong growth potential.</p>
            
            <h3>3. Consider Rental Yield</h3>
            <p>For rental properties, aim for a yield of at least 3-4% annually. Calculate the rental yield by dividing annual rental income by property value and multiplying by 100.</p>
            
            <h3>4. Check Legal Documentation</h3>
            <p>Always verify property documents, including title deeds, encumbrance certificates, and approvals from relevant authorities. Work with reputable builders and legal advisors.</p>
            
            <h3>5. Plan Your Finances</h3>
            <p>Secure pre-approved loans and understand all costs involved, including registration, stamp duty, and maintenance charges. Factor in at least 10-15% additional costs beyond the property price.</p>
            
            <h3>6. Consider Future Appreciation</h3>
            <p>Look for properties in areas with planned infrastructure projects, metro connectivity, or commercial development. These factors typically drive long-term appreciation.</p>
            
            <h3>7. Diversify Your Portfolio</h3>
            <p>Don't put all your money in one property. Consider diversifying across different locations and property types (residential, commercial, plots).</p>
            
            <h3>8. Understand Tax Benefits</h3>
            <p>Take advantage of tax deductions available for home loans, including principal repayment under Section 80C and interest deduction under Section 24(b).</p>
            
            <h3>9. Work with Professionals</h3>
            <p>Engage with experienced real estate agents, property consultants, and legal advisors. Their expertise can help you avoid costly mistakes.</p>
            
            <h3>10. Think Long-Term</h3>
            <p>Real estate is typically a long-term investment. Be patient and avoid making hasty decisions based on short-term market fluctuations.</p>
            
            <p>By following these tips and working with trusted partners like Tirumakudalu Properties, you can make smart real estate investment decisions in Bengaluru's dynamic market.</p>`,
            category: "investment",
            tags: ["investment", "bengaluru", "property-tips"],
            image: "/images/img1.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-15",
            created_at: "2025-01-15T10:00:00",
            views: 1250,
            is_featured: true
        },
        {
            id: 2,
            title: "Understanding Property Management in Bengaluru",
            excerpt: "A comprehensive guide to property management services, including maintenance, tenant relations, and maximizing your property's value.",
            content: `<p>Property management is a crucial aspect of real estate investment that many property owners overlook. Effective property management can significantly increase your property's value and rental income while reducing stress and maintenance issues.</p>
            
            <h3>What is Property Management?</h3>
            <p>Property management involves overseeing and maintaining real estate properties on behalf of owners. This includes finding tenants, collecting rent, handling maintenance, and ensuring compliance with local regulations.</p>
            
            <h3>Key Services Offered</h3>
            <ul>
                <li>Tenant screening and selection</li>
                <li>Rent collection and financial reporting</li>
                <li>Property maintenance and repairs</li>
                <li>Legal compliance and documentation</li>
                <li>Regular property inspections</li>
            </ul>
            
            <p>At Tirumakudalu Properties, we provide comprehensive property management services to help you maximize your investment returns.</p>`,
            category: "property-management",
            tags: ["property-management", "bengaluru", "tips"],
            image: "/images/img2.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-12",
            created_at: "2025-01-12T10:00:00",
            views: 980,
            is_featured: false
        },
        {
            id: 3,
            title: "Market Trends: Real Estate in Bengaluru 2025",
            excerpt: "An in-depth analysis of the current real estate market in Bengaluru, including price trends, popular areas, and future predictions.",
            content: `<p>The Bengaluru real estate market in 2025 shows promising growth trends, driven by the city's status as India's IT capital and continued infrastructure development.</p>
            
            <h3>Current Market Overview</h3>
            <p>Bengaluru's real estate market has shown resilience and steady growth, with property prices appreciating by an average of 5-7% annually in prime locations.</p>
            
            <h3>Popular Areas</h3>
            <p>Areas like Whitefield, Electronic City, and North Bengaluru continue to attract investors due to their proximity to IT parks and upcoming infrastructure projects.</p>`,
            category: "market-trends",
            tags: ["market-trends", "bengaluru", "market-analysis"],
            image: "/images/img3.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-10",
            created_at: "2025-01-10T10:00:00",
            views: 1520,
            is_featured: false
        },
        {
            id: 4,
            title: "Rental Property Guide: Finding the Perfect Tenant",
            excerpt: "Learn how to find reliable tenants, conduct background checks, and create effective rental agreements for your properties.",
            content: `<p>Finding the right tenant is crucial for a successful rental property investment. This guide will help you navigate the tenant selection process effectively.</p>`,
            category: "real-estate",
            tags: ["rental", "property-tips", "bengaluru"],
            image: "/images/img4.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-08",
            created_at: "2025-01-08T10:00:00",
            views: 875,
            is_featured: false
        },
        {
            id: 5,
            title: "Buying Your First Home: A Complete Guide",
            excerpt: "Everything you need to know about buying your first home, from financing options to legal requirements and property inspection tips.",
            content: `<p>Buying your first home is one of life's most significant milestones. This comprehensive guide will walk you through every step of the process.</p>`,
            category: "tips",
            tags: ["buying-guide", "property-tips", "investment"],
            image: "/images/img5.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-05",
            created_at: "2025-01-05T10:00:00",
            views: 2100,
            is_featured: false
        },
        {
            id: 6,
            title: "New Property Developments in Bengaluru",
            excerpt: "Explore the latest property developments and upcoming projects in Bengaluru, including luxury apartments and commercial spaces.",
            content: `<p>Bengaluru continues to see exciting new property developments across residential and commercial segments.</p>`,
            category: "news",
            tags: ["bengaluru", "apartments", "news"],
            image: "/images/img1.jpg",
            author: "Tirumakudalu Properties",
            date: "2025-01-03",
            created_at: "2025-01-03T10:00:00",
            views: 1340,
            is_featured: false
        },
        {
            id: 7,
            title: "Property Tax Guide for Bengaluru Homeowners",
            excerpt: "Understanding property tax obligations, payment procedures, and how to save on property taxes in Bengaluru.",
            content: `<p>Property tax is an important annual obligation for all property owners in Bengaluru. Understanding how it works can help you plan your finances better.</p>`,
            category: "tips",
            tags: ["property-tips", "bengaluru", "tax"],
            image: "/images/img2.jpg",
            author: "Tirumakudalu Properties",
            date: "2024-12-28",
            created_at: "2024-12-28T10:00:00",
            views: 950,
            is_featured: false
        },
        {
            id: 8,
            title: "Selling Your Property: Maximizing Value",
            excerpt: "Tips and strategies for selling your property at the best price, including staging, marketing, and negotiation techniques.",
            content: `<p>Selling a property requires careful planning and execution to maximize your returns. Here are proven strategies to help you get the best price.</p>`,
            category: "real-estate",
            tags: ["selling", "property-tips", "market-analysis"],
            image: "/images/img3.jpg",
            author: "Tirumakudalu Properties",
            date: "2024-12-25",
            created_at: "2024-12-25T10:00:00",
            views: 1100,
            is_featured: false
        }
    ];
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format category name
function formatCategory(category) {
    return category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render blog header
function renderBlogHeader(blog) {
    const blogHeader = document.getElementById('blogHeader');
    if (!blogHeader) return;
    
    blogHeader.innerHTML = `
        <div class="blog-header-meta">
            <span class="blog-category">${escapeHtml(formatCategory(blog.category))}</span>
            <span class="blog-date">${escapeHtml(formatDate(blog.date || blog.created_at))}</span>
        </div>
        <h1 class="blog-title">${escapeHtml(blog.title)}</h1>
        <div class="blog-author-info">
            <span class="blog-author">
                <i class="fas fa-user"></i> ${escapeHtml(blog.author || 'Tirumakudalu Properties')}
            </span>
            <span class="blog-views">
                <i class="fas fa-eye"></i> ${blog.views || 0} views
            </span>
        </div>
    `;
}

// Render blog featured image
function renderBlogImage(blog) {
    const blogImage = document.getElementById('blogFeaturedImage');
    if (!blogImage) return;
    
    blogImage.innerHTML = `
        <img src="${escapeHtml(blog.image || blog.image_url || '/images/img1.jpg')}" alt="${escapeHtml(blog.title)}">
    `;
}

// Render blog content
function renderBlogContent(blog) {
    const blogContent = document.getElementById('blogContent');
    if (!blogContent) return;
    
    // If content is HTML, use it directly; otherwise wrap in paragraph
    if (blog.content && blog.content.includes('<')) {
        blogContent.innerHTML = blog.content;
    } else {
        blogContent.innerHTML = `<p>${escapeHtml(blog.content || blog.excerpt || 'Content coming soon...')}</p>`;
    }
}

// Render blog tags
function renderBlogTags(blog) {
    const tagsSection = document.getElementById('blogTagsSection');
    const tagsList = document.getElementById('blogTagsList');
    if (!tagsSection || !tagsList) return;
    
    if (!blog.tags || blog.tags.length === 0) {
        tagsSection.style.display = 'none';
        return;
    }
    
    tagsSection.style.display = 'block';
    tagsList.innerHTML = blog.tags.map(tag => `
        <a href="/blogs.html" class="blog-tag">${escapeHtml(tag)}</a>
    `).join('');
}


// Update page title
function updatePageTitle(blog) {
    document.title = `${blog.title} - Tirumakudalu Properties`;
}

// Increment blog views
async function incrementBlogViews(blogId) {
    try {
        // Check if we've already incremented views for this blog in this session
        const viewedBlogs = JSON.parse(sessionStorage.getItem('viewedBlogs') || '[]');
        if (viewedBlogs.includes(blogId)) {
            // Already viewed in this session, skip increment
            return;
        }
        
        // Increment views via API
        const response = await fetch(`/api/blogs/${blogId}/increment-views`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Mark as viewed in this session
            viewedBlogs.push(blogId);
            sessionStorage.setItem('viewedBlogs', JSON.stringify(viewedBlogs));
            
            // Update the displayed views count if available
            const viewsElement = document.querySelector('.blog-views');
            if (viewsElement && data.views !== undefined) {
                viewsElement.innerHTML = `<i class="fas fa-eye"></i> ${data.views} views`;
            }
            
            return data.views;
        }
    } catch (error) {
        console.error('Error incrementing blog views:', error);
        // Don't throw error, just log it - view tracking is not critical
    }
    return null;
}

// Load and render blog
async function loadAndRenderBlog() {
    // Get blog ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const blogId = urlParams.get('id');
    
    if (!blogId) {
        // Redirect to blogs page if no ID
        window.location.href = '/blogs.html';
        return;
    }
    
    currentBlogId = blogId;
    
    // Show loading state
    const blogHeader = document.getElementById('blogHeader');
    if (blogHeader) {
        blogHeader.innerHTML = '<p>Loading blog...</p>';
    }
    
    // Load all blogs first for related posts
    await loadAllBlogs();
    
    // Load current blog
    const blog = await loadBlogFromAPI(blogId);
    
    if (!blog) {
        // Blog not found, redirect to blogs page
        alert('Blog not found');
        window.location.href = '/blogs.html';
        return;
    }
    
    // Increment views (async, don't wait for it)
    incrementBlogViews(blogId).then(updatedViews => {
        if (updatedViews !== null) {
            // Update the blog object with new views count
            blog.views = updatedViews;
            // Re-render header to show updated views
            renderBlogHeader(blog);
        }
    });
    
    // Render blog content
    renderBlogHeader(blog);
    renderBlogImage(blog);
    renderBlogContent(blog);
    renderBlogTags(blog);
    updatePageTitle(blog);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAndRenderBlog();
});

