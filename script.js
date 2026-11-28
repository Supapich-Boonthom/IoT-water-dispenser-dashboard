
// =============================================
// 1. API CONFIGURATION
// =============================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbwvnBSco1zPixavJ-Z7xT8nRw2w-TZrMgZC6lxmdSnUrAkzasxwAmBLtz0gXQywFnQJXA/exec";

// คง Device ID เดิม ห้ามสลับ
const DEVICES = [
  {
    id: "device_02",
    name: "เครื่องกดน้ำ ชั้น 2",
    location: "ห้องสมุด ชั้น 2"
  },
  {
    id: "device_01",
    name: "เครื่องกดน้ำ ชั้น 3",
    location: "ห้องสมุด ชั้น 3"
  }
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const DAY_LABELS = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์"
];

const REFRESH_INTERVAL = 10000;


// =============================================
// 2. APPLICATION STATE
// =============================================

let selectedHomeDevice = "device_02";
let selectedSettingsDevice = "device_02";

let latestData = {};
let staffData = {};
let scheduleData = {};
let settingsData = {};

let waterChart = null;

let isScheduleOpen = false;


// =============================================
// 3. HELPER FUNCTIONS
// =============================================

function getDevice(deviceId) {
  return DEVICES.find(device => device.id === deviceId);
}


function getDeviceName(deviceId) {
  const device = getDevice(deviceId);

  return device ? device.name : deviceId;
}


function getElement(id) {
  return document.getElementById(id);
}


function setText(id, value) {
  const element = getElement(id);

  if (element) {
    element.textContent = value;
  }
}


function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}


function getWaterStatus(percent) {
  if (percent <= 10) {
    return {
      text: "วิกฤต",
      className: "critical",
      color: "var(--danger, #dc535b)"
    };
  }

  if (percent <= 40) {
    return {
      text: "ใกล้หมด",
      className: "low",
      color: "var(--warning, #e5a33b)"
    };
  }

  return {
    text: "ปกติ",
    className: "medium",
    color: "var(--success, #26966b)"
  };
}


function formatTimestamp(timestamp) {
  if (!timestamp) return "-";

  let date;

  // รองรับทั้ง Unix timestamp และวันที่แบบข้อความ
  if (
    typeof timestamp === "number" ||
    /^\d+$/.test(String(timestamp))
  ) {
    let number = Number(timestamp);

    // รองรับ timestamp แบบ milliseconds
    if (number > 9999999999) {
      date = new Date(number);
    } else {
      date = new Date(number * 1000);
    }
  } else {
    date = new Date(timestamp);
  }

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short"
  });
}


function getLocalDate(timestamp) {
  const date = new Date(Number(timestamp) * 1000);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


function getTodayDate() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


function getCurrentMonth() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0")
  ].join("-");
}


// =============================================
// MONTHLY BOTTLE CHANGE SUMMARY
// =============================================

async function loadBottleChangeSummary() {
  const monthInput = getElement("bottleMonthFilter");
  const deviceFilter = getElement("deviceFilter");

  if (!monthInput || !deviceFilter) return;

  if (!monthInput.value) {
    monthInput.value = getCurrentMonth();
  }

  const month = monthInput.value;
  const deviceId = deviceFilter.value;

  setText("bottleChangeTotal", "กำลังโหลด...");
  setText("bottleChangeDevice02", "-");
  setText("bottleChangeDevice01", "-");
  setText("bottleChangeMessage", "กำลังโหลดข้อมูล...");

  try {
    const result = await getAPI(
      "bottle_changes",
      deviceId,
      { month }
    );

    if (!result.success) {
      throw new Error(
        result.message || "ไม่สามารถอ่านประวัติได้"
      );
    }

    const byDevice = result.by_device || {};

    setText(
      "bottleChangeTotal",
      `${Number(result.count || 0)} ครั้ง`
    );

    setText(
      "bottleChangeDevice02",
      `${Number(byDevice.device_02 || 0)} ครั้ง`
    );

    setText(
      "bottleChangeDevice01",
      `${Number(byDevice.device_01 || 0)} ครั้ง`
    );

    setText(
      "bottleChangeMessage",
      `ข้อมูลประจำเดือน ${month}`
    );

  } catch (error) {
    console.error(
      "โหลดสรุปการเปลี่ยนถังผิดพลาด:",
      error
    );

    setText("bottleChangeTotal", "-");
    setText("bottleChangeDevice02", "-");
    setText("bottleChangeDevice01", "-");

    setText(
      "bottleChangeMessage",
      "โหลดข้อมูลไม่สำเร็จ: " + error.message
    );
  }
}



