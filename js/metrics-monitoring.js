// System Metrics Monitoring
// Fetches and displays CPU, RAM, and Bandwidth usage with Chart.js graphs

let cpuChart = null;
let ramChart = null;
let bandwidthChart = null;
let metricsUpdateInterval = null;

// Chart.js configuration matching dashboard theme
const chartColors = {
    primary: 'rgba(116, 136, 150, 1)',
    primaryLight: 'rgba(116, 136, 150, 0.2)',
    yellow: 'rgba(255, 193, 7, 1)',
    yellowLight: 'rgba(255, 193, 7, 0.2)',
    purple: 'rgba(156, 39, 176, 1)',
    purpleLight: 'rgba(156, 39, 176, 0.2)',
    red: 'rgba(244, 67, 54, 1)',
    redLight: 'rgba(244, 67, 54, 0.2)',
    green: 'rgba(76, 175, 80, 1)',
    greenLight: 'rgba(76, 175, 80, 0.2)'
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                    family: "'Inter', sans-serif",
                    size: 12,
                    weight: '500'
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
                family: "'Inter', sans-serif",
                size: 13,
                weight: '600'
            },
            bodyFont: {
                family: "'Inter', sans-serif",
                size: 12
            },
            cornerRadius: 8,
            displayColors: true
        }
    },
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                font: {
                    family: "'Inter', sans-serif",
                    size: 11
                },
                color: '#6c757d'
            }
        },
        y: {
            beginAtZero: true,
            grid: {
                color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
                font: {
                    family: "'Inter', sans-serif",
                    size: 11
                },
                color: '#6c757d'
            }
        }
    },
    elements: {
        point: {
            radius: 3,
            hoverRadius: 6
        },
        line: {
            tension: 0.4,
            borderWidth: 2
        }
    }
};

// Initialize charts
function initCharts() {
    const cpuCtx = document.getElementById('cpuChart');
    const ramCtx = document.getElementById('ramChart');
    const bandwidthCtx = document.getElementById('bandwidthChart');

    if (!cpuCtx || !ramCtx || !bandwidthCtx) {
        console.warn('Chart canvases not found. Metrics section may not be visible.');
        return false;
    }

    // Destroy existing charts if they exist
    if (cpuChart) {
        cpuChart.destroy();
        cpuChart = null;
    }
    if (ramChart) {
        ramChart.destroy();
        ramChart = null;
    }
    if (bandwidthChart) {
        bandwidthChart.destroy();
        bandwidthChart = null;
    }

    // CPU Chart
    cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU Usage (%)',
                data: [],
                borderColor: chartColors.yellow,
                backgroundColor: chartColors.yellowLight,
                fill: true
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: false
                }
            },
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    max: 100,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    // RAM Chart
    ramChart = new Chart(ramCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'RAM Usage (%)',
                data: [],
                borderColor: chartColors.purple,
                backgroundColor: chartColors.purpleLight,
                fill: true
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: false
                }
            },
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    max: 100,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    // Bandwidth Chart
    bandwidthChart = new Chart(bandwidthCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Bandwidth In (MB)',
                    data: [],
                    borderColor: chartColors.green,
                    backgroundColor: chartColors.greenLight,
                    fill: true
                },
                {
                    label: 'Bandwidth Out (MB)',
                    data: [],
                    borderColor: chartColors.red,
                    backgroundColor: chartColors.redLight,
                    fill: true
                },
                {
                    label: 'Total Bandwidth (MB)',
                    data: [],
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primaryLight,
                    fill: true,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: false
                }
            },
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value.toFixed(2) + ' MB';
                        }
                    }
                }
            }
        }
    });
    
    return true;
}

// Format time for labels
function formatTime(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        console.warn('Error formatting time:', dateString, e);
        return '';
    }
}

// Format date and time for better display
function formatDateTime(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    } catch (e) {
        console.warn('Error formatting datetime:', dateString, e);
        return '';
    }
}

