
// =================================
// PAGE NAVIGATION
// =================================

const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");
const pageButtons = document.querySelectorAll("[data-page]");

function showPage(pageId) {
  pages.forEach(page => {
    page.classList.remove("active");
  });

  const selectedPage = document.getElementById(pageId);

  if (!selectedPage) return;

  selectedPage.classList.add("active");

  navItems.forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageId
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  // โหลดข้อมูลตามหน้าที่เปิด
  if (pageId === "historyPage") {
    loadHistoryData();
  }

  if (pageId === "settingsPage") {
    loadSettings();
  }
}

pageButtons.forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

// เริ่มต้นที่หน้าแรก
showPage("homePage");


// =================================
// API CONFIGURATION
// =================================

const API_URL = "https://script.google.com/macros/s/AKfycbwvnBSco1zPixavJ-Z7xT8nRw2w-TZrMgZC6lxmdSnUrAkzasxwAmBLtz0gXQywFnQJXA/exec";

const DEVICE_ID = "device_01";


// =================================
// GET LATEST WATER DATA
// =================================

async function loadLatestData() {
  try {
    const url =
      `${API_URL}?action=latest&device_id=${DEVICE_ID}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อ API ได้");
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error("ไม่พบข้อมูลระดับน้ำ");
    }

    const data = result.data;
    const waterPercent = Number(data.water_percent);

    if (!Number.isFinite(waterPercent)) {
      throw new Error("ข้อมูลระดับน้ำไม่ถูกต้อง");
    }

    // แสดงเปอร์เซ็นต์น้ำ
    document.getElementById("waterPercent").textContent =
      waterPercent.toFixed(1) + "%";

    // แสดงแถบระดับน้ำ
    const progress = document.getElementById("waterProgress");

    progress.style.width =
      Math.max(0, Math.min(100, waterPercent)) + "%";

    // ตรวจสอบสถานะน้ำ
    const statusElement =
      document.getElementById("waterStatus");

    if (waterPercent <= 10) {
      statusElement.textContent = "วิกฤต";
      statusElement.className = "status-badge critical";
      progress.style.background = "var(--danger)";

    } else if (waterPercent <= 40) {
      statusElement.textContent = "ใกล้หมด";
      statusElement.className = "status-badge low";
      progress.style.background = "var(--warning)";

    } else if (waterPercent <= 70) {
      statusElement.textContent = "ปกติ";
      statusElement.className = "status-badge medium";
      progress.style.background = "var(--success)";

    } else {
      statusElement.textContent = "ปกติ";
      statusElement.className = "status-badge";
      progress.style.background = "var(--success)";
    }

    // แสดงเวลาอัปเดตล่าสุด
    const updatedTime = new Date(
      Number(data.created_at) * 1000
    );

    document.getElementById("lastUpdated").textContent =
      updatedTime.toLocaleString("th-TH", {
        dateStyle: "short",
        timeStyle: "short"
      });

    console.log("อัปเดตข้อมูลสำเร็จ:", data);

  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);

    document.getElementById("waterPercent").textContent =
      "ไม่สามารถโหลดข้อมูล";

    document.getElementById("waterStatus").textContent =
      "เชื่อมต่อไม่สำเร็จ";
  }
}

// โหลดข้อมูลเมื่อเปิดเว็บไซต์
loadLatestData();

// อัปเดตทุก 10 วินาที
setInterval(loadLatestData, 10000);


// =================================
// LOAD RESPONSIBLE STAFF
// =================================

async function loadResponsibleStaff() {
  try {
    const url =
      `${API_URL}?action=staff&device_id=${DEVICE_ID}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อ API เจ้าหน้าที่ได้");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error("ไม่สามารถอ่านข้อมูลเจ้าหน้าที่ได้");
    }

    const staffName = result.data
      ? result.data.staff_name
      : "ยังไม่ได้กำหนดผู้รับผิดชอบ";

    const homeStaff =
      document.getElementById("responsibleStaff");

    const settingsStaff =
      document.getElementById("currentStaff");

    if (homeStaff) {
      homeStaff.textContent = staffName;
    }

    if (settingsStaff) {
      settingsStaff.textContent = staffName;
    }

    console.log("โหลดข้อมูลเจ้าหน้าที่สำเร็จ:", staffName);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลดเจ้าหน้าที่:", error);

    const homeStaff =
      document.getElementById("responsibleStaff");

    const settingsStaff =
      document.getElementById("currentStaff");

    if (homeStaff) {
      homeStaff.textContent = "โหลดข้อมูลไม่สำเร็จ";
    }

    if (settingsStaff) {
      settingsStaff.textContent = "โหลดข้อมูลไม่สำเร็จ";
    }
  }
}