function getTodayDayName() {
  return DAY_NAMES[new Date().getDay()];
}


async function fetchJSON(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}


async function getAPI(action, deviceId, extra = {}) {
  const params = new URLSearchParams({
    action,
    device_id: deviceId,
    ...extra
  });

  return await fetchJSON(`${API_URL}?${params.toString()}`);
}


// =============================================
// 4. PAGE NAVIGATION
// =============================================

const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");
const pageButtons = document.querySelectorAll("[data-page]");


function showPage(pageId) {
  const selectedPage = getElement(pageId);

  if (!selectedPage) return;

  pages.forEach(page => {
    page.classList.remove("active");
  });

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


navItems.forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});


// =============================================
// 5. HOME: LOAD LATEST DATA
// =============================================

async function loadDeviceLatest(device) {
  try {
    const result = await getAPI(
      "latest",
      device.id
    );

    if (!result.success || !result.data) {
      throw new Error(
        result.message || "ไม่พบข้อมูลระดับน้ำ"
      );
    }

    const data = result.data;
    const percent = Number(data.water_percent);

    if (!Number.isFinite(percent)) {
      throw new Error("ข้อมูลระดับน้ำไม่ถูกต้อง");
    }

    latestData[device.id] = data;

    updateOverviewCard(device.id, percent);

    updateSelectedDevice();

    console.log(
      "โหลดข้อมูลล่าสุดสำเร็จ:",
      device.id,
      percent
    );

  } catch (error) {
    console.error(
      "โหลดข้อมูลเครื่องไม่สำเร็จ:",
      device.id,
      error
    );

    updateOverviewError(device.id);
  }
}


async function loadAllLatestData() {
  await Promise.all(
    DEVICES.map(device => loadDeviceLatest(device))
  );
}


// =============================================
// 6. HOME: UPDATE OVERVIEW CARDS
// =============================================

function updateOverviewCard(deviceId, percent) {
  const status = getWaterStatus(percent);
  const safePercent = clampPercent(percent);

  const percentElement =
    getElement(`overviewPercent_${deviceId}`);

  const statusElement =
    getElement(`overviewStatus_${deviceId}`);

  const progressElement =
    getElement(`overviewProgress_${deviceId}`);

  if (percentElement) {
    percentElement.textContent =
      `${percent.toFixed(1)}%`;
  }

  if (statusElement) {
    statusElement.textContent = status.text;
    statusElement.className =
      `status-badge ${status.className}`;
  }

  if (progressElement) {
    progressElement.style.width =
      `${safePercent}%`;

    progressElement.style.background =
      status.color;
  }
}


function updateOverviewError(deviceId) {
  const percentElement =
    getElement(`overviewPercent_${deviceId}`);

  const statusElement =
    getElement(`overviewStatus_${deviceId}`);

  if (percentElement) {
    percentElement.textContent = "--%";
  }

  if (statusElement) {
    statusElement.textContent = "ไม่มีข้อมูล";
    statusElement.className = "status-badge";
  }
}


// =============================================
// 7. HOME: SELECT DEVICE
// =============================================

function selectHomeDevice(deviceId) {
  if (!getDevice(deviceId)) return;

  selectedHomeDevice = deviceId;

  document.querySelectorAll("[data-device-select]")
    .forEach(button => {

      const isSelected =
        button.dataset.deviceSelect === deviceId;

      button.classList.toggle("active", isSelected);

      button.setAttribute(
        "aria-pressed",
        String(isSelected)
      );
    });

  updateSelectedDevice();
}


document.querySelectorAll("[data-device-select]")
  .forEach(button => {

    button.addEventListener("click", () => {
      selectHomeDevice(button.dataset.deviceSelect);
    });

  });


// =============================================
// 8. HOME: SHOW SELECTED DEVICE DETAILS
// =============================================

function updateSelectedDevice() {
  const device = getDevice(selectedHomeDevice);

  if (!device) return;

  setText("selectedDeviceName", device.name);

  setText(
    "selectedDeviceLocation",
    `📍 ${device.location}`
  );

  const data = latestData[selectedHomeDevice];

  if (!data) {
    setText("selectedWaterPercent", "--%");
    setText("selectedLastUpdated", "ไม่มีข้อมูล");

    const statusElement =
      getElement("selectedDeviceStatus");

    if (statusElement) {
      statusElement.textContent = "ไม่มีข้อมูล";
      statusElement.className = "status-badge";
    }

    return;
  }

  const percent = Number(data.water_percent);
  const status = getWaterStatus(percent);

  setText(
    "selectedWaterPercent",
    `${percent.toFixed(1)}%`
  );

  const statusElement =
    getElement("selectedDeviceStatus");

  if (statusElement) {
    statusElement.textContent = status.text;

    statusElement.className =
      `status-badge ${status.className}`;
  }

  const progress =
    getElement("selectedWaterProgress");

  if (progress) {
    progress.style.width =
      `${clampPercent(percent)}%`;

    progress.style.background =
      status.color;
  }

  setText(
    "selectedLastUpdated",
    formatTimestamp(data.created_at)
  );

  setText(
    "selectedLastBottleChange",
    "ยังไม่มีข้อมูล"
  );

  const staffName =
    staffData[selectedHomeDevice];

  setText(
    "selectedResponsibleStaff",
    staffName || "กำลังโหลด..."
  );
}


