
'use strict';

// TURBAN SHOP 4.1
// Каталог + защищённое управление обычными товарами

const SUPABASE_URL =
  'https://tlrkdikpmcbfbcazwnae.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_C_unMg0Kd-rF1BrxNj2vnA_i6v7FoOC';

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const $ = id => document.getElementById(id);

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const FAV_KEY = 'turban-demo-favorites-v2';

function readFavorites() {
  try {
    const data = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(data) ? data.map(String) : [];
  } catch {
    return [];
  }
}

let products = [];
let adminProducts = [];
let favorites = readFavorites();
let filter = 'all';
let currentPage = 'home';
let previousPage = 'catalog';
let currentDetailId = null;
let loading = true;
let loadError = '';
let isAdmin = false;
let adminBusy = false;

const money = value =>
  Number(value).toLocaleString('ru-RU') + ' ₽';

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function safePhoto(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function findProduct(id) {
  return products.find(p => p.id === String(id));
}

function empty(title, description) {
  return `<div class="empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(description)}</div>`;
}

function showPage(page) {
  if (page === 'detail' && currentPage !== 'detail') {
    previousPage = currentPage;
  }

  currentPage = page;

  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === page);
  });

  document.querySelectorAll('.nav button').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  if (page === 'favorites') renderFavorites();

  window.scrollTo(0, 0);
}

