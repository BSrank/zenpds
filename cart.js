// ==================== GOOGLE SHEETS CONFIGURATION ====================
// ВАЖНО: След като настроиш Google Sheets, замени с твоя Web App URL
// Имейлът за нотификации е в Google Apps Script (private), не тук!
const GOOGLE_SHEETS_CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbzKj9ttuvCMJFF3DJuPBry15BuiLkWzLku2NwDDbtZS7oZ5jgHtQp1jl2d9bertHYYn/exec' // Замени с URL от Google Apps Script Deploy
};

// ==================== ПРОДУКТИ / НАСТРОЙКИ (от products.json) ====================
// Продуктите, ревютата и контактният режим вече идват от products.json (управлява
// се от admin.html), вместо да са хардкоднати в index.html / products.html.
let SITE_PRODUCTS = [];
let SITE_SETTINGS = {};
let PRODUCT_IMAGES = {};

// ==================== КАТЕГОРИИ (продукти/products.html) ====================
// Продуктите без изрично зададена категория в admin панела се третират като
// "headphones" (обратна съвместимост - всички вече съществуващи продукти са
// слушалки). Винаги при отваряне/презареждане на products.html подразбиращата
// се категория е "headphones" - по изрично желание ("винаги като цъкнат на
// продукти да е зададено на слушалки"), не се помни последният избор.
function getProductCategories() {
    const cats = (SITE_SETTINGS.categories && SITE_SETTINGS.categories.length)
        ? SITE_SETTINGS.categories
        : [{ id: 'headphones', label: 'Слушалки' }, { id: 'chargers', label: 'Зарядни' }];
    return cats.concat([{ id: 'all', label: 'Всички' }]);
}
// Подразбиращата се категория е първата от списъка (управлява се от админ панела).
let ACTIVE_CATEGORY = null;

function renderCategoryTabs() {
    const wrap = document.getElementById('categoryTabs');
    if (!wrap) return;
    const PRODUCT_CATEGORIES = getProductCategories();
    if (!ACTIVE_CATEGORY || !PRODUCT_CATEGORIES.some(c => c.id === ACTIVE_CATEGORY)) ACTIVE_CATEGORY = PRODUCT_CATEGORIES[0].id;
    wrap.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 2rem;';
    wrap.innerHTML = PRODUCT_CATEGORIES.map(cat => {
        const active = cat.id === ACTIVE_CATEGORY;
        const style = active
            ? 'background:var(--accent,#2563eb);color:#fff;border-color:var(--accent,#2563eb);'
            : 'background:none;color:var(--text-light,#999);border-color:var(--border,#2a2a2a);';
        return '<button type="button" class="category-tab" data-category="' + cat.id + '" ' +
            'style="padding:9px 22px;border-radius:30px;border:1px solid;cursor:pointer;font-family:inherit;font-size:0.88rem;letter-spacing:0.02em;transition:all 0.2s;' + style + '">' +
            cat.label +
        '</button>';
    }).join('');
}

function filteredProducts() {
    if (ACTIVE_CATEGORY === null || ACTIVE_CATEGORY === 'all') return SITE_PRODUCTS;
    const cats = getProductCategories();
    const first = cats[0].id;
    const known = new Set(cats.map(c => c.id));
    // Продукт без категория, или с категория която вече не съществува в списъка
    // (напр. изтрита/преименувана ръчно в products.json), се брои за първата -
    // така никога не "изчезва" от всички табове освен "Всички".
    return SITE_PRODUCTS.filter(p => {
        const cat = (p.category && known.has(p.category)) ? p.category : first;
        return cat === ACTIVE_CATEGORY;
    });
}

async function loadSiteData() {
    // До 3 опита - ако products.json временно не се зареди (напр. GitHub Pages
    // CDN-ът все още не е "разпространил" наскоро добавен файл до всички сървъри),
    // изчакваме малко и опитваме пак, вместо веднага да се предадем.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const res = await fetch('products.json?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const settings = data.settings || {};
            // "Нови обяви" (isNewListing:true) са скрити от сайта, докато собственикът
            // не включи settings.showNewListings от admin панела - позволява да се
            // подготви продукт напълно (снимки, описание, цена), преди да е публичен.
            const showNewListings = settings.showNewListings === true;
            const products = (data.products || []).filter(function(p) {
                return p.active !== false && (!p.isNewListing || showNewListings);
            });
            if (!products.length) throw new Error('products.json е празен');

            SITE_PRODUCTS = products;
            SITE_SETTINGS = settings;

            // PRODUCT_IMAGES се строи динамично от products.json, вместо да е хардкоднато.
            PRODUCT_IMAGES = {};
            SITE_PRODUCTS.forEach(p => {
                PRODUCT_IMAGES[p.id] = { main: p.imageMain, prefix: p.imagePrefix };
            });
            return; // успех
        } catch (e) {
            console.error('Грешка при зареждане на products.json (опит ' + attempt + '/' + MAX_ATTEMPTS + '):', e);
            if (attempt < MAX_ATTEMPTS) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    }
    // И трите опита се провалиха - оставяме SITE_PRODUCTS празен. renderProductsGrid()
    // и renderProductsPreview() НЕ пипат HTML-а в този случай (виж техния код по-долу).
    SITE_PRODUCTS = [];
    SITE_SETTINGS = {};
}