// =============================================
// 9. STAFF: LOAD WEEKLY SCHEDULE
// =============================================

async function loadStaffSchedule(deviceId) {
  try {
    const result = await getAPI(
      "staff_schedule",
      deviceId
    );

    if (!result.success) {
      throw new Error(
        result.message || "โหลดตารางเวรไม่สำเร็จ"
      );
    }

    scheduleData[deviceId] = {
      data: result.data || [],
      staffList: result.staff_list || []
    };

    updateCurrentStaff(deviceId);

    return scheduleData[deviceId];

  } catch (error) {
    console.error(
      "โหลดตารางเวรไม่สำเร็จ:",
      deviceId,
      error
    );

    throw error;
  }
}


// =============================================
// 10. STAFF: CURRENT RESPONSIBLE PERSON
// =============================================

function updateCurrentStaff(deviceId) {
  const schedule = scheduleData[deviceId];

  if (!schedule) return;

  const today = getTodayDayName();

  const todayAssignment = schedule.data.find(item =>
    item.day_of_week === today
  );

  const staffName =
    todayAssignment?.staff_name ||
    "ยังไม่ได้กำหนดผู้รับผิดชอบ";

  staffData[deviceId] = staffName;

  if (deviceId === selectedHomeDevice) {
    setText(
      "selectedResponsibleStaff",
      staffName
    );
  }

  if (deviceId === selectedSettingsDevice) {
    setText(
      "currentStaff",
      staffName
    );
  }
}


// =============================================
// 11. STAFF: LOAD HOME STAFF
// =============================================

async function loadAllStaff() {
  await Promise.all(
    DEVICES.map(async device => {
      try {
        await loadStaffSchedule(device.id);
      } catch (error) {
        staffData[device.id] =
          "โหลดข้อมูลไม่สำเร็จ";

        if (device.id === selectedHomeDevice) {
          setText(
            "selectedResponsibleStaff",
            "โหลดข้อมูลไม่สำเร็จ"
          );
        }
      }
    })
  );

  updateSelectedDevice();
}


// =============================================
// 12. HISTORY: FETCH DEVICE HISTORY
// =============================================

async function fetchDeviceHistory(deviceId) {
  const result = await getAPI(
    "history",
    deviceId,
    { limit: "100" }
  );

  if (!result.success) {
    throw new Error(
      result.message || "โหลดข้อมูลย้อนหลังไม่สำเร็จ"
    );
  }

  return (result.data || [])
    .map(item => ({
      ...item,
      device_id: deviceId
    }))
    .sort((a, b) =>
      Number(a.created_at) - Number(b.created_at)
    );
}


// =============================================
// 13. HISTORY: PREPARE DAILY DATA
// =============================================

function prepareDailyData(history, selectedDate) {
  return history.filter(item =>
    getLocalDate(item.created_at) === selectedDate
  );
}


// =============================================
// 14. HISTORY: PREPARE 7-DAY DATA
// =============================================

function prepareWeeklyData(history, selectedDate) {
  const endDate = new Date(
    `${selectedDate}T00:00:00`
  );

  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);

  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const startTimestamp =
    Math.floor(startDate.getTime() / 1000);

  const endTimestamp =
    Math.floor(endDate.getTime() / 1000);

  const filtered = history.filter(item => {
    const timestamp = Number(item.created_at);

    return (
      timestamp >= startTimestamp &&
      timestamp <= endTimestamp
    );
  });

  const groups = {};

  filtered.forEach(item => {
    const date = getLocalDate(item.created_at);

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(
      Number(item.water_percent)
    );
  });

  return Object.keys(groups)
    .sort()
    .map(date => ({
      date,
      water_percent:
        groups[date].reduce(
          (sum, value) => sum + value,
          0
        ) / groups[date].length
    }));
}


// =============================================
// 15. HISTORY: UPDATE SUMMARY
// =============================================

