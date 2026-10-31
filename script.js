
'use strict';

// TURBAN SHOP 4.3
// Каталог, избранное, админка, фотографии и корзина

const SUPABASE_URL =
  'https://tlrkdikpmcbfbcazwnae.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_C_unMg0Kd-rF1BrxNj2vnA_i6v7FoOC';

const BUCKET = 'product-images';
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

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
const CART_KEY = 'turban-cart-v1';

function readJSON(key, fallback) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

let products = [];
let adminProducts = [];

let favorites = readJSON(FAV_KEY, []);
if (!Array.isArray(favorites)) favorites = [];
favorites = favorites.map(String);

let cart = readJSON(CART_KEY, {});
if (!cart || typeof cart !== 'object' || Array.isArray(cart)) {
  cart = {};
}

let filter = 'all';
let currentPage = 'home';
let previousPage = 'catalog';
let currentDetailId = null;
let loading = true;
let loadError = '';
let isAdmin = false;
let adminBusy = false;
let previewObjectURL = '';

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

function empty(title, description) {
  return `<div class="empty">
    <strong>${escapeHTML(title)}</strong>
    ${escapeHTML(description)}
  </div>`;
}

function findProduct(id) {
  return products.find(p => p.id === String(id));
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn('Не удалось сохранить корзину:', error);
  }
}

function cartCount() {
  return Object.values(cart).reduce((sum, quantity) => {
    const n = Number(quantity);
    return sum + (Number.isSafeInteger(n) && n > 0 ? n : 0);
  }, 0);
}

function updateCartBadge() {
  const button = document.querySelector('[data-page="cart"]');
  if (!button) return;

  const count = cartCount();
  const badge = button.querySelector('.cart-count');

  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  }
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
  if (page === 'cart') renderCart();

  window.scrollTo(0, 0);
}

