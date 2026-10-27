# FROTA

PWA privado de cadastro, consulta e arquivo documental de veículos. Um único espaço de trabalho; os 7 titulares da planilha são **grupos**, não contas separadas.

Fluxo central: **abrir → digitar/colar a placa → resultado instantâneo → ficha → documentos.**

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · PostgreSQL + Prisma 7 · S3 compatível (Railway Buckets) com criptografia na aplicação.

---

## Rodar localmente

Pré-requisitos: Node 22+. Não precisa de Docker: o Postgres de desenvolvimento é embutido.

```bash
npm install
cp .env.example .env          # preencha SESSION_SECRET e FILE_MASTER_KEY (comandos no arquivo)
npm run db:local              # terminal 1: Postgres local na porta 5433 (deixe aberto)
npx prisma migrate deploy     # terminal 2
npm run db:seed               # importa a planilha: 7 grupos, 85 veículos
npm run admin:criar -- --email voce@empresa.com --nome "Seu Nome"
npm run dev -- -p 3100        # abra o link impresso pelo admin:criar para definir a senha
```

## Dados da planilha

- `frota_seed.json` e `diagnostico_frota.md` são gerados da planilha original por `scripts/planilha/extrair.py` (preserva aba, linha e o valor bruto de cada célula). Contêm dados reais (CPF/CNPJ, telefones, RENAVAM) e **não vão para o git**: gere-os localmente a partir da planilha. Sem o arquivo, o seed é ignorado e os testes de integração/e2e não rodam.
- `npm run db:seed` é **idempotente**: chave por aba (grupo) e aba+linha (veículo). Rodar de novo não duplica nada e não sobrescreve edições feitas no app.
- `TUY3H251` (8 caracteres) entra marcada como **placa para revisar**, sem correção. `RES1J06` entra sem chassi (o valor original `CHASSI` fica na origem). RENAVAM é texto. `DATA` vira **Referência da planilha** (nunca vencimento) e `OK/ATRASADO/PENDENTE` é **situação legada**.
- Placas iguais ou parecidas nunca são fundidas; o app mostra o aviso na ficha e pede confirmação ao cadastrar duplicata.

## Acesso e papéis

- Cadastro fechado. O primeiro administrador nasce por `npm run admin:criar` (sem senha padrão: gera link de uso único, 48 h).
- **Administrador**: cadastra, edita, arquiva veículos; gere grupos; anexa, substitui e exclui documentos; convida pessoas (link para enviar por WhatsApp/compartilhar), troca papéis, desativa e gera link de redefinição de senha.
- **Leitura**: busca, consulta fichas, visualiza e baixa documentos.

## Segurança (resumo)

| Tema | Como está resolvido |
|---|---|
| Sessão | Token aleatório de 256 bits em cookie `__Host-` HttpOnly, Secure, SameSite=Lax; só o hash SHA-256 fica no banco. Expira em 30 dias ou 7 dias sem uso. |
| Senhas | scrypt (N=32768), mínimo 10 caracteres. Mensagem de erro única e tempo constante (não revela se o e-mail existe). |
| Força bruta | 5 falhas por e-mail ou 30 por IP em 15 min bloqueiam novas tentativas. |
| Autorização | Checada no servidor em toda página, Server Action e rota de API (`src/lib/auth/dal.ts`). |
| CSRF | Server Actions: verificação de origem do Next. Rotas de upload/exclusão: `Origin`/`Sec-Fetch-Site` obrigatoriamente da mesma origem. |
| Uploads | PDF/JPG/PNG/WEBP até 25 MB, conferidos pela assinatura binária real (não pela extensão). Fotos são reduzidas e regravadas no aparelho (remove EXIF/GPS). Envio em blocos de 3 MB com progresso e nova tentativa. |
| Arquivos | **AES-256-GCM na aplicação**, chave aleatória por arquivo protegida pela `FILE_MASTER_KEY` (envelope). Cada bloco é autenticado com id do documento + posição. O bucket só guarda dados cifrados. |
| Download | Link assinado (HMAC, 5 min) preso ao usuário, emitido só após autorização; a rota exige também a sessão. `Cache-Control: no-store`. Nenhuma URL pública do bucket. |
| PWA | O service worker só guarda a tela offline, ícones e JS/CSS com hash. Nunca páginas autenticadas, API ou documentos. |
| LGPD | CPF/CNPJ/telefones só para usuários autenticados; nada de dados pessoais em logs; auditoria registra quem fez o quê. |
| Cabeçalhos | CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, anti-iframe. |

### Railway Buckets: sem criptografia no servidor e sem versionamento

