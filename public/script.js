// =========================================
// AUTO-SAVE AUTOMÁTICO (SEM BOTÃO SALVAR)
// =========================================
const AutoSaveSQL = {
  timers: {},

  // Dispara o UPDATE SQL 600ms após o usuário parar de digitar/alterar
  salvarAlteracao(id, dados) {
    clearTimeout(this.timers[id]);
    this.mostrarStatus('Salvando...');

    this.timers[id] = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/produtos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });

        if (resposta.ok) {
          this.mostrarStatus('Salvo automaticamente ✓');
        } else {
          this.mostrarStatus('Erro ao salvar', true);
        }
      } catch (erro) {
        console.error('Falha na conexão automática com o SQL:', erro);
        this.mostrarStatus('Sem conexão com o banco', true);
      }
    }, 600);
  },

  // Cria um registro no SQL imediatamente (INSERT)
  async criarAutomatico(dados) {
    this.mostrarStatus('Criando registro...');
    const resposta = await fetch('/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const novoItem = await resposta.json();
    this.mostrarStatus('Salvo automaticamente ✓');
    return novoItem;
  },

  // Indicador visual discreto no canto da tela
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

// Conecta automaticamente qualquer input/select que possua data-id e data-campo
document.addEventListener('input', (e) => {
  const el = e.target;
  const id = el.dataset.id;
  const campo = el.dataset.campo; // ex: "name", "category", "price", "market"

  if (id && campo) {
    const valor = (campo === 'price' || campo === 'market') 
      ? parseFloat(el.value) || 0 
      : el.value;

    AutoSaveSQL.salvarAlteracao(id, { [campo]: valor });
  }
});
