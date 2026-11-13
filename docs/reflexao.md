# Reflexão sobre o uso de IA

**Grupo 11:** Arthur, Helen e Mateus Rosler  
**IA utilizada:** Claude (Anthropic)  
**Projeto:** Pipeline NASA TechTransfer / Software (Python, GitHub Actions, Supabase e GitHub Pages)

## 1. Como usamos a IA

Utilizamos a IA como apoio durante o desenvolvimento do projeto, principalmente para investigar a API NASA TechTransfer, compreender o formato dos dados, estruturar o banco de dados e desenvolver o script Python de coleta. Também utilizamos a ferramenta para revisar soluções, analisar possíveis erros e organizar a documentação técnica.

A IA trabalhou principalmente com os códigos, arquivos, respostas da API e informações fornecidas durante as conversas. Os testes com os serviços reais da NASA e do Supabase, assim como a execução do workflow, foram realizados pelo próprio grupo.

## 2. Onde a IA ajudou

- **Investigação da API:** ajudou a interpretar os arrays de 13 posições retornados pela NASA e identificar problemas nos dados, como campos vazios, HTML e entidades HTML.
- **Estruturação do banco:** auxiliou na definição da organização dos dados no Supabase, incluindo a utilização de identificadores únicos e operações de upsert.
- **Desenvolvimento do script:** contribuiu para organizar a coleta, o tratamento dos registros, a deduplicação, o envio em lotes e o registro das execuções.
- **Identificação de problemas:** ajudou a analisar erros e sugerir soluções durante o desenvolvimento.
- **Documentação:** auxiliou na organização do README, do histórico de interações, da reflexão e do tutorial do projeto.

A principal contribuição foi acelerar a resolução de dúvidas e facilitar a organização das etapas técnicas, reduzindo o tempo necessário para pesquisar soluções e estruturar o código.

## 3. Onde a IA errou

Durante o desenvolvimento, algumas respostas da IA apresentaram informações incorretas ou interpretações que precisaram ser verificadas.

| O que a IA afirmou | O que foi identificado | Como foi corrigido |
|---|---|---|
| Algumas posições dos arrays tinham determinado significado. | Parte do mapeamento inicial estava incorreta. | Conferimos as posições utilizando respostas reais da API. |
| A API não possuía limite relevante de resultados. | Foram identificadas respostas limitadas a 1000 registros em algumas consultas exploratórias. | Passamos a considerar a quantidade total informada pela API e possíveis resultados incompletos. |
| A quantidade de termos de busca era 34. | O script utilizava 32 termos. | Corrigimos a informação na documentação. |
| Algumas interpretações sobre a quantidade de registros estavam completas. | Novas buscas encontraram registros que não haviam aparecido nas consultas anteriores. | Revisamos os critérios de busca e conferimos os resultados. |
| Algumas informações técnicas estavam corretas sem necessidade de testes adicionais. | Parte das sugestões não correspondia ao comportamento real dos serviços. | Executamos testes e corrigimos as implementações. |

Esses problemas demonstraram que a IA pode apresentar hipóteses incorretas com bastante confiança. Por isso, foi necessário conferir as respostas antes de utilizá-las no projeto.

## 4. O que o grupo decidiu e corrigiu

- **Validação dos dados:** analisamos respostas reais da API antes de definir o tratamento definitivo dos registros.
- **Definição do escopo:** inicialmente investigamos os três endpoints apresentados pela NASA, mas definimos que o projeto trabalharia exclusivamente com Software.
- **Organização do código:** ajustamos os arquivos e nomes utilizados no projeto, incluindo o script `fetch_softwares.py`.
- **Testes reais:** executamos o coletor, verificamos o armazenamento no Supabase e testamos o workflow no GitHub Actions.
- **Painel:** o desenvolvimento do painel foi realizado pelo grupo, sem depender da geração de sua implementação pela IA.
- **Documentação:** revisamos os textos e instruções gerados para garantir que correspondessem ao projeto desenvolvido.

## 5. O que aprendemos

- Uma API pouco documentada precisa ser investigada com dados reais, e não apenas por suposições.
- É importante compreender a estrutura dos dados antes de desenvolver o processo de armazenamento.
- A deduplicação é necessária para evitar problemas quando um mesmo registro aparece em diferentes consultas.
- Os testes simulados ajudam a identificar possíveis problemas, mas não substituem os testes com os serviços reais.
- A IA pode acelerar o desenvolvimento, mas suas respostas precisam ser analisadas e verificadas.
- A documentação deve representar a implementação final, e não apenas as funcionalidades planejadas.

## 6. Avaliação crítica

Consideramos que a IA foi mais útil do que arriscada durante o desenvolvimento, desde que utilizada com revisão e validação. Ela ajudou a compreender partes da API, organizar o código e resolver dúvidas que poderiam consumir bastante tempo do grupo.

Entretanto, algumas respostas estavam incorretas e poderiam ter causado problemas caso fossem utilizadas sem conferência. A experiência mostrou que não é adequado aceitar automaticamente tudo o que uma IA apresenta, principalmente em questões técnicas que dependem do comportamento real de uma API ou banco de dados.

Se realizássemos o projeto novamente, daríamos ainda mais atenção à análise do enunciado e à investigação da API antes de iniciar a implementação. Também manteríamos os testes reais durante todas as etapas.
