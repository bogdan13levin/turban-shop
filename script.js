
'use strict';

// ========================================
// TURBAN SHOP 4.4 — FIXED
// ========================================

const SUPABASE_URL = 'https://tlrkdikpmcbfbcazwnae.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C_unMg0Kd-rF1BrxNj2vnA_i6v7FoOC';

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
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

let products = [];
let adminProducts = [];
let orders = [];
let orderItems = [];

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
let checkoutBusy = false;
let previewObjectURL = '';

const money = value =>
  Number(value).toLocaleString('ru-RU', {
    maximumFractionDigits: 2
  }) + ' ₽';

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

function empty(title, description = '') {
  return `
    <div class="empty">
      <strong>${escapeHTML(title)}</strong>
      ${description ? `<p>${escapeHTML(description)}</p>` : ''}
    </div>
  `;
}

function findProduct(id) {
  return products.find(p => p.id === String(id));
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

// ========================================
// СОЗДАНИЕ НОВЫХ ЭКРАНОВ
// ВАЖНО: выполняется ДО обработчиков
// ========================================

function createExtraPages() {
  const main = document.querySelector('main');
  const nav = document.querySelector('.nav');

  if (!main || !nav) {
    throw new Error('Не найдены main или .nav');
  }

  if (!$('cart')) {
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'cart';

    section.innerHTML = `
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
        <p class="muted" id="cartWarning"></p>

        <button
          class="primary"
          id="checkoutButton"
          type="button"
        >
          Оформить заказ
        </button>
      </div>
    `;

    main.appendChild(section);
  }

  if (!$('checkout')) {
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'checkout';

    section.innerHTML = `
      <button
        class="secondary"
        id="checkoutBack"
        type="button"
      >
        ← В корзину
      </button>

      <h1>Оформление заказа</h1>

      <div id="checkoutInfo"></div>

      <form class="form" id="checkoutForm">
        <label>
          Имя
          <input
            id="customerName"
            maxlength="100"
            placeholder="Как к тебе обращаться"
            required
          >
        </label>

        <label>
          Телефон
          <input
            id="customerPhone"
            type="tel"
            maxlength="30"
            placeholder="+7 999 123-45-67"
            required
          >
        </label>

        <label>
          Комментарий
          <textarea
            id="customerComment"
            maxlength="1000"
            placeholder="Дополнительная информация"
          ></textarea>
        </label>

        <p class="muted">
          Способ оплаты: при получении
        </p>

        <button
          class="primary"
          id="placeOrderButton"
          type="submit"
        >
          Подтвердить заказ
        </button>

        <p
          class="muted"
          id="checkoutStatus"
          aria-live="polite"
        ></p>
      </form>
    `;

    main.appendChild(section);
  }

  if (!$('orderSuccess')) {
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'orderSuccess';

    section.innerHTML = `
      <div style="text-align:center;padding:40px 12px;">
        <div style="font-size:52px;margin-bottom:20px;">
          ✓
        </div>

        <h1>Заказ оформлен!</h1>

        <p class="muted">Номер заказа</p>

        <h2 id="successOrderId"></h2>

        <p class="muted">
          Заказ сохранён. Оплата при получении.
        </p>

        <button
          class="primary"
          data-page="home"
          type="button"
        >
          На главную
        </button>
      </div>
    `;

    main.appendChild(section);
  }

  if (!$('ordersList')) {
    const section = document.createElement('div');

    section.innerHTML = `
      <div class="section-title">
        <h2>Заказы</h2>

        <button
          id="refreshOrders"
          class="secondary"
          type="button"
        >
          Обновить ↻
        </button>
      </div>

      <p class="muted" id="ordersCount">
        0 заказов
      </p>

      <p
        class="muted"
        id="ordersStatus"
        aria-live="polite"
      ></p>

      <div id="ordersList"></div>
    `;

    $('adminPanel').appendChild(section);
  }

  if (!nav.querySelector('[data-page="cart"]')) {
    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.page = 'cart';

    button.innerHTML = `
      <span>🛒</span>
      Корзина
      <small class="cart-count" hidden>0</small>
    `;

    nav.appendChild(button);
  }

  const style = document.createElement('style');

  style.textContent = `
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

    .cart-count[hidden],
    #cartSummary[hidden],
    #checkoutForm[hidden] {
      display: none !important;
    }

    #cartItems .secondary {
      min-height: 36px;
      padding: 7px 12px;
    }

    #checkoutForm {
      margin-top: 20px;
    }

    #checkoutForm label {
      display: block;
      margin-bottom: 14px;
    }

    #checkoutForm input,
    #checkoutForm textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 8px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #40354c;
      background: #17131e;
      color: white;
      font: inherit;
    }

    #checkoutForm textarea {
      min-height: 90px;
      resize: vertical;
    }

    #ordersList select {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      background: #17131e;
      color: white;
      border: 1px solid #40354c;
    }
  `;

  document.head.appendChild(style);
}

// Создаём экраны прямо сейчас
createExtraPages();

// ========================================
// НАВИГАЦИЯ
// ========================================

function showPage(page) {
  if (page === 'detail' && currentPage !== 'detail') {
    previousPage = currentPage;
  }

  currentPage = page;

  document.querySelectorAll('.page').forEach(element => {
    element.classList.toggle(
      'active',
      element.id === page
    );
  });

  document.querySelectorAll('.nav button').forEach(element => {
    element.classList.toggle(
      'active',
      element.dataset.page === page
    );
  });

  if (page === 'favorites') renderFavorites();
  if (page === 'cart') renderCart();
  if (page === 'checkout') renderCheckout();

  window.scrollTo(0, 0);
}

// ========================================
// КАТАЛОГ
// ========================================

function productCard(p) {
  const saved = favorites.includes(p.id);

  return `
    <article class="product">
      <div
        class="product-photo"
        data-open="${escapeHTML(p.id)}"
      >
        ${p.photo
          ? `<img
              src="${escapeHTML(p.photo)}"
              alt="${escapeHTML(p.name)}"
              loading="lazy"
            >`
          : '<span>ФОТО</span>'
        }

        <button
          class="favorite-btn ${saved ? 'saved' : ''}"
          data-fav="${escapeHTML(p.id)}"
          type="button"
        >
          ${saved ? '♥' : '♡'}
        </button>
      </div>

      <div
        class="product-info"
        data-open="${escapeHTML(p.id)}"
      >
        <div class="product-name">
          ${escapeHTML(p.name)}
        </div>

        <div class="product-description">
          ${escapeHTML(p.description)}
        </div>

        <div class="product-price">
          ${money(p.price)}
        </div>
      </div>
    </article>
  `;
}

function render() {
  const status = loading
    ? empty('Загружаем каталог', 'Подожди немного…')
    : loadError
      ? empty('Ошибка загрузки', loadError)
      : '';

  const sections = [
    ['homeNew', 'new', 'Новинок пока нет'],
    ['homePopular', 'popular', 'Популярных товаров пока нет'],
    ['homeSale', 'sale', 'Скидок пока нет']
  ];

  sections.forEach(([id, category, title]) => {
    const container = $(id);
    if (!container) return;

    const items = products
      .filter(p => p.category === category)
      .slice(0, 4);

    container.innerHTML =
      status ||
      items.map(productCard).join('') ||
      empty(title);
  });

  const search = ($('search')?.value || '')
    .trim()
    .toLocaleLowerCase('ru');

  const visible = products.filter(p => {
    const categoryMatches =
      filter === 'all' || p.category === filter;

    const searchMatches =
      `${p.name} ${p.description}`
        .toLocaleLowerCase('ru')
        .includes(search);

    return categoryMatches && searchMatches;
  });

  if ($('catalogCount')) {
    $('catalogCount').textContent = loading
      ? 'Загрузка…'
      : `${visible.length} товаров`;
  }

  if ($('catalogItems')) {
    $('catalogItems').innerHTML =
      status ||
      visible.map(productCard).join('') ||
      empty('Каталог пока пуст');
  }

  renderFavorites();
  renderCart();
  updateCartBadge();
}

function renderFavorites() {
  if (!$('favoriteItems')) return;

  const items = products.filter(p =>
    favorites.includes(p.id)
  );

  $('favoriteItems').innerHTML = loading
    ? empty('Загрузка…')
    : items.map(productCard).join('') ||
      empty(
        'Здесь пока пусто',
        'Нажми ♡ на карточке товара.'
      );
}

function toggleFavorite(id) {
  id = String(id);

  if (favorites.includes(id)) {
    favorites = favorites.filter(x => x !== id);
  } else {
    favorites.push(id);
  }

  try {
    localStorage.setItem(
      FAV_KEY,
      JSON.stringify(favorites)
    );
  } catch (error) {
    console.warn(error);
  }

  render();

  if (currentPage === 'detail') {
    renderDetail(currentDetailId);
  }
}

// ========================================
// КОРЗИНА
// ========================================

function saveCart() {
  try {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart)
    );
  } catch (error) {
    console.warn(error);
  }
}

