/* ============================================================
   app.js – UI for the Hospital Management System
   Uses the DB object from db.js (JSON stored in localStorage)
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "৳" + Number(n || 0).toLocaleString("en-US");
const pad2 = n => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const nameOf = (col, id) => (DB.get(col, id) || {}).name || "— deleted —";
const slug = s => String(s).toLowerCase().replace(/\s+/g, "-");

const patientOpts = () => DB.all("patients").map(p => [p.id, `${p.name} (${p.id})`]);
const doctorOpts = () => DB.all("doctors").map(d => [d.id, `${d.name} – ${d.specialty}`]);

/* ---------- Page configuration (drives tables + forms) ---------- */
const CONFIG = {
  patients: {
    title: "Patients", single: "Patient",
    fields: [
      { k: "name", l: "Full name", t: "text", req: true },
      { k: "age", l: "Age", t: "number", req: true, min: 0, max: 120 },
      { k: "gender", l: "Gender", t: "select", opts: () => ["Male", "Female", "Other"] },
      { k: "phone", l: "Phone", t: "text", req: true },
      { k: "bloodGroup", l: "Blood group", t: "select", opts: () => ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      { k: "status", l: "Status", t: "select", opts: () => ["Outpatient", "Admitted", "Discharged"] },
      { k: "disease", l: "Diagnosis / problem", t: "text", full: true },
      { k: "address", l: "Address", t: "textarea", full: true }
    ],
    defaults: () => ({ gender: "Male", status: "Outpatient", bloodGroup: "O+" }),
    cols: [
      { l: "ID", v: r => r.id },
      { l: "Name", v: r => r.name },
      { l: "Age / Sex", v: r => `${r.age} / ${r.gender}` },
      { l: "Phone", v: r => r.phone },
      { l: "Blood", v: r => r.bloodGroup },
      { l: "Problem", v: r => r.disease || "—" },
      { l: "Status", v: r => r.status, badge: true }
    ],
    extra: r => `<button class="btn ghost sm" data-act="view" data-id="${r.id}">View</button>`
  },

  doctors: {
    title: "Doctors", single: "Doctor",
    fields: [
      { k: "name", l: "Doctor name", t: "text", req: true },
      { k: "specialty", l: "Specialty", t: "select", opts: () => ["Cardiology", "Medicine", "Gynecology", "Orthopedics", "Pediatrics", "Neurology", "Surgery", "Dermatology", "ENT", "Eye"] },
      { k: "phone", l: "Phone", t: "text", req: true },
      { k: "fee", l: "Consultation fee (৳)", t: "number", req: true, min: 0 },
      { k: "days", l: "Visiting days", t: "text", ph: "Sun, Tue, Thu" },
      { k: "status", l: "Status", t: "select", opts: () => ["Available", "On Leave"] }
    ],
    defaults: () => ({ status: "Available", specialty: "Medicine", fee: 500 }),
    cols: [
      { l: "ID", v: r => r.id },
      { l: "Name", v: r => r.name },
      { l: "Specialty", v: r => r.specialty },
      { l: "Phone", v: r => r.phone },
      { l: "Fee", v: r => money(r.fee) },
      { l: "Days", v: r => r.days || "—" },
      { l: "Status", v: r => r.status, badge: true }
    ]
  },

  appointments: {
    title: "Appointments", single: "Appointment",
    fields: [
      { k: "patientId", l: "Patient", t: "select", opts: patientOpts, req: true },
      { k: "doctorId", l: "Doctor", t: "select", opts: doctorOpts, req: true },
      { k: "date", l: "Date", t: "date", req: true },
      { k: "time", l: "Time", t: "time", req: true },
      { k: "status", l: "Status", t: "select", opts: () => ["Scheduled", "Completed", "Cancelled"] },
      { k: "reason", l: "Reason / notes", t: "text", full: true }
    ],
    defaults: () => ({ date: todayStr(), time: "10:00", status: "Scheduled" }),
    validate(d, id) {
      if (!d.patientId) return "Please add a patient first.";
      if (!d.doctorId) return "Please add a doctor first.";
      if (d.status === "Scheduled") {
        const clash = DB.all("appointments").find(a =>
          a.id !== id && a.doctorId === d.doctorId && a.date === d.date && a.time === d.time && a.status === "Scheduled");
        if (clash) return `${nameOf("doctors", d.doctorId)} already has an appointment at ${d.time} on ${d.date}.`;
      }
      return "";
    },
    cols: [
      { l: "ID", v: r => r.id },
      { l: "Patient", v: r => nameOf("patients", r.patientId) },
      { l: "Doctor", v: r => nameOf("doctors", r.doctorId) },
      { l: "Date", v: r => r.date },
      { l: "Time", v: r => r.time },
      { l: "Reason", v: r => r.reason || "—" },
      { l: "Status", v: r => r.status, badge: true }
    ],
    extra: r => r.status === "Scheduled"
      ? `<button class="btn ghost sm" data-act="done" data-id="${r.id}">✓ Done</button>`
      : ""
  },

  bills: {
    title: "Billing", single: "Bill",
    fields: [
      { k: "patientId", l: "Patient", t: "select", opts: patientOpts, req: true },
      { k: "date", l: "Date", t: "date", req: true },
      { k: "description", l: "Description", t: "text", req: true, full: true },
      { k: "amount", l: "Amount (৳)", t: "number", req: true, min: 0 },
      { k: "status", l: "Payment", t: "select", opts: () => ["Unpaid", "Paid"] }
    ],
    defaults: () => ({ date: todayStr(), status: "Unpaid" }),
    validate: d => (!d.patientId ? "Please add a patient first." : ""),
    cols: [
      { l: "Bill #", v: r => r.id },
      { l: "Patient", v: r => nameOf("patients", r.patientId) },
      { l: "Description", v: r => r.description },
      { l: "Date", v: r => r.date },
      { l: "Amount", v: r => money(r.amount) },
      { l: "Payment", v: r => r.status, badge: true }
    ],
    extra: r => (r.status === "Unpaid" ? `<button class="btn ghost sm" data-act="paid" data-id="${r.id}">Mark paid</button>` : "") +
      `<button class="btn ghost sm" data-act="print" data-id="${r.id}">🖨 Print</button>`
  }
};

/* ---------- Small helpers ---------- */
let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2800);
}

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden");
}
function closeModal() { $("#modal").classList.add("hidden"); $("#modalBody").innerHTML = ""; }

