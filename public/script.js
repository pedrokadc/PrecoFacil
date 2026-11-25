// =========================================
// MÓDULO DE CONEXÃO E AUTO-SAVE SQL (VERCEL / LOCAL)
// =========================================
const AutoSaveSQL = {
  timers: {},
  badgeTimer: null,

  // Dispara UPDATE SQL 600ms após o usuário parar de digitar/alterar
  salvarAlteracao(id, dados, callbackSucesso) {
    clearTimeout(this.timers[id]);
    this.mostrarStatus('Salvando no banco...');

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
          this.mostrarStatus('Erro ao salvar', true);
        }
      } catch (erro) {
        console.error('Falha na conexão automática com o SQL:', erro);
        this.mostrarStatus('Sem conexão com o servidor', true);
      }
    }, 600);
  },

  // Insere novo registro imediatamente (INSERT)
  async criarAutomatico(dados) {
    this.mostrarStatus('Salvando novo item...');
    const resposta = await fetch('/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const novoItem = await resposta.json();
    this.mostrarStatus('Salvo automaticamente ✓');
    return novoItem;
  },

  // Indicador visual discreto no canto inferior direito
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
// ESTADO GLOBAL & INICIALIZAÇÃO POR PÁGINA
// =========================================
let produtosLista = [];
let cobrancaAnual = false;
let planoSelecionado = { nome: 'Starter', valor: 0 };

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  renderizarNavAuth();

  if (page === 'dashboard') {
    iniciarDashboard();
  } else if (page === 'planos') {
    iniciarPlanos();
  }
});

function renderizarNavAuth() {
  const navAuthArea = document.getElementById('navAuthArea');
  if (!navAuthArea) return;

  const planoAtual = localStorage.getItem('precofacil_plano') || 'Starter';
  navAuthArea.innerHTML = `
    <span style="font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; background: #f1f5f9; color: #0f172a;">
      Plano: ${planoAtual}
    </span>
  `;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// =========================================
// LÓGICA DO DASHBOARD (AUTO-SAVE INLINE)
// =========================================
async function iniciarDashboard() {
  const mainContent = document.getElementById('dashboardMainContent');
  if (mainContent) mainContent.style.display = 'block';

  await carregarPlanoAtivo();
  await carregarProdutos();

  // Busca e filtros
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  if (searchInput) searchInput.addEventListener('input', renderizarTabela);
  if (categoryFilter) categoryFilter.addEventListener('change', renderizarTabela);

  // Modal de Novo Produto (criação rápida + auto-save)
  const modal = document.getElementById('productModal');
  const openBtn = document.getElementById('openModalBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('productForm');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const novoProduto = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value) || 0,
        market: parseFloat(document.getElementById('prodMarket').value) || 0
      };

      const criado = await AutoSaveSQL.criarAutomatico(novoProduto);
      produtosLista.unshift(criado);
      renderizarTabela();
      atualizarKPIs();
      form.reset();
      if (modal) modal.classList.remove('active');
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
      produtosLista = await res.json();
      renderizarTabela();
      atualizarKPIs();
    }
  } catch (erro) {
    console.error('Erro ao carregar produtos:', erro);
    AutoSaveSQL.mostrarStatus('Erro ao carregar dados do banco', true);
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

// Listener global de Auto-Save para qualquer campo editado na tabela (sem botão salvar)
document.addEventListener('input', (e) => {
  const el = e.target;
  const id = Number(el.dataset.id);
  const campo = el.dataset.campo;

  if (!id || !campo) return;

  const valor = (campo === 'price' || campo === 'market')
    ? parseFloat(el.value) || 0
    : el.value;

  // Atualiza estado local imediatamente e recalcula variação/KPIs
  const item = produtosLista.find((p) => p.id === id);
  if (item) {
    item[campo] = valor;
    atualizarVariacaoLinha(item);
    atualizarKPIs();
  }

  // Envia UPDATE SQL automático para o servidor
  AutoSaveSQL.salvarAlteracao(id, { [campo]: valor });
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
  AutoSaveSQL.mostrarStatus('Removendo...');
  try {
    const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      produtosLista = produtosLista.filter((p) => p.id !== id);
      renderizarTabela();
      atualizarKPIs();
      AutoSaveSQL.mostrarStatus('Removido do banco ✓');
    }
  } catch (erro) {
    console.error('Erro ao remover:', erro);
    AutoSaveSQL.mostrarStatus('Erro ao remover', true);
  }
}

// =========================================
// LÓGICA DE PLANOS (SALVA DIRETO NA VERCEL SEM BAIXAR .SQL)
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

  // Alternar Mensal / Anual (-20%)
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

  // Fechar modal de checkout
  if (closeCheckoutBtn && checkoutModal) {
    closeCheckoutBtn.addEventListener('click', () => {
      checkoutModal.classList.remove('active');
    });
  }

  // Alternar abas Cartão / PIX
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

  // Confirmar pagamento / ativação -> Envia POST direto para /api/planos na Vercel
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const periodo = cobrancaAnual ? 'Anual' : 'Mensal';
      await salvarPlanoNoServidor(planoSelecionado.nome, periodo);
    });
  }
}

// Função chamada pelo onclick="openCheckout('Starter', 0)" do planos.html
window.openCheckout = async function(nomePlano, precoMensal) {
  const periodo = cobrancaAnual ? 'Anual' : 'Mensal';
  const precoFinal = cobrancaAnual ? Math.round(precoMensal * 0.8) : precoMensal;
  planoSelecionado = { nome: nomePlano, valor: precoFinal };

  // Se for plano gratuito (Starter), ativa e salva imediatamente na Vercel sem abrir checkout
  if (precoFinal === 0) {
    await salvarPlanoNoServidor(nomePlano, periodo);
    return;
  }

  // Abre modal de checkout para planos pagos
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutTitle = document.getElementById('checkoutTitle');
  const checkoutPrice = document.getElementById('checkoutPrice');

  if (checkoutTitle) checkoutTitle.textContent = `Plano ${nomePlano} (${periodo})`;
  if (checkoutPrice) checkoutPrice.textContent = `${formatarMoeda(precoFinal)}/mês`;
  if (checkoutModal) checkoutModal.classList.add('active');
};

// Salva a assinatura diretamente no banco da Vercel (sem gerar download de arquivo .sql)
async function salvarPlanoNoServidor(plano, periodo) {
  AutoSaveSQL.mostrarStatus(`Ativando plano ${plano}...`);

  try {
    const resposta = await fetch('/api/planos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano, periodo })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      localStorage.setItem('precofacil_plano', plano);
      AutoSaveSQL.mostrarStatus(dados.mensagem || `Plano ${plano} salvo com sucesso ✓`);

      const checkoutModal = document.getElementById('checkoutModal');
      if (checkoutModal) checkoutModal.classList.remove('active');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } else {
      AutoSaveSQL.mostrarStatus(dados.erro || 'Erro ao ativar plano', true);
    }
  } catch (erro) {
    console.error('Erro ao salvar plano na Vercel:', erro);
    AutoSaveSQL.mostrarStatus('Erro de conexão com o servidor', true);
  }
}