function findProduct(id) {
    return SITE_PRODUCTS.find(p => p.id === id);
}

// ==================== ВАРИАНТИ (напр. "Дължина": 1м/2м с различна цена) ====================
// Изключени по подразбиране за всеки продукт - p.variantGroup е undefined/null,
// освен ако собственикът изрично не ги включи за конкретна обява от admin панела.
// Когато ги няма, продуктът се държи точно както преди (фиксирана p.price).
function hasVariants(product) {
    return !!(product && product.variantGroup && Array.isArray(product.variantGroup.options) && product.variantGroup.options.length);
}

function cheapestVariantPrice(product) {
    return Math.min.apply(null, product.variantGroup.options.map(o => Number(o.price) || 0));
}

function renderVariantSelectorHTML(product) {
    const vg = product.variantGroup;
    const optionsHTML = vg.options.map((opt, i) =>
        '<option value="' + i + '">' + (opt.label || ('Вариант ' + (i + 1))) + ' — €' + (Number(opt.price) || 0).toFixed(2) + '</option>'
    ).join('');
    return '<div class="variant-selector" style="margin:10px 0;">' +
        '<label style="display:block;font-size:0.82rem;color:var(--text-light);margin-bottom:6px;">' + (vg.label || 'Вариант') + ':</label>' +
        '<select class="variant-select" id="variant-' + product.id + '" data-product="' + product.id + '" ' +
            'style="width:100%;padding:9px 11px;background:#1a1a1a;border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:0.88rem;outline:none;">' +
            optionsHTML +
        '</select>' +
    '</div>';
}

function formatPriceHTML(product) {
    if (hasVariants(product)) {
        return 'от €' + cheapestVariantPrice(product).toFixed(2);
    }
    // Цената се показва само в евро - без "(X лв)" по изричен избор.
    const hasDiscount = product.comparePrice && product.comparePrice > product.price;
    const eur = '€' + Number(product.price).toFixed(2);
    if (!hasDiscount) return eur;
    const compareEur = '€' + Number(product.comparePrice).toFixed(2);
    return '<span style="text-decoration:line-through;color:var(--text-light);font-size:0.85em;margin-right:8px;">' + compareEur + '</span>' + eur;
}

// ==================== DYNAMIC RENDERING (index.html / products.html) ====================
function renderDynamicContent() {
    renderProductsPreview();
    renderCategoryTabs();
    renderProductsGrid();
    renderReviewsSection();
    renderContactSections();
}

// ---- Начало: preview grid ----
function renderProductsPreview() {
    const grid = document.getElementById('productsPreviewGrid');
    if (!grid) return;
    // ВАЖНО: ако products.json не се е заредил (мрежова грешка, или GitHub Pages
    // все още не е "разпространил" файла до всички CDN сървъри - това се случва
    // за кратко след добавяне на НОВ файл в repo-то), SITE_PRODUCTS ще е празен.
    // В такъв случай НЕ пипаме грида изобщо, вместо да го изтрием и страницата
    // да "опустее".
    if (!SITE_PRODUCTS.length) return;
    grid.innerHTML = SITE_PRODUCTS.map(p => {
        const featuresHTML = (p.previewFeatures || []).map(f => '<li>' + f + '</li>').join('');
        return '<a href="products.html#' + p.id + '" class="product-preview-card">' +
            '<div class="product-preview-image" id="previewImage-' + p.id + '">' +
                '<div class="product-image-placeholder">' + p.name.replace(' ', '<br>') + '</div>' +
            '</div>' +
            '<div class="product-preview-info">' +
                '<h3 class="product-preview-title">' + p.name + '</h3>' +
                '<p class="product-preview-price">' + formatPriceHTML(p) + '</p>' +
                '<ul class="product-preview-features">' + featuresHTML + '</ul>' +
                '<span class="preview-cta">Виж повече →</span>' +
            '</div>' +
        '</a>';
    }).join('');
}

