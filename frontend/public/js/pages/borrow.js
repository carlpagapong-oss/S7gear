import { $, esc, today, nowTime, nextId } from "../core/helpers.js";
import { db, save, ui, findTool, findActiveBorrow } from "../core/store.js";
import { registerPage, render as rerender } from "../core/router.js";
import { CLICK, FORMS } from "../core/events.js";
import { toast } from "../components/toast.js";
import { statusBadge, conditionBadge } from "../components/badge.js";

// What happens to a tool's status depending on its condition when returned.
const STATUS_AFTER_RETURN = {
  Good: "Available",
  Fair: "Under Inspection",
  Damaged: "Under Maintenance",
  Unsafe: "Unsafe",
};

// ---------- Page ----------
function render() {
  const activeBorrows = db.borrows.filter((b) => b.status === "Active");
  const isBorrowTab = ui.borrowTab === "borrow";

  return `
    <h2 class="title">Borrowing & Return</h2>
    <p class="subtitle">${activeBorrows.length} active borrowings</p>

    <div class="tabs">
      <button class="tab ${isBorrowTab ? "active" : ""}" data-btab="borrow">Borrow Tool</button>
      <button class="tab ${!isBorrowTab ? "active" : ""}" data-btab="return">Return Tool</button>
    </div>

    ${isBorrowTab ? borrowTab() : returnTab(activeBorrows)}`;
}

// ---------- Borrow tab ----------
function borrowTab() {
  const tool = ui.borrowToolId && findTool(ui.borrowToolId);
  const canBorrow = tool?.status === "Available";

  return `
    <div class="grid-side">
      <div class="card">
        <div class="card-h">Find Tool</div>
        <div class="card-b">
          <form id="findBorrow" class="row">
            <input id="findBorrowId" placeholder="e.g. PT-001" value="${esc(ui.borrowToolId)}" style="flex:1">
            <button class="btn primary">Search</button>
          </form>
          ${tool ? toolSummary(tool) : availableToolLinks()}
        </div>
      </div>

      <div class="card">
        <div class="card-h">Borrowing Details</div>
        <div class="card-b">
          <form id="borrowForm">
            <div class="field"><label>BORROWER NAME *</label><input name="borrower" placeholder="Full name" required></div>
            <div class="fgrid">
              <div class="field"><label>BORROW DATE</label><input type="date" name="date" value="${today()}"></div>
              <div class="field"><label>TIME</label><input type="time" name="time" value="${nowTime()}"></div>
            </div>
            <div class="field"><label>EXPECTED RETURN DATE *</label><input type="date" name="expected" min="${today()}" required></div>
            <div class="field"><label>PURPOSE *</label><textarea name="purpose" placeholder="Reason for borrowing..." required></textarea></div>
            <div class="field"><label>REMARKS</label><textarea name="remarks" placeholder="Additional notes..."></textarea></div>

            <button class="btn primary full" ${canBorrow ? "" : `disabled style="opacity:.5;cursor:not-allowed"`}>Confirm Borrowing</button>
            ${borrowHint(tool)}
          </form>
        </div>
      </div>
    </div>`;
}

const toolSummary = (tool) => `
  <div class="tool-box">
    <span class="mono t-muted">${tool.id}</span>
    <h3>${esc(tool.type)}</h3>
    ${statusBadge(tool.status, true)}
    <div style="margin-top:10px">
      <div class="kv"><span>Power Type</span>${tool.power}</div>
      <div class="kv"><span>Condition</span>${conditionBadge(tool.condition)}</div>
      <div class="kv"><span>Last Inspection</span>${tool.lastInspection}</div>
    </div>
  </div>`;

function availableToolLinks() {
  const links = db.tools
    .filter((tool) => tool.status === "Available")
    .map((tool) => `<a href="#" data-pick="${tool.id}" class="mono">${tool.id}</a>`)
    .join(", ");

  return `<p class="t-muted" style="margin-top:12px;font-size:13px">Available tools: ${links}</p>`;
}

function borrowHint(tool) {
  if (!tool) {
    return `<p class="t-muted" style="text-align:center;margin-top:8px;font-size:12px">Search for an available tool first.</p>`;
  }
  if (tool.status !== "Available") {
    return `<p class="error" style="text-align:center">This tool is ${tool.status.toLowerCase()} and cannot be borrowed.</p>`;
  }
  return "";
}

