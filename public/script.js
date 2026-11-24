// =========================================
// 1. BANCO DE DADOS LOCAL SEPARADO POR USUÁRIO
// =========================================
const DB_KEY = 'preco_facil_sistema_v3';

const defaultProductsTemplate = [
  { name: "Jaqueta Corta-Vento Minimal", category: "Vestuário", price: 249.90, market: 279.90 },
  { name: "Tênis Urbano Couro Branco", category: "Calçados", price: 329.00, market: 310.00 },
  { name: "Camiseta Algodão Pima Preta", category: "Vestuário", price: 89.90, market: 105.00 },
  { name: "Mochila Executiva Impermeável", category: "Acessórios", price: 199.00, market: 229.00 },
  { name: "Relógio Smart Fit Pro", category: "Eletrônicos", price: 459.00, market: 440.00 }
];

function getDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const initial = {
    users: [],
    currentUserId: null,
    products: []
  };
  saveDB(initial);
  return initial;
}

function saveDB(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {}
}

let db = getDB();

function getLoggedUser() {
  db = getDB();
  if (!db.currentUserId) return null;
  return db.users.find(u => u.id === db.currentUserId) || null;
}

function getUserProducts(userId) {
  db = getDB();
  return db.products.filter(p => p.userId === userId);
}

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// =========================================
// 2. MENU MOBILE E NAVEGAÇÃO SPA
// =========================================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileDrawer = document.getElementById('mobileDrawer');

if (mobileMenuBtn && mobileDrawer) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileDrawer.classList.toggle('open');
  });
}

function closeMobileMenu() {
  if (mobileDrawer) mobileDrawer.classList.remove('open');
}

function navigateTo(pageName) {
  const user = getLoggedUser();

  if (pageName === 'dashboard') {
    if (!user) {
      showToast('Faça login ou crie uma conta para acessar o Dashboard.');
      pageName = 'login';
    } else if (!user.plan) {
      showToast('Ative um plano (Starter grátis ou pago) para liberar o Dashboard.');
      pageName = 'planos';
    }
  }

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(`view-${pageName}`);
  if (targetView) targetView.classList.add('active');

  document.querySelectorAll('.nav-links a, .mobile-drawer a').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === pageName);
  });

  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  updateNavbarAuth();
  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'planos') highlightCurrentPlan();
}

function updateNavbarAuth() {
  const navAuthArea = document.getElementById('navAuthArea');
  const user = getLoggedUser();

  if (user) {
    const planLabel = user.plan ? user.plan : 'Sem plano';
    navAuthArea.innerHTML = `
      <div class="user-menu">
        <div class="user-pill">
          <span>${user.name.split(' ')[0]}</span>
          <span class="plan-tag">${planLabel}</span>
        </div>
        <button type="button" class="btn-logout" onclick="logoutUser()">Sair</button>
      </div>
    `;
  } else {
    navAuthArea.innerHTML = `
      <button type="button" class="nav-cta" onclick="navigateTo('login')">
        Entrar / Criar conta
      </button>
    `;
  }
}

function logoutUser() {
  db = getDB();
  db.currentUserId = null;
  saveDB(db);
  showToast('Você saiu da sua conta.');
  navigateTo('home');
}

// =========================================
// 3. LOGIN E CRIAR CONTA
// =========================================
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authAlert = document.getElementById('authAlert');

function showAuthAlert(msg, type) {
  authAlert.textContent = msg;
  authAlert.className = `auth-alert ${type}`;
}

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  authAlert.className = 'auth-alert';
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.style.display = 'block';
  loginForm.style.display = 'none';
  authAlert.className = 'auth-alert';
});

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;

  db = getDB();
  if (db.users.some(u => u.email === email)) {
    showAuthAlert('Este e-mail já está cadastrado. Faça login.', 'error');
    return;
  }

  const newUserId = Date.now();
  const newUser = {
    id: newUserId,
    name,
    email,
    password,
    plan: null,
    billing: null
  };

  defaultProductsTemplate.forEach((item, index) => {
    db.products.push({
      id: newUserId + index + 1,
      userId: newUserId,
      name: item.name,
      category: item.category,
      price: item.price,
      market: item.market
    });
  });

  db.users.push(newUser);
  db.currentUserId = newUserId;
  saveDB(db);

  registerForm.reset();
  authAlert.className = 'auth-alert';
  showToast(`Bem-vindo, ${name}! Escolha um plano para liberar o Dashboard.`);
  navigateTo('planos');
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  db = getDB();
  const foundUser = db.users.find(u => u.email === email && u.password === password);

  if (!foundUser) {
    showAuthAlert('E-mail ou senha incorretos.', 'error');
    return;
  }

  db.currentUserId = foundUser.id;
  saveDB(db);

  loginForm.reset();
  authAlert.className = 'auth-alert';

  if (foundUser.plan) {
    showToast(`Login realizado! Bem-vindo de volta, ${foundUser.name}.`);
    navigateTo('dashboard');
  } else {
    showToast('Login realizado! Escolha um plano para acessar o Dashboard.');
    navigateTo('planos');
  }
});

