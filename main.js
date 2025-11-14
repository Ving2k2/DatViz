let RAW = [];
let MASTER_ACTOR_LIST = [];
let FULL_YEAR_LIST = [];
let UNIQUE_REGIONS = []; 

const CSV_PATH = "GEDEvent_v25_1.csv";

// Map numerical codes to names
const TYPE_MAPPING = {
    "1": "State-based",
    "2": "Non-state",
    "3": "One-sided"
};

// === FIXED COLORS ===
const GLOBAL_TYPE_COLORS = {
    domain: ["State-based", "Non-state", "One-sided"],
    range: ["#d9534f", "#f0ad4e", "#0275d8"] // Red, Orange, Blue
};
const DETAILED_FATALITY_COLORS = {
    domain: ["Actor 1", "Opponent", "Civilians", "Unknown"], 
    range: ["#0275d8", "#f0ad4e", "#5cb85c", "#999999"] 
};

// === FIXED LARGE SIZE DEFINITIONS ===
const fixedChartWidth = 1000; 
const fullWidthHeight = 400;
const smallMultiplesHeight = 120; 
const barChartHeight = 450;


window.addEventListener("DOMContentLoaded", async () => {
    try {
        const rows = await d3.csv(CSV_PATH, d => ({
            ...d,
            best: +d.best || 0,
            deathsA: +d.deaths_a || 0,
            deathsB: +d.deaths_b || 0,
            deathsCivilians: +d.deaths_civilians || 0,
            deathsUnknown: +d.deaths_unknown || 0,
            where_prec: +d.where_prec,
            year: +d.year,
            id: d.ged_id 
        }));

        RAW = rows;
        const allSideA = RAW.map(d => d.side_a);
        const allSideB = RAW.map(d => d.side_b);
        MASTER_ACTOR_LIST = ["All", ...Array.from(new Set([...allSideA, ...allSideB])).filter(Boolean).sort()];
        FULL_YEAR_LIST = ["All", ...Array.from(new Set(RAW.map(d => d.year))).filter(Boolean).sort()];
        UNIQUE_REGIONS = ["All", ...Array.from(new Set(RAW.map(d => d.region))).filter(Boolean).sort()]; 

        initFilters();
        renderDashboard();
    } catch (error) {
        console.error("DATA LOAD ERROR:", error);
        alert("Could not load GEDEvent_v25_1.csv. Check file name and make sure you are running on a web server (Go Live).");
    }
});

/* ---------- 1. Filter UI & Logic ---------- */

function initFilters() {
    // Only initialize Region filter, others are handled by updateDependentFiltersByRegion
    fillSelect("regionSelect", UNIQUE_REGIONS);

    fillSelect("actor1Select", MASTER_ACTOR_LIST);
    fillSelect("yearSelect", FULL_YEAR_LIST);
    fillSelect("actor2Select", ["All"]);
    
    const uniqueTypes = ["All", ...Array.from(new Set(RAW.map(d => d.type_of_violence))).filter(Boolean).sort()];
    document.getElementById("typeSelect").innerHTML = uniqueTypes.map(v => {
        const label = v === "All" ? "All" : TYPE_MAPPING[v] || `Unknown (${v})`;
        return `<option value="${v}">${label}</option>`;
    }).join("");

    // Primary filter listeners (Region and Actor 1)
    document.getElementById("regionSelect").addEventListener("change", handleFilterChange); 
    document.getElementById("actor1Select").addEventListener("change", handleFilterChange);
    
    // Secondary filter listeners (just trigger render)
    document.getElementById("actor2Select").addEventListener("change", renderDashboard);
    document.getElementById("yearSelect").addEventListener("change", renderDashboard);
    document.getElementById("typeSelect").addEventListener("change", renderDashboard);
}

// Function to manage filter changes and dependencies
function handleFilterChange(event) {
    const changedId = event.target.id;
    
    if (changedId === "regionSelect") {
        updateDependentFiltersByRegion();
    } 
    else if (changedId === "actor1Select") {
        updateDependentFiltersByActor();
    } else {
        renderDashboard();
    }
}


