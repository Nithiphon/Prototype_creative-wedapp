/* ====== CONFIGURE THIS: URL ของ Google Apps Script Web App ====== */
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbzOMYM-tWQKwMIiccUZh6Y3TG3I3DsTHnBtdCh8xGEO1yuGukUfiHrkatw0DpVbsIgJ0w/exec";
/* ================================================================= */

let state = {
  lot: "A1",
  spot: null,
  spots: {},
  currentBooking: null,
  pendingCancelCode: null
};

// --- จัดการหน้าจอ (Screens) ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-back]").forEach(b => {
  b.onclick = () => showScreen(b.dataset.back);
});

// --- ระบบแจ้งเตือน Toast ---
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

// --- โหลดตั๋วค้างใน LocalStorage ---
function checkSavedBooking() {
  const saved = localStorage.getItem("parking_booking");
  const card = document.getElementById("homeActiveBooking");
  if (saved) {
    try {
      state.currentBooking = JSON.parse(saved);
      document.getElementById("briefSpot").textContent = `${state.currentBooking.lot} — ${state.currentBooking.spot}`;
      document.getElementById("briefTime").textContent = `${state.currentBooking.date} • ${state.currentBooking.time}`;
      card.style.display = "block";
    } catch(e) {
      localStorage.removeItem("parking_booking");
      card.style.display = "none";
    }
  } else {
    card.style.display = "none";
  }
}

// ดูตั๋วจากหน้าแรก
document.getElementById("btnViewCurrentBooking").onclick = () => {
  if (!state.currentBooking) return;
  displayTicket(state.currentBooking);
};

// --- ดึงข้อมูลช่องจอด (Fetch Spots) ---
async function fetchSpots() {
  const statusEl = document.getElementById("gridStatus");
  statusEl.textContent = "กำลังโหลดข้อมูลช่องจอด...";
  try {
    const res = await fetch(`${API_BASE_URL}?action=spots`);
    const data = await res.json();
    state.spots = data;
    renderGrid();
    updateSlotCounts();
    statusEl.textContent = "";
  } catch (e) {
    statusEl.textContent = "⚠️ ไม่สามารถเชื่อมต่อฐานข้อมูลได้";
    showToast("เชื่อมต่อข้อมูลไม่สำเร็จ");
  }
}

function updateSlotCounts() {
  ["A1", "B1"].forEach(lot => {
    const list = state.spots[lot] || [];
    const freeCount = list.filter(s => s.status === "free").length;
    const countEl = document.getElementById(`count${lot}`);
    if (countEl) countEl.textContent = `ว่าง ${freeCount}`;
  });
}

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
    el.className = "spot " + (sp.status === "free" ? "free" : "taken");
    el.innerHTML = `<span>${sp.id}</span>`;
    if (sp.status === "free") {
      el.onclick = () => selectSpot(sp.id);
    }
    grid.appendChild(el);
  });
}

function selectSpot(spotId) {
  state.spot = spotId;
  document.getElementById("fLotSpot").value = `${state.lot} - ${spotId}`;
  document.getElementById("fLotSpotLabel").textContent = `ลานจอด ${state.lot} — ช่อง ${spotId}`;
  showScreen("s3");
}

// เลือกลานจอด
document.querySelectorAll(".floor-pill").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".floor-pill").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.lot = tab.dataset.lot;
    renderGrid();
  };
});

document.getElementById("btnRefresh").onclick = fetchSpots;
document.getElementById("btnBrowse").onclick = () => {
  showScreen("s2");
  fetchSpots();
};

// เลือกช่วงเวลา (Time Chips)
document.querySelectorAll(".time-chip").forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    document.getElementById("fTime").value = chip.dataset.time;
  };
});

// --- สแกนตำแหน่ง (Geolocation) ---
document.getElementById("btnLocate").onclick = async () => {
  const statusEl = document.getElementById("locStatus");
  if (!navigator.geolocation) {
    showToast("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
    return;
  }
  statusEl.textContent = "กำลังค้นหาตำแหน่งและคำนวณที่จอด...";
  
  navigator.geolocation.getCurrentPosition(
    async () => {
      await fetchSpots();
      let best = null;
      for (const lot in state.spots) {
        const free = state.spots[lot].find(s => s.status === "free");
        if (free) {
          best = { lot, spot: free.id };
          break;
        }
      }
      if (best) {
        state.lot = best.lot;
        state.spot = best.spot;
        statusEl.textContent = "พบที่จอดที่ใกล้และสะดวกที่สุดแล้ว ✅";
        document.getElementById("suggestCard").style.display = "block";
        document.getElementById("suggestText").textContent = `ลานจอด ${best.lot} — ช่อง ${best.spot}`;
      } else {
        statusEl.textContent = "ขออภัย ขณะนี้ที่จอดรถเต็มทุกช่อง";
        showToast("ที่จอดรถเต็มทุกช่อง");
      }
    },
    () => {
      statusEl.textContent = "ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาเปิด GPS";
      showToast("กรุณาอนุญาตการเข้าถึงตำแหน่ง GPS");
    }
  );
};

document.getElementById("goToSuggested").onclick = () => {
  document.getElementById("fLotSpot").value = `${state.lot} - ${state.spot}`;
  document.getElementById("fLotSpotLabel").textContent = `ลานจอด ${state.lot} — ช่อง ${state.spot}`;
  showScreen("s3");
};

// --- จองช่องจอด (Booking) ---
document.getElementById("btnBook").onclick = async () => {
  const date = document.getElementById("fDate").value;
  const time = document.getElementById("fTime").value;
  const statusEl = document.getElementById("bookStatus");
  const btn = document.getElementById("btnBook");

  if (!date) {
    showToast("กรุณาเลือกวันที่จอง");
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "กำลังดำเนินการบันทึกข้อมูล...";

  try {
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "book",
        lot: state.lot,
        spot: state.spot,
        date,
        time
      })
    });
    const data = await res.json();
    btn.disabled = false;

    if (data.success) {
      const bookingData = {
        bookingCode: data.bookingCode,
        lot: state.lot,
        spot: state.spot,
        date,
        time
      };
      // บันทึกตั๋วลงเครื่อง
      localStorage.setItem("parking_booking", JSON.stringify(bookingData));
      state.currentBooking = bookingData;
      displayTicket(bookingData);
      showToast("จองที่จอดรถสำเร็จ!");
    } else {
      statusEl.textContent = "❌ " + (data.error || "จองไม่สำเร็จ ช่องนี้อาจเพิ่งถูกจองไป");
    }
  } catch (e) {
    btn.disabled = false;
    statusEl.textContent = "⚠️ ไม่สามารถเชื่อมต่อกับระบบได้";
  }
};

