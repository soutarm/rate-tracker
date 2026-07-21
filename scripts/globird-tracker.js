"use strict";

const formatRate = (rate) => {
  const formattedAmount = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false
  }).format(rate * 100);

  return `<strong>${formattedAmount}¢</strong><span class="unit">/kWh</span>`;
};

// Data structure driving both the dashboard and the table
const periods = [
  {
    start: 23,
    end: 10,
    timeLabel: "11:00 PM to 10:00 AM",
    name: "Overnight Off-Peak",
    usage: 0.22,
    fit: 0.041,
    type: "standard",
    note: "Overnight Off-Peak window. Regular baseline household operations."
  },
  {
    start: 10,
    end: 11,
    timeLabel: "10:00 AM to 11:00 AM",
    name: "Morning Off-Peak",
    usage: 0.22,
    fit: 0.021,
    type: "standard",
    note: "Morning Off-Peak window. Wait until 11 AM for heavy loads to capitalize on free power."
  },
  {
    start: 11,
    end: 14,
    timeLabel: "11:00 AM to 2:00 PM",
    name: "FREE Window",
    usage: 0,
    fit: 0.021,
    type: "free",
    note: "FREE usage window. Turn on heavy appliances and maximize grid consumption."
  },
  {
    start: 14,
    end: 16,
    timeLabel: "2:00 PM to 4:00 PM",
    name: "Afternoon Off-Peak",
    usage: 0.22,
    fit: 0.041,
    type: "standard",
    note: "Standard Off-Peak window. Pre-cool or pre-heat the house before peak starts."
  },
  {
    start: 16,
    end: 18,
    timeLabel: "4:00 PM to 6:00 PM",
    name: "Early Peak",
    usage: 0.35,
    fit: 0.084,
    type: "peak",
    note: "Peak window. Reduce heavy loads to protect against higher pricing."
  },
  {
    start: 18,
    end: 21,
    timeLabel: "6:00 PM to 9:00 PM",
    name: "Super Export Peak",
    usage: 0.35,
    fit: 0.1,
    type: "peak",
    note: "Super Export window. Keep grid imports strictly under 0.03 kWh per hour to secure your daily A$1.00 credit."
  },
  {
    start: 21,
    end: 23,
    timeLabel: "9:00 PM to 11:00 PM",
    name: "Late Peak",
    usage: 0.35,
    fit: 0.041,
    type: "peak",
    note: "Late Evening Peak. Minimize grid draw where possible until 11:00 PM."
  }
];

// Initialize Table
const initializeTable = () => {
  const tbody = document.getElementById("scheduleBody");

  periods.forEach((period, index) => {
    const row = document.createElement("tr");
    row.id = `row-${index}`;

    let typeBadge = "";
    if (period.type === "free") {
      typeBadge = '<span class="badge badge-free">FREE</span>';
    } else if (period.type === "peak") {
      typeBadge = '<span class="badge badge-peak">PEAK</span>';
    } else {
      typeBadge = '<span class="badge badge-standard">OFF-PEAK</span>';
    }

    row.innerHTML = `
      <td>${period.timeLabel}</td>
      <td><strong>${period.name}</strong> ${typeBadge}</td>
      <td>${formatRate(period.usage)}</td>
      <td>${formatRate(period.fit)}</td>
    `;
    tbody.appendChild(row);
  });
};

// Update Dashboard and highlight active row
const updateDashboard = () => {
  const now = new Date();
  const hourNow = now.getHours();

  const timeOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  };
  const timeString = now.toLocaleTimeString("en-AU", timeOptions);

  let currentPeriod = null;

  // Find current period and update table highlighting
  periods.forEach((period, index) => {
    let isActive = false;
    // Handle overnight crossing midnight
    if (period.start > period.end) {
      isActive = hourNow >= period.start || hourNow < period.end;
    } else {
      isActive = hourNow >= period.start && hourNow < period.end;
    }

    const row = document.getElementById(`row-${index}`);
    if (isActive) {
      row.classList.add("active-row");
      currentPeriod = period;
    } else {
      row.classList.remove("active-row");
    }
  });

  // Update top dashboard elements
  if (currentPeriod) {
    const timeElement = document.getElementById("currentTime");
    const usageRateElement = document.getElementById("usageRate");
    const exportRateElement = document.getElementById("exportRate");
    const noteBoxElement = document.getElementById("noteBox");
    const usageBox = document.getElementById("usageBox");
    const exportBox = document.getElementById("exportBox");

    if (timeElement) {
      timeElement.textContent = `Current Time: ${timeString} (${currentPeriod.name})`;
    }
    if (usageRateElement) {
      usageRateElement.innerHTML = formatRate(currentPeriod.usage);
    }
    if (exportRateElement) {
      exportRateElement.innerHTML = formatRate(currentPeriod.fit);
    }
    if (noteBoxElement) {
      noteBoxElement.textContent = `${currentPeriod.note} Daily supply charge is A$1.39. During ZeroHero time (6-9pm), you can receive a A$1 credit for avoiding grid power.`;
    }

    if (usageBox && exportBox) {
      usageBox.className = "rate-box";
      exportBox.className = "rate-box";
      if (currentPeriod.type === "free") {
        usageBox.classList.add("free");
      } else if (currentPeriod.type === "peak") {
        usageBox.classList.add("peak");
      }
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initializeTable();
  updateDashboard();
  setInterval(updateDashboard, 1000);
});
