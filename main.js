// --- FIXED CONFIGURATION AND CONSTANTS ---
// Add CSS.escape polyfill at the beginning of the file to ensure availability
if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
    window.CSS = { escape: function(s) {
        return s.replace(/[!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, '\\$&');
    }};
}

const CSV_FILE_PATH = "GEDEvent_v25_1.csv"; 
const CHART4_COUNTRY_LIMIT = 15; // Get Top 15 Countries
const CHART4_NUM_COLS = 3; // NUMBER OF COLUMNS FOR CHART 4
const WIDTH = 960;
const HEIGHT = 650; // Increased Height
const MARGIN = { top: 30, right: 30, bottom: 50, left: 80 }; // Increased left margin for Y-axis
const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

// Configuration for small charts in Detail Panel
const DETAIL_CHART_WIDTH = 420; 
const DETAIL_CHART_HEIGHT = 180; 
const DETAIL_CHART_MARGIN = { top: 20, right: 20, bottom: 40, left: 50 }; 
const DETAIL_INNER_WIDTH = DETAIL_CHART_WIDTH - DETAIL_CHART_MARGIN.left - DETAIL_CHART_MARGIN.right;
const DETAIL_INNER_HEIGHT = DETAIL_CHART_HEIGHT - DETAIL_CHART_MARGIN.top - DETAIL_CHART_MARGIN.bottom;


// Define continents and corresponding colors
const REGION_COLORS = {
    'Asia': '#ff7f0e',
    'Europe': '#1f77b4',
    'Africa': '#2ca02c',
    'Americas': '#d62728',
    'Middle East': '#9467bd',
    'Oceania': '#8c564b',
    'Unknown': '#7f7f7f'
};
const regionScale = d3.scaleOrdinal()
    .domain(Object.keys(REGION_COLORS))
    .range(Object.values(REGION_COLORS));

// Violence Type Mapping (type_of_violence)
const TYPE_MAP = {
    "1": "State-based Conflict",
    "2": "Non-state Conflict",
    "3": "One-sided Violence"
};

const TYPE_COLORS = d3.scaleOrdinal()
    .domain(Object.keys(TYPE_MAP).map(k => TYPE_MAP[k]))
    .range(["#d9534f", "#f0ad4e", "#0275d8"]);

// Victim Type Mapping (NEW)
const VICTIM_KEYS = ['deaths_a', 'deaths_b', 'deaths_civilians', 'deaths_unknown'];
const VICTIM_COLORS = d3.scaleOrdinal()
    .domain(VICTIM_KEYS)
    .range(["#d62728", "#1f77b4", "#2ca02c", "#7f7f7f"]);


let rawProcessedData = []; 
let currentChart = 'chart3';
let activeRegions = Object.keys(REGION_COLORS); 
let currentHoveredNode = null; 
let hoverTimeout = null; 
// Removed: let detailPanelLocked = false; 

// --- D3 INITIALIZATION (Global) ---
const svg = d3.select("#d3-chart")
    .attr("viewBox", [0, 0, WIDTH, HEIGHT])
    .attr("font-family", "Arial, sans-serif");

const gChart = svg.append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

const detailPanel = d3.select(".detail-content-wrapper");

// ----------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------

/** Escape special characters for D3/CSS selector */
function escapeHtmlId(str) {
    return CSS.escape(str);
}


function processRawData(rawData) {
    return rawData.map(d => ({
        year: +d.year,
        region: d.region || 'Unknown', 
        country: d.country,
        best: +d.best || 0, 
        // Get detailed data for victim analysis
        deaths_a: +d.deaths_a || 0,
        deaths_b: +d.deaths_b || 0,
        deaths_civilians: +d.deaths_civilians || 0,
        deaths_unknown: +d.deaths_unknown || 0,
        gwnoa: +d.gwnoa || 0, 
        type_of_violence_name: TYPE_MAP[d.type_of_violence] || `Unknown Type (${d.type_of_violence})`,
        dyad_name: d.dyad_name, 
        side_a: d.side_a, 
        side_b: d.side_b, 
    })).filter(d => d.best > 0);
}

function aggregateDataByCountry(data) {
    const sideCounts = d3.rollup(data, v => v.length, d => `${d.side_a}|${d.side_b}`);
    const mostFrequentSide = Array.from(sideCounts).reduce((a, b) => (a[1] > b[1] ? a : b), ["|", 0])[0].split('|');
    const defaultSideA = mostFrequentSide[0] || 'Side A';
    const defaultSideB = mostFrequentSide[1] || 'Side B';

    return Array.from(d3.rollup(data,
        v => ({
            best: d3.sum(v, d => d.best),
            events: v.length, 
            region: v[0].region, 
            detail: v,
            side_a_name: defaultSideA, 
            side_b_name: defaultSideB, 
        }),
        d => d.country 
    ), ([country, value]) => ({
        name: country,
        region: value.region,
        best: value.best,
        events: value.events,
        detail: value.detail,
        side_a_name: value.side_a_name,
        side_b_name: value.side_b_name,
    }));
}

function createLegend(colors) {
    const legendDiv = d3.select("#legend").html('');
    if (currentChart === 'chart3') {
        colors = {...colors};
        colors['Global'] = '#000';
    }

    Object.entries(colors).forEach(([name, color]) => {
        const item = legendDiv.append("div")
            .attr("class", "legend-item")
            .attr("data-region", name)
            .classed("active", activeRegions.includes(name)) 
            .on("click", (event) => toggleRegion(event, name)); 
            
        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);
        item.append("span")
            .text(name);
    });
}

/** Toggle Region state (used for all Charts) */
function toggleRegion(event, regionName) {
    const item = d3.select(event.currentTarget);
    const isActive = item.classed("active");
    const allRegionsKeys = Object.keys(REGION_COLORS);
    
    if (currentChart === 'chart3') {
        if (regionName === 'Global') {
            if (!isActive || activeRegions.length > 1) {
                activeRegions = ['Global']; 
            } else {
                return;
            }
        } else {
            if (activeRegions.includes('Global')) {
                activeRegions = activeRegions.filter(r => r !== 'Global');
            }

            if (isActive) {
                activeRegions = activeRegions.filter(r => r !== regionName);
            } else {
                activeRegions.push(regionName);
            }
            
            if (activeRegions.length === 0) {
                activeRegions = ['Global'];
            }
        }
    } else {
        if (isActive) {
            activeRegions = activeRegions.filter(r => r !== regionName);
        } else {
            activeRegions.push(regionName);
        }
        
        if (activeRegions.length === 0) {
             activeRegions = allRegionsKeys; 
        }
    }
    
    d3.selectAll(".legend-item").classed("active", function() {
        const region = d3.select(this).attr("data-region");
        return activeRegions.includes(region);
    });

    // Reset detail panel state
    d3.select("#detail-panel").classed("locked", false);
    d3.select("#detail-panel").select('.panel-title').text('Detail Information');

    switch (currentChart) {
        case 'chart1': drawChart1(); break;
        case 'chart2': drawChart2(); break;
        case 'chart3': drawChart3(); break;
        case 'chart4': drawChart4(); break;
    }
}

