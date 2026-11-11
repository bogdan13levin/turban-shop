
'use strict';

/*
 TURBAN SHOP 5.0
 Интерактивный визуальный прототип.
 Без подключения к базе данных и оформления заказов.
*/

const $ = id => document.getElementById(id);

const products = [
  {
    id: 'p1',
    name: 'Настольная лампа Orbit',
    description: 'Минималистичный светильник для рабочего места',
    price: 2490,
    category: 'popular',
    badge: 'HIT',
    emoji: '💡',
    colors: ['#594175', '#2c2543'],
    stock: true
  },
  {
    id: 'p2',
    name: 'Коврик Night Grid',
    description: 'Большой коврик для мыши с геометрическим узором',
    price: 990,
    category: 'new',
    badge: 'NEW',
    emoji: '▦',
    colors: ['#55416b', '#272138'],
    stock: true
  },
  {
    id: 'p3',
    name: 'Подставка Wave',
    description: 'Компактная подставка для смартфона',
    price: 790,
    category: 'popular',
    badge: 'HIT',
    emoji: '📱',
    colors: ['#524067', '#282138'],
    stock: true
  },
  {
    id: 'p4',
    name: 'Блокнот Violet',
    description: 'Твёрдая обложка и плотные страницы',
    price: 590,
    category: 'new',
    badge: 'NEW',
    emoji: '📓',
    colors: ['#65437c', '#30243f'],
    stock: true
  },
  {
    id: 'p5',
    name: 'Органайзер Mono',
    description: 'Порядок на столе без лишних деталей',
    price: 1190,
    category: 'sale',
    badge: 'SALE',
    emoji: '🗂',
    colors: ['#654d7c', '#29213a'],
    stock: true
  },
  {
    id: 'p6',
    name: 'Держатель Cable',
    description: 'Магнитный органайзер для проводов',
    price: 390,
    category: 'popular',
    badge: 'HIT',
    emoji: '⌁',
    colors: ['#5b3c72', '#29213a'],
    stock: false
  },
  {
    id: 'p7',
    name: 'Чехол Nebula',
    description: 'Матовая поверхность и спокойный оттенок',
    price: 890,
    category: 'new',
    badge: 'NEW',
    emoji: '✧',
    colors: ['#744a8a', '#342541'],
    stock: true
  },
  {
    id: 'p8',
    name: 'Стикерпак Digital',
    description: 'Набор декоративных стикеров',
    price: 290,
    category: 'sale',
    badge: 'SALE',
    emoji: '✦',
    colors: ['#684681', '#30253e'],
    stock: true
  }
];

const slides = [
  {
    eyebrow: 'TURBAN / DIGITAL SPACE',
    title: 'NEW<br>COLLECTION',
    description: 'Тёмная эстетика. Твой стиль.',
    category: 'new'
  },
  {
    eyebrow: 'CURATED / EVERYDAY',
    title: 'YOUR<br>SPACE',
    description: 'Детали, которые создают атмосферу.',
    category: 'popular'
  },
  {
    eyebrow: 'SPECIAL / SELECTION',
    title: 'MORE<br>TO EXPLORE',
    description: 'Открой новые сочетания.',
    category: 'sale'
  }
];

let favorites = readFavorites();
let filter = 'all';
let sort = 'popular';
let currentPage = 'home';
let previousPage = 'catalog';
let currentProduct = null;
let currentSlide = 0;
let toastTimer;

function readFavorites() {
  try {
    const data = JSON.parse(
      localStorage.getItem('turban-5-preview-favorites') || '[]'
    );
    return Array.isArray(data) ? data.map(String) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(
      'turban-5-preview-favorites',
      JSON.stringify(favorites)
    );
  } catch {}
}

