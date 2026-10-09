import { $ } from "../core/helpers.js";
import { db, countByStatus, findActiveBorrow } from "../core/store.js";
import { registerPage } from "../core/router.js";
import { statCard } from "../components/stat-card.js";
import { toolTable } from "../components/tool-table.js";

const STATUSES = ["Available", "Borrowed", "Under Inspection", "Under Maintenance", "Unsafe"];

const options = (values) => values.map((v) => `<option>${v}</option>`).join("");

function render() {
  const toolTypes = [...new Set(db.tools.map((tool) => tool.type))];

  return `
    <h2 class="title">Tool Availability</h2>
    <p class="subtitle">Real-time status of all ${db.tools.length} tools</p>

    <div class="stats" style="grid-template-columns:repeat(5,1fr)">
      ${statCard(countByStatus("Available"), "AVAILABLE", "var(--green)")}
      ${statCard(countByStatus("Borrowed"), "BORROWED", "var(--primary)")}
      ${statCard(countByStatus("Under Inspection"), "UNDER INSPECTION", "var(--purple)")}
      ${statCard(countByStatus("Under Maintenance"), "UNDER MAINTENANCE", "var(--orange)")}
      ${statCard(countByStatus("Unsafe"), "UNSAFE", "var(--red)")}
    </div>

    <div class="card">
      <div class="toolbar">
        <input id="avSearch" placeholder="Search by ID, type, or borrower...">
        <select id="avStatus"><option value="">All Statuses</option>${options(STATUSES)}</select>
        <select id="avType"><option value="">All Types</option>${options(toolTypes)}</select>
      </div>
      <div class="table-wrap" id="avTable"></div>
    </div>`;
}

function after() {
  const refreshTable = () => {
    const search = $("#avSearch").value.toLowerCase();
    const status = $("#avStatus").value;
    const type = $("#avType").value;

    const matches = db.tools.filter((tool) => {
      const borrower = findActiveBorrow(tool.id)?.borrower;
      const searchable = [tool.id, tool.type, borrower].join(" ").toLowerCase();

      return (!status || tool.status === status)
        && (!type || tool.type === type)
        && (!search || searchable.includes(search));
    });

    $("#avTable").innerHTML = toolTable(matches, false);
  };

  ["#avSearch", "#avStatus", "#avType"].forEach((id) => $(id).addEventListener("input", refreshTable));
  refreshTable();
}

registerPage("availability", { render, after });