/** Utility function to clean old elements (axes/headers) before drawing */
function cleanChartArea() {
    gChart.selectAll('.x-axis, .y-axis, .chart-header, .chart-title, .dot-group').remove();
    gChart.selectAll('.bubble-group, .line-group, .chart-header-group').remove();
}

/** Update VICTIM_LABELS based on the most common Side A/B name (or generic labels if needed) */
function getDynamicVictimLabels(countryDetail, useGenericLabels = false) {
    if (useGenericLabels) {
        return {
            'deaths_a': 'Side A',
            'deaths_b': 'Side B',
            'deaths_civilians': 'Civilians (Collateral)',
            'deaths_unknown': 'Unknown Status'
        };
    }
    
    let sideA = countryDetail.side_a_name || 'Side A';
    let sideB = countryDetail.side_b_name || 'Side B';

    if (countryDetail.detail && countryDetail.detail.length > 0) {
        const event = countryDetail.detail.reduce((max, event) => 
            (event.best > max.best ? event : max),
            countryDetail.detail[0]
        );
        sideA = event.side_a || sideA;
        sideB = event.side_b || sideB;
    }
    
    const simplifyName = (name) => {
        if (name === 'civilians') return 'Civilians (Targeted)';
        if (name.length > 20) return name.substring(0, 17) + '...';
        return name;
    };

    return {
        'deaths_a': simplifyName(sideA),
        'deaths_b': simplifyName(sideB),
        'deaths_civilians': 'Civilians (Collateral)',
        'deaths_unknown': 'Unknown Status'
    };
}


/** Display full detail information on mouseover bubble (Chart 1, 2, 4) */
function showFullDetail(d) {
    
    currentHoveredNode = d; 
    const data = d.data || d;
    
    if (hoverTimeout) clearTimeout(hoverTimeout);

    const countryName = data.name.includes('(') ? data.name.split('(')[0].trim() : data.name; 
    
    let detailedDataForCharts = data.detail || [];
    let aggregatedDataForDisplay = data; 
    let isFilteredByViolenceType = false;

    if (currentChart === 'chart2' || currentChart === 'chart4') {
        const typeOfViolenceHovered = data.type_of_violence_name;
        
        if (typeOfViolenceHovered && typeOfViolenceHovered !== countryName) {
            const filteredEvents = (data.detail || []).filter(e => e.type_of_violence_name === typeOfViolenceHovered);
            
            if (filteredEvents.length > 0) {
                detailedDataForCharts = filteredEvents;
                isFilteredByViolenceType = true;
                
                aggregatedDataForDisplay = {
                    ...data,
                    best: d3.sum(filteredEvents, e => e.best),
                    events: filteredEvents.length,
                    detail: filteredEvents,
                };
            }
        }
    }
    
    const isCountryChart = detailedDataForCharts.length > 0;
    
    let highestCasualtyEvent = { best: 0, dyad_name: 'N/A', year: '', data: null }; 
    if (isCountryChart) {
        highestCasualtyEvent = detailedDataForCharts.reduce((max, event) => 
            (event.best > max.best ? { best: event.best, dyad_name: event.dyad_name || 'Unknown Dyad', year: event.year, data: event } : max),
            highestCasualtyEvent
        );
    }
    
    // Calculate percentage 
    const totalCasualtiesGlobal = d3.sum(rawProcessedData.filter(d => activeRegions.includes(d.region)), d => d.best);
    const casualtyPercentOfGlobal = totalCasualtiesGlobal > 0 ? (aggregatedDataForDisplay.best / totalCasualtiesGlobal) : 0;
    
    // Find the Side A with the LARGEST EVENT in the country (for display)
    let highestSideA = { name: 'N/A', events: 0, total_best: 0 };
    if (isCountryChart) {
           const sideATotals = d3.rollup(detailedDataForCharts, 
                v => ({ 
                    events: v.length,
                    total_best: d3.sum(v, d => d.best)
                }), 
                d => d.side_a
            );
            // SORT BY EVENTS
            highestSideA = Array.from(sideATotals).reduce((max, [name, values]) => 
                (values.events > max.events ? { name: name, events: values.events, total_best: values.total_best } : max),
                highestSideA
            );
    }
    
    const totalEventsCountry = aggregatedDataForDisplay.events || 0;
    const sideAEventPercent = totalEventsCountry > 0 ? (highestSideA.events / totalEventsCountry) : 0;
    const sideACasualtyPercent = aggregatedDataForDisplay.best > 0 ? (highestSideA.total_best / aggregatedDataForDisplay.best) : 0;


    const victimLabelsForBarChart = getDynamicVictimLabels(highestCasualtyEvent.data ? {detail: [highestCasualtyEvent.data]} : aggregatedDataForDisplay, false);
    const victimLabelsForStackedCharts = getDynamicVictimLabels(aggregatedDataForDisplay, true);


    d3.select("#detail-panel").classed("locked", false);
    
    const totalEventsDisplay = d3.format(",")(aggregatedDataForDisplay.events || (detailedDataForCharts ? detailedDataForCharts.length : 1));
    const totalCasualtiesDisplay = d3.format(",")(aggregatedDataForDisplay.best);
    
    const typeDisplay = isFilteredByViolenceType ? 
                            `<p><strong>Violence Type:</strong> ${aggregatedDataForDisplay.type_of_violence_name}</p>` : 
                            '';

    // 1. Display basic information
    d3.select(".detail-info-column").html(`
        <p class="detail-name">${countryName}</p>
        <p><strong>Continent:</strong> ${aggregatedDataForDisplay.region}</p>
        <p><strong>Casualties:</strong> ${totalCasualtiesDisplay} <span style="font-weight: bold; color: #d62728;">(${d3.format(".1%")(casualtyPercentOfGlobal)} Total Region)</span></p>
        <p><strong>Total Events:</strong> ${totalEventsDisplay}</p>
        ${typeDisplay}
        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
        <div id="highest-event-section">
            <p style="font-weight: bold; margin-bottom: 5px;">Highest Casualty Event:</p>
            <p style="margin-top: 0; margin-bottom: 5px;">
                ${highestCasualtyEvent.dyad_name} (${d3.format(",")(highestCasualtyEvent.best)}${highestCasualtyEvent.year ? ', ' + highestCasualtyEvent.year : ''})
            </p>
            <div id="country-victim-breakdown-chart-container"></div> 
        </div>
        
        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
        
        <p style="font-weight: bold; margin-bottom: 5px;">Most Frequent Side A:</p>
        <p style="margin-top: 0; font-size: 13px;">
            ${highestSideA.name}
            <br>Events participated: ${d3.format(",")(highestSideA.events)} <span style="font-weight: bold; color: #1f77b4;">(${d3.format(".1%")(sideAEventPercent)} Country Total)</span>
            <br>Total Casualties (BEST): ${d3.format(",")(highestSideA.total_best)} <span style="font-weight: bold; color: #2ca02c;">(${d3.format(".1%")(sideACasualtyPercent)} Country Total)</span>
        </p>
        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
    `);

    // 2. Clear old chart and add new container
    const chartColumn = d3.select(".detail-chart-column").html('');
    
    // 3. Draw chart if there is detail data
    if (isCountryChart) {
        const typeCount = Array.from(d3.rollup(detailedDataForCharts, v => v.length, d => d.type_of_violence_name)).length;
        const yearCount = Array.from(d3.rollup(detailedDataForCharts, v => v.length, d => d.year)).length;
        
        const showStackedAreaChart = yearCount >= 2 && detailedDataForCharts.length > 1; 
        // Horizontal/Vertical Stacked Bar Chart only draws if there is more than 1 violence type (and data exists)
        const showStackedBarChart = typeCount > 1; 

        if (showStackedAreaChart) {
            chartColumn.append('div').attr('id', 'country-stacked-area-chart-container');
        }
        
        if (showStackedBarChart) {
            chartColumn.append('div').attr('id', 'country-stacked-bar-chart-container');
        }

        const highestEventDataArray = highestCasualtyEvent.data ? [highestCasualtyEvent.data] : []; 

        drawCountryCharts(
            detailedDataForCharts, 
            countryName, 
            highestEventDataArray, 
            showStackedAreaChart, 
            showStackedBarChart, 
            victimLabelsForStackedCharts, 
            victimLabelsForBarChart 
        );
    }
}