function updateDependentFiltersByRegion() {
    const selectedRegion = document.getElementById("regionSelect").value;
    const actor1Select = document.getElementById("actor1Select");
    const yearSelect = document.getElementById("yearSelect");
    const typeSelect = document.getElementById("typeSelect");
    const actor2Select = document.getElementById("actor2Select");

    // Get current filter values to maintain selection if possible
    const currentActor1 = actor1Select.value;
    const currentYear = yearSelect.value;
    const currentType = typeSelect.value;

    const isRegionSelected = selectedRegion !== "All";
    
    // Logic 1: Reset everything to Global scope if Region is "All"
    if (!isRegionSelected) {
        // Reset lists to Global
        fillSelect("actor1Select", MASTER_ACTOR_LIST);
        fillSelect("yearSelect", FULL_YEAR_LIST);
        fillSelect("actor2Select", ["All"]);
        actor2Select.disabled = true;

        const uniqueTypes = ["All", ...Array.from(new Set(RAW.map(d => d.type_of_violence))).filter(Boolean).sort()];
        document.getElementById("typeSelect").innerHTML = uniqueTypes.map(v => {
            const label = v === "All" ? "All" : TYPE_MAPPING[v] || `Unknown (${v})`;
            return `<option value="${v}">${label}</option>`;
        }).join("");
        
        // Disable dependent filters
        actor1Select.disabled = true;
        yearSelect.disabled = true;
        typeSelect.disabled = true;
        
        // Reset values
        actor1Select.value = "All";
        yearSelect.value = "All";
        typeSelect.value = "All";

        renderDashboard();
        return;
    }
    
    // Logic 2: Region selected -> Activate and narrow down
    let filteredByRegion = RAW.filter(d => d.region === selectedRegion);
    
    // Enable dependent filters
    actor1Select.disabled = false;
    yearSelect.disabled = false;
    typeSelect.disabled = false;
    
    // Gather lists for dependent filters based on selected Region
    const activeActors = new Set();
    const activeYears = new Set();
    const activeTypes = new Set();
    
    filteredByRegion.forEach(d => {
        if (d.side_a) activeActors.add(d.side_a);
        if (d.side_b) activeActors.add(d.side_b);
        activeYears.add(d.year);
        activeTypes.add(d.type_of_violence);
    });
    
    // Update Actor 1 list
    const newActorList = ["All", ...Array.from(activeActors).filter(Boolean).sort()];
    fillSelect("actor1Select", newActorList);

    // Update Year list
    const newYearList = ["All", ...Array.from(activeYears).filter(Boolean).sort()];
    fillSelect("yearSelect", newYearList);

    // Update Type list
    const newTypeOptions = ["All", ...Array.from(activeTypes).filter(Boolean).sort()];
    document.getElementById("typeSelect").innerHTML = newTypeOptions.map(v => {
        const label = v === "All" ? "All" : TYPE_MAPPING[v] || `Unknown (${v})`;
        return `<option value="${v}">${label}</option>`;
    }).join("");


    // Maintain/Reset selections
    if (newActorList.includes(currentActor1)) {
        actor1Select.value = currentActor1;
    } else {
        actor1Select.value = "All";
        fillSelect("actor2Select", ["All"]);
        actor2Select.disabled = true;
    }
    
    if (newYearList.includes(currentYear)) {
        yearSelect.value = currentYear;
    } else {
        yearSelect.value = "All";
    }
    
    const newTypeValues = ["All", ...Array.from(activeTypes)];
    if (newTypeValues.includes(currentType)) {
        typeSelect.value = currentType;
    } else {
        typeSelect.value = "All";
    }
    
    // If Actor 1 is still selected (not "All"), run Actor logic to further filter
    if (actor1Select.value !== "All") {
         updateDependentFiltersByActor(filteredByRegion);
    } else {
         renderDashboard();
    }
}


function updateDependentFiltersByActor(baseData = RAW) {
    const selectedActor1 = document.getElementById("actor1Select").value;
    const actor2Select = document.getElementById("actor2Select");
    const regionSelect = document.getElementById("regionSelect");
    const yearSelect = document.getElementById("yearSelect");
    const typeSelect = document.getElementById("typeSelect");

    const currentRegion = regionSelect.value;
    
    // Determine the data scope: Dữ liệu đã lọc theo Region (nếu có)
    let dataToFilter = baseData;
    if (currentRegion !== "All" && baseData === RAW) { 
        dataToFilter = RAW.filter(d => d.region === currentRegion);
    }

    if (selectedActor1 === "All") {
        // Actor 1 is reset to "All". Go back to Region-based filtering logic
        updateDependentFiltersByRegion();
        return; 

    } else {
        // Lọc các sự kiện liên quan đến Actor 1 TRONG phạm vi dữ liệu đã lọc (Region)
        const actor1Events = dataToFilter.filter(d => d.side_a === selectedActor1 || d.side_b === selectedActor1);

        // Preserve current selections before updating lists
        const currentYear = yearSelect.value;
        const currentType = typeSelect.value;
        const currentActor2 = actor2Select.value;
        const currentRegionSelection = regionSelect.value;
        
        // 1. Update Actor 2 (Opponent) list
        const opponents = new Set();
        actor1Events.forEach(d => {
            if (d.side_a === selectedActor1) opponents.add(d.side_b);
            if (d.side_b === selectedActor1) opponents.add(d.side_a);
        });
        const newOpponentList = ["All", ...Array.from(opponents).filter(Boolean).sort()];
        fillSelect("actor2Select", newOpponentList);
        actor2Select.disabled = false;
        if (newOpponentList.includes(currentActor2)) actor2Select.value = currentActor2;
        
        // 2. Update Year list
        const activeYears = new Set(actor1Events.map(d => d.year));
        const newYearList = ["All", ...Array.from(activeYears).filter(Boolean).sort()];
        fillSelect("yearSelect", newYearList);
        if (newYearList.includes(currentYear)) yearSelect.value = currentYear;
        
        // 3. Update Type list
        const activeTypes = new Set(actor1Events.map(d => d.type_of_violence));
        const newTypeOptions = ["All", ...Array.from(activeTypes).filter(Boolean).sort()];
        document.getElementById("typeSelect").innerHTML = newTypeOptions.map(v => {
            const label = v === "All" ? "All" : TYPE_MAPPING[v] || `Unknown (${v})`;
            return `<option value="${v}">${label}</option>`;
        }).join("");
        const newTypeValues = ["All", ...Array.from(activeTypes)];
        if (newTypeValues.includes(currentType)) typeSelect.value = currentType;
        
        // 4. Update Region list (Keep the selection list to the full global list so the user can switch regions easily)
        // **Đây là phần sửa lỗi: Luôn reset danh sách Region về UNIQUE_REGIONS (Global) nếu Region KHÔNG phải là "All"**
        if (currentRegionSelection === "All") {
             const activeRegions = new Set(actor1Events.map(d => d.region));
             const newRegionList = ["All", ...Array.from(activeRegions).filter(Boolean).sort()];
             fillSelect("regionSelect", newRegionList);
             regionSelect.value = "All"; 
        } else {
             // Nếu đã chọn Region cụ thể (currentRegionSelection), danh sách Region luôn phải là danh sách Master (UNIQUE_REGIONS)
             // để người dùng có thể chọn vùng khác.
             fillSelect("regionSelect", UNIQUE_REGIONS);
             regionSelect.value = currentRegionSelection;
        }
    }
    renderDashboard();
}