function updateHistorySummary(deviceHistories, selectedDate, period) {
  const dailyWater = getElement("dailyWater");
  const dailyStatus = getElement("dailyStatus");

  if (!dailyWater || !dailyStatus) return;

  const deviceFilter =
    getElement("deviceFilter").value;

  const summaries = [];

  deviceHistories.forEach(item => {
    let data;

    if (period === "daily") {
      data = prepareDailyData(
        item.history,
        selectedDate
      );
    } else {
      data = prepareWeeklyData(
        item.history,
        selectedDate
      );
    }

    if (data.length === 0) return;

    const latest = data[data.length - 1];
    const percent = Number(latest.water_percent);

    summaries.push({
      name: item.device.name.replace("เครื่องกดน้ำ ", ""),
      percent
    });
  });

  if (summaries.length === 0) {
    dailyWater.textContent = "-";
    dailyStatus.textContent = "ไม่มีข้อมูล";
    return;
  }

  if (deviceFilter === "all") {
    dailyWater.textContent = summaries
      .map(item =>
        `${item.name} ${item.percent.toFixed(1)}%`
      )
      .join(" | ");

    dailyStatus.textContent = summaries
      .map(item => {
        const status = getWaterStatus(item.percent);

        return `${item.name}: ${status.text}`;
      })
      .join(" | ");

  } else {
    const item = summaries[0];
    const status = getWaterStatus(item.percent);

    dailyWater.textContent =
      `${item.percent.toFixed(1)}%`;

    dailyStatus.textContent = status.text;
  }
}


// =============================================
// 16. HISTORY: BUILD CHART DATASETS
// =============================================

function buildHistoryDatasets(deviceHistories, selectedDate, period) {
  const datasets = [];
  const allLabels = new Set();

  const colors = {
    device_02: "#368fc4",
    device_01: "#26966b"
  };

  deviceHistories.forEach(item => {
    let data;

    if (period === "daily") {
      data = prepareDailyData(
        item.history,
        selectedDate
      );
    } else {
      data = prepareWeeklyData(
        item.history,
        selectedDate
      );
    }

    data.forEach(point => {
      allLabels.add(
        period === "daily"
          ? String(point.created_at)
          : point.date
      );
    });

    datasets.push({
      deviceId: item.device.id,
      label: item.device.name,
      data,
      color: colors[item.device.id]
    });
  });

  const labels = Array.from(allLabels).sort((a, b) => {
    if (period === "daily") {
      return Number(a) - Number(b);
    }

    return a.localeCompare(b);
  });

  const chartDatasets = datasets.map(dataset => {
    const dataMap = new Map();

    dataset.data.forEach(point => {
      const key = period === "daily"
        ? String(point.created_at)
        : point.date;

      dataMap.set(key, Number(point.water_percent));
    });

    return {
      label: dataset.label,

      data: labels.map(label =>
        dataMap.has(label)
          ? dataMap.get(label)
          : null
      ),

      borderColor: dataset.color,
      backgroundColor: dataset.color,

      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,

      fill: false,

      pointRadius: 3,
      pointHoverRadius: 6
    };
  });

  return {
    labels,
    chartDatasets
  };
}


// =============================================
// 17. HISTORY: DISPLAY CHART
// =============================================

