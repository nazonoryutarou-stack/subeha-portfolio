(() => {
  const cfg = window.REPORT_ADMIN_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const $ = (s) => document.querySelector(s);
  const state = { token: localStorage.getItem('subeha_owner_token') || '', reports: [] };

  const els = {
    status: $('#admin-status'),
    login: $('#login-button'),
    logout: $('#logout-button'),
    view: $('#admin-view'),
    search: $('#report-search'),
    list: $('#report-list'),
    report: $('#report-body'),
    count: $('#result-count'),
    total: $('#stat-total'),
    latest: $('#stat-latest'),
    user: $('#stat-user')
  };

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const tokenFromHash = hash.get('token');
  if (tokenFromHash) {
    state.token = tokenFromHash;
    localStorage.setItem('subeha_owner_token', tokenFromHash);
    history.replaceState(null, '', location.pathname + location.search);
  }

  els.login?.addEventListener('click', () => {
    if (!apiBase) return setStatus('管理者APIはまだ未設定です。');
    const back = `${location.origin}${location.pathname}`;
    location.href = `${apiBase}/login?return=${encodeURIComponent(back)}`;
  });

  els.logout?.addEventListener('click', () => {
    state.token = '';
    localStorage.removeItem('subeha_owner_token');
    showLoggedOut('ログアウトしました。');
  });

  let timer = null;
  els.search?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => loadReports(els.search.value), 180);
  });

  init();

  async function init() {
    if (!apiBase) return showLoggedOut('管理者閲覧室は配備待ちです。');
    if (!state.token) return showLoggedOut('管理者ログインが必要です。');
    try {
      const me = await api('/api/me');
      showLoggedIn(me.email);
      await loadReports('');
    } catch (error) {
      state.token = '';
      localStorage.removeItem('subeha_owner_token');
      showLoggedOut('ログインの有効期限が切れました。');
    }
  }

  function showLoggedIn(email) {
    els.view.hidden = false;
    els.login.hidden = true;
    els.logout.hidden = false;
    els.user.textContent = email || '-';
    setStatus(`${email} で管理者ログイン中`);
  }

  function showLoggedOut(message) {
    els.view.hidden = true;
    els.login.hidden = false;
    els.logout.hidden = true;
    setStatus(message || '');
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text || '';
  }

  async function loadReports(query) {
    const q = String(query || '').trim();
    setStatus(q ? `「${q}」を検索中…` : '配信観測記録を読み込み中…');
    try {
      const data = await api(`/api/reports?limit=500&q=${encodeURIComponent(q)}`);
      state.reports = data.items || [];
      renderList(state.reports);
      if (els.count) els.count.textContent = `${data.total || 0}件`;
      if (els.total) els.total.textContent = Number(data.total || 0).toLocaleString('ja-JP');
      if (els.latest) els.latest.textContent = data.latest_episode ? `#${data.latest_episode}` : '-';
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  function renderList(items) {
    if (!els.list) return;
    els.list.innerHTML = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'report-item';
      const title = item.title || `Gravity 第${item.episode}回`;
      const date = item.date ? `<small>${escapeHtml(item.date)}</small>` : '';
      const tags = (item.headings || []).slice(0, 4).map((x) => `<span>${escapeHtml(x)}</span>`).join('');
      button.innerHTML = `<b>${escapeHtml(title)}</b>${date}<div class="tags">${tags}</div>`;
      button.addEventListener('click', () => openReport(item.episode, title));
      els.list.appendChild(button);
    }
    if (!items.length) els.list.innerHTML = '<p class="empty">該当する記録はありません。</p>';
  }

  async function openReport(episode, title) {
    setStatus(`第${episode}回を読み込み中…`);
    try {
      const response = await fetch(`${apiBase}/api/reports/${episode}`, {
        headers: { Authorization: `Bearer ${state.token}` }
      });
      if (!response.ok) throw new Error(await errorText(response));
      const markdown = await response.text();
      els.report.innerHTML = `<div class="report-head"><small>GRAVITY ${episode}</small><h2>${escapeHtml(title)}</h2></div>${renderMarkdown(markdown)}`;
      els.report.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function api(path) {
    const response = await fetch(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!response.ok) throw new Error(await errorText(response));
    return response.json();
  }

  async function errorText(response) {
    try {
      const data = await response.json();
      return data.error || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let html = '';
    let inList = false;
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { closeList(); continue; }
      if (/^---+$/.test(line.trim())) { closeList(); html += '<hr>'; continue; }
      const h = line.match(/^(#{1,4})\s+(.+)$/);
      if (h) {
        closeList();
        const level = Math.min(4, h[1].length + 1);
        html += `<h${level}>${inline(h[2])}</h${level}>`;
        continue;
      }
      const li = line.match(/^[-*]\s+(.+)$/);
      if (li) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inline(li[1])}</li>`;
        continue;
      }
      if (/^>\s?/.test(line)) {
        closeList();
        html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`;
        continue;
      }
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
    closeList();
    return `<article class="markdown">${html}</article>`;
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }
})();
