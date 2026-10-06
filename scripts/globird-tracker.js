"use strict";

const formatCentsValue = (rate) =>
  new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false
  }).format(rate * 100);

const formatRate = (rate) => `<strong>${formatCentsValue(rate)}¢</strong><span class="unit">/kWh</span>`;

// GloBird ZeroHero periods
const globirdPeriods = [
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

// Powershop EV Day periods (Mon to Sun, inc. GST). Source: Pricing Statement, 1 October 2026, AusNet distributor.
const powershopPeriods = [
  {
    start: 21,
    end: 11,
    timeLabel: "9:00 PM to 11:00 AM",
    name: "Off Peak",
    usage: 0.2068,
    fit: 0.01,
    type: "standard",
    note: "Off Peak window. Good time for EV charging and general household use outside the free window."
  },
  {
    start: 11,
    end: 15,
    timeLabel: "11:00 AM to 3:00 PM",
    name: "Super Off Peak",
    usage: 0,
    fit: 0.01,
    type: "free",
    note: "Super Off Peak: usage is free. Charge the EV and run heavy appliances now (subject to the Fair Use Policy)."
  },
  {
    start: 15,
    end: 16,
    timeLabel: "3:00 PM to 4:00 PM",
    name: "Shoulder",
    usage: 0.1921,
    fit: 0.01,
    type: "shoulder",
    note: "Shoulder window. Finish up heavy loads before peak pricing begins at 4:00 PM."
  },
  {
    start: 16,
    end: 21,
    timeLabel: "4:00 PM to 9:00 PM",
    name: "Peak",
    usage: 0.495,
    fit: 0.01,
    type: "peak",
    note: "Peak window at the highest rate of the day. Shift discretionary loads out of 4:00 PM to 9:00 PM."
  }
];

const DEFAULT_PLAN_ID = "globird";
const PLAN_STORAGE_KEY = "rateTracker.plan";

const PLANS = {
  globird: {
    id: "globird",
    brand: "GloBird ZeroHero",
    pageTitle: "GloBird ZeroHero Live Tracker",
    periods: globirdPeriods,
    footnote:
      "Daily supply charge is A$1.39. During ZeroHero time (6-9pm), you can receive a A$1 credit for avoiding grid power."
  },
  powershop: {
    id: "powershop",
    brand: "Powershop EV Day",
    pageTitle: "Powershop EV Day Live Tracker",
    periods: powershopPeriods,
    footnote:
      "Daily supply charge is A$1.21. Controlled load usage is 22.11\u00a2/kWh and is excluded from the $0 Super Off Peak rate. Rates include GST."
  }
};

// ---- 24-Hour Rate Chart (time on the Y axis, midnight to midnight) ----

const CHART_CONFIG = {
  width: 640,
  height: 340,
  margin: { top: 28, right: 20, bottom: 36, left: 54 }
};

// Splits any period crossing midnight into two segments so the chart can be
// drawn as a single continuous 0-24 hour timeline.
const buildDaySegments = (allPeriods) => {
  const segments = [];
  allPeriods.forEach((period) => {
    if (period.start > period.end) {
      segments.push({ ...period, start: period.start, end: 24 });
      segments.push({ ...period, start: 0, end: period.end });
    } else {
      segments.push({ ...period });
    }
  });
  return segments.sort((a, b) => a.start - b.start);
};

const computeAxisMax = (planPeriods) => {
  const maxRateCents = Math.max(...planPeriods.flatMap((period) => [period.usage, period.fit])) * 100;
  return Math.max(40, Math.ceil(maxRateCents / 10) * 10);
};

const readSavedPlanId = () => {
  try {
    const saved = window.localStorage.getItem(PLAN_STORAGE_KEY);
    return PLANS[saved] ? saved : DEFAULT_PLAN_ID;
  } catch {
    // Storage unavailable (private mode, blocked); fall back to the default plan.
    return DEFAULT_PLAN_ID;
  }
};

let activePlan = PLANS[readSavedPlanId()];
let periods = activePlan.periods;
let daySegments = buildDaySegments(periods);
let rateAxisMaxCents = computeAxisMax(periods);

const plotLeft = CHART_CONFIG.margin.left;
const plotRight = CHART_CONFIG.width - CHART_CONFIG.margin.right;
const plotTop = CHART_CONFIG.margin.top;
const plotBottom = CHART_CONFIG.height - CHART_CONFIG.margin.bottom;
const plotWidth = plotRight - plotLeft;
const plotHeight = plotBottom - plotTop;

const xForHour = (hour) => plotLeft + (hour / 24) * plotWidth;
const yForCents = (cents) => plotBottom - (cents / rateAxisMaxCents) * plotHeight;

const getFractionalHour = (date) => date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

const formatHourTick = (hour) => {
  const tickDate = new Date();
  tickDate.setHours(hour, 0, 0, 0);
  return tickDate.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true });
};