function displayHistoryChart(
  labels,
  datasets,
  period
) {
  const canvas = getElement("waterChart");

  if (!canvas || typeof Chart === "undefined") {
    throw new Error("ไม่พบ Chart.js");
  }

  if (waterChart) {
    waterChart.destroy();
    waterChart = null;
  }

  const displayLabels = labels.map(label => {
    if (period === "daily") {
      return new Date(Number(label) * 1000)
        .toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit"
        });
    }

    return new Date(`${label}T00:00:00`)
      .toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short"
      });
  });

  const rawLabels = labels.slice();

  waterChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: displayLabels,
      datasets
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "nearest",
        intersect: false
      },

      plugins: {
        legend: {
          display: true,
          position: "bottom"
        },

        tooltip: {
          enabled: true,

          callbacks: {
            title(items) {
              if (!items.length) return "";

              const index = items[0].dataIndex;
              const rawLabel = rawLabels[index];

              if (period === "daily") {
                return new Date(Number(rawLabel) * 1000)
                  .toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "medium"
                  });
              }

              return new Date(`${rawLabel}T00:00:00`)
                .toLocaleDateString("th-TH", {
                  dateStyle: "full"
                });
            },

            label(context) {
              if (context.parsed.y === null) {
                return "";
              }

              return (
                `${context.dataset.label}: ` +
                `${context.parsed.y.toFixed(1)}%`
              );
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
}


// =============================================
// 18. HISTORY: LOAD DATA
// =============================================

async function loadHistoryData() {
  const deviceFilter = getElement("deviceFilter");
  const periodFilter = getElement("periodFilter");
  const dateFilter = getElement("dateFilter");

  const chartMessage = getElement("chartMessage");
  const chartDeviceName = getElement("chartDeviceName");

  if (
    !deviceFilter ||
    !periodFilter ||
    !dateFilter ||
    !chartMessage
  ) {
    return;
  }

  const deviceId = deviceFilter.value;
  loadBottleChangeSummary();
  const period = periodFilter.value;

  if (period === "daily") {
    dateFilter.style.display = "";
  } else {
    dateFilter.style.display = "none";
  }

  if (!dateFilter.value) {
    dateFilter.value = getTodayDate();
  }

  const selectedDate = dateFilter.value;

  chartMessage.textContent =
    "กำลังโหลดข้อมูลกราฟ...";

  try {
    // เลือกเครื่องที่ต้องการดึงข้อมูล
    const selectedDevices = deviceId === "all"
      ? DEVICES
      : DEVICES.filter(device => device.id === deviceId);

    // ดึงข้อมูลแยกแต่ละเครื่อง
    const deviceHistories = await Promise.all(
      selectedDevices.map(async device => ({
        device,
        history: await fetchDeviceHistory(device.id)
      }))
    );

    if (chartDeviceName) {
      chartDeviceName.textContent =
        deviceId === "all"
          ? "ภาพรวมเครื่องกดน้ำ ชั้น 2 และชั้น 3"
          : getDeviceName(deviceId);
    }

    // สร้างข้อมูลกราฟ
    const chartResult = buildHistoryDatasets(
      deviceHistories,
      selectedDate,
      period
    );

    const hasData = chartResult.chartDatasets.some(dataset =>
      dataset.data.some(value => value !== null)
    );

    if (!hasData) {
      if (waterChart) {
        waterChart.destroy();
        waterChart = null;
      }

      chartMessage.textContent =
        "ไม่มีข้อมูลในช่วงเวลาที่เลือก";

      setText("dailyWater", "-");
      setText("dailyStatus", "ไม่มีข้อมูล");

      return;
    }

    displayHistoryChart(
      chartResult.labels,
      chartResult.chartDatasets,
      period
    );

    updateHistorySummary(
      deviceHistories,
      selectedDate,
      period
    );

    const totalPoints = chartResult.chartDatasets.reduce(
      (sum, dataset) =>
        sum + dataset.data.filter(value => value !== null).length,
      0
    );

    chartMessage.textContent =
      `แสดงข้อมูล ${totalPoints} รายการ`;

  } catch (error) {
    console.error("โหลดกราฟผิดพลาด:", error);

    chartMessage.textContent =
      "ไม่สามารถโหลดข้อมูลกราฟได้: " + error.message;

    if (waterChart) {
      waterChart.destroy();
      waterChart = null;
    }
  }
}


// =============================================
// 19. HISTORY: EVENT LISTENERS
// =============================================

getElement("deviceFilter")
  .addEventListener("change", loadHistoryData);

getElement("periodFilter")
  .addEventListener("change", loadHistoryData);

getElement("dateFilter")
  .addEventListener("change", loadHistoryData);

getElement("bottleMonthFilter")
  .addEventListener("change", loadBottleChangeSummary);

// =============================================
// 20. SETTINGS: SELECT DEVICE
// =============================================

getElement("settingsDeviceFilter")
  .addEventListener("change", async event => {

    selectedSettingsDevice = event.target.value;

    await loadSettings();
  });


// =============================================
// ALERT RULES: LOAD / RENDER / CRUD
// =============================================

let alertRulesData = [];

async function loadAlertRules(deviceId) {
  const container = getElement("alertRulesList");
  if (!container) return;

  container.textContent = "กำลังโหลดเกณฑ์แจ้งเตือน...";

  try {
    const result = await getAPI("alert_rules", deviceId);

    if (!result.success) {
      throw new Error(result.message || "โหลดเกณฑ์ไม่สำเร็จ");
    }

    alertRulesData = result.data || [];
    renderAlertRules();

  } catch (error) {
    console.error("โหลดเกณฑ์แจ้งเตือนผิดพลาด:", error);
    container.textContent = "โหลดเกณฑ์แจ้งเตือนไม่สำเร็จ: " + error.message;
  }
}


function renderAlertRules() {
  const container = getElement("alertRulesList");
  if (!container) return;

  container.innerHTML = "";

  const rules = [...alertRulesData].sort(
    (a, b) => b.threshold_percent - a.threshold_percent
  );

  if (rules.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "ยังไม่มีเกณฑ์แจ้งเตือน กรุณาเพิ่มเกณฑ์";
    container.appendChild(empty);
    return;
  }

  rules.forEach(rule => {
    const card = document.createElement("div");
    card.className = "alert-rule-item";

    const info = document.createElement("div");
    info.className = "alert-rule-info";

    const title = document.createElement("strong");
    title.textContent = `ระดับน้ำ ${rule.threshold_percent}%`;

    const detail = document.createElement("small");
    detail.textContent =
      `แจ้งเตือนเมื่อระดับน้ำ ≤ ${rule.threshold_percent}%`;

    const status = document.createElement("small");
    status.textContent = rule.is_enabled ? "เปิดใช้งาน" : "ปิดใช้งาน";
    status.className = rule.is_enabled
      ? "alert-rule-enabled"
      : "alert-rule-disabled";

    info.append(title, detail, status);

    const actions = document.createElement("div");
    actions.className = "alert-rule-actions";



    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = rule.is_enabled ? "ปิด" : "เปิด";
    toggleButton.addEventListener("click", () => toggleAlertRule(rule));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "ลบ";
    deleteButton.addEventListener("click", () => deleteAlertRule(rule));

    actions.append(toggleButton, deleteButton);
    card.append(info, actions);
    container.appendChild(card);
  });
}


async function postAlertRule(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("เชื่อมต่อ API ไม่สำเร็จ");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "บันทึกเกณฑ์ไม่สำเร็จ");
  }

  return result;
}


