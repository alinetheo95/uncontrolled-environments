// ── ARCHITECTURE WITHOUT AN OCCUPANT
// Ganoderma lucidum × Epipremnum aureum
// Data loaded from data/ folder

// ── COLOR PALETTE ──
// Cohabitation: green #88c9a0 (CO2), purple #c39bd3 (humidity), orange #e67e22 (temp), green #6ab187 (light)
// Reishi only:  blue #7eb8d4 (CO2), blue-grey #8fa8b8 (humidity), blue-grey #7a9aaa (temp)

// ── DUAL AXIS CHART BUILDER ──
function buildDualChart(canvasId, datasets, y1Label, y2Label, y1Min, y1Max, y2Min, y2Max) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#555555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            boxWidth: 16,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'line'
          }
        },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#1e1e1e',
          borderWidth: 1,
          titleColor: '#555',
          bodyColor: '#e8e8e8',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 9 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          callbacks: {
            title: items => `hr ${parseFloat(items[0].parsed.x).toFixed(1)}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 68.5,
          grid: { color: '#1e1e1e', lineWidth: 1 },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 10,
            callback: v => `${Math.round(v)}h`
          },
          border: { color: '#1e1e1e' }
        },
        y: {
          min: y1Min, max: y1Max,
          position: 'left',
          grid: { color: '#1e1e1e', lineWidth: 1 },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 6
          },
          title: {
            display: true,
            text: y1Label,
            color: '#3a3a3a',
            font: { family: "'IBM Plex Mono', monospace", size: 9 }
          },
          border: { color: '#1e1e1e' }
        },
        y2: {
          min: y2Min, max: y2Max,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 6
          },
          title: {
            display: true,
            text: y2Label,
            color: '#3a3a3a',
            font: { family: "'IBM Plex Mono', monospace", size: 9 }
          },
          border: { color: '#1e1e1e' }
        }
      }
    }
  });
}

// ── LINE STYLE HELPER ──
function ls(color, width, axisId, dash) {
  return {
    borderColor: color,
    backgroundColor: 'transparent',
    borderWidth: width || 1.5,
    borderDash: dash || [],
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0.2,
    spanGaps: true,
    yAxisID: axisId || 'y'
  };
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {

  Promise.all([
    fetch('../data/architecture_reishi_pothos_data.json').then(r => r.json()),
    fetch('../data/architecture_reishi_data.json').then(r => r.json())
  ]).then(([combined, reishi]) => {

    const c = combined.data;
    const r = reishi.data;

    // ── cohabitation (Reishi + Pothos) ──
    const co2_c   = c.map(d => ({ x: d.hours, y: d.co2_ppm }));
    const hum_c   = c.map(d => ({ x: d.hours, y: d.humidity_pct }));
    const temp_c  = c.map(d => ({ x: d.hours, y: d.temp_c }));
    const light_c = c.map(d => ({ x: d.hours, y: d.light_counts }));

    // ── reishi only control ──
    const co2_r  = r.map(d => ({ x: d.hours, y: d.co2_ppm }));
    const hum_r  = r.map(d => ({ x: d.hours, y: d.humidity_pct }));
    const temp_r = r.map(d => ({ x: d.hours, y: d.temp_c }));

    // ── CHART 1 — CO₂ + Humidity ──
    buildDualChart(
      'chart-co2-hum',
      [
        { label: 'CO₂ — Reishi + Pothos (ppm)', data: co2_c,  ...ls('#88c9a0', 2,   'y') },
        { label: 'CO₂ — Reishi Only (ppm)',      data: co2_r,  ...ls('#7eb8d4', 1.5, 'y',  [4, 3]) },
        { label: 'Humidity — Reishi + Pothos %', data: hum_c,  ...ls('#c39bd3', 1.5, 'y2') },
        { label: 'Humidity — Reishi Only %',     data: hum_r,  ...ls('#8fa8b8', 1,   'y2', [4, 3]) },
      ],
      'CO₂ (ppm)', 'Humidity (%RH)',
      400, 4000, 30, 95
    );

    // ── CHART 2 — Temperature + Light ──
    buildDualChart(
      'chart-temp-soil',
      [
        { label: 'Temp — Reishi + Pothos °C', data: temp_c,  ...ls('#e67e22', 2,   'y') },
        { label: 'Temp — Reishi Only °C',     data: temp_r,  ...ls('#7a9aaa', 1.5, 'y',  [4, 3]) },
        { label: 'Light — Reishi + Pothos',   data: light_c, ...ls('#6ab187', 1.5, 'y2') },
      ],
      'Temp (°C)', 'Light (counts)',
      21, 28, 0, 120
    );

  }).catch(err => console.error('Failed to load chart data:', err));

  // ── SCROLL REVEAL ──
  const sections = document.querySelectorAll('section');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  sections.forEach(s => observer.observe(s));

});