const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.08 });
sections.forEach(s => observer.observe(s));

// ── LIVING FEEDBACK — Chart.js Data Visualization ──
// Columns: root_temp, root_rh, leaf_temp, leaf_rh, hot_temp, hot_rh
// Phases: 0–299 baseline | 300–599 heat stress | 600–end recovery
// Note: leaf burning occurred almost immediately after heater was turned on

fetch('living-feedback.json')
  .then(r => r.json())
  .then(data => {
    initCharts(data);
    updateStats(data);
    updateDataNote(data);
  })
  .catch(() => {
    console.warn('living-feedback.json not found — charts will remain as placeholders');
  });

// ── PHASE BOUNDARIES ──
const PHASE_BASELINE_END  = 300;
const PHASE_STRESS_END    = 600;
const BURN_SAMPLE         = 310; // leaf burn occurred almost immediately after heat on

// ── DESIGN TOKENS (matching style.css) ──
const C = {
  hot:     '#c0392b',
  hotDim:  'rgba(192,57,43,0.15)',
  leaf:    '#6ab187',
  leafDim: 'rgba(106,177,135,0.15)',
  root:    '#e67e22',
  rootDim: 'rgba(230,126,34,0.15)',
  dim:     '#555555',
  border:  '#1e1e1e',
  text:    '#e8e8e8',
  bg3:     '#111111',
  phase1:  'rgba(106,177,135,0.04)',
  phase2:  'rgba(192,57,43,0.06)',
  phase3:  'rgba(230,126,34,0.04)',
};

const FONT = "'IBM Plex Mono', monospace";