loadResponsibleStaff();

setInterval(loadResponsibleStaff, 60000);


// =================================
// HISTORY CHART
// =================================

let waterChart = null;

async function loadHistoryData() {
  const deviceId =
    document.getElementById("deviceFilter").value;

  const period =
    document.getElementById("periodFilter").value;

  const chartMessage =
    document.getElementById("chartMessage");

  const dailyWater =
    document.getElementById("dailyWater");

  const dailyStatus =
    document.getElementById("dailyStatus");

  const dateFilter =
    document.getElementById("dateFilter");

  try {
    chartMessage.textContent = "กำลังโหลดข้อมูลกราฟ...";

    // ดึงข้อมูลย้อนหลังสูงสุด 100 รายการ
    const url =
      `${API_URL}?action=history&device_id=${deviceId}&limit=100`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อ API ได้");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.message || "โหลดข้อมูลย้อนหลังไม่สำเร็จ"
      );
    }

    let history = result.data || [];

    // เรียงข้อมูลจากเก่าไปใหม่
    history.sort((a, b) =>
      Number(a.created_at) - Number(b.created_at)
    );

    // แปลง Timestamp เป็นวันที่ท้องถิ่น
    function getLocalDate(timestamp) {
      const date = new Date(Number(timestamp) * 1000);

      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }

    // กำหนดวันที่เริ่มต้นเป็นวันที่ล่าสุดที่มีข้อมูล
    if (!dateFilter.value && history.length > 0) {
      dateFilter.value = getLocalDate(
        history[history.length - 1].created_at
      );
    }

    // ใช้วันที่ที่เลือก หรือวันที่ล่าสุดที่มีข้อมูล
    const selectedDate = dateFilter.value ||
      (history.length > 0
        ? getLocalDate(history[history.length - 1].created_at)
        : "");

    let chartData = [];
    let labels = [];

    // =================================
    // MODE 1: DAILY
    // =================================

    if (period === "daily") {
      dateFilter.style.display = "";

      // เลือกข้อมูลเฉพาะวันที่กำหนด
      chartData = history.filter(item =>
        getLocalDate(item.created_at) === selectedDate
      );

      // แสดงเวลาแบบชั่วโมง:นาที
      labels = chartData.map(item =>
        new Date(Number(item.created_at) * 1000)
          .toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit"
          })
      );
    }

    // =================================
    // MODE 2: LAST 7 DAYS
    // =================================

    else if (period === "7days") {
      dateFilter.style.display = "none";

      // ใช้วันที่ที่เลือกเป็นวันสุดท้ายของช่วง
      const endDate = new Date(
        selectedDate + "T00:00:00"
      );

      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(endDate);

      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      const startTimestamp =
        Math.floor(startDate.getTime() / 1000);

      const endTimestamp =
        Math.floor(endDate.getTime() / 1000);

      const filtered = history.filter(item =>
        Number(item.created_at) >= startTimestamp &&
        Number(item.created_at) <= endTimestamp
      );

      // รวมข้อมูลเป็นค่าเฉลี่ยรายวัน
      const dailyGroups = {};

      filtered.forEach(item => {
        const date = getLocalDate(item.created_at);

        if (!dailyGroups[date]) {
          dailyGroups[date] = [];
        }

        dailyGroups[date].push(
          Number(item.water_percent)
        );
      });

      chartData = Object.keys(dailyGroups)
        .sort()
        .map(date => ({
          date: date,
          water_percent:
            dailyGroups[date].reduce(
              (sum, value) => sum + value, 0
            ) / dailyGroups[date].length
        }));

      labels = chartData.map(item => {
        const date = new Date(item.date + "T00:00:00");

        return date.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short"
        });
      });
    }

    // =================================
    // NO DATA
    // =================================

    if (chartData.length === 0) {
      if (waterChart) {
        waterChart.destroy();
        waterChart = null;
      }

      chartMessage.textContent =
        "ไม่มีข้อมูลในช่วงเวลาที่เลือก";

      dailyWater.textContent = "-";
      dailyStatus.textContent = "-";

      return;
    }

    // =================================
    // PREPARE CHART DATA
    // =================================

    const values = chartData.map(item =>
      Number(item.water_percent)
    );

    const ctx =
      document.getElementById("waterChart").getContext("2d");

    // ลบกราฟเดิมก่อนสร้างกราฟใหม่
    if (waterChart) {
      waterChart.destroy();
    }

    // =================================
    // CREATE CHART
    // =================================

    waterChart = new Chart(ctx, {
      type: "line",

      data: {
        labels: labels,

        datasets: [{
          label: period === "daily"
            ? "ปริมาณน้ำคงเหลือ (%)"
            : "ปริมาณน้ำเฉลี่ยรายวัน (%)",

          data: values,

          borderColor: "#368fc4",
          backgroundColor: "rgba(54, 143, 196, 0.12)",

          borderWidth: 2,
          fill: true,
          tension: 0.3,

          pointRadius: 3,
          pointHoverRadius: 7,
          pointHitRadius: 12
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        // แสดง Tooltip ของจุดที่เลือก
        interaction: {
          mode: "nearest",
          intersect: true
        },

        plugins: {
          tooltip: {
            enabled: true,

            callbacks: {
              // แสดงวันและเวลาจริงเมื่อเลือกจุด
              title: function(items) {
                if (!items.length) return "";

                const index = items[0].dataIndex;
                const point = chartData[index];

                if (period === "daily") {
                  const readingDate = new Date(
                    Number(point.created_at) * 1000
                  );

                  return readingDate.toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "medium"
                  });
                }

                const date = new Date(
                  point.date + "T00:00:00"
                );

                return date.toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                });
              },

              // แสดงเปอร์เซ็นต์น้ำ
              label: function(context) {
                return `ปริมาณน้ำ: ${context.parsed.y.toFixed(1)}%`;
              },

              // เพิ่มคำอธิบายเฉพาะโหมด 7 วัน
              afterLabel: function() {
                if (period === "7days") {
                  return "ค่าเฉลี่ยประจำวัน";
                }

                return "";
              }
            }
          }
        },

        scales: {
          y: {
            min: 0,
            max: 100,

            title: {
              display: true,
              text: "ปริมาณน้ำ (%)"
            }
          },

          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: period === "daily" ? 6 : 7,
              maxRotation: 0
            },

            title: {
              display: true,
              text: period === "daily" ? "เวลา" : "วันที่"
            }
          }
        }
      }
    });

    // =================================
    // DAILY SUMMARY
    // =================================

    const latest = chartData[chartData.length - 1];

    const percent = Number(latest.water_percent);

    dailyWater.textContent =
      percent.toFixed(1) + "%";

    if (percent <= 10) {
      dailyStatus.textContent = "วิกฤต";

    } else if (percent <= 40) {
      dailyStatus.textContent = "ใกล้หมด";

    } else {
      dailyStatus.textContent = "ปกติ";
    }

    chartMessage.textContent =
      `แสดงข้อมูล ${chartData.length} ${
        period === "daily" ? "รายการ" : "วัน"
      }`;

  } catch (error) {
    console.error("โหลดกราฟผิดพลาด:", error);

    chartMessage.textContent =
      "ไม่สามารถโหลดข้อมูลกราฟได้";
  }
}


