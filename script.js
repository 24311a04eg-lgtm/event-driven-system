/* ============================================
   CloudCart - JavaScript Application Logic
   Handles: Cart management, Checkout, Orders, Cancellations
   ============================================ */

const API_BASE = "https://tkclr6hs1a.execute-api.us-east-1.amazonaws.com/prod";

// ============================================
// Data Models
// ============================================

const PRODUCTS = [
    {
        id: 1,
        name: 'Macbook Pro',
        price: 1999,
        image: 'https://d1fzf3m90o3zp7.cloudfront.net/images/macbook.jpg'
    },
    {
        id: 2,
        name: 'Dell XPS 15',
        price: 1299,
        image: 'https://d1fzf3m90o3zp7.cloudfront.net/images/dell.jpg'
    },
    {
        id: 3,
        name: 'Lenovo H10',
        price: 1599,
        image: 'https://d1fzf3m90o3zp7.cloudfront.net/images/lenovo.jpg'
    },
    {
        id: 4,
        name: 'Asus Zenbook',
        price: 899,
        image: 'https://d1fzf3m90o3zp7.cloudfront.net/images/asus.jpg'
    },
    {
        id: 5,
        name: 'HP Omen',
        price: 1799,
        image: 'https://d1fzf3m90o3zp7.cloudfront.net/images/hp.jpg'
    }
];

const AppState = {
    cart: [],
    orders: [],
    currentCheckout: null
};

// ============================================
// Utility Functions
// ============================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getProductById(id) {
    return PRODUCTS.find(product => product.id === id);
}

// Encodes ORDER#uuid safely for use in fetch URLs
// ORDER#uuid → /order/ORDER%23uuid  (# would break the URL otherwise)
function buildOrderUrl(orderId) {
    return `${API_BASE}/order/${encodeURIComponent(orderId)}`;
}

// Normalizes any order ID to exactly one ORDER# prefix
// Raw UUID "abc-123"        → "ORDER#abc-123"
// Correct  "ORDER#abc-123"  → "ORDER#abc-123"
// Double   "ORDER#ORDER#abc"→ "ORDER#abc"
function normalizeOrderId(id) {
    if (!id) return id;
    const stripped = id.replace(/^(ORDER#)+/, '');
    return `ORDER#${stripped}`;
}

// ============================================
// Cart Management
// ============================================

function addToCart(productId) {
    const product = getProductById(productId);
    if (!product) return;

    const existingItem = AppState.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        AppState.cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    updateCartDisplay();
    showNotification(`${product.name} added to cart!`);
}

function removeFromCart(productId) {
    AppState.cart = AppState.cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function updateCartQuantity(productId, quantity) {
    const item = AppState.cart.find(item => item.id === productId);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = quantity;
            updateCartDisplay();
        }
    }
}

function calculateCartTotals() {
    const subtotal = AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 0;
    const total = subtotal + shipping;
    return { subtotal, shipping, total };
}

function clearCart() {
    AppState.cart = [];
    updateCartDisplay();
}

// ============================================
// Display Update Functions
// ============================================

function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = PRODUCTS.map(product => `
        <div class="product-card">
            <img 
                src="${product.image}" 
                alt="${product.name}" 
                class="product-image"
                onerror="this.src='https://placehold.co/300x200?text=${encodeURIComponent(product.name)}'; this.onerror=null;"
            >
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">${formatCurrency(product.price)}</div>
                <button class="btn-primary add-to-cart-btn" onclick="addToCart(${product.id})">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        </div>
    `).join('');
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const subtotalPrice = document.getElementById('subtotalPrice');
    const totalPrice = document.getElementById('totalPrice');

    if (AppState.cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-message">Your cart is empty. Add some laptops!</p>';
    } else {
        cartItems.innerHTML = AppState.cart.map(item => `
            <div class="cart-item">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${formatCurrency(item.price)} each</div>
                </div>
                <div class="item-quantity">
                    <input type="number" min="1" value="${item.quantity}" 
                           onchange="updateCartQuantity(${item.id}, parseInt(this.value))">
                    <span>x${item.quantity}</span>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        `).join('');
    }

    const { subtotal, total } = calculateCartTotals();
    subtotalPrice.textContent = formatCurrency(subtotal);
    totalPrice.textContent = formatCurrency(total);
}

function showNotification(message) {
    console.log('Notification:', message);
}

// ============================================
// Checkout Functions
// ============================================

