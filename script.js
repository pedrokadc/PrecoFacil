// =========================================
// 1. BANCO DE DADOS SQLITE COM GRAVAÇÃO OBRIGATÓRIA EM DISCO RÍGIDO
// =========================================
const SQLITE_BIN_KEY = 'preco_facil_sqlite_binary_v2';
const SESSION_KEY = 'preco_facil_session_user_id';

const defaultProductsTemplate = [
  { name: "Jaqueta Corta-Vento Minimal", category: "Vestuário", price: 249.90, market: 279.90 },
  { name: "Tênis Urbano Couro Branco", category: "Calçados", price: 329.00, market: 310.00 },
  { name: "Camiseta Algodão Pima Preta", category: "Vestuário", price: 89.90, market: 105.00 },
  { name: "Mochila Executiva Impermeável", category: "Acessórios", price: 199.00, market: 229.00 },
  { name: "Relógio Smart Fit Pro", category: "Eletrônicos", price: 459.00, market: 440.00 }
];

let SQLInstance = null;
let sqliteDB = null;
let diskFileHandle = null;
let linkedFileName = null;

function createTablesIfNeeded(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      plan TEXT,
      billing TEXT
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      market REAL NOT NULL
    );
  `);
}

function updateDiskSyncUI() {
  const btn = document.getElementById('btnDiskSync');
  const label = document.getElementById('diskSyncLabel');
  if (!btn || !label) return;

  if (diskFileHandle && linkedFileName) {
    btn.classList.add('connected');
    label.textContent = `HD: ${linkedFileName}`;
  } else {
    btn.classList.remove('connected');
    label.textContent = 'Salvar .sqlite no PC';
  }
}

// Grava o arquivo binário .sqlite diretamente no disco rígido
async function writeSQLiteToHardDrive(forcePrompt = false) {
  if (!sqliteDB) return;
  const binaryData = sqliteDB.export();

  // Backup automático de segurança na sessão local
  try {
    localStorage.setItem(SQLITE_BIN_KEY, JSON.stringify(Array.from(binaryData)));
  } catch (e) {}

  // Se o navegador suportar File System Access API (Chrome, Edge, Opera)
  if ('showSaveFilePicker' in window) {
    try {
      if (!diskFileHandle && forcePrompt) {
        diskFileHandle = await window.showSaveFilePicker({
          suggestedName: 'preco_facil.sqlite',
          types: [{
            description: 'Banco de Dados SQLite',
            accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
          }]
        });
        linkedFileName = diskFileHandle.name;
      }

      if (diskFileHandle) {
        const writable = await diskFileHandle.createWritable();
        await writable.write(binaryData);
        await writable.close();
        updateDiskSyncUI();
        return true;
      }
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  // Fallback obrigatório: baixa o arquivo .sqlite para a pasta Downloads do computador
  if (forcePrompt) {
    const blob = new Blob([binaryData], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = linkedFileName || 'preco_facil.sqlite';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo preco_facil.sqlite baixado no seu computador!');
    return true;
  }

  return false;
}

async function connectOrSaveSQLiteFile() {
  if (!sqliteDB) {
    showToast('Aguarde o motor SQLite inicializar...');
    return;
  }
  const saved = await writeSQLiteToHardDrive(true);
  if (saved && diskFileHandle) {
    showToast(`Banco SQLite vinculado e salvo em: ${linkedFileName}`);
    if (document.getElementById('view-dashboard')?.classList.contains('active')) {
      renderDashboard();
    }
  }
}

// Permite abrir um arquivo .sqlite já existente no disco rígido do computador
async function openSQLiteFileFromDisk() {
  if (!SQLInstance) {
    showToast('Aguarde o motor SQLite carregar...');
    return;
  }

  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Banco de Dados SQLite',
          accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
        }],
        multiple: false
      });
      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      sqliteDB = new SQLInstance.Database(new Uint8Array(buffer));
      createTablesIfNeeded(sqliteDB);
      diskFileHandle = handle;
      linkedFileName = handle.name;
      updateDiskSyncUI();
      await writeSQLiteToHardDrive(false);

      // Se existir um usuário no arquivo aberto, loga automaticamente
      const stmt = sqliteDB.prepare('SELECT * FROM users LIMIT 1');
      if (stmt.step()) {
        const firstUser = stmt.getAsObject();
        DB.setCurrentUserId(firstUser.id);
        stmt.free();
        showToast(`Arquivo ${linkedFileName} carregado! Bem-vindo, ${firstUser.name}.`);
        navigateTo(firstUser.plan ? 'dashboard' : 'planos');
        return;
      }
      stmt.free();
      showToast(`Arquivo ${linkedFileName} conectado ao sistema!`);
    } else {
      // Fallback via input file para Firefox/Safari
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sqlite,.db';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        sqliteDB = new SQLInstance.Database(new Uint8Array(buffer));
        createTablesIfNeeded(sqliteDB);
        linkedFileName = file.name;
        await writeSQLiteToHardDrive(false);
        const stmt = sqliteDB.prepare('SELECT * FROM users LIMIT 1');
        if (stmt.step()) {
          const firstUser = stmt.getAsObject();
          DB.setCurrentUserId(firstUser.id);
          stmt.free();
          showToast(`Banco ${file.name} importado!`);
          navigateTo(firstUser.plan ? 'dashboard' : 'planos');
          return;
        }
        stmt.free();
      };
      input.click();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Não foi possível abrir o arquivo SQLite selecionado.');
    }
  }
}

async function initDatabaseEngine() {
  try {
    let attempts = 0;
    while (typeof initSqlJs !== 'function' && attempts < 30) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    SQLInstance = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    const savedBinary = localStorage.getItem(SQLITE_BIN_KEY);
    if (savedBinary) {
      const u8 = new Uint8Array(JSON.parse(savedBinary));
      sqliteDB = new SQLInstance.Database(u8);
    } else {
      sqliteDB = new SQLInstance.Database();
    }

    createTablesIfNeeded(sqliteDB);
    updateNavbarAuth();
    updateDiskSyncUI();
  } catch (err) {
    showToast('Erro ao carregar WebAssembly SQLite. Verifique sua conexão.');
  }
}

const DB = {
  getCurrentUserId() {
    const id = localStorage.getItem(SESSION_KEY);
    return id ? Number(id) : null;
  },

  setCurrentUserId(id) {
    if (id) localStorage.setItem(SESSION_KEY, String(id));
    else localStorage.removeItem(SESSION_KEY);
  },

  getUserByEmail(email) {
    if (!sqliteDB) return null;
    const stmt = sqliteDB.prepare('SELECT * FROM users WHERE email = ?');
    stmt.bind([email]);
    const user = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return user;
  },

  getLoggedUser() {
    const id = this.getCurrentUserId();
    if (!id || !sqliteDB) return null;
    const stmt = sqliteDB.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([id]);
    const user = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return user;
  },

  async createUser(name, email, password) {
    if (!sqliteDB) return null;
    const newUserId = Date.now();
    sqliteDB.run(
      'INSERT INTO users (id, name, email, password, plan, billing) VALUES (?, ?, ?, ?, ?, ?)',
      [newUserId, name, email, password, null, null]
    );
    defaultProductsTemplate.forEach((item, index) => {
      sqliteDB.run(
        'INSERT INTO products (id, userId, name, category, price, market) VALUES (?, ?, ?, ?, ?, ?)',
        [newUserId + index + 1, newUserId, item.name, item.category, item.price, item.market]
      );
    });
    this.setCurrentUserId(newUserId);
    // Solicita salvar o arquivo .sqlite no disco rígido imediatamente ao criar conta
    await writeSQLiteToHardDrive(true);
    return newUserId;
  },

  async updateUserPlan(userId, plan, billing) {
    if (!sqliteDB) return;
    sqliteDB.run('UPDATE users SET plan = ?, billing = ? WHERE id = ?', [plan, billing, userId]);
    await writeSQLiteToHardDrive(!diskFileHandle);
  },

  getUserProducts(userId) {
    if (!sqliteDB) return [];
    const stmt = sqliteDB.prepare('SELECT * FROM products WHERE userId = ? ORDER BY id DESC');
    stmt.bind([userId]);
    const list = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  },

  async addProduct(userId, name, category, price, market) {
    if (!sqliteDB) return;
    const id = Date.now();
    sqliteDB.run(
      'INSERT INTO products (id, userId, name, category, price, market) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, name, category, price, market]
    );
    await writeSQLiteToHardDrive(!diskFileHandle);
  },

  async updateProduct(id, userId, name, category, price, market) {
    if (!sqliteDB) return;
    sqliteDB.run(
      'UPDATE products SET name = ?, category = ?, price = ?, market = ? WHERE id = ? AND userId = ?',
      [name, category, price, market, id, userId]
    );
    await writeSQLiteToHardDrive(!diskFileHandle);
  },

  async deleteProduct(id, userId) {
    if (!sqliteDB) return;
    sqliteDB.run('DELETE FROM products WHERE id = ? AND userId = ?', [id, userId]);
    await writeSQLiteToHardDrive(!diskFileHandle);
  }
};

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// =========================================
// 2. SISTEMA DE ACESSIBILIDADE AVANÇADO (WCAG 2.1)
// =========================================
const A11Y_STORAGE_KEY = 'preco_facil_a11y_prefs_v2';
let currentFontZoom = 100;

function toggleA11yPanel() {
  const panel = document.getElementById('a11yPanel');
  const btn = document.getElementById('a11yToggleBtn');
  if (!panel || !btn) return;
  const isOpen = panel.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
}

function closeA11yPanel() {
  const panel = document.getElementById('a11yPanel');
  const btn = document.getElementById('a11yToggleBtn');
  if (panel) panel.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('mousemove', (e) => {
  const guide = document.getElementById('readingGuideBar');
  if (guide && document.body.classList.contains('a11y-reading-guide')) {
    guide.style.top = `${e.clientY}px`;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    toggleA11yPanel();
  }
  if (e.key === 'Escape') {
    closeA11yPanel();
    closeProductModal();
    closeCheckoutModal();
    closeMobileMenu();
  }
});

function saveA11yPrefs() {
  const prefs = {
    zoom: currentFontZoom,
    contrast: document.body.classList.contains('a11y-high-contrast'),
    grayscale: document.documentElement.classList.contains('a11y-grayscale'),
    dyslexia: document.body.classList.contains('a11y-dyslexia'),
    readingGuide: document.body.classList.contains('a11y-reading-guide'),
    bigCursor: document.body.classList.contains('a11y-big-cursor'),
    reduceMotion: document.body.classList.contains('a11y-reduce-motion'),
    links: document.body.classList.contains('a11y-highlight-links')
  };
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

function applyFontZoom() {
  document.documentElement.style.setProperty('--font-scale', (currentFontZoom / 100).toFixed(2));
  const label = document.getElementById('fontZoomLabel');
  if (label) label.textContent = `${currentFontZoom}%`;
}

function loadA11yPrefs() {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);

    if (prefs.zoom) {
      currentFontZoom = prefs.zoom;
      applyFontZoom();
    }

    const map = [
      { flag: prefs.contrast, cls: 'a11y-high-contrast', btnId: 'btnContrast', target: document.body },
      { flag: prefs.grayscale, cls: 'a11y-grayscale', btnId: 'btnGrayscale', target: document.documentElement },
      { flag: prefs.dyslexia, cls: 'a11y-dyslexia', btnId: 'btnDyslexia', target: document.body },
      { flag: prefs.readingGuide, cls: 'a11y-reading-guide', btnId: 'btnReadingGuide', target: document.body },
      { flag: prefs.bigCursor, cls: 'a11y-big-cursor', btnId: 'btnCursor', target: document.body },
      { flag: prefs.reduceMotion, cls: 'a11y-reduce-motion', btnId: 'btnMotion', target: document.body },
      { flag: prefs.links, cls: 'a11y-highlight-links', btnId: 'btnLinks', target: document.body }
    ];

    map.forEach(item => {
      if (item.flag) {
        item.target.classList.add(item.cls);
        const btn = document.getElementById(item.btnId);
        if (btn) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
      }
    });
  } catch (e) {}
}

function changeFontSize(delta) {
  currentFontZoom = Math.min(140, Math.max(80, currentFontZoom + delta));
  applyFontZoom();
  saveA11yPrefs();
  showToast(`Tamanho do texto: ${currentFontZoom}%`);
}

function resetFontSize() {
  currentFontZoom = 100;
  applyFontZoom();
  saveA11yPrefs();
  showToast('Tamanho do texto restaurado (100%).');
}

function toggleA11yMode(className, btnEl) {
  const target = className === 'a11y-grayscale' ? document.documentElement : document.body;
  const isActive = target.classList.toggle(className);
  if (btnEl) {
    btnEl.classList.toggle('active', isActive);
    btnEl.setAttribute('aria-pressed', String(isActive));
  }
  saveA11yPrefs();
}

function toggleScreenReader() {
  const btn = document.getElementById('btnTTS');
  if (!('speechSynthesis' in window)) {
    showToast('Seu navegador não suporta leitura por voz.');
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
    showToast('Leitura por voz interrompida.');
    return;
  }

  const activeView = document.querySelector('.page-view.active');
  const readableNodes = activeView
    ? activeView.querySelectorAll('h1, h2, h3, h4, p, td, th, .kpi-label, .kpi-value')
    : document.querySelectorAll('h1, h2, p');

  const textToRead = Array.from(readableNodes)
    .map(el => el.innerText.trim())
    .filter(Boolean)
    .join('. ');

  const utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.05;

  utterance.onend = () => {
    if (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  };

  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }
  window.speechSynthesis.speak(utterance);
  showToast('Lendo conteúdo da página em voz alta...');
}

function resetAllA11y() {
  currentFontZoom = 100;
  applyFontZoom();
  document.documentElement.classList.remove('a11y-grayscale');
  document.body.classList.remove(
    'a11y-high-contrast',
    'a11y-dyslexia',
    'a11y-reading-guide',
    'a11y-big-cursor',
    'a11y-reduce-motion',
    'a11y-highlight-links'
  );
  document.querySelectorAll('.a11y-opt-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  try {
    localStorage.removeItem(A11Y_STORAGE_KEY);
  } catch (e) {}
  showToast('Configurações de acessibilidade restauradas.');
}

// =========================================
// 3. MENU MOBILE E NAVEGAÇÃO SPA
// =========================================
function closeMobileMenu() {
  const drawer = document.getElementById('mobileDrawer');
  const btn = document.getElementById('mobileMenuBtn');
  if (drawer) drawer.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function navigateTo(pageName) {
  const user = DB.getLoggedUser();

  if (pageName === 'dashboard') {
    if (!user) {
      showToast('Faça login, crie uma conta ou abra seu arquivo .sqlite.');
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
  if (!navAuthArea) return;
  const user = DB.getLoggedUser();

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
  DB.setCurrentUserId(null);
  showToast('Você saiu da sua conta.');
  navigateTo('home');
}

// =========================================
// 4. LOGIN E CRIAR CONTA
// =========================================
function switchAuthTab(mode) {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authAlert = document.getElementById('authAlert');

  if (authAlert) authAlert.className = 'auth-alert';

  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  } else {
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
}

function showAuthAlert(msg, type) {
  const authAlert = document.getElementById('authAlert');
  if (!authAlert) return;
  authAlert.textContent = msg;
  authAlert.className = `auth-alert ${type}`;
}

// =========================================
// 5. DASHBOARD ANALÍTICO, GRÁFICOS E INSIGHTS
// =========================================
function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderDashboard() {
  const user = DB.getLoggedUser();
  if (!user || !user.plan) return;

  const userProducts = DB.getUserProducts(user.id);
  const banner = document.getElementById('userStatusBanner');
  const planLimitEl = document.getElementById('kpiPlanLimit');

  planLimitEl.textContent = user.plan !== 'Starter'
    ? `Plano ${user.plan} (Ilimitado)`
    : `${userProducts.length} de 10 itens (Plano Starter)`;

  const diskStatus = diskFileHandle
    ? `SQLite Gravado em Disco (${linkedFileName})`
    : 'SQLite Ativo (Clique em "Gravar .sqlite no PC" para vincular arquivo)';

  banner.innerHTML = `
    <span>
      Conta: <strong>${user.name}</strong> · Plano: <strong>${user.plan}</strong> (${user.billing})
      <span class="db-badge">${diskStatus}</span>
    </span>
    <a href="#planos" onclick="navigateTo('planos'); return false;" style="color: #1d4ed8; font-weight: 700; text-decoration: none;">Alterar plano →</a>
  `;

  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const selectedCategory = document.getElementById('categoryFilter')?.value || 'todas';
  const selectedStatus = document.getElementById('statusFilter')?.value || 'todos';

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
        <td colspan="7" style="text-align: center; padding: 32px; color: #4b5563; justify-content: center;">
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
          <button type="button" class="btn-edit" onclick="openEditModal(${item.id})" aria-label="Editar ${item.name}">Editar</button>
          <button type="button" class="btn-delete" onclick="deleteProduct(${item.id})" aria-label="Remover ${item.name}">Remover</button>
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
    compContainer.innerHTML = '<p style="color:#4b5563; font-size:0.8125rem;">Cadastre produtos para visualizar o gráfico.</p>';
    catContainer.innerHTML = '<p style="color:#4b5563; font-size:0.8125rem;">Sem categorias registradas.</p>';
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
      <span class="insight-badge">Banco SQLite Local</span>
      <h4>Segurança no seu disco rígido</h4>
      <p>Seus registros são salvos diretamente no arquivo <strong>.sqlite</strong> do seu computador sempre que você altera um item.</p>
    </div>
  `;

  grid.innerHTML = cardsHTML;
}