async function addAlertRule() {
  const input = prompt("ระบุระดับน้ำที่ต้องการแจ้งเตือน (0–100%)");

  if (input === null) return;

  const threshold = Number(input.trim());

  if (
    input.trim() === "" ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100
  ) {
    alert("กรุณาระบุเปอร์เซ็นต์ระหว่าง 0–100");
    return;
  }

  try {
    await postAlertRule({
      action: "add_alert_rule",
      device_id: selectedSettingsDevice,
      threshold_percent: threshold,
      alert_type: "water_level",
      is_enabled: true
    });

    await loadAlertRules(selectedSettingsDevice);
    alert("เพิ่มเกณฑ์แจ้งเตือนเรียบร้อย");

  } catch (error) {
    alert(error.message);
  }
}


async function editAlertRule(rule) {
  const input = prompt(
    "แก้ไขระดับน้ำที่ต้องการแจ้งเตือน (0–100%)",
    rule.threshold_percent
  );

  if (input === null) return;

  const threshold = Number(input.trim());

  if (
    input.trim() === "" ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100
  ) {
    alert("กรุณาระบุเปอร์เซ็นต์ระหว่าง 0–100");
    return;
  }

  try {
    await postAlertRule({
      action: "update_alert_rule",
      rule_id: rule.rule_id,
      threshold_percent: threshold
    });

    await loadAlertRules(selectedSettingsDevice);
    alert("แก้ไขเกณฑ์เรียบร้อย");

  } catch (error) {
    alert(error.message);
  }
}


async function toggleAlertRule(rule) {
  try {
    await postAlertRule({
      action: "update_alert_rule",
      rule_id: rule.rule_id,
      is_enabled: !rule.is_enabled
    });

    await loadAlertRules(selectedSettingsDevice);

  } catch (error) {
    alert(error.message);
  }
}


async function deleteAlertRule(rule) {
  const confirmed = confirm(
    `ต้องการลบเกณฑ์แจ้งเตือน ${rule.threshold_percent}% ใช่หรือไม่?`
  );

  if (!confirmed) return;

  try {
    await postAlertRule({
      action: "delete_alert_rule",
      rule_id: rule.rule_id
    });

    await loadAlertRules(selectedSettingsDevice);
    alert("ลบเกณฑ์เรียบร้อย");

  } catch (error) {
    alert(error.message);
  }
}


// ปุ่มเพิ่มเกณฑ์
getElement("addAlertRuleBtn")
  .addEventListener("click", addAlertRule);


// =============================================
// 21. SETTINGS: LOAD SETTINGS
// =============================================

