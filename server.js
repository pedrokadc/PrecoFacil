const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = isVercel
  ? path.join('/tmp', 'banco.db')
  : path.join(__dirname, 'banco.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  }
});

let initPromise = null;
function garantirBancoPronto() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT NOT NULL DEFAULT 'guest@precofacil.com',
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price REAL NOT NULL,
          market REAL NOT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS assinaturas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT NOT NULL DEFAULT 'guest@precofacil.com',
          plano TEXT NOT NULL,
          periodo TEXT NOT NULL,
          data_assinatura DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, () => resolve());
    });
  });

  return initPromise;
}

function semearProdutosUsuario(email) {
  return new Promise((resolve) => {
    db.get("SELECT COUNT(*) AS total FROM produtos WHERE user_email = ?", [email], (err, row) => {
      if (!err && row && row.total === 0) {
        const stmt = db.prepare("INSERT INTO produtos (user_email, name, category, price, market) VALUES (?, ?, ?, ?, ?)");
        stmt.run(email, "Jaqueta Corta-Vento Minimal", "Vestuário", 249.90, 279.90);
        stmt.run(email, "Tênis Urbano Couro Branco", "Calçados", 329.00, 310.00);
        stmt.run(email, "Camiseta Algodão Pima Preta", "Vestuário", 89.90, 105.00);
        stmt.run(email, "Mochila Executiva Impermeável", "Acessórios", 199.00, 229.00);
        stmt.run(email, "Fone Bluetooth Noise Cancelling", "Eletrônicos", 459.90, 519.00);
        stmt.finalize(() => resolve());
      } else {
        resolve();
      }
    });
  });
}

app.use(async (req, res, next) => {
  await garantirBancoPronto();
  next();
});

// =========================================
// AUTENTICAÇÃO (REGISTRO E LOGIN SQL)
// =========================================
app.post('/api/register', (req, res) => {
  const { name, email, password = '' } = req.body;
  if (!email) return res.status(400).json({ erro: 'E-mail obrigatório.' });

  const sql = "INSERT OR IGNORE INTO usuarios (name, email, password) VALUES (?, ?, ?)";
  db.run(sql, [name || email.split('@')[0], email.toLowerCase(), password], async function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    await semearProdutosUsuario(email.toLowerCase());
    res.status(201).json({
      name: name || email.split('@')[0],
      email: email.toLowerCase()
    });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password = '' } = req.body;
  if (!email) return res.status(400).json({ erro: 'E-mail obrigatório.' });

  const emailNorm = email.toLowerCase();
  db.get("SELECT * FROM usuarios WHERE email = ?", [emailNorm], async (err, user) => {
    if (err) return res.status(500).json({ erro: err.message });

    if (!user) {
      // Cria automaticamente se o servidor serverless reiniciou o /tmp
      const nomeAuto = emailNorm.split('@')[0];
      db.run("INSERT INTO usuarios (name, email, password) VALUES (?, ?, ?)", [nomeAuto, emailNorm, password]);
      await semearProdutosUsuario(emailNorm);
      return res.json({ name: nomeAuto, email: emailNorm });
    }

    if (user.password && password && user.password !== password) {
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    await semearProdutosUsuario(emailNorm);
    res.json({ name: user.name, email: user.email });
  });
});

// =========================================
// PRODUTOS SEPARADOS POR LOGIN (user_email)
// =========================================
app.get('/api/produtos', async (req, res) => {
  const email = (req.query.email || 'guest@precofacil.com').toLowerCase();
  await semearProdutosUsuario(email);

  db.all("SELECT * FROM produtos WHERE user_email = ? ORDER BY id DESC", [email], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

app.post('/api/produtos', (req, res) => {
  const {
    user_email = 'guest@precofacil.com',
    name = 'Novo Produto',
    category = 'Vestuário',
    price = 0,
    market = 0
  } = req.body;

  const email = user_email.toLowerCase();
  const sql = "INSERT INTO produtos (user_email, name, category, price, market) VALUES (?, ?, ?, ?, ?)";

  db.run(sql, [email, name, category, price, market], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID, user_email: email, name, category, price, market });
  });
});

app.put('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, price, market } = req.body;

  const sql = `
    UPDATE produtos
    SET name = COALESCE(?, name),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        market = COALESCE(?, market)
    WHERE id = ?
  `;

  db.run(sql, [name, category, price, market, id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ atualizado: true, id: Number(id), alteracoes: this.changes });
  });
});

app.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM produtos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: "Produto removido com sucesso!" });
  });
});

// =========================================
// PLANOS SEPARADOS POR LOGIN (user_email)
// =========================================
app.get('/api/planos', (req, res) => {
  const email = (req.query.email || 'guest@precofacil.com').toLowerCase();
  db.get("SELECT * FROM assinaturas WHERE user_email = ? ORDER BY id DESC LIMIT 1", [email], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(row || { plano: 'Starter', periodo: 'Mensal' });
  });
});

app.post('/api/planos', (req, res) => {
  const { user_email = 'guest@precofacil.com', plano, periodo } = req.body;
  const email = user_email.toLowerCase();
  const sql = "INSERT INTO assinaturas (user_email, plano, periodo) VALUES (?, ?, ?)";

  db.run(sql, [email, plano, periodo], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({
      id: this.lastID,
      user_email: email,
      plano,
      periodo,
      mensagem: `Plano ${plano} (${periodo}) salvo na conta!`
    });
  });
});

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
  });
}

module.exports = app;
