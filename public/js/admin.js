const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  videos: [],
  editingId: null,
  pendingVideoFile: null,
  pendingThumbFile: null,
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function show(el) {
  el.hidden = false;
}
function hide(el) {
  el.hidden = true;
}

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' toast-error' : '');
  show(t);
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => hide(t), 4000);
}

function formatPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

async function checkAuth() {
  try {
    const { user } = await api('/api/admin/me');
    state.user = user;
    return true;
  } catch {
    state.user = null;
    return false;
  }
}

function showLogin() {
  hide($('#dashboard'));
  show($('#login-screen'));
}

function showDashboard() {
  hide($('#login-screen'));
  show($('#dashboard'));
  $('#admin-email').textContent = state.user?.email || '';
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  try {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const { user } = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    state.user = user;
    showDashboard();
    await loadVideos();
    toast('Login efetuado');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await api('/api/admin/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  state.user = null;
  showLogin();
}

async function loadVideos() {
  const tbody = $('#videos-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="muted center">A carregar…</td></tr>';
  try {
    const { videos } = await api('/api/admin/videos');
    state.videos = videos;
    renderVideoTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="center error-text">${err.message}</td></tr>`;
  }
}

function renderVideoTable() {
  const tbody = $('#videos-tbody');
  if (!state.videos.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted center">Nenhum vídeo. Clique em "Novo vídeo".</td></tr>';
    return;
  }

  tbody.innerHTML = state.videos
    .map((v) => {
      const status = v.is_active
        ? '<span class="badge badge-ok">Ativo</span>'
        : '<span class="badge badge-off">Inativo</span>';
      const price = v.is_free ? 'Grátis' : `€${formatPrice(v.price)}`;
      const hasFile = v.video_file_id ? '✓' : '—';
      return `<tr data-id="${v.id}">
        <td class="thumb-cell">${v.thumbnail_file_id || v.thumbnail_url ? '🖼' : '—'}</td>
        <td><strong>${escapeHtml(v.title)}</strong></td>
        <td>${price}</td>
        <td>${v.views ?? 0}</td>
        <td>${v.sort_order ?? 0}</td>
        <td>${status}</td>
        <td class="actions-cell">
          <button type="button" class="btn-sm btn-edit" data-action="edit">Editar</button>
          <a href="/watch?id=${encodeURIComponent(v.id)}" target="_blank" class="btn-sm btn-ghost">Ver</a>
          ${v.is_active ? `<button type="button" class="btn-sm btn-danger" data-action="delete">Desativar</button>` : ''}
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openEditor(btn.closest('tr').dataset.id));
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deactivateVideo(btn.closest('tr').dataset.id));
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resetForm() {
  state.editingId = null;
  state.pendingVideoFile = null;
  state.pendingThumbFile = null;
  $('#video-form').reset();
  $('#field-id').value = '';
  $('#field-is_active').checked = true;
  $('#field-is_free').checked = false;
  $('#upload-video-status').textContent = '';
  $('#upload-thumb-status').textContent = '';
  $('#field-video_file_id').value = '';
  $('#field-thumbnail_file_id').value = '';
  $('#editor-title').textContent = 'Novo vídeo';
}

function openEditor(id) {
  const v = state.videos.find((x) => x.id === id);
  if (!v) return;

  state.editingId = id;
  state.pendingVideoFile = null;
  state.pendingThumbFile = null;
  $('#editor-title').textContent = 'Editar vídeo';
  $('#field-id').value = v.id;
  $('#field-title').value = v.title || '';
  $('#field-description').value = v.description || '';
  $('#field-price').value = v.price ?? 0;
  $('#field-duration').value = v.duration || '';
  $('#field-sort_order').value = v.sort_order ?? 0;
  $('#field-masked_product_name').value = v.masked_product_name || 'Premium Digital Content';
  $('#field-product_link').value = v.product_link || '';
  $('#field-public_video_url').value = v.public_video_url || '';
  $('#field-thumbnail_url').value = v.thumbnail_url || '';
  $('#field-video_file_id').value = v.video_file_id || '';
  $('#field-thumbnail_file_id').value = v.thumbnail_file_id || '';
  $('#field-is_active').checked = v.is_active !== false;
  $('#field-is_free').checked = v.is_free === true;
  $('#upload-video-status').textContent = v.video_file_id ? `Atual: ${v.video_file_id}` : '';
  $('#upload-thumb-status').textContent = v.thumbnail_file_id ? `Atual: ${v.thumbnail_file_id}` : '';
  show($('#editor-panel'));
}

function closeEditor() {
  hide($('#editor-panel'));
  resetForm();
}

async function uploadFile(file, kind, videoId) {
  const { uploadUrl, key } = await api('/api/admin/upload/presign', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      kind,
      videoId,
    }),
  });

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });

  if (!putRes.ok) throw new Error(`Upload falhou (${putRes.status})`);
  return key;
}