// ---- Продукти: пълни карти ----
function renderProductsGrid() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    // Виж коментара в renderProductsPreview() по-горе - същата защита тук.
    if (!SITE_PRODUCTS.length) return;
    const visibleProducts = filteredProducts();
    if (!visibleProducts.length) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-light);grid-column:1/-1;padding:2rem 0;">Няма продукти в тази категория засега.</p>';
        return;
    }
    grid.innerHTML = visibleProducts.map(p => {
        const sectionsHTML = (p.sections || []).map(sec =>
            '<h3>' + sec.title + '</h3><ul>' + (sec.items || []).map(it => '<li>' + it + '</li>').join('') + '</ul>'
        ).join('');
        return '<div class="product-card" id="' + p.id + '">' +
            '<div class="product-image-section">' +
                '<div class="product-image-main" id="mainImage-' + p.id + '"></div>' +
                '<div class="product-thumbnails" id="thumbnails-' + p.id + '"></div>' +
            '</div>' +
            '<div class="product-info">' +
                '<h2 class="product-title">' + p.name + '</h2>' +
                '<p class="product-price" id="price-' + p.id + '">' + (hasVariants(p) ? ('€' + (Number(p.variantGroup.options[0].price) || 0).toFixed(2)) : formatPriceHTML(p)) + '</p>' +
                '<div class="product-features">' + sectionsHTML + '</div>' +
                (hasVariants(p) ? renderVariantSelectorHTML(p) : '') +
                '<div class="product-actions">' +
                    '<div class="quantity-selector">' +
                        '<button class="qty-btn minus" data-product="' + p.id + '">-</button>' +
                        '<input type="number" class="qty-input" id="qty-' + p.id + '" value="1" min="1" max="99">' +
                        '<button class="qty-btn plus" data-product="' + p.id + '">+</button>' +
                    '</div>' +
                    '<button class="add-to-cart-btn" data-product="' + p.id + '" data-name="' + p.name + '" data-price="' + p.price + '">' +
                        'Добави в количка' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ---- Ревюта (index.html) ----
// На началната страница показваме само ограничен брой ревюта (за да не се
// удължава страницата безкрайно) - пълният списък е на reviews.html, към
// която винаги показваме връзка "Виж всички ревюта", докато секцията е видима.
const HOMEPAGE_REVIEWS_LIMIT = 6;

function renderReviewsSection() {
    const section = document.getElementById('reviewsSection');
    const grid = document.getElementById('reviewsGrid');
    const moreLink = document.getElementById('reviewsMoreLink');
    if (!section || !grid) return;

    const manualReviews = SITE_SETTINGS.showManualReviews ? (SITE_SETTINGS.manualReviews || []).filter(r => r && r.text) : [];
    const showClient = SITE_SETTINGS.showClientReviews === true;

    if (!manualReviews.length && !showClient) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    if (moreLink) moreLink.style.display = 'block';

    const shownManual = manualReviews.slice(0, HOMEPAGE_REVIEWS_LIMIT);
    grid.innerHTML = shownManual.map(r =>
        '<div class="review-card review-text-card">' +
            '<div class="review-stars">⭐⭐⭐⭐⭐</div>' +
            '<p class="review-text">"' + r.text + '"</p>' +
            '<p class="review-author">— ' + (r.author || '') + '</p>' +
            (r.courier ? '<p class="review-source">' + r.courier + ' доставка ✓</p>' : '') +
        '</div>'
    ).join('');

    if (showClient) {
        // ВАЖНО: реалните клиентски ревюта НЕ се четат от Apps Script при всяко
        // зареждане на страницата (това беше бавно - Apps Script "cold start" +
        // 302 пренасочване можеше да отнеме секунди). Вместо това, при всяко
        // одобрение на ревю от admin панела, ревюто се кешира директно в
        // products.json (settings.clientReviews) и се качва в GitHub - оттам
        // насетне идва мигновено, заедно с продуктите, през GitHub Pages CDN.
        const remainingSlots = Math.max(0, HOMEPAGE_REVIEWS_LIMIT - shownManual.length);
        const clientReviews = (SITE_SETTINGS.clientReviews || []).slice(0, remainingSlots);
        clientReviews.forEach(r => {
            const card = document.createElement('div');
            card.className = 'review-card review-text-card';
            card.innerHTML = '<div class="review-stars">⭐⭐⭐⭐⭐</div>' +
                '<p class="review-text">"' + (r.text || '') + '"</p>' +
                '<p class="review-author">— ' + (r.name || '') + '</p>' +
                (r.date ? '<p class="review-source">' + r.date + '</p>' : '');
            grid.appendChild(card);
        });
        if (!shownManual.length && !clientReviews.length) {
            section.style.display = 'none';
            if (moreLink) moreLink.style.display = 'none';
        }
    }
}

// ---- Контакт (index.html + products.html) ----
function renderContactSections() {
    renderContactBlock('contactDynamic');   // index.html секция за контакт
    renderContactBlock('contactCtaDynamic'); // products.html contact-cta
}

function renderContactBlock(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // Начална страница: винаги линк към contact-form.html отгоре, телефон под него -
    // фиксирано, независимо от contactMode (вариант А, избран вместо вградена форма).
    if (containerId === 'contactDynamic') {
        const phone = SITE_SETTINGS.phone || '0876 127 997';
        el.innerHTML =
            '<div style="text-align:center;">' +
                '<a href="contact-form.html" class="cta-btn" style="display:inline-block;margin-bottom:14px;">✉ Изпрати съобщение</a>' +
                '<br>' +
                '<a href="tel:' + phone.replace(/\s/g, '') + '" class="phone-link">📞 ' + phone + '</a>' +
            '</div>';
        return;
    }

    if (SITE_SETTINGS.contactMode === 'form') {
        el.innerHTML =
            '<form id="siteContactForm" class="site-contact-form" style="max-width:420px;margin:0 auto;text-align:left;">' +
                '<input type="text" id="cf-name" placeholder="Твоето име" style="width:100%;padding:10px 12px;margin-bottom:0.6rem;background:#1a1a1a;border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:0.9rem;outline:none;" />' +
                '<input type="email" id="cf-email" placeholder="Имейл за отговор" style="width:100%;padding:10px 12px;margin-bottom:0.6rem;background:#1a1a1a;border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:0.9rem;outline:none;" />' +
                '<textarea id="cf-msg" placeholder="Съобщение..." rows="4" style="width:100%;padding:10px 12px;margin-bottom:0.8rem;background:#1a1a1a;border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:0.9rem;outline:none;resize:vertical;"></textarea>' +
                '<button type="button" class="cta-btn" onclick="submitContactForm(\'' + containerId + '\')" style="cursor:pointer;">Изпрати</button>' +
                '<p id="cf-status-' + containerId + '" style="margin-top:0.8rem;font-size:0.85rem;color:var(--success);display:none;">✓ Съобщението е изпратено!</p>' +
            '</form>';
    } else {
        const phone = SITE_SETTINGS.phone || '0876 127 997';
        el.innerHTML = '<a href="tel:' + phone.replace(/\s/g, '') + '" class="phone-link">📞 ' + phone + '</a>';
    }
}

async function submitContactForm(containerId) {
    const name = document.getElementById('cf-name').value.trim();
    const email = document.getElementById('cf-email').value.trim();
    const msg = document.getElementById('cf-msg').value.trim();
    if (!name || !email || !msg) { alert('Моля попълни всички полета.'); return; }
    try {
        await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'contactForm', name, email, msg })
        });
    } catch (e) {
        console.error('Грешка при изпращане на съобщението:', e);
    }
    const status = document.getElementById('cf-status-' + containerId);
    if (status) status.style.display = 'block';
    document.getElementById('cf-name').value = '';
    document.getElementById('cf-email').value = '';
    document.getElementById('cf-msg').value = '';
}