// Update current metrics display
function updateCurrentMetrics(metrics) {
    const cpuEl = document.getElementById('currentCpu');
    const ramEl = document.getElementById('currentRam');
    const bandwidthEl = document.getElementById('currentBandwidth');

    if (cpuEl) {
        cpuEl.textContent = `${metrics.cpu_usage.toFixed(1)}%`;
    }
    if (ramEl) {
        ramEl.textContent = `${metrics.ram_usage.toFixed(1)}%`;
    }
    if (bandwidthEl) {
        bandwidthEl.textContent = `${metrics.bandwidth_total_mb.toFixed(2)} MB`;
    }
}

// Update charts with metrics data
function updateCharts(metricsData) {
    if (!metricsData || !Array.isArray(metricsData) || metricsData.length === 0) {
        // Show empty state - initialize charts with empty data
        const emptyLabels = [];
        const emptyData = [];
        
        if (cpuChart) {
            cpuChart.data.labels = emptyLabels;
            cpuChart.data.datasets[0].data = emptyData;
            cpuChart.update('none');
        }
        
        if (ramChart) {
            ramChart.data.labels = emptyLabels;
            ramChart.data.datasets[0].data = emptyData;
            ramChart.update('none');
        }
        
        if (bandwidthChart) {
            bandwidthChart.data.labels = emptyLabels;
            bandwidthChart.data.datasets[0].data = emptyData;
            bandwidthChart.data.datasets[1].data = emptyData;
            bandwidthChart.data.datasets[2].data = emptyData;
            bandwidthChart.update('none');
        }
        
        // Show message if no data
        console.log('No metrics data available. Charts initialized with empty data.');
        return;
    }

    // Sort data by created_at to ensure chronological order
    const sortedData = [...metricsData].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateA - dateB;
    });

    // Extract labels and data
    const labels = sortedData.map(m => {
        const formatted = formatTime(m.created_at);
        return formatted || formatDateTime(m.created_at);
    }).filter(label => label !== '');

    const cpuData = sortedData.map(m => {
        const value = parseFloat(m.cpu_usage);
        return isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
    });

    const ramData = sortedData.map(m => {
        const value = parseFloat(m.ram_usage);
        return isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
    });

    const bandwidthInData = sortedData.map(m => {
        const value = parseFloat(m.bandwidth_in_mb || 0);
        return isNaN(value) ? 0 : Math.max(0, value);
    });

    const bandwidthOutData = sortedData.map(m => {
        const value = parseFloat(m.bandwidth_out_mb || 0);
        return isNaN(value) ? 0 : Math.max(0, value);
    });

    const bandwidthTotalData = sortedData.map(m => {
        const value = parseFloat(m.bandwidth_total_mb || 0);
        return isNaN(value) ? 0 : Math.max(0, value);
    });

    // Update CPU chart
    if (cpuChart) {
        cpuChart.data.labels = labels;
        cpuChart.data.datasets[0].data = cpuData;
        // Adjust y-axis max if needed
        const maxCpu = Math.max(...cpuData, 0);
        if (maxCpu > 0) {
            cpuChart.options.scales.y.max = Math.min(100, Math.ceil(maxCpu * 1.1));
        }
        cpuChart.update('none');
    }

    // Update RAM chart
    if (ramChart) {
        ramChart.data.labels = labels;
        ramChart.data.datasets[0].data = ramData;
        // Adjust y-axis max if needed
        const maxRam = Math.max(...ramData, 0);
        if (maxRam > 0) {
            ramChart.options.scales.y.max = Math.min(100, Math.ceil(maxRam * 1.1));
        }
        ramChart.update('none');
    }

    // Update Bandwidth chart
    if (bandwidthChart) {
        bandwidthChart.data.labels = labels;
        bandwidthChart.data.datasets[0].data = bandwidthInData;
        bandwidthChart.data.datasets[1].data = bandwidthOutData;
        bandwidthChart.data.datasets[2].data = bandwidthTotalData;
        // Adjust y-axis max if needed
        const maxBandwidth = Math.max(...bandwidthTotalData, ...bandwidthInData, ...bandwidthOutData, 0);
        if (maxBandwidth > 0) {
            bandwidthChart.options.scales.y.max = Math.ceil(maxBandwidth * 1.1);
        }
        bandwidthChart.update('none');
    }
}

