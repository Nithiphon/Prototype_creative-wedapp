/* ====== CONFIGURE THIS: your deployed Google Apps Script Web App URL ====== */
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbzOMYM-tWQKwMIiccUZh6Y3TG3I3DsTHnBtdCh8xGEO1yuGukUfiHrkatw0DpVbsIgJ0w/exec";
/* =========================================================================== */

let state = { lot: "A1", spot: null, spots: {} };

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

document.querySelectorAll("[data-back]").forEach(b => {
  b.onclick = () => showScreen(b.dataset.back);
});

// ---- Fetch spot statuses from backend ----
async function fetchSpots() {
  document.getElementById("gridStatus").textContent = "กำลังโหลด...";
  try {
    const res = await fetch(`${API_BASE_URL}?action=spots`);
    const data = await res.json();
    state.spots = data; // { A1: [{id:'A1-1',status:'free'}, ...], B1: [...] }
    renderGrid();
    document.getElementById("gridStatus").textContent = "";
  } catch (e) {
    document.getElementById("gridStatus").textContent = "⚠️ เชื่อมต่อฐานข้อมูลไม่ได้ (ตรวจสอบ API_BASE_URL)";
  }
}

function renderGrid() {
  const grid = document.getElementById("spotGrid");
  grid.innerHTML = "";
  const list = state.spots[state.lot] || [];
  list.forEach(sp => {
    const el = document.createElement("div");
    el.className = "spot " + (sp.status === "free" ? "free" : "taken");
    el.textContent = sp.id;
    if (sp.status === "free") {
      el.onclick = () => selectSpot(sp.id);
    }
    grid.appendChild(el);
  });
}

function selectSpot(spotId) {
  state.spot = spotId;
  document.getElementById("fLotSpot").value = `ลานจอด ${state.lot} — ช่อง ${spotId}`;
  showScreen("s3");
}

document.querySelectorAll(".lot-tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".lot-tab").forEach(t => t.classList.remove("active"));
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

// ---- Home screen: geolocation + suggest nearest free spot ----
document.getElementById("btnLocate").onclick = async () => {
  const statusEl = document.getElementById("locStatus");
  if (!navigator.geolocation) {
    statusEl.textContent = "อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง";
    return;
  }
  statusEl.textContent = "กำลังค้นหาตำแหน่งของคุณ...";
  navigator.geolocation.getCurrentPosition(
    async () => {
      // แนะนำลานจอดและช่องแรกที่ยังว่าง
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
        statusEl.textContent = "พบที่จอดใกล้ตำแหน่งคุณแล้ว ✅";
        document.getElementById("suggestCard").style.display = "block";
        document.getElementById("suggestText").textContent = `ลานจอด ${best.lot} — ช่อง ${best.spot}`;
      } else {
        statusEl.textContent = "ไม่มีที่ว่างในขณะนี้ ลองรีเฟรชอีกครั้ง";
      }
    },
    () => {
      statusEl.textContent = "ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง";
    }
  );
};

document.getElementById("goToSuggested").onclick = () => {
  document.getElementById("fLotSpot").value = `ลานจอด ${state.lot} — ช่อง ${state.spot}`;
  showScreen("s3");
};

// ---- Booking ----
document.getElementById("btnBook").onclick = async () => {
  const date = document.getElementById("fDate").value;
  const time = document.getElementById("fTime").value;
  const statusEl = document.getElementById("bookStatus");
  
  if (!date) {
    statusEl.textContent = "กรุณาเลือกวันที่";
    return;
  }
  if (!state.spot) {
    statusEl.textContent = "กรุณาเลือกช่องจอดก่อน";
    return;
  }
  
  statusEl.textContent = "กำลังบันทึกการจอง...";
  try {
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ lot: state.lot, spot: state.spot, date, time })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("cCode").textContent = data.bookingCode;
      document.getElementById("cSpot").textContent = `${state.lot} - ${state.spot}`;
      document.getElementById("cDate").textContent = date;
      document.getElementById("cTime").textContent = time;
      showScreen("s4");
    } else {
      statusEl.textContent = "❌ " + (data.error || "จองไม่สำเร็จ ช่องนี้อาจถูกจองไปแล้ว");
    }
  } catch (e) {
    statusEl.textContent = "⚠️ เชื่อมต่อฐานข้อมูลไม่ได้ (ตรวจสอบ API_BASE_URL)";
  }
};

document.getElementById("btnHome").onclick = () => {
  state = { lot: "A1", spot: null, spots: {} };
  document.getElementById("suggestCard").style.display = "none";
  document.getElementById("locStatus").textContent = "กดปุ่มด้านล่างเพื่อค้นหาที่จอดที่ใกล้ตำแหน่งคุณที่สุด";
  showScreen("s1");
};