// ── SHARED CHART OPTIONS ──
function baseOptions(yLabel, yMin, yMax) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0a0a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        titleColor: '#555555',
        bodyColor: '#e8e8e8',
        titleFont: { family: FONT, size: 9 },
        bodyFont: { family: FONT, size: 11 },
        padding: 12,
        callbacks: {
          title: (items) => `sample ${items[0].dataIndex + 1}`,
          label: (item) => ` ${item.dataset.label}  ${item.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        title: {
          display: true,
          text: 'TIME (seconds)',
          color: '#555555',
          font: { family: FONT, size: 9, letterSpacing: '0.18em' },
          padding: { top: 12 }
        },
        ticks: {
          color: '#555555',
          font: { family: FONT, size: 9 },
          maxTicksLimit: 10,
          callback: v => v
        },
        grid: { color: '#1e1e1e', lineWidth: 0.5 },
        border: { color: '#1e1e1e' }
      },
      y: {
        min: yMin,
        max: yMax,
        title: {
          display: true,
          text: yLabel,
          color: '#555555',
          font: { family: FONT, size: 9 },
          padding: { bottom: 12 }
        },
        ticks: {
          color: '#555555',
          font: { family: FONT, size: 9 },
          maxTicksLimit: 6,
          callback: v => v.toFixed(0)
        },
        grid: { color: '#1e1e1e', lineWidth: 0.5 },
        border: { color: '#1e1e1e' }
      }
    }
  };
}

// ── PHASE ANNOTATION PLUGIN ──
// draws phase bands + burn marker as a custom plugin
const phasePlugin = {
  id: 'phasePlugin',
  beforeDraw(chart) {
    const { ctx, chartArea: { left, right, top, bottom }, scales: { x } } = chart;
    if (!x) return;

    const toX = v => x.getPixelForValue(v);
    const totalSamples = chart.data.labels.length;

    // phase bands
    const phases = [
      { from: 0,                  to: PHASE_BASELINE_END, color: C.phase1 },
      { from: PHASE_BASELINE_END, to: PHASE_STRESS_END,   color: C.phase2 },
      { from: PHASE_STRESS_END,   to: totalSamples,        color: C.phase3 },
    ];

    phases.forEach(({ from, to, color }) => {
      const x1 = Math.max(left,  toX(from));
      const x2 = Math.min(right, toX(to));
      if (x2 <= x1) return;
      ctx.fillStyle = color;
      ctx.fillRect(x1, top, x2 - x1, bottom - top);
    });

    // phase divider lines
    [PHASE_BASELINE_END, PHASE_STRESS_END].forEach(v => {
      const px = toX(v);
      if (px < left || px > right) return;
      ctx.save();
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.stroke();
      ctx.restore();
    });

    // burn marker
    if (BURN_SAMPLE >= 0 && BURN_SAMPLE <= totalSamples) {
      const px = toX(BURN_SAMPLE);
      if (px >= left && px <= right) {
        ctx.save();
        ctx.strokeStyle = C.hot;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
        // burn label
        ctx.fillStyle = C.hot;
        ctx.font = `9px ${FONT}`;
        ctx.letterSpacing = '0.1em';
        ctx.fillText('BURN', px + 5, top + 14);
        ctx.restore();
      }
    }

    // phase labels
    const labels = [
      { x: (0 + PHASE_BASELINE_END) / 2, text: 'BASELINE' },
      { x: (PHASE_BASELINE_END + PHASE_STRESS_END) / 2, text: 'HEAT STRESS' },
      { x: (PHASE_STRESS_END + totalSamples) / 2, text: 'RECOVERY' },
    ];
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = '#3a3a3a';
    labels.forEach(({ x: lx, text }) => {
      const px = toX(lx);
      if (px < left || px > right) return;
      ctx.fillText(text, px - ctx.measureText(text).width / 2, top + 14);
    });
  }
};

Chart.register(phasePlugin);

// ── INIT CHARTS ──
function initCharts(data) {
  const labels = data.map((_, i) => i);

  const rootTemp = data.map(d => d.root_temp);
  const leafTemp = data.map(d => d.leaf_temp);
  const hotTemp  = data.map(d => d.hot_temp);
  const rootRH   = data.map(d => d.root_rh);
  const leafRH   = data.map(d => d.leaf_rh);
  const hotRH    = data.map(d => d.hot_rh);

  // ── TEMPERATURE CHART ──
  const tempWrap = document.getElementById('chart-temp');
  if (tempWrap) {
    tempWrap.innerHTML = '<canvas id="canvas-temp"></canvas>';
    const ctx = document.getElementById('canvas-temp').getContext('2d');
    const allTemps = [...rootTemp, ...leafTemp, ...hotTemp];
    const tMin = Math.floor(Math.min(...allTemps)) - 2;
    const tMax = Math.ceil(Math.max(...allTemps)) + 2;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Hot Zone',
            data: hotTemp,
            borderColor: C.hot,
            backgroundColor: C.hotDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Root Zone',
            data: rootTemp,
            borderColor: C.root,
            backgroundColor: C.rootDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Leaf Surface',
            data: leafTemp,
            borderColor: C.leaf,
            backgroundColor: C.leafDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
        ]
      },
      options: baseOptions('TEMPERATURE (°C)', tMin, tMax)
    });
  }

  // ── HUMIDITY CHART ──
  const rhWrap = document.getElementById('chart-rh');
  if (rhWrap) {
    rhWrap.innerHTML = '<canvas id="canvas-rh"></canvas>';
    const ctx = document.getElementById('canvas-rh').getContext('2d');
    const allRH = [...rootRH, ...leafRH, ...hotRH];
    const rMin = Math.floor(Math.min(...allRH)) - 2;
    const rMax = Math.ceil(Math.max(...allRH)) + 2;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Hot Zone RH',
            data: hotRH,
            borderColor: C.hot,
            backgroundColor: C.hotDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Root Zone RH',
            data: rootRH,
            borderColor: C.root,
            backgroundColor: C.rootDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Leaf Surface RH',
            data: leafRH,
            borderColor: C.leaf,
            backgroundColor: C.leafDim,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
        ]
      },
      options: baseOptions('RELATIVE HUMIDITY (%)', rMin, rMax)
    });
  }
}

// ── UPDATE STATS ──
function updateStats(data) {
  const hotTemps  = data.map(d => d.hot_temp);
  const leafTemps = data.map(d => d.leaf_temp);
  const hotRHs    = data.map(d => d.hot_rh);

  const peakHot  = Math.max(...hotTemps).toFixed(1);
  const peakLeaf = Math.max(...leafTemps).toFixed(1);
  const minRH    = Math.min(...hotRHs).toFixed(1);

  // peak hot temp
  const peakEl = document.getElementById('stat-peak-hot');
  if (peakEl) { peakEl.innerHTML = `${peakHot}<span>°C</span>`; }

  // peak leaf temp
  const leafEl = document.getElementById('stat-peak-leaf');
  if (leafEl) { leafEl.innerHTML = `${peakLeaf}<span>°C</span>`; }

  // min hot RH
  const rhEl = document.getElementById('stat-min-rh');
  if (rhEl) { rhEl.innerHTML = `${minRH}<span>%</span>`; }

  // total samples
  const sampEl = document.getElementById('stat-samples');
  if (sampEl) { sampEl.innerHTML = `${data.length}<span>s</span>`; }
}

// ── UPDATE DATA NOTE ──
function updateDataNote(data) {
  const noteEl = document.querySelector('.data-note');
  if (noteEl) {
    noteEl.textContent = `${data.length} samples · 3 channels · 1 sec interval`;
  }
}

// ── SCROLL REVEAL (supplement to any existing logic) ──
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('section');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  sections.forEach(s => obs.observe(s));
});