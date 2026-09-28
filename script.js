/* ====== CONFIGURE THIS: URL ของ Google Apps Script Web App ====== */
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbzOMYM-tWQKwMIiccUZh6Y3TG3I3DsTHnBtdCh8xGEO1yuGukUfiHrkatw0DpVbsIgJ0w/exec";
/* ================================================================= */

let state = {
  lot: "A1",
  spot: null,
  spots: {},
  currentBooking: null
};

// --- จัดการหน้าจอ ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-back]").forEach(b => {
  b.onclick = () => showScreen(b.dataset.back);
});

// --- Toast แจ้งเตือน ---
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// --- ตรวจสอบตั๋วที่บันทึกไว้ในเครื่อง ---
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

document.getElementById("btnViewCurrentBooking").onclick = () => {
  if (!state.currentBooking) return;
  displayTicket(state.currentBooking);
};

// --- ดึงข้อมูลผังจอดรถ ---
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

document.querySelectorAll(".time-chip").forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    document.getElementById("fTime").value = chip.dataset.time;
  };
});

// --- สแกนตำแหน่ง GPS ---
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
      showToast("กรุณาเปิดการเข้าถึงตำแหน่ง GPS");
    }
  );
};

document.getElementById("goToSuggested").onclick = () => {
  document.getElementById("fLotSpot").value = `${state.lot} - ${state.spot}`;
  document.getElementById("fLotSpotLabel").textContent = `ลานจอด ${state.lot} — ช่อง ${state.spot}`;
  showScreen("s3");
};

// --- จองช่องจอด (ส่งค่าแบบตรงกับ backend เดิมเป๊ะๆ) ---
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
        lot: state.lot,
        spot: state.spot,
        date: date,
        time: time
      })
    });
    const data = await res.json();
    btn.disabled = false;

    if (data.success) {
      const bookingData = {
        bookingCode: data.bookingCode,
        lot: state.lot,
        spot: state.spot,
        date: date,
        time: time
      };
      // บันทึกลงเครื่องเพื่อแสดงตั๋ว
      localStorage.setItem("parking_booking", JSON.stringify(bookingData));
      state.currentBooking = bookingData;
      displayTicket(bookingData);
      showToast("🎉 จองที่จอดรถสำเร็จ!");
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

document.getElementById("btnCopyCode").onclick = () => {
  const code = document.getElementById("cCode").textContent;
  if (!code || code === "—") return;
  navigator.clipboard.writeText(code);
  showToast("📋 คัดลอกรหัสเรียบร้อยแล้ว");
};

document.getElementById("btnHome").onclick = () => {
  checkSavedBooking();
  showScreen("s1");
};

// เริ่มต้นระบบ
window.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("fDate");
  if (dateInput) {
    dateInput.value = today;
    dateInput.min = today;
  }
  checkSavedBooking();
});