function showCheckout() {
    if (AppState.cart.length === 0) {
        alert('Your cart is empty. Add some products before checking out!');
        return;
    }

    const checkoutSection = document.getElementById('checkoutSection');
    const checkoutSummary = document.getElementById('checkoutSummary');
    const { subtotal, total } = calculateCartTotals();

    checkoutSummary.innerHTML = `
        ${AppState.cart.map(item => `
            <div class="order-product">
                <div class="order-product-name">${item.name}</div>
                <div class="order-product-details">
                    <span>Qty: ${item.quantity}</span>
                    <span>${formatCurrency(item.price * item.quantity)}</span>
                </div>
            </div>
        `).join('')}
        <hr>
        <div class="summary-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="summary-row">
            <span>Shipping:</span>
            <span>Free</span>
        </div>
        <div class="summary-row total">
            <span>Total:</span>
            <span>${formatCurrency(total)}</span>
        </div>
    `;

    checkoutSection.classList.remove('hidden');
    window.scrollTo({ top: checkoutSection.offsetTop - 100, behavior: 'smooth' });
}

function cancelCheckout() {
    const checkoutSection = document.getElementById('checkoutSection');
    checkoutSection.classList.add('hidden');
    document.getElementById('checkoutForm').reset();
}

async function handleCheckout(event) {
    event.preventDefault();

    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    const cardNumber = document.getElementById('cardNumber').value;
    const cvv = document.getElementById('cardCVV').value;

    if (!name || !phone || !cardNumber || !cvv) {
        alert('Please fill in all required fields.');
        return;
    }
    if (cardNumber.replace(/\s/g, '').length < 13) {
        alert('Please enter a valid card number.');
        return;
    }
    if (cvv.length < 3) {
        alert('Please enter a valid CVV.');
        return;
    }

    const placedOrderIds = [];

    try {
        for (const item of AppState.cart) {
            const response = await fetch(`${API_BASE}/order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    name: name,
                    phone: phone
                })
            });

            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const result = await response.json();
            const orderId = normalizeOrderId(result.order_id);
            placedOrderIds.push(orderId);
        }

        // Save normalized IDs to localStorage
        const existingOrderIds = JSON.parse(localStorage.getItem("cloudcart_orders")) || [];
        const normalizedExisting = existingOrderIds.map(normalizeOrderId);
        const mergedOrderIds = [...new Set([...normalizedExisting, ...placedOrderIds])];
        localStorage.setItem("cloudcart_orders", JSON.stringify(mergedOrderIds));

        // Fetch full order details with retry (handles POST→GET race condition)
        for (const id of placedOrderIds) {
            const fullOrder = await fetchOrderWithRetry(id);
            if (fullOrder) {
                AppState.orders = AppState.orders.filter(o => normalizeOrderId(o.pk) !== id);
                AppState.orders.push(fullOrder);
            }
        }

        showSuccessMessage(placedOrderIds.map(id => id.replace('ORDER#', '')).join(', '));
        clearCart();
        cancelCheckout();
        updateOrdersDisplay();
        document.getElementById('checkoutForm').reset();

    } catch (error) {
        console.error("Error submitting order:", error);
        alert("Something went wrong while placing your order. Please try again.");
    }
}

// Retries GET with delays to handle POST→GET race condition
async function fetchOrderWithRetry(orderId, maxRetries = 4) {
    const delays = [500, 1000, 2000, 4000];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(buildOrderUrl(orderId));
            if (res.ok) return await res.json();
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, delays[attempt]));
        } catch (err) {
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, delays[attempt]));
        }
    }
    console.error(`Failed to fetch order ${orderId} after ${maxRetries} retries`);
    return null;
}

function showSuccessMessage(orderIdText) {
    const successModal = document.getElementById('successMessage');
    const successOrderId = document.getElementById('successOrderId');
    successOrderId.textContent = orderIdText;
    successModal.classList.remove('hidden');
}

function closeSuccessMessage() {
    document.getElementById('successMessage').classList.add('hidden');
}

// ============================================
// Orders Display & Management
// ============================================

async function updateOrdersDisplay() {
    const ordersList = document.getElementById('ordersList');

    // Normalize + deduplicate all stored IDs on every load
    let orderIds = JSON.parse(localStorage.getItem("cloudcart_orders")) || [];
    orderIds = [...new Set(orderIds.map(normalizeOrderId))];
    localStorage.setItem("cloudcart_orders", JSON.stringify(orderIds));

    if (orderIds.length === 0) {
        ordersList.innerHTML = '<p class="empty-message">No orders placed yet.</p>';
        return;
    }

    ordersList.innerHTML = '<p class="empty-message">Loading your orders...</p>';

    // Use AppState cache first, only hit API for uncached orders
    const orderPromises = orderIds.map(async (id) => {
        const cached = AppState.orders.find(o => normalizeOrderId(o.pk) === id);
        if (cached) return { ...cached, fetchError: false };

        try {
            const res = await fetch(buildOrderUrl(id));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            AppState.orders.push(data);
            return { ...data, fetchError: false };
        } catch (err) {
            console.error(`Failed to fetch order ${id}:`, err);
            return { pk: id, fetchError: true };
        }
    });

    const orders = await Promise.all(orderPromises);

    // Silently remove any IDs that the API couldn't find (stale legacy data)
    const validOrders = orders.filter(o => !o.fetchError);
    const failedIds = orders.filter(o => o.fetchError).map(o => o.pk);

    if (failedIds.length > 0) {
        const cleanedIds = orderIds.filter(id => !failedIds.includes(id));
        localStorage.setItem("cloudcart_orders", JSON.stringify(cleanedIds));
        console.log(`Removed ${failedIds.length} stale order IDs:`, failedIds);
    }

    if (validOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-message">No orders placed yet.</p>';
        return;
    }

    ordersList.innerHTML = validOrders.map(order => {
        const orderId = normalizeOrderId(order.pk);
        const isCancelled = order.status === 'cancelled';
        const cleanId = orderId.replace("ORDER#", "");

        return `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id-display">
                        <span class="order-id-label">Order ID</span>
                        <span class="order-id-value">${cleanId}</span>
                    </div>
                    <span class="order-status ${order.status}">${order.status}</span>
                </div>
                <div class="order-details">
                    <div class="detail-item">
                        <span class="detail-label">Customer</span>
                        <span class="detail-value">${order.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${order.phone}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Quantity</span>
                        <span class="detail-value">${order.quantity}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total</span>
                        <span class="detail-value">${formatCurrency(order.price * order.quantity)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Date & Time</span>
                        <span class="detail-value">${formatDateTime(new Date(order.timestamp))}</span>
                    </div>
                    <div style="border-top: 1px solid var(--border-color); padding-top: var(--spacing-md); margin-bottom: var(--spacing-md);">
                        <strong>Product Ordered:</strong>
                        <div class="order-product">
                            <div class="order-product-name">${order.product_name}</div>
                            <div class="order-product-details">
                                <span>Qty: ${order.quantity}</span>
                                <span>${formatCurrency(order.price * order.quantity)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="order-actions">
                    ${!isCancelled ? `
                        <button class="cancel-order-btn" onclick="cancelOrder('${orderId}')">
                            <i class="fas fa-times-circle"></i> Cancel Order
                        </button>
                    ` : `
                        <button class="cancel-order-btn disabled" disabled>
                            <i class="fas fa-check-circle"></i> Order Cancelled
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

async function cancelOrder(orderId) {
    orderId = normalizeOrderId(orderId);

    if (!confirm(`Are you sure you want to cancel order ${orderId.replace('ORDER#', '')}?`)) return;

    try {
        const response = await fetch(buildOrderUrl(orderId), {
            method: "DELETE"
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // Update cache immediately so UI reflects cancellation without re-fetch
        const cachedOrder = AppState.orders.find(o => normalizeOrderId(o.pk) === orderId);
        if (cachedOrder) cachedOrder.status = 'cancelled';

        showNotification(`Order ${orderId.replace('ORDER#', '')} cancelled successfully.`);
        await updateOrdersDisplay();

    } catch (error) {
        console.error(`Error cancelling order ${orderId}:`, error);
        alert("Failed to cancel order. Please try again.");
    }
}

// ============================================
// Initialization
// ============================================

function initializeApp() {
    // Clean and normalize all localStorage IDs on startup
    const storedOrderIds = JSON.parse(localStorage.getItem("cloudcart_orders")) || [];
    const validOrderIds = [...new Set(storedOrderIds.map(normalizeOrderId))];
    localStorage.setItem("cloudcart_orders", JSON.stringify(validOrderIds));

    renderProducts();
    updateCartDisplay();
    updateOrdersDisplay();

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', showCheckout);

    const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn');
    if (cancelCheckoutBtn) cancelCheckoutBtn.addEventListener('click', cancelCheckout);

    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);

    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', closeSuccessMessage);

    console.log('CloudCart Application initialized successfully!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