function getCartEntries() {
  return Object.entries(cart)
    .map(([id, quantity]) => ({
      product: findProduct(id),
      quantity: Number(quantity)
    }))
    .filter(entry =>
      entry.product &&
      Number.isSafeInteger(entry.quantity) &&
      entry.quantity > 0
    );
}

function cleanCart() {
  if (loading || loadError) return;

  let changed = false;

  Object.keys(cart).forEach(id => {
    const product = findProduct(id);
    const quantity = Number(cart[id]);

    if (!product ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0) {
      delete cart[id];
      changed = true;
    }
  });

  if (changed) saveCart();
}

function cartCount() {
  return getCartEntries().reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );
}

function updateCartBadge() {
  const badge = document.querySelector('.cart-count');
  if (!badge) return;

  const count = cartCount();

  badge.textContent = count > 99
    ? '99+'
    : String(count);

  badge.hidden = count === 0;
}

function addToCart(id) {
  const product = findProduct(id);

  if (!product || product.stock <= 0) {
    alert('Товара нет в наличии.');
    return;
  }

  const current = Number(cart[product.id] || 0);

  if (current >= product.stock) {
    alert('Недостаточно товара в наличии.');
    return;
  }

  cart[product.id] = current + 1;

  saveCart();
  renderCart();
  updateCartBadge();

  if (currentPage === 'detail') {
    renderDetail(product.id);
  }
}