// =========================================
// 4. DASHBOARD ANALÍTICO, GRÁFICOS E INSIGHTS
// =========================================
function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');

function renderDashboard() {
  const user = getLoggedUser();
  if (!user || !user.plan) return;

  const userProducts = getUserProducts(user.id);
  const banner = document.getElementById('userStatusBanner');
  const planLimitEl = document.getElementById('kpiPlanLimit');

  planLimitEl.textContent = user.plan !== 'Starter'
    ? `Plano ${user.plan} (Ilimitado)`
    : `${userProducts.length} de 10 itens (Plano Starter)`;

  banner.innerHTML = `
    <span>Conta: <strong>${user.name}</strong> · Assinatura: <strong>Plano ${user.plan}</strong> (${user.billing}).</span>
    <a href="#planos" onclick="navigateTo('planos'); return false;" style="color: #2563eb; font-weight: 600; text-decoration: none;">Alterar plano →</a>
  `;

  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = userProducts.filter(item => {
    const matchesName = item.name.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === 'todas' || item.category === selectedCategory;
    const isCompetitive = item.price <= item.market;
    const matchesStatus =
      selectedStatus === 'todos' ||
      (selectedStatus === 'competitivo' && isCompetitive) ||
      (selectedStatus === 'acima' && !isCompetitive);

    return matchesName && matchesCategory && matchesStatus;
  });

  document.getElementById('kpiTotal').textContent = filtered.length;

  const avgUser = filtered.length
    ? filtered.reduce((acc, item) => acc + item.price, 0) / filtered.length
    : 0;
  const avgMarket = filtered.length
    ? filtered.reduce((acc, item) => acc + item.market, 0) / filtered.length
    : 0;

  document.getElementById('kpiAvg').textContent = formatCurrency(avgUser);
  document.getElementById('kpiMarketAvg').textContent = `Média mercado: ${formatCurrency(avgMarket)}`;

  const competitiveCount = filtered.filter(i => i.price <= i.market).length;
  const compPercent = filtered.length ? Math.round((competitiveCount / filtered.length) * 100) : 0;
  document.getElementById('kpiCompetitive').textContent = `${compPercent}%`;
  document.getElementById('kpiCompetitiveSub').textContent = `${competitiveCount} de ${filtered.length} itens competitivos`;

  const diffGeral = avgMarket > 0 ? (((avgUser - avgMarket) / avgMarket) * 100).toFixed(1) : 0;
  const diffEl = document.getElementById('kpiDiffAvg');
  const diffLabel = document.getElementById('kpiDiffLabel');
  diffEl.textContent = `${diffGeral > 0 ? '+' : ''}${diffGeral}%`;
  if (diffGeral <= 0) {
    diffLabel.textContent = 'Preços mais atrativos que o mercado';
    diffLabel.className = 'kpi-trend trend-up';
  } else {
    diffLabel.textContent = 'Acima da média dos concorrentes';
    diffLabel.className = 'kpi-trend trend-down';
  }

  renderCharts(userProducts);
  renderInsights(userProducts);

  const tableBody = document.getElementById('productsTableBody');
  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: #6b7280; justify-content: center;">
          Nenhum produto encontrado para os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(item => {
    const diffPercent = (((item.price - item.market) / item.market) * 100).toFixed(1);
    const isCheaper = item.price <= item.market;
    const badgeClass = isCheaper ? 'var-pos' : 'var-neg';
    const sign = diffPercent > 0 ? '+' : '';
    const statusText = isCheaper ? 'Competitivo' : 'Acima da média';
    const statusClass = isCheaper ? 'status-ok' : 'status-alert';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Produto"><strong>${item.name}</strong></td>
      <td data-label="Categoria"><span class="badge-cat">${item.category}</span></td>
      <td data-label="Seu Preço"><strong>${formatCurrency(item.price)}</strong></td>
      <td data-label="Média Mercado">${formatCurrency(item.market)}</td>
      <td data-label="Diferença"><span class="badge-var ${badgeClass}">${sign}${diffPercent}%</span></td>
      <td data-label="Status"><span class="status-pill ${statusClass}">${statusText}</span></td>
      <td data-label="Ações">
        <div class="table-actions">
          <button type="button" class="btn-edit" onclick="openEditModal(${item.id})">Editar</button>
          <button type="button" class="btn-delete" onclick="deleteProduct(${item.id})">Remover</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderCharts(userProducts) {
  const compContainer = document.getElementById('priceComparisonChart');
  const catContainer = document.getElementById('categoryDistributionChart');

  if (userProducts.length === 0) {
    compContainer.innerHTML = '<p style="color:#6b7280; font-size:13px;">Cadastre produtos para visualizar o gráfico.</p>';
    catContainer.innerHTML = '<p style="color:#6b7280; font-size:13px;">Sem categorias registradas.</p>';
    return;
  }

  const topProducts = userProducts.slice(0, 5);
  const maxVal = Math.max(...topProducts.map(p => Math.max(p.price, p.market)));

  compContainer.innerHTML = topProducts.map(p => {
    const userWidth = Math.round((p.price / maxVal) * 100);
    const marketWidth = Math.round((p.market / maxVal) * 100);
    return `
      <div class="comp-row">
        <div class="comp-top">
          <span class="comp-name">${p.name}</span>
          <span class="comp-values">Você: <strong>${formatCurrency(p.price)}</strong> · Mercado: ${formatCurrency(p.market)}</span>
        </div>
        <div class="comp-bars">
          <div class="comp-bar-track"><div class="comp-bar-fill-user" style="width: ${userWidth}%"></div></div>
          <div class="comp-bar-track"><div class="comp-bar-fill-market" style="width: ${marketWidth}%"></div></div>
        </div>
      </div>
    `;
  }).join('');

  const categoryMap = {};
  userProducts.forEach(p => {
    if (!categoryMap[p.category]) categoryMap[p.category] = { count: 0, totalValue: 0 };
    categoryMap[p.category].count += 1;
    categoryMap[p.category].totalValue += p.price;
  });

  catContainer.innerHTML = Object.entries(categoryMap).map(([cat, info]) => {
    const percent = Math.round((info.count / userProducts.length) * 100);
    return `
      <div class="cat-row">
        <div class="cat-info">
          <strong>${cat} (${info.count} ${info.count === 1 ? 'item' : 'itens'})</strong>
          <span>${percent}% · Soma: ${formatCurrency(info.totalValue)}</span>
        </div>
        <div class="cat-track">
          <div class="cat-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderInsights(userProducts) {
  const grid = document.getElementById('smartInsightsGrid');

  if (userProducts.length === 0) {
    grid.innerHTML = `
      <div class="insight-card info">
        <span class="insight-badge">Comece agora</span>
        <h4>Adicione seu primeiro produto</h4>
        <p>Cadastre itens com o preço de mercado para receber análises automáticas de margem e competitividade.</p>
      </div>
    `;
    return;
  }

  const cheapest = [...userProducts].sort((a, b) => (a.price - a.market) / a.market - (b.price - b.market) / b.market)[0];
  const cheapestDiff = (((cheapest.price - cheapest.market) / cheapest.market) * 100).toFixed(1);

  const mostExpensive = [...userProducts].sort((a, b) => (b.price - b.market) / b.market - (a.price - a.market) / a.market)[0];
  const expensiveDiff = (((mostExpensive.price - mostExpensive.market) / mostExpensive.market) * 100).toFixed(1);

  let cardsHTML = '';

  if (cheapestDiff < -5) {
    const suggestedPrice = (cheapest.market * 0.97).toFixed(2);
    cardsHTML += `
      <div class="insight-card opportunity">
        <span class="insight-badge">Oportunidade de Margem</span>
        <h4>Reajuste seguro em "${cheapest.name}"</h4>
        <p>Seu preço está <strong>${Math.abs(cheapestDiff)}% abaixo</strong> do mercado. Você pode subir para <strong>R$ ${suggestedPrice}</strong> e ainda continuar mais barato que a concorrência.</p>
      </div>
    `;
  } else {
    cardsHTML += `
      <div class="insight-card opportunity">
        <span class="insight-badge">Margem Otimizada</span>
        <h4>Preços bem posicionados</h4>
        <p>Seus produtos competitivos estão com margem saudável, próximos ao teto ideal sem perder atratividade.</p>
      </div>
    `;
  }

  if (expensiveDiff > 0) {
    cardsHTML += `
      <div class="insight-card warning">
        <span class="insight-badge">Alerta de Competitividade</span>
        <h4>Revise "${mostExpensive.name}"</h4>
        <p>Este item está <strong>+${expensiveDiff}% acima</strong> da média (${formatCurrency(mostExpensive.market)}). Considere uma promoção ou ajuste para evitar perda de vendas.</p>
      </div>
    `;
  } else {
    cardsHTML += `
      <div class="insight-card opportunity">
        <span class="insight-badge">100% Competitivo</span>
        <h4>Nenhum item acima do mercado</h4>
        <p>Todos os seus produtos estão iguais ou abaixo da média dos concorrentes. Excelente momento para campanhas de divulgação.</p>
      </div>
    `;
  }

  cardsHTML += `
    <div class="insight-card info">
      <span class="insight-badge">Dica de Gestão</span>
      <h4>Mantenha o mercado atualizado</h4>
      <p>Revise a coluna "Média Mercado" a cada 15 dias ou exporte seu catálogo em CSV para acompanhar a evolução sazonal.</p>
    </div>
  `;

  grid.innerHTML = cardsHTML;
}

function deleteProduct(id) {
  const user = getLoggedUser();
  if (!user) return;

  db = getDB();
  db.products = db.products.filter(item => !(item.id === id && item.userId === user.id));
  saveDB(db);
  renderDashboard();
  showToast('Produto removido da sua conta.');
}

function exportToCSV() {
  const user = getLoggedUser();
  if (!user) return;
  const list = getUserProducts(user.id);
  if (list.length === 0) {
    showToast('Não há produtos para exportar.');
    return;
  }

  let csv = 'Produto;Categoria;Seu Preco;Media Mercado\n';
  list.forEach(p => {
    csv += `${p.name};${p.category};${p.price.toFixed(2)};${p.market.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `catalogo_${user.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
  link.click();
  showToast('Planilha CSV baixada com sucesso!');
}

searchInput.addEventListener('input', renderDashboard);
categoryFilter.addEventListener('change', renderDashboard);
statusFilter.addEventListener('change', renderDashboard);

// Modal Adicionar / Editar Produto
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');

openModalBtn.addEventListener('click', () => {
  const user = getLoggedUser();
  if (!user) return;

  const userProducts = getUserProducts(user.id);
  if (user.plan === 'Starter' && userProducts.length >= 10) {
    showToast('Limite de 10 produtos do plano Starter atingido! Faça upgrade.');
    navigateTo('planos');
    return;
  }

  document.getElementById('productModalTitle').textContent = 'Adicionar novo produto';
  document.getElementById('editProdId').value = '';
  productForm.reset();
  productModal.classList.add('open');
});

function openEditModal(id) {
  const user = getLoggedUser();
  if (!user) return;
  const prod = getUserProducts(user.id).find(p => p.id === id);
  if (!prod) return;

  document.getElementById('productModalTitle').textContent = 'Editar produto';
  document.getElementById('editProdId').value = prod.id;
  document.getElementById('prodName').value = prod.name;
  document.getElementById('prodCategory').value = prod.category;
  document.getElementById('prodPrice').value = prod.price;
  document.getElementById('prodMarket').value = prod.market;
  productModal.classList.add('open');
}

closeModalBtn.addEventListener('click', () => productModal.classList.remove('open'));

productForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = getLoggedUser();
  if (!user) return;

  db = getDB();
  const editId = document.getElementById('editProdId').value;
  const name = document.getElementById('prodName').value;
  const category = document.getElementById('prodCategory').value;
  const price = parseFloat(document.getElementById('prodPrice').value);
  const market = parseFloat(document.getElementById('prodMarket').value);

  if (editId) {
    const idx = db.products.findIndex(p => p.id === Number(editId) && p.userId === user.id);
    if (idx !== -1) {
      db.products[idx] = { ...db.products[idx], name, category, price, market };
      showToast('Produto atualizado com sucesso!');
    }
  } else {
    db.products.unshift({
      id: Date.now(),
      userId: user.id,
      name,
      category,
      price,
      market
    });
    showToast('Produto salvo na sua conta!');
  }

  saveDB(db);
  productForm.reset();
  productModal.classList.remove('open');
  renderDashboard();
});

// =========================================
// 5. PLANOS E CHECKOUT DE PAGAMENTO
// =========================================
const billingSwitch = document.getElementById('billingSwitch');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
const btnMethodCard = document.getElementById('btnMethodCard');
const btnMethodPix = document.getElementById('btnMethodPix');
const cardFields = document.getElementById('cardFields');
const pixFields = document.getElementById('pixFields');
const paymentForm = document.getElementById('paymentForm');

let isYearly = false;
let selectedPlanData = { name: 'Pro', price: 79 };

billingSwitch.addEventListener('click', () => {
  isYearly = !isYearly;
  billingSwitch.classList.toggle('yearly', isYearly);

  document.querySelectorAll('.plan-price').forEach(el => {
    const value = isYearly ? el.dataset.yearly : el.dataset.monthly;
    el.innerHTML = `R$ ${value}<span>/mês</span>`;
  });
});

function highlightCurrentPlan() {
  const user = getLoggedUser();
  document.querySelectorAll('.plan-btn').forEach(btn => {
    if (user && user.plan === btn.dataset.plan) {
      btn.textContent = 'Plano atual';
      btn.style.opacity = '0.7';
    } else {
      if (btn.dataset.plan === 'Starter') btn.textContent = 'Ativar grátis';
      if (btn.dataset.plan === 'Pro') btn.textContent = 'Assinar plano Pro';
      if (btn.dataset.plan === 'Business') btn.textContent = 'Assinar Business';
      btn.style.opacity = '1';
    }
  });
}

function updateUserPlan(newPlan, billingPeriod) {
  db = getDB();
  const userIndex = db.users.findIndex(u => u.id === db.currentUserId);
  if (userIndex === -1) return;

  db.users[userIndex].plan = newPlan;
  db.users[userIndex].billing = billingPeriod;
  saveDB(db);
}

function openCheckout(planName, monthlyBasePrice) {
  const user = getLoggedUser();

  if (!user) {
    showToast('Crie uma conta ou faça login antes de escolher um plano.');
    navigateTo('login');
    return;
  }

  if (monthlyBasePrice === 0) {
    updateUserPlan('Starter', 'Mensal');
    showToast('Plano Starter ativado! Dashboard liberado.');
    navigateTo('dashboard');
    return;
  }

  const finalPrice = isYearly ? Math.round(monthlyBasePrice * 0.8) : monthlyBasePrice;
  selectedPlanData = { name: planName, price: finalPrice };

  document.getElementById('checkoutTitle').textContent = `Plano ${planName} (${isYearly ? 'Anual' : 'Mensal'})`;
  document.getElementById('checkoutPrice').textContent = `R$ ${finalPrice},00/mês`;
  checkoutModal.classList.add('open');
}

closeCheckoutBtn.addEventListener('click', () => checkoutModal.classList.remove('open'));

btnMethodCard.addEventListener('click', () => {
  btnMethodCard.classList.add('active');
  btnMethodPix.classList.remove('active');
  cardFields.style.display = 'block';
  pixFields.style.display = 'none';
});

btnMethodPix.addEventListener('click', () => {
  btnMethodPix.classList.add('active');
  btnMethodCard.classList.remove('active');
  pixFields.style.display = 'block';
  cardFields.style.display = 'none';
});

document.getElementById('cardNumber').addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '');
  val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
  e.target.value = val;
});

paymentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const confirmBtn = document.getElementById('confirmPayBtn');
  confirmBtn.textContent = 'Processando pagamento...';
  confirmBtn.disabled = true;

  setTimeout(() => {
    updateUserPlan(selectedPlanData.name, isYearly ? 'Anual' : 'Mensal');
    confirmBtn.textContent = 'Confirmar pagamento';
    confirmBtn.disabled = false;
    checkoutModal.classList.remove('open');

    showToast(`Pagamento aprovado! Plano ${selectedPlanData.name} ativo.`);
    navigateTo('dashboard');
  }, 1200);
});

updateNavbarAuth();