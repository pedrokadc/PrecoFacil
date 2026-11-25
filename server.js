const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1';

// Configurações
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Caminho do banco adaptado para Vercel (/tmp) ou Local (./banco.db)
const dbPath = isVercel
  ? path.join('/tmp', 'banco.db')
  : path.join(__dirname, 'banco.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log(`Conectado ao banco SQLite em: ${dbPath}`);
    criarTabelas();
  }
});

// Garantir que as tabelas existam antes de responder às requisições
let dbInicializado = false;
function criarTabelas() {
  if (dbInicializado) return;
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

    db.get("SELECT COUNT(*) AS total FROM produtos", (err, row) => {
      if (!err && row && row.total === 0) {
        const stmt = db.prepare("INSERT INTO produtos (name, category, price, market) VALUES (?, ?, ?, ?)");
        stmt.run("Jaqueta Corta-Vento Minimal", "Vestuário", 249.90, 279.90);
        stmt.run("Tênis Urbano Couro Branco", "Calçados", 329.00, 310.00);
        stmt.run("Camiseta Algodão Pima Preta", "Vestuário", 89.90, 105.00);
        stmt.run("Mochila Executiva Impermeável", "Acessórios", 199.00, 229.00);
        stmt.finalize();
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS assinaturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plano TEXT NOT NULL,
        periodo TEXT NOT NULL,
        data_assinatura DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    dbInicializado = true;
  });
}

// Middleware de segurança para garantir tabelas criadas em ambiente serverless
app.use((req, res, next) => {
  criarTabelas();
  next();
});

// =========================================
// ROTAS DA API
// =========================================

app.get('/api/produtos', (req, res) => {
  db.all("SELECT * FROM produtos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

app.post('/api/produtos', (req, res) => {
  const { name, category, price, market } = req.body;
  const sql = "INSERT INTO produtos (name, category, price, market) VALUES (?, ?, ?, ?)";
  
  db.run(sql, [name, category, price, market], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID, name, category, price, market });
  });
});

app.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM produtos WHERE id = ?", id, function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: "Produto removido com sucesso!" });
  });
});

app.post('/api/planos', (req, res) => {
  const { plano, periodo } = req.body;
  db.run("INSERT INTO assinaturas (plano, periodo) VALUES (?, ?)", [plano, periodo], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ mensagem: `Plano ${plano} (${periodo}) registrado no banco!` });
  });
});

// Inicia o servidor apenas quando executado localmente
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
  });
}

// Exporta o app para a Vercel
module.exports = app;
