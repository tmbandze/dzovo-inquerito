# Inquérito aos Encarregados de Educação — Colégio Dzovo

Aplicação web do inquérito de satisfação, acessível por código QR. Custo zero:
o site fica no **GitHub Pages** e as respostas são gravadas numa **Google Sheet**
através do **Google Apps Script**.

```
Telemóvel do encarregado ──► Site (GitHub Pages) ──► Apps Script ──► Google Sheet
         (código QR)              React + Vite          doPost()       "Respostas" / "Professores"
```

## Estrutura

| Ficheiro | Para quê |
|---|---|
| `src/config/survey.ts` | **O único ficheiro a editar no dia a dia**: perguntas, recintos, classes, professores e o endereço da Google Sheet |
| `src/i18n.ts` | Textos da interface em português e inglês |
| `src/App.tsx`, `src/components.tsx` | Ecrãs e componentes (baseados no design do Figma Make) |
| `src/state.ts` | Respostas, rascunho no telemóvel, validação e envio |
| `apps-script/Codigo.gs` | Código que recebe as respostas na Google Sheet |
| `scripts/gerar-qr.mjs` | Gera o código QR para impressão |

## Funcionalidades

- 7 secções: Identificação · Organização · Direção · Administração · Professores · Melhorias · Comentários finais
- Escolha de **recinto (Dzovo 1 / Dzovo 2)**, currículo e classe; aparecem só os professores dessa turma
- Português / Inglês em todo o inquérito
- Validação: as perguntas obrigatórias ficam destacadas e o ecrã desloca-se até elas
- Rascunho guardado no telemóvel: se o encarregado sair a meio, pode continuar depois
- Anónimo por defeito; o contacto é opcional e o aviso de privacidade aparece antes
- Proteção contra fórmulas maliciosas na folha

## 1. Testar no computador

```bash
npm install
npm run dev
```

Abre o endereço indicado (normalmente http://localhost:5173). Enquanto
`ENDPOINT_URL` estiver vazio, o inquérito funciona em **modo demonstração**:
nada é enviado e a resposta aparece na consola do navegador.

## 2. Ligar à Google Sheet

> Recomendado: usar uma **conta Google da escola**, para que os dados fiquem com a instituição.

1. Criar uma Google Sheet nova, por exemplo "Inquérito Encarregados 2026".
2. Menu **Extensões → Apps Script**.
3. Apagar o conteúdo e colar o ficheiro `apps-script/Codigo.gs`. Guardar.
4. **Implementar → Nova implementação** → tipo **Aplicação Web**:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
5. Autorizar quando o Google pedir e copiar o **URL da aplicação web** (termina em `/exec`).
6. Colar esse URL em `src/config/survey.ts`:
   ```ts
   export const ENDPOINT_URL = 'https://script.google.com/macros/s/XXXX/exec'
   ```
7. Para confirmar que está ativo, abrir o URL no navegador: deve aparecer `"ok": true`.

As folhas **Respostas** e **Professores** são criadas sozinhas na primeira resposta.
Se mais tarde se acrescentarem perguntas, as colunas novas são adicionadas no fim.

> Se alterares o `Codigo.gs`, faz **Implementar → Gerir implementações → Editar → Nova versão**
> para manter o mesmo URL.

### Painel de resultados

O mesmo `Codigo.gs` cria um menu **Inquérito** na Google Sheet (aparece ao abrir a folha):

- **Atualizar painel**: cria/atualiza o separador **Painel** (cartões com respostas, satisfação
  média, recomendação e NPS; médias por área e por pergunta; pontos fortes e a melhorar;
  comparação entre recintos e currículos; melhorias pedidas; quem respondeu; comentários) e o
  separador **Painel Professores** (confidencial). Também arruma o aspeto das folhas de respostas.
- **Atualizar automaticamente (de hora a hora)**: liga a atualização automática.

Os filtros (recinto, currículo, classe, edição) escolhem-se no topo do Painel. Para apresentar,
**Ficheiro → Transferir → PDF**, escolhendo "Folha atual". O painel não mostra dados de contacto.
Não mudar o texto dos cabeçalhos das folhas Respostas e Professores: são usados para gravar.

## 3. Publicar no GitHub Pages

1. Criar um repositório no GitHub (por exemplo `dzovo-inquerito`) e enviar esta pasta:
   ```bash
   git init
   git add .
   git commit -m "Inquérito Colégio Dzovo"
   git branch -M main
   git remote add origin https://github.com/UTILIZADOR/dzovo-inquerito.git
   git push -u origin main
   ```
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. O ficheiro `.github/workflows/deploy.yml` publica o site automaticamente a cada `git push`.
   O endereço fica `https://UTILIZADOR.github.io/dzovo-inquerito/`.

## 4. Gerar o código QR

```bash
npm run qr -- https://UTILIZADOR.github.io/dzovo-inquerito/
```

Cria `qr-inquerito.png` (alta resolução, para circulares e cartazes) e `qr-inquerito.svg`.

## 5. Antes de abrir aos pais

- [ ] Perguntas finais aprovadas pelo Conselho (editar `src/config/survey.ts`)
- [ ] Moradas reais do Dzovo 1 e Dzovo 2 (`CAMPUSES`)
- [ ] Classes existentes em cada currículo (`GRADES`, `CURRICULA_BY_CAMPUS`)
- [ ] **Lista real de professores** (`TEACHERS`): substituir a função `exemplos()` por uma lista
- [ ] `ENDPOINT_URL` preenchido e testado com 2 ou 3 respostas de teste (apagar depois na folha)
- [ ] `EDICAO` atualizado (ex.: `2026-T4`)
- [ ] Testar em 2 ou 3 telemóveis diferentes, incluindo um Android simples

### Exemplo de lista real de professores

```ts
export const TEACHERS: Teacher[] = [
  { campus: 'dzovo1', curriculum: 'nacional',  grades: ['1.ª classe'], name: 'Nome Apelido', subject: { pt: 'Professor(a) titular', en: 'Class teacher' } },
  { campus: 'dzovo2', curriculum: 'cambridge', grades: ['Grade 4', 'Grade 5'], name: 'Nome Apelido', subject: { pt: 'Matemática', en: 'Mathematics' } },
]
```

## Privacidade

- Não se recolhe nome, email nem telefone, exceto se o encarregado escolher ser contactado.
- O site não usa cookies nem ferramentas de estatística.
- O acesso à Google Sheet deve ficar limitado a quem a Direção definir (ver decisões do Conselho).
