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
    
    // CPU tracking
    let jsExecutionTime = 0;  // Total JS execution time in ms
    let totalTime = 0;        // Total time window in ms
    let cpuTrackingStart = performance.now();
    
    // Performance observer for tracking JavaScript execution
    let performanceObserver = null;
    
    /**
     * Initialize Performance Observer to track JavaScript execution time
     */
    function initPerformanceObserver() {
        try {
            if ('PerformanceObserver' in window) {
                // Track long tasks (JavaScript execution > 50ms)
                performanceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'longtask') {
                            // Track long-running JavaScript tasks
                            jsExecutionTime += entry.duration;
                        }
                    }
                });
                
                try {
                    performanceObserver.observe({ entryTypes: ['longtask'] });
                } catch (e) {
                    // Longtask API might not be supported, fallback to measuring main thread blocking
                    console.warn('[App Metrics] Longtask API not supported, using fallback method');
                }
            }
        } catch (error) {
            console.warn('[App Metrics] Could not initialize Performance Observer:', error);
        }
    }
    
    /**
     * Calculate CPU usage based on JavaScript execution time
     */
    function calculateCPUUsage() {
        const now = performance.now();
        const elapsed = now - cpuTrackingStart;
        
        if (elapsed >= 1000) { // Calculate every second
            // Estimate CPU usage based on JS execution time
            // If we spent 50ms executing JS in a 1000ms window, that's ~5% CPU
            const cpuPercent = Math.min(100, (jsExecutionTime / elapsed) * 100);
            
            // Reset counters
            jsExecutionTime = 0;
            cpuTrackingStart = now;
            
            return cpuPercent;
        }
        
        // Use previous calculation if not enough time has passed
        return appMetrics.cpuUsage;
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
                
                if (response.ok) {
                    console.log('[App Metrics] Metrics sent successfully:', appMetrics);
                } else {
                    console.warn('[App Metrics] Failed to send metrics:', response.status);
                }
            } catch (error) {
                console.warn('[App Metrics] Error sending metrics:', error);
            }
            
        } catch (error) {
            console.error('[App Metrics] Error collecting metrics:', error);
        }
    }
    
    /**
     * Initialize application metrics tracking
     */
    function initAppMetricsTracking() {
        console.log('[App Metrics] Initializing application-specific metrics tracking...');
        
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
        
        console.log('[App Metrics] ✓ Application metrics tracking initialized (every 60 seconds)');
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