const state = { q: {} };

/* ---------- Router ---------- */
const ROUTES = {
  dashboard: { title: "Dashboard", render: renderDashboard },
  patients: { title: "Patients", render: () => renderList("patients") },
  doctors: { title: "Doctors", render: () => renderList("doctors") },
  appointments: { title: "Appointments", render: () => renderList("appointments") },
  bills: { title: "Billing", render: () => renderList("bills") },
  data: { title: "JSON Data", render: renderData }
};
let currentRoute = "dashboard";

function route() {
  const name = (location.hash || "#dashboard").slice(1);
  currentRoute = ROUTES[name] ? name : "dashboard";
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.route === currentRoute));
  $("#pageTitle").textContent = ROUTES[currentRoute].title;
  $("#sidebar").classList.remove("open");
  ROUTES[currentRoute].render();
  window.scrollTo(0, 0);
}
const refresh = () => ROUTES[currentRoute].render();

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const patients = DB.all("patients"), doctors = DB.all("doctors");
  const appts = DB.all("appointments"), bills = DB.all("bills");
  const today = todayStr();
  const sum = list => list.reduce((s, b) => s + Number(b.amount || 0), 0);
  const paid = sum(bills.filter(b => b.status === "Paid"));
  const due = sum(bills.filter(b => b.status === "Unpaid"));
  const todays = appts.filter(a => a.date === today && a.status === "Scheduled");

  const stat = (cls, ico, num, lbl) =>
    `<div class="stat ${cls}"><div class="ico">${ico}</div><div><div class="num">${num}</div><div class="lbl">${lbl}</div></div></div>`;

  const statuses = [["Scheduled", "#d97706"], ["Completed", "#16a34a"], ["Cancelled", "#dc2626"]];
  const maxCount = Math.max(1, ...statuses.map(([s]) => appts.filter(a => a.status === s).length));
  const bars = statuses.map(([s, color]) => {
    const n = appts.filter(a => a.status === s).length;
    return `<div class="bar-row"><span>${s}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / maxCount) * 100}%;background:${color}"></div></div><b>${n}</b></div>`;
  }).join("");

  const upcoming = appts.filter(a => a.status === "Scheduled" && a.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
  const upHtml = upcoming.length
    ? upcoming.map(a => `<li><div><b>${esc(nameOf("patients", a.patientId))}</b><small>with ${esc(nameOf("doctors", a.doctorId))}</small></div><div style="text-align:right"><b>${esc(a.time)}</b><small>${a.date === today ? "Today" : esc(a.date)}</small></div></li>`).join("")
    : `<li><span class="hint">No upcoming appointments.</span></li>`;

  const recent = patients.slice(-5).reverse();
  const recHtml = recent.length
    ? recent.map(p => `<li><div><b>${esc(p.name)}</b><small>${esc(p.disease || "—")}</small></div><span class="badge ${slug(p.status)}">${esc(p.status)}</span></li>`).join("")
    : `<li><span class="hint">No patients yet.</span></li>`;

  $("#view").innerHTML = `
    <div class="stats">
      ${stat("c-teal", "🧑", patients.length, "Total patients")}
      ${stat("c-amber", "🛏️", patients.filter(p => p.status === "Admitted").length, "Currently admitted")}
      ${stat("c-blue", "🩺", doctors.length, "Doctors")}
      ${stat("c-violet", "📅", todays.length, "Appointments today")}
      ${stat("c-green", "💰", money(paid), "Collected revenue")}
      ${stat("c-red", "⏳", money(due), "Pending dues")}
    </div>
    <div class="grid-2">
      <div class="card"><h3>Upcoming appointments</h3><ul class="mini-list">${upHtml}</ul></div>
      <div class="card"><h3>Appointments by status</h3>${bars}</div>
    </div>
    <div class="card"><h3>Recently registered patients</h3><ul class="mini-list">${recHtml}</ul></div>`;
}

