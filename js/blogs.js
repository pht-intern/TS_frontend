// Blogs Page JavaScript

// Blog data
let allBlogs = [];
let displayedBlogs = 100; // Show all blogs initially (increased from 6)
let currentCategory = 'all';
let currentTag = null;
let currentSort = 'latest';

// Show loading state
function showLoadingState() {
    const blogsGrid = document.getElementById('blogsGrid');
    
    if (blogsGrid) {
        blogsGrid.innerHTML = `
            <div class="blogs-loading" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--primary-color); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-gray); font-size: 22px;">Loading blogs...</p>
            </div>
        `;
    }
    
    // For latest blog, just update the text content instead of replacing the entire structure
    const latestBlogLink = document.getElementById('latestBlogLink');
    const latestBlogExcerpt = document.getElementById('latestBlogExcerpt');
    const latestBlogDate = document.getElementById('latestBlogDate');
    const latestBlogCategory = document.getElementById('latestBlogCategory');
    
    if (latestBlogLink) {
        latestBlogLink.textContent = 'Loading latest blog...';
        latestBlogLink.href = '#';
    }
    
    if (latestBlogExcerpt) {
        latestBlogExcerpt.textContent = 'Loading blog content...';
    }
    
    if (latestBlogDate) {
        latestBlogDate.textContent = '';
    }
    
    if (latestBlogCategory) {
        latestBlogCategory.textContent = 'Loading...';
    }
}

// Load Blogs from API (database only - no mock data)
async function loadBlogsFromAPI() {
    // Show loading state
    showLoadingState();
    
    try {
        // Fetch all blogs with pagination
        let allFetchedBlogs = [];
        let page = 1;
        let hasMore = true;
        const limit = 100; // Maximum allowed by API
        
        while (hasMore) {
            const response = await fetch(`/api/blogs?is_active=true&page=${page}&limit=${limit}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch blogs: ${response.status}`);
            }
            
            const data = await response.json();
            const blogs = data.items || [];
            
            if (blogs.length > 0) {
                // Normalize blog data
                const normalizedBlogs = blogs.map(blog => {
                    // Ensure tags is an array
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
                    
                    return {
                        id: blog.id,
                        title: blog.title || 'Untitled Blog',
                        excerpt: blog.excerpt || '',
                        content: blog.content || '',
                        category: blog.category || 'general',
                        tags: tags,
                        image: blog.image_url || blog.image || '/images/img1.jpg',
                        image_url: blog.image_url || blog.image || '/images/img1.jpg',
                        author: blog.author || 'Tirumakudalu Properties',
                        views: blog.views || 0,
                        is_featured: blog.is_featured || false,
                        is_active: blog.is_active !== undefined ? blog.is_active : true,
                        date: blog.created_at || blog.date || new Date().toISOString(),
                        created_at: blog.created_at || blog.date || new Date().toISOString(),
                        updated_at: blog.updated_at || blog.created_at || new Date().toISOString()
                    };
                });
                
                allFetchedBlogs = allFetchedBlogs.concat(normalizedBlogs);
            }
            
            // Check if there are more pages
            hasMore = page < (data.pages || 1) && blogs.length === limit;
            page++;
        }
        
        // Use only database data - no fallback to mock data
        allBlogs = allFetchedBlogs;
        
        // Sort blogs by date (latest first)
        allBlogs.sort((a, b) => {
            const dateA = new Date(a.created_at || a.date || 0);
            const dateB = new Date(b.created_at || b.date || 0);
            return dateB - dateA;
        });
        
        // Render blogs
        renderLatestBlog();
        renderBlogs();
        renderRecentPosts();
        renderArchive();
        updateCategoryFilters();
        updateTagsCloud();
        
    } catch (error) {
        console.error('Error loading blogs from API:', error);
        // Show error message instead of mock data
        allBlogs = [];
        
        const blogsGrid = document.getElementById('blogsGrid');
        if (blogsGrid) {
            blogsGrid.innerHTML = `
                <div class="blogs-empty" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: var(--primary-color); margin-bottom: 1rem;"></i>
                    <h3>Unable to Load Blogs</h3>
                    <p>There was an error loading blogs from the server. Please try again later.</p>
                </div>
            `;
        }
        
        // Also update latest blog section
        renderLatestBlog();
        renderRecentPosts();
    }
}