/** Display full detail information on mouseover dot in Chart 3 */
function showYearDetail(d, regionName) {
    
    currentHoveredNode = { 
        data: { 
            name: regionName, 
            detail: [{ year: d.year, best: d.best }],
            best: d.best 
        } 
    }; 
    if (hoverTimeout) clearTimeout(hoverTimeout);
    

    // Raw data for the selected year and region
    const detailedDataForCharts = rawProcessedData.filter(e => 
        e.year === d.year && (regionName === 'Global' || e.region === regionName)
    );
    
    // Total casualties and total events for the year/region
    const totalCasualtiesYear = d.best;
    const totalEventsYear = detailedDataForCharts.length;
    
    // Aggregate data for basic display
    const aggregatedDataForDisplay = {
        name: regionName,
        region: regionName === 'Global' ? 'Multiple' : regionName,
        best: totalCasualtiesYear,
        events: totalEventsYear,
        detail: detailedDataForCharts 
    };

    // 1. Find the highest casualty event
    let highestCasualtyEvent = { best: 0, dyad_name: 'N/A', country: 'N/A', data: null };
    // 2. Find the Side A with the MOST PARTICIPATED EVENTS in that year/region
    let highestSideA = { name: 'N/A', events: 0, total_best: 0 };
    
    if (totalEventsYear > 0) {
        highestCasualtyEvent = detailedDataForCharts.reduce((max, event) =>
            (event.best > max.best ? { 
                best: event.best, 
                dyad_name: event.dyad_name || 'Unknown Dyad', 
                country: event.country, 
                data: event 
            } : max),
            highestCasualtyEvent
        );
        
        // Calculate total 'best' casualties of Side A and total number of events participated
        const sideATotals = d3.rollup(detailedDataForCharts, 
            v => ({ 
                events: v.length, // Number of events
                total_best: d3.sum(v, d => d.best) // Total BEST casualties
            }), 
            d => d.side_a
        );
        
        // SORT BY EVENTS (Number of conflicts)
        highestSideA = Array.from(sideATotals).reduce((max, [name, values]) => 
            (values.events > max.events ? { name: name, events: values.events, total_best: values.total_best } : max),
            { name: 'N/A', events: 0, total_best: 0 }
        );
    }
    
    // --- Calculate Percentages ---
    const casualtyPercentOfYear = totalCasualtiesYear > 0 ? (highestCasualtyEvent.best / totalCasualtiesYear) : 0;
    const sideAEventPercent = totalEventsYear > 0 ? (highestSideA.events / totalEventsYear) : 0;
    const sideACasualtyPercent = totalCasualtiesYear > 0 ? (highestSideA.total_best / totalCasualtiesYear) : 0;
    
    const totalCasualtiesDisplay = d3.format(",")(totalCasualtiesYear);
    const totalEventsDisplay = d3.format(",")(totalEventsYear);
    
    // --- Update Detail Panel ---
    
    d3.select("#detail-panel").classed("locked", false);
    
    d3.select(".detail-info-column").html(`
        <p class="detail-name">${regionName} (${d.year})</p>
        <p><strong>Casualties:</strong> ${totalCasualtiesDisplay}</p>
        <p><strong>Total Events:</strong> ${totalEventsDisplay}</p>
        
        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
        <div id="highest-event-section">
            <p style="font-weight: bold; margin-bottom: 5px;">Most Severe Event:</p>
            <p style="margin-top: 0; margin-bottom: 5px; font-size: 13px;">
                ${highestCasualtyEvent.dyad_name} (${highestCasualtyEvent.country}) 
                <br>Casualties: ${d3.format(",")(highestCasualtyEvent.best)} 
                <span style="font-weight: bold; color: #d62728;">(${d3.format(".1%")(casualtyPercentOfYear)} Year Total)</span>
            </p>
            <div id="country-victim-breakdown-chart-container"></div> 
        </div>
        
        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
        
        <p style="font-weight: bold; margin-bottom: 5px;">Most Frequent Side A:</p>
        <p style="margin-top: 0; font-size: 13px;">
            ${highestSideA.name}
            <br>Events participated: ${d3.format(",")(highestSideA.events)} 
            <span style="font-weight: bold; color: #1f77b4;">(${d3.format(".1%")(sideAEventPercent)} Year Total)</span>
            <br>Total Casualties (BEST): ${d3.format(",")(highestSideA.total_best)} 
            <span style="font-weight: bold; color: #2ca02c;">(${d3.format(".1%")(sideACasualtyPercent)} Year Total)</span>
        </p>

        <hr style="border: 0.5px dashed #ccc; margin: 10px 0;">
    `);

    // 2. Clear old chart and add new container
    const chartColumn = d3.select(".detail-chart-column").html('');
    
    // 3. Draw chart if there is detail data
    if (totalEventsYear > 0) {
        const typeCount = Array.from(d3.rollup(detailedDataForCharts, v => v.length, d => d.type_of_violence_name)).length;
        
        const highestEventDataArray = highestCasualtyEvent.data ? [highestCasualtyEvent.data] : []; 
        
        // Horizontal Bar chart only draws if > 1 violence type
        if (typeCount > 1) {
            chartColumn.append('div').attr('id', 'country-stacked-bar-chart-container');
        } 

        // drawCountryCharts function will be called to draw the highest event Bar Chart and Horizontal Stacked Bar Chart
        drawCountryCharts(
            detailedDataForCharts, 
            regionName, 
            highestEventDataArray, 
            false, 
            typeCount > 1, 
            getDynamicVictimLabels(aggregatedDataForDisplay, true), 
            getDynamicVictimLabels(highestCasualtyEvent.data ? {detail: [highestCasualtyEvent.data]} : aggregatedDataForDisplay, false) 
        );
    }
}