async function loadSettings() {
  const deviceId = selectedSettingsDevice;

  const device = getDevice(deviceId);

  if (!device) return;

  setText("currentStaff", "กำลังโหลด...");

  const message = getElement("settingsMessage");

  if (message) {
    message.textContent = "กำลังโหลดการตั้งค่า...";
    message.style.color = "";
  }

  try {
    const result = await getAPI(
      "settings",
      deviceId
    );

    if (!result.success || !result.data) {
      throw new Error(
        result.message || "ไม่พบการตั้งค่าของเครื่องนี้"
      );
    }

    settingsData[deviceId] = result.data;

    await loadAlertRules(deviceId);

    getElement("lineGroupInput").value =
      result.data.line_group_id || "";

    await loadStaffSchedule(deviceId);

    // แสดงตารางเวร หากเคยเปิดแผงไว้
    if (isScheduleOpen) {
      renderSchedule(deviceId);
    }

    if (message) {
      message.textContent =
        "โหลดการตั้งค่าและตารางเวรสำเร็จ";

      message.style.color = "green";
    }

  } catch (error) {
    console.error("โหลดการตั้งค่าผิดพลาด:", error);

    if (message) {
      message.textContent =
        "โหลดข้อมูลไม่สำเร็จ: " + error.message;

      message.style.color = "red";
    }

    setText("currentStaff", "โหลดข้อมูลไม่สำเร็จ");

    const rows = getElement("scheduleRows");

    if (rows) {
      rows.textContent =
        "ไม่สามารถโหลดตารางเวรได้";
    }
  }
}


// =============================================
// 22. SETTINGS: RENDER WEEKLY SCHEDULE
// =============================================

function renderSchedule(deviceId) {
  const container = getElement("scheduleRows");

  if (!container) return;

  const schedule = scheduleData[deviceId];

  if (!schedule) {
    container.textContent =
      "ยังไม่มีข้อมูลตารางเวร";

    return;
  }

  container.innerHTML = "";

  const staffList = schedule.staffList || [];
  const assignments = schedule.data || [];

  DAY_NAMES.forEach((dayName, index) => {
    const assignment = assignments.find(item =>
      item.day_of_week === dayName
    );

    const selectedStaffId =
      assignment?.staff_id || "";

    const row = document.createElement("div");

    row.className = "schedule-row";

    const label = document.createElement("label");

    label.textContent = DAY_LABELS[index];

    label.htmlFor = `schedule_${deviceId}_${dayName}`;

    const select = document.createElement("select");

    select.id = `schedule_${deviceId}_${dayName}`;
    select.dataset.day = dayName;

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "เลือกเจ้าหน้าที่";

    select.appendChild(placeholder);

    staffList.forEach(staff => {
      const option = document.createElement("option");

      option.value = staff.staff_id;
      option.textContent = staff.staff_name;

      if (staff.staff_id === selectedStaffId) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    row.appendChild(label);
    row.appendChild(select);

    container.appendChild(row);
  });
}


// =============================================
// 23. SETTINGS: COLLAPSE SCHEDULE
// =============================================

function toggleSchedule() {
  isScheduleOpen = !isScheduleOpen;

  const panel = getElement("schedulePanel");
  const toggle = getElement("scheduleToggle");
  const arrow = getElement("scheduleArrow");

  if (!panel || !toggle) return;

  panel.hidden = !isScheduleOpen;

  toggle.setAttribute(
    "aria-expanded",
    String(isScheduleOpen)
  );

  if (arrow) {
    arrow.textContent = isScheduleOpen ? "⌃" : "⌄";
  }

  if (isScheduleOpen) {
    renderSchedule(selectedSettingsDevice);
  }
}


getElement("scheduleToggle")
  .addEventListener("click", toggleSchedule);


// =============================================
// 24. SETTINGS: SAVE SETTINGS
// =============================================


async function saveSettings() {
  const deviceId = selectedSettingsDevice;

  const lineGroupInput = getElement("lineGroupInput");
  const message = getElement("settingsMessage");
  const saveButton = getElement("saveSettingsBtn");

  const lineGroupId = lineGroupInput.value.trim();

  // ค่าเกณฑ์เดิมเก็บไว้เพื่อให้ API ตั้งค่าเดิมทำงานต่อได้
  const legacyThreshold = Number(
    settingsData[deviceId]?.threshold_percent
  );

  if (
    !Number.isFinite(legacyThreshold) ||
    legacyThreshold < 0 ||
    legacyThreshold > 100
  ) {
    message.textContent =
      "ไม่พบค่าเกณฑ์ตั้งค่าเดิม กรุณาโหลดการตั้งค่าใหม่";

    message.style.color = "red";
    return;
  }

  // ตรวจสอบตารางเวร
  const schedule = [];

  for (const dayName of DAY_NAMES) {
    const select = getElement(
      `schedule_${deviceId}_${dayName}`
    );

    if (!select) continue;

    if (!select.value) {
      message.textContent =
        `กรุณาเลือกเจ้าหน้าที่สำหรับ${DAY_LABELS[DAY_NAMES.indexOf(dayName)]}`;

      message.style.color = "red";

      if (isScheduleOpen) {
        select.focus();
      }

      return;
    }

    schedule.push({
      day_of_week: dayName,
      staff_id: select.value
    });
  }

  try {
    saveButton.disabled = true;

    message.textContent = "กำลังบันทึกการตั้งค่า...";
    message.style.color = "";

    // บันทึก LINE Group ID
    const settingsResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "save_settings",
        device_id: deviceId,
        threshold_percent: legacyThreshold,
        line_group_id: lineGroupId
      })
    });

    if (!settingsResponse.ok) {
      throw new Error("เชื่อมต่อ API เพื่อบันทึกการตั้งค่าไม่สำเร็จ");
    }

    const settingsResult = await settingsResponse.json();

    if (!settingsResult.success) {
      throw new Error(
        settingsResult.message || "บันทึก LINE Group ID ไม่สำเร็จ"
      );
    }

    // บันทึกตารางเวรทั้ง 7 วัน
    for (const item of schedule) {
      const scheduleResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "save_staff_assignment",
          device_id: deviceId,
          day_of_week: item.day_of_week,
          staff_id: item.staff_id
        })
      });

      if (!scheduleResponse.ok) {
        throw new Error(
          `เชื่อมต่อ API เพื่อบันทึกเวร${item.day_of_week}ไม่สำเร็จ`
        );
      }

      const scheduleResult = await scheduleResponse.json();

      if (!scheduleResult.success) {
        throw new Error(
          scheduleResult.message ||
          `บันทึกเวร${item.day_of_week}ไม่สำเร็จ`
        );
      }
    }

    // โหลดข้อมูลใหม่หลังบันทึก
    await loadSettings();

    message.textContent =
      "บันทึกการตั้งค่าและตารางเวรสำเร็จ";

    message.style.color = "green";

  } catch (error) {
    console.error("บันทึกการตั้งค่าผิดพลาด:", error);

    message.textContent =
      "บันทึกไม่สำเร็จ: " + error.message;

    message.style.color = "red";

  } finally {
    saveButton.disabled = false;
  }
}



