
'use strict';

// TURBAN SHOP 3.0
// Общий каталог Supabase + локальное избранное

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

const FAV_KEY = 'turban-demo-favorites-v2';

function readFavorites() {
  try {
    const data = JSON.parse(
      localStorage.getItem(FAV_KEY) || '[]'
    );

    return Array.isArray(data)
      ? data.map(String)
      : [];
  } catch {
    return [];
  }
}

let products = [];
let favorites = readFavorites();

let filter = 'all';
let currentPage = 'home';
let previousPage = 'catalog';
let loading = true;
let loadError = '';

const money = value =>
  Number(value).toLocaleString('ru-RU') + ' ₽';

function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char])
  );
}

function safePhoto(value) {
  if (typeof value !== 'string') return '';

  try {
    const url = new URL(value);

    return url.protocol === 'https:'
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function findProduct(id) {
  return products.find(
    p => p.id === String(id)
  );
}

function empty(title, description) {
  return `
    <div class="empty">
      <strong>${escapeHTML(title)}</strong>
      ${escapeHTML(description)}
    </div>
  `;
}

function showPage(page) {
  if (
    page === 'detail' &&
    currentPage !== 'detail'
  ) {
    previousPage = currentPage;
  }

  currentPage = page;

  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle(
      'active',
      el.id === page
    );
  });

  document.querySelectorAll('.nav button').forEach(el => {
    el.classList.toggle(
      'active',
      el.dataset.page === page
    );
  });

  if (page === 'favorites') {
    renderFavorites();
  }

  window.scrollTo(0, 0);
}

function productCard(p) {
  const saved = favorites.includes(p.id);
  const photo = safePhoto(p.photo);

  return `
    <article class="product">

      <div
        class="product-photo"
        data-open="${escapeHTML(p.id)}"
      >
        ${
          photo
            ? `<img
                src="${escapeHTML(photo)}"
                alt="${escapeHTML(p.name)}"
                loading="lazy"
              >`
            : '<span>ФОТО</span>'
        }

        <button
          class="favorite-btn ${saved ? 'saved' : ''}"
          data-fav="${escapeHTML(p.id)}"
          aria-label="Избранное"
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
    ? empty(
        'Загружаем каталог',
        'Подожди немного…'
      )
    : loadError
      ? empty(
          'Не удалось загрузить товары',
          loadError
        )
      : '';

  const newProducts = products
    .filter(p => p.category === 'new')
    .slice(0, 4);

  const popularProducts = products
    .filter(p => p.category === 'popular')
    .slice(0, 4);

  $('homeNew').innerHTML =
    status ||
    newProducts.map(productCard).join('') ||
    empty(
      'Новинок пока нет',
      'Они появятся после публикации.'
    );

  $('homePopular').innerHTML =
    status ||
    popularProducts.map(productCard).join('') ||
    empty(
      'Пока пусто',
      'Популярные товары появятся здесь.'
    );

  const query = $('search').value
    .trim()
    .toLocaleLowerCase('ru');

  const visible = products.filter(p => {
    const matchesCategory =
      filter === 'all' ||
      p.category === filter;

    const matchesSearch =
      `${p.name} ${p.description}`
        .toLocaleLowerCase('ru')
        .includes(query);

    return matchesCategory && matchesSearch;
  });

  $('catalogCount').textContent = loading
    ? 'Загрузка…'
    : `${visible.length} товаров`;

  $('catalogItems').innerHTML =
    status ||
    visible.map(productCard).join('') ||
    empty(
      'Каталог пока пуст',
      'Опубликованные товары появятся здесь.'
    );

  renderFavorites();
}

function renderFavorites() {
  const items = products.filter(
    p => favorites.includes(p.id)
  );

  $('favoriteItems').innerHTML = loading
    ? empty('Загрузка…', '')
    : items.map(productCard).join('') ||
      empty(
        'Здесь пока пусто',
        'Нажми ♡ на карточке товара.'
      );
}

function toggleFavorite(id) {
  id = String(id);

  if (favorites.includes(id)) {
    favorites = favorites.filter(
      item => item !== id
    );
  } else {
    favorites.push(id);
  }

  try {
    localStorage.setItem(
      FAV_KEY,
      JSON.stringify(favorites)
    );
  } catch (error) {
    console.warn(
      'Не удалось сохранить избранное',
      error
    );
  }

  render();

  if (currentPage === 'detail') {
    renderDetail(id);
  }
}

function renderDetail(id) {
  const p = findProduct(id);

  if (!p) return;

  const photo = safePhoto(p.photo);
  const saved = favorites.includes(p.id);

  $('detailView').innerHTML = `
    <div class="detail-photo">
      ${
        photo
          ? `<img
              src="${escapeHTML(photo)}"
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
      ${
        p.stock > 0
          ? `В наличии: ${p.stock} шт.`
          : 'Нет в наличии'
      }
    </p>

    <button
      class="primary"
      data-fav="${escapeHTML(p.id)}"
    >
      ${
        saved
          ? '♥ Убрать из избранного'
          : '♡ Добавить в избранное'
      }
    </button>
  `;
}

function openDetail(id) {
  if (!findProduct(id)) return;

  renderDetail(id);
  showPage('detail');
}

async function loadProducts() {
  loading = true;
  loadError = '';

  render();

  try {
    const endpoint =
      `${SUPABASE_URL}/rest/v1/products` +
      '?select=id,name,description,price,stock,category,image_url' +
      '&is_published=eq.true' +
      '&order=created_at.desc';

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка сервера: ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Неверный ответ базы данных');
    }

    products = data.map(row => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      price: Number(row.price ?? 0),
      stock: Number(row.stock ?? 0),
      category: String(row.category ?? 'new'),
      photo: safePhoto(row.image_url)
    }));

  } catch (error) {
    console.error('Supabase:', error);

    loadError =
      'Проверь подключение Supabase, Data API и RLS.';
  } finally {
    loading = false;
    render();
  }
}

document.addEventListener('click', event => {
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
    showPage(navigation.dataset.page);
    return;
  }

  const category = event.target.closest(
    '[data-filter]'
  );

  if (category) {
    filter = category.dataset.filter;

    document
      .querySelectorAll('[data-filter]')
      .forEach(button => {
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
  showPage(
    previousPage === 'detail'
      ? 'catalog'
      : previousPage
  );
});

$('about').addEventListener('click', () => {
  $('aboutText').textContent =
    'Turban Shop — демонстрационный каталог. ' +
    'Данные загружаются из Supabase.';
});

// Убираем публичный редактор товаров.
// Управление общей базой — через Supabase Dashboard.

$('adminShortcut').hidden = true;
$('adminShortcut').style.display = 'none';

$('admin').remove();

// Профиль Telegram

const user = tg?.initDataUnsafe?.user;

if (user) {
  $('profileName').textContent =
    user.first_name ||
    user.username ||
    'Пользователь';
}

// Запускаем загрузку каталога

loadProducts();