function productCard(p) {
  const saved = favorites.includes(p.id);
  const photo = safePhoto(p.photo);

  return `
    <article class="product">
      <div class="product-photo" data-open="${escapeHTML(p.id)}">
        ${photo
          ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(p.name)}" loading="lazy">`
          : '<span>ФОТО</span>'}
        <button class="favorite-btn ${saved ? 'saved' : ''}"
          data-fav="${escapeHTML(p.id)}"
          aria-label="Избранное">${saved ? '♥' : '♡'}</button>
      </div>
      <div class="product-info" data-open="${escapeHTML(p.id)}">
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="product-description">${escapeHTML(p.description)}</div>
        <div class="product-price">${money(p.price)}</div>
      </div>
    </article>`;
}

function render() {
  const status = loading
    ? empty('Загружаем каталог', 'Подожди немного…')
    : loadError
      ? empty('Не удалось загрузить товары', loadError)
      : '';

  const newProducts = products.filter(p => p.category === 'new').slice(0, 4);
  const popularProducts = products.filter(p => p.category === 'popular').slice(0, 4);

  $('homeNew').innerHTML =
    status || newProducts.map(productCard).join('') ||
    empty('Новинок пока нет', 'Они появятся после публикации.');

  $('homePopular').innerHTML =
    status || popularProducts.map(productCard).join('') ||
    empty('Пока пусто', 'Популярные товары появятся здесь.');

  const query = $('search').value.trim().toLocaleLowerCase('ru');

  const visible = products.filter(p =>
    (filter === 'all' || p.category === filter) &&
    `${p.name} ${p.description}`.toLocaleLowerCase('ru').includes(query)
  );

  $('catalogCount').textContent = loading
    ? 'Загрузка…'
    : `${visible.length} товаров`;

  $('catalogItems').innerHTML =
    status || visible.map(productCard).join('') ||
    empty('Каталог пока пуст', 'Опубликованные товары появятся здесь.');

  renderFavorites();
}

function renderFavorites() {
  const items = products.filter(p => favorites.includes(p.id));

  $('favoriteItems').innerHTML = loading
    ? empty('Загрузка…', '')
    : items.map(productCard).join('') ||
      empty('Здесь пока пусто', 'Нажми ♡ на карточке товара.');
}

function toggleFavorite(id) {
  id = String(id);

  favorites = favorites.includes(id)
    ? favorites.filter(item => item !== id)
    : [...favorites, id];

  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.warn(error);
  }

  render();

  if (currentPage === 'detail' && currentDetailId) {
    renderDetail(currentDetailId);
  }
}

function renderDetail(id) {
  const p = findProduct(id);
  if (!p) return;

  currentDetailId = String(id);

  const photo = safePhoto(p.photo);
  const saved = favorites.includes(p.id);

  $('detailView').innerHTML = `
    <div class="detail-photo">
      ${photo
        ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(p.name)}">`
        : 'Фото не добавлено'}
    </div>
    <h1>${escapeHTML(p.name)}</h1>
    <p class="muted">${escapeHTML(p.description || 'Описание пока не добавлено.')}</p>
    <p class="detail-price">${money(p.price)}</p>
    <p class="muted">${p.stock > 0 ? `В наличии: ${p.stock} шт.` : 'Нет в наличии'}</p>
    <button class="primary" data-fav="${escapeHTML(p.id)}">
      ${saved ? '♥ Убрать из избранного' : '♡ Добавить в избранное'}
    </button>`;
}

function openDetail(id) {
  if (!findProduct(id)) return;
  renderDetail(id);
  showPage('detail');
}

function normalizeProduct(row) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: Number(row.price ?? 0),
    stock: Number(row.stock ?? 0),
    category: String(row.category ?? 'new'),
    photo: safePhoto(row.image_url),
    isPublished: Boolean(row.is_published)
  };
}

async function loadProducts() {
  loading = true;
  loadError = '';
  render();

  try {
    const { data, error } = await db
      .from('products')
      .select('id,name,description,price,stock,category,image_url,is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    products = (data || []).map(normalizeProduct);
  } catch (error) {
    console.error('Ошибка каталога:', error);
    loadError = 'Проверь подключение Supabase и права доступа.';
  } finally {
    loading = false;
    render();
  }
}

function updateAdminUI(email = '') {
  $('adminLogin').hidden = isAdmin;
  $('adminPanel').hidden = !isAdmin;
  $('adminUserEmail').textContent = email;
}

async function checkAdmin() {
  isAdmin = false;
  updateAdminUI();

  try {
    const { data: userData, error: userError } =
      await db.auth.getUser();

    if (userError || !userData.user) return false;

    const { data, error } = await db
      .from('admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) throw error;

    isAdmin = Boolean(data);
    updateAdminUI(isAdmin ? userData.user.email : '');

    if (isAdmin) await loadAdminProducts();

    return isAdmin;
  } catch (error) {
    console.error('Проверка администратора:', error);
    isAdmin = false;
    updateAdminUI();
    return false;
  }
}

function setAdminStatus(message) {
  $('adminStatus').textContent = message;
}

function setAdminBusy(busy) {
  adminBusy = busy;
  $('saveButton').disabled = busy;
  $('resetForm').disabled = busy;
  $('refreshAdmin').disabled = busy;
}

async function loadAdminProducts() {
  if (!isAdmin) return;

  $('adminList').innerHTML = empty('Загрузка товаров', 'Подожди немного…');

  try {
    const { data, error } = await db
      .from('products')
      .select('id,name,description,price,stock,category,image_url,is_published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    adminProducts = (data || []).map(normalizeProduct);
    renderAdminProducts();
  } catch (error) {
    console.error('Ошибка админ-каталога:', error);
    $('adminList').innerHTML =
      empty('Не удалось загрузить товары', 'Проверь RLS и права администратора.');
  }
}

function renderAdminProducts() {
  if (!isAdmin) return;

  $('adminList').innerHTML = adminProducts.map(p => `
    <div class="profile" style="margin-bottom:12px;align-items:flex-start;">
      <div class="avatar" style="overflow:hidden;flex-shrink:0;">
        ${p.photo
          ? `<img src="${escapeHTML(p.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
          : '▦'}
      </div>
      <div style="flex:1;min-width:0;">
        <strong>${escapeHTML(p.name)}</strong>
        <p>${money(p.price)} · Остаток: ${p.stock}</p>
        <p class="muted">${p.isPublished ? '● Опубликован' : '○ Скрыт'}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
          <button type="button" class="secondary"
            data-admin-edit="${escapeHTML(p.id)}">Изменить</button>
          <button type="button" class="secondary"
            data-admin-toggle="${escapeHTML(p.id)}">
            ${p.isPublished ? 'Скрыть' : 'Опубликовать'}
          </button>
          <button type="button" class="secondary"
            data-admin-delete="${escapeHTML(p.id)}">Удалить</button>
        </div>
      </div>
    </div>
  `).join('') || empty('Товаров пока нет', 'Добавь первый товар через форму.');
}