function fillSelect(id, arr) {
    document.getElementById(id).innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join("");
}

function getFiltered() {
    const y = document.getElementById("yearSelect").value;
    const a1 = document.getElementById("actor1Select").value;
    const a2 = document.getElementById("actor2Select").value;
    const t = document.getElementById("typeSelect").value;
    const r = document.getElementById("regionSelect").value; 

    return RAW.filter(d => {
        const yearMatch = (y === "All" || d.year == y);
        const typeMatch = (t === "All" || d.type_of_violence == t);
        const regionMatch = (r === "All" || d.region == r); 

        if (!yearMatch || !typeMatch || !regionMatch) return false;
        
        if (a1 === "All") return true;
        if (a2 === "All") return (d.side_a === a1 || d.side_b === a1);
        return (d.side_a === a1 && d.side_b === a2) || (d.side_a === a2 && d.side_b === a1);
    });
}

/* ---------- 2. Render Scenario Management ---------- */

function renderDashboard() {
    const a1 = document.getElementById("actor1Select").value;
    
    // Logic: If Actor 1 is 'All', show the Global Dashboard. Otherwise, show the Detailed Dashboard.
    if (a1 === "All") {
        renderGlobalDashboard();
    } else {
        renderDetailedDashboard();
    }
}

/* ---------- 3. SCENARIO 1: GLOBAL DASHBOARD (UPDATED) ---------- */

function renderGlobalDashboard() {
    const filteredData = getFiltered();
    const regionSelect = document.getElementById("regionSelect").value;

    // Update HTML titles based on filter state (Removed numbers)
    document.getElementById("dashboard").innerHTML = `
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Fatality Breakdown over Time (100% Stacked Area)</h2>
                <p>Analysis of the proportional change in fatalities by ${regionSelect === "All" ? 'region' : 'violence type'} over time within the filtered scope.</p>
                <div id="chart-global-death-breakdown"></div>
            </div>
        </div>
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Small Multiples: Fatality Trends by Region</h2>
                <p>Comparison of fatality trends over time across different regions. The Y-axis uses a linear scale to represent the total number of fatalities.</p>
                <div id="chart-global-small-multiples"></div>
            </div>
        </div>
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Top Countries by Violence Type (Stacked Bar)</h2>
                <p>Analysis of total fatalities for the top 15 countries by the three main types of violence.</p>
                <div id="chart-global-stacked-bar"></div>
            </div>
        </div>
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Event Contribution by Violence Type (Waffle Chart)</h2>
                <p>A waffle chart displaying the proportion of event counts (not fatalities) for each violence type.</p>
                <div id="chart-global-regional-waffle"></div>
            </div>
        </div>
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Heatmap: Event Density (Year vs. Region)</h2>
                <p>A heatmap showing the density of *event counts* across years and regions.</p>
                <div id="chart-global-heatmap-count"></div>
            </div>
        </div>
        <div class="chart-row-1"> <div class="chart-cell">
                <h2>Heatmap: Data Quality (Year vs. Location Precision)</h2>
                <p>Assesses data quality. Darker colors indicate a higher number of events with high location precision (1 = Best, 7 = Worst) per year.</p>
                <div id="chart-global-heatmap-quality"></div>
            </div>
        </div>
    `;

    // DETERMINE DATA GROUPING FOR CHART 2
    let breakdownData;
    let breakdownField;
    let breakdownDomain;
    let breakdownRange;

    if (regionSelect === "All") {
        // CASE 1: GLOBAL SCOPE (Group by Region)
        breakdownData = Array.from(
            d3.rollups(filteredData, 
                v => d3.sum(v, d => d.best), 
                d => d.year,
                d => d.region
            ),
            ([year, regions]) => regions.map(([region, total]) => ({ year: year, category: region, total_deaths: total }))
        ).flat();
        breakdownField = "region";
        breakdownDomain = UNIQUE_REGIONS.filter(r => r !== "All");
        breakdownRange = d3.schemeCategory10;

    } else {
        // CASE 2: REGION SELECTED (Group by Violence Type)
        breakdownData = Array.from(
            d3.rollups(filteredData, 
                v => d3.sum(v, d => d.best), 
                d => d.year,
                d => d.type_of_violence
            ),
            ([year, types]) => types.map(([typeCode, total]) => ({ 
                year: year, 
                category: TYPE_MAPPING[typeCode] || `Unknown (${typeCode})`, 
                total_deaths: total 
            }))
        ).flat();
        breakdownField = "type_of_violence";
        breakdownDomain = GLOBAL_TYPE_COLORS.domain;
        breakdownRange = GLOBAL_TYPE_COLORS.range;
    }
    
    // RENDER CHART 2
    renderGlobal_Breakdown(breakdownData, breakdownField, breakdownDomain, breakdownRange); 

    // RENDER CHART 7: Waffle Chart (Violence Type)
    const violenceTypeEventCountData = Array.from(
        d3.rollups(filteredData, v => v.length, d => d.type_of_violence),
        ([typeCode, count]) => ({ 
            type_of_violence: typeCode, 
            type_label: TYPE_MAPPING[typeCode] || `Unknown (${typeCode})`,
            event_count: count 
        })
    ).filter(d => d.event_count > 0);
    renderGlobal_ViolenceTypeWaffleChart(violenceTypeEventCountData); 

    // RENDER CHART 4: Heatmap Count
    const heatmapCountData = Array.from(
        d3.rollups(filteredData, v => v.length, d => d.year, d => d.region),
        ([year, regions]) => regions.map(([region, count]) => ({ year, region, event_count: count }))
    ).flat();
    renderGlobal_HeatmapCount(heatmapCountData);

    // RENDER CHART 5: Heatmap Quality
    const heatmapQualityData = Array.from(
        d3.rollups(filteredData, v => v.length, d => d.year, d => d.where_prec),
        ([year, precisions]) => precisions.map(([precision, count]) => ({ year, where_prec: `Prec: ${precision}`, event_count: count }))
    ).flat();
    renderGlobal_HeatmapQuality(heatmapQualityData);
    
    // RENDER CHART 6: Stacked Bar Top 15 Countries
    const countryTotals = Array.from(
        d3.rollups(filteredData, v => d3.sum(v, d => d.best), d => d.country),
        ([key, value]) => ({ country: key, total: value })
    );
    const barData = countryTotals.sort((a, b) => b.total - a.total).slice(0, 15);

    const top15CountryNames = new Set(barData.map(d => d.country));
    const top15FilteredData = filteredData.filter(d => top15CountryNames.has(d.country));
    const stackedBarData = Array.from(
        d3.rollups(
            top15FilteredData,
            v => d3.sum(v, d => d.best),
            d => d.country,
            d => d.type_of_violence
        ),
        ([country, types]) => types.map(([typeCode, total]) => ({
            country: country,
            type_of_violence: TYPE_MAPPING[typeCode] || `Unknown (${typeCode})`,
            total: total
        }))
    ).flat().filter(d => d.total > 0);
    renderGlobal_StackedBar(stackedBarData);

    // RENDER CHART 8: Small Multiples
    const smallMultiplesData = Array.from(
        d3.rollups(filteredData, v => d3.sum(v, d => d.best), d => d.year, d => d.region),
        ([year, regions]) => regions.map(([region, total]) => ({ year, region, total_fatalities: total }))
    ).flat().filter(d => d.total_fatalities > 0);
    renderGlobal_SmallMultiples(smallMultiplesData);
}

