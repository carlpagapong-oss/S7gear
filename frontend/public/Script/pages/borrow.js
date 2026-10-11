// =========================================================
// BORROWING & RETURN PAGE (borrow.html)
// Tab 1: borrow a tool     Tab 2: return a tool
// =========================================================

import { borrowTool, getActiveBorrows, getTools, returnTool } from "../database.js";
import { $, escapeHtml, findActiveBorrow, findById, nowTime, today } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];
let activeBorrows = [];
let selectedToolId = null;     // tool chosen on the Borrow tab
let selectedBorrowId = null;   // borrowing chosen on the Return tab

// ---------- Load data and show everything ----------
async function refreshPage() {
  [tools, activeBorrows] = await Promise.all([
    getTools(),
    getActiveBorrows(),
  ]);

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
    && tool.status === "Available";

  $("#borrowToolInfo").innerHTML = availableToolsTableHtml();
  $("#borrowSubmit").disabled = !canBorrow;

  // Message under the button
  let hint = "";
  if (!tool) hint = "Select an available tool from the table.";
  else if (!canBorrow) hint = `This tool is ${tool.status.toLowerCase()} and cannot be borrowed.`;

  $("#borrowHint").textContent = hint;
  $("#borrowHint").classList.toggle("hint-error", Boolean(tool) && !canBorrow);
}

function availableToolsTableHtml() {
  const query = $("#borrowToolSearch").value.trim().toLowerCase();
  const availableTools = tools.filter((tool) => tool.status === "Available")
    .filter((tool) => `${tool.id} ${tool.type} ${tool.category}`.toLowerCase().includes(query));

  if (availableTools.length === 0) {
    return `<div class="empty">${query ? "No available tools match your search." : "No tools are currently available."}</div>`;
  }

  const rows = availableTools.map((tool) => `
    <tr class="${tool.id === selectedToolId ? "selected" : ""}">
      <td class="mono">${escapeHtml(tool.id)}</td>
      <td>${escapeHtml(tool.type)}</td>
      <td>${conditionBadge(tool.condition)}</td>
      <td>
        <button
          type="button"
          class="btn sm ${tool.id === selectedToolId ? "primary" : ""}"
          data-pick="${escapeHtml(tool.id)}"
          aria-pressed="${tool.id === selectedToolId}"
        >${tool.id === selectedToolId ? "Selected" : "Select"}</button>
        <button type="button" class="btn sm" data-view="${escapeHtml(tool.id)}">View</button>
      </td>
    </tr>`).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>TOOL ID</th><th>TOOL</th><th>CONDITION</th><th>ACTIONS</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Date and time start as "now"; the expected return date can't be in the past.
function setBorrowFormDefaults() {
  $("#borrowDate").value = today();
  $("#borrowTime").value = nowTime();
  $("#borrowExpected").min = today();
}

$("#borrowToolSearch").addEventListener("input", showBorrowTab);

// Select an available tool from the table.
$("#borrowToolInfo").addEventListener("click", (event) => {
  const viewButton = event.target.closest("button[data-view]");
  if (viewButton) {
    showToolDetails(findById(tools, viewButton.dataset.view));
    return;
  }

  const button = event.target.closest("button[data-pick]");
  if (!button) return;

  selectedToolId = button.dataset.pick;
  showBorrowTab();
});

// Confirm Borrowing
$("#borrowForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const { borrowerName: enteredBorrowerName, ...borrowingData } = Object.fromEntries(new FormData(form));
  const borrowerName = enteredBorrowerName.trim();

  try {
    const tool = await borrowTool(selectedToolId, {
      ...borrowingData,
      borrowerName,
    });

    toast(`${tool.id} borrowed by ${borrowerName}.`);
    selectedToolId = null;
    form.reset();
    setBorrowFormDefaults();
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

function showToolDetails(tool) {
  if (!tool) return;
  $("#borrowToolDetailsTitle").textContent = `${tool.id} — ${tool.type}`;
  const image = $("#borrowToolDetailsImage");
  image.hidden = !tool.imagePath;
  if (tool.imagePath) image.src = tool.imagePath;
  else image.removeAttribute("src");
  $("#borrowToolDetailsBrand").textContent = tool.brand || "—";
  $("#borrowToolDetailsModel").textContent = tool.model || "—";
  $("#borrowToolDetailsPower").textContent = tool.power || "—";
  $("#borrowToolDetailsCategory").textContent = tool.category || "—";
  $("#borrowToolDetailsCondition").innerHTML = conditionBadge(tool.condition);
  $("#borrowToolDetailsStatus").innerHTML = statusBadge(tool.status, true);
  $("#borrowToolDetailsInspection").textContent = tool.lastInspection || "—";
  openModal("borrowToolDetailsModal");
}


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