function previewPhoto() {
  const photo = safePhoto($('imageUrl').value.trim());

  $('photoPreview').innerHTML = photo
    ? `<img src="${escapeHTML(photo)}" alt="Предпросмотр" style="max-width:100%;max-height:180px;object-fit:contain;">`
    : 'Фото пока нет';
}

function resetProductForm() {
  $('productForm').reset();
  $('editId').value = '';
  $('saveButton').textContent = 'Добавить товар';
  $('photoPreview').textContent = 'Фото пока нет';
  setAdminStatus('');
}

function editProduct(id) {
  const p = adminProducts.find(item => item.id === String(id));
  if (!p) return;

  $('editId').value = p.id;
  $('name').value = p.name;
  $('description').value = p.description;
  $('price').value = p.price;
  $('stock').value = p.stock;
  $('category').value = p.category;
  $('imageUrl').value = p.photo;
  $('isPublished').checked = p.isPublished;

  $('saveButton').textContent = 'Сохранить изменения';
  setAdminStatus('Редактирование: ' + p.name);
  previewPhoto();

  $('productForm').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function getProductPayload() {
  const name = $('name').value.trim();
  const description = $('description').value.trim();
  const price = Number($('price').value);
  const stock = Number($('stock').value);
  const category = $('category').value;
  const rawPhoto = $('imageUrl').value.trim();
  const imageUrl = safePhoto(rawPhoto);

  if (!name || name.length > 100) {
    throw new Error('Введи название товара до 100 символов.');
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Укажи корректную цену.');
  }

  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw new Error('Остаток должен быть целым неотрицательным числом.');
  }

  if (!['new', 'popular', 'sale'].includes(category)) {
    throw new Error('Выбери категорию.');
  }

  if (rawPhoto && !imageUrl) {
    throw new Error('Фотография должна иметь корректную HTTPS-ссылку.');
  }

  return {
    name,
    description,
    price,
    stock,
    category,
    image_url: imageUrl || null,
    is_published: $('isPublished').checked
  };
}

$('productForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!isAdmin || adminBusy) return;

  setAdminBusy(true);
  setAdminStatus('Сохраняем товар…');

  try {
    const payload = getProductPayload();
    const id = $('editId').value;

    const query = id
      ? db.from('products').update(payload).eq('id', id)
      : db.from('products').insert(payload);

    const { error } = await query;

    if (error) throw error;

    resetProductForm();
    setAdminStatus('Товар успешно сохранён.');

    await Promise.all([
      loadAdminProducts(),
      loadProducts()
    ]);
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    setAdminStatus('Ошибка: ' + (error.message || 'Не удалось сохранить товар.'));
  } finally {
    setAdminBusy(false);
  }
});

async function togglePublished(id) {
  if (!isAdmin || adminBusy) return;

  const p = adminProducts.find(item => item.id === String(id));
  if (!p) return;

  setAdminBusy(true);
  setAdminStatus('Обновляем публикацию…');

  try {
    const { error } = await db
      .from('products')
      .update({ is_published: !p.isPublished })
      .eq('id', p.id);

    if (error) throw error;

    await Promise.all([loadAdminProducts(), loadProducts()]);
    setAdminStatus('Статус публикации обновлён.');
  } catch (error) {
    console.error(error);
    setAdminStatus('Не удалось изменить публикацию.');
  } finally {
    setAdminBusy(false);
  }
}

