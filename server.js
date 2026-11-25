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

// Garante que as tabelas e os itens padrão estejam prontos antes de qualquer rota responder
let initPromise = null;
function garantirBancoPronto() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
          plano TEXT NOT NULL,
          periodo TEXT NOT NULL,
          data_assinatura DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.get("SELECT COUNT(*) AS total FROM produtos", (err, row) => {
        if (!err && row && row.total === 0) {
          const stmt = db.prepare("INSERT INTO produtos (name, category, price, market) VALUES (?, ?, ?, ?)");
          stmt.run("Jaqueta Corta-Vento Minimal", "Vestuário", 249.90, 279.90);
          stmt.run("Tênis Urbano Couro Branco", "Calçados", 329.00, 310.00);
          stmt.run("Camiseta Algodão Pima Preta", "Vestuário", 89.90, 105.00);
          stmt.run("Mochila Executiva Impermeável", "Acessórios", 199.00, 229.00);
          stmt.run("Fone Bluetooth Noise Cancelling", "Eletrônicos", 459.90, 519.00);
          stmt.finalize(() => resolve());
        } else {
          resolve();
        }
      });
    });
  });

  return initPromise;
}

app.use(async (req, res, next) => {
  await garantirBancoPronto();
  next();
});

// 1. Listar produtos (SELECT)
app.get('/api/produtos', (req, res) => {
  db.all("SELECT * FROM produtos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// 2. Inserir novo produto (INSERT)
app.post('/api/produtos', (req, res) => {
  const { name = 'Novo Produto', category = 'Vestuário', price = 0, market = 0 } = req.body;
  const sql = "INSERT INTO produtos (name, category, price, market) VALUES (?, ?, ?, ?)";

  db.run(sql, [name, category, price, market], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID, name, category, price, market });
  });
});

// 3. Atualização automática em tempo real (UPDATE)
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

// 4. Remover produto (DELETE)
app.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM produtos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: "Produto removido com sucesso!" });
  });
});

// 5. Consultar plano ativo mais recente (SELECT)
app.get('/api/planos', (req, res) => {
  db.get("SELECT * FROM assinaturas ORDER BY id DESC LIMIT 1", [], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(row || { plano: 'Starter', periodo: 'Mensal' });
  });
});

// 6. Salvar escolha de plano diretamente no banco da Vercel (INSERT)
app.post('/api/planos', (req, res) => {
  const { plano, periodo } = req.body;
  const sql = "INSERT INTO assinaturas (plano, periodo) VALUES (?, ?)";

  db.run(sql, [plano, periodo], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({
      id: this.lastID,
      plano,
      periodo,
      mensagem: `Plano ${plano} (${periodo}) salvo automaticamente na Vercel!`
    });
  });
});

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
  });
}

module.exports = app;
