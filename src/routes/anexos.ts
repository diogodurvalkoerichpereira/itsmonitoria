import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { join, extname } from 'node:path';
import { mkdirSync, createReadStream, existsSync, unlinkSync } from 'node:fs';
import { db, dataDir } from '../db.js';

// Uploads ficam junto do banco, no mesmo diretorio de dados (ver DATA_DIR).
export const uploadDir = join(dataDir, 'uploads');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname || '')),
});

// tipos aceitos: documentos e midia (audio/imagem/video)
const MIME_OK = /^(audio\/|video\/|image\/|application\/pdf|application\/msword|application\/vnd\.|text\/plain)/;
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50MB por arquivo, ate 10
  fileFilter: (_req, file, cb) => {
    if (MIME_OK.test(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido: ' + file.mimetype));
  },
});

export const anexosRouter = Router();

interface AnexoRow {
  id: number;
  nome_original: string;
  nome_arquivo: string;
  mime: string | null;
}

// trata erros do multer (tamanho, tipo) com mensagem amigavel
function comUpload(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  upload.array('arquivos', 10)(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ erro: (err as Error).message || 'Falha no upload' });
    next();
  });
}

anexosRouter.post('/monitorias/:id/anexos', comUpload, async (req, res) => {
  const mid = Number(req.params.id);
  const mon = await db.prepare('SELECT id FROM monitorias WHERE id=?').get(mid);
  if (!mon) return res.status(404).json({ erro: 'Monitoria nao encontrada' });
  const files = (req.files as Express.Multer.File[]) || [];
  const ins = db.prepare('INSERT INTO anexos (monitoria_id, nome_original, nome_arquivo, mime, tamanho) VALUES (?,?,?,?,?)');
  for (const f of files) {
    // nomes vem em latin1 do multipart; normaliza para utf8
    const nome = Buffer.from(f.originalname, 'latin1').toString('utf8');
    await ins.run(mid, nome, f.filename, f.mimetype, f.size);
  }
  res.status(201).json({ enviados: files.length });
});

anexosRouter.get('/monitorias/:id/anexos', async (req, res) => {
  const rows = await db.prepare('SELECT id, nome_original, mime, tamanho, criado_em FROM anexos WHERE monitoria_id=? ORDER BY id')
    .all(req.params.id);
  res.json(rows);
});

anexosRouter.get('/anexos/:id/download', async (req, res) => {
  const a = (await db.prepare('SELECT * FROM anexos WHERE id=?').get(req.params.id)) as AnexoRow | undefined;
  if (!a) return res.status(404).json({ erro: 'Anexo nao encontrado' });
  const filePath = join(uploadDir, a.nome_arquivo);
  if (!existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo nao localizado no servidor' });
  res.setHeader('Content-Type', a.mime || 'application/octet-stream');
  const disp = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(a.nome_original)}`);
  createReadStream(filePath).pipe(res);
});

anexosRouter.delete('/anexos/:id', async (req, res) => {
  const a = (await db.prepare('SELECT * FROM anexos WHERE id=?').get(req.params.id)) as AnexoRow | undefined;
  if (!a) return res.status(404).json({ erro: 'Anexo nao encontrado' });
  try { const fp = join(uploadDir, a.nome_arquivo); if (existsSync(fp)) unlinkSync(fp); } catch { /* ignora */ }
  await db.prepare('DELETE FROM anexos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
