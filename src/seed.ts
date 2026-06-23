import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { calcularNota, type ValorResposta } from './scoring.js';

export function seed(): void {
  const jaTem = (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number }).n > 0;
  if (jaTem) return;

  console.log('  Populando dados de demonstracao...');

  // ---- Usuarios (equipe de qualidade) ----
  const usuarios = [
    ['Administrador ITS', 'admin@its.com.br', 'admin123', 'admin'],
    ['Carla Monteiro', 'carla@its.com.br', 'mon123', 'supervisor'],
    ['Rafael Souza', 'rafael@its.com.br', 'mon123', 'monitor'],
    ['Juliana Alves', 'juliana@its.com.br', 'mon123', 'monitor'],
  ];
  const insUser = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)');
  const userIds = usuarios.map((u) =>
    insUser.run(u[0], u[1], bcrypt.hashSync(u[2], 8), u[3]).lastInsertRowid as number
  );

  // ---- Equipes ----
  const equipes = [
    ['Atendimento Receptivo', 'Carla Monteiro'],
    ['Suporte Tecnico', 'Marcos Lima'],
    ['Retencao', 'Patricia Gomes'],
    ['Vendas Ativo', 'Bruno Carvalho'],
  ];
  const insEq = db.prepare('INSERT INTO equipes (nome, supervisor) VALUES (?,?)');
  const equipeIds = equipes.map((e) => insEq.run(e[0], e[1]).lastInsertRowid as number);

  // ---- Operadores ----
  const nomes = [
    'Ana Pereira', 'Lucas Ferreira', 'Mariana Costa', 'Pedro Santos', 'Beatriz Rocha',
    'Gustavo Almeida', 'Larissa Dias', 'Felipe Barbosa', 'Camila Nunes', 'Thiago Martins',
    'Vanessa Lima', 'Rodrigo Pinto', 'Aline Castro', 'Diego Ramos', 'Patricia Melo', 'Bruno Teixeira',
  ];
  const insOp = db.prepare('INSERT INTO operadores (nome, matricula, equipe_id, cargo) VALUES (?,?,?,?)');
  const operadorIds = nomes.map((nome, i) =>
    insOp.run(nome, `OP${String(1001 + i)}`, equipeIds[i % equipeIds.length], 'Operador I').lastInsertRowid as number
  );

  // ---- Formulario de monitoria padrao ----
  const formId = db.prepare('INSERT INTO formularios (nome, descricao) VALUES (?,?)')
    .run('Monitoria Padrao - Atendimento', 'Avaliacao de qualidade de atendimento ao cliente').lastInsertRowid as number;

  const criterios: Array<[string, string, number, number]> = [
    // categoria, descricao, peso, fatal
    ['Abordagem', 'Saudacao adequada e identificacao da empresa', 10, 0],
    ['Abordagem', 'Confirmacao dos dados do cliente (seguranca)', 10, 1],
    ['Conducao', 'Escuta ativa e cordialidade', 15, 0],
    ['Conducao', 'Sondagem correta da necessidade', 15, 0],
    ['Tecnica', 'Solucao correta e completa do chamado', 20, 0],
    ['Tecnica', 'Registro correto no sistema', 10, 0],
    ['Conformidade', 'Informacao incorreta ao cliente', 10, 1],
    ['Encerramento', 'Recapitulacao e oferta de ajuda adicional', 5, 0],
    ['Encerramento', 'Encerramento cordial', 5, 0],
  ];
  const insCrit = db.prepare('INSERT INTO criterios (formulario_id, categoria, descricao, peso, fatal, ordem) VALUES (?,?,?,?,?,?)');
  const criterioIds = criterios.map((c, i) =>
    insCrit.run(formId, c[0], c[1], c[2], c[3], i).lastInsertRowid as number
  );

  // ---- Monitorias dos ultimos 6 meses ----
  const canais = ['Telefone', 'Chat', 'WhatsApp', 'Email'];
  const insMon = db.prepare(`
    INSERT INTO monitorias (formulario_id, operador_id, monitor_id, data_atendimento, canal, protocolo, nota_final, falha_critica, status, observacoes, criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insResp = db.prepare('INSERT INTO respostas (monitoria_id, criterio_id, valor, comentario) VALUES (?,?,?,?)');

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const hoje = new Date('2026-06-23');

  let protocolo = 50000;
  for (let mesAtras = 5; mesAtras >= 0; mesAtras--) {
    const qtde = 40 + Math.floor(Math.random() * 20);
    for (let k = 0; k < qtde; k++) {
      const data = new Date(hoje);
      data.setMonth(data.getMonth() - mesAtras);
      data.setDate(1 + Math.floor(Math.random() * 27));
      const iso = data.toISOString().slice(0, 10);

      const operadorId = pick(operadorIds);
      const monitorId = pick(userIds.slice(1)); // nao usa o admin como monitor

      // gera respostas: maioria conforme, alguns desvios
      const respostas = criterioIds.map((cid) => {
        const r = Math.random();
        let valor: ValorResposta;
        if (r < 0.8) valor = 'conforme';
        else if (r < 0.9) valor = 'parcial';
        else if (r < 0.97) valor = 'nao_conforme';
        else valor = 'na';
        return { criterio_id: cid, valor };
      });

      const { nota, falhaCritica } = calcularNota(formId, respostas);
      const mid = insMon.run(
        formId, operadorId, monitorId, iso, pick(canais),
        `PROT-${++protocolo}`, nota, falhaCritica ? 1 : 0, 'concluida',
        falhaCritica ? 'Falha critica identificada - reciclagem necessaria' : null,
        iso + ' 10:00:00'
      ).lastInsertRowid as number;

      for (const resp of respostas) {
        insResp.run(mid, resp.criterio_id, resp.valor, null);
      }
    }
  }

  // ---- Algumas contestacoes ----
  const monitoriasBaixas = db.prepare(
    "SELECT id FROM monitorias WHERE nota_final < 70 ORDER BY criado_em DESC LIMIT 6"
  ).all() as Array<{ id: number }>;
  const insCont = db.prepare('INSERT INTO contestacoes (monitoria_id, motivo, status) VALUES (?,?,?)');
  const motivos = [
    'Cliente confirmou que a informacao prestada estava correta.',
    'O sistema estava instavel no momento, impossibilitando o registro.',
    'A sondagem foi feita, porem nao ficou audivel na gravacao.',
  ];
  monitoriasBaixas.forEach((m, i) => {
    const status = i < 2 ? 'aberta' : i < 4 ? 'em_analise' : 'indeferida';
    insCont.run(m.id, pick(motivos), status);
    if (status !== 'indeferida') db.prepare("UPDATE monitorias SET status='contestada' WHERE id=?").run(m.id);
  });

  // ---- Calibracao exemplo ----
  const calId = db.prepare(
    'INSERT INTO calibracoes (titulo, formulario_id, operador_id, protocolo, data, status) VALUES (?,?,?,?,?,?)'
  ).run('Calibracao Mensal - Junho/2026', formId, operadorIds[0], 'PROT-50001', '2026-06-15', 'aberta').lastInsertRowid as number;
  const notasCal = [88, 92, 85, 90];
  userIds.forEach((uid, i) => {
    db.prepare('INSERT INTO calibracao_notas (calibracao_id, monitor_id, nota) VALUES (?,?,?)')
      .run(calId, uid, notasCal[i]);
  });

  console.log('  Dados criados com sucesso.');
}