/* -------------------------------------------------------------------------- */
/* ---------- 4. SCENARIO 2: DETAILED DASHBOARD (KPI and Charts) ---------- */
/* -------------------------------------------------------------------------- */

function renderDetailedDashboard() {
    const filteredData = getFiltered();
    const a1 = document.getElementById("actor1Select").value;
    const a2 = document.getElementById("actor2Select").value;
    const y = document.getElementById("yearSelect").value;
    
    let title = `Detailed Analysis: ${a1}`;
    if (a2 !== "All") title += ` vs ${a2}`;
    if (y !== "All") title += ` (Year ${y})`;

    const opponentName = (a2 !== "All") ? a2 : "All Opponents";
    const colorDomain = [a1, opponentName, "Civilians", "Unknown"];
    
    let totalActor1Deaths = 0;
    let totalOpponentDeaths = 0;
    const totalCivilians = d3.sum(filteredData, d => d.deathsCivilians);
    const totalUnknown = d3.sum(filteredData, d => d.deathsUnknown);
    const totalEvents = filteredData.length;
    const totalFatalities = d3.sum(filteredData, d => d.best);
    
    // === KPI MAX EVENT LOGIC ===
    let maxFatalityEvent = null;
    let minFatalityEvent = null;
    let maxFatalities = -1;
    let minFatalities = Infinity;

    const fatalEvents = filteredData.filter(d => d.best > 0);

    fatalEvents.forEach(d => {
        let currentActor1Deaths = 0;
        let currentOpponentDeaths = 0;
        
        if (d.side_a === a1) {
            currentActor1Deaths = d.deathsA;
            if (a2 === "All" || d.side_b === a2) {
                currentOpponentDeaths = d.deathsB;
            }
        } else if (d.side_b === a1) {
            currentActor1Deaths = d.deathsB;
            if (a2 === "All" || d.side_a === a2) {
                currentOpponentDeaths = d.deathsA;
            }
        }
        totalActor1Deaths += currentActor1Deaths;
        totalOpponentDeaths += currentOpponentDeaths;
        
        if (d.best > maxFatalities) {
            maxFatalities = d.best;
            maxFatalityEvent = d;
        }

        if (d.best < minFatalities) {
            minFatalities = d.best;
            minFatalities = Math.min(minFatalities, d.best);
            minFatalityEvent = d;
        }
    });

    if (minFatalities === Infinity) minFatalities = 0;
    
    // REGIONAL IMPACT (retains logic for KPI box)
    let regionalImpactRatio = null;
    let totalRegionalFatalities = 0;
    let actorRegion = maxFatalityEvent ? maxFatalityEvent.region : null; 

    if (actorRegion) {
        const allRegionalEvents = RAW.filter(d => d.region === actorRegion);
        totalRegionalFatalities = d3.sum(allRegionalEvents, d => d.best);
        
        if (totalRegionalFatalities > 0) {
            regionalImpactRatio = totalFatalities / totalRegionalFatalities;
        }
    }

    // === MAX FATALITY DISPLAY LOGIC (UPDATED) ===
    const dataPointsForChart4 = [
        maxFatalityEvent ? (maxFatalityEvent.side_a === a1 ? maxFatalityEvent.deathsA : maxFatalityEvent.deathsB) : 0, 
        maxFatalityEvent ? (maxFatalityEvent.side_a === a1 ? maxFatalityEvent.deathsB : maxFatalityEvent.deathsA) : 0, 
        maxFatalityEvent ? maxFatalityEvent.deathsCivilians : 0,
        maxFatalityEvent ? maxFatalityEvent.deathsUnknown : 0
    ];
    const activeFatalSegments = dataPointsForChart4.filter(d => d > 0).length;
    const shouldHideChart4 = (activeFatalSegments <= 1 || !maxFatalityEvent || maxFatalities <= 0); 
    
    let maxEventInfoText = maxFatalityEvent ? 
        `${maxFatalityEvent.country} (${maxFatalityEvent.year}), ${TYPE_MAPPING[maxFatalityEvent.type_of_violence] || `Type ${maxFatalityEvent.type_of_violence}`}` : "N/A";
    
    let maxFatalitiesDisplay = maxFatalityEvent ? maxFatalities.toLocaleString() : "N/A";

    if (activeFatalSegments === 1 && maxFatalityEvent) {
        const primarySegmentIndex = dataPointsForChart4.findIndex(d => d > 0);
        let segmentName = "";
        if (primarySegmentIndex === 0) segmentName = a1;
        else if (primarySegmentIndex === 1) segmentName = opponentName;
        else if (primarySegmentIndex === 2) segmentName = "Civilians";
        else if (primarySegmentIndex === 3) segmentName = "Unknown";
        
        if (segmentName) {
            maxFatalitiesDisplay = `${maxFatalities.toLocaleString()} (${segmentName})`;
        }
    }


    // Min KPI
    const minEventInfo = minFatalityEvent && minFatalities > 0 ? 
        `${minFatalityEvent.country} (${minFatalityEvent.year}), ${TYPE_MAPPING[minFatalityEvent.type_of_violence] || `Type ${minFatalityEvent.type_of_violence}`}` : "N/A";


    // Chart 2 visibility logic
    const shouldHideChart2 = filteredData.length <= 1;

    // Regional Impact KPI visibility logic
    const regionalImpactThreshold = 0.0001;
    const shouldHideChart3 = (regionalImpactRatio === null || totalFatalities === 0 || regionalImpactRatio < regionalImpactThreshold);


    // === RENDER DASHBOARD CONTENT ===
    let dashboardContentHTML = ``; 

    // 1. Fatality Timeline Breakdown 
    dashboardContentHTML += `<div class="chart-fullwidth chart-cell">
        <h3>1. Fatality Timeline Breakdown (Stacked Area/Bar)</h3>
        <p>Timeline chart showing the number of fatalities over the years. If filtered to a single year, the chart displays a single Bar Chart.</p>
        <div id="chart-detailed-timeline"></div>
    </div>`;
    
    // 2. Event Risk and Data Quality 
    if (!shouldHideChart2) {
        dashboardContentHTML += `<div class="chart-fullwidth chart-cell">
            <h3>2. Event Risk and Data Quality (Bubble Chart)</h3>
            <p>Analysis of risk (Fatalities) and data quality (Precision). Bubble size is proportional to Fatalities.</p>
            <div id="chart-detailed-risk-precision"></div>
        </div>`;
    }

    // 4. Analysis of Most Fatal Event
    if (!shouldHideChart4) {
        dashboardContentHTML += `<div class="chart-fullwidth chart-cell" id="chart-container-fatal">
            <h3>4. Analysis of Most Fatal Event (Stacked Bar)</h3>
            <p>Fatality distribution (Actor 1, Opponent, Civilian, Unknown) in the single most fatal event (Event ID: ${maxFatalityEvent ? maxFatalityEvent.id : "N/A"}).</p>
            <div id="chart-detailed-most-fatal-event"></div>
        </div>`;
    }
    

    document.getElementById("dashboard").innerHTML = `
        <div class="chart-cell">
            <h2>${title}</h2>
            <div class="kpi-container">
                <div class="kpi-box"><div class="kpi-title">Total Events</div><div class="kpi-value">${totalEvents.toLocaleString()}</div></div>
                <div class="kpi-box"><div class="kpi-title">Total Fatalities (Best Estimate)</div><div class="kpi-value">${totalFatalities.toLocaleString()}</div></div>
                <div class="kpi-box"><div class="kpi-title">Fatalities ${a1}</div><div class="kpi-value" style="color: ${DETAILED_FATALITY_COLORS.range[0]};">${totalActor1Deaths.toLocaleString()}</div></div>
                <div class="kpi-box"><div class="kpi-title">Fatalities ${opponentName}</div><div class="kpi-value" style="color: ${DETAILED_FATALITY_COLORS.range[1]};">${totalOpponentDeaths.toLocaleString()}</div></div>
                <div class="kpi-box"><div class="kpi-title">Civilian Fatalities</div><div class="kpi-value" style="color: ${DETAILED_FATALITY_COLORS.range[2]};">${totalCivilians.toLocaleString()}</div></div>
                <div class="kpi-box"><div class="kpi-title">Unknown Fatalities</div><div class="kpi-value" style="color: ${DETAILED_FATALITY_COLORS.range[3]};">${totalUnknown.toLocaleString()}</div></div>
                <div class="kpi-box">
                    <div class="kpi-title">Max Event Fatalities</div>
                    <div class="kpi-value" style="color: #d9534f;">${maxFatalitiesDisplay}</div>
                    <div class="kpi-sub-title">${maxEventInfoText}</div>
                </div>
                <div class="kpi-box"><div class="kpi-title">Min Event Fatalities (>0)</div><div class="kpi-value" style="color: #5cb85c;">${minFatalities > 0 ? minFatalities.toLocaleString() : "N/A"}</div><div class="kpi-sub-title">${minEventInfo}</div></div>
                <div class="kpi-box" id="kpi-regional-impact">
                    <div class="kpi-title">Regional Impact (${actorRegion || 'N/A'})</div>
                    <div class="kpi-value" style="color: ${regionalImpactRatio !== null && regionalImpactRatio > 0.05 ? '#d9534f' : '#0275d8'};">
                        ${regionalImpactRatio !== null ? d3.format(".2%")(regionalImpactRatio) : "N/A"}
                    </div>
                    <div class="kpi-sub-title">Total Reg. Fatalities: ${totalRegionalFatalities.toLocaleString()}</div>
                </div>
            </div>
        </div>
        ${dashboardContentHTML}
    `;

    if (shouldHideChart3) {
        document.getElementById('kpi-regional-impact').style.display = 'none';
    }


    // 1. Timeline Data Aggregation
    const breakdownData = Array.from(
        d3.rollups(filteredData, 
            v => {
                let actor1 = 0; let opponent = 0;
                v.forEach(d => {
                     if (d.side_a === a1) { actor1 += d.deathsA; if (a2 === "All" || d.side_b === a2) opponent += d.deathsB; } 
                     else if (d.side_b === a1) { actor1 += d.deathsB; if (a2 === "All" || d.side_a === a2) opponent += d.deathsA; }
                });
                return { actor1: actor1, opponent: opponent, civilians: d3.sum(v, d => d.deathsCivilians), unknown: d3.sum(v, d => d.deathsUnknown) }
            },
            d => d.year
        ),
        ([year, sums]) => [
            { year: +year, type: a1, deaths: sums.actor1 },
            { year: +year, type: opponentName, deaths: sums.opponent },
            { year: +year, type: "Civilians", deaths: sums.civilians },
            { year: +year, type: "Unknown", deaths: sums.unknown }
        ]
    ).flat().filter(d => d.deaths > 0);

    const uniqueYears = new Set(breakdownData.map(d => d.year)).size;
    const markType = uniqueYears > 1 ? "area" : "bar";
    
    // Render Chart 1
    renderDetailed_Combined(breakdownData, colorDomain, markType);

    // Render Chart 2 (if visible)
    if (!shouldHideChart2) {
        const riskPrecisionData = filteredData.map(d => ({
            year: d.year, best: d.best, where_prec: d.where_prec,
            type_of_violence: TYPE_MAPPING[d.type_of_violence] || `Unknown (${d.type_of_violence})`, id: d.id
        }));
        renderDetailed_RiskPrecision(riskPrecisionData); 
    }
        
    // Render Chart 4 (if visible)
    if (!shouldHideChart4 && maxFatalities > 0) {
        renderDetailed_MostFatalEvent(maxFatalityEvent, null, a1, opponentName, colorDomain);
    }
}


