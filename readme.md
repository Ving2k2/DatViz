# UCDP GED Scenario Dashboard

This is a dynamic, interactive web dashboard built using vanilla JavaScript, D3.js, and Vega-Lite, designed to visualize and analyze data from the Uppsala Conflict Data Program Georeferenced Event Dataset (UCDP GED).

The dashboard provides contextual filtering and visualization across a Global Overview and a Detailed Actor Analysis mode.

### ✨ Key Features & Logic

* **Mandatory Region Filtering:** The `Region` filter is the primary control. **Dependent filters are disabled until a specific Region is selected.** Selecting "All" for Region resets all other filters to the global scope.
* **Interdependent Filters:** All filters (Region, Actor 1, Year, Violence Type) dynamically narrow their available options based on previous selections, ensuring a valid and focused data exploration path.
* **Dynamic Global Charts (When Actor 1 = All):**
    * **Fatality Breakdown over Time:** Dynamically switches its grouping field:
        * If **Region = All (Global)**, it breaks down fatalities by **Region**.
        * If **Region is Selected**, it breaks down fatalities within that region by **Violence Type**.
    * **Waffle Chart (Event Contribution by Violence Type):** Visualizes the proportional event contribution by **Violence Type**, guaranteed to sum to 100%.
* **Detailed Actor Analysis (When Actor 1 is Selected):**
    * **Contextual KPIs:** The "Max Event Fatalities" KPI displays the casualty count alongside the primary victim segment (e.g., `455 (Civilians)`) if only one segment records fatalities.
    * **Chart Visibility:** Charts are dynamically removed from the DOM if the filtered data set is too small (e.g., only 1 event or 1 fatality segment) to provide meaningful comparison.

### 🛠️ Technologies Used

* **HTML5 / CSS3:** Structure and basic styling.
* **Vanilla JavaScript (ES6+):** Core logic, dynamic filtering, and dependency management.
* **D3.js (d3-array):** Efficient data aggregation and transformation (`d3.csv`, `d3.rollups`).
* **Vega-Lite / Vega-Embed:** Declarative visualization framework for rendering complex and interactive charts.