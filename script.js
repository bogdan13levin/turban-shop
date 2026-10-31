
'use strict';

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const $ = id => document.getElementById(id);

const STORAGE_PRODUCTS = 'turban-demo-products-v2';
const STORAGE_FAV = 'turban-demo-favorites-v2';

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let products = read(STORAGE_PRODUCTS);
let favorites = read(STORAGE_FAV);
let filter = 'all';
let currentPage = 'home';
let previousPage = 'catalog';
let currentDetailId = null;
let editingPhoto = '';

const money = value =>
  Number(value).toLocaleString('ru-RU') + ' ₽';

const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

const findProduct = id =>
  products.find(p => String(p.id) === String(id));

function save() {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  localStorage.setItem(STORAGE_FAV, JSON.stringify(favorites));
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
  if (page === 'detail' && currentPage !== 'detail') {
    previousPage = currentPage;
  }

  currentPage = page;

  document.querySelectorAll('.page').forEach(element => {
    element.classList.toggle('active', element.id === page);
  });

  document.querySelectorAll('.nav button').forEach(element => {
    element.classList.toggle(
      'active',
      element.dataset.page === page
    );
  });

  if (page === 'admin') renderAdmin();
  if (page === 'favorites') renderFavorites();

  window.scrollTo(0, 0);
}

function productCard(p) {
  const saved = favorites.some(
    id => String(id) === String(p.id)
  );

  return `
    <article class="product">
      <div class="product-photo" data-open="${escapeHTML(p.id)}">
        ${
          p.photo
            ? `<img src="${p.photo}" alt="${escapeHTML(p.name)}" loading="lazy">`
            : '<span>ФОТО</span>'
        }

        <button
          class="favorite-btn ${saved ? 'saved' : ''}"
          data-fav="${escapeHTML(p.id)}"
          aria-label="Избранное"
        >${saved ? '♥' : '♡'}</button>
      </div>

      <div class="product-info" data-open="${escapeHTML(p.id)}">
        <div class="product-name">
          ${escapeHTML(p.name)}
        </div>

        <div class="product-description">
          ${escapeHTML(p.description || '')}
        </div>

        <div class="product-price">
          ${money(p.price)}
        </div>
      </div>
    </article>
  `;
}

function render() {
  const newProducts = products
    .filter(p => p.category === 'new')
    .slice(0, 4);

  const popularProducts = products
    .filter(p => p.category === 'popular')
    .slice(0, 4);

  $('homeNew').innerHTML = newProducts.length
    ? newProducts.map(productCard).join('')
    : empty(
        'Новинок пока нет',
        'Товары появятся после добавления.'
      );

  $('homePopular').innerHTML = popularProducts.length
    ? popularProducts.map(productCard).join('')
    : empty(
        'Пока пусто',
        'Популярные товары появятся здесь.'
      );

  const query = $('search').value
    .trim()
    .toLocaleLowerCase('ru');

  const visible = products.filter(p => {
    const matchesCategory =
      filter === 'all' || p.category === filter;

    const matchesSearch =
      `${p.name} ${p.description || ''}`
        .toLocaleLowerCase('ru')
        .includes(query);

    return matchesCategory && matchesSearch;
  });

  $('catalogCount').textContent =
    `${visible.length} товаров`;

  $('catalogItems').innerHTML = visible.length
    ? visible.map(productCard).join('')
    : empty(
        'Каталог пока пуст',
        'Добавь демонстрационные товары в локальной админ-панели.'
      );

  renderFavorites();
}

function renderFavorites() {
  const items = products.filter(p =>
    favorites.some(id => String(id) === String(p.id))
  );

  $('favoriteItems').innerHTML = items.length
    ? items.map(productCard).join('')
    : empty(
        'Здесь пока пусто',
        'Нажми ♡ на карточке, чтобы сохранить товар.'
      );
}