// ---------- Return tab ----------
function returnTab(activeBorrows) {
  const borrow = ui.returnBorrowId && activeBorrows.find((b) => b.id === ui.returnBorrowId);

  const borrowList = activeBorrows.map((b) => `
    <div class="list-item click ${borrow?.id === b.id ? "sel" : ""}" data-ret="${b.id}">
      <div>
        <b class="mono">${b.toolId}</b> — ${esc(findTool(b.toolId)?.type)}<br>
        <small>${esc(b.borrower)} · Return: ${b.expected}</small>
      </div>
    </div>`).join("");

  return `
    <div class="grid-side">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-h">Find Borrowed Tool</div>
          <div class="card-b">
            <form id="findReturn" class="row">
              <input id="findReturnId" placeholder="e.g. PT-002" value="${esc(borrow?.toolId)}" style="flex:1">
              <button class="btn primary">Search</button>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-h">Active Borrowings</div>
          ${borrowList || `<div class="empty">No active borrowings</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-h">Return Details</div>
        <div class="card-b">
          ${borrow ? returnForm(borrow) : `<div class="empty">Select an active borrowing to return.</div>`}
        </div>
      </div>
    </div>`;
}

const returnForm = (borrow) => `
  <div class="tool-box" style="margin:0 0 16px">
    <b>${borrow.toolId} — ${esc(findTool(borrow.toolId)?.type)}</b>
    <div class="kv"><span>Borrower</span>${esc(borrow.borrower)}</div>
    <div class="kv"><span>Borrowed</span>${borrow.borrowDate}</div>
    <div class="kv"><span>Expected Return</span>${borrow.expected}</div>
  </div>

  <form id="returnForm">
    <div class="fgrid">
      <div class="field"><label>RETURN DATE</label><input type="date" name="date" value="${today()}"></div>
      <div class="field"><label>TIME</label><input type="time" name="time" value="${nowTime()}"></div>
    </div>
    <div class="field">
      <label>CONDITION UPON RETURN</label>
      <select name="cond">${Object.keys(STATUS_AFTER_RETURN).map((c) => `<option>${c}</option>`).join("")}</select>
    </div>
    <div class="field"><label>REMARKS</label><textarea name="remarks" placeholder="Notes about return..."></textarea></div>
    <button class="btn primary full">Confirm Return</button>
  </form>`;

// ---------- Handlers ----------
CLICK.btab = (el) => { ui.borrowTab = el.dataset.btab; rerender(); };
CLICK.pick = (el, event) => { event.preventDefault(); ui.borrowToolId = el.dataset.pick; rerender(); };
CLICK.ret = (el) => { ui.returnBorrowId = el.dataset.ret; rerender(); };

FORMS.findBorrow = () => {
  const id = $("#findBorrowId").value.trim().toUpperCase();
  if (!findTool(id)) return toast(`Tool ${id} not found.`);

  ui.borrowToolId = id;
  rerender();
};

FORMS.borrowForm = (form, data) => {
  const tool = findTool(ui.borrowToolId);
  if (!tool || tool.status !== "Available") return toast("Select an available tool first.");
  if (data.expected < data.date) return toast("Return date must be after borrow date.");

  db.borrows.push({
    id: nextId(db.borrows, "BR"),
    toolId: tool.id,
    borrower: data.borrower.trim(),
    borrowDate: `${data.date} ${data.time}`,
    expected: data.expected,
    actual: "",
    condReturned: "",
    status: "Active",
    purpose: data.purpose,
    remarks: data.remarks,
  });
  tool.status = "Borrowed";

  save();
  ui.borrowToolId = null;
  rerender();
  toast(`${tool.id} borrowed by ${data.borrower}.`);
};

FORMS.findReturn = () => {
  const id = $("#findReturnId").value.trim().toUpperCase();
  const borrow = findActiveBorrow(id);
  if (!borrow) return toast(`No active borrowing for ${id}.`);

  ui.returnBorrowId = borrow.id;
  rerender();
};

FORMS.returnForm = (form, data) => {
  const borrow = db.borrows.find((b) => b.id === ui.returnBorrowId);
  const tool = findTool(borrow.toolId);

  Object.assign(borrow, {
    actual: data.date,
    condReturned: data.cond,
    status: "Returned",
    remarks: [borrow.remarks, data.remarks].filter(Boolean).join(" | "),
  });
  tool.condition = data.cond;
  tool.status = STATUS_AFTER_RETURN[data.cond];

  save();
  ui.returnBorrowId = null;
  rerender();
  toast(`${tool.id} returned — now ${tool.status}.`);
};

registerPage("borrow", { render });
