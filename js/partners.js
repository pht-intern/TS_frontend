// Partners Page JavaScript

// Partners data
const partners = [
    { name: "ADARSH BUILDERS", url: "#" },
    { name: "CHAITANYA BUILDERS", url: "#" },
    { name: "PURAVANKARA BUILDERS", url: "#" },
    { name: "PROVIDENT", url: "#" },
    { name: "MANTRI BUILDERS", url: "#" },
    { name: "ELEGANCE INFRA", url: "#" },
    { name: "PRESTIGE CONSTRUCTIONS", url: "#" },
    { name: "SOBHA BUILDERS", url: "#" },
    { name: "TOTAL ENVIRONMENT", url: "#" },
    { name: "BRIGADE ENTERPRISES", url: "#" },
    { name: "FLOW REALTY", url: "#" },
    { name: "XANADU REALTY", url: "#" },
    { name: "PHOENIX BUILDERS", url: "#" },
    { name: "KARLE INFRA", url: "#" },
    { name: "SALARPURIA SATTVA BUILDERS", url: "#" },
    { name: "SHAPOORJEE PALLONJI BUILDERS", url: "#" },
    { name: "TATA HOUSING", url: "#" },
    { name: "MAHINDRA LIFE SPACE", url: "#" },
    { name: "SHRI RAM PROPERTIES", url: "#" },
    { name: "VAISHNAVI GROUP", url: "#" },
    { name: "CENTURY REAL ESTATE", url: "#" },
    { name: "L & T REALTY", url: "#" },
    { name: "NAMBIAR BUILDERS", url: "#" },
    { name: "FORTIUS INFRA", url: "#" },
    { name: "EMBASSY BUILDERS", url: "#" },
    { name: "KONCEPT AMBIENCE", url: "#" },
    { name: "VALMARK", url: "#" },
    { name: "SVAMITVA BUILDERS", url: "#" }
];

document.addEventListener('DOMContentLoaded', () => {
    renderPartners();
    initPartnersScrollAnimation();
});

// Initialize scroll animations for partners page
function initPartnersScrollAnimation() {
    const sectionsToAnimate = document.querySelectorAll('.channel-partners, .partners-grid-section');
    
    if (sectionsToAnimate.length > 0) {
        sectionsToAnimate.forEach(section => {
            section.classList.add('section-coming-into-view');
        });
        
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('section-visible');
                    entry.target.classList.remove('section-coming-into-view');
                } else if (window.scrollY < entry.target.offsetTop) {
                    entry.target.classList.remove('section-visible');
                    entry.target.classList.add('section-coming-into-view');
                }
            });
        }, observerOptions);
        
        sectionsToAnimate.forEach(section => {
            sectionObserver.observe(section);
        });
    }
}

// Render Partners
function renderPartners() {
    const grid = document.getElementById('partnersGrid');
    if (!grid) return;

    grid.innerHTML = partners.map(partner => `
        <div class="partner-card">
            <div class="partner-info">
                <h4 class="partner-name">${partner.name}</h4>
                <a href="${partner.url}" class="partner-visit-btn" target="_blank" rel="noopener noreferrer">
                    <span>VISIT</span>
                    <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        </div>
    `).join('');
}

