// js/academics.js
const FIRST_YEAR_DIVISIONS = {
  'A–J': [
    { name: 'Engineering Chemistry', abbr: 'EC' },
    { name: 'Digital Logic Design', abbr: 'DLD' },
    { name: 'Programming for Problem Solving', abbr: 'PPS' },
    { name: 'Universal Human Values', abbr: 'UHV' },
    { name: 'Integral Calculus & Differential Equations', abbr: 'IC&DE' },
  ],
  'K–T': [
    { name: 'Indian Knowledge System', abbr: 'IKS' },
    { name: 'Engineering Physics', abbr: 'EP' },
    { name: 'Foundation of Data Analytics', abbr: 'FDA' },
    { name: 'Basic Workshop Technology', abbr: 'BWT' },
    { name: 'English for Engineers', abbr: 'EE' },
  ]
};

const RESOURCE_TABS = ['Notes', 'Question Bank', 'Question Papers'];

let currentYear = '1';
let resourcesCache = {};

async function loadAcademics(year = '1') {
  currentYear = year;
  const container = document.getElementById('academics-content');

  if (year !== '1') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No content available yet</h3>
        <p>If you are in 2nd, 3rd, or 4th year,<br>contact us to contribute your notes!</p>
        <a href="mailto:raisospot@student.com" style="color:var(--primary);font-weight:600;display:block;margin-top:16px">📧 Contribute Content</a>
      </div>`;
    return;
  }

  // Load resources from Supabase
  let resources = [];
  if (resourcesCache['1']) {
    resources = resourcesCache['1'];
  } else {
    const { data } = await supabase
      .from('academic_resources')
      .select('*')
      .eq('year', 1)
      .eq('status', 'approved');
    resources = data || [];
    resourcesCache['1'] = resources;
  }

  container.innerHTML = '';
  for (const [divName, subjects] of Object.entries(FIRST_YEAR_DIVISIONS)) {
    const section = document.createElement('div');
    section.className = 'division-section';
    section.innerHTML = `<div class="division-title">Division ${divName}</div>`;

    subjects.forEach(subject => {
      const subjectResources = resources.filter(r => r.subject === subject.abbr);
      section.appendChild(renderSubjectCard(subject, subjectResources));
    });

    container.appendChild(section);
  }
}

function renderSubjectCard(subject, resources) {
  const card = document.createElement('div');
  card.className = 'subject-card';

  card.innerHTML = `
    <div class="subject-header">
      <span class="subject-name">${subject.name}</span>
      <span class="subject-abbr">${subject.abbr}</span>
      <span class="subject-toggle">▾</span>
    </div>
    <div class="subject-body">
      <div class="resource-tabs">
        ${RESOURCE_TABS.map((t, i) => `<button class="res-tab${i === 0 ? ' active' : ''}" data-tab="${t.toLowerCase().replace(' ', '-')}">${t}</button>`).join('')}
      </div>
      <div class="resource-list" data-current-tab="notes">
        ${renderResourceList(resources.filter(r => r.type === 'notes'), subject.abbr, 'notes')}
      </div>
      <a class="submit-resource" href="https://forms.gle/YOUR_FORM_ID" target="_blank">
        📤 Submit / Share Resources
      </a>
    </div>
  `;

  // Toggle
  card.querySelector('.subject-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Tab switching
  card.querySelectorAll('.res-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      card.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabType = tab.dataset.tab;
      const list = card.querySelector('.resource-list');
      const filtered = resources.filter(r => r.type === tabType);
      list.innerHTML = renderResourceList(filtered, subject.abbr, tabType);
    });
  });

  return card;
}

function renderResourceList(items, subjectAbbr, type) {
  // Add sample question papers
  const sampleQPs = type === 'question-papers'
    ? [
        { id: 'qp1', title: 'Winter 2024', url: '#', type: 'question-papers' },
        { id: 'qp2', title: 'Summer 2025', url: '#', type: 'question-papers' },
        { id: 'qp3', title: 'Winter 2025', url: '#', type: 'question-papers' },
      ]
    : [];

  const allItems = [...items, ...sampleQPs];

  if (allItems.length === 0) {
    return `<p style="text-align:center;color:var(--text3);padding:20px;font-size:13px">No ${type} yet. Be the first to share!</p>`;
  }

  return allItems.map(item => `
    <div class="resource-item">
      <span style="font-size:20px">${getResourceIcon(item.type)}</span>
      <a href="${item.url || '#'}" target="_blank">${escapeHtml(item.title)}</a>
      <a href="${item.url || '#'}" class="resource-download" download>⬇️</a>
    </div>
  `).join('');
}

function getResourceIcon(type) {
  return { 'notes': '📝', 'question-bank': '❓', 'question-papers': '📄' }[type] || '📎';
}