/** Hide detail information (on mouseout) */
function hideDetail(event, d) {
    
    // Xóa timeout cũ nếu có
    if (hoverTimeout) clearTimeout(hoverTimeout);

    // Bắt đầu một timeout mới
    hoverTimeout = setTimeout(() => {
        const relatedTarget = event.relatedTarget;
        
        // Chỉ ẩn nếu con trỏ chuột di chuyển ra khỏi:
        // 1. Chart SVG (gChart)
        // 2. Detail Panel (#detail-panel)
        if (!relatedTarget || (!relatedTarget.closest('#d3-chart') && !relatedTarget.closest('#detail-panel'))) {
             currentHoveredNode = null;
             d3.select(".detail-info-column").html(`<p class="initial-msg">Hover over a bubble/dot to see detail information.</p>`);
             d3.select(".detail-chart-column").html('');
        }
    }, 100); 
}

// Remove locking functionality on panel click
d3.select("#detail-panel").on("click", null); 


// ----------------------------------------------------------------------
// CHARTS IN DETAIL PANEL
// ----------------------------------------------------------------------

function drawCountryCharts(countryRawData, countryName, highestEventData, showStackedAreaChart, showStackedBarChart, victimLabelsStacked, victimLabelsBar) {
    
    // --- 1. Victim Breakdown Bar Chart (Casualty composition of the highest event) ---
    const victimBreakdownData = VICTIM_KEYS.map(key => ({
        key: key,
        name: victimLabelsBar[key],
        value: d3.sum(highestEventData, d => d[key] || 0)
    })).filter(d => d.value > 0);
    
    if (victimBreakdownData.length > 0) {
        const barSvg = d3.select("#country-victim-breakdown-chart-container")
            .append("svg")
            .attr("width", DETAIL_CHART_WIDTH)
            .attr("height", DETAIL_CHART_HEIGHT);
        
        const barG = barSvg.append("g")
            .attr("transform", `translate(${DETAIL_CHART_MARGIN.left},${DETAIL_CHART_MARGIN.top})`);
        
        barG.append("text").attr("class", "chart-header")
            .attr("y", -5).attr("font-weight", "bold").attr("font-size", 12)
            .text("Casualty Composition of the Highest Event"); 

        const xScale = d3.scaleBand()
            .domain(victimBreakdownData.map(d => d.name))
            .range([0, DETAIL_INNER_WIDTH])
            .padding(0.3);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(victimBreakdownData, d => d.value) * 1.1])
            .range([DETAIL_INNER_HEIGHT, 0]);

        barG.selectAll(".bar")
            .data(victimBreakdownData)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => xScale(d.name))
            .attr("y", d => yScale(d.value))
            .attr("width", xScale.bandwidth())
            .attr("height", d => DETAIL_INNER_HEIGHT - yScale(d.value))
            .attr("fill", d => VICTIM_COLORS(d.key)) 
            .append("title")
            .text(d => `${d.name}: ${d3.format(",")(d.value)}`);

        barG.append("g")
            .attr("transform", `translate(0,${DETAIL_INNER_HEIGHT})`)
            .call(d3.axisBottom(xScale).tickFormat(d => d.split('(')[0].trim())); 

        barG.append("g")
            .call(d3.axisLeft(yScale).ticks(3, "s"));
    }


    // --- 2. Stacked Area Chart (Casualty Trend over Years) ---
    if (showStackedAreaChart) {
           const yearlyVictimDataRaw = Array.from(d3.group(countryRawData, d => d.year),
                ([year, yearGroup]) => {
                    const obj = { year: +year };
                    VICTIM_KEYS.forEach(key => {
                        obj[key] = d3.sum(yearGroup, d => d[key] || 0);
                    });
                    return obj;
                }
            ).sort((a, b) => a.year - b.year);
            
            const stackArea = d3.stack().keys(VICTIM_KEYS);
            const seriesArea = stackArea(yearlyVictimDataRaw);

            const areaSvg = d3.select("#country-stacked-area-chart-container")
                .append("svg")
                .attr("width", DETAIL_CHART_WIDTH)
                .attr("height", DETAIL_CHART_HEIGHT);

            const areaG = areaSvg.append("g")
                .attr("transform", `translate(${DETAIL_CHART_MARGIN.left},${DETAIL_CHART_MARGIN.top})`);
            
            areaG.append("text")
                .attr("class", "chart-header")
                .attr("y", -5).attr("font-weight", "bold").attr("font-size", 12)
                .text(`Casualty Trend (Absolute) by Victim Type`);

            const allYears = d3.extent(yearlyVictimDataRaw, d => d.year);
            const maxStackValue = d3.max(seriesArea, layer => d3.max(layer, d => d[1])) || 10;

            const xScale = d3.scaleLinear()
                .domain(allYears)
                .range([0, DETAIL_INNER_WIDTH]);

            const yScale = d3.scaleLinear()
                .domain([0, maxStackValue * 1.1])
                .range([DETAIL_INNER_HEIGHT, 0]);

            const area = d3.area()
                .x(d => xScale(d.data.year))
                .y0(d => yScale(d[0]))
                .y1(d => yScale(d[1]))
                .curve(d3.curveMonotoneX);

            areaG.selectAll(".area")
                .data(seriesArea)
                .join("path")
                .attr("class", "area")
                .attr("fill", d => VICTIM_COLORS(d.key))
                .attr("d", area)
                .style("opacity", 0.7); 

            areaG.append("g")
                .attr("transform", `translate(0,${DETAIL_INNER_HEIGHT})`)
                .call(d3.axisBottom(xScale).ticks(3).tickFormat(d3.format("d")));

            areaG.append("g")
                .call(d3.axisLeft(yScale).ticks(3, "s"));
                
            // ADD LEGEND FOR STACKED AREA CHART
            const legendArea = areaG.append("g").attr("transform", `translate(0, ${DETAIL_INNER_HEIGHT + 20})`);
            
            VICTIM_KEYS.forEach((key, i) => {
                const name = victimLabelsStacked[key];
                const color = VICTIM_COLORS(key);
                
                legendArea.append("rect")
                    .attr("x", i * 140)
                    .attr("y", 0)
                    .attr("width", 8)
                    .attr("height", 8)
                    .attr("fill", color);
                legendArea.append("text")
                    .attr("x", i * 140 + 10)
                    .attr("y", 8)
                    .style("font-size", "10px")
                    .text(name);
            });
    }

    // --- 3. Horizontal/Vertical Stacked Bar Chart 100%: Percentage of violence type by year/all years ---
    if (showStackedBarChart) {
        const typeKeys = Array.from(new Set(countryRawData.map(d => d.type_of_violence_name))).sort();
        
        // Check if we should draw a vertical chart (multiple years from a country bubble)
        const yearCount = Array.from(d3.group(countryRawData, d => d.year)).length;
        const isMultiYearCountryDetail = currentChart !== 'chart3' && yearCount > 1;

        let dataForPlot;
        let yearDisplay = '';
        
        if (isMultiYearCountryDetail) {
            // Case 1: Multiple years for a country (Vertical 100% Stacked Bar)
            // Aggregate data by year and then by violence type
            dataForPlot = Array.from(d3.group(countryRawData, d => d.year),
                ([year, yearGroup]) => {
                    const totalYearlyBest = d3.sum(yearGroup, d => d.best);
                    const totals = d3.rollup(yearGroup, sum => d3.sum(sum, d => d.best), d => d.type_of_violence_name);
                    
                    const obj = { year: +year, total: totalYearlyBest };
                    for (const key of typeKeys) {
                        obj[key] = totals.get(key) || 0;
                    }
                    return obj;
                }
            ).sort((a, b) => a.year - b.year);
            
            const yearRange = d3.extent(dataForPlot, d => d.year);
            yearDisplay = `${yearRange[0]} - ${yearRange[1]}`;

        } else {
            // Case 2: Single Year (Chart 3 detail) OR Single Aggregate Bar for Country (Chart 1, 2, 4 with only 1 year)
            // Use existing logic for single horizontal bar
            
            let totalBest = d3.sum(countryRawData, d => d.best);
            const totals = d3.rollup(countryRawData, sum => d3.sum(sum, d => d.best), d => d.type_of_violence_name);

            const yearRange = d3.extent(countryRawData, d => d.year);
            yearDisplay = yearRange[0] === yearRange[1] ? yearRange[0] : `${yearRange[0]} - ${yearRange[1]}`;
            
            const singleYearData = { year: yearDisplay, total: totalBest };
            for (const key of typeKeys) {
                singleYearData[key] = totals.get(key) || 0; 
            }
            dataForPlot = [singleYearData];
        }
        
        if (dataForPlot.length === 0 || d3.sum(dataForPlot, d => d.total) === 0) return;

        // --- DRAWING LOGIC STARTS HERE ---
        
        const barSvg = d3.select("#country-stacked-bar-chart-container")
            .append("svg")
            .attr("width", DETAIL_CHART_WIDTH)
            .attr("height", DETAIL_CHART_HEIGHT);
        
        const barG = barSvg.append("g")
            .attr("transform", `translate(${DETAIL_CHART_MARGIN.left},${DETAIL_CHART_MARGIN.top})`);
        
        barG.append("text").attr("class", "chart-header")
            .attr("y", -5).attr("font-weight", "bold").attr("font-size", 12)
            .text(`Percentage of Violence Type in ${yearDisplay} (%)`);

        const stack = d3.stack().keys(typeKeys).order(d3.stackOrderNone).offset(d3.stackOffsetExpand);
        const series = stack(dataForPlot);
        
        if (isMultiYearCountryDetail) {
            // --- DRAW VERTICAL STACKED BAR CHART (TIME SERIES) ---
            
            const xYearScale = d3.scaleBand()
                .domain(dataForPlot.map(d => d.year))
                .range([0, DETAIL_INNER_WIDTH])
                .padding(0.1);

            const yScalePercent = d3.scaleLinear()
                .domain([0, 1]) // 0% to 100%
                .range([DETAIL_INNER_HEIGHT, 0]);

            // Draw X Axis (Years) - Show every 5th tick for readability
            barG.append("g")
                .attr("transform", `translate(0,${DETAIL_INNER_HEIGHT})`)
                .call(d3.axisBottom(xYearScale).tickFormat(d3.format("d")).tickValues(xYearScale.domain().filter((d, i) => !(i % 5))));

            // Draw Y Axis (Percentage)
            barG.append("g")
                .call(d3.axisLeft(yScalePercent).ticks(5, "%"));

            // Draw Bars
            barG.append("g")
                .selectAll("g")
                .data(series)
                .join("g")
                .attr("fill", d => TYPE_COLORS(d.key))
                .selectAll("rect")
                .data(d => d.filter(item => item.data.total > 0))
                .join("rect")
                .attr("x", d => xYearScale(d.data.year))
                .attr("y", d => yScalePercent(d[1]))
                .attr("height", d => yScalePercent(d[0]) - yScalePercent(d[1]))
                .attr("width", xYearScale.bandwidth())
                .each(function(d) {
                    const currentKey = d3.select(this.parentNode).datum().key;
                    const percentage = d.data.total > 0 ? d.data[currentKey] / d.data.total : 0;
                    
                    d3.select(this).append("title")
                        .text(`${d.data.year} - ${currentKey}: ${d3.format(".1%")(percentage)}`);
                });
                
        } else {
            // --- DRAW HORIZONTAL STACKED BAR CHART (AGGREGATE/SINGLE YEAR) ---
            
            const xScaleStack = d3.scaleLinear()
                .domain([0, 1]) 
                .range([0, DETAIL_INNER_WIDTH]);

            const yScaleStack = d3.scaleBand()
                .domain([dataForPlot[0].year]) 
                .range([0, DETAIL_INNER_HEIGHT])
                .padding(0.3);

            // Draw X Axis (percentage axis)
            barG.append("g")
                .attr("transform", `translate(0,${DETAIL_INNER_HEIGHT})`)
                .call(d3.axisBottom(xScaleStack).ticks(5).tickFormat(d3.format(".0%"))); 

            // Draw Y Axis (Year axis) - Ẩn nhãn cho thanh đơn
            barG.append("g")
                .call(d3.axisLeft(yScaleStack).tickSize(0).tickFormat(() => ''));

            // Draw Bars
            barG.append("g")
                .selectAll("g")
                .data(series)
                .join("g")
                .attr("fill", d => TYPE_COLORS(d.key))
                .selectAll("rect")
                .data(d => d)
                .join("rect")
                .attr("class", "detail-bar-horizontal")
                .attr("x", d => xScaleStack(d[0])) 
                .attr("y", d => yScaleStack(d.data.year))
                .attr("width", d => xScaleStack(d[1]) - xScaleStack(d[0])) 
                .attr("height", yScaleStack.bandwidth())
                .each(function(d) {
                    const currentKey = d3.select(this.parentNode).datum().key;
                    const percentage = d.data.total > 0 ? d.data[currentKey] / d.data.total : 0;
                    
                    d3.select(this).append("title")
                        .text(`${currentKey}: ${d3.format(".1%")(percentage)}`);
                        
                    if (percentage > 0.05) { 
                        barG.append("text")
                            .attr("x", xScaleStack(d[0]) + (xScaleStack(d[1]) - xScaleStack(d[0])) / 2) 
                            .attr("y", yScaleStack(d.data.year) + yScaleStack.bandwidth() / 2 + 3)
                            .attr("text-anchor", "middle")
                            .style("fill", "#fff")
                            .style("font-size", "10px")
                            .text(d3.format(".0%")(percentage));
                    }
                });
        }

        // Legend logic remains the same
        const legendBar = barG.append("g").attr("transform", `translate(0, ${DETAIL_INNER_HEIGHT + 20})`);
        
        typeKeys.forEach((key, i) => {
            legendBar.append("rect")
                .attr("x", i * 140)
                .attr("width", 8)
                .attr("height", 8)
                .attr("fill", TYPE_COLORS(key));
            legendBar.append("text")
                .attr("x", i * 140 + 10)
                .attr("y", 8)
                .style("font-size", "10px")
                .text(key.split(' ')[0]);
        });
    }
}