// =================================
// HISTORY EVENTS
// =================================

// โหลดกราฟเมื่อเปลี่ยนเครื่อง
document.getElementById("deviceFilter")
  .addEventListener("change", loadHistoryData);

// โหลดกราฟเมื่อเปลี่ยนวันที่
document.getElementById("dateFilter")
  .addEventListener("change", loadHistoryData);

// โหลดกราฟเมื่อเปลี่ยนรูปแบบ
document.getElementById("periodFilter")
  .addEventListener("change", loadHistoryData);


// =================================
// SETTINGS: LOAD CONFIGURATION
// =================================

async function loadSettings() {
  const thresholdInput =
    document.getElementById("thresholdInput");

  const lineGroupInput =
    document.getElementById("lineGroupInput");

  const settingsMessage =
    document.getElementById("settingsMessage");

  try {
    const url =
      `${API_URL}?action=settings&device_id=${DEVICE_ID}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อ API ได้");
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(
        result.message || "ไม่พบการตั้งค่า"
      );
    }

    thresholdInput.value =
      result.data.threshold_percent;

    lineGroupInput.value =
      result.data.line_group_id || "";

    settingsMessage.textContent =
      "โหลดการตั้งค่าสำเร็จ";

    settingsMessage.style.color = "green";

    console.log("โหลดการตั้งค่าสำเร็จ:", result.data);

  } catch (error) {
    console.error("โหลดการตั้งค่าผิดพลาด:", error);

    settingsMessage.textContent =
      "ไม่สามารถโหลดการตั้งค่าได้";

    settingsMessage.style.color = "red";
  }
}


// =================================
// SETTINGS: SAVE CONFIGURATION
// =================================

async function saveSettings() {
  const thresholdInput =
    document.getElementById("thresholdInput");

  const lineGroupInput =
    document.getElementById("lineGroupInput");

  const settingsMessage =
    document.getElementById("settingsMessage");

  const saveButton =
    document.getElementById("saveSettingsBtn");

  const threshold = Number(thresholdInput.value);

  const lineGroupId =
    lineGroupInput.value.trim();

  // ตรวจสอบค่าเกณฑ์แจ้งเตือน
  if (
    thresholdInput.value.trim() === "" ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100
  ) {
    settingsMessage.textContent =
      "กรุณากำหนดเกณฑ์แจ้งเตือนระหว่าง 0–100%";

    settingsMessage.style.color = "red";

    return;
  }

  try {
    saveButton.disabled = true;

    settingsMessage.textContent =
      "กำลังบันทึก...";

    settingsMessage.style.color = "";

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },

      body: JSON.stringify({
        action: "save_settings",
        device_id: DEVICE_ID,
        threshold_percent: threshold,
        line_group_id: lineGroupId
      })
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อ API ได้");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.message || "บันทึกไม่สำเร็จ"
      );
    }

    settingsMessage.textContent =
      "บันทึกการตั้งค่าสำเร็จ";

    settingsMessage.style.color = "green";

    console.log("บันทึกการตั้งค่าสำเร็จ:", result);

  } catch (error) {
    console.error("บันทึกการตั้งค่าผิดพลาด:", error);

    settingsMessage.textContent =
      "บันทึกไม่สำเร็จ: " + error.message;

    settingsMessage.style.color = "red";

  } finally {
    saveButton.disabled = false;
  }
}


// =================================
// SETTINGS EVENTS
// =================================

// โหลดการตั้งค่าเมื่อเปิดเว็บไซต์ครั้งแรก
loadSettings();

// บันทึกการตั้งค่าเมื่อกดปุ่ม
document.getElementById("saveSettingsBtn")
  .addEventListener("click", saveSettings);
