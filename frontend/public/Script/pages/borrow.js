// =========================================================
// BORROWING & RETURN PAGE (borrow.html)
// Tab 1: borrow a tool     Tab 2: return a tool
// =========================================================

import { borrowTool, getActiveBorrows, getTools, returnTool } from "../database.js";
import { getEmployees } from "../api/employees.api.js";
import { $, escapeHtml, findActiveBorrow, findById, nowTime, today } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];
let activeBorrows = [];
let employees = [];
let selectedToolId = null;     // tool chosen on the Borrow tab
let selectedBorrowId = null;   // borrowing chosen on the Return tab

// ---------- Load data and show everything ----------
async function refreshPage() {
  [tools, activeBorrows, employees] = await Promise.all([
    getTools(),
    getActiveBorrows(),
    getEmployees(),
  ]);

  showEmployeeOptions();
  $("#subtitle").textContent = `${activeBorrows.length} active borrowings`;
  showBorrowTab();
  showReturnTab();
}

// ---------- Tabs ----------
function showTab(name) {
  $("#borrowPanel").classList.toggle("hidden", name !== "borrow");
  $("#returnPanel").classList.toggle("hidden", name !== "return");

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

// =========================================================
// TAB 1 — BORROW
// =========================================================

function showBorrowTab() {
  const tool = findById(tools, selectedToolId);
  const canBorrow = Boolean(tool)
    && tool.status === "Available"
    && employees.length > 0;

  $("#borrowToolId").value = tool ? tool.id : "";
  $("#borrowToolInfo").innerHTML = tool ? toolSummaryHtml(tool) : availableToolLinksHtml();
  $("#borrowSubmit").disabled = !canBorrow;

  // Message under the button
  let hint = "";
  if (!tool) hint = "Search for an available tool first.";
  else if (!canBorrow) hint = `This tool is ${tool.status.toLowerCase()} and cannot be borrowed.`;
  if (tool?.status === "Available" && employees.length === 0) {
    hint = "Add an employee before creating a borrowing.";
  }

  $("#borrowHint").textContent = hint;
  $("#borrowHint").classList.toggle("hint-error", Boolean(tool) && !canBorrow);
}

function showEmployeeOptions() {
  const select = $("#borrowEmployee");
  const currentValue = select.value;
  select.innerHTML = `<option value="">Select an employee</option>` + employees
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  if (employees.some((employee) => String(employee.id) === currentValue)) {
    select.value = currentValue;
  }
}

function toolSummaryHtml(tool) {
  return `
    <div class="tool-box">
      <span class="mono t-muted">${tool.id}</span>
      <h3>${escapeHtml(tool.type)}</h3>
      ${statusBadge(tool.status, true)}
      <div class="mt-sm">
        <div class="kv"><span class="kv-label">Power Type</span><div>${tool.power}</div></div>
        <div class="kv"><span class="kv-label">Condition</span><div>${conditionBadge(tool.condition)}</div></div>
        <div class="kv"><span class="kv-label">Last Inspection</span><div>${tool.lastInspection || "—"}</div></div>
      </div>
    </div>`;
}

function availableToolLinksHtml() {
  const links = tools
    .filter((tool) => tool.status === "Available")
    .map((tool) => `<a href="#" data-pick="${escapeHtml(tool.id)}" class="mono">${escapeHtml(tool.id)}</a>`)
    .join(", ");

  return `<p class="info-text">Available tools: ${links}</p>`;
}

// Date and time start as "now"; the expected return date can't be in the past.
function setBorrowFormDefaults() {
  $("#borrowDate").value = today();
  $("#borrowTime").value = nowTime();
  $("#borrowExpected").min = today();
}

// Search box
$("#findBorrowForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#borrowToolId").value.trim().toUpperCase();

  if (!findById(tools, id)) return toast(`Tool ${id} not found.`);

  selectedToolId = id;
  showBorrowTab();
});

// Clicking one of the "Available tools: PT-001, PT-003 ..." links
$("#borrowToolInfo").addEventListener("click", (event) => {
  const link = event.target.closest("a[data-pick]");
  if (!link) return;

  event.preventDefault();
  selectedToolId = link.dataset.pick;
  showBorrowTab();
});

// Confirm Borrowing
$("#borrowForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const employee = employees.find((item) => String(item.id) === data.employeeId);
  if (!employee) return toast("Select an employee.");

  try {
    const tool = await borrowTool(selectedToolId, data);

    toast(`${tool.id} borrowed by ${employee.name}.`);
    selectedToolId = null;
    form.reset();
    setBorrowFormDefaults();
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});


// =========================================================
// TAB 2 — RETURN
// =========================================================

function showReturnTab() {
  const borrow = findById(activeBorrows, selectedBorrowId);

  showActiveBorrowList(borrow);
  $("#returnToolId").value = borrow ? borrow.toolId : "";

  // Show the form only when a borrowing is selected
  $("#returnEmpty").classList.toggle("hidden", Boolean(borrow));
  $("#returnDetails").classList.toggle("hidden", !borrow);

  if (borrow) {
    $("#returnInfo").innerHTML = returnSummaryHtml(borrow);
  }
}

function showActiveBorrowList(selectedBorrow) {
  const items = activeBorrows.map((borrow) => {
    const isSelected = selectedBorrow && selectedBorrow.id === borrow.id;
    const toolType = findById(tools, borrow.toolId)?.type;

    return `
      <div class="list-item click ${isSelected ? "selected" : ""}" data-borrow-id="${escapeHtml(borrow.id)}">
        <div>
          <b class="mono">${borrow.toolId}</b> — ${escapeHtml(toolType)}<br>
          <small>${escapeHtml(borrow.borrower)} · Return: ${borrow.expected}</small>
        </div>
      </div>`;
  });

  $("#activeBorrowList").innerHTML = items.join("") || `<div class="empty">No active borrowings</div>`;
}

function returnSummaryHtml(borrow) {
  const toolType = findById(tools, borrow.toolId)?.type;

  return `
    <b>${borrow.toolId} — ${escapeHtml(toolType)}</b>
    <div class="kv"><span class="kv-label">Borrower</span><div>${escapeHtml(borrow.borrower)}</div></div>
    <div class="kv"><span class="kv-label">Borrowed</span><div>${borrow.borrowDate}</div></div>
    <div class="kv"><span class="kv-label">Expected Return</span><div>${borrow.expected}</div></div>`;
}

// Choose a borrowing to return (resets the return form)
function selectBorrow(borrowId) {
  selectedBorrowId = borrowId;
  $("#returnForm").reset();
  $("#returnDate").value = today();
  $("#returnTime").value = nowTime();
  showReturnTab();
}

// Clicking a borrowing in the list
$("#activeBorrowList").addEventListener("click", (event) => {
  const item = event.target.closest("[data-borrow-id]");
  if (item) selectBorrow(item.dataset.borrowId);
});

// Search box
$("#findReturnForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#returnToolId").value.trim().toUpperCase();
  const borrow = findActiveBorrow(activeBorrows, id);

  if (!borrow) return toast(`No active borrowing for ${id}.`);
  selectBorrow(borrow.id);
});

// Confirm Return
$("#returnForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));

  try {
    const tool = await returnTool(selectedBorrowId, data);

    toast(`${tool.id} returned — now ${tool.status}.`);
    selectedBorrowId = null;
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});


// ---------- Start ----------
setBorrowFormDefaults();
refreshPage();