const formatTimeOfDay = (hourDecimal) => {
  const tickDate = new Date();
  const hours = Math.floor(hourDecimal) % 24;
  const minutes = Math.round((hourDecimal - Math.floor(hourDecimal)) * 60);
  tickDate.setHours(hours, minutes, 0, 0);
  return tickDate.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
};

const findSegmentForHour = (hourDecimal) =>
  daySegments.find((segment) => hourDecimal >= segment.start && hourDecimal < segment.end) ||
  daySegments[daySegments.length - 1];

// Consecutive points at a shared boundary hour naturally form the step's
// vertical "jump" between one rate and the next.
const buildStepPoints = (key) => {
  const points = [];
  daySegments.forEach((segment) => {
    const y = yForCents(segment[key] * 100);
    points.push([xForHour(segment.start), y]);
    points.push([xForHour(segment.end), y]);
  });
  return points;
};

const pointsToPath = (points) => `M ${points.map(([x, y]) => `${x},${y}`).join(" L ")}`;

const BAND_FILL = {
  free: "var(--band-free)",
  peak: "var(--band-peak)"
};

const renderChart = () => {
  const svg = document.getElementById("rateChart");
  if (!svg) return;

  const bands = daySegments
    .filter((segment) => BAND_FILL[segment.type])
    .map((segment) => {
      const x = xForHour(segment.start);
      const width = xForHour(segment.end) - x;
      return `<rect class="chart-band" x="${x}" y="${plotTop}" width="${width}" height="${plotHeight}" fill="${BAND_FILL[segment.type]}"></rect>`;
    })
    .join("");

  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const hourGridlines = hourTicks
    .map((hour) => {
      const x = xForHour(hour);
      return `<line class="chart-gridline" x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}"></line>`;
    })
    .join("");
  const hourLabels = hourTicks
    .map((hour) => {
      const x = xForHour(hour);
      return `<text class="chart-axis-label chart-axis-label--time" x="${x}" y="${plotBottom + 18}" text-anchor="middle">${formatHourTick(hour % 24)}</text>`;
    })
    .join("");

  const rateTicks = Array.from({ length: rateAxisMaxCents / 10 + 1 }, (_, i) => i * 10);
  const rateGridlines = rateTicks
    .map((cents) => {
      const y = yForCents(cents);
      return `<line class="chart-gridline" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}"></line>`;
    })
    .join("");
  const rateLabels = rateTicks
    .map((cents) => {
      const y = yForCents(cents);
      return `<text class="chart-axis-label" x="${plotLeft - 8}" y="${y}" dominant-baseline="middle" text-anchor="end">${cents}&#162;</text>`;
    })
    .join("");

  const usagePath = pointsToPath(buildStepPoints("usage"));
  const fitPath = pointsToPath(buildStepPoints("fit"));

  svg.innerHTML = `
    ${bands}
    ${hourGridlines}
    ${rateGridlines}
    <line class="chart-axis" x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}"></line>
    <line class="chart-axis" x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}"></line>
    ${hourLabels}
    ${rateLabels}
    <path id="usageLine" class="chart-line chart-line--usage" d="${usagePath}"></path>
    <path id="fitLine" class="chart-line chart-line--fit" d="${fitPath}"></path>
    <line id="crosshairLine" class="chart-crosshair" x1="0" y1="${plotTop}" x2="0" y2="${plotBottom}"></line>
    <line id="nowLine" class="chart-now-line" x1="0" y1="${plotTop}" x2="0" y2="${plotBottom}"></line>
    <circle id="nowMarkerUsage" class="chart-now-marker chart-now-marker--usage" r="5" cx="0" cy="0"></circle>
    <circle id="nowMarkerFit" class="chart-now-marker chart-now-marker--fit" r="5" cx="0" cy="0"></circle>
    <text id="nowLabel" class="chart-now-label" x="0" y="${plotTop - 10}" text-anchor="middle"></text>
    <g id="chartTooltip" class="chart-tooltip" visibility="hidden">
      <rect class="chart-tooltip-bg" x="0" y="0" width="140" height="56" rx="6"></rect>
      <text class="chart-tooltip-time" x="10" y="18"></text>
      <text class="chart-tooltip-usage" x="10" y="34"></text>
      <text class="chart-tooltip-fit" x="10" y="50"></text>
    </g>
    <rect id="chartOverlay" class="chart-overlay" x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" fill="transparent"></rect>
  `;

  const overlay = document.getElementById("chartOverlay");
  overlay.addEventListener("pointermove", handleChartHover);
  overlay.addEventListener("pointerleave", hideChartHover);
};