function productCard(p) {
  const saved = favorites.includes(p.id);
  const photo = safePhoto(p.photo);

  return `
    <article class="product">
      <div class="product-photo" data-open="${escapeHTML(p.id)}">
        ${photo
          ? `<img src="${escapeHTML(photo)}"
              alt="${escapeHTML(p.name)}" loading="lazy">`
          : '<span>ФОТО</span>'}

        <button class="favorite-btn ${saved ? 'saved' : ''}"
          data-fav="${escapeHTML(p.id)}"
          aria-label="Избранное">
          ${saved ? '♥' : '♡'}
        </button>
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

  const sections = [
    ['homeNew', 'new', 'Новинок пока нет'],
    ['homePopular', 'popular', 'Популярных товаров пока нет'],
    ['homeSale', 'sale', 'Скидок пока нет']
  ];

  sections.forEach(([elementId, category, title]) => {
    const items = products
      .filter(p => p.category === category)
      .slice(0, 4);

    $(elementId).innerHTML =
      status ||
      items.map(productCard).join('') ||
      empty(title, 'Товары появятся после публикации.');
  });

  const query = $('search').value.trim().toLocaleLowerCase('ru');

  const visible = products.filter(p =>
    (filter === 'all' || p.category === filter) &&
    `${p.name} ${p.description}`
      .toLocaleLowerCase('ru')
      .includes(query)
  );

  $('catalogCount').textContent = loading
    ? 'Загрузка…'
    : `${visible.length} товаров`;

  $('catalogItems').innerHTML =
    status ||
    visible.map(productCard).join('') ||
    empty('Каталог пока пуст', 'Опубликованные товары появятся здесь.');

  renderFavorites();
  renderCart();
  updateCartBadge();
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

function addToCart(id) {
  const p = findProduct(id);

  if (!p || p.stock <= 0) {
    alert('Товара нет в наличии.');
    return;
  }

  const current = Number(cart[p.id] || 0);

  if (current >= p.stock) {
    alert('Нельзя добавить больше доступного остатка.');
    return;
  }

  cart[p.id] = current + 1;
  saveCart();
  renderCart();
  updateCartBadge();

  if (currentPage === 'detail') renderDetail(p.id);
}

function changeCartQuantity(id, delta) {
  const p = findProduct(id);
  if (!p) return;

  const current = Number(cart[p.id] || 0);
  const next = current + delta;

  if (next <= 0) {
    delete cart[p.id];
  } else if (next <= p.stock) {
    cart[p.id] = next;
  } else {
    alert('Недостаточно товара в наличии.');
    return;
  }

  saveCart();
  renderCart();
  updateCartBadge();

  if (currentPage === 'detail') renderDetail(p.id);
}

function removeFromCart(id) {
  delete cart[String(id)];
  saveCart();
  renderCart();
  updateCartBadge();
}

function renderCart() {
  const container = $('cartItems');
  if (!container) return;

  if (loading) {
    container.innerHTML = empty('Загрузка корзины', 'Подожди немного…');
    return;
  }

  let total = 0;
  let count = 0;

  const entries = Object.entries(cart)
    .map(([id, quantity]) => ({
      product: findProduct(id),
      quantity: Number(quantity)
    }))
    .filter(item => item.product && item.quantity > 0);

  if (!entries.length) {
    container.innerHTML = empty(
      'Корзина пуста',
      'Добавь товары из каталога.'
    );
    $('cartTotal').textContent = money(0);
    $('cartSummary').hidden = true;
    return;
  }

  const html = entries.map(({ product: p, quantity }) => {
    const available = Math.max(0, p.stock);
    const effectiveQuantity = Math.min(quantity, available);

    total += p.price * effectiveQuantity;
    count += effectiveQuantity;

    return `
      <div class="profile" style="margin-bottom:12px;align-items:flex-start;">
        <div class="avatar" style="overflow:hidden;flex-shrink:0;">
          ${p.photo
            ? `<img src="${escapeHTML(p.photo)}" alt=""
                style="width:100%;height:100%;object-fit:cover;">`
            : '▦'}
        </div>

        <div style="flex:1;min-width:0;">
          <strong>${escapeHTML(p.name)}</strong>
          <p>${money(p.price)} за шт.</p>

          ${quantity > available
            ? `<p class="muted">Доступно только ${available} шт.</p>`
            : ''}

          <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;">
            <button type="button" class="secondary"
              data-cart-minus="${escapeHTML(p.id)}">−</button>
            <strong>${quantity}</strong>
            <button type="button" class="secondary"
              data-cart-plus="${escapeHTML(p.id)}">+</button>
            <button type="button" class="secondary"
              data-cart-remove="${escapeHTML(p.id)}">Удалить</button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html;
  $('cartTotal').textContent = money(total);
  $('cartCountText').textContent = `${count} шт.`;
  $('cartSummary').hidden = false;
}