async function deleteProduct(id) {
  if (!isAdmin || adminBusy) return;

  const p = adminProducts.find(item => item.id === String(id));
  if (!p) return;

  if (!window.confirm(`Удалить товар «${p.name}»?`)) return;

  setAdminBusy(true);
  setAdminStatus('Удаляем товар…');

  try {
    const { error } = await db
      .from('products')
      .delete()
      .eq('id', p.id);

    if (error) throw error;

    if ($('editId').value === p.id) resetProductForm();

    await Promise.all([loadAdminProducts(), loadProducts()]);
    setAdminStatus('Товар удалён.');
  } catch (error) {
    console.error(error);
    setAdminStatus('Не удалось удалить товар.');
  } finally {
    setAdminBusy(false);
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();

  const email = $('adminEmail').value.trim();
  const password = $('adminPassword').value;
  const button = $('loginButton');

  button.disabled = true;
  $('loginStatus').textContent = 'Проверяем данные…';

  try {
    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const allowed = await checkAdmin();

    if (!allowed) {
      await db.auth.signOut();
      $('loginStatus').textContent =
        'Нет прав администратора или не удалось проверить доступ.';
      return;
    }

    $('adminPassword').value = '';
    $('loginStatus').textContent = '';
  } catch (error) {
    console.error('Ошибка входа:', error);
    $('loginStatus').textContent =
      'Не удалось войти. Проверь email и пароль.';
  } finally {
    button.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async () => {
  await db.auth.signOut();

  isAdmin = false;
  adminProducts = [];
  updateAdminUI();
  resetProductForm();
  $('adminList').innerHTML = '';
  $('adminPassword').value = '';
  $('loginStatus').textContent = '';

  await loadProducts();
});

$('adminShortcut').addEventListener('click', async () => {
  showPage('admin');
  await checkAdmin();
});

$('resetForm').addEventListener('click', resetProductForm);
$('imageUrl').addEventListener('input', previewPhoto);

$('refreshAdmin').addEventListener('click', async () => {
  await loadAdminProducts();
});

document.addEventListener('click', event => {
  const adminEdit = event.target.closest('[data-admin-edit]');
  if (adminEdit) {
    editProduct(adminEdit.dataset.adminEdit);
    return;
  }

  const adminToggle = event.target.closest('[data-admin-toggle]');
  if (adminToggle) {
    togglePublished(adminToggle.dataset.adminToggle);
    return;
  }

  const adminDelete = event.target.closest('[data-admin-delete]');
  if (adminDelete) {
    deleteProduct(adminDelete.dataset.adminDelete);
    return;
  }

  const favorite = event.target.closest('[data-fav]');
  if (favorite) {
    toggleFavorite(favorite.dataset.fav);
    return;
  }

  const product = event.target.closest('[data-open]');
  if (product) {
    openDetail(product.dataset.open);
    return;
  }

  const navigation = event.target.closest('[data-page]');
  if (navigation) {
    showPage(navigation.dataset.page);
    return;
  }

  const category = event.target.closest('[data-filter]');
  if (category) {
    filter = category.dataset.filter;

    document.querySelectorAll('[data-filter]').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.filter === filter
      );
    });

    render();
    showPage('catalog');
  }
});

$('search').addEventListener('input', render);

$('back').addEventListener('click', () => {
  showPage(previousPage === 'detail' ? 'catalog' : previousPage);
});

$('about').addEventListener('click', () => {
  $('aboutText').textContent =
    'Turban Shop — каталог товаров. Данные загружаются из Supabase.';
});

const user = tg?.initDataUnsafe?.user;

if (user) {
  $('profileName').textContent =
    user.first_name || user.username || 'Пользователь';
}

updateAdminUI();
loadProducts();
checkAdmin();