// ----------------------------------------------------------------------
// SWITCHING AND INITIALIZATION LOGIC (MAIN)
// ----------------------------------------------------------------------

function switchChart(chartId) {
    currentHoveredNode = null; 
    currentChart = chartId;
    
    d3.select("#detail-panel").classed("locked", false);
    d3.select("#detail-panel").select('.panel-title').text('Detail Information');

    d3.selectAll(".tab-button").classed("active", false);
    d3.select(`[data-chart="${chartId}"]`).classed("active", true);

    const totalCasualties = d3.sum(rawProcessedData, d => d.best);
    const totalEvents = rawProcessedData.length;
    d3.select("#totalCasualties").text(d3.format(",")(totalCasualties));
    d3.select("#totalEvents").text(d3.format(",")(totalEvents));
    
    // Reset Detail Panel when switching charts
    d3.select(".detail-info-column").html(`<p class="initial-msg">Hover over a bubble/dot to see detail information.</p>`);
    d3.select(".detail-chart-column").html('');


    if (chartId === 'chart3') {
        if (!activeRegions.includes('Global') && activeRegions.every(r => !REGION_COLORS.hasOwnProperty(r))) {
             activeRegions = ['Global']; 
        }
    } else {
        const allRegionsKeys = Object.keys(REGION_COLORS);
        activeRegions = allRegionsKeys.filter(r => activeRegions.includes(r));
        if (activeRegions.length === 0 || activeRegions.includes('Global')) {
            activeRegions = allRegionsKeys; 
        }
    }
    
    // Update legend
    createLegend(REGION_COLORS); 
    
    // Update active state for legend
    d3.selectAll(".legend-item").classed("active", function() {
        const regionName = d3.select(this).attr("data-region");
        return activeRegions.includes(regionName);
    });

    switch (chartId) {
        case 'chart1':
            drawChart1();
            break;
        case 'chart2':
            drawChart2();
            break;
        case 'chart3':
            drawChart3();
            break;
        case 'chart4':
            drawChart4();
            break;
    }
}

