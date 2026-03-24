# RedeFLOW — Especificação de Requisitos do Sistema

> Aplicativo web para gestão da produção de conteúdo educacional

| Campo | Valor |
|---|---|
| **Versão** | 1.0 — Inicial |
| **Data** | Março 2026 |
| **Status** | Em revisão |
| **Responsável** | Equipe de Produto iRede |
| **Classificação** | Uso interno |

*Baseado na análise das Matrizes Instrucional e de Conteúdo do curso Microeletrônica Geral (7 unidades, ~130 OAs, 320h).*

---

## Sumário

1. [Introdução](#1-introdução)
   - 1.1 [Contexto](#11-contexto)
   - 1.2 [Objetivo do sistema](#12-objetivo-do-sistema)
   - 1.3 [Escopo](#13-escopo)
   - 1.4 [Definições e siglas](#14-definições-e-siglas)
2. [Partes interessadas e perfis de usuário](#2-partes-interessadas-e-perfis-de-usuário)
   - 2.1 [Papéis e responsabilidades](#21-papéis-e-responsabilidades)
3. [Requisitos funcionais](#3-requisitos-funcionais)
   - [M1 — Gestão de cursos](#m1--gestão-de-cursos)
   - [M2 — Matriz instrucional](#m2--matriz-instrucional)
   - [M3 — Matriz de conteúdo e quadro de OAs](#m3--matriz-de-conteúdo-e-quadro-de-oas)
   - [M4 — Painel do objeto de aprendizagem](#m4--painel-do-objeto-de-aprendizagem)
   - [M5 — Meu trabalho](#m5--meu-trabalho)
   - [M6 — Relatórios e dashboards](#m6--relatórios-e-dashboards)
   - [M7 — Notificações e alertas](#m7--notificações-e-alertas)
   - [M8 — Gestão de usuários e permissões](#m8--gestão-de-usuários-e-permissões)
4. [Requisitos não funcionais](#4-requisitos-não-funcionais)
   - 4.1 [Desempenho](#41-desempenho)
   - 4.2 [Usabilidade](#42-usabilidade)
   - 4.3 [Confiabilidade e disponibilidade](#43-confiabilidade-e-disponibilidade)
   - 4.4 [Segurança](#44-segurança)
   - 4.5 [Manutenibilidade e arquitetura](#45-manutenibilidade-e-arquitetura)
   - 4.6 [Portabilidade e interoperabilidade](#46-portabilidade-e-interoperabilidade)
5. [Restrições e premissas](#5-restrições-e-premissas)
6. [Critérios de aceite do MVP](#6-critérios-de-aceite-do-mvp)
7. [Glossário técnico](#7-glossário-técnico)

---

## 1. Introdução

### 1.1 Contexto

O iRede produz cursos de educação a distância gerenciando o processo por meio de dois artefatos em planilha: a **Matriz Instrucional (MI)**, que define o planejamento pedagógico de cada unidade (capítulos, objetivos educacionais, tipos e quantidades de objetos de aprendizagem e cargas horárias), e a **Matriz de Conteúdo (MC)**, que registra o acompanhamento da produção de cada objeto de aprendizagem (OA) ao longo de um pipeline de etapas com múltiplos responsáveis.

O processo atual envolve planilhas compartilhadas, gestão manual de status e comunicação fragmentada entre os membros da equipe — conteudistas, designers instrucionais, professores-atores, professores técnicos, produtores e validadores. O Monday.com tem sido utilizado de forma experimental, mas carece de contexto específico para o domínio de produção de conteúdo educacional do iRede.

### 1.2 Objetivo do sistema

O **RedeFLOW** é uma aplicação web de gestão da produção de conteúdo educacional, construída especificamente para o fluxo de trabalho do iRede. O sistema substitui as planilhas e a adoção parcial do Monday, centralizando em uma única plataforma:

- O planejamento pedagógico (Matriz Instrucional) de cada unidade dos cursos;
- O acompanhamento da produção de cada OA ao longo do pipeline de etapas;
- A comunicação e colaboração entre os membros da equipe;
- Os relatórios gerenciais de progresso, atrasos e carga de trabalho.

### 1.3 Escopo

O sistema abrange os seguintes domínios funcionais:

- Gestão de cursos, unidades e capítulos;
- Matriz instrucional editável com cálculo automático de carga horária;
- Matriz de conteúdo com quatro visões: lista, Kanban, Gantt e por responsável;
- Pipeline de produção configurável por tipo de OA;
- Painel de detalhamento de OA com histórico, arquivos e comentários;
- Visão pessoal de trabalho por papel (Meu trabalho);
- Relatórios e dashboards gerenciais;
- Sistema de notificações e alertas de prazo;
- Gestão de usuários, papéis e permissões.

> **Fora do escopo desta versão (v1.0):** integração com LMS, geração automática de conteúdo por IA, player de vídeo, módulo financeiro e aplicativo mobile nativo.

### 1.4 Definições e siglas

| Sigla / Termo | Definição |
|---|---|
| **OA** | Objeto de Aprendizagem — unidade atômica de conteúdo produzida (vídeo, slide, quiz, e-book, plano de aula, tarefa) |
| **MI** | Matriz Instrucional — documento de planejamento pedagógico de uma unidade de curso |
| **MC** | Matriz de Conteúdo — documento de gestão da produção de OAs de uma unidade |
| **DI** | Designer Instrucional — responsável pela revisão e adequação pedagógica do conteúdo para EAD |
| **CH** | Carga Horária — tempo previsto em horas para atividades síncronas, assíncronas ou avaliativas |
| **Pipeline** | Sequência de etapas de produção de um OA: Conteudista → DI → Gravação → Rev. Técnica → Acessibilidade → Produção → Validação |
| **TRB / Bloom** | Taxonomia de Bloom revisada — framework de classificação de objetivos educacionais por nível cognitivo |

---

## 2. Partes interessadas e perfis de usuário

### 2.1 Papéis e responsabilidades

| Papel | Perfil de acesso | Responsabilidades | Principal tela |
|---|---|---|---|
| **Coordenador de Produção** | Administrador | Supervisiona todos os cursos, aprova entregas, configura o sistema e gera relatórios gerenciais | Dashboard / Relatórios |
| **Conteudista** | Colaborador | Produz o conteúdo bruto dos OAs (roteiros, slides, questões, e-books, planos de aula, tarefas) | Meu trabalho |
| **Designer Instrucional** | Colaborador | Revisa e adapta o conteúdo para EAD; é o principal guardião da qualidade pedagógica do OA | Meu trabalho / MC |
| **Professor-Ator** | Colaborador | Grava os vídeos a partir dos roteiros aprovados pelo DI (etapa exclusiva de OAs tipo vídeo) | Meu trabalho |
| **Professor Técnico** | Colaborador | Realiza a revisão técnica do conteúdo após gravação ou produção, garantindo a correção do conteúdo | Meu trabalho |
| **Produtor de Acessibilidade** | Colaborador | Aplica padrões de acessibilidade (WCAG) ao OA | Meu trabalho |
| **Produtor Final** | Colaborador | Monta e entrega o OA final na plataforma, registrando o link do arquivo definitivo | Meu trabalho |
| **Validador Final** | Colaborador / Admin | Aprova o OA final antes da publicação no LMS | Painel do OA |

---

## 3. Requisitos funcionais

> **Legenda de prioridade:** `Alta` = essencial para o MVP · `Média` = previsto para v1.1 · `Baixa` = roadmap futuro  
> **Legenda de complexidade:** estimativa relativa de esforço de desenvolvimento

### M1 — Gestão de cursos

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M1-01 | Cadastro de curso | Criar, editar e arquivar cursos com: nome, código, carga horária total planejada, data de início/fim, status (planejamento / em produção / concluído) e equipe responsável. | Alta | Coordenador | Baixa |
| RF-M1-02 | Listagem de cursos | Exibir todos os cursos em cards com: nome, % de OAs concluídos, status, próximo deadline, e acesso rápido à MI e à MC. | Alta | Todos | Baixa |
| RF-M1-03 | Detalhe do curso | Tela com resumo do curso: unidades, progresso por unidade (barra de %), equipe, CH total prevista vs. realizada, e links para MI e MC de cada unidade. | Alta | Todos | Média |
| RF-M1-04 | Importação de planilha | Importar MI e MC a partir dos arquivos .xlsx existentes, mapeando colunas automaticamente e criando as entidades correspondentes no sistema. | Alta | Coordenador | Alta |
| RF-M1-05 | Exportação para Excel | Exportar MI e MC de qualquer unidade no formato .xlsx compatível com o padrão atual, para uso externo ou backup. | Média | Coordenador | Média |
| RF-M1-06 | Duplicar curso | Criar um novo curso a partir da estrutura de um curso existente (MI pré-preenchida, pipeline configurado), sem os dados de produção. | Baixa | Coordenador | Média |

### M2 — Matriz instrucional

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M2-01 | Editor da MI | Tabela editável inline com as colunas: Nº capítulo, Nome, Conteúdo (resumo), Objetivo educacional, Nível Bloom/TRB, Papéis e atores, Objetos de aprendizagem (tipo e qtd.), CH síncrona, CH assíncrona, CH atividades, Período (dias), Ferramentas, Atividade formativa, Atividade somativa, Feedback. | Alta | Coordenador, DI | Alta |
| RF-M2-02 | Cálculo automático de CH | Calcular automaticamente CH total síncrona, assíncrona e de atividades da unidade a partir dos valores inseridos em cada capítulo, atualizando em tempo real. | Alta | Coordenador, DI | Baixa |
| RF-M2-03 | Geração automática de OAs | A partir da definição de tipo e quantidade de OAs na MI, gerar automaticamente os registros correspondentes na MC com código estruturado (ex: U2C1O1V1). | Alta | Coordenador, DI | Alta |
| RF-M2-04 | Padrão de nomenclatura | Gerar e exibir o código de cada OA seguindo o padrão `U{u}C{c}O{o}{tipo}{n}`: U=unidade, C=capítulo, O=objetivo, tipo=V/S/Q/P/E/T, n=sequencial. | Alta | Sistema | Baixa |
| RF-M2-05 | Versão / histórico | Registrar o histórico de alterações da MI com data, autor e campo modificado, permitindo visualizar e restaurar versões anteriores. | Média | Coordenador | Média |
| RF-M2-06 | Comentários na MI | Adicionar comentários por linha ou célula da MI, com menção (@usuário) e thread de respostas. | Média | Todos | Média |

### M3 — Matriz de conteúdo e quadro de OAs

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M3-01 | Visão lista (tabela) | Exibir todos os OAs de uma unidade em tabela com colunas: código, tipo, % progresso, conteudista + status, DI + status, prof. ator + status, prof. técnico + status, produtor acessibilidade + status, produtor final + status, validação final, link objeto final, deadline final. Colunas fixáveis e ocultáveis. | Alta | Todos | Alta |
| RF-M3-02 | Agrupamento por capítulo | Na visão lista, agrupar OAs por capítulo com cabeçalho colapsável, subtotal de OAs e % de conclusão do capítulo. | Alta | Todos | Baixa |
| RF-M3-03 | Visão Kanban | Exibir OAs em colunas de status (Não iniciado / Em andamento / Em revisão / Concluído / Bloqueado), com cards arrastáveis que ao serem movidos atualizam o status da etapa corrente do pipeline. | Alta | Todos | Alta |
| RF-M3-04 | Visão Gantt | Exibir OAs em linha do tempo com barras por deadline de cada etapa do pipeline, com indicador de data atual e zoom semanal/mensal. | Média | Coordenador | Alta |
| RF-M3-05 | Visão por responsável | Agrupar OAs por responsável da etapa corrente, exibindo carga de trabalho de cada pessoa e deadline mais próximo. | Média | Coordenador | Média |
| RF-M3-06 | Filtros e busca | Filtrar OAs por: tipo, status de qualquer etapa, responsável, capítulo, deadline (vencido / esta semana / este mês), e texto livre (código ou título). | Alta | Todos | Média |
| RF-M3-07 | KPIs da unidade | Exibir acima do quadro: total de OAs, concluídos, pendentes, atrasados, CH síncrona e CH assíncrona calculadas. | Alta | Todos | Baixa |
| RF-M3-08 | Atualização de status inline | Atualizar o status de qualquer etapa diretamente na tabela ou no card Kanban, sem abrir o painel de detalhes. | Alta | Todos | Baixa |
| RF-M3-09 | Registro de deadline real | Registrar, além do deadline previsto, a data real de entrega de cada etapa, calculando automaticamente o atraso em dias. | Alta | Todos | Baixa |
| RF-M3-10 | Pipeline adaptável por tipo | Aplicar pipelines diferentes conforme o tipo de OA: vídeos incluem etapa de gravação (prof. ator); slides, quizzes, e-books, planos de aula e tarefas pulam essa etapa automaticamente. | Alta | Sistema | Média |

### M4 — Painel do objeto de aprendizagem

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M4-01 | Drawer de detalhes | Ao clicar em qualquer OA, abrir um painel lateral (drawer) com todas as informações do OA sem navegar para outra página. | Alta | Todos | Média |
| RF-M4-02 | Pipeline visual | Exibir o pipeline de etapas do OA como stepper visual (Conteudista → DI → Gravação → Rev. Técnica → Acessibilidade → Produção → Validação), com status, responsável, deadline previsto, deadline real e atraso calculado em cada etapa. | Alta | Todos | Média |
| RF-M4-03 | Atribuição de responsável | Selecionar ou alterar o responsável de cada etapa diretamente no painel, com busca por nome. | Alta | Coordenador, DI | Baixa |
| RF-M4-04 | Gestão de arquivos e links | Anexar link de objeto (URL ou caminho de arquivo) em cada etapa e no campo de objeto final, com validação de formato e exibição do nome do arquivo. | Alta | Todos | Baixa |
| RF-M4-05 | Comentários por etapa | Adicionar comentários em cada etapa do pipeline com suporte a menção (@usuário), com notificação ao mencionado. | Alta | Todos | Média |
| RF-M4-06 | Histórico de alterações | Registrar automaticamente todas as mudanças de status, responsável, deadline e arquivos, exibindo um log cronológico no painel. | Média | Todos | Média |
| RF-M4-07 | Marcação de bloqueio | Sinalizar uma etapa como Bloqueada com descrição do motivo, notificando o coordenador e pausando o cálculo de atraso. | Média | Todos | Média |
| RF-M4-08 | Avaliação e pontuação | Registrar a pontuação da atividade avaliativa (quando aplicável) e o tipo de feedback previsto, conforme definido na MI. | Baixa | DI, Coordenador | Baixa |

### M5 — Meu trabalho

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M5-01 | Visão pessoal de OAs | Exibir todos os OAs atribuídos ao usuário logado, em qualquer etapa do pipeline, ordenados por deadline ascendente. | Alta | Todos | Baixa |
| RF-M5-02 | Filtro por papel | Filtrar OAs por etapa do pipeline (ex: DI só vê suas etapas de DI; prof. ator vê só etapas de gravação), com possibilidade de ver tudo. | Alta | Todos | Baixa |
| RF-M5-03 | Indicador de atraso | Destacar visualmente (cor vermelha) OAs com deadline vencido e exibir o número de dias em atraso. | Alta | Todos | Baixa |
| RF-M5-04 | Ação rápida | Permitir marcar etapa como Concluída diretamente na visão de Meu trabalho, sem precisar abrir o painel do OA. | Alta | Todos | Baixa |
| RF-M5-05 | Resumo de carga | Exibir resumo: total de OAs ativos, concluídos esta semana, vencendo em 3 dias, e atrasados. | Média | Todos | Baixa |

### M6 — Relatórios e dashboards

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M6-01 | Dashboard geral | Painel com KPIs globais: total de cursos ativos, OAs por status (concluídos / em andamento / atrasados / bloqueados), e atividade recente. | Alta | Coordenador | Média |
| RF-M6-02 | Progresso por unidade | Gráfico de barras com % de OAs concluídos por unidade de cada curso, filtrável por curso. | Alta | Coordenador | Média |
| RF-M6-03 | Status por etapa do pipeline | Gráfico de pizza ou tabela mostrando quantos OAs estão em cada etapa do pipeline, por curso ou unidade. | Alta | Coordenador | Média |
| RF-M6-04 | Atrasos por responsável | Tabela ranqueando responsáveis por número de OAs atrasados, com nome da etapa e número de dias de atraso. | Alta | Coordenador | Baixa |
| RF-M6-05 | Burndown de OAs | Gráfico de linha comparando OAs planejados para conclusão vs. OAs efetivamente concluídos ao longo do tempo. | Média | Coordenador | Média |
| RF-M6-06 | Deadline previsto vs. real | Para unidades com dados de entrega real, exibir desvio médio entre deadline previsto e real por etapa e por responsável. | Média | Coordenador | Média |
| RF-M6-07 | Carga horária por responsável | Tabela de horas de OAs ativos por responsável (baseado na CH dos OAs atribuídos), para gestão de capacidade. | Baixa | Coordenador | Média |
| RF-M6-08 | Exportação de relatórios | Exportar qualquer relatório em formato .xlsx ou .pdf, com data de geração e filtros aplicados. | Média | Coordenador | Média |

### M7 — Notificações e alertas

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M7-01 | Alerta de deadline vencido | Enviar notificação in-app e por e-mail ao responsável quando um deadline de etapa passar sem o status Concluído. | Alta | Sistema | Baixa |
| RF-M7-02 | Alerta de etapa liberada | Notificar o responsável da próxima etapa quando a etapa anterior for marcada como Concluída. | Alta | Sistema | Baixa |
| RF-M7-03 | Alerta de prazo próximo | Notificar responsável 3 dias antes do vencimento de uma etapa (configurável pelo coordenador). | Alta | Sistema | Baixa |
| RF-M7-04 | Menção em comentário | Notificar in-app e por e-mail o usuário mencionado com @nome em qualquer comentário. | Alta | Sistema | Baixa |
| RF-M7-05 | Central de notificações | Exibir todas as notificações em um painel centralizado com: lidas / não lidas, filtro por tipo, e link direto para o OA ou etapa relacionados. | Alta | Todos | Média |
| RF-M7-06 | Digest diário | Enviar e-mail diário resumindo pendências do usuário: OAs atrasados, etapas vencendo hoje e menções não respondidas. Configurável por usuário. | Média | Todos | Média |
| RF-M7-07 | Webhook / integração | Emitir eventos via webhook para integrações externas (ex: Slack) quando OAs forem concluídos ou atrasados. | Baixa | Coordenador | Alta |

### M8 — Gestão de usuários e permissões

| ID | Requisito | Descrição | Prioridade | Atores | Complexidade |
|---|---|---|---|---|---|
| RF-M8-01 | Cadastro de usuários | Criar, editar e desativar usuários com: nome, e-mail, papel padrão, avatar e cursos associados. | Alta | Coordenador | Baixa |
| RF-M8-02 | Papéis e permissões | Definir permissões por papel: Administrador (acesso total), Colaborador (acesso ao que foi atribuído), Leitor (visualização sem edição). | Alta | Coordenador | Média |
| RF-M8-03 | Atribuição por curso | Associar usuários a cursos específicos, restringindo o acesso a OAs de outros cursos para colaboradores. | Alta | Coordenador | Média |
| RF-M8-04 | Autenticação | Login com e-mail e senha com suporte a SSO (Google Workspace / Microsoft 365) e recuperação de senha por e-mail. | Alta | Sistema | Média |
| RF-M8-05 | Perfil do usuário | Cada usuário pode editar seu nome, foto, e-mail de contato e preferências de notificação. | Média | Todos | Baixa |
| RF-M8-06 | Log de auditoria | Registrar todas as ações críticas (criação, edição, exclusão, mudança de status) com usuário, data e IP. | Média | Coordenador | Média |

---

## 4. Requisitos não funcionais

> Os critérios de aceitação definidos abaixo são verificáveis e devem ser validados antes de cada release.

### 4.1 Desempenho

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-P01 | Desempenho | Tempo de carregamento | Carregar a Matriz de Conteúdo (até 200 OAs) em menos de 2 segundos em conexão de 10 Mbps, com First Contentful Paint < 1,2s. | Alta | Benchmark |
| RNF-P02 | Desempenho | Atualização em tempo real | Status atualizados por outro usuário devem refletir na tela em menos de 3 segundos, sem reload da página (WebSocket ou SSE). | Alta | Benchmark |
| RNF-P03 | Desempenho | Escalabilidade de dados | O sistema deve operar sem degradação com até 50 cursos ativos, 500 unidades e 10.000 OAs simultâneos. | Alta | Teste de carga |
| RNF-P04 | Desempenho | Concorrência | Suportar 100 usuários simultâneos sem degradação de resposta. | Média | Teste de carga |

### 4.2 Usabilidade

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-U01 | Usabilidade | Design responsivo | Interface funcional em resoluções de 1280px a 2560px, com layout adaptado para tablets (mínimo 768px) no modo visualização. | Alta | Inspeção |
| RNF-U02 | Usabilidade | Acessibilidade WCAG 2.1 AA | Todos os componentes devem atender ao nível AA da WCAG 2.1: contraste mínimo 4.5:1, navegação por teclado, compatibilidade com leitores de tela. | Alta | Auditoria aXe |
| RNF-U03 | Usabilidade | Curva de aprendizado | Um novo colaborador deve conseguir atualizar o status de um OA em até 3 cliques, sem treinamento prévio, validado por teste com 5 usuários. | Alta | Teste usuário |
| RNF-U04 | Usabilidade | Feedback de ações | Toda ação que modifica dados deve exibir confirmação visual em até 400ms (toast / spinner) e desfazer (Ctrl+Z) para exclusões. | Média | Inspeção |
| RNF-U05 | Usabilidade | Idioma | Interface inteiramente em português brasileiro (pt-BR), incluindo mensagens de erro, tooltips e e-mails. | Alta | Inspeção |

### 4.3 Confiabilidade e disponibilidade

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-C01 | Confiabilidade | Disponibilidade | SLA de 99,5% de uptime mensal — no máximo 3h40min de indisponibilidade por mês. | Alta | Monitoramento |
| RNF-C02 | Confiabilidade | Backup de dados | Backup automático diário com retenção mínima de 30 dias e recuperação em até 4 horas (RTO). | Alta | Proc. operacional |
| RNF-C03 | Confiabilidade | Tolerância a falhas | Falha em envio de notificação não deve interromper o fluxo principal; filas com backoff exponencial. | Média | Teste de falha |
| RNF-C04 | Confiabilidade | Consistência de dados | Operações de atualização de status devem ser atômicas; em caso de falha, o sistema reverte para o estado anterior. | Alta | Teste de integração |

### 4.4 Segurança

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-S01 | Segurança | Autenticação e sessão | Senhas com bcrypt (custo mínimo 12). Sessões expiram após 8h de inatividade. Suporte obrigatório a MFA por TOTP. | Alta | Revisão de código |
| RNF-S02 | Segurança | Autorização por papel | Nenhuma rota da API acessível sem token válido. Colaboradores não visualizam OAs de cursos não atribuídos. | Alta | Pen test |
| RNF-S03 | Segurança | Proteção contra ataques | Proteção contra XSS, CSRF, SQL injection e clickjacking validada por OWASP ZAP antes do lançamento. | Alta | Pen test |
| RNF-S04 | Segurança | Comunicação cifrada | Todo tráfego via HTTPS/TLS 1.3. Certificados renovados automaticamente. | Alta | Inspeção |
| RNF-S05 | Segurança | LGPD / privacidade | Dados pessoais exportáveis e excluíveis mediante solicitação em até 72 horas, conforme LGPD. | Alta | Proc. operacional |

### 4.5 Manutenibilidade e arquitetura

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-M01 | Manutenibilidade | Cobertura de testes | Cobertura mínima de 80% (unitários + integração) para módulos críticos: pipeline, CH, código de OA, notificações. | Alta | CI/CD |
| RNF-M02 | Manutenibilidade | Separação frontend/backend | API REST ou GraphQL documentada (OpenAPI 3.0) com SPA independente — evolução desacoplada das camadas. | Alta | Revisão arquitet. |
| RNF-M03 | Manutenibilidade | Pipeline configurável | Pipeline por tipo de OA configurável via interface administrativa, sem necessidade de deploy. | Alta | Teste funcional |
| RNF-M04 | Manutenibilidade | Logs de aplicação | Logs estruturados (JSON) com request ID, retidos por 90 dias, integráveis a ferramentas de observabilidade. | Média | Inspeção |
| RNF-M05 | Manutenibilidade | Documentação técnica | README, documentação da API (Swagger/Redoc), diagrama de arquitetura e runbooks mantidos no repositório. | Média | Revisão doc. |

### 4.6 Portabilidade e interoperabilidade

| ID | Categoria | Requisito | Critério de aceitação | Prioridade | Origem |
|---|---|---|---|---|---|
| RNF-I01 | Interoperabilidade | Suporte a navegadores | Compatibilidade com as duas últimas versões estáveis de Chrome, Firefox, Safari e Edge. Sem plugins adicionais. | Alta | Teste cross-browser |
| RNF-I02 | Interoperabilidade | Importação Excel | Importar .xlsx no formato exato das planilhas de MI e MC, com relatório de inconsistências. | Alta | Teste funcional |
| RNF-I03 | Interoperabilidade | Exportação Excel | Exportar MI e MC em .xlsx idêntico ao padrão atual, com UTF-8 e separador ponto-e-vírgula. | Alta | Teste funcional |
| RNF-I04 | Interoperabilidade | API aberta | API REST documentada para futuras integrações com LMS (Moodle, Canvas) e plataformas de vídeo. | Média | Inspeção |
| RNF-I05 | Interoperabilidade | Webhook configurável | Webhooks configuráveis para eventos-chave (OA concluído, atrasado, validação aprovada) via painel admin. | Baixa | Teste funcional |

---

## 5. Restrições e premissas

### 5.1 Restrições tecnológicas

- O sistema deve ser acessível exclusivamente via navegador web (sem app mobile nativo no v1.0).
- A infraestrutura deve estar em conformidade com a LGPD, preferencialmente em data centers no Brasil (AWS São Paulo, Azure Brazil South ou equivalente).
- O banco de dados deve suportar operações transacionais ACID — PostgreSQL é o recomendado.
- O frontend deve ser desenvolvido como SPA com framework moderno (React, Vue ou Svelte).

### 5.2 Restrições operacionais

- A migração das planilhas existentes deve ser feita via importação, sem digitação manual, para não introduzir erros.
- O sistema deve coexistir com as planilhas durante o período de transição (mínimo 90 dias), exportando os dados no formato original sempre que solicitado.
- Não há equipe dedicada de TI para operação; a solução deve ser mantida por um time de desenvolvimento com suporte a DevOps mínimo.

### 5.3 Premissas

- Todos os membros da equipe possuem acesso à internet estável e utilizam computadores com navegadores modernos.
- A estrutura de cursos, unidades e capítulos existente nas planilhas é a referência canônica para a migração inicial.
- O modelo de pipeline (7 etapas) é estável o suficiente para ser implementado como padrão configurável, sem variações por curso.
- O e-mail corporativo dos usuários já existe e será utilizado como identificador único no sistema.

### 5.4 Dependências externas

- **E-mail transacional:** SendGrid, Amazon SES ou equivalente para notificações.
- **Armazenamento de arquivos:** AWS S3, Google Cloud Storage ou equivalente — apenas metadados são armazenados no sistema; arquivos permanecem no storage externo.
- **SSO:** Google Workspace ou Microsoft 365 para autenticação federada — opcional, mas recomendado.

---

## 6. Critérios de aceite do MVP

O MVP é considerado pronto quando todos os itens abaixo forem validados em ambiente de homologação com dados reais do curso Microeletrônica Geral:

| # | Critério de aceite | Módulo | Status |
|---|---|---|---|
| 1 | Importar com sucesso as 7 planilhas de MI e MC do curso Microeletrônica, sem perda de dados. | M1 — Importação | Pendente |
| 2 | Exibir a MI de qualquer unidade com CH calculada automaticamente, igual à planilha original. | M2 — MI | Pendente |
| 3 | Exibir a MC da Unidade 1 com todos os 30 OAs, status de cada etapa e links dos objetos finais. | M3 — MC | Pendente |
| 4 | Atualizar status de uma etapa e ver a mudança refletida na tabela em menos de 3 segundos. | M3 — Inline edit | Pendente |
| 5 | Abrir o painel do OA `U2C1O1V1` e visualizar o pipeline completo com todos os 7 responsáveis e status. | M4 — Painel OA | Pendente |
| 6 | Fazer login como conteudista João Fonseca e ver somente seus OAs pendentes em Meu trabalho. | M5 + M8 | Pendente |
| 7 | Receber notificação in-app e e-mail ao marcar deadline de etapa como vencido. | M7 — Notificações | Pendente |
| 8 | Exportar MC da Unidade 2 em .xlsx e verificar compatibilidade com o formato original. | M1 — Exportação | Pendente |
| 9 | Dashboard exibir % de conclusão correto para todas as 7 unidades do curso Microeletrônica. | M6 — Dashboard | Pendente |
| 10 | Passar auditoria WCAG 2.1 AA com zero erros críticos (ferramenta aXe) nas telas principais. | RNF-U02 | Pendente |

---

## 7. Glossário técnico

| Termo | Definição |
|---|---|
| **MVP** | Minimum Viable Product — versão mínima viável do sistema com funcionalidades essenciais para validar o produto com usuários reais. |
| **SPA** | Single Page Application — aplicação web onde o carregamento inicial traz o app completo e as navegações são feitas sem recarregar a página. |
| **SLA** | Service Level Agreement — acordo de nível de serviço que define métricas mínimas de disponibilidade e desempenho. |
| **SSE** | Server-Sent Events — mecanismo de comunicação unidirecional servidor → cliente usado para atualizações em tempo real. |
| **WCAG 2.1** | Web Content Accessibility Guidelines — diretrizes internacionais de acessibilidade para conteúdo web, em três níveis: A, AA e AAA. |
| **LGPD** | Lei Geral de Proteção de Dados Pessoais — Lei 13.709/2018, que regula o tratamento de dados pessoais no Brasil. |
| **RTO** | Recovery Time Objective — tempo máximo tolerável para recuperação do sistema após uma falha. |
| **Webhook** | Mecanismo de integração que envia automaticamente dados para uma URL externa quando um evento ocorre no sistema. |
| **ACID** | Atomicity, Consistency, Isolation, Durability — propriedades que garantem a confiabilidade de transações em bancos de dados relacionais. |
| **OpenAPI** | Especificação aberta para descrição de APIs REST, usada para geração automática de documentação (Swagger/Redoc). |

---

*Fim do documento — RedeFLOW v1.0 · iRede · Março 2026*
