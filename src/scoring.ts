import { db } from './db.js';

export type ValorResposta = 'conforme' | 'parcial' | 'nao_conforme' | 'na';

export interface RespostaInput {
  criterio_id: number;
  valor: ValorResposta;
  comentario?: string;
}

interface CriterioRow {
  id: number;
  peso: number;
  fatal: number;
}

const FATOR: Record<ValorResposta, number> = {
  conforme: 1,
  parcial: 0.5,
  nao_conforme: 0,
  na: 0,
};

/**
 * Calcula a nota final (0-100) de uma monitoria a partir das respostas.
 * Regras:
 *  - nota = (pontos obtidos / pontos aplicaveis) * 100
 *  - respostas "na" sao removidas do numerador e do denominador
 *  - se qualquer criterio FATAL for "nao_conforme", a nota final = 0 (falha critica)
 */
export function calcularNota(formularioId: number, respostas: RespostaInput[]): {
  nota: number;
  falhaCritica: boolean;
} {
  const criterios = db
    .prepare('SELECT id, peso, fatal FROM criterios WHERE formulario_id = ?')
    .all(formularioId) as CriterioRow[];
  const mapa = new Map(criterios.map((c) => [c.id, c]));

  let obtidos = 0;
  let aplicaveis = 0;
  let falhaCritica = false;

  for (const r of respostas) {
    const crit = mapa.get(r.criterio_id);
    if (!crit) continue;
    if (r.valor === 'na') continue;

    aplicaveis += crit.peso;
    obtidos += crit.peso * FATOR[r.valor];

    if (crit.fatal && r.valor === 'nao_conforme') {
      falhaCritica = true;
    }
  }

  if (falhaCritica) return { nota: 0, falhaCritica: true };
  if (aplicaveis === 0) return { nota: 0, falhaCritica: false };

  const nota = Math.round((obtidos / aplicaveis) * 1000) / 10; // 1 casa decimal
  return { nota, falhaCritica: false };
}