// ==================== CART FUNCTIONALITY ====================
let cart = [];
let currentLightboxImages = [];
let currentLightboxIndex = 0;

// Load cart from localStorage on page load
async function initSite() {
    try { loadCart(); } catch (e) { console.error('loadCart:', e); cart = []; }
    try { updateCartUI(); } catch (e) { console.error('updateCartUI:', e); }
    await loadSiteData();
    // Всяка стъпка е изолирана - грешка в една не спира останалите.
    [renderProductsPreview, renderCategoryTabs, renderProductsGrid, renderReviewsSection, renderContactSections].forEach(fn => {
        try { fn(); } catch (e) {
            console.error('Грешка в ' + fn.name + ':', e);
            const grid = document.getElementById('productsGrid');
            if (grid && !grid.innerHTML.trim()) {
                grid.innerHTML = '<p style="text-align:center;color:#e05252;grid-column:1/-1;padding:2rem 0;">Грешка при зареждане (' + fn.name + '): ' + (e && e.message) + '</p>';
            }
        }
    });
    try { setupEventListeners(); } catch (e) { console.error('setupEventListeners:', e); }
    try { loadProductImages(); } catch (e) { console.error('loadProductImages:', e); }
    try { loadPreviewImages(); } catch (e) { console.error('loadPreviewImages:', e); }
}

