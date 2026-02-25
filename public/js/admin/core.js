/* core.js — Tab 切换、初始化、toast 兼容、通用工具 */

function showToast(msg, ms) { toast(msg, ms); }

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  const sel = document.getElementById('tab-select');
  if (sel) sel.value = name;
  location.hash = name;
  if (name === 'aws') loadAwsConfig();
  if (name === 'ops') loadOpsConfig();
  if (name === 'diary') loadDiary(1);
  if (name === 'logs') loadLogs(1);
  if (name === 'abuse') loadSubStats(1);
  if (name === 'users') loadUsers(1);
  if (name === 'traffic') { loadTraffic(1); loadTrafficChart(); }
  if (name === 'backup') loadBackups();
}

// Tab 滚动渐隐提示
(function () {
  const bar = document.querySelector('.tab-bar');
  const fade = document.querySelector('.tab-fade-right');
  if (!bar || !fade) return;

  function checkFade() {
    fade.style.opacity = (bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 10) ? '0' : '1';
  }
  bar.addEventListener('scroll', checkFade);
  checkFade();

  const origSwitch = window.switchTab;
  window.switchTab = function (name) {
    origSwitch(name);
    const btn = bar.querySelector('[data-tab="' + name + '"]');
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(checkFade, 300);
  };
})();

// URL msg 参数提示
(function () {
  const _msg = new URLSearchParams(location.search).get('msg');
  if (_msg) {
    const m = { deploying: '🚀 部署中，请稍后刷新查看', added: '✅ 节点已添加', dup: '⚠️ IP 已存在' };
    if (m[_msg]) showToast(m[_msg]);
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();

function toggleEdit(id) {
  document.getElementById('host-display-' + id).classList.toggle('hidden');
  document.getElementById('host-form-' + id).classList.toggle('hidden');
}

function updateNodeLevel(id, level) {
  fetch('/admin/api/nodes/' + id + '/update-level', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level })
  }).then(r => r.json()).then(d => { if (d.ok) showToast('等级已更新，节点配置同步中'); });
}

// === 快速入口：最近使用 + 收藏 ===
(function () {
  var TAB_LABELS = {
    nodes:'🌐 节点', users:'👥 用户', traffic:'📊 流量', whitelist:'🔒 白名单',
    logs:'📋 日志', abuse:'📈 订阅', ops:'🧠 运维', diary:'📔 日记',
    notify:'🔔 通知', aws:'☁️ AWS', settings:'⚙️ 设置', backup:'💾 备份'
  };
  var LS_RECENT = 'admin_recent_tabs';
  var LS_FAVS = 'admin_fav_tabs';
  var MAX_RECENT = 5;

  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch(e) { return []; } }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function getFavs() { return load(LS_FAVS); }
  function getRecent() { return load(LS_RECENT); }

  function toggleFav(tab) {
    var favs = getFavs();
    var i = favs.indexOf(tab);
    if (i >= 0) favs.splice(i, 1); else favs.push(tab);
    save(LS_FAVS, favs);
    renderQA();
  }

  function recordRecent(tab) {
    var list = getRecent().filter(function(t){ return t !== tab; });
    list.unshift(tab);
    if (list.length > MAX_RECENT) list.length = MAX_RECENT;
    save(LS_RECENT, list);
  }

  function renderQA() {
    var favs = getFavs();
    var recent = getRecent().filter(function(t){ return favs.indexOf(t) < 0; }).slice(0, 3);
    var items = favs.concat(recent);
    var container = document.getElementById('qa-chips');
    var wrap = document.getElementById('quick-access');
    if (!container || !wrap) return;
    if (!items.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    container.innerHTML = '';
    items.forEach(function(tab) {
      var isFav = favs.indexOf(tab) >= 0;
      var chip = document.createElement('button');
      chip.className = 'qa-chip' + (isFav ? ' fav' : '');
      chip.setAttribute('aria-label', (isFav ? '收藏: ' : '最近: ') + (TAB_LABELS[tab] || tab));
      chip.innerHTML = '<span class="qa-star" title="' + (isFav ? '取消收藏' : '收藏') + '">★</span>' + (TAB_LABELS[tab] || tab);
      chip.addEventListener('click', function(e) {
        // 点击星标区域切换收藏，其余切换 tab
        if (e.target.classList.contains('qa-star')) { e.stopPropagation(); toggleFav(tab); return; }
        switchTab(tab);
      });
      container.appendChild(chip);
    });
  }

  // 劫持 switchTab 记录最近使用
  var _origST = window.switchTab;
  window.switchTab = function(name) {
    recordRecent(name);
    _origST(name);
    renderQA();
  };

  // 长按 tab 按钮收藏（桌面 contextmenu / 移动 long-press）
  document.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn) {
    btn.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      toggleFav(btn.dataset.tab);
      toast(getFavs().indexOf(btn.dataset.tab) >= 0 ? '⭐ 已收藏' : '已取消收藏');
    });
  });

  renderQA();
})();

// 初始 hash tab
if (location.hash.slice(1)) switchTab(location.hash.slice(1));
