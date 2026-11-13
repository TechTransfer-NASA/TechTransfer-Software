# Histórico de Interação com IA

Este documento registra as interações com inteligência artificial durante a investigação da API NASA TechTransfer, o desenvolvimento do script Python de coleta de softwares e a elaboração da documentação técnica do projeto.

---

## Informações gerais

| Campo                  | Valor                         |
| ---------------------- | ----------------------------- |
| **Grupo**              | Grupo 11                      |
| **Integrantes**        | Arthur, Helen e Mateus Rosler |
| **API NASA escolhida** | TechTransfer / Software       |
| **IA utilizada**       | Claude (Anthropic)            |
| **Data de início**     | 03/08/2026                    |
| **Data de conclusão**  | 13/11/2026                    |

---

## Interação 1 — Análise inicial da API e estruturação do banco

**Data:** 28/08/2026

**Objetivo:** Entender o formato de resposta da API e definir como armazenar os dados no Supabase.

**Prompt enviado à IA:**

```text
considere a seguinte API da NASA:

https://technology.nasa.gov/api/api/patent/rocket
https://technology.nasa.gov/api/api/software/visualization
https://technology.nasa.gov/api/api/spinoff/polymers

a API retorna arrays posicionais, com vários campos vazios, dificultando a identificação das informações, a ideia é utilizar o Supabase para armazenar os dados e criar um workflow no GitHub para atualizar essas informações diariamente ou semanalmente

obs: não quero códigos, apenas orientações sobre como estruturar o banco e organizar os dados para disponibilizá-los em um site :)
```

**Resumo da resposta:**

A IA sugeriu armazenar os dados originais em `jsonb`, criar campos organizados para consultas e utilizar upsert para evitar registros duplicados.

**O que funcionou:**

- Preservação dos dados originais.
- Sugestão de uma chave única.
- Orientações sobre a estrutura do banco.

**O que precisou de ajuste:**

O mapeamento dos campos era apenas uma hipótese e precisou ser confirmado com respostas reais da API.

---

## Interação 2 — Análise de amostras reais da API

**Data:** 28/08/2026

**Objetivo:** Identificar o significado das posições dos arrays utilizando respostas reais dos três endpoints.

**Prompt enviado à IA:**

```text
Considere essas 3 respostas:

A primeira: rocket
A segunda: visualization
A terceira: polymers

[Anexos: três respostas JSON da API]
```

**Resumo da resposta:**

A IA identificou que os registros possuíam 13 posições e apresentou um mapeamento inicial dos campos.

Também apontou alguns problemas nos dados:

- Descrições com HTML.
- Entidades HTML.
- Variações nos nomes dos centros da NASA.
- Campos vazios.
- Diferenças entre categorias.

**O que funcionou:**

O mapeamento serviu como referência para o desenvolvimento do script e foi posteriormente confirmado com milhares de registros.

**O que precisou de ajuste:**

Algumas posições foram interpretadas incorretamente e precisaram ser corrigidas com testes reais.

---

## Interação 3 — Desenvolvimento do script Python de coleta

**Data:** 11/09/2026

**Objetivo:** Desenvolver o script Python para consultar a API NASA TechTransfer, tratar os dados e armazenar os softwares no Supabase.

**Prompt enviado à IA (versão representativa):**

```text
nosso grupo é o Grupo 11 e vamos utilizar exclusivamente o endpoint de Software da API NASA TechTransfer, já testei o acesso utilizando uma chave gerada no site da NASA e confirmei que o endpoint está funcionando
precisamos desenvolver um script Python para coletar os softwares e enviá-los ao Supabase
o script deve interpretar os arrays de 13 posições, tratar descrições com HTML, evitar registros duplicados, enviar os dados em lotes e registrar as execuções
ajude a desenvolver essa lógica
```

**Resumo da resposta:**

A IA auxiliou na criação do script, incluindo:

- Consulta à API da NASA.
- Organização dos 13 campos.
- Limpeza de HTML.
- Deduplicação dos registros.
- Envio dos dados ao Supabase em lotes.
- Registro das execuções.
- Tratamento de erros.

**O que funcionou:**

A IA ajudou a organizar o código e acelerar o desenvolvimento. O grupo executou o script localmente e verificou a coleta e o armazenamento dos dados nos serviços reais.

**O que precisou de ajuste:**

Os testes simulados não substituíram os testes reais. Também houve uma inconsistência na quantidade de termos de busca: a IA informou 34, mas o correto era 32.

---

## Interação 4 — Elaboração da documentação técnica

**Data:** 11/11/2026

**Objetivo:** Criar a documentação do projeto, considerando o funcionamento atual do script Python e a estrutura do repositório.

**Prompt enviado à IA (versão representativa):**

```text
precisamos elaborar a documentação do projeto

Grupo 11:
Arthur, Helen e Mateus Rosler

Organização:
https://github.com/TechTransfer-NASA

Repositório:
https://github.com/TechTransfer-NASA/TechTransfer-Software

Utilize o repositório e os arquivos do projeto como referência.

Precisamos criar:
1. README.md
2. docs/ai-interaction.md
3. docs/tutorial.pdf
```

**Resumo da resposta:**

A IA auxiliou na organização e elaboração dos documentos:

- `README.md`: apresentação e instruções do projeto.
- `docs/ai-interaction.md`: histórico das interações com IA.
- `docs/tutorial.pdf`: tutorial de configuração e execução.

**O que funcionou:**

A IA ajudou a organizar as informações técnicas e estruturar os documentos de maneira mais clara.

**O que precisou de ajuste:**

O grupo precisou revisar os documentos para corrigir comandos, caminhos e informações que não correspondiam à implementação final.

---

## Resumo final

**Total de interações documentadas:** 4.

**Principais contribuições da IA:**

- Análise da API NASA TechTransfer.
- Identificação dos 13 campos dos registros.
- Orientação sobre o tratamento dos dados.
- Desenvolvimento do script Python de coleta.
- Integração com o Supabase.
- Elaboração da documentação técnica.

**Principais limitações encontradas:**

- Interpretações incorretas de alguns campos.
- Informações que precisaram ser confirmadas com testes reais.
- Inconsistências em detalhes técnicos.
- Necessidade de revisar os documentos gerados.

**Avaliação geral do uso da IA:**

A IA foi uma ferramenta importante durante o desenvolvimento do projeto, auxiliando na análise da API, na criação do script Python e na elaboração da documentação.
Suas respostas ajudaram a acelerar o trabalho e a encontrar soluções para diferentes dificuldades. Entretanto, nem todas as informações estavam corretas, sendo
necessário revisar o código, corrigir algumas respostas e realizar testes reais. De modo geral, sua utilização foi positiva, principalmente como apoio ao
desenvolvimento, mas o grupo precisou manter a análise crítica e validar as soluções antes de aplicá-las ao projeto.