function toggleFavorite(id) {
  const exists = favorites.some(
    item => String(item) === String(id)
  );

  favorites = exists
    ? favorites.filter(item => String(item) !== String(id))
    : [...favorites, id];

  try {
    save();
  } catch {
    alert('Не удалось сохранить избранное.');
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

  const saved = favorites.some(
    item => String(item) === String(id)
  );

  $('detailView').innerHTML = `
    <div class="detail-photo">
      ${
        p.photo
          ? `<img src="${p.photo}" alt="${escapeHTML(p.name)}">`
          : 'Фото не добавлено'
      }
    </div>

    <h1>${escapeHTML(p.name)}</h1>

    <p class="muted">
      ${escapeHTML(p.description || 'Описание пока не добавлено.')}
    </p>

    <p class="detail-price">${money(p.price)}</p>

    <p class="muted">
      ${Number(p.stock) > 0
        ? `В наличии: ${Number(p.stock)} шт.`
        : 'Нет в наличии'}
    </p>

    <button class="primary" data-fav="${escapeHTML(p.id)}">
      ${saved ? '♥ Убрать из избранного' : '♡ Добавить в избранное'}
    </button>
  `;
}

function openDetail(id) {
  if (!findProduct(id)) return;
  renderDetail(id);
  showPage('detail');
}

function renderAdmin() {
  $('adminList').innerHTML = products.length
    ? products.map(p => `
      <div class="admin-item">
        ${
          p.photo
            ? `<img src="${p.photo}" alt="">`
            : '<span>◈</span>'
        }

        <div class="grow">
          <b>${escapeHTML(p.name)}</b>
          <div class="muted">
            ${money(p.price)} · ${Number(p.stock)} шт.
          </div>
        </div>

        <button data-edit="${escapeHTML(p.id)}">Изм.</button>
        <button data-delete="${escapeHTML(p.id)}">×</button>
      </div>
    `).join('')
    : empty(
        'Список пуст',
        'Добавь первый демонстрационный товар.'
      );
}

function resetForm() {
  $('productForm').reset();
  $('editId').value = '';
  editingPhoto = '';
  $('photoPreview').textContent = 'Фото пока нет';
  $('saveButton').textContent = 'Добавить товар';
  $('adminStatus').textContent = '';
}

function editProduct(id) {
  const p = findProduct(id);
  if (!p) return;

  $('editId').value = p.id;
  $('name').value = p.name;
  $('description').value = p.description || '';
  $('price').value = p.price;
  $('stock').value = p.stock;
  $('category').value = p.category;

  editingPhoto = p.photo || '';

  $('photoPreview').innerHTML = editingPhoto
    ? `<img src="${editingPhoto}" alt="Предпросмотр">`
    : 'Фото пока нет';

  $('saveButton').textContent = 'Сохранить изменения';
  $('adminStatus').textContent = '';

  window.scrollTo(0, 0);
}

function setFilter(nextFilter) {
  filter = nextFilter;

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.filter === filter
    );
  });

  render();
}

document.addEventListener('click', event => {
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

  const category = event.target.closest('[data-filter]');

  if (category) {
    setFilter(category.dataset.filter);

    if (currentPage !== 'catalog') {
      showPage('catalog');
    }
    return;
  }

  const navigation = event.target.closest('[data-page]');

  if (navigation) {
    showPage(navigation.dataset.page);
    return;
  }

  const edit = event.target.closest('[data-edit]');

  if (edit) {
    editProduct(edit.dataset.edit);
    return;
  }

  const del = event.target.closest('[data-delete]');

  if (del) {
    const id = del.dataset.delete;

    if (!confirm('Удалить этот демонстрационный товар?')) {
      return;
    }

    products = products.filter(
      p => String(p.id) !== String(id)
    );

    favorites = favorites.filter(
      item => String(item) !== String(id)
    );

    try {
      save();
      render();
      renderAdmin();
      resetForm();
    } catch {
      alert('Не удалось сохранить изменения.');
    }
  }
});

$('search').addEventListener('input', render);

$('back').addEventListener('click', () => {
  showPage(previousPage === 'detail' ? 'catalog' : previousPage);
});

$('adminShortcut').addEventListener('click', () => {
  showPage('admin');
});

$('about').addEventListener('click', () => {
  $('aboutText').textContent =
    'Turban Shop — демонстрационный интерфейс. ' +
    'Данные сохраняются только в текущем браузере.';
});

$('resetForm').addEventListener('click', resetForm);

$('photo').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;

  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowed.includes(file.type) || file.size > 1024 * 1024) {
    alert('Выбери JPG, PNG или WebP размером до 1 МБ.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    editingPhoto = reader.result;

    $('photoPreview').innerHTML =
      `<img src="${editingPhoto}" alt="Предпросмотр">`;
  };

  reader.readAsDataURL(file);
});

$('productForm').addEventListener('submit', event => {
  event.preventDefault();

  const oldId = $('editId').value;
  const id = oldId ||
    (window.crypto?.randomUUID?.() || String(Date.now()));

  const name = $('name').value.trim();
  const description = $('description').value.trim();
  const price = Number($('price').value);
  const stock = Number($('stock').value);

  if (
    !name ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    $('adminStatus').textContent =
      'Проверь название, цену и остаток.';
    return;
  }

  const item = {
    id,
    name,
    description,
    price,
    stock,
    category: $('category').value,
    photo: editingPhoto
  };

  const previousProducts = [...products];

  const index = products.findIndex(
    p => String(p.id) === String(id)
  );

  if (index >= 0) {
    products[index] = item;
  } else {
    products.unshift(item);
  }

  try {
    save();
    resetForm();
    render();
    renderAdmin();

    $('adminStatus').textContent =
      'Товар сохранён в этом браузере.';
  } catch {
    products = previousProducts;

    $('adminStatus').textContent =
      'Недостаточно места для сохранения. ' +
      'Попробуй фотографию меньшего размера.';
  }
});

const user = tg?.initDataUnsafe?.user;

if (user) {
  $('profileName').textContent =
    user.first_name || user.username || 'Пользователь';
}

render();
