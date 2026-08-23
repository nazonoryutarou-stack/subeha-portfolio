(() => {
  const cfg = window.MEMBERSHIP_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const signupUrl = String(cfg.signupUrl || '');
  const planName = cfg.planName || '常連';
  const monthlyPrice = Number(cfg.monthlyPrice || 1000);
  const $ = (s) => document.querySelector(s);
  const state = { token: localStorage.getItem('subeha_member_token') || '', reports: [] };

  const els = {
    status: $('#member-status'),
    guest: $('#guest-view'),
    member: $('#member-view'),
    login: $('#login-button'),
    signup: $('#signup-button'),
    logout: $('#logout-button'),
    portal: $('#portal-button'),
    search: $('#report-search'),
    list: $('#report-list'),
    report: $('#report-body'),
    count: $('#report-count'),
    plan: $('#plan-name'),
    price: $('#plan-price')
  };

  if (els.plan) els.plan.textContent = planName;
  if (els.price) els.price.textContent = `${monthlyPrice.toLocaleString('ja-JP')}円 / 月`;

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const tokenFromHash = hash.get('token');
  const errorFromHash = hash.get('error');
  if (tokenFromHash) {
    state.token = tokenFromHash;
    localStorage.setItem('subeha_member_token', tokenFromHash);
    history.replaceState(null, '', location.pathname + location.search);
  } else if (errorFromHash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  if (els.signup) {
    if (signupUrl) els.signup.href = signupUrl;
    else els.signup.hidden = true;
  }

  if (els.login) {
    els.login.addEventListener('click', () => {
      if (!apiBase) return setStatus('会員APIはまだ未設定です。');
      const back = `${location.origin}${location.pathname}`;
      location.href = `${apiBase}/login?return=${encodeURIComponent(back)}`;
    });
  }

  if (els.logout) {
    els.logout.addEventListener('click', () => {
      state.token = '';
      localStorage.removeItem('subeha_member_token');
      showGuest('ログアウトしました。');
    });
  }

  if (els.portal) {
    els.portal.addEventListener('click', async () => {
      try {
        const data = await api('/api/portal', { method: 'POST' });
        if (data.url) location.href = data.url;
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  let timer = null;
  if (els.search) {
    els.search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadReports(els.search.value), 220);
    });
  }

  init(errorFromHash);

  async function init(error) {
    if (error === 'not-member') {
      showGuest('このメールアドレスでは有効な会員契約を確認できませんでした。');
      return;
    }
    if (!apiBase) {
      showGuest('会員アーカイブは現在準備中です。');
      return;
    }
    if (!state.token) {
      showGuest('会員はメール認証でログインできます。');
      return;
    }
    try {
      const me = await api('/api/me');
      showMember(me.email);
      await loadReports('');
    } catch (error) {
      localStorage.removeItem('subeha_member_token');
      state.token = '';
      showGuest(error.message === 'membership inactive' ? '会員契約が現在有効ではありません。' : 'ログインの有効期限が切れました。');
    }
  }

  function showGuest(message) {
    if (els.guest) els.guest.hidden = false;
    if (els.member) els.member.hidden = true;
    setStatus(message || '');
  }

  function showMember(email) {
    if (els.guest) els.guest.hidden = true;
    if (els.member) els.member.hidden = false;
    setStatus(`${email} でログイン中`);
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text || '';
  }

  async function loadReports(query) {
    const q = String(query || '').trim();
    setStatus(q ? `「${q}」を検索中…` : '配信観測記録を読み込み中…');
    try {
      const data = await api(`/api/reports?limit=200&q=${encodeURIComponent(q)}`);
      state.reports = data.items || [];
      renderList(state.reports);
      if (els.count) els.count.textContent = `${data.total || 0}件`;
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
      const topics = (item.headings || []).slice(0, 3).map((x) => `<span>${escapeHtml(x)}</span>`).join('');
      button.innerHTML = `<b>${escapeHtml(title)}</b>${date}<div class="report-topics">${topics}</div>`;
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
      if (els.report) {
        els.report.innerHTML = `<div class="report-head"><small>GRAVITY ${episode}</small><h2>${escapeHtml(title)}</h2></div>${renderMarkdown(markdown)}`;
        els.report.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
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
    const closeList = () => {
      if (inList) { html += '</ul>'; inList = false; }
    };
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
        closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`; continue;
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