/* ==================================================================== */
/* =========== 5. CHART RENDER FUNCTIONS (GLOBAL) (UPDATED) ======== */
/* ==================================================================== */

// Dynamic Breakdown Chart (Chart 2)
function renderGlobal_Breakdown(data, groupingField, domain, range) {
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth, 
        height: fullWidthHeight, 
        data: { values: data },
        mark: { type: "area", tooltip: true },
        encoding: {
            x: { field: "year", type: "temporal", title: "Year", axis: {format: "%Y"} },
            y: { field: "total_deaths", type: "quantitative", title: "Proportion (%)", stack: "normalize", axis: { format: ".1%" }},
            color: {
                field: "category", 
                type: "nominal", 
                title: groupingField === "region" ? "Region" : "Violence Type", 
                scale: {
                    domain: domain, 
                    range: range
                }
            },
            tooltip: [
                { field: "year", type: "temporal", format: "%Y", title: "Year" },
                { field: "category", type: "nominal", title: groupingField === "region" ? "Region" : "Violence Type" },
                { field: "total_deaths", type: "quantitative", title: "Fatalities", format: "," },
                { field: "total_deaths", type: "quantitative", title: "Proportion", stack: "normalize", format: ".1%" }
            ]
        }
    };
    data.forEach(d => { d.year = new Date(d.year, 0, 1); });
    vegaEmbed("#chart-global-death-breakdown", spec, { actions: false }).catch(console.error);
}