function changeCartQuantity(id, delta) {
  const product = findProduct(id);
  if (!product) return;

  const current = Number(cart[product.id] || 0);
  const next = current + delta;

  if (next <= 0) {
    delete cart[product.id];
  } else if (next <= product.stock) {
    cart[product.id] = next;
  } else {
    alert('Недостаточно товара в наличии.');
    return;
  }

  saveCart();
  renderCart();
  updateCartBadge();

  if (currentPage === 'detail') {
    renderDetail(product.id);
  }
}

function removeFromCart(id) {
  delete cart[String(id)];

  saveCart();
  renderCart();
  updateCartBadge();
}

function cartIsValid(entries) {
  return entries.length > 0 &&
    entries.length <= 20 &&
    entries.every(entry =>
      entry.quantity >= 1 &&
      entry.quantity <= 100 &&
      entry.quantity <= entry.product.stock
    );
}

function renderCart() {
  if (!$('cartItems')) return;

  if (loading) {
    $('cartItems').innerHTML =
      empty('Загрузка корзины…');
    return;
  }

  if (loadError) {
    $('cartItems').innerHTML =
      empty('Ошибка загрузки товаров', loadError);
    $('cartSummary').hidden = true;
    return;
  }

  cleanCart();

  const entries = getCartEntries();

  if (!entries.length) {
    $('cartItems').innerHTML = empty(
      'Корзина пуста',
      'Добавь товары из каталога.'
    );

    $('cartSummary').hidden = true;
    return;
  }

  let total = 0;

  $('cartItems').innerHTML = entries.map(
    ({ product: p, quantity }) => {
      total += p.price * quantity;

      return `
        <div
          class="profile"
          style="margin-bottom:12px;align-items:flex-start;"
        >
          <div
            class="avatar"
            style="overflow:hidden;flex-shrink:0;"
          >
            ${p.photo
              ? `<img
                  src="${escapeHTML(p.photo)}"
                  alt=""
                  style="width:100%;height:100%;object-fit:cover;"
                >`
              : '▦'
            }
          </div>

          <div style="flex:1;min-width:0;">
            <strong>${escapeHTML(p.name)}</strong>

            <p>${money(p.price)} за шт.</p>

            ${quantity > p.stock
              ? `<p class="muted">
                  Доступно: ${p.stock} шт.
                </p>`
              : ''
            }

            <div style="
              display:flex;
              align-items:center;
              gap:10px;
              margin-top:10px;
              flex-wrap:wrap;
            ">
              <button
                class="secondary"
                data-cart-minus="${p.id}"
                type="button"
              >−</button>

              <strong>${quantity}</strong>

              <button
                class="secondary"
                data-cart-plus="${p.id}"
                type="button"
              >+</button>

              <button
                class="secondary"
                data-cart-remove="${p.id}"
                type="button"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      `;
    }
  ).join('');

  $('cartTotal').textContent = money(total);
  $('cartCountText').textContent =
    `${cartCount()} шт.`;

  $('cartSummary').hidden = false;

  const valid = cartIsValid(entries);

  $('checkoutButton').disabled = !valid;

  $('cartWarning').textContent = valid
    ? ''
    : 'Проверь количество товаров и остатки.';
}

// ========================================
// КАРТОЧКА ТОВАРА
// ========================================

function renderDetail(id) {
  const p = findProduct(id);
  if (!p || !$('detailView')) return;

  currentDetailId = String(id);

  const saved = favorites.includes(p.id);
  const quantity = Number(cart[p.id] || 0);

  $('detailView').innerHTML = `
    <div class="detail-photo">
      ${p.photo
        ? `<img
            src="${escapeHTML(p.photo)}"
            alt="${escapeHTML(p.name)}"
          >`
        : 'Фото не добавлено'
      }
    </div>

    <h1>${escapeHTML(p.name)}</h1>

    <p class="muted">
      ${escapeHTML(
        p.description || 'Описание пока не добавлено.'
      )}
    </p>

    <p class="detail-price">
      ${money(p.price)}
    </p>

    <p class="muted">
      ${p.stock > 0
        ? `В наличии: ${p.stock} шт.`
        : 'Нет в наличии'
      }
    </p>

    <button
      class="primary"
      data-add-cart="${p.id}"
      type="button"
      ${p.stock <= 0 ? 'disabled' : ''}
    >
      ${p.stock <= 0
        ? 'Нет в наличии'
        : 'Добавить в корзину'
      }
    </button>

    ${quantity > 0
      ? `<p class="muted">
          В корзине: ${quantity} шт.
        </p>`
      : ''
    }

    <button
      class="secondary"
      data-fav="${p.id}"
      type="button"
    >
      ${saved
        ? '♥ Убрать из избранного'
        : '♡ В избранное'
      }
    </button>
  `;
}

function openDetail(id) {
  if (!findProduct(id)) return;

  renderDetail(id);
  showPage('detail');
}

// ========================================
// ЗАГРУЗКА ТОВАРОВ
// ========================================

