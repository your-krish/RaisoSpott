// js/opportunities.js
async function loadOpportunities(typeFilter = '', yearFilter = '') {
  const container = document.getElementById('opportunities-container');
  container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text3)">Loading...</p>';

  let query = supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (typeFilter) query = query.eq('type', typeFilter);
  if (yearFilter) query = query.contains('eligible_years', [parseInt(yearFilter)]);

  const { data, error } = await query;

  container.innerHTML = '';
  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
        <h3>No opportunities yet</h3>
        <p>Check back soon for internships, hackathons, and more!</p>
      </div>`;
    return;
  }

  data.forEach(opp => {
    const card = document.createElement('div');
    card.className = 'opp-card';
    card.innerHTML = `
      <div class="opp-header">
        <div class="opp-title">${escapeHtml(opp.title)}</div>
        <span class="opp-type ${opp.type}">${opp.type}</span>
      </div>
      <div class="opp-org">${escapeHtml(opp.organization || '')}</div>
      <div class="opp-meta">
        ${opp.deadline ? `<span class="opp-deadline">🗓️ Deadline: ${new Date(opp.deadline).toLocaleDateString()}</span>` : ''}
        ${opp.eligible_years ? `<span>Years: ${opp.eligible_years.join(', ')}</span>` : ''}
      </div>
      ${opp.description ? `<p style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.5">${escapeHtml(opp.description)}</p>` : ''}
      ${opp.apply_url ? `<a href="${opp.apply_url}" target="_blank" class="opp-apply">Apply Now →</a>` : ''}
    `;
    container.appendChild(card);
  });
}
