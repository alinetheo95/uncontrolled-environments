// ── DATA & CONFIG ──────────────────────────────────────────────────────────

const CONDITIONS = [
  { key: 'natural_open',   label: 'Natural light — open',   color: '#6ab187' },
  { key: 'darkness',       label: 'Darkness — sealed',      color: '#c0392b' },
  { key: 'natural_closed', label: 'Natural light — closed', color: '#a8d5b5' },
  { key: 'purple',         label: 'Purple grow light',      color: '#c39bd3' },
];

// Shared Chart.js tooltip defaults
const TOOLTIP = {
  backgroundColor: '#0f0f0f',
  borderColor:     '#1e1e1e',
  borderWidth:     1,
  titleColor:      '#444',
  bodyColor:       '#aaa',
  titleFont: { family: 'IBM Plex Mono', size: 10 },
  bodyFont:  { family: 'IBM Plex Mono', size: 11 },
  padding: 10,
};

// ── HELPERS ────────────────────────────────────────────────────────────────

// Moving-average smooth
function smooth(pts, w = 4) {
  return pts.map((p, i) => {
    const slice = pts.slice(Math.max(0, i - w), i + w + 1);
    return { x: p.x, y: Math.round(slice.reduce((s, v) => s + v.y, 0) / slice.length) };
  });
}

// Stitch four condition datasets end-to-end on a shared time axis.
// normalize: if true, subtracts each condition's first reading so all start at 0
function stitchConditions(DATA, normalize = false) {
  let offset = 0;
  const datasets = [];
  const bands = [];

  CONDITIONS.forEach(c => {
    const raw      = DATA[c.key];
    const pts      = smooth(raw);
    const baseline = normalize ? pts[0].y : 0;
    const dur      = pts[pts.length - 1].x;

    const shifted = pts.map(p => ({ x: p.x + offset, y: p.y - baseline }));

    datasets.push({
      label:            c.label,
      data:             shifted,
      borderColor:      c.color,
      backgroundColor:  c.color + '10',
      fill:             false,
      borderWidth:      2,
      pointRadius:      0,
      pointHitRadius:   8,
      tension:          0.3,
    });

    bands.push({
      label:  c.label,
      color:  c.color,
      xStart: offset,
      xEnd:   offset + dur,
    });

    offset += dur;
  });

  return { datasets, bands, totalDuration: offset };
}

// ── COMBINED CHART (stitched sequential, with normalize toggle) ────────────

function buildCombinedChart(DATA) {
  const canvas = document.getElementById('chart_combined');
  if (!canvas) return;

  let normalized = false;

  function getChartData(norm) {
    const { datasets, bands, totalDuration } = stitchConditions(DATA, norm);
    const allY = datasets.flatMap(d => d.data.map(p => p.y));
    const yMin = Math.floor((Math.min(...allY) - 30) / 10) * 10;
    const yMax = Math.ceil( (Math.max(...allY) + 30) / 10) * 10;
    const bandLines = bands.slice(0, -1).map(b => ({
      label:       '__divider__',
      data:        [{ x: b.xEnd, y: yMin }, { x: b.xEnd, y: yMax }],
      borderColor: '#1e1e1e',
      borderWidth: 1,
      borderDash:  [4, 4],
      pointRadius: 0,
      fill:        false,
      tension:     0,
    }));
    return { datasets, bands, totalDuration, yMin, yMax, bandLines };
  }

  const initial = getChartData(false);

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets: [...initial.datasets, ...initial.bandLines] },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          filter: item => item.dataset.label !== '__divider__',
          callbacks: {
            title: items => `t = ${items[0].parsed.x.toFixed(1)} min`,
            label: item => {
              if (item.dataset.label === '__divider__') return null;
              const unit = normalized ? 'ppm change' : 'ppm';
              return ` ${item.dataset.label}: ${item.parsed.y > 0 ? '+' : ''}${item.parsed.y} ${unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: initial.totalDuration,
          title: {
            display: true,
            text: 'elapsed time (min) — conditions run sequentially',
            color: '#333',
            font: { family: 'IBM Plex Mono', size: 10 },
          },
          ticks: { color: '#333', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 16 },
          grid:  { color: '#111' },
          border: { color: '#1e1e1e' },
        },
        y: {
          min: initial.yMin,
          max: initial.yMax,
          title: {
            display: true,
            text: 'CO₂ (ppm)',
            color: '#333',
            font: { family: 'IBM Plex Mono', size: 10 },
          },
          ticks:  { color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
          grid:   { color: '#111' },
          border: { color: '#1e1e1e' },
        },
      },
    },
  });

  // ── Toggle button ──
  const toggleBtn = document.getElementById('chart-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      normalized = !normalized;
      const { datasets, bandLines, yMin, yMax } = getChartData(normalized);
      // update condition datasets (indices 0–3)
      CONDITIONS.forEach((c, i) => {
        chart.data.datasets[i].data = datasets[i].data;
      });
      // update divider lines (indices 4–6)
      bandLines.forEach((bl, i) => {
        if (chart.data.datasets[CONDITIONS.length + i]) {
          chart.data.datasets[CONDITIONS.length + i].data = bl.data;
        }
      });
      chart.options.scales.y.min = yMin;
      chart.options.scales.y.max = yMax;
      chart.options.scales.y.title.text = normalized ? 'CO₂ change from baseline (ppm)' : 'CO₂ (ppm)';
      chart.update();
      toggleBtn.textContent = normalized ? 'view: absolute' : 'view: normalized';
      toggleBtn.classList.toggle('active', normalized);
    });
  }

  // ── Clickable legend ──
  const legendEl = document.getElementById('combined-legend');
  if (!legendEl) return;
  const hiddenSet = new Set();

  CONDITIONS.forEach((c, i) => {
    const raw = DATA[c.key];
    const minVal = Math.min(...raw.map(p => p.y));
    const maxVal = Math.max(...raw.map(p => p.y));

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-line" style="background:${c.color}"></div>
      <span class="legend-text">${c.label}</span>
      <span class="legend-range">${minVal}–${maxVal} ppm</span>
    `;
    item.addEventListener('click', () => {
      const meta = chart.getDatasetMeta(i);
      if (hiddenSet.has(i)) {
        hiddenSet.delete(i);
        meta.hidden = false;
        item.classList.remove('hidden');
      } else {
        hiddenSet.add(i);
        meta.hidden = true;
        item.classList.add('hidden');
      }
      chart.update();
    });
    legendEl.appendChild(item);
  });

  // ── Condition band labels below chart ──
  const bandsEl = document.querySelector('.chart-bands');
  if (bandsEl) {
    initial.bands.forEach(b => {
      const cell = document.createElement('div');
      cell.className = 'chart-band';
      cell.innerHTML = `
        <div class="chart-band-label" style="color:${b.color}">${b.label}</div>
        <div class="chart-band-range">${b.xStart.toFixed(0)}–${b.xEnd.toFixed(0)} min</div>
      `;
      bandsEl.appendChild(cell);
    });
  }
}