// Стартираме веднага, ако DOM-ът вече е зареден (скриптът може да се изпълни
// след DOMContentLoaded - напр. при отложено зареждане от Cloudflare).
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initSite);
} else {
    initSite();
}

// ==================== PRODUCT IMAGE LOADING ====================
function loadProductImages() {
    // Load images for each product
    Object.keys(PRODUCT_IMAGES).forEach(productId => {
        loadImagesForProduct(productId);
    });
}

async function loadImagesForProduct(productId) {
    const config = PRODUCT_IMAGES[productId];
    const mainImageContainer = document.getElementById(`mainImage-${productId}`);
    const thumbnailsContainer = document.getElementById(`thumbnails-${productId}`);

    if (!config || !mainImageContainer || !thumbnailsContainer) return;

    // Картите се пре-рисуват при смяна на категория (нови DOM елементи), затова
    // ако снимките на този продукт вече са проверени, ги показваме веднага от
    // кеша, вместо да правим всички проверки отново.
    const cachedImages = window[`${productId}_images`];
    if (cachedImages && cachedImages.length) {
        displayProductImages(productId, cachedImages);
        return;
    }

    // ВАЖНО: проверяваме основната снимка + номерираните снимки (1.jpg, 2.jpg, ...)
    // ПАРАЛЕЛНО с Promise.all, вместо последователно (едно по едно с await в цикъл).
    // Последователната проверка беше основната причина за бавното зареждане на
    // снимките - всяка проверка чакаше предишната да приключи, вместо да тръгнат
    // всички изведнъж.
    const MAX_INDEX = 12;
    const candidatePaths = [config.main];
    for (let i = 1; i <= MAX_INDEX; i++) {
        candidatePaths.push(`${config.prefix}.${i}.jpg`);
    }

    const results = await Promise.all(
        candidatePaths.map(path => checkImageExists(path).then(exists => ({ path, exists })))
    );

    const images = [];
    if (results[0].exists) images.push(results[0].path);

    let consecutiveFailures = 0;
    for (let i = 1; i < results.length; i++) {
        if (results[i].exists) {
            images.push(results[i].path);
            consecutiveFailures = 0;
        } else {
            consecutiveFailures++;
            if (consecutiveFailures >= 2) break;
        }
    }

    // Display images
    if (images.length > 0) {
        displayProductImages(productId, images);
    } else {
        // Show placeholder if no images found
        const product = findProduct(productId);
        mainImageContainer.innerHTML = `
            <div class="product-image-placeholder">
                ${product ? product.name.replace(' ', '<br>') : ''}
            </div>
        `;
    }
}

function checkImageExists(imagePath) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = imagePath;
    });
}

function displayProductImages(productId, images) {
    const mainImageContainer = document.getElementById(`mainImage-${productId}`);
    const thumbnailsContainer = document.getElementById(`thumbnails-${productId}`);
    if (!mainImageContainer || !thumbnailsContainer) return;

    // Display main image
    mainImageContainer.innerHTML = `
        <img src="${images[0]}" alt="Product image" onclick="openLightbox('${productId}', 0)">
    `;

    // Display thumbnails if more than one image
    if (images.length > 1) {
        thumbnailsContainer.innerHTML = images.map((img, index) => `
            <div class="product-thumbnail ${index === 0 ? 'active' : ''}"
                 onclick="changeMainImage('${productId}', ${index})">
                <img src="${img}" alt="Thumbnail ${index + 1}">
            </div>
        `).join('');
    }

    // Store images for lightbox
    window[`${productId}_images`] = images;
}

