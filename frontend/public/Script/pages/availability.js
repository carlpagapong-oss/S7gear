// =========================================================
// AVAILABILITY PAGE (availability.html)
// Status counters + searchable / filterable tool table
// =========================================================

import { getActiveBorrows, getTools } from "../database.js";
import { $, countByStatus, findActiveBorrow, optionsHtml, uniqueValues } from "../helpers.js";
import { emptyRowHtml, toolRowHtml } from "../ui/tool-table.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];
let activeBorrows = [];

async function showAvailabilityPage() {
  tools = await getTools();
  activeBorrows = await getActiveBorrows();

  $("#subtitle").textContent = `Real-time status of all ${tools.length} tools`;
  showStatusCounts();
  showTypeFilter();
  showFilteredTools();
}

function showStatusCounts() {
  $("#statAvailable").textContent   = countByStatus(tools, "Available");
  $("#statBorrowed").textContent    = countByStatus(tools, "Borrowed");
  $("#statInspection").textContent  = countByStatus(tools, "Under Inspection");
  $("#statMaintenance").textContent = countByStatus(tools, "Under Maintenance");
  $("#statUnsafe").textContent      = countByStatus(tools, "Unsafe");
}

// The "All Types" dropdown lists every tool type that exists.
function showTypeFilter() {
  const types = uniqueValues(tools.map((tool) => tool.type));
  $("#typeFilter").innerHTML = `<option value="">All Types</option>` + optionsHtml(types);
}

// Show only the tools that match the search box and both dropdowns.
function showFilteredTools() {
  const search = $("#searchBox").value.toLowerCase();
  const status = $("#statusFilter").value;
  const type = $("#typeFilter").value;

  const matches = tools.filter((tool) => {
    const borrow = findActiveBorrow(activeBorrows, tool.id);
    const searchableText = [tool.id, tool.type, borrow?.borrower].join(" ").toLowerCase();

    const matchesStatus = !status || tool.status === status;
    const matchesType = !type || tool.type === type;
    const matchesSearch = !search || searchableText.includes(search);

    return matchesStatus && matchesType && matchesSearch;
  });

  const rows = matches.map((tool) => toolRowHtml(tool, findActiveBorrow(activeBorrows, tool.id), false));
  $("#toolsBody").innerHTML = rows.join("") || emptyRowHtml(8, "No tools found");
  $("#toolsFoot").textContent = `${matches.length} tools`;
}

// Update the table whenever the search box or a dropdown changes.
$("#searchBox").addEventListener("input", showFilteredTools);
$("#statusFilter").addEventListener("input", showFilteredTools);
$("#typeFilter").addEventListener("input", showFilteredTools);

showAvailabilityPage();
