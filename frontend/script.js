
const API = "http://localhost:8080";

let chart;
let latestData = null;
let occupied = true;

const $ = (id) => document.getElementById(id);

async function loadDashboard() {
  try {
    const response = await fetch(`${API}/api/dashboard`);

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    const data = await response.json();
    latestData = data;

    $("totalPower").textContent = data.total_power;
    $("totalEnergy").textContent = Number(data.total_energy).toFixed(2);
    $("totalCost").textContent = Number(data.estimated_cost).toFixed(2);
    $("voltage").textContent = data.voltage;

    renderAppliances(data.appliances);
    renderRecommendations(data);
    renderAlerts();

    $("lastUpdated").textContent =
      "Last updated: " + new Date().toLocaleTimeString();

    $("lastUpdated").style.color = "#16a579";

    updateForecast(data);
  } catch (error) {
    $("lastUpdated").textContent =
      "Cannot connect. Check that Spring Boot is running on port 8080.";

    $("lastUpdated").style.color = "#b94c24";
    $("applianceList").textContent =
      "Backend unavailable. Start Spring Boot and refresh.";
  }
}

function renderAppliances(appliances) {
  const icons = {
    "Ceiling Fan": "🌀",
    "LED Light": "💡",
    "Air Conditioner": "❄️"
  };

  $("applianceList").innerHTML = appliances.map((item) => `
    <div class="appliance">
      <div class="appliance-icon">
        ${icons[item.name] || "⚡"}
      </div>

      <div class="appliance-info">
        <strong>${item.name}</strong>
        <p>${item.current} A · ${item.energy} kWh</p>
        <span class="status">${item.status}</span>
      </div>

      <div class="appliance-controls">
        <div class="power-value">
          ${item.status === "ON" ? item.power : 0} W
        </div>

        <button
          class="appliance-btn"
          onclick="setAppliance(${item.id}, '${item.status === "ON" ? "off" : "on"}')"
        >
          Turn ${item.status === "ON" ? "OFF" : "ON"}
        </button>
      </div>
    </div>
  `).join("");
}

function renderAlerts() {
  const alerts = occupied
    ? []
    : (latestData?.appliances || [])
        .filter((item) => item.status === "ON")
        .map((item) => item.name);

  if (alerts.length === 0) {
    $("alertList").innerHTML =
      '<div class="safe-item">✓ No simulated wastage alerts.</div>';
    return;
  }

  $("alertList").innerHTML = alerts.map((name) => `
    <div class="alert-item">
      ⚠ ${name} is ON while the room is empty.
    </div>
  `).join("");
}


async function setOccupancy(isOccupied) {
  const state = isOccupied ? "occupied" : "empty";

  try {
    const response = await fetch(
      `${API}/api/occupancy/${state}`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error("Occupancy request failed");
    }

    const data = await response.json();

    occupied = data.occupied;

    const badge = $("occupancyBadge");
    badge.textContent = occupied
      ? "● OCCUPIED"
      : "● ROOM EMPTY";

    badge.classList.toggle("empty", !occupied);

    renderAlerts();
  } catch (error) {
    alert("Could not connect to Spring Boot. Check the backend.");
  }
}


function updateForecast(data) {
  // Read the power of appliances currently switched ON.
  const totalPower = Math.max(
    0,
    Number(data.total_power) || 0
  );

  // Assumption: appliances run for 8 hours per day.
  const operatingHours = 8;

  // Estimated daily energy in kWh.
  const dailyEnergy =
    (totalPower * operatingHours) / 1000;

  // Estimate monthly energy and electricity cost.
  const monthlyEnergy = dailyEnergy * 30;
  const tariff = Number(data.tariff ?? 8);
  const monthlyCost = monthlyEnergy * tariff;

  $("monthlyCost").textContent =
    "₹" + monthlyCost.toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });

  // Stop if the Chart.js library is unavailable.
  if (typeof Chart === "undefined") return;

  // Illustrative variation, not output from a trained AI model.
  const factors = [
    1.00, 1.04, 0.96, 1.08, 1.02, 0.94, 1.05
  ];

  const values = factors.map((factor) =>
    Number((dailyEnergy * factor).toFixed(2))
  );

  if (chart) {
    chart.destroy();
  }

  chart = new Chart($("energyChart"), {
    type: "line",

    data: {
      labels: [
        "Today", "Day 2", "Day 3", "Day 4",
        "Day 5", "Day 6", "Day 7"
      ],

      datasets: [{
        label: "Estimated energy (kWh/day)",
        data: values,
        borderColor: "#4361ee",
        backgroundColor: "rgba(67, 97, 238, 0.12)",
        fill: true,
        tension: 0.35
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.parsed.y.toFixed(2)} kWh/day`
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Energy (kWh/day)"
          }
        }
      }
    }
  });
}

function renderRecommendations(data) {
  const container = $("recommendationList");
  const appliances = data.appliances || [];

  const activeAppliances = appliances.filter(
    (item) => item.status === "ON"
  );

  const recommendations = [];

  // Rule 1: Room empty, but appliances are running.
  if (data.occupied === false) {
    activeAppliances.forEach((item) => {
      const savedEnergy = Number(item.power) * 2 / 1000;
      const savedCost = savedEnergy * Number(data.tariff || 8);

      recommendations.push({
        title: `Turn off ${item.name}`,
        description:
          `If switched off for 2 unused hours, it could save ` +
          `${savedEnergy.toFixed(2)} kWh and approximately ₹` +
          `${savedCost.toFixed(2)}.`,
        priority: "High"
      });
    });
  }

  // Rule 2: Suggest reducing unnecessary operating time.
  if (activeAppliances.length > 0) {
    const highestPower = activeAppliances.reduce(
      (highest, item) =>
        Number(item.power) > Number(highest.power)
          ? item
          : highest
    );

    recommendations.push({
      title: `Review ${highestPower.name} usage`,
      description:
        `It currently contributes ${highestPower.power} W ` +
        `of rated power. Reducing unnecessary operating time ` +
        `can help lower energy consumption.`,
      priority: "Suggestion"
    });
  }

  // Rule 3: All appliances are off.
  if (activeAppliances.length === 0) {
    recommendations.push({
      title: "Excellent energy-saving behavior!",
      description:
        "All monitored appliances are switched off. " +
        "Keep checking that appliances are not left running unnecessarily.",
      priority: "Good"
    });
  }

  container.innerHTML = recommendations.map((item) => `
    <div class="recommendation-item">
      <div>
        <strong>${item.title}</strong>
        <p>${item.description}</p>
      </div>
      <span class="recommendation-priority">
        ${item.priority}
      </span>
    </div>
  `).join("");
}

$("refreshBtn").addEventListener("click", loadDashboard);

$("occupiedBtn").addEventListener("click", () => {
  setOccupancy(true);
});

$("emptyBtn").addEventListener("click", () => {
  setOccupancy(false);
});

loadDashboard();
setInterval(loadDashboard, 5000);

async function setAppliance(id, state) {
  try {
    const response = await fetch(
      `${API}/api/appliances/${id}/${state}`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error("Could not update appliance");
    }

    await loadDashboard();
  } catch (error) {
    alert("Could not update appliance. Check that Spring Boot is running.");
  }
}