function changeMainImage(productId, index) {
    const images = window[`${productId}_images`];
    const mainImageContainer = document.getElementById(`mainImage-${productId}`);

    // Update main image
    mainImageContainer.innerHTML = `
        <img src="${images[index]}" alt="Product image" onclick="openLightbox('${productId}', ${index})">
    `;

    // Update active thumbnail
    const thumbnails = document.querySelectorAll(`#thumbnails-${productId} .product-thumbnail`);
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// ==================== LIGHTBOX FUNCTIONALITY ====================
function openLightbox(productId, startIndex) {
    const images = window[`${productId}_images`];
    if (!images || images.length === 0) return;

    currentLightboxImages = images;
    currentLightboxIndex = startIndex;

    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');

    if (lightbox && lightboxImage) {
        lightboxImage.src = images[startIndex];
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function lightboxPrev() {
    if (currentLightboxImages.length === 0) return;

    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    const lightboxImage = document.getElementById('lightboxImage');
    if (lightboxImage) {
        lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    }
}

function lightboxNext() {
    if (currentLightboxImages.length === 0) return;

    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    const lightboxImage = document.getElementById('lightboxImage');
    if (lightboxImage) {
        lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    }
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
    // Cart button
    const cartBtn = document.getElementById('cartBtn');
    const cartModal = document.getElementById('cartModal');
    const cartOverlay = document.getElementById('cartOverlay');
    const closeCart = document.getElementById('closeCart');

    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCartModal);
    if (closeCart) closeCart.addEventListener('click', closeCartModal);

    // Checkout modal
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutOverlay = document.getElementById('checkoutOverlay');
    const closeCheckout = document.getElementById('closeCheckout');

    if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);
    if (checkoutOverlay) checkoutOverlay.addEventListener('click', closeCheckoutModal);
    if (closeCheckout) closeCheckout.addEventListener('click', closeCheckoutModal);

    // Checkout form
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);

    // Courier selector
    const courierSelect = document.getElementById('courier');
    if (courierSelect) courierSelect.addEventListener('change', updateOfficeLabel);

    // Add to cart buttons (динамично създадени - делегираме на document, за да
    // работят и когато карите се пре-рендират след зареждане на products.json)
    document.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('add-to-cart-btn')) {
            handleAddToCart(e);
        }
        if (e.target.classList && e.target.classList.contains('qty-btn')) {
            handleQuantityChange(e);
        }
        if (e.target.classList && e.target.classList.contains('category-tab')) {
            ACTIVE_CATEGORY = e.target.dataset.category;
            renderCategoryTabs();
            renderProductsGrid();
            loadProductImages(); // новите карти са без снимки - зареждаме ги отново
        }
    });

    // Quantity inputs (делегирано, тъй като полетата се създават динамично)
    document.addEventListener('change', (e) => {
        if (e.target.classList && e.target.classList.contains('qty-input')) {
            let value = parseInt(e.target.value);
            if (isNaN(value) || value < 1) {
                e.target.value = 1;
            } else if (value > 99) {
                e.target.value = 99;
            }
        }
        // Избор на вариант (напр. дължина/цвят) - обновяваме показваната цена
        // веднага, преди клиентът да добави в количката.
        if (e.target.classList && e.target.classList.contains('variant-select')) {
            const productId = e.target.dataset.product;
            const product = findProduct(productId);
            const priceEl = document.getElementById('price-' + productId);
            if (product && priceEl) {
                const opt = product.variantGroup.options[parseInt(e.target.value)];
                if (opt) priceEl.textContent = '€' + (Number(opt.price) || 0).toFixed(2);
            }
        }
    });

    // Lightbox controls
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrevBtn = document.getElementById('lightboxPrev');
    const lightboxNextBtn = document.getElementById('lightboxNext');

    if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxPrevBtn) lightboxPrevBtn.addEventListener('click', lightboxPrev);
    if (lightboxNextBtn) lightboxNextBtn.addEventListener('click', lightboxNext);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const lightbox = document.getElementById('lightbox');
        const isLightboxOpen = lightbox && lightbox.classList.contains('active');

        if (e.key === 'Escape') {
            closeCartModal();
            closeCheckoutModal();
            closeLightbox();
        } else if (isLightboxOpen) {
            if (e.key === 'ArrowLeft') lightboxPrev();
            if (e.key === 'ArrowRight') lightboxNext();
        }
    });
}

// ==================== QUANTITY HANDLERS ====================
function handleQuantityChange(e) {
    const btn = e.target;
    const productId = btn.dataset.product;
    const input = document.getElementById(`qty-${productId}`);
    if (!input) return;
    let currentValue = parseInt(input.value);

    if (btn.classList.contains('plus')) {
        if (currentValue < 99) {
            input.value = currentValue + 1;
        }
    } else if (btn.classList.contains('minus')) {
        if (currentValue > 1) {
            input.value = currentValue - 1;
        }
    }
}

