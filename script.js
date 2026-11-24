// =========================================
// 1. DADOS INICIAIS DO DASHBOARD
// =========================================
let products = [
  { id: 1, name: "Jaqueta Corta-Vento Minimal", category: "Vestuário", price: 249.90, market: 279.90 },
  { id: 2, name: "Tênis Urbano Couro Branco", category: "Calçados", price: 329.00, market: 310.00 },
  { id: 3, name: "Camiseta Algodão Pima Preta", category: "Vestuário", price: 89.90, market: 105.00 },
  { id: 4, name: "Mochila Executiva Impermeável", category: "Acessórios", price: 199.00, market: 229.00 },
  { id: 5, name: "Relógio Smart Fit Pro", category: "Eletrônicos", price: 459.00, market: 440.00 },
  { id: 6, name: "Calça Alfaiataria Slim", category: "Vestuário", price: 189.90, market: 215.00 }
];

// Formatar moeda para Real (R$)
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =========================================
// 2. RENDERIZAÇÃO E FILTROS DO DASHBOARD
// =========================================
const tableBody = document.getElementById('productsTableBody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');

function renderDashboard() {
  if (!tableBody) return; // Só executa se estiver na página dashboard.html

  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filtered = products.filter(item => {
    const matchesName = item.name.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === 'todas' || item.category === selectedCategory;
    return matchesName && matchesCategory;
  });

  // Atualizar KPIs
  document.getElementById('kpiTotal').textContent = filtered.length;
  const avgPrice = filtered.length
    ? filtered.reduce((acc, item) => acc + item.price, 0) / filtered.length
    : 0;
  document.getElementById('kpiAvg').textContent = formatCurrency(avgPrice);

  // Renderizar linhas da tabela
  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: #6b7280;">
          Nenhum produto encontrado para os filtros selecionados.
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

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td><span class="badge-cat">${item.category}</span></td>
      <td><strong>${formatCurrency(item.price)}</strong></td>
      <td>${formatCurrency(item.market)}</td>
      <td><span class="badge-var ${badgeClass}">${sign}${diffPercent}%</span></td>
      <td><button class="btn-delete" onclick="deleteProduct(${item.id})">Remover</button></td>
    `;
    tableBody.appendChild(row);
  });
}

function deleteProduct(id) {
  products = products.filter(item => item.id !== id);
  renderDashboard();
}

// Eventos de busca e filtro
if (searchInput && categoryFilter) {
  searchInput.addEventListener('input', renderDashboard);
  categoryFilter.addEventListener('change', renderDashboard);
  renderDashboard();
}

// =========================================
// 3. MODAL DE ADICIONAR PRODUTO
// =========================================
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');

if (openModalBtn && productModal) {
  openModalBtn.addEventListener('click', () => productModal.classList.add('open'));
  closeModalBtn.addEventListener('click', () => productModal.classList.remove('open'));

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newProduct = {
      id: Date.now(),
      name: document.getElementById('prodName').value,
      category: document.getElementById('prodCategory').value,
      price: parseFloat(document.getElementById('prodPrice').value),
      market: parseFloat(document.getElementById('prodMarket').value)
    };

    products.unshift(newProduct);
    productForm.reset();
    productModal.classList.remove('open');
    renderDashboard();
  });
}

// =========================================
// 4. INTERATIVIDADE DA PÁGINA DE PLANOS
// =========================================
const billingSwitch = document.getElementById('billingSwitch');
let isYearly = false;

if (billingSwitch) {
  billingSwitch.addEventListener('click', () => {
    isYearly = !isYearly;
    billingSwitch.classList.toggle('yearly', isYearly);

    const priceElements = document.querySelectorAll('.plan-price');
    priceElements.forEach(el => {
      const value = isYearly ? el.dataset.yearly : el.dataset.monthly;
      el.innerHTML = `R$ ${value}<span>/mês</span>`;
    });
  });
}

function selectPlan(planName) {
  const period = isYearly ? 'Anual' : 'Mensal';
  alert(`Você selecionou o plano ${planName} (${period})! Redirecionando para configuração...`);
}