function renderDetail(id) {
  const p = findProduct(id);
  if (!p) return;

  currentDetailId = String(id);

  const photo = safePhoto(p.photo);
  const saved = favorites.includes(p.id);
  const quantity = Number(cart[p.id] || 0);

  $('detailView').innerHTML = `
    <div class="detail-photo">
      ${photo
        ? `<img src="${escapeHTML(photo)}"
            alt="${escapeHTML(p.name)}">`
        : 'Фото не добавлено'}
    </div>

    <h1>${escapeHTML(p.name)}</h1>
    <p class="muted">
      ${escapeHTML(p.description || 'Описание пока не добавлено.')}
    </p>
    <p class="detail-price">${money(p.price)}</p>

    <p class="muted">
      ${p.stock > 0
        ? `В наличии: ${p.stock} шт.`
        : 'Нет в наличии'}
    </p>

    <button class="primary"
      data-add-cart="${escapeHTML(p.id)}"
      ${p.stock <= 0 ? 'disabled' : ''}>
      ${p.stock <= 0 ? 'Нет в наличии' : 'Добавить в корзину'}
    </button>

    ${quantity > 0
      ? `<p class="muted">В корзине: ${quantity} шт.</p>`
      : ''}

    <button class="secondary" data-fav="${escapeHTML(p.id)}">
      ${saved
        ? '♥ Убрать из избранного'
        : '♡ Добавить в избранное'}
    </button>
  `;
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
  $('photo').disabled = busy;
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
          ? `<img src="${escapeHTML(p.photo)}" alt=""
              style="width:100%;height:100%;object-fit:cover;">`
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
  `).join('') ||
  empty('Товаров пока нет', 'Добавь первый товар через форму.');
}

function clearPreviewURL() {
  if (previewObjectURL) {
    URL.revokeObjectURL(previewObjectURL);
    previewObjectURL = '';
  }
}

function previewPhoto() {
  clearPreviewURL();

  const file = $('photo').files[0];

  if (file) {
    previewObjectURL = URL.createObjectURL(file);
    $('photoPreview').innerHTML = `
      <img src="${escapeHTML(previewObjectURL)}"
        alt="Предпросмотр"
        style="max-width:100%;max-height:180px;object-fit:contain;">`;
    return;
  }

  const photo = safePhoto($('imageUrl').value.trim());

  $('photoPreview').innerHTML = photo
    ? `<img src="${escapeHTML(photo)}"
        alt="Предпросмотр"
        style="max-width:100%;max-height:180px;object-fit:contain;">`
    : 'Фото пока нет';
}

function resetProductForm() {
  $('productForm').reset();
  $('editId').value = '';
  $('saveButton').textContent = 'Добавить товар';
  clearPreviewURL();
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
  $('photo').value = '';
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

  if ($('price').value.trim() === '' ||
      !Number.isFinite(price) || price < 0) {
    throw new Error('Укажи корректную цену.');
  }

  if ($('stock').value.trim() === '' ||
      !Number.isSafeInteger(stock) || stock < 0) {
    throw new Error('Остаток должен быть целым неотрицательным числом.');
  }

  if (!['new', 'popular', 'sale'].includes(category)) {
    throw new Error('Выбери категорию.');
  }

  if (rawPhoto && !imageUrl) {
    throw new Error('Укажи корректную HTTPS-ссылку.');
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

async function uploadProductPhoto(file) {
  if (!file) return null;

  const types = ['image/jpeg', 'image/png', 'image/webp'];

  if (!types.includes(file.type)) {
    throw new Error('Поддерживаются только JPG, PNG и WebP.');
  }

  if (file.size === 0 || file.size > MAX_PHOTO_SIZE) {
    throw new Error('Размер фотографии должен быть от 1 байта до 5 МБ.');
  }

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[file.type];

  const path = `catalog/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error('Не удалось получить ссылку на фотографию.');
  }

  return { url: data.publicUrl, path };
}

async function removeUploadedPhoto(path) {
  if (!path) return;

  const { error } = await db.storage
    .from(BUCKET)
    .remove([path]);

  if (error) console.warn('Ошибка очистки фотографии:', error);
}

