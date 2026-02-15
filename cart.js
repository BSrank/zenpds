// ==================== GOOGLE SHEETS CONFIGURATION ====================
// ВАЖНО: След като настроиш Google Sheets, замени с твоя Web App URL
// Имейлът за нотификации е в Google Apps Script (private), не тук!
const GOOGLE_SHEETS_CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbzKj9ttuvCMJFF3DJuPBry15BuiLkWzLku2NwDDbtZS7oZ5jgHtQp1jl2d9bertHYYn/exec' // Замени с URL от Google Apps Script Deploy
};

// ==================== PRODUCT IMAGE CONFIGURATION ====================
const PRODUCT_IMAGES = {
    'pro3': {
        main: 'airpodspro3main.jpg',
        prefix: 'pro3'
    },
    'gen4': {
        main: 'airpods4genmain.jpg',
        prefix: '4gen'
    }
};

// ==================== CART FUNCTIONALITY ====================
let cart = [];
let currentLightboxImages = [];
let currentLightboxIndex = 0;

// Load cart from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    loadCart();
    updateCartUI();
    setupEventListeners();
    loadProductImages();
    loadPreviewImages(); // Load homepage preview images
});

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
    
    if (!mainImageContainer || !thumbnailsContainer) return;

    const images = [];
    
    // Try to load main image
    const mainImageExists = await checkImageExists(config.main);
    if (mainImageExists) {
        images.push(config.main);
    }
    
    // Try to load additional images (1.jpg, 2.jpg, etc.)
    let imageIndex = 1;
    let consecutiveFailures = 0;
    
    while (consecutiveFailures < 2 && imageIndex < 20) {
        const imagePath = `${config.prefix}.${imageIndex}.jpg`;
        const exists = await checkImageExists(imagePath);
        
        if (exists) {
            images.push(imagePath);
            consecutiveFailures = 0;
        } else {
            consecutiveFailures++;
        }
        imageIndex++;
    }
    
    // Display images
    if (images.length > 0) {
        displayProductImages(productId, images);
    } else {
        // Show placeholder if no images found
        mainImageContainer.innerHTML = `
            <div class="product-image-placeholder">
                ${productId === 'pro3' ? 'AirPods<br>Pro 3' : 'AirPods<br>Gen 4'}
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

    // Add to cart buttons
    const addToCartBtns = document.querySelectorAll('.add-to-cart-btn');
    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', handleAddToCart);
    });

    // Quantity buttons
    const qtyBtns = document.querySelectorAll('.qty-btn');
    qtyBtns.forEach(btn => {
        btn.addEventListener('click', handleQuantityChange);
    });

    // Quantity inputs
    const qtyInputs = document.querySelectorAll('.qty-input');
    qtyInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            let value = parseInt(e.target.value);
            if (isNaN(value) || value < 1) {
                e.target.value = 1;
            } else if (value > 99) {
                e.target.value = 99;
            }
        });
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
    const productName = btn.dataset.name;
    const productPrice = parseFloat(btn.dataset.price);
    const qtyInput = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(qtyInput.value);

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: productPrice,
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

    qtyInput.value = 1;
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

// ==================== CHECKOUT ====================
function openCheckout() {
    closeCartModal();
    
    const checkoutModal = document.getElementById('checkoutModal');
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

    if (orderSummary) {
        orderSummary.innerHTML = summaryHTML;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (checkoutTotal) {
        checkoutTotal.textContent = `€${total.toFixed(2)}`;
    }

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
        } else if (courier === 'Speedy') {
            officeLabel.textContent = 'Speedy офис *';
            officeInput.placeholder = 'Напр: Speedy офис София, бул. България 10';
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

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalBGN = (total * 1.96).toFixed(2);

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
        totalEur: `€${total.toFixed(2)}`,
        totalBgn: `${totalBGN} лв`
    };

    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане...';

    try {
        await sendToGoogleSheets(orderData);
        
        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();

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
        return Promise.resolve();
    }

    const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    });

    // no-cors mode doesn't allow reading response, so we just assume success
    return Promise.resolve();
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
    // Load AirPods Pro 3 preview
    const pro3Preview = document.getElementById('previewImage-pro3');
    if (pro3Preview) {
        const pro3Exists = await checkImageExists('airpodspro3main.jpg');
        if (pro3Exists) {
            pro3Preview.innerHTML = '<img src="airpodspro3main.jpg" alt="AirPods Pro 3 ANC">';
        }
    }

    // Load AirPods Gen 4 preview
    const gen4Preview = document.getElementById('previewImage-gen4');
    if (gen4Preview) {
        const gen4Exists = await checkImageExists('airpods4genmain.jpg');
        if (gen4Exists) {
            gen4Preview.innerHTML = '<img src="airpods4genmain.jpg" alt="AirPods Gen 4 ANC">';
        }
    }
}