// ==================== ADD TO CART ====================
function handleAddToCart(e) {
    const btn = e.target;
    const productId = btn.dataset.product;
    const product = findProduct(productId);
    const qtyInput = document.getElementById(`qty-${productId}`);
    const quantity = qtyInput ? parseInt(qtyInput.value) : 1;

    // По подразбиране: продуктът си няма варианти (старото поведение, без
    // промяна) - име/цена идват директно от бутона, точно както досега.
    let itemId = productId;
    let itemName = btn.dataset.name;
    let itemPrice = parseFloat(btn.dataset.price);

    // Ако продуктът има включени варианти (напр. "Дължина") - реалните
    // име/цена идват от ИЗБРАНИЯ вариант, а не от фиксираните data-* атрибути
    // на бутона. Различните варианти на един продукт се третират като
    // отделни редове в количката (съставен id), за да не се събират в едно.
    if (product && hasVariants(product)) {
        const select = document.getElementById('variant-' + productId);
        const variantIdx = select ? parseInt(select.value) : 0;
        const opt = product.variantGroup.options[variantIdx];
        if (!opt) return;
        itemId = productId + '__v' + variantIdx;
        itemName = product.name + ' (' + (opt.label || ('Вариант ' + (variantIdx + 1))) + ')';
        itemPrice = Number(opt.price) || 0;
    }

    const existingItem = cart.find(item => item.id === itemId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: itemPrice,
            quantity: quantity
        });
    }

    saveCart();
    updateCartUI();

    // Visual feedback
    btn.textContent = '✓ Добавено!';
    btn.style.background = '#22c55e';
    setTimeout(() => {
        btn.textContent = 'Добави в количка';
        btn.style.background = '';
    }, 1500);

    if (qtyInput) qtyInput.value = 1;
}