// ----------------------------------------------------------------------
// MAIN CHART DRAWING FUNCTIONS (Kept as is - only detail panel logic changed)
// ----------------------------------------------------------------------
function drawChart1() {
    cleanChartArea();
    
    gChart.append("text")
        .attr("class", "chart-title")
        .attr("x", innerWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Aggregated Casualties by Country (Bubble Size)");

    const filteredData = rawProcessedData.filter(d => activeRegions.includes(d.region));
    const aggregatedData = aggregateDataByCountry(filteredData);

    const root = d3.hierarchy({ children: aggregatedData })
        .sum(d => d.best)
        .sort((a, b) => b.value - a.value);

    const packLayout = d3.pack()
        .size([innerWidth, innerHeight])
        .padding(2);

    const nodes = packLayout(root).leaves();
    const t = svg.transition().duration(800);

    let node = gChart.selectAll(`.bubble-group.chart-${currentChart}`).data(nodes, d => d.data.name); 

    // EXIT
    node.exit().transition(t).remove();

    // ENTER
    const nodeEnter = node.enter().append("g")
        .attr("class", `bubble-group node chart-${currentChart}`)
        .attr("transform", d => `translate(${innerWidth / 2},${innerHeight / 2})`); 

    // CIRCLE
    nodeEnter.append("circle")
        .attr("r", 0)
        .attr("fill", d => regionScale(d.data.region)) 
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .style("opacity", 0.85)
        // **SỬA LỖI HOVER:** Xóa timeout cũ khi hover vào bubble mới
        .on("mouseover", (event, d) => {
             if (hoverTimeout) clearTimeout(hoverTimeout);
             showFullDetail(d);
         })
        .on("click", (event, d) => {
             d3.select("#detail-panel").classed("locked", false).select('.panel-title').text('Detail Information');
             showFullDetail(d);
        })
        .on("mouseout", hideDetail);


    // TEXT (Country)
    nodeEnter.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .style("fill", "#fff")
        .style("pointer-events", "none")
        .text(d => d.data.name)
        .style("font-size", "10px");


    // UPDATE + ENTER (Transition)
    node = nodeEnter.merge(node);

    node.transition(t)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.select("circle").transition(t)
        .attr("r", d => d.r);
        
    node.select("text").transition(t)
        .style("display", d => d.r < 30 ? "none" : "block");

    // TOOLTIP (Title - fallback)
    node.append("title")
        .text(d => `${d.data.name} (${d.data.region}) \nTotal Casualties: ${d3.format(",")(d.data.best)}`);
}

function drawChart2() {
    cleanChartArea();
    
    gChart.append("text")
        .attr("class", "chart-title")
        .attr("x", innerWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Casualty Breakdown by Violence Type (Bubble is Country)");

    const filteredData = rawProcessedData.filter(d => activeRegions.includes(d.region));

    const groupedData = Array.from(d3.group(filteredData,
        d => d.type_of_violence_name
    ), ([type, typeGroup]) => {
        const aggregatedCountries = aggregateDataByCountry(typeGroup); 
        const regions = Array.from(d3.group(aggregatedCountries, d => d.region),
            ([region, countries]) => ({ 
                name: region, 
                children: countries 
            })
        );
        return { name: type, children: regions };
    });

    const types = Array.from(new Set(filteredData.map(d => d.type_of_violence_name)));
    const numTypes = types.length;
    const subChartWidth = innerWidth / numTypes;

    gChart.selectAll('.chart-header').data(types).join(
        enter => enter.append('text')
            .attr('class', 'chart-header')
            .attr('x', (d, i) => i * subChartWidth + subChartWidth / 2)
            .attr('y', innerHeight + 40) 
            .attr('text-anchor', 'middle')
            .text(d => d)
            .style('fill', '#333')
            .style('font-weight', 'bold')
    );

    groupedData.forEach((group, i) => {
        const xOffset = i * subChartWidth;
        const availableWidth = subChartWidth - 10;
        const availableHeight = innerHeight;

        const root = d3.hierarchy(group)
            .sum(d => d.best)
            .sort((a, b) => b.value - a.value);

        const packLayout = d3.pack()
            .size([availableWidth, availableHeight])
            .padding(4);

        const nodes = packLayout(root).leaves();
        const t = svg.transition().duration(800);

        let node = gChart.selectAll(`.bubble-group.type-${escapeHtmlId(group.name)}`).data(nodes, d => d.data.name + group.name); 

        // EXIT
        node.exit().transition(t).remove();

        // ENTER
        const nodeEnter = node.enter().append("g")
            .attr("class", `bubble-group node chart-${currentChart}`)
            .attr("transform", d => `translate(${xOffset + availableWidth / 2},${availableHeight / 2})`);

        // CIRCLE (Color by Region/Continent)
        nodeEnter.append("circle")
            .attr("r", 0)
            .attr("fill", d => regionScale(d.data.region))
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5)
            .style("opacity", 0.85)
        // **SỬA LỖI HOVER:** Xóa timeout cũ khi hover vào bubble mới
            .on("mouseover", (event, d) => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                showFullDetail({
                    data: {
                        ...d.data, 
                        type_of_violence_name: group.name, 
                        detail: d.data.detail
                    }
                });
             }) 
             .on("click", (event, d) => {
                 d3.select("#detail-panel").classed("locked", false).select('.panel-title').text('Detail Information');
                 showFullDetail({
                     data: {
                         ...d.data, 
                         type_of_violence_name: group.name, 
                         detail: d.data.detail
                     }
                 });
             })
            .on("mouseout", hideDetail); 


        // TEXT (Country)
        nodeEnter.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .style("fill", "#fff")
            .style("pointer-events", "none")
            .text(d => d.data.name)
            .style("font-size", "10px");


        // UPDATE + ENTER (Transition)
        node = nodeEnter.merge(node);

        node.transition(t)
            .attr("transform", d => `translate(${xOffset + d.x},${d.y})`);

        node.select("circle").transition(t)
            .attr("r", d => d.r);
            
        node.select("text").transition(t)
            .style("display", d => d.r < 30 ? "none" : "block");
    });
}

