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
        console.error('Chart canvases not found');
        return;
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
}

// Format time for labels
function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
    if (!metricsData || metricsData.length === 0) {
        // Silently return - no data is expected on first load or when time range has no data
        return;
    }

    const labels = metricsData.map(m => formatTime(m.created_at));
    const cpuData = metricsData.map(m => parseFloat(m.cpu_usage));
    const ramData = metricsData.map(m => parseFloat(m.ram_usage));
    const bandwidthInData = metricsData.map(m => parseFloat(m.bandwidth_in_mb || 0));
    const bandwidthOutData = metricsData.map(m => parseFloat(m.bandwidth_out_mb || 0));
    const bandwidthTotalData = metricsData.map(m => parseFloat(m.bandwidth_total_mb || 0));

    // Update CPU chart
    if (cpuChart) {
        cpuChart.data.labels = labels;
        cpuChart.data.datasets[0].data = cpuData;
        cpuChart.update('none');
    }

    // Update RAM chart
    if (ramChart) {
        ramChart.data.labels = labels;
        ramChart.data.datasets[0].data = ramData;
        ramChart.update('none');
    }

    // Update Bandwidth chart
    if (bandwidthChart) {
        bandwidthChart.data.labels = labels;
        bandwidthChart.data.datasets[0].data = bandwidthInData;
        bandwidthChart.data.datasets[1].data = bandwidthOutData;
        bandwidthChart.data.datasets[2].data = bandwidthTotalData;
        bandwidthChart.update('none');
    }
}

// Fetch metrics from API
async function fetchMetrics() {
    try {
        const timeRange = document.getElementById('metricsTimeRange')?.value || 24;
        
        // Fetch historical metrics
        const response = await authenticatedFetch(`/api/admin/metrics?hours=${timeRange}&limit=100`);
        if (!response.ok) {
            throw new Error('Failed to fetch metrics');
        }
        const data = await response.json();
        
        if (data.success && data.metrics) {
            updateCharts(data.metrics);
        }

        // Fetch current metrics
        const currentResponse = await authenticatedFetch('/api/admin/metrics/current');
        if (currentResponse.ok) {
            const currentData = await currentResponse.json();
            if (currentData.success && currentData.metrics) {
                updateCurrentMetrics(currentData.metrics);
            }
        }
    } catch (error) {
        console.error('Error fetching metrics:', error);
    }
}

// Collect and store metrics
async function collectMetrics() {
    try {
        const response = await authenticatedFetch('/api/admin/metrics/collect', {
            method: 'POST'
        });
        if (response.ok) {
            // Refresh metrics display after collection
            setTimeout(fetchMetrics, 500);
        }
    } catch (error) {
        console.error('Error collecting metrics:', error);
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
    initCharts();

    // Fetch initial metrics immediately
    fetchMetrics();

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