// Update tags cloud with dynamic tags from blogs
function updateTagsCloud() {
    const tagsCloud = document.getElementById('tagsCloud');
    if (!tagsCloud) return;
    
    // Extract all unique tags from blogs
    const tagCounts = new Map();
    allBlogs.forEach(blog => {
        if (blog.tags && Array.isArray(blog.tags)) {
            blog.tags.forEach(tag => {
                if (tag) {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                }
            });
        }
    });
    
    // If we have tags from blogs, update the tags cloud
    if (tagCounts.size > 0) {
        // Sort tags by count (most popular first)
        const sortedTags = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12) // Show top 12 tags
            .map(([tag]) => tag);
        
        // Update tags cloud
        tagsCloud.innerHTML = sortedTags.map(tag => `
            <a href="#" class="tag-link" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</a>
        `).join('');
        
        // Re-attach event listeners for new tag links
        attachTagListeners();
    }
}

// Attach event listeners to tag links
function attachTagListeners() {
    const tagLinks = document.querySelectorAll('.tag-link[data-tag]');
    tagLinks.forEach(link => {
        // Remove any existing listeners by removing and re-adding the element
        const parent = link.parentNode;
        const newLink = link.cloneNode(true);
        parent.replaceChild(newLink, link);
        
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            document.querySelectorAll('.tag-link[data-tag]').forEach(l => l.classList.remove('active'));
            newLink.classList.add('active');
            
            // Update current tag
            currentTag = newLink.getAttribute('data-tag');
            currentCategory = 'all'; // Reset category filter
            
            // Reset category filter buttons active state
            const categoryFilterBtns = document.querySelectorAll('.category-filter-btn[data-category]');
            categoryFilterBtns.forEach(btn => {
                if (btn.getAttribute('data-category') === 'all') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Reset displayed count
            displayedBlogs = 100; // Show all blogs when filtering by tag
            
            // Re-render
            renderBlogs();
        });
    });
}