async function loadProducts() {
  loading = true;
  loadError = '';
  render();

  try {
    const { data, error } = await db
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        stock,
        category,
        image_url,
        is_published
      `)
      .eq('is_published', true)
      .order('created_at', {
        ascending: false
      });

    if (error) throw error;

    products = (data || []).map(normalizeProduct);
  } catch (error) {
    console.error('Ошибка каталога:', error);

    loadError =
      error.message || 'Проверь подключение Supabase.';
  } finally {
    loading = false;
    cleanCart();
    render();
  }
}

// ========================================
// ОФОРМЛЕНИЕ ЗАКАЗА
// ========================================

function renderCheckout() {
  const entries = getCartEntries();

  $('checkoutStatus').textContent = '';

  if (!cartIsValid(entries)) {
    $('checkoutInfo').innerHTML = empty(
      'Корзина требует проверки',
      'Вернись в корзину и проверь остатки.'
    );

    $('checkoutForm').hidden = true;
    return;
  }

  $('checkoutForm').hidden = false;

  const total = entries.reduce(
    (sum, entry) =>
      sum + entry.product.price * entry.quantity,
    0
  );

  $('checkoutInfo').innerHTML = `
    <div class="profile">
      <div>
        <strong>
          ${entries.length} позиций
        </strong>

        <p>
          Предварительная сумма: ${money(total)}
        </p>

        <p class="muted">
          Оплата при получении
        </p>
      </div>
    </div>
  `;
}

async function submitCheckout(event) {
  event.preventDefault();

  if (checkoutBusy) return;

  const entries = getCartEntries();

  if (!cartIsValid(entries)) {
    $('checkoutStatus').textContent =
      'Проверь количество товаров в корзине.';
    return;
  }

  const name = $('customerName').value.trim();
  const phone = $('customerPhone').value.trim();
  const comment = $('customerComment').value.trim();

  if (name.length < 2 || name.length > 100) {
    $('checkoutStatus').textContent =
      'Укажи имя от 2 до 100 символов.';
    return;
  }

  if (!/^[+0-9 ()-]{7,30}$/.test(phone)) {
    $('checkoutStatus').textContent =
      'Укажи корректный номер телефона.';
    return;
  }

  checkoutBusy = true;

  $('placeOrderButton').disabled = true;
  $('checkoutStatus').textContent =
    'Отправляем заказ…';

  try {
    const items = entries.map(entry => ({
      id: Number(entry.product.id),
      quantity: entry.quantity
    }));

    const { data, error } = await db.rpc(
      'create_shop_order',
      {
        p_name: name,
        p_phone: phone,
        p_comment: comment,
        p_items: items
      }
    );

    if (error) throw error;

    const orderId = data;

    cart = {};
    saveCart();
    updateCartBadge();

    $('checkoutForm').reset();

    $('successOrderId').textContent =
      `№ ${orderId}`;

    showPage('orderSuccess');

    await loadProducts();

    if (isAdmin) {
      await loadOrders();
    }
  } catch (error) {
    console.error('Ошибка заказа:', error);

    $('checkoutStatus').textContent =
      'Не удалось оформить заказ: ' +
      (error.message || 'Попробуй ещё раз.');
  } finally {
    checkoutBusy = false;
    $('placeOrderButton').disabled = false;
  }
}

// ========================================
// АДМИНКА — АВТОРИЗАЦИЯ
// ========================================

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

    if (userError || !userData.user) {
      return false;
    }

    const { data, error } = await db
      .from('admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) throw error;

    isAdmin = Boolean(data);

    updateAdminUI(
      isAdmin ? userData.user.email : ''
    );

    if (isAdmin) {
      await Promise.all([
        loadAdminProducts(),
        loadOrders()
      ]);
    }

    return isAdmin;
  } catch (error) {
    console.error(error);

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

// ========================================
// АДМИНКА — ТОВАРЫ
// ========================================

async function loadAdminProducts() {
  if (!isAdmin) return;

  $('adminList').innerHTML =
    empty('Загрузка товаров…');

  try {
    const { data, error } = await db
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        stock,
        category,
        image_url,
        is_published
      `)
      .order('created_at', {
        ascending: false
      });

    if (error) throw error;

    adminProducts =
      (data || []).map(normalizeProduct);

    renderAdminProducts();
  } catch (error) {
    console.error(error);

    $('adminList').innerHTML =
      empty('Ошибка загрузки товаров');
  }
}

function renderAdminProducts() {
  $('adminList').innerHTML =
    adminProducts.map(p => `
      <div
        class="profile"
        style="margin-bottom:12px;align-items:flex-start;"
      >
        <div
          class="avatar"
          style="overflow:hidden;flex-shrink:0;"
        >
          ${p.photo
            ? `<img
                src="${escapeHTML(p.photo)}"
                alt=""
                style="width:100%;height:100%;object-fit:cover;"
              >`
            : '▦'
          }
        </div>

        <div style="flex:1;min-width:0;">
          <strong>
            ${escapeHTML(p.name)}
          </strong>

          <p>
            ${money(p.price)}
            · Остаток: ${p.stock}
          </p>

          <p class="muted">
            ${p.isPublished
              ? '● Опубликован'
              : '○ Скрыт'
            }
          </p>

          <div style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            margin-top:10px;
          ">
            <button
              class="secondary"
              data-admin-edit="${p.id}"
              type="button"
            >
              Изменить
            </button>

            <button
              class="secondary"
              data-admin-toggle="${p.id}"
              type="button"
            >
              ${p.isPublished
                ? 'Скрыть'
                : 'Опубликовать'
              }
            </button>

            <button
              class="secondary"
              data-admin-delete="${p.id}"
              type="button"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    `).join('') ||
    empty('Товаров пока нет');
}