// ==================== CART UI ====================
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const totalPrice = document.getElementById('totalPrice');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;

    if (cart.length === 0) {
        if (cartItems) {
            cartItems.innerHTML = '<p class="empty-cart">Количката е празна</p>';
        }
        if (cartFooter) {
            cartFooter.style.display = 'none';
        }
    } else {
        let itemsHTML = '';
        cart.forEach(item => {
            itemsHTML += `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h3>${item.name}</h3>
                        <div class="cart-item-price">€${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">Количество: ${item.quantity}</div>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')">×</button>
                </div>
            `;
        });

        if (cartItems) {
            cartItems.innerHTML = itemsHTML;
        }

        if (cartFooter) {
            cartFooter.style.display = 'block';
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (totalPrice) {
            totalPrice.textContent = `€${total.toFixed(2)}`;
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function openCart() {
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCartModal() {
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ==================== ПРОМОКОД / НАГРАДА ЗА РЕВЮ ====================
// appliedPromo = { code, type: 'discount'|'case', value } | null
let appliedPromo = null;

function cartRawTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function finalCheckoutTotal() {
    const raw = cartRawTotal();
    if (appliedPromo && appliedPromo.type === 'discount') {
        return Math.max(0, raw * (1 - (parseFloat(appliedPromo.value) || 0) / 100));
    }
    return raw;
}

function resetPromoUI() {
    appliedPromo = null;
    const input = document.getElementById('promoCodeInput');
    const btn = document.getElementById('promoApplyBtn');
    const status = document.getElementById('promoStatus');
    if (input) { input.value = ''; input.disabled = false; }
    if (btn) { btn.style.display = ''; btn.disabled = false; btn.textContent = 'Приложи'; }
    if (status) { status.style.display = 'none'; status.textContent = ''; }
}

async function applyPromoCode() {
    const input = document.getElementById('promoCodeInput');
    const status = document.getElementById('promoStatus');
    if (!input || !status) return;
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    const btn = document.getElementById('promoApplyBtn');
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl + '?action=verifyPromoCode&code=' + encodeURIComponent(code));
        const data = await res.json();
        if (data.valid) {
            appliedPromo = { code, type: data.type, value: data.value };
            status.style.display = 'block';
            status.style.color = 'var(--success)';
            status.textContent = data.type === 'case'
                ? '✓ Приложен код: безплатен силиконов кейс при тази поръчка!'
                : '✓ Приложен код: -' + data.value + '% отстъпка!';
            input.disabled = true;
            btn.style.display = 'none';
        } else {
            appliedPromo = null;
            status.style.display = 'block';
            status.style.color = '#e05252';
            status.textContent = data.message || 'Невалиден код.';
        }
    } catch (e) {
        status.style.display = 'block';
        status.style.color = '#e05252';
        status.textContent = 'Грешка при проверка на кода. Опитай пак.';
    }
    btn.disabled = false;
    if (btn.style.display !== 'none') btn.textContent = 'Приложи';
    renderCheckoutSummary();
}

function renderCheckoutSummary() {
    const orderSummary = document.getElementById('orderSummary');
    const checkoutTotal = document.getElementById('checkoutTotal');

    let summaryHTML = '';
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        summaryHTML += `
            <div class="summary-item">
                <span>${item.name} x ${item.quantity}</span>
                <span>€${itemTotal.toFixed(2)}</span>
            </div>
        `;
    });
    if (appliedPromo && appliedPromo.type === 'discount') {
        summaryHTML += `
            <div class="summary-item" style="color:var(--accent);">
                <span>🎁 Промокод ${appliedPromo.code}</span>
                <span>-${appliedPromo.value}%</span>
            </div>
        `;
    } else if (appliedPromo && appliedPromo.type === 'case') {
        summaryHTML += `
            <div class="summary-item" style="color:var(--accent);">
                <span>🎁 Награда</span>
                <span>Безплатен кейс</span>
            </div>
        `;
    }

    if (orderSummary) orderSummary.innerHTML = summaryHTML;
    if (checkoutTotal) checkoutTotal.textContent = `€${finalCheckoutTotal().toFixed(2)}`;
}

// ==================== CHECKOUT ====================
function openCheckout() {
    closeCartModal();
    resetPromoUI();
    renderCheckoutSummary();

    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateOfficeLabel() {
    const courierSelect = document.getElementById('courier');
    const officeLabel = document.getElementById('officeLabel');
    const officeInput = document.getElementById('office');

    if (courierSelect && officeLabel && officeInput) {
        const courier = courierSelect.value;
        if (courier === 'Econt') {
            officeLabel.textContent = 'Econt офис *';
            officeInput.placeholder = 'Напр: Econt офис София, ул. Витоша 5';
        } else {
            officeLabel.textContent = 'Офис на куриера *';
            officeInput.placeholder = 'Изберете куриер';
        }
    }
}

// ==================== HANDLE CHECKOUT SUBMISSION ====================
async function handleCheckout(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    const courier = formData.get('courier');
    const name = formData.get('name');
    const phone = formData.get('phone');
    const email = formData.get('email') || ''; // Optional field
    const city = formData.get('city');
    const office = formData.get('office');

    // ВАЖНО: изпращаме СУРОВАТА сума (преди отстъпка) - самата отстъпка се
    // пресмята на сървъра (Code.gs), за да не може някой да я подправи от
    // конзолата на браузъра. За показване/имейли сървърът смята EUR+BGN сам.
    const subtotal = cartRawTotal();

    let orderItems = '';
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        orderItems += `${item.name} x ${item.quantity}бр - €${itemTotal.toFixed(2)}\n`;
    });

    const orderData = {
        date: new Date().toLocaleDateString('bg-BG'),
        time: new Date().toLocaleTimeString('bg-BG'),
        name: name,
        phone: phone,
        email: email,
        city: city,
        courier: courier,
        office: office,
        products: orderItems.trim(),
        subtotalEur: subtotal.toFixed(2),
        promoCode: appliedPromo ? appliedPromo.code : ''
    };

    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане...';

    try {
        // ВАЖНО: тук ЧАКАМЕ (await) реалния отговор от Google Apps Script -
        // за разлика от преди, вече не можем да сме "fire and forget", защото
        // трябва да сме сигурни, че промокодът реално е бил приложен (и да
        // покажем грешка на клиента, ако нещо се провали), преди да изчистим
        // количката и да покажем съобщение за успех.
        const result = await sendToGoogleSheets(orderData);
        if (!result || result.success !== true) {
            throw new Error('Сървърът не потвърди поръчката.');
        }

        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();
        resetPromoUI();

        // Close checkout modal
        closeCheckoutModal();

        // Show success message
        showSuccessMessage();

        // Reset form
        form.reset();
    } catch (error) {
        console.error('Грешка при изпращане:', error);
        alert('Възникна грешка при изпращането. Моля опитайте отново или се свържете с нас на 0876 127 997.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Изпрати поръчка';
    }
}

async function sendToGoogleSheets(orderData) {
    if (GOOGLE_SHEETS_CONFIG.webAppUrl === 'YOUR_WEB_APP_URL_HERE') {
        console.warn('Google Sheets не е конфигуриран още!');
        // За тестване приемаме че е успешно
        return { success: true };
    }

    const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(orderData)
    });

    return response.json();
}

function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.classList.add('active');

        setTimeout(() => {
            successMessage.classList.remove('active');
        }, 4000);
    }
}

// ==================== LOCAL STORAGE ====================
function saveCart() {
    localStorage.setItem('zenairpods_cart', JSON.stringify(cart));
}

function loadCart() {
    const savedCart = localStorage.getItem('zenairpods_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// ==================== LOAD PREVIEW IMAGES (Homepage) ====================
async function loadPreviewImages() {
    for (const p of SITE_PRODUCTS) {
        const preview = document.getElementById(`previewImage-${p.id}`);
        if (!preview || !p.imageMain) continue;
        const exists = await checkImageExists(p.imageMain);
        if (exists) {
            preview.innerHTML = `<img src="${p.imageMain}" alt="${p.name}">`;
        }
    }
}
