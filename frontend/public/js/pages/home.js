import { esc, daysLeft } from "../core/helpers.js";
import { db, findTool, countByStatus } from "../core/store.js";
import { registerPage } from "../core/router.js";
import { statCard } from "../components/stat-card.js";

function render() {
  const activeBorrows = db.borrows.filter((b) => b.status === "Active");
  const dueSoon = activeBorrows.filter((b) => daysLeft(b.expected) <= 3);
  const dateText = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `
    <h2 class="title">Dashboard</h2>
    <p class="subtitle">Overview of S7Gear tool status — ${dateText}</p>

    <div class="stats">
      ${statCard(db.tools.length, "TOTAL TOOLS", "#0f172a")}
      ${statCard(countByStatus("Available"), "AVAILABLE", "var(--green)")}
      ${statCard(countByStatus("Borrowed"), "BORROWED", "var(--primary)")}
      ${statCard(countByStatus("Under Maintenance"), "MAINTENANCE", "var(--orange)")}
      ${statCard(countByStatus("Under Inspection"), "INSPECTION", "var(--purple)")}
      ${statCard(countByStatus("Unsafe"), "UNSAFE", "var(--red)")}
    </div>

    <div class="grid2">
      ${activeBorrowingsCard(activeBorrows)}
      ${dueSoonCard(dueSoon)}
    </div>

    <div class="card">
      <div class="card-h">Quick Actions</div>
      <div class="card-b row">
        <button class="btn" data-go="records">View Tool Records</button>
        <button class="btn primary" data-go="borrow">Borrow a Tool</button>
        <button class="btn" data-go="inspection">New Inspection</button>
        <button class="btn" data-go="availability">Check Availability</button>
        <button class="btn" data-go="history">View History</button>
      </div>
    </div>`;
}

function activeBorrowingsCard(borrows) {
  const items = borrows.map((borrow) => {
    const days = daysLeft(borrow.expected);
    const urgency = days < 0 ? "t-red" : days <= 1 ? "t-orange" : "";
    const daysText = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`;

    return `
      <div class="list-item">
        <div>
          <span class="mono t-muted">${borrow.toolId}</span> — <b>${esc(findTool(borrow.toolId)?.type)}</b><br>
          <small>${esc(borrow.borrower)}</small>
        </div>
        <div style="text-align:right">
          <small class="${urgency}">${daysText}</small><br>
          <small>Return: ${borrow.expected}</small>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-h">Active Borrowings <span class="badge b-blue">${borrows.length} active</span></div>
      ${items || `<div class="empty">No active borrowings</div>`}
    </div>`;
}

function dueSoonCard(borrows) {
  const items = borrows.map((borrow) => `
    <div class="list-item">
      <div>
        <b>${borrow.toolId} — ${esc(findTool(borrow.toolId)?.type)}</b><br>
        <small>Borrower: ${esc(borrow.borrower)} · Return: ${borrow.expected}</small>
      </div>
    </div>`).join("");

  return `
    <div class="card">
      <div class="card-h">Tools Due for Return <span class="badge b-orange">${borrows.length} due soon</span></div>
      ${items || `<div class="empty">Nothing due soon</div>`}
    </div>`;
}

registerPage("home", { render });
