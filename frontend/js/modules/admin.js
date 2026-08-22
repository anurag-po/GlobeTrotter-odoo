/**
 * GlobeTrotter — Admin Panel & Analytics Module
 */
export const AdminModule = {
  init() {
    const tabs = document.querySelectorAll('.admin-tabs__tab');
    const contents = document.querySelectorAll('.admin-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        contents.forEach((c) => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    if (document.getElementById('chart-users')) {
      this.drawPieChart('chart-users');
    }
  },

  drawPieChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <svg viewBox="0 0 200 200" width="200" height="200">
        <circle cx="100" cy="100" r="90" fill="#1A56DB" />
        <path d="M100,100 L100,10 A90,90 0 0,1 190,100 Z" fill="#FF5A5F" />
        <path d="M100,100 L190,100 A90,90 0 0,1 145,185 Z" fill="#10B981" />
        <path d="M100,100 L145,185 A90,90 0 0,1 55,185 Z" fill="#F59E0B" />
        <circle cx="100" cy="100" r="45" fill="white" />
        <text x="100" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">Users</text>
      </svg>
    `;
  },

  drawBarChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bars = [
      { label: 'Jan', value: 70, color: '#1A56DB' },
      { label: 'Feb', value: 50, color: '#FF5A5F' },
      { label: 'Mar', value: 85, color: '#10B981' },
      { label: 'Apr', value: 40, color: '#F59E0B' },
      { label: 'May', value: 65, color: '#0284C7' },
      { label: 'Jun', value: 95, color: '#1A56DB' },
    ];

    let barsHtml = '';
    bars.forEach((bar, i) => {
      const x = 20 + i * 45;
      const h = bar.value * 1.5;
      const y = 160 - h;
      barsHtml += `<rect x="${x}" y="${y}" width="30" height="${h}" fill="${bar.color}" rx="4"/>`;
      barsHtml += `<text x="${x + 15}" y="178" text-anchor="middle" font-size="10" font-weight="600" fill="#64748B">${bar.label}</text>`;
    });

    container.innerHTML = `
      <svg viewBox="0 0 300 200" width="300" height="200">
        <line x1="15" y1="10" x2="15" y2="165" stroke="#E2E8F0" stroke-width="1"/>
        <line x1="15" y1="165" x2="290" y2="165" stroke="#E2E8F0" stroke-width="1"/>
        ${barsHtml}
      </svg>
    `;
  },
};
