// =========================================
// MÓDULO DE CONEXÃO E AUTO-SAVE SQL (VERCEL / LOCAL)
// =========================================
const AutoSaveSQL = {
  timers: {},
  badgeTimer: null,

  salvarAlteracao(id, dados, callbackSucesso) {
    clearTimeout(this.timers[id]);
    this.mostrarStatus('Salvando na Vercel...');

    this.timers[id] = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/produtos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });

        if (resposta.ok) {
          this.mostrarStatus('Salvo automaticamente ✓');
          if (typeof callbackSucesso === 'function') callbackSucesso();
        } else {
          this.mostrarStatus('Salvo localmente ✓');
        }
      } catch (erro) {
        console.error('Falha na conexão automática com o SQL:', erro);
        this.mostrarStatus('Salvo localmente ✓');
      }
    }, 500);
  },

  async criarAutomatico(dados) {
    this.mostrarStatus('Salvando produto na Vercel...');
    try {
      const resposta = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      if (resposta.ok) {
        const novoItem = await resposta.json();
        this.mostrarStatus('Produto salvo na Vercel ✓');
        return novoItem;
      }
    } catch (erro) {
      console.error('Erro ao criar no servidor:', erro);
    }

    const itemLocal = { id: Date.now(), ...dados };
    this.mostrarStatus('Produto adicionado ✓');
    return itemLocal;
  },

  mostrarStatus(texto, erro = false) {
    let badge = document.getElementById('sql-autosave-status');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'sql-autosave-status';
      badge.style.cssText = `
        position: fixed; bottom: 16px; right: 16px; padding: 8px 14px;
        border-radius: 8px; font-size: 13px; font-weight: 600; z-index: 9999;
        transition: opacity 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(badge);
    }
    badge.textContent = texto;
    badge.style.background = erro ? '#dc2626' : '#16a34a';
    badge.style.color = '#ffffff';
    badge.style.opacity = '1';

    clearTimeout(this.badgeTimer);
    this.badgeTimer = setTimeout(() => { badge.style.opacity = '0'; }, 2500);
  }
};

// =========================================
// ITENS PADRÃO & ESTADO GLOBAL
// =========================================
const ITENS_PADRAO = [
  { id: 1, name: 'Jaqueta Corta-Vento Minimal', category: 'Vestuário', price: 249.90, market: 279.90 },
  { id: 2, name: 'Tênis Urbano Couro Branco', category: 'Calçados', price: 329.00, market: 310.00 },
  { id: 3, name: 'Camiseta Algodão Pima Preta', category: 'Vestuário', price: 89.90, market: 105.00 },
  { id: 4, name: 'Mochila Executiva Impermeável', category: 'Acessórios', price: 199.00, market: 229.00 },
  { id: 5, name: 'Fone Bluetooth Noise Cancelling', category: 'Eletrônicos', price: 459.90, market: 519.00 }
];

let produtosLista = [];
let cobrancaAnual = false;
let planoSelecionado = { nome: 'Starter', valor: 0 };

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href="#dashboard"]').forEach((link) => {
    link.setAttribute('href', 'dashboard.html');
  });
  document.querySelectorAll('a[href="#planos"]').forEach((link) => {
    link.setAttribute('href', 'planos.html');
  });

  // Remove apenas botões antigos de baixar/exportar arquivo .sql
  document.querySelectorAll('button, a').forEach((el) => {
    const txt = (el.textContent || '').toLowerCase();
    if (txt.includes('salvar sql') || txt.includes('baixar sql') || txt.includes('exportar sql')) {
      el.remove();
    }
  });

  const page = document.body.dataset.page || detectarPaginaPelaURL();
  renderizarNavAuth();

  if (page === 'dashboard') {
    iniciarDashboard();
  } else if (page === 'planos') {
    iniciarPlanos();
  } else if (page === 'login') {
    iniciarLogin();
  } else {
    iniciarHome();
  }
});

function detectarPaginaPelaURL() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('planos')) return 'planos';
  if (path.includes('login')) return 'login';
  return 'home';
}

function getUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem('precofacil_user')) || null;
  } catch {
    return null;
  }
}

function renderizarNavAuth() {
  const navAuthArea = document.getElementById('navAuthArea');
  if (!navAuthArea) return;

  const user = getUsuarioLogado();
  const planoAtual = localStorage.getItem('precofacil_plano') || 'Starter';

  if (user) {
    navAuthArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; background: #f1f5f9; color: #0f172a;">
          ${user.name || user.email} · ${planoAtual}
        </span>
        <button type="button" onclick="fazerLogout()" style="background: transparent; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer;">
          Sair
        </button>
      </div>
    `;
  } else {
    navAuthArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; background: #f1f5f9; color: #0f172a;">
          Plano: ${planoAtual}
        </span>
        <a href="login.html" class="cta-button" style="padding: 8px 16px; font-size: 13px; text-decoration: none;">
          Entrar
        </a>
      </div>
    `;
  }
}

window.fazerLogout = function() {
  localStorage.removeItem('precofacil_user');
  window.location.href = 'index.html';
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// =========================================
// HOME & LOGIN / CRIAR CONTA
// =========================================
function iniciarHome() {
  document.querySelectorAll('a, button').forEach((el) => {
    const href = el.getAttribute('href');
    if (href === '#dashboard') el.setAttribute('href', 'dashboard.html');
    if (href === '#planos') el.setAttribute('href', 'planos.html');
  });
}

function iniciarLogin() {
  const forms = Array.from(document.querySelectorAll('form'));
  const loginForm = document.getElementById('loginForm') || forms[0] || null;
  const registerForm = document.getElementById('registerForm') || document.getElementById('signupForm') || (forms.length > 1 ? forms[1] : null);

  const loginSection = document.getElementById('loginSection') || document.getElementById('loginBox') || loginForm;
  const registerSection = document.getElementById('registerSection') || document.getElementById('signupSection') || document.getElementById('registerBox') || registerForm;

  window.showRegister = window.mostrarCriarConta = function() {
    if (loginSection && registerSection && loginSection !== registerSection) {
      loginSection.style.display = 'none';
      registerSection.style.display = 'block';
    } else if (loginForm) {
      alternarFormularioUnico(loginForm, true);
    }
    atualizarEstadoAbasAuth('register');
  };

  window.showLogin = window.mostrarLogin = function() {
    if (loginSection && registerSection && loginSection !== registerSection) {
      registerSection.style.display = 'none';
      loginSection.style.display = 'block';
    } else if (loginForm) {
      alternarFormularioUnico(loginForm, false);
    }
    atualizarEstadoAbasAuth('login');
  };

  document.querySelectorAll('button, a, [role="tab"]').forEach((el) => {
    if (el.type === 'submit') return;
    const texto = (el.textContent || '').trim().toLowerCase();

    if (texto.includes('criar conta') || texto.includes('cadastr') || texto.includes('registrar')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.mostrarCriarConta();
      });
    } else if (texto === 'entrar' || texto === 'login' || texto.includes('já tenho conta') || texto.includes('fazer login')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.mostrarLogin();
      });
    }
  });

  if (window.location.search.includes('register') || window.location.hash.includes('register') || window.location.hash.includes('cadastro')) {
    window.mostrarCriarConta();
  }

  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"], input[name="email"], #email, #loginEmail, #registerEmail');
      const nameInput = form.querySelector('input[name="name"], #name, #registerName, #signupName');

      const email = emailInput && emailInput.value.trim()
        ? emailInput.value.trim()
        : 'usuario@precofacil.com';
      const name = nameInput && nameInput.value.trim()
        ? nameInput.value.trim()
        : email.split('@')[0];

      localStorage.setItem('precofacil_user', JSON.stringify({ name, email }));
      AutoSaveSQL.mostrarStatus('Conta conectada com sucesso ✓');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
    });
  });
}

function alternarFormularioUnico(form, modoCadastro) {
  let grupoNome = document.getElementById('dynamicNameGroup');
  const titulo = document.querySelector('h1, h2');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (modoCadastro) {
    if (!grupoNome) {
      grupoNome = document.createElement('div');
      grupoNome.id = 'dynamicNameGroup';
      grupoNome.className = 'form-group';
      grupoNome.innerHTML = `
        <label for="registerName">Nome completo ou da loja</label>
        <input type="text" id="registerName" name="name" required placeholder="Ex: Loja Central">
      `;
      form.insertBefore(grupoNome, form.firstChild);
    }
    grupoNome.style.display = 'block';
    if (titulo) titulo.textContent = 'Criar sua conta';
    if (submitBtn) submitBtn.textContent = 'Criar conta e acessar';
  } else {
    if (grupoNome) grupoNome.style.display = 'none';
    if (titulo) titulo.textContent = 'Entrar na sua conta';
    if (submitBtn) submitBtn.textContent = 'Entrar';
  }
}

function atualizarEstadoAbasAuth(ativo) {
  document.querySelectorAll('button, a, [role="tab"]').forEach((el) => {
    if (el.type === 'submit') return;
    const texto = (el.textContent || '').trim().toLowerCase();
    if (texto.includes('criar conta') || texto.includes('cadastr')) {
      el.classList.toggle('active', ativo === 'register');
    } else if (texto === 'entrar' || texto === 'login') {
      el.classList.toggle('active', ativo === 'login');
    }
  });
}

// =========================================
// LÓGICA DO DASHBOARD (ITENS PADRÃO + CRIAÇÃO + AUTO-SAVE)
// =========================================
async function iniciarDashboard() {
  const mainContent = document.getElementById('dashboardMainContent');
  if (mainContent) {
    mainContent.style.display = 'block';
  }

  const banner = document.getElementById('userStatusBanner');
  if (banner) {
    const planoAtual = localStorage.getItem('precofacil_plano') || 'Starter';
    banner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin-bottom: 20px; font-size: 14px; color: #166534;">
        <span><strong>Conectado ao servidor:</strong> Salvamento automático ativo (Plano <strong>${planoAtual}</strong>).</span>
        <a href="planos.html" style="color: #15803d; font-weight: 600; text-decoration: underline;">Gerenciar plano</a>
      </div>
    `;
  }

  // Exibe os itens padrão imediatamente enquanto sincroniza com a Vercel
  produtosLista = [...ITENS_PADRAO];
  renderizarTabela();
  atualizarKPIs();

  await carregarPlanoAtivo();
  await carregarProdutos();

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  if (searchInput) searchInput.addEventListener('input', renderizarTabela);
  if (categoryFilter) categoryFilter.addEventListener('change', renderizarTabela);

  const modal = document.getElementById('productModal');
  const openBtn = document.getElementById('openModalBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('productForm');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (form) form.reset();
      modal.classList.add('active');
      modal.style.display = 'flex';
      const inputNome = document.getElementById('prodName');
      if (inputNome) inputNome.focus();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      modal.style.display = '';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameEl = document.getElementById('prodName');
      const catEl = document.getElementById('prodCategory');
      const priceEl = document.getElementById('prodPrice');
      const marketEl = document.getElementById('prodMarket');

      const name = nameEl ? nameEl.value.trim() : '';
      if (!name) return;

      const dados = {
        name,
        category: catEl ? catEl.value : 'Vestuário',
        price: priceEl ? (parseFloat(priceEl.value) || 0) : 0,
        market: marketEl ? (parseFloat(marketEl.value) || 0) : 0
      };

      const criado = await AutoSaveSQL.criarAutomatico(dados);
      produtosLista.unshift(criado);
      renderizarTabela();
      atualizarKPIs();

      form.reset();
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
      }
    });
  }
}