$('productForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!isAdmin || adminBusy) return;

  setAdminBusy(true);
  setAdminStatus('Проверяем товар…');

  let newUpload = null;
  let saved = false;

  try {
    const payload = getProductPayload();
    const id = $('editId').value;
    const file = $('photo').files[0];

    if (file) {
      setAdminStatus('Загружаем фотографию…');
      newUpload = await uploadProductPhoto(file);
      payload.image_url = newUpload.url;
    }

    setAdminStatus('Сохраняем товар…');

    const query = id
      ? db.from('products').update(payload).eq('id', id)
      : db.from('products').insert(payload);

    const { error } = await query;
    if (error) throw error;

    saved = true;
    resetProductForm();

    await Promise.all([loadAdminProducts(), loadProducts()]);
    setAdminStatus('Товар успешно сохранён.');
  } catch (error) {
    console.error('Ошибка сохранения:', error);

    if (newUpload && !saved) {
      await removeUploadedPhoto(newUpload.path);
    }

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
    const { error } = await db.auth.signInWithPassword({ email, password });
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
$('photo').addEventListener('change', previewPhoto);
$('imageUrl').addEventListener('input', previewPhoto);

$('refreshAdmin').addEventListener('click', loadAdminProducts);

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-admin-edit]');
  if (edit) return editProduct(edit.dataset.adminEdit);

  const toggle = event.target.closest('[data-admin-toggle]');
  if (toggle) return togglePublished(toggle.dataset.adminToggle);

  const remove = event.target.closest('[data-admin-delete]');
  if (remove) return deleteProduct(remove.dataset.adminDelete);

  const add = event.target.closest('[data-add-cart]');
  if (add) return addToCart(add.dataset.addCart);

  const plus = event.target.closest('[data-cart-plus]');
  if (plus) return changeCartQuantity(plus.dataset.cartPlus, 1);

  const minus = event.target.closest('[data-cart-minus]');
  if (minus) return changeCartQuantity(minus.dataset.cartMinus, -1);

  const removeCart = event.target.closest('[data-cart-remove]');
  if (removeCart) return removeFromCart(removeCart.dataset.cartRemove);

  const favorite = event.target.closest('[data-fav]');
  if (favorite) return toggleFavorite(favorite.dataset.fav);

  const product = event.target.closest('[data-open]');
  if (product) return openDetail(product.dataset.open);

  const navigation = event.target.closest('[data-page]');
  if (navigation) {
    if (navigation.dataset.goFilter) {
      filter = navigation.dataset.goFilter;
      document.querySelectorAll('[data-filter]').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === filter);
      });
      render();
    }

    showPage(navigation.dataset.page);
    return;
  }

  const category = event.target.closest('[data-filter]');
  if (category) {
    filter = category.dataset.filter;

    document.querySelectorAll('[data-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === filter);
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

// Добавляем корзину в интерфейс без изменения index.html.

const cartSection = document.createElement('section');
cartSection.className = 'page';
cartSection.id = 'cart';

cartSection.innerHTML = `
  <div class="page-heading">
    <h1>Корзина</h1>
    <span class="muted">🛒</span>
  </div>

  <div id="cartItems"></div>

  <div id="cartSummary" hidden>
    <div class="section-title">
      <h2>Итого</h2>
      <strong id="cartTotal">0 ₽</strong>
    </div>
    <p class="muted" id="cartCountText"></p>
    <p class="muted">
      Корзина сохраняется на этом устройстве.
      Оформление заказа подключим позже.
    </p>
  </div>
`;

document.querySelector('main').appendChild(cartSection);

const nav = document.querySelector('.nav');
const cartButton = document.createElement('button');

cartButton.type = 'button';
cartButton.dataset.page = 'cart';
cartButton.innerHTML = `
  <span>🛒</span>
  Корзина
  <small class="cart-count" hidden>0</small>
`;

nav.appendChild(cartButton);

const cartStyle = document.createElement('style');
cartStyle.textContent = `
  .nav {
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .nav button {
    min-width: 0;
    font-size: 10px;
  }

  .cart-count {
    display: inline-block;
    font-size: 9px;
    color: #d7a6ff;
    margin-left: 2px;
  }

  .cart-count[hidden] {
    display: none;
  }

  #cartSummary {
    padding-bottom: 20px;
  }

  #cartSummary[hidden] {
    display: none;
  }

  #cartItems .secondary {
    min-height: 36px;
    padding: 7px 12px;
  }
`;
document.head.appendChild(cartStyle);

const user = tg?.initDataUnsafe?.user;

if (user) {
  $('profileName').textContent =
    user.first_name || user.username || 'Пользователь';
}

updateAdminUI();
loadProducts();
checkAdmin();
updateCartBadge();
