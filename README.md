# Sattva Finanças

Aplicativo web gratuito para controle de finanças pessoais: lançamentos por mês, gastos parcelados, cofrinho, relatório por período, backup e sincronização opcional com o Google Drive. Funciona offline (PWA) e os dados ficam com você.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Service%20Worker-5A0FC8)
![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18)
![License](https://img.shields.io/badge/license-private-lightgrey)

## Utilize o Sattva Finanças

**Acesse:** https://sattva-financas.netlify.app/

**Status:**
[![Netlify Status](https://api.netlify.com/api/v1/badges/35265018-4287-4e8f-90c2-951ccac583b5/deploy-status)](https://app.netlify.com/projects/sattva-financas/deploys)

**Privacidade:** [Política de Privacidade](https://sattva-financas.netlify.app/privacidade.html)

## Visão geral

O Sattva Finanças é uma aplicação Angular standalone, sem servidor e sem banco de dados. Os lançamentos ficam no `localStorage` do navegador e podem ser levados para outro aparelho de duas formas:

- **Backup manual:** exportar e importar um arquivo JSON.
- **Google Drive (opcional):** login com Google e sincronização automática com um arquivo na pasta oculta do app (`appDataFolder`), usando apenas o escopo `drive.appdata`.

## UX/UI e Design

A experiência de usuário (UX) e a interface (UI) do Sattva Finanças foram desenvolvidas em parceria com **[Jaqueline Lima](https://github.com/jaquelinelima2)**, responsável pela concepção dos fluxos de navegação, identidade visual e protótipos criados no Figma.

O processo de desenvolvimento foi baseado nos protótipos e estudos realizados no Figma, buscando uma experiência simples, intuitiva e focada no uso cotidiano do controle financeiro pessoal.

## Funcionalidades

**Lançamentos**

- Renda mensal, gastos fixos, gastos variáveis e cofrinho, organizados por mês.
- Gastos variáveis parcelados, distribuídos automaticamente nos meses seguintes, mostrando quanto falta pagar.
- Gasto fixo vale do mês em que foi criado em diante; editar ou encerrar vale a partir do mês da tela.
- Edição de parcela recalcula a compra inteira (valor total e quantidade).
- Marcar como pago/não pago e total "falta pagar" no balanço do mês.
- Desfazer exclusão e desfazer importação pelo aviso na tela.

**Relatório**

- Relatório em árvore por período (até 36 meses), com total do período.
- Copiar e imprimir.

**Dados e sincronização**

- Backup em JSON (exportar/importar), com validação dos dados importados.
- Sincronização com o Google Drive: a versão mais recente vence (*last-write-wins*), com envio automático alguns segundos após cada alteração.
- Duas abas abertas não sobrescrevem os dados uma da outra.
- Aviso quando o navegador não consegue salvar (armazenamento cheio ou bloqueado).

**PWA e segurança**

- Instalável, funciona offline (inclusive a fonte, que é servida localmente).
- Aviso de nova versão disponível, sem recarregar sozinho.
- Content-Security-Policy e cabeçalhos de segurança via `public/_headers` (Netlify).

## Stacks

| Camada       | Tecnologia                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | Angular 21 (standalone, zoneless, OnPush)                                           |
| Linguagem    | TypeScript 5.9                                                                      |
| UI           | Componentes standalone, control flow (`@if`/`@for`), `<dialog>` nativo e CSS puro   |
| Estado       | Angular Signals (`signal`, `computed`, `linkedSignal`, `effect`)                    |
| Formulários  | Reactive Forms tipados + diretiva de máscara monetária (`ControlValueAccessor`)     |
| Persistência | `localStorage` + Google Drive REST v3 (`appDataFolder`)                             |
| Login        | Google Identity Services (token model)                                              |
| HTTP         | `HttpClient` com interceptor funcional para o token do Google                       |
| PWA          | `@angular/service-worker`, `ngsw-config.json` e `manifest.webmanifest`              |
| Fonte        | Poppins via `@fontsource/poppins` (sem Google Fonts)                                |
| Testes       | Angular unit test builder com Vitest                                                |
| Qualidade    | ESLint (`angular-eslint`) e Prettier                                                |
| Hospedagem   | Netlify                                                                             |

## Arquitetura

```mermaid
flowchart LR
  User["Usuário"] --> App["App<br/>balanço, cards e resumo"]
  App --> EntryForm["EntryForm<br/>novo lançamento"]
  App --> EntryCard["EntryCard<br/>lista do mês"]
  App --> Edit["EditEntryDialog<br/>regras de edição"]
  App --> Report["ReportDialog<br/>relatório por período"]
  App --> Menu["SideMenu<br/>Drive e backup"]
  EntryForm --> App
  App --> Storage["WalletStorageService<br/>signals"]
  Edit --> Storage
  Menu --> Storage
  Storage --> LS[("localStorage")]
  Menu --> Sync["DriveSyncService"]
  Sync --> Storage
  Sync --> Api["DriveApiService"]
  Api --> Interceptor["googleAuthInterceptor"]
  Interceptor --> Drive[("Google Drive<br/>appDataFolder")]
```

As regras de negócio ficam em funções puras em `core/utils` (parcelas, edição, visibilidade por mês, resumo, decisão de sincronização, árvore do relatório), o que deixa a maior parte da lógica testável sem Angular.

### Modelo de dados

```mermaid
classDiagram
  class WalletEntry {
    string id
    TransactionKind kind
    string description
    number value
    string month
    string createdAt
  }

  class FixedExpenseEntry {
    Record paidMonths
    string deletedFromMonth
  }

  class VariableExpenseEntry {
    boolean paid
    InstallmentInfo installment
  }

  class InstallmentInfo {
    string groupId
    number current
    number total
  }

  WalletEntry <|-- FixedExpenseEntry
  WalletEntry <|-- VariableExpenseEntry
  VariableExpenseEntry --> InstallmentInfo
```

`WalletEntry` é uma *discriminated union* pelo campo `kind` (`income`, `fixed-expense`, `variable-expense`, `saving`).

### Sincronização com o Drive

```mermaid
sequenceDiagram
  actor Pessoa
  participant Menu as SideMenu
  participant Sync as DriveSyncService
  participant Drive as Google Drive

  Pessoa->>Menu: Conectar Google Drive
  Menu->>Sync: syncNow()
  Sync->>Drive: procura o backup
  Drive-->>Sync: arquivo (ou nenhum)
  Sync->>Sync: decideSync(): local x Drive
  alt Drive mais recente
    Sync->>Sync: substitui os dados locais
  else local mais recente
    Sync->>Drive: envia os dados
  end
  Note over Sync: depois, cada alteração local é enviada após 3 s
```

## Estrutura

```text
src/
  app/
    app.ts / app.html / app.css   # Tela principal: balanço, cards e resumo
    app.config.ts                 # Locale pt-BR, HttpClient + interceptor, service worker
    core/
      config/                     # Client ID e escopo do Google
      models/                     # Tipos do domínio (WalletEntry, TransactionKind...)
      services/                   # Storage, backup, relatório, Drive, login, toast
      utils/                      # Funções puras com as regras de negócio
    features/
      entry-card/                 # Card com a lista de lançamentos do mês
      entry-form/                 # Formulário de novo lançamento
      edit-entry-dialog/          # Modal de edição
      month-picker/               # Seletor de mês
      report-dialog/              # Relatório por período
      side-menu/                  # Menu lateral (Drive, backup, ferramentas)
    shared/
      components/                 # Modal (<dialog>) e avisos (toast)
      directives/                 # Máscara de moeda
      forms/                      # Validadores compartilhados
public/
  _headers                        # CSP e cabeçalhos de segurança (Netlify)
  privacidade.html                # Política de Privacidade
  manifest.webmanifest            # Configuração PWA
  icons/                          # Ícones do PWA
scripts/
  generate-icons.js               # Geração dos ícones via sharp
```

## Desenvolvimento

```bash
npm install          # o .npmrc já configura legacy-peer-deps
npm start            # http://localhost:4200
npm test             # testes (Vitest)
npm run lint         # ESLint
npm run build        # build de produção em dist/
```

Para testar o PWA (service worker), sirva a build de produção por HTTP; o `ng serve` não ativa o service worker.

## Backup e dados

Os lançamentos ficam na chave `sattva-wallet-entries-v1` do `localStorage`, e a data da última alteração em `sattva-wallet-modified-at` (usada para comparar com o backup do Drive).

O backup exporta um JSON com metadados (`app`, `version`, `exportedAt`) e a lista de lançamentos. Na importação, cada item é validado (mês, valor, descrição, ids repetidos) e os dados atuais são substituídos, com opção de desfazer.

O serviço também migra dados antigos das chaves `rendas`, `gastosFixos` e `gastosVariaveis` para o formato atual.