/* ---------- Generic list page ---------- */
function renderList(col) {
  const c = CONFIG[col];
  $("#view").innerHTML = `
    <div class="toolbar">
      <input class="search" id="search" placeholder="Search ${c.title.toLowerCase()}..." value="${esc(state.q[col] || "")}">
      <button class="btn primary" data-act="add">+ Add ${c.single}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${c.cols.map(x => `<th>${x.l}</th>`).join("")}<th></th></tr></thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>`;
  fillTable(col);
  $("#search").addEventListener("input", e => { state.q[col] = e.target.value; fillTable(col); });
}

function fillTable(col) {
  const c = CONFIG[col];
  const q = (state.q[col] || "").toLowerCase().trim();
  let rows = DB.all(col);
  if (q) rows = rows.filter(r => c.cols.map(x => x.v(r)).join(" ").toLowerCase().includes(q));
  rows.reverse();
  $("#tbody").innerHTML = rows.length
    ? rows.map(r => `<tr>${c.cols.map(x => {
        const v = x.v(r);
        return `<td>${x.badge ? `<span class="badge ${slug(v)}">${esc(v)}</span>` : esc(v)}</td>`;
      }).join("")}
        <td class="actions">${c.extra ? c.extra(r) : ""}
          <button class="btn ghost sm" data-act="edit" data-id="${r.id}">Edit</button>
          <button class="btn danger sm" data-act="del" data-id="${r.id}">Delete</button>
        </td></tr>`).join("")
    : `<tr><td class="empty" colspan="${c.cols.length + 1}">No records found.</td></tr>`;
}

/* ---------- Add / edit form ---------- */
function fieldHtml(f, rec) {
  const val = rec[f.k] ?? "";
  let input;
  if (f.t === "select") {
    const opts = f.opts().map(o => Array.isArray(o) ? o : [o, o]);
    input = opts.length
      ? `<select name="${f.k}" ${f.req ? "required" : ""}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<select name="${f.k}" disabled><option value="">(none available – add one first)</option></select>`;
  } else if (f.t === "textarea") {
    input = `<textarea name="${f.k}">${esc(val)}</textarea>`;
  } else {
    input = `<input type="${f.t}" name="${f.k}" value="${esc(val)}" ${f.req ? "required" : ""} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}>`;
  }
  return `<div class="${f.full ? "full" : ""}"><label>${f.l}${f.req ? " *" : ""}</label>${input}</div>`;
}

