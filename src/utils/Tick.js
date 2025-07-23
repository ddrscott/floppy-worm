/**
 * Global Tick utility for plotting real-time data as individual line chart canvases.
 * Automatically handles scaling, history management, and DOM integration.
 */
class TickHelper {
    constructor() {
        this.charts = new Map(); // Map of chart name -> chart data with individual canvas
        this.container = null; // Container div for all charts
        this.animationFrame = null; // RAF handle
        this.config = {
            maxHistory: 400, // Maximum data points to keep
            chartWidth: 200,
            chartHeight: 50,
            position: { x: 20, y: 20 },
            backgroundColor: '#000000',
            backgroundAlpha: 0.3,
            gridColor: '#333333',
            textColor: '#ffffff',
            lineWidth: 1,
            padding: 2,
            autoScale: true,
            showGrid: true,
            showLabels: true,
            zIndex: 1000,
            containerId: 'tick-helper-container',
            spacing: 10 // Space between individual charts
        };
        
        this.isInitialized = false;
    }

    /**
     * Initialize the Tick helper - creates container div for individual chart canvases
     */
    init() {
        // Prevent multiple initialization
        if (this.isInitialized) return;
        
        // Check if container already exists (singleton behavior)
        let existingContainer = document.getElementById(this.config.containerId);
        if (existingContainer) {
            this.container = existingContainer;
            this.isInitialized = true;
            return;
        }

        // Create container div for all charts
        this.container = document.createElement('div');
        this.container.id = this.config.containerId;
        
        // Style the container
        this.container.style.position = 'fixed';
        this.container.style.top = this.config.position.y + 'px';
        this.container.style.left = this.config.position.x + 'px';
        this.container.style.zIndex = this.config.zIndex;
        this.container.style.pointerEvents = 'none'; // Don't interfere with game input
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.gap = this.config.spacing + 'px';

        // Add to DOM
        document.body.appendChild(this.container);
        
        this.isInitialized = true;
        
        // Start render loop
        this.startRenderLoop();
    }