function escapeHTML(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

function photo(p, large = false) {
  return `
    <div
      class="product-placeholder"
      aria-hidden="true"
      style="color:#dfb9ff;font-size:${large ? '110' : '60'}px"
    >
      ${p.emoji}
    </div>
  `;
}

function card(p) {
  const saved = favorites.includes(p.id);

  return `
    <article class="product-card ${p.stock ? '' : 'unavailable'}">
      <div
        class="product-image"
        data-open="${p.id}"
        style="background:radial-gradient(
          circle at 40% 25%,
          ${p.colors[0]},
          ${p.colors[1]}
        )"
      >
        ${photo(p)}

        <span class="product-badge ${p.badge === 'SALE' ? 'sale' : ''}">
          ${p.stock ? p.badge : 'НЕТ В НАЛИЧИИ'}
        </span>

        <button
          class="favorite-button ${saved ? 'saved' : ''}"
          data-favorite="${p.id}"
          aria-label="${saved ? 'Убрать из избранного' : 'Добавить в избранное'}"
        >
          ${saved ? '♥' : '♡'}
        </button>
      </div>

      <div class="product-info">
        <div class="product-name" data-open="${p.id}">
          ${escapeHTML(p.name)}
        </div>

        <div class="product-description">
          ${escapeHTML(p.description)}
        </div>

        <div class="product-bottom">
          <span class="product-price">${money(p.price)}</span>
          <button class="product-view" data-open="${p.id}">
            Смотреть
          </button>
        </div>
      </div>
    </article>
  `;
}

function emptyState(title, description) {
  return `
    <div class="empty-state">
      <div class="empty-icon">✧</div>
      <strong>${title}</strong>
      <p>${description}</p>
      <button data-page="catalog">Открыть каталог</button>
    </div>
  `;
}

function renderHome() {
  $('homePopular').innerHTML = products
    .filter(p => p.category === 'popular')
    .slice(0, 4)
    .map(card)
    .join('');

  $('homeNew').innerHTML = products
    .filter(p => p.category === 'new')
    .slice(0, 4)
    .map(card)
    .join('');
}

function ordered(items) {
  const a = [...items];

  if (sort === 'new') {
    a.reverse();
  } else if (sort === 'low') {
    a.sort((x, y) => x.price - y.price);
  } else if (sort === 'high') {
    a.sort((x, y) => y.price - x.price);
  } else {
    a.sort(
      (x, y) =>
        Number(y.category === 'popular') -
        Number(x.category === 'popular')
    );
  }

  return a;
}

function renderCatalog() {
  const q = $('catalogSearch')
    .value.trim()
    .toLocaleLowerCase('ru');

  const items = ordered(
    products.filter(p =>
      (filter === 'all' || p.category === filter) &&
      (p.name + ' ' + p.description)
        .toLocaleLowerCase('ru')
        .includes(q)
    )
  );

  $('catalogCount').textContent = items.length + ' поз.';

  $('resultsLabel').textContent = q
    ? 'Результаты поиска'
    : filter === 'all'
      ? 'Все позиции'
      : 'Выбранная категория';

  $('catalogGrid').innerHTML = items.length
    ? items.map(card).join('')
    : emptyState(
        'Ничего не найдено',
        'Попробуй изменить запрос или категорию.'
      );

  $('catalogEnd').hidden = !items.length;

  document.querySelectorAll('[data-filter]').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.filter === filter
    );
  });
}

function renderFavorites() {
  const items = products.filter(p =>
    favorites.includes(p.id)
  );

  $('favoritesCount').textContent =
    items.length + ' поз.';

  $('favoritesGrid').innerHTML = items.length
    ? items.map(card).join('')
    : emptyState(
        'Пока ничего нет',
        'Нажми на сердечко у понравившейся позиции.'
      );
}

function renderAll() {
  renderHome();
  renderCatalog();
  renderFavorites();
}

function showPage(page) {
  if (page === 'detail') {
    previousPage =
      currentPage === 'detail'
        ? previousPage
        : currentPage;
  }

  currentPage = page;

  document.querySelectorAll('.page').forEach(e => {
    e.classList.toggle('active', e.id === page);
  });

  document.querySelectorAll('.bottom-nav button')
    .forEach(b => {
      b.classList.toggle(
        'active',
        b.dataset.page === (
          page === 'detail' ? previousPage : page
        )
      );
    });

  if (page === 'favorites') renderFavorites();
  if (page === 'catalog') renderCatalog();

  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}

function toggleFavorite(id) {
  favorites = favorites.includes(id)
    ? favorites.filter(x => x !== id)
    : [...favorites, id];

  saveFavorites();
  renderAll();

  if (currentPage === 'detail') {
    renderDetail(id);
  }

  toast(
    favorites.includes(id)
      ? 'Добавлено в избранное'
      : 'Удалено из избранного'
  );
}

function renderDetail(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  currentProduct = id;

  const saved = favorites.includes(id);

  $('detailContent').innerHTML = `
    <div
      class="detail-image"
      style="background:radial-gradient(
        circle at 40% 25%,
        ${p.colors[0]},
        ${p.colors[1]}
      )"
    >
      ${photo(p, true)}
    </div>

    <div class="detail-thumbs">
      <button class="active" aria-label="Основное изображение">
        ${p.emoji}
      </button>
      <button data-preview="1" aria-label="Дополнительный ракурс">
        ✦
      </button>
      <button data-preview="2" aria-label="Детали">
        ◇
      </button>
    </div>

    <div class="detail-top">
      <h1>${escapeHTML(p.name)}</h1>
      <button data-favorite="${p.id}" aria-label="Избранное">
        ${saved ? '♥' : '♡'}
      </button>
    </div>

    <div class="detail-price">${money(p.price)}</div>

    <span class="detail-pill">
      ${p.stock ? '● В наличии' : '○ Нет в наличии'}
    </span>

    <div class="detail-description">
      <h3>Описание</h3>
      <p>
        ${escapeHTML(p.description)}.
        Демонстрационная карточка для оценки оформления
        Turban Shop 5.0.
      </p>
    </div>

    <div class="detail-actions">
      <button data-action="share">↗ Поделиться</button>
      <button data-action="preview">
        ✧ Визуальный прототип
      </button>
    </div>
  `;
}

