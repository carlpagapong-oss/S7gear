// ---------- Seed data (first-run sample records) ----------
export const SEED = {
  tools: [
    { id: "PT-001", type: "Power Drill", power: "Corded", condition: "Good", status: "Available", lastInspection: "2026-09-10" },
    { id: "PT-002", type: "Power Drill", power: "Cordless", condition: "Good", status: "Borrowed", lastInspection: "2026-09-08" },
    { id: "PT-003", type: "Power Drill", power: "Cordless", condition: "Fair", status: "Available", lastInspection: "2026-08-25" },
    { id: "PT-004", type: "Angle Grinder", power: "Corded", condition: "Damaged", status: "Under Maintenance", lastInspection: "2026-09-01" },
    { id: "PT-005", type: "Angle Grinder", power: "Corded", condition: "Good", status: "Available", lastInspection: "2026-09-15" },
    { id: "PT-006", type: "Circular Saw", power: "Corded", condition: "Unsafe", status: "Unsafe", lastInspection: "2026-09-20" },
    { id: "PT-007", type: "Circular Saw", power: "Corded", condition: "Good", status: "Borrowed", lastInspection: "2026-09-12" },
    { id: "PT-008", type: "Impact Driver", power: "Cordless", condition: "New", status: "Available", lastInspection: "2026-09-25" },
    { id: "PT-009", type: "Impact Driver", power: "Cordless", condition: "Good", status: "Under Inspection", lastInspection: "2026-09-28" },
    { id: "PT-010", type: "Rotary Hammer", power: "Corded", condition: "Fair", status: "Available", lastInspection: "2026-09-05" },
  ],
  borrows: [
    { id: "BR-004", toolId: "PT-005", borrower: "Felix Mendoza", borrowDate: "2026-09-20 13:00", expected: "2026-09-22", actual: "2026-09-22", condReturned: "Good", status: "Returned", purpose: "Metal cutting", remarks: "" },
    { id: "BR-003", toolId: "PT-001", borrower: "Pedro Bautista", borrowDate: "2026-09-15 09:00", expected: "2026-09-17", actual: "2026-09-17", condReturned: "Good", status: "Returned", purpose: "Wall anchors", remarks: "" },
    { id: "BR-002", toolId: "PT-007", borrower: "Ramon Torres", borrowDate: "2026-09-29 07:45", expected: "2026-10-01", actual: "", condReturned: "", status: "Active", purpose: "Plywood cutting", remarks: "" },
    { id: "BR-001", toolId: "PT-002", borrower: "Juan Dela Cruz", borrowDate: "2026-09-28 08:30", expected: "2026-10-02", actual: "", condReturned: "", status: "Active", purpose: "Framing work", remarks: "" },
  ],
  inspections: [
    { id: "INS-004", toolId: "PT-001", date: "2026-09-10", inspector: "Lena Santos", result: "Passed", condition: "Good", findings: "Cord insulation slightly worn near plug. Chuck functioning well.", remarks: "Monitor cord condition on next inspection." },
    { id: "INS-003", toolId: "PT-008", date: "2026-09-25", inspector: "Lena Santos", result: "Passed", condition: "New", findings: "All safety features functional. No visible damage.", remarks: "Tool is in excellent condition." },
    { id: "INS-002", toolId: "PT-004", date: "2026-09-01", inspector: "Lena Santos", result: "Needs Maintenance", condition: "Damaged", findings: "Housing cracked near motor area. Disc flange worn.", remarks: "Sent to maintenance for housing repair." },
    { id: "INS-001", toolId: "PT-006", date: "2026-09-20", inspector: "Lena Santos", result: "Failed / Unsafe", condition: "Unsafe", findings: "Guard is cracked, exposed blade area. Switch mechanism is faulty.", remarks: "Do not use. Requires full replacement of guard and switch assembly." },
  ],
  maintenance: [
    { id: "MNT-003", toolId: "PT-005", date: "2026-07-20", type: "Cleaning", issue: "Heavy dust buildup in motor vents", action: "Compressed air cleaning, brush cleaning of motor housing.", status: "Completed", next: "" },
    { id: "MNT-002", toolId: "PT-003", date: "2026-08-10", type: "Preventive Maintenance", issue: "Routine 6-month check", action: "Cleaned, lubricated chuck, tested all functions.", status: "Completed", next: "2027-02-10" },
    { id: "MNT-001", toolId: "PT-004", date: "2026-09-03", type: "Repair", issue: "Cracked housing, worn disc flange", action: "Housing replacement ordered. Disc flange replaced.", status: "In Progress", next: "2026-10-15" },
  ],
};