function drawChart3() {
    cleanChartArea();
    
    const dataForGlobalCalculation = rawProcessedData;
    
    // 1. Group data by Year and Region
    const yearlyRegionalData = Array.from(d3.group(dataForGlobalCalculation, d => d.region),
        ([region, regionGroup]) => ({
            name: region,
            values: Array.from(d3.rollup(regionGroup,
                v => d3.sum(v, d => d.best),
                d => d.year
            ), ([year, best]) => ({ year: +year, best: best })).sort((a, b) => a.year - b.year)
        })
    );

    // 2. Global total data
    const yearlyGlobalData = {
        name: 'Global',
        values: Array.from(d3.rollup(dataForGlobalCalculation,
            v => d3.sum(v, d => d.best),
            d => d.year
        ), ([year, best]) => ({ year: +year, best: best })).sort((a, b) => a.year - b.year)
    };
    
    const allLineData = [...yearlyRegionalData, yearlyGlobalData];
    
    // Filter only selected regions (from legend)
    let dataToDraw = allLineData.filter(d => activeRegions.includes(d.name));
    
    // 3. Set up Axes
    const allYears = d3.extent(dataForGlobalCalculation, d => d.year);
    const maxAllBest = d3.max(allLineData.flatMap(d => d.values), d => d.best) || 0; 

    const xScale = d3.scaleLinear()
        .domain(allYears)
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, maxAllBest * 1.1 || 10]) 
        .range([innerHeight, 0]);

    gChart.selectAll('.x-axis, .y-axis').remove();

    // 4. Draw Axes and Title
    gChart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d"))); 

    gChart.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).ticks(5, "s"))
        .append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -innerHeight / 2).attr("dy", "1em")
        .attr("fill", "#000").attr("text-anchor", "middle").attr("font-size", 14)
        .text("Total Casualties (BEST)");

    gChart.append("text")
        .attr("class", "chart-title")
        .attr("x", innerWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("UCDP GED Casualty Trends Over Years by Region");

    // 5. Define Line
    const line = d3.line()
        .defined(d => d.best !== null && d.best !== undefined && !isNaN(d.best)) 
        .x(d => xScale(d.year))
        .y(d => yScale(d.best))
        .curve(d3.curveMonotoneX);

    // 6. Draw/Update Line
    gChart.selectAll(".line-group")
        .data(dataToDraw, d => d.name) 
        .join(
            enter => enter.append("path")
                .attr("class", d => `line-group line-${escapeHtmlId(d.name)}`)
                .attr("fill", "none")
                .attr("stroke-width", d => (d.name === 'Global' ? 4 : 2))
                .attr("stroke", d => (d.name === 'Global' ? '#000' : regionScale(d.name)))
                .attr("d", d => line(d.values))
                .style("opacity", 0)
                .call(enter => enter.transition().duration(1000).style("opacity", 1)),
            update => update.transition().duration(1000)
                .attr("d", d => line(d.values))
                .attr("stroke-width", d => (d.name === 'Global' ? 4 : 2))
                .attr("stroke", d => (d.name === 'Global' ? '#000' : regionScale(d.name)))
                .style("opacity", 1),
            exit => exit.transition().duration(500).style("opacity", 0).remove()
        );

    // 7. Update legend
    let updatedColors = {...REGION_COLORS};
    updatedColors['Global'] = '#000';
    createLegend(updatedColors); 
    
    // 8. Add/update hover event for data points (dots)
    const dotGroups = gChart.selectAll(".dot-group")
        .data(dataToDraw, d => d.name)
        .join("g")
        .attr("class", "dot-group");

    dotGroups.selectAll(".dot")
        .data(d => d.values)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.best))
        .attr("r", 3)
        .attr("fill", "#d62728") // DOT color is RED
        .attr("stroke", "#000")
        .attr("stroke-width", 0)
        // **SỬA LỖI HOVER:** Xóa timeout cũ khi hover vào dot mới
        .on("mouseover", function(event, d) {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            const regionName = d3.select(this.parentNode).datum().name;
            
            // Highlight DOT being hovered
            d3.select(this)
                .transition().duration(100)
                .attr("r", 6) // MAKE DOT BIGGER
                .attr("fill", "#1f77b4") // Highlight color is BLUE
                .attr("stroke-width", 1.5);

            // Save data of this dot into currentHoveredNode (use a dummy structure)
            currentHoveredNode = { 
                data: { 
                    name: regionName, 
                    detail: [{ year: d.year, best: d.best }], 
                    best: d.best 
                } 
            }; 

            // CALL NEW FUNCTION TO DISPLAY DETAIL
            showYearDetail(d, regionName);
        })
        .on("click", function(event, d) {
             const regionName = d3.select(this.parentNode).datum().name;
             d3.select("#detail-panel").classed("locked", false).select('.panel-title').text('Detail Information');
             // Save data and call again
             currentHoveredNode = { 
                 data: { 
                     name: regionName, 
                     detail: [{ year: d.year, best: d.best }],
                     best: d.best 
                 } 
             }; 
             showYearDetail(d, regionName);
        })
        .on("mouseout", function(event, d) {
            // Revert DOT to original size
            d3.select(this)
                .transition().duration(100)
                .attr("r", 3)
                .attr("fill", "#d62728")
                .attr("stroke-width", 0);
            
            hideDetail(event, currentHoveredNode); 
        })
        .append("title")
        .text(d => `${d3.select(this.parentNode).datum().name} (${d.year}): ${d3.format(",")(d.best)}`);
}