    /**
     * Start the render loop using requestAnimationFrame
     */
    startRenderLoop() {
        const renderLoop = () => {
            this.render();
            this.animationFrame = requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    /**
     * Create a new individual canvas for a chart
     * @param {string} chartName - Name of the chart
     * @param {string} color - Chart line color
     */
    createChartCanvas(chartName, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.config.chartWidth;
        canvas.height = this.config.chartHeight;
        canvas.id = `tick-chart-${chartName}`;
        
        // Style the individual chart canvas
        canvas.style.border = '1px solid #666';
        canvas.style.borderRadius = '4px';
        canvas.style.backgroundColor = this.config.backgroundColor + Math.floor(this.config.backgroundAlpha * 255).toString(16).padStart(2, '0');
        
        // Add to container
        this.container.appendChild(canvas);
        
        return { canvas, ctx };
    }

    /**
     * Push a new data point to a named chart
     * @param {string} chartName - Name of the chart
     * @param {number} value - Data value to add
     * @param {string} color - Optional line color (CSS color string)
     */
    push(chartName, value, color = '#4ecdc4') {
        // Auto-initialize if not done yet
        if (!this.isInitialized) {
            this.init();
        }

        // Convert hex numbers to CSS color strings if needed
        if (typeof color === 'number') {
            color = '#' + color.toString(16).padStart(6, '0');
        }

        // Initialize chart if it doesn't exist
        if (!this.charts.has(chartName)) {
            const { canvas, ctx } = this.createChartCanvas(chartName, color);
            
            this.charts.set(chartName, {
                name: chartName,
                data: [],
                color: color,
                min: Infinity,
                max: -Infinity,
                visible: true,
                canvas: canvas,
                ctx: ctx
            });
        }

        const chart = this.charts.get(chartName);
        
        // Add new data point
        chart.data.push(value);
        
        // Update min/max for auto-scaling
        if (this.config.autoScale) {
            chart.min = Math.min(chart.min, value);
            chart.max = Math.max(chart.max, value);
        }

        // Trim history if too long
        if (chart.data.length > this.config.maxHistory) {
            chart.data.shift();
            
            // Recalculate min/max if we removed the oldest point
            if (this.config.autoScale) {
                chart.min = Math.min(...chart.data);
                chart.max = Math.max(...chart.data);
            }
        }
    }

    /**
     * Set configuration options
     * @param {Object} newConfig - Configuration object
     */
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }

    /**
     * Toggle visibility of a specific chart
     * @param {string} chartName - Name of the chart to toggle
     */
    toggle(chartName) {
        if (this.charts.has(chartName)) {
            const chart = this.charts.get(chartName);
            chart.visible = !chart.visible;
            chart.canvas.style.display = chart.visible ? 'block' : 'none';
        }
    }

    /**
     * Clear all data from a specific chart
     * @param {string} chartName - Name of the chart to clear
     */
    clear(chartName) {
        if (this.charts.has(chartName)) {
            const chart = this.charts.get(chartName);
            chart.data = [];
            chart.min = Infinity;
            chart.max = -Infinity;
        }
    }

    /**
     * Clear all charts
     */
    clearAll() {
        this.charts.forEach(chart => {
            chart.data = [];
            chart.min = Infinity;
            chart.max = -Infinity;
        });
    }

    /**
     * Render all individual charts
     */
    render() {
        this.charts.forEach(chart => {
            if (chart.visible && chart.data.length > 0) {
                this.renderChart(chart);
            }
        });
    }

    /**
     * Render a single chart to its individual canvas
     * @param {Object} chart - Chart data object with canvas and ctx
     */
    renderChart(chart) {
        const padding = this.config.padding;
        const ctx = chart.ctx;
        const width = chart.canvas.width;
        const height = chart.canvas.height;

        // Clear the canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate data range
        let dataMin = chart.min;
        let dataMax = chart.max;
        
        // Ensure we have a valid range
        if (dataMin === dataMax) {
            dataMin -= 1;
            dataMax += 1;
        }
        
        const dataRange = dataMax - dataMin;
        if (dataRange === 0) return;

        // Draw grid if enabled
        if (this.config.showGrid) {
            this.drawGrid(chart, 0, 0, width, height, padding);
        }

        // Draw data line
        if (chart.data.length > 1) {
            ctx.strokeStyle = chart.color;
            ctx.lineWidth = this.config.lineWidth;
            
            const plotWidth = width - padding * 2;
            const plotHeight = height - padding * 2;
            const plotX = padding;
            const plotY = padding;

            ctx.beginPath();

            // Start path
            const firstValue = chart.data[0];
            const firstX = plotX;
            const firstY = plotY + plotHeight - ((firstValue - dataMin) / dataRange) * plotHeight;
            ctx.moveTo(firstX, firstY);

            // Draw line through all data points
            for (let i = 1; i < chart.data.length; i++) {
                const value = chart.data[i];
                const px = plotX + (i / (chart.data.length - 1)) * plotWidth;
                const py = plotY + plotHeight - ((value - dataMin) / dataRange) * plotHeight;
                ctx.lineTo(px, py);
            }

            ctx.stroke();
        }

        // Draw labels if enabled
        if (this.config.showLabels) {
            ctx.fillStyle = this.config.textColor;
            ctx.font = '10px monospace';

            // Chart name (top left)
            ctx.textAlign = 'left';
            ctx.fillText(chart.name, 3, 12);

            // Max value (top right)
            ctx.textAlign = 'right';
            ctx.fillText(`${dataMax.toFixed(1)}`, width - 3, 12);

            // Current value (bottom left) - 3x larger font
            const currentValue = chart.data[chart.data.length - 1] || 0;
            ctx.font = '30px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(currentValue.toFixed(1), 3, height - 5);

            // Min value (bottom right) - same size as max value
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${dataMin.toFixed(1)}`, width - 3, height - 3);
        }
    }

    /**
     * Draw grid lines for a chart
     * @param {Object} chart - Chart object with ctx
     * @param {number} x - Chart X position
     * @param {number} y - Chart Y position  
     * @param {number} width - Chart width
     * @param {number} height - Chart height
     * @param {number} padding - Chart padding
     */
    drawGrid(chart, x, y, width, height, padding) {
        const ctx = chart.ctx;
        ctx.strokeStyle = this.config.gridColor;
        ctx.lineWidth = 0.5;

        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;
        const plotX = x + padding;
        const plotY = y + padding;

        ctx.beginPath();

        // Horizontal grid lines (2 lines: top, bottom)
        for (let i = 0; i <= 1; i++) {
            const gridY = plotY + i * plotHeight;
            ctx.moveTo(plotX, gridY);
            ctx.lineTo(plotX + plotWidth, gridY);
        }

        // Vertical grid lines (4 lines across the width)
        for (let i = 0; i <= 3; i++) {
            const gridX = plotX + (i / 3) * plotWidth;
            ctx.moveTo(gridX, plotY);
            ctx.lineTo(gridX, plotY + plotHeight);
        }

        ctx.stroke();
    }

    /**
     * Cleanup - removes all chart canvases from DOM and stops render loop
     */
    destroy() {
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Remove container from DOM (removes all chart canvases)
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // Reset state
        this.container = null;
        this.charts.clear();
        this.isInitialized = false;
    }
}

// Create global singleton instance
const Tick = new TickHelper();

export default Tick;