function showSlide(i) {
  currentSlide = (i + slides.length) % slides.length;

  const s = slides[currentSlide];

  $('heroEyebrow').textContent = s.eyebrow;
  $('heroTitle').innerHTML = s.title;
  $('heroDescription').textContent = s.description;
  $('heroLink').dataset.category = s.category;

  $('heroDots').innerHTML = slides.map(
    (_, index) => `
      <button
        data-slide="${index}"
        class="${index === currentSlide ? 'active' : ''}"
        aria-label="Баннер ${index + 1}"
      ></button>
    `
  ).join('');
}

function toast(message) {
  const el = $('toast');

  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => el.classList.remove('show'),
    2400
  );
}

function modal(title, html) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  $('modalOverlay').hidden = false;
}

function closeModal() {
  $('modalOverlay').hidden = true;
}

const info = {
  profile: [
    'Личные данные',
    'Визуальный прототип профиля. В этом режиме данные не редактируются.'
  ],
  history: [
    'История заказов',
    'В демонстрационной версии история заказов не подключена.'
  ],
  support: [
    'Поддержка',
    'Здесь будет раздел поддержки и ответов на вопросы.'
  ],
  faq: [
    'Частые вопросы',
    'Это демонстрация будущего информационного раздела.'
  ],
  about: [
    'О проекте',
    'Turban Shop 5.0 — концепт интерфейса в стиле Dark Purple Premium.'
  ],
  privacy: [
    'Конфиденциальность',
    'Прототип не отправляет личные данные на сервер. Избранное сохраняется только в этом браузере.'
  ]
};

function openSort() {
  const choices = [
    ['popular', 'Сначала популярные'],
    ['new', 'Сначала новые'],
    ['low', 'Цена: по возрастанию'],
    ['high', 'Цена: по убыванию']
  ];

  modal(
    'Сортировка',
    choices.map(
      ([v, label]) => `
        <button
          class="sort-option ${sort === v ? 'active' : ''}"
          data-sort="${v}"
        >
          ${label}
        </button>
      `
    ).join('')
  );
}

document.addEventListener('click', event => {
  const t = event.target.closest(
    'button,[data-open]'
  );

  if (!t) return;

  if (t.dataset.favorite) {
    toggleFavorite(t.dataset.favorite);
    return;
  }

  if (t.dataset.open) {
    renderDetail(t.dataset.open);
    showPage('detail');
    return;
  }

  if (t.dataset.category) {
    filter = t.dataset.category;
    $('catalogSearch').value = '';
    showPage('catalog');
    return;
  }

  if (t.dataset.filter) {
    filter = t.dataset.filter;
    renderCatalog();
    return;
  }

  if (t.dataset.slide !== undefined) {
    showSlide(Number(t.dataset.slide));
    return;
  }

  if (t.dataset.sort) {
    sort = t.dataset.sort;
    closeModal();
    renderCatalog();
    return;
  }

  if (t.dataset.page) {
    showPage(t.dataset.page);
    return;
  }

  if (t.dataset.info) {
    const [title, body] = info[t.dataset.info];

    modal(title, `<p>${body}</p>`);
    return;
  }

  if (t.dataset.preview) {
    toast('Дополнительные фотографии появятся в полной версии');
    return;
  }

  if (t.dataset.action === 'support') {
    modal(...info.support);
    return;
  }

  if (t.dataset.action === 'share') {
    if (navigator.share) {
      navigator.share({
        title: 'Turban Shop 5.0',
        text: 'Посмотри концепт Turban Shop 5.0'
      }).catch(() => {});
    } else {
      toast('Предпросмотр функции «Поделиться»');
    }
    return;
  }

  if (t.dataset.action === 'preview') {
    toast('Это интерактивный прототип дизайна');
    return;
  }
});

$('homeSearch').addEventListener('input', e => {
  $('catalogSearch').value = e.target.value;
  filter = 'all';
  showPage('catalog');
});

$('catalogSearch').addEventListener(
  'input',
  renderCatalog
);

$('clearSearch').addEventListener('click', () => {
  $('catalogSearch').value = '';
  renderCatalog();
  $('catalogSearch').focus();
});

$('openSort').addEventListener(
  'click',
  openSort
);

$('detailBack').addEventListener(
  'click',
  () => showPage(previousPage)
);

$('closeModal').addEventListener(
  'click',
  closeModal
);

$('modalOverlay').addEventListener('click', e => {
  if (e.target === $('modalOverlay')) {
    closeModal();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();

  const user = tg.initDataUnsafe?.user;

  if (user) {
    $('profileName').textContent =
      user.first_name || 'Пользователь';

    $('profileUsername').textContent =
      user.username
        ? '@' + user.username
        : 'Telegram';

    $('profileAvatar').textContent =
      (user.first_name || 'T')
        .charAt(0)
        .toUpperCase();
  }
}

renderAll();
showSlide(0);

setInterval(() => {
  if (
    document.visibilityState === 'visible' &&
    currentPage === 'home'
  ) {
    showSlide(currentSlide + 1);
  }
}, 5000);
