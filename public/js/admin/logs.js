/* logs.js — 日志相关 */

let currentLogType = 'system';

function switchLogType(type) {
  currentLogType = type;
  document.querySelectorAll('[data-logtype]').forEach(btn => {
    btn.className = btn.dataset.logtype === type
      ? 'text-xs px-3 py-1.5 rounded-lg transition bg-rose-600 text-white'
      : 'text-xs px-3 py-1.5 rounded-lg transition glass text-gray-400 hover:text-white';
  });
  loadLogs(1);
}

async function loadLogs(page) {
  const res = await fetch('/admin/api/logs?page=' + page + '&type=' + currentLogType);
  const d = await res.json();
  document.getElementById('log-body').innerHTML = d.rows.map(l =>
    '<tr class="border-b border-white/5"><td class="py-2 px-4 text-xs text-gray-500">' + l.created_at + '</td><td class="py-2 px-4 text-xs">' + (l.ip === 'system' ? '<span class="text-amber-400">系统</span>' : (l.username || '-')) + '</td><td class="py-2 px-4 text-xs">' + l.action + '</td><td class="py-2 px-4 text-xs text-gray-500 max-w-xs truncate">' + (l.detail || '') + '</td></tr>'
  ).join('');
  document.getElementById('log-info').textContent = '共 ' + d.total + ' 条';
  const pager = document.getElementById('log-pager');
  pager.innerHTML = '';
  for (let i = 1; i <= d.pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = 'text-xs px-2 py-1 rounded ' + (i === d.page ? 'bg-rose-600 text-white' : 'glass text-gray-400 hover:text-white');
    btn.onclick = () => loadLogs(i);
    pager.appendChild(btn);
  }
}

async function clearLogs() {
  if (!await _confirm('确定清空所有日志？')) return;
  await fetch('/admin/api/logs/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  loadLogs(1);
}