// Waffle Chart (Chart 7)
function renderGlobal_ViolenceTypeWaffleChart(data) { 
    const totalEvents = d3.sum(data, d => d.event_count);
    if (totalEvents === 0) {
        document.getElementById("chart-global-regional-waffle").innerHTML = "<p>No events to display.</p>";
        return;
    }

    const totalUnits = 100;
    let accumulatedData = [];
    
    const sortedData = data.sort((a, b) => b.event_count - a.event_count);

    const unitMap = sortedData.map(s => {
        return {
            type_label: s.type_label,
            event_count: s.event_count,
            units: Math.floor((s.event_count / totalEvents) * totalUnits),
            remainder: (s.event_count / totalEvents) * totalUnits - Math.floor((s.event_count / totalEvents) * totalUnits)
        };
    });

    let assignedUnits = d3.sum(unitMap, d => d.units);
    let remainderUnits = totalUnits - assignedUnits;

    const sortedByRemainder = [...unitMap].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainderUnits; i++) {
        if (sortedByRemainder[i]) {
            sortedByRemainder[i].units += 1;
        }
    }

    let currentUnit = 0;
    let dynamicDomain = [];
    let dynamicRange = [];

    unitMap.forEach(s => {
        if (s.units > 0) {
            const colorIndex = GLOBAL_TYPE_COLORS.domain.indexOf(s.type_label);
            const color = colorIndex !== -1 ? GLOBAL_TYPE_COLORS.range[colorIndex] : "#999999";

            dynamicDomain.push(s.type_label);
            dynamicRange.push(color);

            for (let j = 0; j < s.units; j++) {
                accumulatedData.push({
                    type_label: s.type_label,
                    event_count: s.event_count,
                    unit: currentUnit + j + 1,
                    row: Math.floor((currentUnit + j) / 10),
                    col: (currentUnit + j) % 10,
                    percentage_label: `${(s.event_count / totalEvents * 100).toFixed(1)}%`
                });
            }
            currentUnit += s.units;
        }
    });

    while (accumulatedData.length < totalUnits) {
        if (dynamicDomain.indexOf("Rounding Error") === -1) {
             dynamicDomain.push("Rounding Error");
             dynamicRange.push("#E0E0E0");
        }
        accumulatedData.push({
            type_label: "Rounding Error",
            event_count: 0,
            unit: accumulatedData.length + 1,
            row: Math.floor(accumulatedData.length / 10),
            col: accumulatedData.length % 10,
            percentage_label: "0%"
        });
    }

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: 300, 
        height: 300, 
        data: { values: accumulatedData },
        mark: { type: "rect", stroke: "white", strokeWidth: 1, tooltip: true },
        encoding: {
            x: { field: "col", type: "ordinal", axis: null, title: null, sort: "ascending" },
            y: { field: "row", type: "ordinal", axis: null, title: null, sort: "descending" },
            color: {
                field: "type_label",
                type: "nominal",
                title: "Violence Type",
                scale: { domain: dynamicDomain, range: dynamicRange },
                legend: {
                    symbolType: "square",
                    title: "Contribution by Type"
                }
            },
            tooltip: [
                { field: "type_label", title: "Violence Type" },
                { field: "event_count", title: "Total Event Count", aggregate: "sum", format: "," },
                { field: "percentage_label", title: "Percentage" }
            ]
        }
    };
    vegaEmbed("#chart-global-regional-waffle", spec, { actions: false }).catch(console.error);
}