function openForm(col, id) {
  const c = CONFIG[col];
  const rec = id ? DB.get(col, id) : c.defaults();
  openModal(`${id ? "Edit" : "Add"} ${c.single}`, `
    <form id="f" class="form-grid">
      ${c.fields.map(f => fieldHtml(f, rec)).join("")}
      <div class="form-actions full">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`);
  $("#f").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    c.fields.forEach(f => {
      const raw = String(fd.get(f.k) ?? "").trim();
      data[f.k] = f.t === "number" ? (raw === "" ? 0 : Number(raw)) : raw;
    });
    const err = c.validate ? c.validate(data, id) : "";
    if (err) return toast(err, true);
    if (id) DB.update(col, id, data); else DB.add(col, data);
    closeModal();
    toast(`${c.single} ${id ? "updated" : "added"} successfully`);
    refresh();
  });
}

/* ---------- Delete rules ---------- */
function deleteRecord(col, id) {
  const c = CONFIG[col];
  if (col === "doctors" && DB.all("appointments").some(a => a.doctorId === id && a.status === "Scheduled")) {
    return toast("This doctor still has scheduled appointments. Cancel or complete them first.", true);
  }
  const msg = col === "patients"
    ? "Delete this patient AND all their appointments and bills?"
    : `Delete this ${c.single.toLowerCase()}?`;
  if (!confirm(msg)) return;
  if (col === "patients") {
    DB.removeWhere("appointments", a => a.patientId === id);
    DB.removeWhere("bills", b => b.patientId === id);
  }
  if (col === "doctors") DB.removeWhere("appointments", a => a.doctorId === id);
  DB.remove(col, id);
  toast(`${c.single} deleted`);
  refresh();
}

/* ---------- Patient detail ---------- */
function viewPatient(id) {
  const p = DB.get("patients", id);
  if (!p) return;
  const appts = DB.all("appointments").filter(a => a.patientId === id);
  const bills = DB.all("bills").filter(b => b.patientId === id);
  const owed = bills.filter(b => b.status === "Unpaid").reduce((s, b) => s + Number(b.amount), 0);
  const item = (a, b) => `<li><div><b>${a}</b></div><div>${b}</div></li>`;
  openModal(p.name, `
    <div class="detail-grid">
      <div><span>Patient ID</span><b>${esc(p.id)}</b></div>
      <div><span>Status</span><b>${esc(p.status)}</b></div>
      <div><span>Age / Gender</span><b>${esc(p.age)} / ${esc(p.gender)}</b></div>
      <div><span>Blood group</span><b>${esc(p.bloodGroup)}</b></div>
      <div><span>Phone</span><b>${esc(p.phone)}</b></div>
      <div><span>Problem</span><b>${esc(p.disease || "—")}</b></div>
      <div class="full" style="grid-column:1/-1"><span>Address</span><b>${esc(p.address || "—")}</b></div>
    </div>
    <h3 style="font-size:15px">Appointments (${appts.length})</h3>
    <ul class="mini-list">${appts.length ? appts.map(a => item(`${esc(a.date)} ${esc(a.time)} – ${esc(nameOf("doctors", a.doctorId))}`, `<span class="badge ${slug(a.status)}">${esc(a.status)}</span>`)).join("") : `<li class="hint">None</li>`}</ul>
    <h3 style="font-size:15px;margin-top:16px">Bills (${bills.length}) – pending ${money(owed)}</h3>
    <ul class="mini-list">${bills.length ? bills.map(b => item(`${esc(b.description)} – ${money(b.amount)}`, `<span class="badge ${slug(b.status)}">${esc(b.status)}</span>`)).join("") : `<li class="hint">None</li>`}</ul>`);
}