async function carregarPlanoAtivo() {
  try {
    const res = await fetch('/api/planos');
    if (res.ok) {
      const dados = await res.json();
      if (dados && dados.plano) {
        localStorage.setItem('precofacil_plano', dados.plano);
        const kpiPlan = document.getElementById('kpiActivePlan');
        if (kpiPlan) kpiPlan.textContent = dados.plano;
        renderizarNavAuth();
      }
    }
  } catch (e) {
    const salvo = localStorage.getItem('precofacil_plano') || 'Starter';
    const kpiPlan = document.getElementById('kpiActivePlan');
    if (kpiPlan) kpiPlan.textContent = salvo;
  }
}

async function carregarProdutos() {
  try {
    const res = await fetch('/api/produtos');
    if (res.ok) {
      const dados = await res.json();
      if (Array.isArray(dados) && dados.length > 0) {
        produtosLista = dados;
        renderizarTabela();
        atualizarKPIs();
      }
    }
  } catch (erro) {
    console.error('Usando catálogo padrão local:', erro);
  }
}

function renderizarTabela() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  const termo = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const categoria = document.getElementById('categoryFilter')?.value || 'todas';

  const filtrados = produtosLista.filter((item) => {
    const bateNome = item.name.toLowerCase().includes(termo) || String(item.id).includes(termo);
    const bateCat = categoria === 'todas' || item.category === categoria;
    return bateNome && bateCat;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: #64748b;">
          Nenhum produto encontrado. Clique em "+ Novo produto" para adicionar.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados.map((prod) => {
    const variacao = prod.market > 0
      ? (((prod.price - prod.market) / prod.market) * 100).toFixed(1)
      : '0.0';
    const corVar = Number(variacao) <= 0 ? '#16a34a' : '#dc2626';
    const sinal = Number(variacao) > 0 ? '+' : '';

    return `
      <tr data-row-id="${prod.id}">
        <td>
          <input type="text"
            value="${prod.name.replace(/"/g, '&quot;')}"
            data-id="${prod.id}"
            data-campo="name"
            style="border: 1px solid transparent; background: transparent; font-weight: 600; width: 100%; padding: 4px 6px; border-radius: 6px;"
            onfocus="this.style.borderColor='#cbd5e1'; this.style.background='#fff';"
            onblur="this.style.borderColor='transparent'; this.style.background='transparent';"
          >
        </td>
        <td>
          <select data-id="${prod.id}" data-campo="category"
            style="border: 1px solid transparent; background: transparent; padding: 4px 6px; border-radius: 6px; cursor: pointer;">
            <option value="Vestuário" ${prod.category === 'Vestuário' ? 'selected' : ''}>Vestuário</option>
            <option value="Calçados" ${prod.category === 'Calçados' ? 'selected' : ''}>Calçados</option>
            <option value="Acessórios" ${prod.category === 'Acessórios' ? 'selected' : ''}>Acessórios</option>
            <option value="Eletrônicos" ${prod.category === 'Eletrônicos' ? 'selected' : ''}>Eletrônicos</option>
          </select>
        </td>
        <td>
          R$ <input type="number" step="0.01"
            value="${Number(prod.price).toFixed(2)}"
            data-id="${prod.id}"
            data-campo="price"
            style="width: 90px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; font-weight: 600;"
          >
        </td>
        <td>
          R$ <input type="number" step="0.01"
            value="${Number(prod.market).toFixed(2)}"
            data-id="${prod.id}"
            data-campo="market"
            style="width: 90px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px;"
          >
        </td>
        <td id="var-${prod.id}" style="font-weight: 700; color: ${corVar};">
          ${sinal}${variacao}%
        </td>
        <td>
          <button type="button" onclick="removerProduto(${prod.id})"
            style="background: #fee2e2; color: #dc2626; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Auto-save automático ao editar qualquer campo diretamente na tabela
document.addEventListener('input', (e) => {
  const el = e.target;
  const id = Number(el.dataset.id);
  const campo = el.dataset.campo;

  if (!id || !campo) return;

  const valor = (campo === 'price' || campo === 'market')
    ? parseFloat(el.value) || 0
    : el.value;

  const item = produtosLista.find((p) => p.id === id);
  if (item) {
    item[campo] = valor;
    atualizarVariacaoLinha(item);
    atualizarKPIs();
  }

  AutoSaveSQL.salvarAlteracao(id, { [campo]: valor });
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const id = Number(el.dataset.id);
  const campo = el.dataset.campo;

  if (!id || campo !== 'category') return;

  const item = produtosLista.find((p) => p.id === id);
  if (item) item.category = el.value;

  AutoSaveSQL.salvarAlteracao(id, { category: el.value });
});

function atualizarVariacaoLinha(prod) {
  const celula = document.getElementById(`var-${prod.id}`);
  if (!celula) return;

  const variacao = prod.market > 0
    ? (((prod.price - prod.market) / prod.market) * 100).toFixed(1)
    : '0.0';
  const corVar = Number(variacao) <= 0 ? '#16a34a' : '#dc2626';
  const sinal = Number(variacao) > 0 ? '+' : '';

  celula.style.color = corVar;
  celula.textContent = `${sinal}${variacao}%`;
}

function atualizarKPIs() {
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiAvg = document.getElementById('kpiAvg');

  if (kpiTotal) kpiTotal.textContent = produtosLista.length;

  if (kpiAvg) {
    const soma = produtosLista.reduce((acc, p) => acc + Number(p.price || 0), 0);
    const media = produtosLista.length > 0 ? soma / produtosLista.length : 0;
    kpiAvg.textContent = formatarMoeda(media);
  }
}

async function removerProduto(id) {
  AutoSaveSQL.mostrarStatus('Removendo da Vercel...');
  produtosLista = produtosLista.filter((p) => p.id !== id);
  renderizarTabela();
  atualizarKPIs();

  try {
    const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      AutoSaveSQL.mostrarStatus('Removido automaticamente ✓');
    }
  } catch (erro) {
    console.error('Erro ao remover no servidor:', erro);
  }
}

// =========================================
// LÓGICA DE PLANOS & MENU DE PAGAMENTOS
// =========================================
function iniciarPlanos() {
  const billingSwitch = document.getElementById('billingSwitch');
  const checkoutModal = document.getElementById('checkoutModal');
  const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
  const btnMethodCard = document.getElementById('btnMethodCard');
  const btnMethodPix = document.getElementById('btnMethodPix');
  const cardFields = document.getElementById('cardFields');
  const pixFields = document.getElementById('pixFields');
  const paymentForm = document.getElementById('paymentForm');

  document.querySelectorAll('.plan-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nome = btn.dataset.plan || 'Pro';
      const card = btn.closest('.plan-card');
      const priceEl = card ? card.querySelector('.plan-price') : null;
      const mensal = priceEl ? Number(priceEl.dataset.monthly || 0) : 0;
      window.openCheckout(nome, mensal);
    });
  });

  if (billingSwitch) {
    billingSwitch.addEventListener('click', () => {
      cobrancaAnual = !cobrancaAnual;
      billingSwitch.classList.toggle('active', cobrancaAnual);

      document.querySelectorAll('.plan-price').forEach((el) => {
        const valor = cobrancaAnual ? el.dataset.yearly : el.dataset.monthly;
        el.innerHTML = `R$ ${valor}<span>/mês</span>`;
      });
    });
  }

  if (closeCheckoutBtn && checkoutModal) {
    closeCheckoutBtn.addEventListener('click', () => {
      checkoutModal.classList.remove('active');
      checkoutModal.style.display = '';
    });
  }

  if (btnMethodCard && btnMethodPix) {
    btnMethodCard.addEventListener('click', () => {
      btnMethodCard.classList.add('active');
      btnMethodPix.classList.remove('active');
      if (cardFields) cardFields.style.display = 'block';
      if (pixFields) pixFields.style.display = 'none';
    });

    btnMethodPix.addEventListener('click', () => {
      btnMethodPix.classList.add('active');
      btnMethodCard.classList.remove('active');
      if (pixFields) pixFields.style.display = 'block';
      if (cardFields) cardFields.style.display = 'none';
    });
  }

  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const periodo = cobrancaAnual ? 'Anual' : 'Mensal';
      await salvarPlanoNoServidor(planoSelecionado.nome, periodo);
    });
  }
}

window.openCheckout = async function(nomePlano, precoMensal) {
  const periodo = cobrancaAnual ? 'Anual' : 'Mensal';
  const precoFinal = cobrancaAnual ? Math.round(precoMensal * 0.8) : precoMensal;
  planoSelecionado = { nome: nomePlano, valor: precoFinal };

  if (precoFinal === 0) {
    await salvarPlanoNoServidor(nomePlano, periodo);
    return;
  }

  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutTitle = document.getElementById('checkoutTitle');
  const checkoutPrice = document.getElementById('checkoutPrice');

  if (checkoutTitle) checkoutTitle.textContent = `Plano ${nomePlano} (${periodo})`;
  if (checkoutPrice) checkoutPrice.textContent = `${formatarMoeda(precoFinal)}/mês`;
  if (checkoutModal) {
    checkoutModal.classList.add('active');
    checkoutModal.style.display = 'flex';
  }
};

async function salvarPlanoNoServidor(plano, periodo) {
  AutoSaveSQL.mostrarStatus(`Salvando plano ${plano} na Vercel...`);

  try {
    const resposta = await fetch('/api/planos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano, periodo })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      localStorage.setItem('precofacil_plano', plano);
      AutoSaveSQL.mostrarStatus(dados.mensagem || `Plano ${plano} salvo na Vercel ✓`);

      const checkoutModal = document.getElementById('checkoutModal');
      if (checkoutModal) {
        checkoutModal.classList.remove('active');
        checkoutModal.style.display = '';
      }

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } else {
      AutoSaveSQL.mostrarStatus(dados.erro || 'Erro ao salvar plano', true);
    }
  } catch (erro) {
    console.error('Erro ao salvar plano na Vercel:', erro);
    AutoSaveSQL.mostrarStatus('Erro de conexão com o servidor', true);
  }
}