// Mock blog data (for demonstration until API is ready)
function getMockBlogs() {
    return [
        {
            id: 1,
            title: "Top 10 Real Estate Investment Tips for 2025",
            excerpt: "Discover the latest strategies and insights for making smart real estate investments in Bengaluru. Learn about market trends, property valuation, and investment opportunities.",
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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
            content: "Full content here...",
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

// Render latest blog
function renderLatestBlog() {
    const latestBlogSection = document.getElementById('latestBlogSection');
    if (!latestBlogSection) return;
    
    // Get all elements with null checks
    const latestBlogImage = document.getElementById('latestBlogImage');
    const latestBlogCategory = document.getElementById('latestBlogCategory');
    const latestBlogDate = document.getElementById('latestBlogDate');
    const latestBlogTitle = document.getElementById('latestBlogTitle');
    const latestBlogExcerpt = document.getElementById('latestBlogExcerpt');
    const latestBlogReadMore = document.getElementById('latestBlogReadMore');
    const latestBlogLink = document.getElementById('latestBlogLink');
    
    // If no blogs, show a message
    if (allBlogs.length === 0) {
        if (latestBlogImage) {
            latestBlogImage.src = '/images/img1.jpg';
            latestBlogImage.alt = 'No blogs available';
        }
        
        if (latestBlogCategory) {
            latestBlogCategory.textContent = 'General';
        }
        
        if (latestBlogDate) {
            latestBlogDate.textContent = '';
        }
        
        if (latestBlogTitle) {
            const titleLink = latestBlogTitle.querySelector('a') || latestBlogLink;
            if (titleLink) {
                titleLink.textContent = 'No blogs available yet';
                titleLink.href = '#';
                titleLink.style.pointerEvents = 'none';
                titleLink.style.cursor = 'default';
            }
        }
        
        if (latestBlogExcerpt) {
            latestBlogExcerpt.textContent = 'Check back soon for new blog posts.';
        }
        
        if (latestBlogReadMore) {
            latestBlogReadMore.style.display = 'none';
        }
        
        return;
    }
    
    const latestBlog = allBlogs[0];
    
    // Update elements only if they exist
    if (latestBlogImage) {
        latestBlogImage.src = latestBlog.image || latestBlog.image_url || '/images/img1.jpg';
        latestBlogImage.alt = latestBlog.title || 'Latest Blog';
    }
    
    if (latestBlogCategory) {
        latestBlogCategory.textContent = formatCategory(latestBlog.category || 'general');
    }
    
    if (latestBlogDate) {
        latestBlogDate.textContent = formatDate(latestBlog.date || latestBlog.created_at);
    }
    
    if (latestBlogTitle) {
        const titleLink = latestBlogTitle.querySelector('a');
        if (titleLink) {
            titleLink.textContent = latestBlog.title || 'Untitled Blog';
            titleLink.href = `/blog-details.html?id=${latestBlog.id}`;
            titleLink.style.pointerEvents = 'auto';
            titleLink.style.cursor = 'pointer';
        }
    }
    
    // Also update the latestBlogLink if it exists separately
    if (latestBlogLink && !latestBlogTitle) {
        latestBlogLink.textContent = latestBlog.title || 'Untitled Blog';
        latestBlogLink.href = `/blog-details.html?id=${latestBlog.id}`;
        latestBlogLink.style.pointerEvents = 'auto';
        latestBlogLink.style.cursor = 'pointer';
    }
    
    if (latestBlogExcerpt) {
        latestBlogExcerpt.textContent = latestBlog.excerpt || '';
    }
    
    if (latestBlogReadMore) {
        latestBlogReadMore.href = `/blog-details.html?id=${latestBlog.id}`;
        latestBlogReadMore.style.display = 'inline-block';
    }
    
    if (latestBlogLink && latestBlogTitle) {
        latestBlogLink.href = `/blog-details.html?id=${latestBlog.id}`;
    }
}

// Format category name
function formatCategory(category) {
    if (!category) return 'General';
    return category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Render blogs grid
function renderBlogs() {
    const blogsGrid = document.getElementById('blogsGrid');
    if (!blogsGrid) return;
    
    // Filter blogs
    let filteredBlogs = filterBlogs();
    
    // Sort blogs
    filteredBlogs = sortBlogs(filteredBlogs);
    
    // Get blogs to display
    const blogsToDisplay = filteredBlogs.slice(0, displayedBlogs);
    
    if (blogsToDisplay.length === 0) {
        blogsGrid.innerHTML = `
            <div class="blogs-empty">
                <i class="fas fa-blog"></i>
                <h3>No blogs found</h3>
                <p>Try selecting a different category or tag.</p>
            </div>
        `;
        return;
    }
    
    blogsGrid.innerHTML = blogsToDisplay.map(blog => `
        <article class="blog-card">
            <div class="blog-card-image">
                <img src="${escapeHtml(blog.image || blog.image_url || '/images/img1.jpg')}" alt="${escapeHtml(blog.title)}">
                <div class="blog-card-overlay">
                    <a href="/blog-details.html?id=${blog.id}" class="blog-card-link">
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
            <div class="blog-card-content">
                <div class="blog-card-meta">
                    <span class="blog-category">${escapeHtml(formatCategory(blog.category || 'general'))}</span>
                    <span class="blog-date">${escapeHtml(formatDate(blog.date || blog.created_at))}</span>
                </div>
                <h3 class="blog-card-title">
                    <a href="/blog-details.html?id=${blog.id}">${escapeHtml(blog.title)}</a>
                </h3>
                <p class="blog-card-excerpt">${escapeHtml(blog.excerpt || '')}</p>
                <button class="blog-views-btn" data-blog-id="${blog.id}" data-views="${blog.views || 0}">
                    <i class="fas fa-eye"></i>
                    <span class="views-count">${blog.views || 0}</span>
                    <span class="views-label">Views</span>
                </button>
                <div class="blog-card-footer">
                    <a href="/blog-details.html?id=${blog.id}" class="blog-read-more">
                        Read More <i class="fas fa-arrow-right"></i>
                    </a>
                    <div class="blog-card-stats">
                        <span><i class="fas fa-eye"></i> ${blog.views || 0}</span>
                    </div>
                </div>
            </div>
        </article>
    `).join('');
    
    // Attach event listeners to views buttons
    attachViewsButtonListeners();
    
    // Update load more button
    updateLoadMoreButton(filteredBlogs.length);
}

// Attach event listeners to views buttons
function attachViewsButtonListeners() {
    const viewsButtons = document.querySelectorAll('.blog-views-btn');
    viewsButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Add visual feedback on click
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Optional: Navigate to blog details page on click
            const blogId = this.getAttribute('data-blog-id');
            if (blogId) {
                // Small delay for visual feedback before navigation
                setTimeout(() => {
                    window.location.href = `/blog-details.html?id=${blogId}`;
                }, 150);
            }
        });
    });
}

// Filter blogs
function filterBlogs() {
    let filtered = [...allBlogs];
    
    // Filter by category
    if (currentCategory !== 'all') {
        filtered = filtered.filter(blog => blog.category === currentCategory);
    }
    
    // Filter by tag
    if (currentTag) {
        filtered = filtered.filter(blog => 
            blog.tags && blog.tags.includes(currentTag)
        );
    }
    
    return filtered;
}

// Sort blogs
function sortBlogs(blogs) {
    const sorted = [...blogs];
    
    switch (currentSort) {
        case 'latest':
            sorted.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));
            break;
        case 'popular':
            sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    
    return sorted;
}