// Fetch metrics from API
async function fetchMetrics() {
    try {
        const timeRange = document.getElementById('metricsTimeRange')?.value || 24;
        
        // Show loading state (optional - can add spinner)
        const refreshBtn = document.getElementById('refreshMetricsBtn');
        if (refreshBtn) {
            const originalHTML = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            refreshBtn.disabled = true;
            
            // Reset button after a delay
            setTimeout(() => {
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.disabled = false;
            }, 2000);
        }
        
        // Fetch historical metrics
        const response = await authenticatedFetch(`/api/admin/metrics?hours=${timeRange}&limit=100`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch metrics: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (data.metrics && Array.isArray(data.metrics)) {
                updateCharts(data.metrics);
            } else {
                console.warn('Metrics data is not an array:', data);
                updateCharts([]);
            }
        } else {
            console.error('Metrics API returned error:', data.error || 'Unknown error');
            updateCharts([]);
        }

        // Fetch current metrics (non-blocking)
        try {
            const currentResponse = await authenticatedFetch('/api/admin/metrics/current');
            if (currentResponse.ok) {
                const currentData = await currentResponse.json();
                if (currentData.success && currentData.metrics) {
                    updateCurrentMetrics(currentData.metrics);
                }
            } else {
                console.warn('Failed to fetch current metrics:', currentResponse.status);
            }
        } catch (currentError) {
            // Don't fail the whole function if current metrics fail
            console.warn('Error fetching current metrics:', currentError);
        }
    } catch (error) {
        console.error('Error fetching metrics:', error);
        // Update charts with empty data on error
        updateCharts([]);
        
        // Show user-friendly error message (optional)
        const errorMsg = error.message || 'Failed to load metrics data';
        console.error('Metrics fetch error:', errorMsg);
    }
}

// Collect and store metrics
async function collectMetrics() {
    try {
        const response = await authenticatedFetch('/api/admin/metrics/collect', {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Refresh metrics display after collection
                setTimeout(() => {
                    fetchMetrics();
                }, 500);
            } else {
                console.warn('Metrics collection returned error:', data.error);
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.warn('Failed to collect metrics:', errorData.error || `Status: ${response.status}`);
        }
    } catch (error) {
        // Don't show error to user - this is a background operation
        console.warn('Error collecting metrics (non-critical):', error.message);
    }
}

// Initialize metrics monitoring
function initMetricsMonitoring() {
    // Check if monitoring section exists
    const monitoringSection = document.querySelector('.metrics-graphs-container');
    if (!monitoringSection) {
        return; // Section not found, exit
    }

    // Clear any existing interval to prevent duplicates
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        metricsUpdateInterval = null;
    }

    // Initialize charts
    const chartsInitialized = initCharts();
    
    if (!chartsInitialized) {
        console.warn('Charts could not be initialized. Metrics graphs will not be displayed.');
        return;
    }

    // Fetch initial metrics immediately
    fetchMetrics();
    
    // Also collect initial metrics to ensure we have data
    collectMetrics();

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshMetricsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchMetrics();
            collectMetrics();
        });
    }

    // Set up time range selector
    const timeRangeSelect = document.getElementById('metricsTimeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', () => {
            fetchMetrics();
        });
    }

    // Auto-refresh metrics every 30 seconds for accurate real-time updates
    // This ensures the dashboard displays the most current system metrics
    metricsUpdateInterval = setInterval(() => {
        fetchMetrics();
        // Also collect metrics to ensure data is being stored in the database
        collectMetrics();
    }, 30000); // 30 seconds = 30000 milliseconds
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMetricsMonitoring);
} else {
    initMetricsMonitoring();
}

