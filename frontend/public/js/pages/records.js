import { esc } from "../core/helpers.js";
import { nextId } from "../core/helpers.js";
import { db, save, findTool, findActiveBorrow } from "../core/store.js";
import { registerPage, render as rerender } from "../core/router.js";
import { CLICK, ACTION, FORMS } from "../core/events.js";
import { openModal, closeModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { statusBadge, conditionBadge } from "../components/badge.js";
import { toolTable } from "../components/tool-table.js";

// ---------- Page ----------
function render() {
  return `
    <div class="row" style="justify-content:space-between;margin-bottom:20px">
      <div>
        <h2 class="title">Tool Records</h2>
        <p class="subtitle" style="margin:4px 0 0">${db.tools.length} total power tools registered</p>
      </div>
      <button class="btn primary" data-action="addTool">+ Add Tool</button>
    </div>
    <div class="card table-wrap">${toolTable(db.tools, true)}</div>`;
}

// ---------- Add / Edit modal ----------
function openToolForm(tool) {
  const isEditing = Boolean(tool);
  const toolTypes = [...new Set(db.tools.map((t) => t.type))];

  const selectOptions = (values, selected) =>
    values.map((v) => `<option ${v === selected ? "selected" : ""}>${v}</option>`).join("");

  // A borrowed tool's status is locked — it changes through Borrowing & Return.
  const isBorrowed = tool?.status === "Borrowed";
  const statuses = ["Available", "Under Inspection", "Under Maintenance", "Unsafe"];
  if (isBorrowed) statuses.push("Borrowed");

  openModal(`
    <h3>${isEditing ? `Edit Tool ${tool.id}` : "Add New Tool"}</h3>
    <form id="toolForm" data-id="${tool?.id ?? ""}">
      <div class="field">
        <label>TOOL ID *</label>
        <input name="id" value="${tool?.id ?? nextId(db.tools, "PT")}" ${isEditing ? "readonly" : ""} required pattern="PT-\\d{3,}">
      </div>
      <div class="field">
        <label>TOOL TYPE *</label>
        <input name="type" value="${esc(tool?.type)}" list="types" required>
        <datalist id="types">${toolTypes.map((t) => `<option>${esc(t)}</option>`).join("")}</datalist>
      </div>
      <div class="fgrid">
        <div class="field">
          <label>POWER TYPE</label>
          <select name="power">${selectOptions(["Corded", "Cordless"], tool?.power)}</select>
        </div>
        <div class="field">
          <label>CONDITION</label>
          <select name="condition">${selectOptions(["New", "Good", "Fair", "Damaged", "Unsafe"], tool?.condition)}</select>
        </div>
      </div>
      <div class="field">
        <label>STATUS</label>
        <select name="status" ${isBorrowed ? "disabled" : ""}>${selectOptions(statuses, tool?.status)}</select>
      </div>
      <div class="field">
        <label>LAST INSPECTION</label>
        <input type="date" name="lastInspection" value="${tool?.lastInspection ?? ""}">
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-close>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`);
}

// ---------- View modal ----------
function openToolDetails(id) {
  const tool = findTool(id);
  const borrow = findActiveBorrow(id);

  const activity = [
    ...db.borrows.filter((x) => x.toolId === id).map((x) =>
      activityItem("Borrowed", ` by ${esc(x.borrower)}`, x.borrowDate, statusBadge(x.status))),
    ...db.inspections.filter((x) => x.toolId === id).map((x) =>
      activityItem("Inspection", ` · ${esc(x.inspector)}`, x.date, statusBadge(x.result))),
    ...db.maintenance.filter((x) => x.toolId === id).map((x) =>
      activityItem(esc(x.type), "", x.date, statusBadge(x.status))),
  ].join("");

  openModal(`
    <h3>${tool.id} — ${esc(tool.type)}</h3>
    <div class="kv"><span>Power</span>${tool.power}</div>
    <div class="kv"><span>Condition</span>${conditionBadge(tool.condition)}</div>
    <div class="kv"><span>Status</span>${statusBadge(tool.status, true)}</div>
    <div class="kv"><span>Current Borrower</span>${borrow ? esc(borrow.borrower) : "—"}</div>
    <div class="kv"><span>Last Inspection</span>${tool.lastInspection}</div>

    <h4 style="margin:16px 0 6px">Activity</h4>
    <div class="card">${activity || `<div class="empty">No records</div>`}</div>

    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <button class="btn" data-close>Close</button>
    </div>`);
}

const activityItem = (title, extra, date, badge) => `
  <div class="list-item">
    <div><b>${title}</b>${extra}<br><small>${date}</small></div>
    ${badge}
  </div>`;

// ---------- Handlers ----------
ACTION.addTool = () => openToolForm(null);
CLICK.view = (el) => openToolDetails(el.dataset.view);
CLICK.edit = (el) => openToolForm(findTool(el.dataset.edit));

CLICK.del = (el) => {
  const tool = findTool(el.dataset.del);

  if (tool.status === "Borrowed") return toast("Cannot delete a borrowed tool.");
  if (!confirm(`Delete ${tool.id} — ${tool.type}?`)) return;

  db.tools = db.tools.filter((t) => t.id !== tool.id);
  save();
  rerender();
  toast("Tool deleted.");
};

FORMS.toolForm = (form, data) => {
  const editingId = form.dataset.id;

  if (editingId) {
    const { type, power, condition, lastInspection, status } = data;
    // `status` is missing from the form data when the select is disabled (borrowed tool).
    Object.assign(findTool(editingId), { type, power, condition, lastInspection, ...(status && { status }) });
  } else {
    const id = data.id.toUpperCase();
    if (findTool(id)) return toast("Tool ID already exists.");
    db.tools.push({ ...data, id });
  }

  db.tools.sort((a, b) => a.id.localeCompare(b.id));
  save();
  closeModal();
  rerender();
  toast("Tool saved.");
};

registerPage("records", { render });