async function handleFilePick(input, kind) {
  const file = input.files?.[0];
  if (!file) return;
  if (kind === 'video') state.pendingVideoFile = file;
  else state.pendingThumbFile = file;

  const statusEl = kind === 'video' ? $('#upload-video-status') : $('#upload-thumb-status');
  statusEl.textContent = `Selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
}

async function handleSave(e) {
  e.preventDefault();
  const btn = $('#save-btn');
  btn.disabled = true;

  try {
    const payload = {
      title: $('#field-title').value.trim(),
      description: $('#field-description').value.trim(),
      price: Number($('#field-price').value) || 0,
      duration: $('#field-duration').value.trim(),
      sort_order: Number($('#field-sort_order').value) || 0,
      masked_product_name: $('#field-masked_product_name').value.trim() || 'Premium Digital Content',
      product_link: $('#field-product_link').value.trim() || null,
      public_video_url: $('#field-public_video_url').value.trim() || null,
      thumbnail_url: $('#field-thumbnail_url').value.trim() || null,
      is_active: $('#field-is_active').checked,
      is_free: $('#field-is_free').checked,
      video_file_id: $('#field-video_file_id').value.trim() || null,
      thumbnail_file_id: $('#field-thumbnail_file_id').value.trim() || null,
    };

    if (!payload.title) {
      toast('Título é obrigatório', true);
      return;
    }

    let videoId = state.editingId;

    if (videoId) {
      await api(`/api/admin/videos/${videoId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      const { video } = await api('/api/admin/videos', { method: 'POST', body: JSON.stringify(payload) });
      videoId = video.id;
      state.editingId = videoId;
      $('#field-id').value = videoId;
    }

    if (state.pendingVideoFile) {
      $('#upload-video-status').textContent = 'A enviar vídeo…';
      const key = await uploadFile(state.pendingVideoFile, 'video', videoId);
      await api(`/api/admin/videos/${videoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ video_file_id: key }),
      });
      $('#field-video_file_id').value = key;
      state.pendingVideoFile = null;
      $('#upload-video-status').textContent = `Enviado: ${key}`;
    }

    if (state.pendingThumbFile) {
      $('#upload-thumb-status').textContent = 'A enviar thumbnail…';
      const key = await uploadFile(state.pendingThumbFile, 'thumbnail', videoId);
      await api(`/api/admin/videos/${videoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ thumbnail_file_id: key }),
      });
      $('#field-thumbnail_file_id').value = key;
      state.pendingThumbFile = null;
      $('#upload-thumb-status').textContent = `Enviado: ${key}`;
    }

    toast('Vídeo guardado');
    await loadVideos();
    closeEditor();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deactivateVideo(id) {
  const v = state.videos.find((x) => x.id === id);
  if (!v || !confirm(`Desativar "${v.title}"? Deixa de aparecer na loja.`)) return;
  try {
    await api(`/api/admin/videos/${id}`, { method: 'DELETE' });
    toast('Vídeo desativado');
    await loadVideos();
  } catch (err) {
    toast(err.message, true);
  }
}

function init() {
  $('#login-form').addEventListener('submit', handleLogin);
  $('#logout-btn').addEventListener('click', handleLogout);
  $('#new-video-btn').addEventListener('click', () => {
    resetForm();
    show($('#editor-panel'));
  });
  $('#close-editor').addEventListener('click', closeEditor);
  $('#video-form').addEventListener('submit', handleSave);
  $('#refresh-btn').addEventListener('click', loadVideos);
  $('#pick-video').addEventListener('change', (e) => handleFilePick(e.target, 'video'));
  $('#pick-thumb').addEventListener('change', (e) => handleFilePick(e.target, 'thumbnail'));

  checkAuth().then((ok) => {
    if (ok) {
      showDashboard();
      loadVideos();
    } else {
      showLogin();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
