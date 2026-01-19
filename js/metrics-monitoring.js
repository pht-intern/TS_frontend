// Application Metrics Monitoring
// Fetches and displays cache performance, and system metrics (CPU, RAM, Bandwidth)

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

// Update current metrics display
function updateCurrentMetrics(current, systemCurrent) {
    const cpuEl = document.getElementById('currentCpu');
    const ramEl = document.getElementById('currentRam');
    const bandwidthEl = document.getElementById('currentBandwidth');

    // System metrics
    if (cpuEl && systemCurrent) {
        cpuEl.textContent = `${(systemCurrent.cpu_usage || 0).toFixed(1)}%`;
    }
    if (ramEl && systemCurrent) {
        ramEl.textContent = `${(systemCurrent.ram_usage || 0).toFixed(1)}%`;
    }
    if (bandwidthEl && systemCurrent) {
        bandwidthEl.textContent = `${(systemCurrent.bandwidth_total_mb || 0).toFixed(2)} MB`;
    }
}

// Update charts with metrics data
function updateCharts(timeSeries, systemTimeSeries) {
    // Update system metrics charts
    if (!systemTimeSeries || !Array.isArray(systemTimeSeries) || systemTimeSeries.length === 0) {
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
    } else {
        const systemLabels = systemTimeSeries.map(m => {
            const formatted = formatTime(m.time);
            return formatted || m.time;
        }).filter(label => label !== '');

        const cpuData = systemTimeSeries.map(m => {
            const value = parseFloat(m.cpu_usage || 0);
            return isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
        });

        const ramData = systemTimeSeries.map(m => {
            const value = parseFloat(m.ram_usage || 0);
            return isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
        });

        const bandwidthInData = systemTimeSeries.map(m => parseFloat(m.bandwidth_in_mb || 0));
        const bandwidthOutData = systemTimeSeries.map(m => parseFloat(m.bandwidth_out_mb || 0));
        const bandwidthTotalData = systemTimeSeries.map(m => parseFloat(m.bandwidth_total_mb || 0));

        // Update CPU chart
        if (cpuChart) {
            cpuChart.data.labels = systemLabels;
            cpuChart.data.datasets[0].data = cpuData;
            cpuChart.update('none');
        }

        // Update RAM chart
        if (ramChart) {
            ramChart.data.labels = systemLabels;
            ramChart.data.datasets[0].data = ramData;
            ramChart.update('none');
        }

        // Update Bandwidth chart
        if (bandwidthChart) {
            bandwidthChart.data.labels = systemLabels;
            bandwidthChart.data.datasets[0].data = bandwidthInData;
            bandwidthChart.data.datasets[1].data = bandwidthOutData;
            bandwidthChart.data.datasets[2].data = bandwidthTotalData;
            bandwidthChart.update('none');
        }
    }
}

// Fetch application metrics from API
async function fetchMetrics() {
    try {
        const timeRangeSelect = document.getElementById('metricsTimeRange');
        const hours = timeRangeSelect ? parseInt(timeRangeSelect.value) || 24 : 24;

        const response = await authenticatedFetch(`/api/admin/application-metrics?hours=${hours}`);
        
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Failed to fetch metrics: ${response.statusText}`;
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (data.success) {
            // Update current metrics (application + system)
            updateCurrentMetrics(data.current, data.system_metrics?.current);
            
            // Update charts (application + system)
            updateCharts(data.time_series, data.system_metrics?.time_series);
        } else {
            throw new Error(data.error || 'Failed to fetch metrics');
        }
    } catch (error) {
        console.error('Error fetching application metrics:', error);
        // Show error in UI
        const monitoringSection = document.querySelector('.metrics-graphs-container');
        if (monitoringSection) {
            console.warn('Error loading application metrics. Please check server logs.');
        }
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
    
    // Also collect system metrics to ensure we have data
    collectSystemMetrics();

    // Set up time range selector
    const timeRangeSelect = document.getElementById('metricsTimeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', () => {
            fetchMetrics();
        });
    }

    // Auto-refresh metrics every 30 seconds for accurate real-time updates
    metricsUpdateInterval = setInterval(() => {
        fetchMetrics();
        // Also collect system metrics periodically
        collectSystemMetrics();
    }, 30000); // 30 seconds = 30000 milliseconds
}

// Collect system metrics from server
async function collectSystemMetrics() {
    try {
        const response = await authenticatedFetch('/api/admin/metrics/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // Silently fail - system metrics collection is optional
            return;
        }
        
        const data = await response.json();
        if (data.success) {
            // Metrics collected successfully
            console.log('System metrics collected');
        }
    } catch (error) {
        // Silently fail - system metrics collection is optional
        // This is expected if psutil is not available or metrics collection fails
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        metricsUpdateInterval = null;
    }
    
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
});