// ========================================
// АДМИНКА — ЗАКАЗЫ
// ========================================

const STATUS_LABELS = {
  new: 'Новый',
  processing: 'В обработке',
  completed: 'Выполнен',
  cancelled: 'Отменён'
};

async function loadOrders() {
  if (!isAdmin) return;

  $('ordersList').innerHTML =
    empty('Загружаем заказы…');

  try {
    const [ordersResult, itemsResult] =
      await Promise.all([
        db.from('orders')
          .select(`
            id,
            created_at,
            customer_name,
            customer_phone,
            customer_comment,
            total,
            status
          `)
          .order('created_at', {
            ascending: false
          })
          .limit(100),

        db.from('order_items')
          .select(`
            order_id,
            product_name,
            quantity,
            unit_price,
            subtotal
          `)
          .order('id', {
            ascending: false
          })
          .limit(2000)
      ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    orders = ordersResult.data || [];
    orderItems = itemsResult.data || [];

    renderOrders();
  } catch (error) {
    console.error('Ошибка заказов:', error);

    $('ordersList').innerHTML = empty(
      'Не удалось загрузить заказы',
      error.message || 'Проверь права доступа.'
    );
  }
}

function renderOrders() {
  $('ordersCount').textContent =
    `${orders.length} заказов`;

  $('ordersList').innerHTML =
    orders.map(order => {
      const items = orderItems.filter(item =>
        String(item.order_id) === String(order.id)
      );

      const date = new Date(
        order.created_at
      ).toLocaleString('ru-RU');

      const canChange =
        order.status !== 'cancelled';

      return `
        <div
          class="profile"
          style="
            display:block;
            margin-bottom:14px;
            padding:16px;
          "
        >
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
          ">
            <strong>
              Заказ № ${order.id}
            </strong>

            <span class="muted">
              ${escapeHTML(
                STATUS_LABELS[order.status] ||
                order.status
              )}
            </span>
          </div>

          <p class="muted">
            ${escapeHTML(date)}
          </p>

          <p>
            <strong>Покупатель:</strong>
            ${escapeHTML(order.customer_name)}
          </p>

          <p>
            <strong>Телефон:</strong>
            ${escapeHTML(order.customer_phone)}
          </p>

          ${order.customer_comment
            ? `<p>
                <strong>Комментарий:</strong>
                ${escapeHTML(order.customer_comment)}
              </p>`
            : ''
          }

          <div style="margin:12px 0;">
            ${items.map(item => `
              <p>
                ${escapeHTML(item.product_name)}
                × ${item.quantity}
                — ${money(item.subtotal)}
              </p>
            `).join('')}
          </div>

          <strong>
            Итого: ${money(order.total)}
          </strong>

          <p class="muted">
            Оплата при получении
          </p>

          ${canChange
            ? `<label style="
                display:block;
                margin-top:12px;
              ">
                Статус заказа

                <select
                  data-order-status="${order.id}"
                  style="margin-top:8px;"
                >
                  ${Object.entries(
                    STATUS_LABELS
                  ).map(([value, label]) => `
                    <option
                      value="${value}"
                      ${order.status === value
                        ? 'selected'
                        : ''
                      }
                    >
                      ${label}
                    </option>
                  `).join('')}
                </select>
              </label>`
            : ''
          }
        </div>
      `;
    }).join('') ||
    empty('Заказов пока нет');
}

async function changeOrderStatus(id, status) {
  if (!isAdmin || adminBusy) return;

  const order = orders.find(
    x => String(x.id) === String(id)
  );

  if (!order || order.status === status) return;

  if (status === 'cancelled') {
    const confirmed = confirm(
      `Отменить заказ № ${id} и вернуть товары на склад?`
    );

    if (!confirmed) {
      renderOrders();
      return;
    }
  }

  setAdminBusy(true);

  $('ordersStatus').textContent =
    'Обновляем заказ…';

  try {
    const { error } = await db.rpc(
      'update_shop_order_status',
      {
        p_order_id: Number(id),
        p_status: status
      }
    );

    if (error) throw error;

    await Promise.all([
      loadOrders(),
      loadAdminProducts(),
      loadProducts()
    ]);

    $('ordersStatus').textContent =
      'Статус заказа обновлён.';
  } catch (error) {
    console.error(error);

    $('ordersStatus').textContent =
      'Ошибка: ' +
      (error.message || 'Не удалось изменить статус.');

    renderOrders();
  } finally {
    setAdminBusy(false);
  }
}

// ========================================
// ФОТОГРАФИИ ТОВАРОВ
// ========================================

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
      <img
        src="${escapeHTML(previewObjectURL)}"
        alt="Предпросмотр"
        style="
          max-width:100%;
          max-height:180px;
          object-fit:contain;
        "
      >
    `;

    return;
  }

  const photo = safePhoto(
    $('imageUrl').value.trim()
  );

  $('photoPreview').innerHTML = photo
    ? `<img
        src="${escapeHTML(photo)}"
        alt="Предпросмотр"
        style="
          max-width:100%;
          max-height:180px;
          object-fit:contain;
        "
      >`
    : 'Фото пока нет';
}

function resetProductForm() {
  $('productForm').reset();

  $('editId').value = '';
  $('saveButton').textContent =
    'Добавить товар';

  clearPreviewURL();

  $('photoPreview').textContent =
    'Фото пока нет';

  setAdminStatus('');
}

function editProduct(id) {
  const p = adminProducts.find(
    x => x.id === String(id)
  );

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

  $('saveButton').textContent =
    'Сохранить изменения';

  setAdminStatus(
    'Редактирование: ' + p.name
  );

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

  const rawPhoto =
    $('imageUrl').value.trim();

  const imageUrl = safePhoto(rawPhoto);

  if (!name || name.length > 100) {
    throw new Error(
      'Название должно содержать до 100 символов.'
    );
  }

  if (
    $('price').value.trim() === '' ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    throw new Error('Укажи корректную цену.');
  }

  if (
    $('stock').value.trim() === '' ||
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    throw new Error('Укажи корректный остаток.');
  }

  if (
    !['new', 'popular', 'sale'].includes(category)
  ) {
    throw new Error('Выбери категорию.');
  }

  if (rawPhoto && !imageUrl) {
    throw new Error(
      'Укажи корректную HTTPS-ссылку.'
    );
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

  const types = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!types.includes(file.type)) {
    throw new Error(
      'Поддерживаются JPG, PNG и WebP.'
    );
  }

  if (
    file.size === 0 ||
    file.size > MAX_PHOTO_SIZE
  ) {
    throw new Error(
      'Фото должно быть не больше 5 МБ.'
    );
  }

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[file.type];

  const path =
    `catalog/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = db.storage
    .from(BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error(
      'Не удалось получить ссылку на фото.'
    );
  }

  return {
    url: data.publicUrl,
    path
  };
}

async function removeUploadedPhoto(path) {
  if (!path) return;

  const { error } = await db.storage
    .from(BUCKET)
    .remove([path]);

  if (error) console.warn(error);
}

async function submitProduct(event) {
  event.preventDefault();

  if (!isAdmin || adminBusy) return;

  setAdminBusy(true);
  setAdminStatus('Сохраняем товар…');

  let upload = null;
  let saved = false;

  try {
    const payload = getProductPayload();
    const id = $('editId').value;
    const file = $('photo').files[0];

    if (file) {
      setAdminStatus('Загружаем фото…');

      upload = await uploadProductPhoto(file);
      payload.image_url = upload.url;
    }

    const query = id
      ? db.from('products')
          .update(payload)
          .eq('id', id)
      : db.from('products')
          .insert(payload);

    const { error } = await query;

    if (error) throw error;

    saved = true;

    resetProductForm();

    await Promise.all([
      loadAdminProducts(),
      loadProducts()
    ]);

    setAdminStatus('Товар сохранён.');
  } catch (error) {
    console.error(error);

    if (upload && !saved) {
      await removeUploadedPhoto(upload.path);
    }

    setAdminStatus(
      'Ошибка: ' + error.message
    );
  } finally {
    setAdminBusy(false);
  }
}

async function togglePublished(id) {
  if (!isAdmin || adminBusy) return;

  const p = adminProducts.find(
    x => x.id === String(id)
  );

  if (!p) return;

  setAdminBusy(true);

  try {
    const { error } = await db
      .from('products')
      .update({
        is_published: !p.isPublished
      })
      .eq('id', p.id);

    if (error) throw error;

    await Promise.all([
      loadAdminProducts(),
      loadProducts()
    ]);

    setAdminStatus(
      'Публикация обновлена.'
    );
  } catch (error) {
    console.error(error);

    setAdminStatus(
      'Ошибка: ' + error.message
    );
  } finally {
    setAdminBusy(false);
  }
}

async function deleteProduct(id) {
  if (!isAdmin || adminBusy) return;

  const p = adminProducts.find(
    x => x.id === String(id)
  );

  if (!p) return;

  if (!confirm(`Удалить товар «${p.name}»?`)) {
    return;
  }

  setAdminBusy(true);

  try {
    const { error } = await db
      .from('products')
      .delete()
      .eq('id', p.id);

    if (error) throw error;

    if ($('editId').value === p.id) {
      resetProductForm();
    }

    await Promise.all([
      loadAdminProducts(),
      loadProducts()
    ]);

    setAdminStatus('Товар удалён.');
  } catch (error) {
    console.error(error);

    setAdminStatus(
      'Ошибка: ' + error.message
    );
  } finally {
    setAdminBusy(false);
  }
}

// ========================================
// ВХОД / ВЫХОД
// ========================================

async function submitLogin(event) {
  event.preventDefault();

  const email =
    $('adminEmail').value.trim();

  const password =
    $('adminPassword').value;

  const button = $('loginButton');

  button.disabled = true;

  $('loginStatus').textContent =
    'Проверяем данные…';

  try {
    const { error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    const allowed = await checkAdmin();

    if (!allowed) {
      await db.auth.signOut();

      $('loginStatus').textContent =
        'Нет прав администратора.';

      return;
    }

    $('adminPassword').value = '';
    $('loginStatus').textContent = '';
  } catch (error) {
    console.error(error);

    $('loginStatus').textContent =
      'Ошибка входа.';
  } finally {
    button.disabled = false;
  }
}

async function logoutAdmin() {
  await db.auth.signOut();

  isAdmin = false;
  adminProducts = [];
  orders = [];
  orderItems = [];

  updateAdminUI();
  resetProductForm();

  $('adminList').innerHTML = '';
  $('ordersList').innerHTML = '';

  $('adminPassword').value = '';
  $('loginStatus').textContent = '';

  await loadProducts();
}

// ========================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// Все элементы уже созданы
// ========================================

$('checkoutForm').addEventListener(
  'submit',
  submitCheckout
);

$('productForm').addEventListener(
  'submit',
  submitProduct
);

$('loginForm').addEventListener(
  'submit',
  submitLogin
);

$('checkoutButton').addEventListener(
  'click',
  () => showPage('checkout')
);

$('checkoutBack').addEventListener(
  'click',
  () => showPage('cart')
);

$('refreshOrders').addEventListener(
  'click',
  loadOrders
);

$('logoutButton').addEventListener(
  'click',
  logoutAdmin
);

$('adminShortcut').addEventListener(
  'click',
  async () => {
    showPage('admin');
    await checkAdmin();
  }
);

$('resetForm').addEventListener(
  'click',
  resetProductForm
);

$('photo').addEventListener(
  'change',
  previewPhoto
);

$('imageUrl').addEventListener(
  'input',
  previewPhoto
);

$('refreshAdmin').addEventListener(
  'click',
  loadAdminProducts
);

$('search').addEventListener(
  'input',
  render
);

$('back').addEventListener(
  'click',
  () => {
    showPage(
      previousPage === 'detail'
        ? 'catalog'
        : previousPage
    );
  }
);

$('about').addEventListener(
  'click',
  () => {
    $('aboutText').textContent =
      'Turban Shop — каталог товаров с оплатой при получении.';
  }
);

// Клики по динамическим элементам

document.addEventListener('click', event => {
  const edit = event.target.closest(
    '[data-admin-edit]'
  );

  if (edit) {
    editProduct(edit.dataset.adminEdit);
    return;
  }

  const toggle = event.target.closest(
    '[data-admin-toggle]'
  );

  if (toggle) {
    togglePublished(toggle.dataset.adminToggle);
    return;
  }

  const remove = event.target.closest(
    '[data-admin-delete]'
  );

  if (remove) {
    deleteProduct(remove.dataset.adminDelete);
    return;
  }

  const add = event.target.closest(
    '[data-add-cart]'
  );

  if (add) {
    addToCart(add.dataset.addCart);
    return;
  }

  const plus = event.target.closest(
    '[data-cart-plus]'
  );

  if (plus) {
    changeCartQuantity(
      plus.dataset.cartPlus,
      1
    );
    return;
  }

  const minus = event.target.closest(
    '[data-cart-minus]'
  );

  if (minus) {
    changeCartQuantity(
      minus.dataset.cartMinus,
      -1
    );
    return;
  }

  const removeCart = event.target.closest(
    '[data-cart-remove]'
  );

  if (removeCart) {
    removeFromCart(
      removeCart.dataset.cartRemove
    );
    return;
  }

  const favorite = event.target.closest(
    '[data-fav]'
  );

  if (favorite) {
    toggleFavorite(favorite.dataset.fav);
    return;
  }

  const product = event.target.closest(
    '[data-open]'
  );

  if (product) {
    openDetail(product.dataset.open);
    return;
  }

  const navigation = event.target.closest(
    '[data-page]'
  );

  if (navigation) {
    if (navigation.dataset.goFilter) {
      filter = navigation.dataset.goFilter;

      document.querySelectorAll(
        '[data-filter]'
      ).forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.filter === filter
        );
      });

      render();
    }

    showPage(navigation.dataset.page);
    return;
  }

  const category = event.target.closest(
    '[data-filter]'
  );

  if (category) {
    filter = category.dataset.filter;

    document.querySelectorAll(
      '[data-filter]'
    ).forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.filter === filter
      );
    });

    render();
    showPage('catalog');
  }
});