async function deleteProduct(id) {
  const user = DB.getLoggedUser();
  if (!user) return;
  await DB.deleteProduct(id, user.id);
  renderDashboard();
  showToast('Produto removido e arquivo SQLite atualizado no disco.');
}

function exportToCSV() {
  const user = DB.getLoggedUser();
  if (!user) return;
  const list = DB.getUserProducts(user.id);
  if (list.length === 0) {
    showToast('Não há produtos para exportar.');
    return;
  }

  let csv = 'Produto;Categoria;Seu Preco;Media Mercado\n';
  list.forEach(p => {
    csv += `${p.name};${p.category};${Number(p.price).toFixed(2)};${Number(p.market).toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `catalogo_${user.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
  link.click();
  showToast('Planilha CSV baixada com sucesso!');
}

function openNewProductModal() {
  const user = DB.getLoggedUser();
  if (!user) return;

  const userProducts = DB.getUserProducts(user.id);
  if (user.plan === 'Starter' && userProducts.length >= 10) {
    showToast('Limite de 10 produtos do plano Starter atingido! Faça upgrade.');
    navigateTo('planos');
    return;
  }

  document.getElementById('productModalTitle').textContent = 'Adicionar novo produto';
  document.getElementById('editProdId').value = '';
  document.getElementById('productForm').reset();
  document.getElementById('productModal').classList.add('open');
  document.getElementById('prodName').focus();
}

function openEditModal(id) {
  const user = DB.getLoggedUser();
  if (!user) return;
  const prod = DB.getUserProducts(user.id).find(p => p.id === id);
  if (!prod) return;

  document.getElementById('productModalTitle').textContent = 'Editar produto';
  document.getElementById('editProdId').value = prod.id;
  document.getElementById('prodName').value = prod.name;
  document.getElementById('prodCategory').value = prod.category;
  document.getElementById('prodPrice').value = prod.price;
  document.getElementById('prodMarket').value = prod.market;
  document.getElementById('productModal').classList.add('open');
  document.getElementById('prodName').focus();
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('open');
}

// =========================================
// 6. PLANOS E CHECKOUT DE PAGAMENTO
// =========================================
let isYearly = false;
let selectedPlanData = { name: 'Pro', price: 79 };

function toggleBillingPeriod() {
  const billingSwitch = document.getElementById('billingSwitch');
  isYearly = !isYearly;
  if (billingSwitch) {
    billingSwitch.classList.toggle('yearly', isYearly);
    billingSwitch.setAttribute('aria-checked', String(isYearly));
  }

  document.querySelectorAll('.plan-price').forEach(el => {
    const value = isYearly ? el.dataset.yearly : el.dataset.monthly;
    el.innerHTML = `R$ ${value}<span>/mês</span>`;
  });
}

function highlightCurrentPlan() {
  const user = DB.getLoggedUser();
  document.querySelectorAll('.plan-btn').forEach(btn => {
    if (user && user.plan === btn.dataset.plan) {
      btn.textContent = 'Plano atual';
      btn.style.opacity = '0.75';
    } else {
      if (btn.dataset.plan === 'Starter') btn.textContent = 'Ativar grátis';
      if (btn.dataset.plan === 'Pro') btn.textContent = 'Assinar plano Pro';
      if (btn.dataset.plan === 'Business') btn.textContent = 'Assinar Business';
      btn.style.opacity = '1';
    }
  });
}

async function openCheckout(planName, monthlyBasePrice) {
  const user = DB.getLoggedUser();

  if (!user) {
    showToast('Crie uma conta ou faça login antes de escolher um plano.');
    navigateTo('login');
    return;
  }

  if (monthlyBasePrice === 0) {
    await DB.updateUserPlan(user.id, 'Starter', 'Mensal');
    showToast('Plano Starter ativado e salvo no SQLite!');
    navigateTo('dashboard');
    return;
  }

  const finalPrice = isYearly ? Math.round(monthlyBasePrice * 0.8) : monthlyBasePrice;
  selectedPlanData = { name: planName, price: finalPrice };

  document.getElementById('checkoutTitle').textContent = `Plano ${planName} (${isYearly ? 'Anual' : 'Mensal'})`;
  document.getElementById('checkoutPrice').textContent = `R$ ${finalPrice},00/mês`;
  document.getElementById('checkoutModal').classList.add('open');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('open');
}

function selectPayMethod(method) {
  const btnCard = document.getElementById('btnMethodCard');
  const btnPix = document.getElementById('btnMethodPix');
  const cardFields = document.getElementById('cardFields');
  const pixFields = document.getElementById('pixFields');

  if (method === 'card') {
    btnCard.classList.add('active');
    btnPix.classList.remove('active');
    cardFields.style.display = 'block';
    pixFields.style.display = 'none';
  } else {
    btnPix.classList.add('active');
    btnCard.classList.remove('active');
    pixFields.style.display = 'block';
    cardFields.style.display = 'none';
  }
}

// =========================================
// 7. VINCULAÇÃO DE EVENTOS APÓS CARREGAR O DOM
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  loadA11yPrefs();
  updateNavbarAuth();
  initDatabaseEngine();

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!sqliteDB) {
        showAuthAlert('Motor SQLite ainda inicializando. Tente em 1 segundo.', 'error');
        return;
      }
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim().toLowerCase();
      const password = document.getElementById('regPassword').value;

      if (DB.getUserByEmail(email)) {
        showAuthAlert('Este e-mail já está cadastrado. Faça login.', 'error');
        return;
      }

      await DB.createUser(name, email, password);
      registerForm.reset();
      showToast(`Bem-vindo, ${name}! Escolha um plano para liberar o Dashboard.`);
      navigateTo('planos');
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!sqliteDB) {
        showAuthAlert('Motor SQLite ainda inicializando. Tente em 1 segundo.', 'error');
        return;
      }
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;

      const foundUser = DB.getUserByEmail(email);
      if (!foundUser || foundUser.password !== password) {
        showAuthAlert('E-mail ou senha incorretos.', 'error');
        return;
      }

      DB.setCurrentUserId(foundUser.id);
      loginForm.reset();

      if (foundUser.plan) {
        showToast(`Login realizado! Bem-vindo de volta, ${foundUser.name}.`);
        navigateTo('dashboard');
      } else {
        showToast('Login realizado! Escolha um plano para acessar o Dashboard.');
        navigateTo('planos');
      }
    });
  }

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  if (searchInput) searchInput.addEventListener('input', renderDashboard);
  if (categoryFilter) categoryFilter.addEventListener('change', renderDashboard);
  if (statusFilter) statusFilter.addEventListener('change', renderDashboard);

  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = DB.getLoggedUser();
      if (!user) return;

      const editId = document.getElementById('editProdId').value;
      const name = document.getElementById('prodName').value;
      const category = document.getElementById('prodCategory').value;
      const price = parseFloat(document.getElementById('prodPrice').value);
      const market = parseFloat(document.getElementById('prodMarket').value);

      if (editId) {
        await DB.updateProduct(Number(editId), user.id, name, category, price, market);
        showToast('Produto atualizado e gravado no arquivo SQLite!');
      } else {
        await DB.addProduct(user.id, name, category, price, market);
        showToast('Produto salvo no arquivo SQLite do computador!');
      }

      productForm.reset();
      closeProductModal();
      renderDashboard();
    });
  }

  const cardNumber = document.getElementById('cardNumber');
  if (cardNumber) {
    cardNumber.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
      e.target.value = val;
    });
  }

  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = DB.getLoggedUser();
      if (!user) return;

      const confirmBtn = document.getElementById('confirmPayBtn');
      confirmBtn.textContent = 'Processando pagamento...';
      confirmBtn.disabled = true;

      setTimeout(async () => {
        await DB.updateUserPlan(user.id, selectedPlanData.name, isYearly ? 'Anual' : 'Mensal');
        confirmBtn.textContent = 'Confirmar pagamento';
        confirmBtn.disabled = false;
        closeCheckoutModal();

        showToast(`Pagamento aprovado! Plano ${selectedPlanData.name} salvo no SQLite.`);
        navigateTo('dashboard');
      }, 800);
    });
  }
});

// Expõe funções no escopo global
window.navigateTo = navigateTo;
window.closeMobileMenu = closeMobileMenu;
window.logoutUser = logoutUser;
window.switchAuthTab = switchAuthTab;
window.toggleBillingPeriod = toggleBillingPeriod;
window.openCheckout = openCheckout;
window.closeCheckoutModal = closeCheckoutModal;
window.selectPayMethod = selectPayMethod;
window.openNewProductModal = openNewProductModal;
window.openEditModal = openEditModal;
window.closeProductModal = closeProductModal;
window.deleteProduct = deleteProduct;
window.exportToCSV = exportToCSV;
window.toggleA11yPanel = toggleA11yPanel;
window.closeA11yPanel = closeA11yPanel;
window.changeFontSize = changeFontSize;
window.resetFontSize = resetFontSize;
window.toggleA11yMode = toggleA11yMode;
window.toggleScreenReader = toggleScreenReader;
window.resetAllA11y = resetAllA11y;
window.connectOrSaveSQLiteFile = connectOrSaveSQLiteFile;
window.openSQLiteFileFromDisk = openSQLiteFileFromDisk;