function displayTicket(data) {
  document.getElementById("cCode").textContent = data.bookingCode;
  document.getElementById("cSpot").textContent = `${data.lot} - ${data.spot}`;
  document.getElementById("cDate").textContent = data.date;
  document.getElementById("cTime").textContent = data.time;
  showScreen("s4");
}

// คัดลอกรหัสตั๋ว
document.getElementById("btnCopyCode").onclick = () => {
  const code = document.getElementById("cCode").textContent;
  navigator.clipboard.writeText(code);
  showToast("คัดลอกรหัสเรียบร้อยแล้ว");
};

// --- ระบบยกเลิกการจอง (Cancellation System) ---
const cancelModal = document.getElementById("cancelModal");

function openCancelModal(bookingCode) {
  state.pendingCancelCode = bookingCode;
  cancelModal.classList.add("active");
}

document.getElementById("btnCancelModalClose").onclick = () => {
  cancelModal.classList.remove("active");
  state.pendingCancelCode = null;
};

// กดจากหน้าตั๋ว
document.getElementById("btnCancelFromTicket").onclick = () => {
  const code = document.getElementById("cCode").textContent;
  openCancelModal(code);
};

// ยืนยันยกเลิกใน Modal
document.getElementById("btnConfirmCancel").onclick = async () => {
  const code = state.pendingCancelCode;
  if (!code) return;

  const btnConfirm = document.getElementById("btnConfirmCancel");
  btnConfirm.textContent = "กำลังยกเลิก...";
  btnConfirm.disabled = true;

  try {
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "cancel",
        bookingCode: code
      })
    });
    const data = await res.json();
    btnConfirm.textContent = "ยืนยันยกเลิก";
    btnConfirm.disabled = false;
    cancelModal.classList.remove("active");

    if (data.success) {
      localStorage.removeItem("parking_booking");
      state.currentBooking = null;
      showToast("ยกเลิกการจองสำเร็จ");
      checkSavedBooking();
      showScreen("s1");
    } else {
      showToast("❌ " + (data.error || "ไม่สามารถยกเลิกได้"));
    }
  } catch (e) {
    btnConfirm.textContent = "ยืนยันยกเลิก";
    btnConfirm.disabled = false;
    showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ");
  }
};

// --- หน้าค้นหา / จัดการตั๋ว (Lookup) ---
document.getElementById("btnOpenLookup").onclick = () => {
  showScreen("s5");
  document.getElementById("lookupResultCard").style.display = "none";
  document.getElementById("lookupStatus").textContent = "";
  if (state.currentBooking) {
    document.getElementById("inputLookupCode").value = state.currentBooking.bookingCode;
  }
};

document.getElementById("btnDoLookup").onclick = () => {
  const code = document.getElementById("inputLookupCode").value.trim();
  const statusEl = document.getElementById("lookupStatus");
  const resultCard = document.getElementById("lookupResultCard");

  if (!code) {
    showToast("กรุณากรอกรหัสการจอง");
    return;
  }

  // หากตรงกับตั๋วในเครื่อง
  if (state.currentBooking && state.currentBooking.bookingCode === code) {
    document.getElementById("lookupSpot").textContent = `ลานจอด ${state.currentBooking.lot} — ช่อง ${state.currentBooking.spot}`;
    document.getElementById("lookupDetails").textContent = `วันที่ ${state.currentBooking.date} • เวลา ${state.currentBooking.time}`;
    resultCard.style.display = "block";
    statusEl.textContent = "";
  } else {
    // ให้สามารถยกเลิกผ่านรหัสนี้ได้เลย
    document.getElementById("lookupSpot").textContent = `รหัสการจอง: ${code}`;
    document.getElementById("lookupDetails").textContent = "พร้อมดำเนินการยกเลิก";
    resultCard.style.display = "block";
    statusEl.textContent = "";
  }
};

document.getElementById("btnCancelFromLookup").onclick = () => {
  const code = document.getElementById("inputLookupCode").value.trim();
  openCancelModal(code);
};

document.getElementById("btnHome").onclick = () => {
  checkSavedBooking();
  showScreen("s1");
};

// ตั้งค่าวันที่เริ่มต้นเป็น "วันนี้" อัตโนมัติ
window.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("fDate");
  dateInput.value = today;
  dateInput.min = today;
  checkSavedBooking();
});