Tratado assim:
1. **Criptografia na aplicação** (acima): vazamento do bucket não expõe documentos.
2. **Exclusão recuperável**: excluir/substituir documento só marca no banco; os blocos ficam 30 dias. `npm run purge` remove depois disso.
3. **Backup em bucket separado** (`frota-backups`, outra região) com manifesto SHA-256.

## Backup e restauração

```bash
npm run backup                                  # banco (todas as tabelas) + anexos cifrados + manifesto
npm run restaurar -- frota-2026-10-27T18-00-00-000Z   # num banco NOVO já migrado
npm run purge                                   # rode depois do backup, diariamente
```

- Destino: `BACKUP_S3_*` (bucket próprio) ou a pasta `BACKUP_DIR`.
- A restauração confere o SHA-256 de tudo e **recusa** banco que já tenha dados.
- Os anexos do backup continuam cifrados. **Guarde a `FILE_MASTER_KEY` num cofre de senhas, fora do Railway.** Sem ela não há como abrir documentos.
- O Postgres do Railway também tem backups nativos de volume (aba *Backups* do serviço Postgres). Use os dois.

Restauração completa, passo a passo:
1. Crie um Postgres novo e aponte `DATABASE_URL` para ele.
2. `npx prisma migrate deploy`.
3. Defina `STORAGE_DRIVER`/`S3_*` para o bucket de destino e a mesma `FILE_MASTER_KEY` original.
4. `npm run restaurar -- <nome-do-backup>`.
5. Suba o app apontando para o novo banco/bucket.

## Testes

```bash
npm run lint
npm run typecheck
npm test                 # unitários + integração (precisa do `npm run db:local`)
npm run build && npm run test:e2e   # Playwright contra o build de produção
```

E2E cobre: login e bloqueio, busca tolerante (hífen, caixa, antiga↔Mercosul, RENAVAM, chassi, Ctrl+K), placa anômala, cadastro a partir de “nada encontrado”, aviso de duplicata, edição, arquivamento, anexar PDF e foto, envio em blocos de 7 MB, prévia, download, arquivo falso recusado, substituição, exclusão, permissões de leitura no servidor, links assinados, CSRF, manifesto, service worker, tela offline, ausência de cache autenticado e layout sem rolagem horizontal em 360/768/1280 px.

## Deploy (Railway)

Projeto `frota` (isolado): serviço `frota-app`, `Postgres`, buckets `frota-docs` (sjc) e `frota-backups` (iad).

Variáveis do `frota-app`:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://<domínio>
SESSION_SECRET=<gerado>
FILE_MASTER_KEY=<gerado — copie para o cofre de senhas>
STORAGE_DRIVER=s3
S3_ENDPOINT=${{frota-docs.ENDPOINT}}
S3_BUCKET=${{frota-docs.BUCKET}}
S3_REGION=${{frota-docs.REGION}}
S3_ACCESS_KEY_ID=${{frota-docs.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY=${{frota-docs.SECRET_ACCESS_KEY}}
NODE_ENV=production
PORT=8080
```

Comandos:

```bash
railway link -p <projeto> -e production -s frota-app
railway up --detach                 # build: npm run build · start: migrate + seed idempotente + next start
railway ssh -s frota-app -- npm run admin:criar -- --email cliente@empresa.com --nome "Nome"
```

Build `npm run build`, start `npm start` (migra, roda o seed idempotente e sobe o Next), healthcheck `/offline`: configurados no serviço. Serviço `frota-backup`: cron `0 6 * * *` (03:00 de Brasília) rodando `npx tsx scripts/backup.ts && npx tsx scripts/purge.ts` com as variáveis `S3_*` (docs) e `BACKUP_S3_*` (`frota-backups`).

### Vercel (opcional)

O app roda também na Vercel: uploads são feitos em blocos de 3 MB (abaixo do limite de 4,5 MB por requisição) e downloads são transmitidos em stream. Atenção: o plano **Hobby da Vercel não permite uso comercial**; para cliente use Pro. Configure as mesmas variáveis e rode `npx prisma migrate deploy && npm run db:seed` uma vez a partir da sua máquina.

## Marca

Provisória: **FROTA**. Para a identidade da cliente: `src/lib/brand.ts` (nome/cores do manifesto), tokens em `src/app/globals.css`, ícone em `public/icons/icon.svg` e depois `npm run icons`.

## Estrutura

```
prisma/            schema, migrações, seed idempotente
scripts/           banco local, admin inicial, backup, restauração, limpeza, extração da planilha
src/app/(auth)     login e convite
src/app/(app)      busca, veículos, grupos, usuários, conta, histórico, instalação
src/app/api        índice de busca, upload em blocos, links assinados, conteúdo decifrado
src/lib            placa/busca (puro), sessão/DAL, cripto, armazenamento, auditoria
tests/             unit, integração (Postgres real) e E2E (Playwright)
```