// Render recent posts in sidebar
function renderRecentPosts() {
    const recentPostsList = document.getElementById('recentPostsList');
    if (!recentPostsList) return;
    
    const recentPosts = allBlogs.slice(0, 5);
    
    if (recentPosts.length === 0) {
        recentPostsList.innerHTML = '<li class="no-posts">No recent posts</li>';
        return;
    }
    
    recentPostsList.innerHTML = recentPosts.map(blog => `
        <li class="recent-post-item">
            <a href="/blog-details.html?id=${blog.id}" class="recent-post-link">
                <div class="recent-post-image">
                    <img src="${escapeHtml(blog.image || blog.image_url || '/images/img1.jpg')}" alt="${escapeHtml(blog.title)}">
                </div>
                <div class="recent-post-info">
                    <h4 class="recent-post-title">${escapeHtml(blog.title)}</h4>
                    <span class="recent-post-date">${escapeHtml(formatDate(blog.date || blog.created_at))}</span>
                </div>
            </a>
        </li>
    `).join('');
}

// Render archive in sidebar
function renderArchive() {
    const archiveList = document.getElementById('archiveList');
    if (!archiveList) return;
    
    // Group blogs by month/year
    const archiveMap = new Map();
    
    allBlogs.forEach(blog => {
        const date = new Date(blog.created_at || blog.date);
        if (isNaN(date.getTime())) return; // Skip invalid dates
        
        const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!archiveMap.has(monthYear)) {
            archiveMap.set(monthYear, 0);
        }
        archiveMap.set(monthYear, archiveMap.get(monthYear) + 1);
    });
    
    // Convert to array and sort (newest first)
    const archiveArray = Array.from(archiveMap.entries())
        .sort((a, b) => {
            const dateA = new Date(a[0]);
            const dateB = new Date(b[0]);
            return dateB - dateA;
        })
        .slice(0, 12); // Show last 12 months
    
    if (archiveArray.length === 0) {
        archiveList.innerHTML = '<li class="no-archive">No archive data</li>';
        return;
    }
    
    archiveList.innerHTML = archiveArray.map(([monthYear, count]) => `
        <li class="archive-item">
            <a href="#" class="archive-link" data-month="${monthYear}">
                ${escapeHtml(monthYear)}
                <span class="archive-count">(${count})</span>
            </a>
        </li>
    `).join('');
}

// Update category filters based on available blogs
function updateCategoryFilters() {
    // Extract unique categories from blogs
    const categories = new Set();
    allBlogs.forEach(blog => {
        if (blog.category) {
            categories.add(blog.category);
        }
    });
    
    // Update category filter buttons if needed
    // This ensures only categories with blogs are shown
    const categoryFilters = document.getElementById('categoryFilters');
    if (categoryFilters && categories.size > 0) {
        // Keep the existing "All Blogs" button and update others
        const existingButtons = categoryFilters.querySelectorAll('.category-filter-btn[data-category]');
        existingButtons.forEach(btn => {
            const category = btn.getAttribute('data-category');
            if (category !== 'all' && !categories.has(category)) {
                // Hide categories that have no blogs
                btn.style.display = 'none';
            } else {
                btn.style.display = 'inline-block';
            }
        });
    }
}

// Update load more button
function updateLoadMoreButton(totalFiltered) {
    const loadMoreBtn = document.getElementById('loadMoreBlogsBtn');
    if (!loadMoreBtn) return;
    
    const loadMoreContainer = loadMoreBtn.closest('.blogs-load-more');
    if (!loadMoreContainer) return;
    
    if (displayedBlogs >= totalFiltered) {
        loadMoreContainer.style.display = 'none';
    } else {
        loadMoreContainer.style.display = 'block';
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load blogs from API
    await loadBlogsFromAPI();
    
    // Category filter buttons
    const categoryFilterBtns = document.querySelectorAll('.category-filter-btn[data-category]');
    categoryFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            categoryFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update current category
            currentCategory = btn.getAttribute('data-category');
            currentTag = null; // Reset tag filter
            
            // Reset displayed count
            displayedBlogs = 100; // Show all blogs when filtering by category
            
            // Re-render
            renderBlogs();
        });
    });
    
    // View All Categories button
    const viewAllBtn = document.getElementById('viewAllCategories');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => {
            // Reset to show all blogs
            categoryFilterBtns.forEach(b => b.classList.remove('active'));
            const allBtn = document.querySelector('.category-filter-btn[data-category="all"]');
            if (allBtn) {
                allBtn.classList.add('active');
            }
            currentCategory = 'all';
            currentTag = null;
            displayedBlogs = 100; // Show all blogs
            renderBlogs();
        });
    }
    
    // Tag filter links - attach listeners to initial tags and dynamic tags
    attachTagListeners();
    
    // Sort select
    const sortSelect = document.getElementById('sortBlogs');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            displayedBlogs = 100; // Show all blogs when sorting
            renderBlogs();
        });
    }
    
    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBlogsBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayedBlogs += 6;
            renderBlogs();
        });
    }
});