getElement("saveSettingsBtn")
  .addEventListener("click", saveSettings);


const LIFF_ID = "2012846813-iQcPzZ7C";

// อ่านหน้าที่ต้องการเปิดจาก URL หรือ LIFF state
function getInitialPage() {
  const pageMap = {
    home: "homePage",
    history: "historyPage",
    settings: "settingsPage"
  };

  const params = new URLSearchParams(window.location.search);

  // กรณีเปิดผ่าน GitHub Pages โดยตรง
  let requestedPage = params.get("page");

  // กรณีเปิดผ่าน LINE MINI App
  if (!requestedPage) {
    const liffState = params.get("liff.state");

    if (liffState) {
      const stateParams = new URLSearchParams(
        liffState.startsWith("?")
          ? liffState.substring(1)
          : liffState
      );

      requestedPage = stateParams.get("page");
    }
  }

  return pageMap[requestedPage] || "homePage";
}

  
// =============================================
// 25. INITIALIZE APPLICATION
// =============================================


async function initializeApp() {
  try {
    // ตั้งค่าเครื่องเริ่มต้น
    selectHomeDevice("device_02");

    getElement("settingsDeviceFilter").value = "device_02";
    selectedSettingsDevice = "device_02";

    // กำหนดวันที่เริ่มต้นของกราฟ
    getElement("dateFilter").value = getTodayDate();

    // เริ่มต้น LIFF ก่อนอ่านหน้าที่ต้องการเปิด
    await liff.init({
      liffId: LIFF_ID
    });

    // เลือกหน้าเริ่มต้น
    const initialPage = getInitialPage();
    showPage(initialPage);

    // โหลดข้อมูลทั้งสองเครื่อง
    await Promise.all([
      loadAllLatestData(),
      loadAllStaff()
    ]);

    console.log("Water Dispenser Dashboard พร้อมทำงาน");

  } catch (error) {
    console.error("เริ่มต้นระบบ LIFF ไม่สำเร็จ:", error);

    // หาก LIFF เริ่มต้นไม่สำเร็จ ให้ยังเปิด Dashboard ได้
    showPage(getInitialPage());

    await Promise.all([
      loadAllLatestData(),
      loadAllStaff()
    ]);
  }
}

// เริ่มต้นระบบ
initializeApp();



// =============================================
// 26. AUTO REFRESH
// =============================================

// อัปเดตระดับน้ำทุก 10 วินาที
setInterval(() => {
  loadAllLatestData();
}, REFRESH_INTERVAL);


// อัปเดตผู้รับผิดชอบทุก 60 วินาที
setInterval(() => {
  loadAllStaff();
}, 60000);
