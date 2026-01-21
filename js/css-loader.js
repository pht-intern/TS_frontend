// CSS Loader - Loads non-critical CSS asynchronously
(function() {
    'use strict';
    
    // Function to load CSS asynchronously
    function loadCSS(href, media) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        if (media) link.media = media;
        document.head.appendChild(link);
    }
    
    // Load non-critical CSS after page load
    window.addEventListener('load', function() {
        // Main stylesheet
        loadCSS('/css/style.css');
    });
})();