// Heatmap Count (Chart 4)
function renderGlobal_HeatmapCount(data) {
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth, 
        height: fullWidthHeight, 
        data: { values: data },
        title: "Event Density by Year and Region",
        mark: { type: "rect", tooltip: true },
        encoding: {
            x: { field: "year", type: "ordinal", title: "Year", axis: {labelAngle: -45} },
            y: { field: "region", type: "nominal", title: "Region" },
            color: { 
                field: "event_count", type: "quantitative", title: "Event Count", 
                scale: { scheme: "viridis" } 
            },
            tooltip: [
                { field: "year", title: "Year" },
                { field: "region", title: "Region" },
                { field: "event_count", title: "Event Count", format: "," }
            ]
        }
    };
    vegaEmbed("#chart-global-heatmap-count", spec, { actions: false }).catch(console.error);
}

// Heatmap Quality (Chart 5)
function renderGlobal_HeatmapQuality(data) {
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth, 
        height: fullWidthHeight, 
        data: { values: data },
        title: "Data Quality: Location Precision (1=High)",
        mark: { type: "rect", tooltip: true },
        encoding: {
            x: { field: "year", type: "ordinal", title: "Year", axis: {labelAngle: -45} },
            y: { field: "where_prec", type: "ordinal", title: "Location Precision (1=High)" },
            color: { 
                field: "event_count", type: "quantitative", title: "Event Count", 
                scale: { scheme: "cividis" } 
            },
            tooltip: [
                { field: "year", title: "Year" },
                { field: "where_prec", title: "Precision" },
                { field: "event_count", title: "Event Count", format: "," }
            ]
        }
    };
    vegaEmbed("#chart-global-heatmap-quality", spec, { actions: false }).catch(console.error);
}

// Small Multiples (Chart 8)
function renderGlobal_SmallMultiples(data) {
    data.forEach(d => { d.year = new Date(d.year, 0, 1); });

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth, 
        height: smallMultiplesHeight, 
        data: { values: data },
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "year", type: "temporal", title: "Year", axis: { format: "%Y", labels: true, labelOverlap: "greedy" } },
            y: { 
                field: "total_fatalities", 
                type: "quantitative", 
                title: "Total Fatalities" 
            },
            color: { field: "region", type: "nominal", title: "Region" },
            facet: { 
                row: { 
                    field: "region", type: "nominal", title: null, 
                    header: { labelOrient: "top", titleOrient: "top" } 
                }
            },
            tooltip: [
                { field: "year", title: "Year", type: "temporal", format: "%Y" },
                { field: "region", title: "Region" },
                { field: "total_fatalities", title: "Fatalities", format: "," }
            ]
        },
        resolve: { 
            scale: { y: "independent" }
        }
    };
    vegaEmbed("#chart-global-small-multiples", spec, { actions: false }).catch(console.error);
}

// Stacked Bar (Chart 6)
function renderGlobal_StackedBar(data) {
    const countryOrder = Array.from(d3.rollups(data, v => d3.sum(v, d => d.total), d => d.country))
        .sort((a,b) => b[1] - a[1])
        .map(d => d[0]);

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth, 
        height: barChartHeight, 
        data: { values: data },
        mark: { type: "bar", tooltip: true },
        encoding: {
            y: { field: "country", type: "nominal", sort: countryOrder, title: "Country (Top 15)", axis: { labelOverlap: "greedy" }},
            x: { field: "total", type: "quantitative", title: "Total Fatalities" },
            color: { 
                field: "type_of_violence", type: "nominal", title: "Violence Type",
                scale: GLOBAL_TYPE_COLORS
            },
            tooltip: [
                { field: "country", title: "Country" },
                { field: "type_of_violence", title: "Type" },
                { field: "total", title: "Fatalities", format: "," }
            ]
        }
    };
    vegaEmbed("#chart-global-stacked-bar", spec, { actions: false }).catch(console.error);
}

/* ==================================================================== */
/* =========== 6. CHART RENDER FUNCTIONS (DETAILED) (REDUCED) ==== */
/* ==================================================================== */

