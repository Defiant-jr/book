# Calculadora de Custos por Turma

## Objetivo
Este modulo calcula receita e custos por turma de curso de idiomas, permitindo rateio de despesas fixas por turma ou por aluno.

## Entradas
- alunos_turma: quantidade de alunos na turma (inteiro > 0)
- num_turmas: quantidade de turmas no mes (inteiro > 0)
- preco_aluno: mensalidade paga por aluno (>= 0)
- despesas_fixas_mensais: valor total de despesas fixas no mes (>= 0)
- horas_aula_turma_mes: horas/aula da turma no mes (> 0)
- valor_hora_instrutor: valor hora/aula do instrutor (>= 0)
- fator_encargos: opcional, multiplica a hora nominal para hora real (>= 0, default = 1)
- modo_rateio: "por_turma" ou "por_aluno"
- total_alunos_mes: total de alunos no mes (obrigatorio se modo_rateio = "por_aluno")

## Formulas
- receita_turma = alunos_turma * preco_aluno
- receita_total = receita_turma * num_turmas
- hora_real = valor_hora_instrutor * fator_encargos
- custo_instrutor_turma = horas_aula_turma_mes * hora_real
- fixo_por_turma:
  - modo "por_turma": despesas_fixas_mensais / num_turmas
  - modo "por_aluno": (despesas_fixas_mensais / total_alunos_mes) * alunos_turma
- custo_total_turma = custo_instrutor_turma + fixo_por_turma
- custo_por_aluno = custo_total_turma / alunos_turma
- lucro_turma = receita_turma - custo_total_turma
- margem = lucro_turma / receita_turma (se receita_turma > 0)

## Saidas
- receita_turma
- receita_total
- custo_instrutor_turma
- fixo_por_turma
- custo_total_turma
- custo_por_aluno
- lucro_turma
- margem

## Exemplo rapido
Entrada:
- alunos_turma = 10
- num_turmas = 4
- preco_aluno = 350
- despesas_fixas_mensais = 12000
- horas_aula_turma_mes = 24
- valor_hora_instrutor = 55
- fator_encargos = 1
- modo_rateio = "por_turma"

Resultados:
- receita_turma = 3.500,00
- receita_total = 14.000,00
- custo_instrutor_turma = 1.320,00
- fixo_por_turma = 3.000,00
- custo_total_turma = 4.320,00
- custo_por_aluno = 432,00
- lucro_turma = -820,00
- margem = -23,43%
