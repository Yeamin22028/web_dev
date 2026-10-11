/* ============================================================
   db.js – JSON data layer
   Everything is kept in ONE JSON object and saved to
   localStorage as a JSON string. Export / Import gives you
   a real .json file you can back up or edit.
   ============================================================ */
const DB = (() => {
  const KEY = "hms_data_v1";
  const PREFIX = { patients: "P", doctors: "D", appointments: "A", bills: "B" };
  const COLS = Object.keys(PREFIX);

  const pad = n => String(n).padStart(2, "0");
  const dayStr = (off = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + off);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function seed() {
    return {
      meta: {
        version: 1,
        hospital: "MediCare Hospital",
        counters: { patients: 1006, doctors: 105, appointments: 5006, bills: 9005 }
      },
      patients: [
        { id: "P-1001", name: "Rahim Uddin", age: 45, gender: "Male", phone: "01711-000001", bloodGroup: "B+", disease: "Hypertension", status: "Admitted", address: "Mirpur, Dhaka" },
        { id: "P-1002", name: "Fatema Begum", age: 32, gender: "Female", phone: "01811-000002", bloodGroup: "A+", disease: "Diabetes", status: "Outpatient", address: "Tangail Sadar" },
        { id: "P-1003", name: "Karim Hossain", age: 58, gender: "Male", phone: "01911-000003", bloodGroup: "O+", disease: "Chest pain", status: "Admitted", address: "Uttara, Dhaka" },
        { id: "P-1004", name: "Nusrat Jahan", age: 27, gender: "Female", phone: "01611-000004", bloodGroup: "AB+", disease: "Viral fever", status: "Outpatient", address: "Mirzapur, Tangail" },
        { id: "P-1005", name: "Sabbir Ahmed", age: 12, gender: "Male", phone: "01511-000005", bloodGroup: "B-", disease: "Fractured left arm", status: "Discharged", address: "Gazipur" }
      ],
      doctors: [
        { id: "D-101", name: "Dr. Anisur Rahman", specialty: "Cardiology", phone: "01700-111101", fee: 1000, days: "Sun, Tue, Thu", status: "Available" },
        { id: "D-102", name: "Dr. Sadia Islam", specialty: "Gynecology", phone: "01700-111102", fee: 800, days: "Mon, Wed", status: "Available" },
        { id: "D-103", name: "Dr. Tanvir Hasan", specialty: "Orthopedics", phone: "01700-111103", fee: 900, days: "Sat, Mon, Wed", status: "Available" },
        { id: "D-104", name: "Dr. Mahmuda Khatun", specialty: "Medicine", phone: "01700-111104", fee: 600, days: "Sun - Thu", status: "On Leave" }
      ],
      appointments: [
        { id: "A-5001", patientId: "P-1001", doctorId: "D-101", date: dayStr(0), time: "10:00", reason: "Blood pressure follow-up", status: "Scheduled" },
        { id: "A-5002", patientId: "P-1002", doctorId: "D-104", date: dayStr(0), time: "11:30", reason: "Sugar level check", status: "Scheduled" },
        { id: "A-5003", patientId: "P-1003", doctorId: "D-101", date: dayStr(1), time: "09:30", reason: "ECG review", status: "Scheduled" },
        { id: "A-5004", patientId: "P-1004", doctorId: "D-104", date: dayStr(-1), time: "12:00", reason: "Fever for 3 days", status: "Completed" },
        { id: "A-5005", patientId: "P-1005", doctorId: "D-103", date: dayStr(-3), time: "15:00", reason: "Arm fracture", status: "Completed" }
      ],
      bills: [
        { id: "B-9001", patientId: "P-1005", description: "Orthopedic consultation + X-ray", amount: 2500, date: dayStr(-3), status: "Paid" },
        { id: "B-9002", patientId: "P-1004", description: "Consultation fee", amount: 600, date: dayStr(-1), status: "Paid" },
        { id: "B-9003", patientId: "P-1001", description: "Admission charge + ECG", amount: 8500, date: dayStr(0), status: "Unpaid" },
        { id: "B-9004", patientId: "P-1003", description: "Emergency admission deposit", amount: 15000, date: dayStr(0), status: "Unpaid" }
      ]
    };
  }

  function isValid(obj) {
    return obj && typeof obj === "object" && obj.meta && COLS.every(c => Array.isArray(obj[c]));
  }

  // make sure id counters are always ahead of the biggest existing id
  function fixCounters(obj) {
    obj.meta.counters = obj.meta.counters || {};
    COLS.forEach(c => {
      const max = obj[c].reduce((m, r) => {
        const n = parseInt(String(r.id).split("-")[1], 10);
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      obj.meta.counters[c] = Math.max(obj.meta.counters[c] || 0, max + 1);
    });
    return obj;
  }

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (isValid(obj)) return fixCounters(obj);
      }
    } catch (e) { /* fall through to seed */ }
    const fresh = seed();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(data)); }

  return {
    COLS,
    meta: () => data.meta,
    all: col => data[col].slice(),
    get: (col, id) => data[col].find(r => r.id === id) || null,
    add(col, obj) {
      const n = data.meta.counters[col]++;
      const rec = { id: `${PREFIX[col]}-${n}`, ...obj, createdAt: new Date().toISOString() };
      data[col].push(rec);
      save();
      return rec;
    },
    update(col, id, patch) {
      const i = data[col].findIndex(r => r.id === id);
      if (i < 0) return null;
      data[col][i] = { ...data[col][i], ...patch, id, updatedAt: new Date().toISOString() };
      save();
      return data[col][i];
    },
    remove(col, id) {
      data[col] = data[col].filter(r => r.id !== id);
      save();
    },
    removeWhere(col, fn) {
      data[col] = data[col].filter(r => !fn(r));
      save();
    },
    setHospitalName(name) { data.meta.hospital = name; save(); },
    exportJSON: () => JSON.stringify(data, null, 2),
    importJSON(text) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error("This is not a valid JSON file."); }
      if (!isValid(obj)) throw new Error("JSON structure is wrong. It needs meta, patients, doctors, appointments and bills.");
      data = fixCounters(obj);
      save();
    },
    reset() { data = seed(); save(); },
    sizeKB: () => (JSON.stringify(data).length / 1024).toFixed(1)
  };
})();

if (typeof module !== "undefined") module.exports = DB;