/* ---------- Printable invoice ---------- */
function printBill(id) {
  const b = DB.get("bills", id);
  if (!b) return;
  const p = DB.get("patients", b.patientId) || {};
  const w = window.open("", "_blank", "width=720,height=800");
  if (!w) return toast("Please allow pop-ups to print the invoice.", true);
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${esc(b.id)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a}h1{margin:0;color:#0f766e}
    table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border:1px solid #cbd5e1;padding:10px;text-align:left}
    .tot{text-align:right;font-size:20px;margin-top:20px}.stamp{display:inline-block;border:3px solid;padding:4px 14px;font-weight:700;transform:rotate(-6deg);margin-top:16px;color:${b.status === "Paid" ? "#16a34a" : "#dc2626"}}</style></head>
    <body><h1>${esc(DB.meta().hospital)}</h1><p>Invoice <b>${esc(b.id)}</b> &middot; Date: ${esc(b.date)}</p>
    <p><b>Patient:</b> ${esc(p.name || "—")} (${esc(b.patientId)})<br><b>Phone:</b> ${esc(p.phone || "—")}</p>
    <table><tr><th>Description</th><th>Amount</th></tr><tr><td>${esc(b.description)}</td><td>${money(b.amount)}</td></tr></table>
    <p class="tot">Total: <b>${money(b.amount)}</b></p><div class="stamp">${esc(b.status.toUpperCase())}</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

/* ---------- JSON data page ---------- */
function renderData() {
  const counts = DB.COLS.map(c => `${DB.all(c).length} ${c}`).join(" · ");
  $("#view").innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <h3>Hospital name</h3>
      <div class="row-gap" style="margin-bottom:0">
        <input id="hospInput" style="max-width:340px" value="${esc(DB.meta().hospital)}">
        <button class="btn primary" data-act="rename">Save name</button>
      </div>
    </div>
    <div class="card">
      <h3>Your data (JSON)</h3>
      <p class="hint">${counts} · ${DB.sizeKB()} KB. Everything below is exactly what is stored.</p>
      <div class="row-gap">
        <button class="btn primary" data-act="export">⬇ Export JSON</button>
        <button class="btn ghost" data-act="import">⬆ Import JSON</button>
        <button class="btn danger" data-act="reset">Reset to sample data</button>
        <input type="file" id="fileInput" accept=".json,application/json" hidden>
      </div>
      <textarea class="json-view" readonly spellcheck="false">${esc(DB.exportJSON())}</textarea>
    </div>`;
  $("#fileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { DB.importJSON(reader.result); toast("JSON imported successfully"); renderData(); }
      catch (err) { toast(err.message, true); }
    };
    reader.readAsText(file);
  });
}

function downloadJSON() {
  const blob = new Blob([DB.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hospital-data-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("JSON file downloaded");
}

/* ---------- Global events ---------- */
document.addEventListener("click", e => {
  if (e.target.closest("[data-close]") || e.target.id === "modalClose" || e.target.id === "modal") return closeModal();
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, id } = btn.dataset;
  const col = currentRoute;
  switch (act) {
    case "add": openForm(col); break;
    case "edit": openForm(col, id); break;
    case "del": deleteRecord(col, id); break;
    case "view": viewPatient(id); break;
    case "done": DB.update("appointments", id, { status: "Completed" }); toast("Appointment completed"); refresh(); break;
    case "paid": DB.update("bills", id, { status: "Paid" }); toast("Bill marked as paid"); refresh(); break;
    case "print": printBill(id); break;
    case "export": downloadJSON(); break;
    case "import": $("#fileInput").click(); break;
    case "reset":
      if (confirm("Replace ALL data with the sample data? This cannot be undone.")) { DB.reset(); toast("Sample data restored"); renderData(); applyHospitalName(); }
      break;
    case "rename": {
      const v = $("#hospInput").value.trim();
      if (!v) return toast("Name cannot be empty", true);
      DB.setHospitalName(v); applyHospitalName(); toast("Hospital name saved");
      break;
    }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
window.addEventListener("hashchange", route);

function applyHospitalName() {
  const n = DB.meta().hospital;
  $("#hospName").textContent = n;
  document.title = `${n} – Hospital Management System`;
}
function tickClock() {
  $("#clock").textContent = new Date().toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

applyHospitalName();
tickClock();
setInterval(tickClock, 30000);
route();