// ── CIRCADIAN CHART (24-hour wall clock) ───────────────────────────────────

function buildCircadianChart(DATA) {
  const canvas = document.getElementById('chart_circadian');
  if (!canvas) return;

  const pts  = smooth(DATA['circadian'], 6);
  const vals = pts.map(p => p.y);
  const yMin = Math.floor((Math.min(...vals) - 20) / 10) * 10;
  const yMax = Math.ceil( (Math.max(...vals) + 20) / 10) * 10;

  // Start time: 19:06 on Mar 28
  const START_HOUR = 19 + 6 / 60;

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label:           '24hr natural run',
        data:            pts,
        borderColor:     '#88c9a0',
        backgroundColor: '#88c9a008',
        fill:            true,
        borderWidth:     1.5,
        pointRadius:     0,
        pointHitRadius:  8,
        tension:         0.3,
      }],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            title: items => {
              const hr      = items[0].parsed.x;
              const wallHr  = (START_HOUR + hr) % 24;
              const h       = Math.floor(wallHr);
              const m       = Math.floor((wallHr - h) * 60);
              const dayNote = hr >= (24 - START_HOUR) ? ' Mar 29' : ' Mar 28';
              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}${dayNote}  (t+${hr.toFixed(1)}hr)`;
            },
            label: item => ` ${item.parsed.y} ppm`,
          },
        },
      },
      scales: {
        x: {
          type:  'linear',
          title: {
            display: true,
            text:    'wall clock time  (19:06 Mar 28 → 18:59 Mar 29)',
            color:   '#333',
            font:    { family: 'IBM Plex Mono', size: 10 },
          },
          ticks: {
            color: '#333',
            font:  { family: 'IBM Plex Mono', size: 10 },
            maxTicksLimit: 13,
            callback: val => {
              const wallHr = (START_HOUR + val) % 24;
              const h      = Math.floor(wallHr);
              const m      = Math.floor((wallHr - h) * 60);
              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            },
          },
          grid:   { color: '#111' },
          border: { color: '#1e1e1e' },
        },
        y: {
          min: yMin, max: yMax,
          title: {
            display: true,
            text:    'CO₂ (ppm)',
            color:   '#333',
            font:    { family: 'IBM Plex Mono', size: 10 },
          },
          ticks:  { color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
          grid:   { color: '#111' },
          border: { color: '#1e1e1e' },
        },
      },
    },
  });
}

// ── SCROLL REVEAL ──────────────────────────────────────────────────────────
// Runs immediately so sections are visible even if data fetch fails

function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.05 }
  );
  document.querySelectorAll('section').forEach(s => {
    s.classList.add('will-animate');
    observer.observe(s);
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────

// Scroll reveal runs immediately on DOM ready — independent of data load
document.addEventListener('DOMContentLoaded', initScrollReveal);

// Charts require a local server (python3 -m http.server 8000)
fetch('../co2_data.json')
  .then(res => res.json())
  .then(DATA => {
    buildCombinedChart(DATA);
    buildCircadianChart(DATA);
  })
  .catch(err => console.warn('../co2_data.json not loaded. Run via local server, not file://', err));