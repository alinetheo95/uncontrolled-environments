const CONDITIONS = [
  { key: 'natural_open',   label: 'Natural light — open',   color: '#6ab187', dash: [] },
  { key: 'darkness',       label: 'Darkness — sealed',      color: '#c0392b', dash: [6, 3] },
  { key: 'natural_closed', label: 'Natural light — closed', color: '#a8d5b5', dash: [3, 3] },
  { key: 'purple',         label: 'Purple grow light',      color: '#c39bd3', dash: [] },
];

function smooth(pts, w = 4) {
  return pts.map((p, i) => {
    const slice = pts.slice(Math.max(0, i - w), i + w + 1);
    return { x: p.x, y: Math.round(slice.reduce((s, v) => s + v.y, 0) / slice.length) };
  });
}

const tooltipDefaults = {
  backgroundColor: '#0f0f0f',
  borderColor: '#1e1e1e',
  borderWidth: 1,
  titleColor: '#444',
  bodyColor: '#aaa',
  titleFont: { family: 'IBM Plex Mono', size: 10 },
  bodyFont: { family: 'IBM Plex Mono', size: 11 },
  padding: 10,
};

function makeScales(yMin, yMax) {
  return {
    x: {
      type: 'linear',
      title: { display: true, text: 'elapsed time (min)', color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
      ticks: { color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
      grid: { color: '#111' },
      border: { color: '#1e1e1e' },
    },
    y: {
      min: yMin, max: yMax,
      title: { display: true, text: 'CO₂ (ppm)', color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
      ticks: { color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
      grid: { color: '#111' },
      border: { color: '#1e1e1e' },
    }
  };
}

function buildIndividualCharts(DATA) {
  CONDITIONS.forEach(c => {
    const canvas = document.getElementById(`chart_${c.key}`);
    if (!canvas) return;
    const pts = smooth(DATA[c.key]);
    const vals = pts.map(p => p.y);
    const pad = 20;
    const yMin = Math.floor((Math.min(...vals) - pad) / 10) * 10;
    const yMax = Math.ceil((Math.max(...vals) + pad) / 10) * 10;

    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [{
          label: c.label,
          data: pts,
          borderColor: c.color,
          backgroundColor: c.color + '12',
          fill: true,
          borderWidth: 2,
          borderDash: c.dash,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.35,
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipDefaults,
            callbacks: {
              title: items => `t = ${items[0].parsed.x.toFixed(2)} min`,
              label: item => ` ${item.parsed.y} ppm`,
            }
          }
        },
        scales: makeScales(yMin, yMax),
      }
    });
  });
}

function buildCombinedChart(DATA) {
  const combinedChart = new Chart(document.getElementById('chart_combined').getContext('2d'), {
    type: 'line',
    data: {
      datasets: CONDITIONS.map(c => ({
        label: c.label,
        data: smooth(DATA[c.key]),
        borderColor: c.color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: c.dash,
        pointRadius: 0,
        pointHitRadius: 8,
        tension: 0.35,
      }))
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            title: items => `t = ${items[0].parsed.x.toFixed(2)} min`,
            label: item => ` ${item.dataset.label}: ${item.parsed.y} ppm`,
          }
        }
      },
      scales: makeScales(580, 1360),
    }
  });

  // clickable legend
  const legendEl = document.getElementById('combined-legend');
  const hiddenSet = new Set();
  CONDITIONS.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const min = Math.min(...DATA[c.key].map(p => p.y));
    const max = Math.max(...DATA[c.key].map(p => p.y));
    item.innerHTML = `
      <div class="legend-line" style="background:${c.color}"></div>
      <span class="legend-text">${c.label}</span>
      <span class="legend-val">${min}–${max} ppm</span>
    `;
    item.addEventListener('click', () => {
      const meta = combinedChart.getDatasetMeta(i);
      if (hiddenSet.has(i)) {
        hiddenSet.delete(i); meta.hidden = false; item.classList.remove('hidden');
      } else {
        hiddenSet.add(i); meta.hidden = true; item.classList.add('hidden');
      }
      combinedChart.update();
    });
    legendEl.appendChild(item);
  });
}

function buildCircadianChart(DATA) {
  const circCanvas = document.getElementById('chart_circadian');
  if (!circCanvas) return;
  const pts = smooth(DATA['circadian'], 6);
  const vals = pts.map(p => p.y);
  const pad = 20;
  const yMin = Math.floor((Math.min(...vals) - pad) / 10) * 10;
  const yMax = Math.ceil((Math.max(...vals) + pad) / 10) * 10;

  new Chart(circCanvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label: '24hr natural run',
        data: pts,
        borderColor: '#88c9a0',
        backgroundColor: '#88c9a008',
        fill: true,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 8,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f0f0f',
          borderColor: '#1e1e1e',
          borderWidth: 1,
          titleColor: '#444',
          bodyColor: '#aaa',
          titleFont: { family: 'IBM Plex Mono', size: 10 },
          bodyFont: { family: 'IBM Plex Mono', size: 11 },
          padding: 10,
          callbacks: {
            title: items => {
              const hr = items[0].parsed.x;
              const wallHr = (19 + 6/60 + hr) % 24;
              const h = Math.floor(wallHr);
              const m = Math.floor((wallHr - h) * 60);
              return `t+${hr.toFixed(1)}hr  (${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')})`;
            },
            label: item => ` ${item.parsed.y} ppm`,
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'wall clock time (19:06 Mar 28 → 18:59 Mar 29)', color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: {
            color: '#333',
            font: { family: 'IBM Plex Mono', size: 10 },
            maxTicksLimit: 12,
            callback: val => {
              const wallHr = (19 + 6/60 + val) % 24;
              const h = Math.floor(wallHr);
              const m = Math.floor((wallHr - h) * 60);
              return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
            }
          },
          grid: { color: '#111' },
          border: { color: '#1e1e1e' },
        },
        y: {
          min: yMin, max: yMax,
          title: { display: true, text: 'CO₂ (ppm)', color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: { color: '#333', font: { family: 'IBM Plex Mono', size: 10 } },
          grid: { color: '#111' },
          border: { color: '#1e1e1e' },
        }
      }
    }
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.08 }
  );
  document.querySelectorAll('section').forEach(s => observer.observe(s));
}

// fetch data then build everything
fetch('data/co2_data.json')
  .then(res => res.json())
  .then(DATA => {
    buildIndividualCharts(DATA);
    buildCombinedChart(DATA);
    buildCircadianChart(DATA);
    initScrollReveal();
  })
  .catch(err => console.error('Failed to load data/co2_data.json:', err));