function drawChart4() {
    cleanChartArea();
    
    gChart.append("text")
        .attr("class", "chart-title")
        .attr("x", innerWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text(`Top ${CHART4_COUNTRY_LIMIT} Countries with Highest Casualties (Size: Violence Type)`);

    // FILTER DATA BY CONTINENT
    const filteredData = rawProcessedData.filter(d => activeRegions.includes(d.region));

    // 1. Get Top 15 Countries (with filtered data)
    const countryAgg = Array.from(d3.rollup(filteredData,
        v => ({
            best: d3.sum(v, d => d.best),
            events: v.length,
            region: v[0].region
        }),
        d => d.country
    )).map(([country, values]) => ({ name: country, ...values }))
      .filter(d => d.best > 0) 
      .sort((a, b) => b.best - a.best)
      .slice(0, CHART4_COUNTRY_LIMIT); 

    const countryNames = countryAgg.map(c => c.name);

    const groupedData = Array.from(d3.group(filteredData.filter(d => countryNames.includes(d.country)), d => d.country), 
        ([country, countryGroup]) => {
            const countryInfo = countryAgg.find(c => c.name === country);

            const types = Array.from(d3.rollup(countryGroup,
                v => d3.sum(v, d => d.best),
                d => d.type_of_violence_name
            ), ([type, value]) => ({ name: type, best: value, region: countryInfo.region }));

            return { 
                name: country, 
                children: types, 
                region: countryInfo.region,
                total_best: countryInfo.best,
                total_events: countryInfo.events,
                detail: countryGroup 
            };
    }).filter(d => d !== null).sort((a, b) => b.total_best - a.total_best);

    const numCountries = groupedData.length;
    const numCols = CHART4_NUM_COLS; // 3 columns
    const subChartWidth = innerWidth / numCols;
    const numRows = Math.ceil(numCountries / numCols);
    const subChartHeight = numRows > 0 ? innerHeight / numRows : innerHeight; 

    const t = svg.transition().duration(800);

    groupedData.forEach((group, i) => {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        const xOffset = col * subChartWidth;
        const yOffset = row * subChartHeight;

        const packLayout = d3.pack()
            .size([subChartWidth - 10, subChartHeight - 40]) // Subtract space for header 
            .padding(1);

        const root = d3.hierarchy(group)
            .sum(d => d.best) 
            .sort((a, b) => b.value - a.value);
        
        const nodes = root.children ? packLayout(root).leaves() : [];

        // Country Header (Positioning country name and figures)
        const headerG = gChart.append('g')
            .attr("class", "chart-header-group")
            .attr("transform", `translate(${xOffset + subChartWidth / 2},${yOffset + 10})`);
            
        headerG.append('text')
            .attr("class", "chart-header country-name")
            .attr("text-anchor", "middle")
            .attr("y", 0)
            .text(group.name)
            .style("fill", regionScale(group.region))
            .style("font-weight", "bold")
            .style("font-size", "14px");

        headerG.append('text')
            .attr("class", "chart-header event-count")
            .attr("text-anchor", "middle")
            .attr("y", 15)
            .text(`Events: ${d3.format(",")(group.total_events)}`)
            .style("font-size", "10px");
            
        headerG.append('text')
            .attr("class", "chart-header casualty-count")
            .attr("text-anchor", "middle")
            .attr("y", 28)
            .text(`Casualties: ${d3.format(",")(group.total_best)}`)
            .style("font-size", "10px");


        let node = gChart.selectAll(`.bubble-group.country-${escapeHtmlId(group.name)}`).data(nodes, d => d.data.name + group.name);

        // EXIT
        node.exit().transition(t).remove();

        // ENTER
        const nodeEnter = node.enter().append("g")
            .attr("class", `bubble-group node chart-${currentChart}`)
            .attr("transform", d => `translate(${xOffset + subChartWidth / 2},${yOffset + subChartHeight / 2})`);

        // CIRCLE (Color by Violence Type)
        nodeEnter.append("circle")
            .attr("r", 0)
            .attr("fill", d => TYPE_COLORS(d.data.name)) 
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5)
            .style("opacity", 0.85)
        // **SỬA LỖI HOVER:** Xóa timeout cũ khi hover vào bubble mới
            .on("mouseover", (event, d) => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                showFullDetail({
                    data: {
                        name: group.name, 
                        region: group.region, 
                        best: d.data.best, 
                        events: group.detail.length, 
                        detail: group.detail, 
                        type_of_violence_name: d.data.name 
                    }
                });
            }) 
             .on("click", (event, d) => {
                  d3.select("#detail-panel").classed("locked", false).select('.panel-title').text('Detail Information');
                  showFullDetail({
                      data: {
                          name: group.name, 
                          region: group.region, 
                          best: d.data.best, 
                          events: group.detail.length, 
                          detail: group.detail, 
                          type_of_violence_name: d.data.name 
                      }
                  });
             })
            .on("mouseout", hideDetail);


        // TEXT (Violence Type Name)
        nodeEnter.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .style("fill", "#fff")
            .style("pointer-events", "none")
            .text(d => d.data.name.split(' ')[0]) 
            .style("font-size", "8px")
            .filter(d => d.r < 10)
            .remove();

        // UPDATE + ENTER (Transition)
        node = nodeEnter.merge(node);

        node.transition(t)
            .attr("transform", d => `translate(${xOffset + d.x},${yOffset + d.y + 35})`); // Adjust Y offset

        node.select("circle").transition(t)
            .attr("r", d => d.r);
    });
}


// --- MAIN INITIALIZATION (Load CSV Data) ---
document.addEventListener('DOMContentLoaded', function() {
    d3.csv(CSV_FILE_PATH)
        .then(rawData => {
            rawProcessedData = processRawData(rawData);

            if (rawProcessedData.length === 0) {
                 console.error("No valid data found (best > 0) in CSV.");
                 d3.select("#totalCasualties").text("No Data");
                 d3.select("#chart-tabs").style("display", "none"); 
                 return;
            }

            const totalCasualties = d3.sum(rawProcessedData, d => d.best);
            const totalEvents = rawProcessedData.length;
            d3.select("#totalCasualties").text(d3.format(",")(totalCasualties));
            d3.select("#totalEvents").text(d3.format(",")(totalEvents));

            // 1. Create default legend 
            activeRegions = Object.keys(REGION_COLORS);
            createLegend(REGION_COLORS);

            // 2. Set up tab switching events
            d3.selectAll(".tab-button").on("click", function() {
                const chartId = d3.select(this).attr("data-chart");
                switchChart(chartId);
            });

            // 3. Draw default chart (Chart 3)
            switchChart('chart3');
        })
        .catch(error => {
            console.error(`ERROR: Could not load CSV file from path: ${CSV_FILE_PATH}. Please ensure the file is unzipped and in the same directory.`, error);
            d3.select("#totalCasualties").text("CSV LOAD ERROR");
        });
});