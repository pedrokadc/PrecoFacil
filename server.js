// =========================================
// ROTAS DA API (SQL PADRÃO AUTOMÁTICO)
// =========================================

// 1. Listar todos os produtos (SELECT)
app.get('/api/produtos', (req, res) => {
  db.all("SELECT * FROM produtos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// 2. Criar produto automaticamente (INSERT)
app.post('/api/produtos', (req, res) => {
  const { name = 'Novo Produto', category = 'Geral', price = 0, market = 0 } = req.body;
  const sql = "INSERT INTO produtos (name, category, price, market) VALUES (?, ?, ?, ?)";
  
  db.run(sql, [name, category, price, market], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID, name, category, price, market });
  });
});

// 3. Atualização Automática em Tempo Real (UPDATE SQL Padrão)
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
    res.json({ 
      atualizado: true, 
      id: Number(id),
      alteracoes: this.changes 
    });
  });
});

// 4. Remover um produto (DELETE)
app.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM produtos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: "Produto removido com sucesso!" });
  });
});

// 5. Salvar escolha de plano automaticamente (INSERT)
app.post('/api/planos', (req, res) => {
  const { plano, periodo } = req.body;
  const sql = "INSERT INTO assinaturas (plano, periodo) VALUES (?, ?)";
  db.run(sql, [plano, periodo], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ mensagem: `Plano ${plano} (${periodo}) salvo automaticamente!` });
  });
});