// Изменение статуса заказа

document.addEventListener('change', event => {
  const select = event.target.closest(
    '[data-order-status]'
  );

  if (!select) return;

  changeOrderStatus(
    select.dataset.orderStatus,
    select.value
  );
});

// ========================================
// TELEGRAM
// ========================================

const user = tg?.initDataUnsafe?.user;

if (user && $('profileName')) {
  $('profileName').textContent =
    user.first_name ||
    user.username ||
    'Пользователь';
}

// ========================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ========================================

updateAdminUI();
loadProducts();
checkAdmin();
updateCartBadge();

console.log('Turban Shop 4.4 FIXED запущен');

/* ==========================================
   TURBAN SHOP 4.6 — АРХИВ ЗАКАЗОВ
   ========================================== */

let orderArchiveTab = 'active';
let orderArchiveBusy = false;

// Добавляем вкладки в админку
function setupOrderArchive() {
  if (document.getElementById('orderArchiveTabs')) return;

  const list = document.getElementById('ordersList');
  if (!list) return;

  const tabs = document.createElement('div');
  tabs.id = 'orderArchiveTabs';

  tabs.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 16px 0;
  `;

  tabs.innerHTML = `
    <button
      type="button"
      class="secondary"
      data-archive-tab="active"
    >
      📦 Активные
    </button>

    <button
      type="button"
      class="secondary"
      data-archive-tab="archive"
    >
      🗂 Архив
    </button>
  `;

  list.parentNode.insertBefore(tabs, list);
}

// Обновляем оформление вкладок
function updateArchiveTabs() {
  document.querySelectorAll('[data-archive-tab]')
    .forEach(button => {
      const active =
        button.dataset.archiveTab === orderArchiveTab;

      button.style.border = active
        ? '2px solid #a855f7'
        : '1px solid #40354c';

      button.style.fontWeight = active
        ? '700'
        : '400';
    });
}

// Сохраняем оригинальный рендер заказов
const renderOrdersOriginal46 = renderOrders;

// Добавляем фильтрацию и кнопки
renderOrders = function () {
  setupOrderArchive();
  updateArchiveTabs();

  const allOrders = orders;

  const visibleOrders = allOrders.filter(order =>
    orderArchiveTab === 'archive'
      ? order.is_archived === true
      : order.is_archived !== true
  );

  orders = visibleOrders;

  try {
    renderOrdersOriginal46();

    const cards = document.querySelectorAll(
      '#ordersList > .profile'
    );

    cards.forEach((card, index) => {
      const order = visibleOrders[index];
      if (!order) return;

      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'secondary';
      button.dataset.archiveOrder = String(order.id);
      button.dataset.archiveAction =
        orderArchiveTab === 'archive'
          ? 'restore'
          : 'archive';

      button.textContent =
        orderArchiveTab === 'archive'
          ? '↩ Восстановить заказ'
          : '🗂 Перенести в архив';

      button.style.cssText = `
        width: 100%;
        margin-top: 14px;
        padding: 12px;
      `;

      button.disabled = orderArchiveBusy;
      card.appendChild(button);
    });

    if (document.getElementById('ordersCount')) {
      document.getElementById('ordersCount').textContent =
        orderArchiveTab === 'archive'
          ? `В архиве: ${visibleOrders.length}`
          : `Активных заказов: ${visibleOrders.length}`;
    }

    if (!visibleOrders.length) {
      document.getElementById('ordersList').innerHTML =
        orderArchiveTab === 'archive'
          ? empty('Архив пуст', 'Здесь будут архивные заказы.')
          : empty('Активных заказов пока нет');
    }
  } finally {
    orders = allOrders;
  }
};

// Загружаем заказы с полем is_archived
loadOrders = async function () {
  if (!isAdmin) return;

  const list = document.getElementById('ordersList');
  if (!list) return;

  list.innerHTML = empty('Загружаем заказы…');

  try {
    const ordersResult = await db
      .from('orders')
      .select(`
        id,
        created_at,
        customer_name,
        customer_phone,
        customer_comment,
        total,
        status,
        is_archived
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ordersResult.error) throw ordersResult.error;

    const loadedOrders = ordersResult.data || [];

    let loadedItems = [];

    if (loadedOrders.length) {
      const itemsResult = await db
        .from('order_items')
        .select(`
          order_id,
          product_name,
          quantity,
          unit_price,
          subtotal
        `)
        .in(
          'order_id',
          loadedOrders.map(order => order.id)
        )
        .order('id', { ascending: false })
        .limit(2000);

      if (itemsResult.error) throw itemsResult.error;

      loadedItems = itemsResult.data || [];
    }

    orders = loadedOrders;
    orderItems = loadedItems;

    renderOrders();
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error);

    list.innerHTML = empty(
      'Не удалось загрузить заказы',
      error.message || 'Проверь подключение Supabase.'
    );
  }
};

