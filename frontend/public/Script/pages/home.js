// =========================================================
// HOME PAGE (index.html) — dashboard
// =========================================================

async function showHomePage() {
  const tools = await getTools();
  const activeBorrows = await getActiveBorrows();

  // "Due soon" = due within 3 days (or already overdue)
  const dueSoon = activeBorrows.filter((borrow) => daysLeft(borrow.expected) <= 3);

  showDate();
  showStatusCounts(tools);
  showActiveBorrowings(tools, activeBorrows);
  showDueSoon(tools, dueSoon);
}

function showDate() {
  $("#todayText").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function showStatusCounts(tools) {
  $("#statTotal").textContent       = tools.length;
  $("#statAvailable").textContent   = countByStatus(tools, "Available");
  $("#statBorrowed").textContent    = countByStatus(tools, "Borrowed");
  $("#statMaintenance").textContent = countByStatus(tools, "Under Maintenance");
  $("#statInspection").textContent  = countByStatus(tools, "Under Inspection");
  $("#statUnsafe").textContent      = countByStatus(tools, "Unsafe");
}

// ---------- Active borrowings card ----------
function showActiveBorrowings(tools, borrows) {
  $("#activeCount").textContent = `${borrows.length} active`;

  const items = borrows.map((borrow) => {
    const toolType = findById(tools, borrow.toolId)?.type;
    const days = daysLeft(borrow.expected);

    // Red when overdue, orange when due within a day
    const urgencyClass = days < 0 ? "t-red" : days <= 1 ? "t-orange" : "";
    const daysText = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`;

    return `
      <div class="list-item">
        <div>
          <span class="mono t-muted">${borrow.toolId}</span> — <b>${escapeHtml(toolType)}</b><br>
          <small>${escapeHtml(borrow.borrower)}</small>
        </div>
        <div class="text-right">
          <small class="${urgencyClass}">${daysText}</small><br>
          <small>Return: ${borrow.expected}</small>
        </div>
      </div>`;
  });

  $("#activeList").innerHTML = items.join("") || `<div class="empty">No active borrowings</div>`;
}

// ---------- Due-soon card ----------
function showDueSoon(tools, borrows) {
  $("#dueCount").textContent = `${borrows.length} due soon`;

  const items = borrows.map((borrow) => {
    const toolType = findById(tools, borrow.toolId)?.type;

    return `
      <div class="list-item">
        <div>
          <b>${borrow.toolId} — ${escapeHtml(toolType)}</b><br>
          <small>Borrower: ${escapeHtml(borrow.borrower)} · Return: ${borrow.expected}</small>
        </div>
      </div>`;
  });

  $("#dueList").innerHTML = items.join("") || `<div class="empty">Nothing due soon</div>`;
}

showHomePage();