function renderDetailed_Combined(data, colorDomain, markType) {
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth,
        height: fullWidthHeight, 
        data: { values: data },
        encoding: {
            color: { 
                field: "type", type: "nominal", title: "Victim Type",
                scale: {
                    domain: colorDomain,
                    range: DETAILED_FATALITY_COLORS.range
                }
            }
        }
    };

    if (markType === "area") {
        data.forEach(d => { d.year = new Date(d.year, 0, 1); });
        spec.mark = { type: "area", tooltip: true };
        spec.encoding.x = { 
            field: "year", 
            type: "temporal",
            title: "Year",
            axis: { format: "%Y", labelOverlap: "greedy", tickCount: "year" } 
        };
        spec.encoding.y = { 
            field: "deaths", 
            type: "quantitative", 
            title: "Fatalities",
            stack: "zero"
        };
        spec.encoding.tooltip = [
            { field: "year", title: "Year", type: "temporal", format: "%Y" },
            { field: "type", title: "Victim Type" },
            { field: "deaths", title: "Fatalities", format: "," }
        ];
    } else {
        spec.mark = { type: "bar", tooltip: true };
        spec.encoding.x = { 
            field: "deaths", 
            type: "quantitative", 
            title: "Fatalities" 
        };
        spec.encoding.y = { 
            field: "type", 
            type: "nominal", 
            title: "Victim Type",
            sort: "-x"
        };
        spec.encoding.tooltip = [
            { field: "type", title: "Victim Type" },
            { field: "deaths", title: "Fatalities", format: "," }
        ];
    }

    vegaEmbed("#chart-detailed-timeline", spec, { actions: false }).catch(console.error);
}

function renderDetailed_RiskPrecision(data) {
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth,
        height: fullWidthHeight, 
        data: { values: data.filter(d => d.best > 0) },
        mark: { type: "circle", tooltip: true, opacity: 0.7 },
        encoding: {
            x: { 
                field: "where_prec", 
                type: "ordinal", 
                title: "Location Precision (1=Best, 7=Worst)",
                sort: "ascending" 
            },
            y: { 
                field: "best", 
                type: "quantitative", 
                title: "Total Fatalities (Best Estimate)",
            },
            size: {
                field: "best",
                type: "quantitative",
                title: "Fatalities",
                scale: { range: [100, 1000] },
                legend: null
            },
            color: {
                field: "type_of_violence",
                type: "nominal",
                title: "Violence Type",
                scale: GLOBAL_TYPE_COLORS
            },
            tooltip: [
                { field: "id", title: "Event ID" },
                { field: "best", title: "Fatalities", format: "," },
                { field: "where_prec", title: "Precision" },
                { field: "type_of_violence", title: "Type" },
                { field: "year", title: "Year" }
            ]
        }
    };
    vegaEmbed("#chart-detailed-risk-precision", spec, { actions: false }).catch(console.error);
}

function renderDetailed_MostFatalEvent(maxFatalityEvent, maxOpponentFatalities, actor1Name, opponentName, colorDomain) {
    
    if (!maxFatalityEvent) return;

    let chartData = [];
    
    const actorDeaths = (maxFatalityEvent.side_a === actor1Name ? maxFatalityEvent.deathsA : maxFatalityEvent.deathsB);
    const opponentDeaths = (maxFatalityEvent.side_a === actor1Name ? maxFatalityEvent.deathsB : maxFatalityEvent.deathsA);
    const civilianDeaths = maxFatalityEvent.deathsCivilians;
    const unknownDeaths = maxFatalityEvent.deathsUnknown;

    const dataPoints = [
        { event: "Highest Fatalities Event", eventId: maxFatalityEvent.id, type: actor1Name, deaths: actorDeaths },
        { event: "Highest Fatalities Event", eventId: maxFatalityEvent.id, type: opponentName, deaths: opponentDeaths },
        { event: "Highest Fatalities Event", eventId: maxFatalityEvent.id, type: "Civilians", deaths: civilianDeaths },
        { event: "Highest Fatalities Event", eventId: maxFatalityEvent.id, type: "Unknown", deaths: unknownDeaths }
    ];

    chartData = dataPoints.filter(d => d.deaths > 0);
    
    const maxEventInfo = maxFatalityEvent ? 
        `<strong>Event ID ${maxFatalityEvent.id || 'undefined'}</strong> in ${maxFatalityEvent.country} (${maxFatalityEvent.year}) with <strong>${maxFatalityEvent.best.toLocaleString()}</strong> total deaths.` : "N/A";
    
    document.getElementById("chart-detailed-most-fatal-event").innerHTML = `<p>${maxEventInfo}</p><div id="most-fatal-chart-container"></div>`;

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: fixedChartWidth * 0.8,
        height: 100, 
        data: { values: chartData },
        mark: { type: "bar", tooltip: true },
        encoding: {
            x: { 
                field: "deaths", 
                type: "quantitative", 
                title: "Fatalities",
                stack: "zero" 
            },
            y: { 
                field: "event", 
                type: "nominal", 
                title: null,
                axis: null 
            },
            color: {
                field: "type", type: "nominal", title: "Victim Type",
                scale: {
                    domain: colorDomain,
                    range: DETAILED_FATALITY_COLORS.range
                }
            },
            tooltip: [
                { field: "eventId", title: "Event ID" },
                { field: "type", title: "Victim Type" },
                { field: "deaths", title: "Fatalities", format: "," }
            ]
        },
        config: {
            view: { stroke: null }
        }
    };
    vegaEmbed("#most-fatal-chart-container", spec, { actions: false }).catch(console.error);
}