// Архивирование и восстановление
async function changeOrderArchive(id, archive) {
  if (!isAdmin || adminBusy || orderArchiveBusy) return;

  const order = orders.find(
    item => String(item.id) === String(id)
  );

  if (!order) return;

  const action = archive
    ? 'Перенести в архив'
    : 'Восстановить';

  const confirmed = confirm(
    `${action} заказ №${id}?`
  );

  if (!confirmed) return;

  orderArchiveBusy = true;
  setAdminBusy(true);

  const status = document.getElementById('ordersStatus');

  if (status) {
    status.textContent = archive
      ? 'Архивируем заказ…'
      : 'Восстанавливаем заказ…';
  }

  try {
    const { error } = await db.rpc(
      'set_order_archived',
      {
        p_order_id: Number(id),
        p_archived: archive
      }
    );

    if (error) throw error;

    await loadOrders();

    if (status) {
      status.textContent = archive
        ? `Заказ №${id} перемещён в архив.`
        : `Заказ №${id} восстановлен.`;
    }
  } catch (error) {
    console.error('Ошибка архива:', error);

    if (status) {
      status.textContent =
        'Ошибка: ' +
        (error.message || 'Не удалось обновить заказ.');
    }

    renderOrders();
  } finally {
    orderArchiveBusy = false;
    setAdminBusy(false);
  }
}

// Переключение вкладок и кнопки заказов
document.addEventListener('click', event => {
  const tab = event.target.closest('[data-archive-tab]');

  if (tab) {
    orderArchiveTab = tab.dataset.archiveTab;
    renderOrders();
    return;
  }

  const button = event.target.closest(
    '[data-archive-order]'
  );

  if (button) {
    changeOrderArchive(
      button.dataset.archiveOrder,
      button.dataset.archiveAction === 'archive'
    );
  }
});

setupOrderArchive();

console.log('Turban Shop 4.6 — архив заказов подключён');