const handleChartHover = (event) => {
  const svg = document.getElementById("rateChart");
  const crosshairLine = document.getElementById("crosshairLine");
  const tooltip = document.getElementById("chartTooltip");
  if (!svg || !crosshairLine || !tooltip) return;

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

  const hourDecimal = Math.min(24, Math.max(0, ((svgPoint.x - plotLeft) / plotWidth) * 24));
  const x = xForHour(hourDecimal);
  const segment = findSegmentForHour(hourDecimal);

  crosshairLine.setAttribute("x1", x);
  crosshairLine.setAttribute("x2", x);
  crosshairLine.setAttribute("visibility", "visible");

  const tooltipX = Math.min(Math.max(x - 70, plotLeft), plotRight - 140);
  const tooltipY = plotTop + 8;

  tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
  tooltip.setAttribute("visibility", "visible");
  tooltip.querySelector(".chart-tooltip-time").textContent = formatTimeOfDay(hourDecimal);
  tooltip.querySelector(".chart-tooltip-usage").textContent = `Usage: ${formatCentsValue(segment.usage)}¢/kWh`;
  tooltip.querySelector(".chart-tooltip-fit").textContent = `Export: ${formatCentsValue(segment.fit)}¢/kWh`;
};

const hideChartHover = () => {
  const crosshairLine = document.getElementById("crosshairLine");
  const tooltip = document.getElementById("chartTooltip");
  if (crosshairLine) crosshairLine.setAttribute("visibility", "hidden");
  if (tooltip) tooltip.setAttribute("visibility", "hidden");
};

const updateChartNow = (now) => {
  const nowLine = document.getElementById("nowLine");
  const nowLabel = document.getElementById("nowLabel");
  const nowMarkerUsage = document.getElementById("nowMarkerUsage");
  const nowMarkerFit = document.getElementById("nowMarkerFit");
  if (!nowLine || !nowLabel || !nowMarkerUsage || !nowMarkerFit) return;

  const hourDecimal = getFractionalHour(now);
  const x = xForHour(hourDecimal);
  const segment = findSegmentForHour(hourDecimal);

  nowLine.setAttribute("x1", x);
  nowLine.setAttribute("x2", x);

  nowLabel.setAttribute("x", Math.min(Math.max(x, plotLeft + 32), plotRight - 32));
  nowLabel.textContent = formatTimeOfDay(hourDecimal);

  nowMarkerUsage.setAttribute("cx", x);
  nowMarkerUsage.setAttribute("cy", yForCents(segment.usage * 100));
  nowMarkerFit.setAttribute("cx", x);
  nowMarkerFit.setAttribute("cy", yForCents(segment.fit * 100));
};

// Initialize Table
const initializeTable = () => {
  const tbody = document.getElementById("scheduleBody");
  tbody.innerHTML = "";

  periods.forEach((period, index) => {
    const row = document.createElement("tr");
    row.id = `row-${index}`;

    let typeBadge = "";
    if (period.type === "free") {
      typeBadge = '<span class="badge badge-free">FREE</span>';
    } else if (period.type === "peak") {
      typeBadge = '<span class="badge badge-peak">PEAK</span>';
    } else if (period.type === "shoulder") {
      typeBadge = '<span class="badge badge-shoulder">SHOULDER</span>';
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

  updateChartNow(now);

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
    const pageTitleElement = document.getElementById("pageTitle");
    const usageRateElement = document.getElementById("usageRate");
    const exportRateElement = document.getElementById("exportRate");
    const noteBoxElement = document.getElementById("noteBox");
    const usageBox = document.getElementById("usageBox");
    const exportBox = document.getElementById("exportBox");

    if (pageTitleElement) {
      pageTitleElement.textContent = `${activePlan.brand} ${currentPeriod.name}`;
    }
    if (usageRateElement) {
      usageRateElement.innerHTML = formatRate(currentPeriod.usage);
    }
    if (exportRateElement) {
      exportRateElement.innerHTML = formatRate(currentPeriod.fit);
    }
    if (noteBoxElement) {
      noteBoxElement.textContent = `${currentPeriod.note} ${activePlan.footnote}`;
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

const syncToggle = () => {
  document.querySelectorAll(".plan-toggle-btn").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.plan === activePlan.id));
  });
};

const selectPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) return;

  activePlan = plan;
  periods = plan.periods;
  daySegments = buildDaySegments(periods);
  rateAxisMaxCents = computeAxisMax(periods);
  document.title = plan.pageTitle;

  try {
    window.localStorage.setItem(PLAN_STORAGE_KEY, plan.id);
  } catch {
    // Storage unavailable; the selection just will not persist between visits.
  }

  syncToggle();
  initializeTable();
  renderChart();
  updateDashboard();
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".plan-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => selectPlan(button.dataset.plan));
  });
  selectPlan(activePlan.id);
  setInterval(updateDashboard, 1000);
});
