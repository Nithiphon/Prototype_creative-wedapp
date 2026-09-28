/* ====== CONFIGURE THIS: URL ของ Google Apps Script Web App ====== */
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbzOMYM-tWQKwMIiccUZh6Y3TG3I3DsTHnBtdCh8xGEO1yuGukUfiHrkatw0DpVbsIgJ0w/exec";
/* ================================================================= */

let state = {
  lot: "A1",
  spots: {},
  highlightSpotId: null
};

// --- จัดการการสลับหน้าจอ ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-back]").forEach(b => {
  b.onclick = () => showScreen(b.dataset.back);
});

// --- Toast แจ้งเตือนสั้นๆ ---
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

// --- ดึงข้อมูลช่องจอด (Fetch Spots) ---
async function fetchSpots() {
  const statusEl = document.getElementById("gridStatus");
  if (statusEl) statusEl.textContent = "กำลังโหลดข้อมูลสถานะ...";

  try {
    const res = await fetch(`${API_BASE_URL}?action=spots`);
    const data = await res.json();
    state.spots = data;
    renderGrid();
    updateSummary();
    if (statusEl) statusEl.textContent = "";
  } catch (e) {
    if (statusEl) statusEl.textContent = "⚠️ ไม่สามารถเชื่อมต่อฐานข้อมูลได้";
    showToast("เชื่อมต่อข้อมูลไม่สำเร็จ");
  }
}

// อัปเดตตัวเลขสรุปช่องว่าง
function updateSummary() {
  let totalFree = 0;

  ["A1", "B1"].forEach(lot => {
    const list = state.spots[lot] || [];
    const freeCount = list.filter(s => s.status === "free").length;
    totalFree += freeCount;

    const countEl = document.getElementById(`count${lot}`);
    if (countEl) countEl.textContent = `ว่าง ${freeCount}`;
  });

  const totalEl = document.getElementById("totalFreeCount");
  if (totalEl) totalEl.textContent = `${totalFree} ช่อง`;
}

// วาดผังช่องจอดในแต่ละชั้น
function renderGrid() {
  const grid = document.getElementById("spotGrid");
  grid.innerHTML = "";
  const list = state.spots[state.lot] || [];

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--muted); padding: 20px;">ไม่มีข้อมูลช่องจอด</div>`;
    return;
  }

  list.forEach(sp => {
    const el = document.createElement("div");
    const isFree = sp.status === "free";
    el.className = "spot " + (isFree ? "free" : "taken");

    // ถ้าเป็นช่องที่ระบบแนะนำจากการสแกน ให้ใส่เอฟเฟกต์กระพริบ
    if (state.highlightSpotId === sp.id) {
      el.classList.add("highlight");
    }

    el.innerHTML = `<span>${sp.id}</span>`;
    el.onclick = () => openSpotModal(sp.id, sp.status);
    grid.appendChild(el);
  });
}

// Modal แสดงรายละเอียดเมื่อกดที่ช่องจอด
const spotModal = document.getElementById("spotModal");
function openSpotModal(spotId, status) {
  const isFree = status === "free";
  document.getElementById("modalTitle").textContent = `ลานจอด ${state.lot} — ช่อง ${spotId}`;
  
  const badge = document.getElementById("modalStatusBadge");
  badge.className = `status-chip ${isFree ? 'free' : 'taken'}`;
  badge.textContent = isFree ? "สถานะ: ว่าง พร้อมเข้าจอด" : "สถานะ: มีรถจอดอยู่";

  document.getElementById("modalDesc").textContent = isFree 
    ? "ช่องนี้กำลังว่างอยู่ คุณสามารถขับรถเข้าจอดที่จุดนี้ได้เลย"
    : "ช่องนี้มีรถจอดอยู่แล้ว กรุณาเลือกช่องสีเขียวช่องอื่น";

  document.getElementById("modalIcon").textContent = isFree ? "✅" : "🚗";
  spotModal.classList.add("active");
}

document.getElementById("btnModalClose").onclick = () => {
  spotModal.classList.remove("active");
};

// สลับดูชั้น A1 / B1
document.querySelectorAll(".floor-pill").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".floor-pill").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.lot = tab.dataset.lot;
    state.highlightSpotId = null; // ล้างไฮไลต์เมื่อเปลี่ยนชั้น
    renderGrid();
  };
});

document.getElementById("btnRefresh").onclick = () => {
  fetchSpots();
  showToast("อัปเดตสถานะล่าสุดแล้ว");
};

document.getElementById("btnBrowse").onclick = () => {
  state.highlightSpotId = null;
  showScreen("s2");
  fetchSpots();
};

// --- สแกนหาช่องว่างด้วย Geolocation (GPS) ---
document.getElementById("btnLocate").onclick = async () => {
  const statusEl = document.getElementById("locStatus");
  if (!navigator.geolocation) {
    showToast("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
    return;
  }

  statusEl.textContent = "กำลังค้นหาตำแหน่งและคำนวณที่จอดใกล้ตัว...";

  navigator.geolocation.getCurrentPosition(
    async () => {
      await fetchSpots();
      let best = null;

      // หาช่องว่างแรกที่พบ
      for (const lot in state.spots) {
        const free = state.spots[lot].find(s => s.status === "free");
        if (free) {
          best = { lot, spot: free.id };
          break;
        }
      }

      if (best) {
        state.lot = best.lot;
        state.highlightSpotId = best.spot;
        statusEl.textContent = "พบที่จอดที่สะดวกที่สุดแล้ว ✅";
        document.getElementById("suggestCard").style.display = "block";
        document.getElementById("suggestText").textContent = `ลานจอด ${best.lot} — ช่อง ${best.spot}`;
      } else {
        statusEl.textContent = "ขออภัย ขณะนี้ที่จอดรถเต็มทุกช่อง";
        showToast("ที่จอดรถเต็มทุกช่อง");
      }
    },
    () => {
      statusEl.textContent = "ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาเปิด GPS";
      showToast("กรุณาเปิดการเข้าถึงตำแหน่ง GPS");
    }
  );
};

// ปุ่มนำทางไปยังผังลานจอดที่มีช่องแนะนำ
document.getElementById("goToSuggested").onclick = () => {
  // สลับแท็บชั้นให้ตรงกับช่องที่แนะนำ
  document.querySelectorAll(".floor-pill").forEach(t => {
    t.classList.toggle("active", t.dataset.lot === state.lot);
  });
  showScreen("s2");
  renderGrid();
};

// โหลดข้อมูลอัตโนมัติเมื่อเปิดเว็บ
window.addEventListener("DOMContentLoaded", () => {
  fetchSpots();
});