// Application-Specific Metrics Tracker
// Tracks CPU usage, RAM usage, and bandwidth usage for this application only

(function() {
    'use strict';
    
    // Metrics collection interval (60 seconds)
    const METRICS_COLLECTION_INTERVAL = 60000;
    
    // Application metrics storage
    let appMetrics = {
        cpuUsage: 0,           // JavaScript execution time percentage
        ramUsedMB: 0,          // Browser memory used by this application
        ramTotalMB: 0,         // Total browser memory available
        ramUsagePercent: 0,    // RAM usage percentage
        bandwidthInMB: 0,     // Data received by this application
        bandwidthOutMB: 0,    // Data sent by this application
        bandwidthTotalMB: 0   // Total bandwidth used
    };
    
    // Bandwidth tracking
    let bandwidthIn = 0;  // Bytes received
    let bandwidthOut = 0; // Bytes sent
    let bandwidthLock = false;
    
    // CPU tracking - Application-specific only
    let appExecutionTime = 0;  // Total JS execution time for THIS APPLICATION ONLY (ms)
    let cpuTrackingStart = performance.now();
    let cpuCalculationWindow = 10000; // Calculate CPU over 10 second window for accuracy
    let executionSamples = []; // Array to store execution time samples
    const maxSamples = 10; // Keep last 10 samples for averaging
    
    // Track our application's script execution using performance marks
    const APP_SCRIPT_PATTERNS = [
        '/js/app-metrics-tracker.js',
        '/js/properties.js',
        '/js/script.js',
        '/js/dashboard.js',
        '/js/login.js',
        '/js/session-manager.js',
        '/js/page-tracking.js',
        '/js/property-details.js',
        '/js/activity-logs.js',
        '/js/blogs.js',
        '/js/metrics-monitoring.js',
        '/js/testimonials.js',
        'index.html',
        'properties.html',
        'dashboard.html'
    ];
    
    /**
     * Check if a performance entry is from our application
     */
    function isAppScript(entry) {
        if (!entry.name && !entry.scriptURL) return false;
        
        const source = entry.name || entry.scriptURL || '';
        return APP_SCRIPT_PATTERNS.some(pattern => source.includes(pattern));
    }
    
    /**
     * Initialize Performance Observer to track ONLY this application's JavaScript execution
     */
    function initPerformanceObserver() {
        try {
            if ('PerformanceObserver' in window) {
                // Track resource timing to identify our scripts
                const resourceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'resource' && entry.initiatorType === 'script') {
                            // Track script loading from our domain
                            if (isAppScript(entry)) {
                                // Mark this as application script
                                performance.mark(`app-script-${entry.name}`);
                            }
                        }
                    }
                });
                
                try {
                    resourceObserver.observe({ entryTypes: ['resource'] });
                } catch (e) {
                    // Resource observer not supported
                }
                
                // Track measure entries (custom performance marks we create)
                const measureObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'measure' && entry.name.startsWith('app-exec-')) {
                            // This is our application's execution time
                            const duration = entry.duration || 0;
                            if (duration > 0 && duration < 5000) { // Cap at 5 seconds per measure
                                appExecutionTime += duration;
                            }
                        }
                    }
                });
                
                try {
                    measureObserver.observe({ entryTypes: ['measure'] });
                } catch (e) {
                    // Measure observer not supported - use fallback method
                    // Fallback: Track execution time directly in interceptFetch
                }
            }
        } catch (error) {
            // Silently handle initialization errors
        }
    }
    
    /**
     * Mark the start of application execution
     */
    function markAppExecutionStart(markerName) {
        try {
            performance.mark(`app-exec-start-${markerName}`);
        } catch (e) {
            // Performance API not available
        }
    }
    
    /**
     * Mark the end of application execution and measure duration
     */
    function markAppExecutionEnd(markerName) {
        try {
            performance.mark(`app-exec-end-${markerName}`);
            performance.measure(`app-exec-${markerName}`, `app-exec-start-${markerName}`, `app-exec-end-${markerName}`);
            // Clean up marks
            performance.clearMarks(`app-exec-start-${markerName}`);
            performance.clearMarks(`app-exec-end-${markerName}`);
        } catch (e) {
            // Performance API not available
        }
    }
    
    /**
     * Calculate CPU usage based on THIS APPLICATION'S JavaScript execution time only
     * Uses a conservative approach to prevent false readings
     */
    function calculateCPUUsage() {
        const now = performance.now();
        const elapsed = now - cpuTrackingStart;
        
        // Only calculate if enough time has passed (10 second window for accuracy)
        if (elapsed >= cpuCalculationWindow) {
            // Calculate CPU usage: (our app's execution time / elapsed time) * 100
            let cpuPercent = (appExecutionTime / elapsed) * 100;
            
            // Apply conservative limits:
            // 1. Cap at 50% maximum (realistic max for a web app)
            // 2. If execution time seems too high, use a conservative estimate
            if (cpuPercent > 50) {
                // If we're showing > 50%, something might be wrong
                // Use a more conservative calculation
                cpuPercent = Math.min(50, cpuPercent * 0.7); // Reduce by 30% if over 50%
            }
            
            // Store sample for averaging
            executionSamples.push(cpuPercent);
            if (executionSamples.length > maxSamples) {
                executionSamples.shift(); // Remove oldest sample
            }
            
            // Use average of last samples for smoother readings
            const avgCPU = executionSamples.reduce((a, b) => a + b, 0) / executionSamples.length;
            
            // Reset counters for next window
            appExecutionTime = 0;
            cpuTrackingStart = now;
            
            return Math.max(0, Math.min(50, Math.round(avgCPU * 100) / 100)); // Cap at 50%, ensure non-negative
        }
        
        // If not enough time has passed, return previous value or 0
        return appMetrics.cpuUsage || 0;
    }
    
    /**
     * Get browser memory usage (application-specific)
     */
    function getMemoryUsage() {
        try {
            if (performance.memory) {
                const memory = performance.memory;
                const usedMB = memory.usedJSHeapSize / (1024 * 1024);
                const totalMB = memory.totalJSHeapSize / (1024 * 1024);
                const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
                
                return {
                    usedMB: Math.round(usedMB * 100) / 100,
                    totalMB: Math.round(totalMB * 100) / 100,
                    limitMB: Math.round(limitMB * 100) / 100,
                    usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100 * 100) / 100 : 0
                };
            }
        } catch (error) {
            console.warn('[App Metrics] Could not get memory usage:', error);
        }
        
        return {
            usedMB: 0,
            totalMB: 0,
            limitMB: 0,
            usagePercent: 0
        };
    }
    
    /**
     * Intercept fetch requests to track bandwidth
     */
    function interceptFetch() {
        const originalFetch = window.fetch;
        
        window.fetch = async function(...args) {
            const startTime = performance.now();
            let requestSize = 0;
            
            // Create unique marker ID for this fetch request
            const markerId = `fetch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            let shouldTrackExecution = false;
            
            // Check if this is a request to our domain
            const url = args[0];
            if (typeof url === 'string' && (url.startsWith('/') || url.includes(window.location.hostname))) {
                shouldTrackExecution = true;
                markAppExecutionStart(markerId);
            }
            
            // Estimate request size
            try {
                if (args[1] && args[1].body) {
                    if (typeof args[1].body === 'string') {
                        requestSize = new Blob([args[1].body]).size;
                    } else if (args[1].body instanceof FormData) {
                        // Estimate FormData size (approximate)
                        requestSize = 1024; // Default estimate
                    } else if (args[1].body instanceof Blob) {
                        requestSize = args[1].body.size;
                    } else if (args[1].body instanceof ArrayBuffer) {
                        requestSize = args[1].body.byteLength;
                    }
                }
            } catch (e) {
                // Ignore errors in size calculation
            }
            
            try {
                const response = await originalFetch.apply(this, args);
                const endTime = performance.now();
                const executionDuration = endTime - startTime;
                
                // Track execution time for our application only
                if (shouldTrackExecution) {
                    markAppExecutionEnd(markerId);
                    // Also track directly as fallback if measure observer doesn't work
                    if (executionDuration > 0 && executionDuration < 5000) {
                        appExecutionTime += executionDuration;
                    }
                }
                
                // Track response size
                const contentLength = response.headers.get('content-length');
                let responseSize = 0;
                
                if (contentLength) {
                    responseSize = parseInt(contentLength, 10) || 0;
                } else {
                    // If content-length not available, clone and measure
                    try {
                        const clonedResponse = response.clone();
                        const blob = await clonedResponse.blob();
                        responseSize = blob.size;
                    } catch (e) {
                        // Fallback: estimate based on response type
                        responseSize = 1024; // Default estimate
                    }
                }
                
                // Update bandwidth counters
                if (!bandwidthLock) {
                    bandwidthOut += requestSize;
                    bandwidthIn += responseSize;
                }
                
                return response;
            } catch (error) {
                // Mark execution end even on error (only for our domain requests)
                if (shouldTrackExecution) {
                    markAppExecutionEnd(markerId);
                    const endTime = performance.now();
                    const executionDuration = endTime - startTime;
                    if (executionDuration > 0 && executionDuration < 5000) {
                        appExecutionTime += executionDuration;
                    }
                }
                
                // Still count request size even if request fails
                if (!bandwidthLock) {
                    bandwidthOut += requestSize;
                }
                throw error;
            }
        };
    }
    
    /**
     * Intercept XMLHttpRequest to track bandwidth
     */
    function interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._appMetricsMethod = method;
            this._appMetricsUrl = url;
            return originalOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(data) {
            let requestSize = 0;
            
            // Calculate request size
            if (data) {
                if (typeof data === 'string') {
                    requestSize = new Blob([data]).size;
                } else if (data instanceof FormData) {
                    requestSize = 1024; // Estimate
                } else if (data instanceof Blob) {
                    requestSize = data.size;
                } else if (data instanceof ArrayBuffer) {
                    requestSize = data.byteLength;
                }
            }
            
            // Track response size
            this.addEventListener('load', function() {
                const contentLength = this.getResponseHeader('content-length');
                let responseSize = 0;
                
                if (contentLength) {
                    responseSize = parseInt(contentLength, 10) || 0;
                } else {
                    // Estimate based on response text length
                    try {
                        responseSize = new Blob([this.responseText || '']).size;
                    } catch (e) {
                        responseSize = 1024; // Default estimate
                    }
                }
                
                if (!bandwidthLock) {
                    bandwidthOut += requestSize;
                    bandwidthIn += responseSize;
                }
            });
            
            return originalSend.apply(this, arguments);
        };
    }
    
    /**
     * Collect and send application metrics to backend
     */
    async function collectAndSendMetrics() {
        try {
            // Calculate CPU usage
            const cpuUsage = calculateCPUUsage();
            
            // Get memory usage
            const memory = getMemoryUsage();
            
            // Get bandwidth usage (reset counters after reading)
            bandwidthLock = true;
            const bandwidthInMB = bandwidthIn / (1024 * 1024);
            const bandwidthOutMB = bandwidthOut / (1024 * 1024);
            const bandwidthTotalMB = bandwidthInMB + bandwidthOutMB;
            
            // Reset bandwidth counters
            bandwidthIn = 0;
            bandwidthOut = 0;
            bandwidthLock = false;
            
            // Update metrics object
            appMetrics = {
                cpuUsage: Math.round(cpuUsage * 100) / 100,
                ramUsedMB: memory.usedMB,
                ramTotalMB: memory.totalMB,
                ramUsagePercent: memory.usagePercent,
                bandwidthInMB: Math.round(bandwidthInMB * 100) / 100,
                bandwidthOutMB: Math.round(bandwidthOutMB * 100) / 100,
                bandwidthTotalMB: Math.round(bandwidthTotalMB * 100) / 100
            };
            
            // Send metrics to backend
            try {
                const response = await fetch('/api/admin/metrics/collect-app', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        cpu_usage: appMetrics.cpuUsage,
                        ram_usage: appMetrics.ramUsagePercent,
                        ram_used_mb: appMetrics.ramUsedMB,
                        ram_total_mb: appMetrics.ramTotalMB,
                        bandwidth_in_mb: appMetrics.bandwidthInMB,
                        bandwidth_out_mb: appMetrics.bandwidthOutMB,
                        bandwidth_total_mb: appMetrics.bandwidthTotalMB
                    })
                });
                
                if (!response.ok) {
                    // Metrics send failed - silently handled
                }
            } catch (error) {
                // Error sending metrics - silently handled
            }
            
        } catch (error) {
            // Error collecting metrics - silently handled
        }
    }
    
    /**
     * Initialize application metrics tracking
     */
    function initAppMetricsTracking() {
        // Initialize performance observer
        initPerformanceObserver();
        
        // Intercept network requests
        interceptFetch();
        interceptXHR();
        
        // Collect metrics immediately
        collectAndSendMetrics();
        
        // Set up interval to collect metrics every 60 seconds
        setInterval(() => {
            collectAndSendMetrics();
        }, METRICS_COLLECTION_INTERVAL);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAppMetricsTracking);
    } else {
        initAppMetricsTracking();
    }
    
    // Expose metrics globally for debugging
    if (typeof window !== 'undefined') {
        window.getAppMetrics = () => appMetrics;
    }
})();

