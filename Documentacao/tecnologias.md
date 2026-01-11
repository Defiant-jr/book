# Tecnologias utilizadas

Este documento descreve as tecnologias identificadas no repositório, separadas por área.

## Frontend
- React 18 (`react`, `react-dom`)
- Roteamento: React Router (`react-router-dom`)
- Metadados/head: React Helmet (`react-helmet`)
- UI/Componentes: Radix UI (`@radix-ui/*`)
- Ícones: Lucide (`lucide-react`)
- Animações: Framer Motion (`framer-motion`)
- Gráficos: Recharts (`recharts`)
- Calendário: React Day Picker (`react-day-picker`)
- Utilidades: clsx, class-variance-authority, tailwind-merge

## Estilos e layout
- Tailwind CSS (`tailwindcss`)
- PostCSS (`postcss`)
- Autoprefixer (`autoprefixer`)
- Animações Tailwind: tailwindcss-animate

## Backend e runtime
- Node.js (ESM)
- Express (`express`)
- Static files: serve-static
- Compressão: compression
- Banco de dados: PostgreSQL (`pg`)
- Configuração de ambiente: dotenv

## Build e tooling
- Vite (`vite`) + @vitejs/plugin-react
- ESLint (`eslint`, `eslint-config-react-app`)
- Minificação: Terser (`terser`)
- Ferramentas de AST (scripts internos): @babel/parser, @babel/traverse, @babel/generator, @babel/types

## Integrações e serviços
- Supabase (cliente JS) (`@supabase/supabase-js`)
- Supabase Functions em Deno (`supabase/functions/*`)
- Google Sheets API via HTTP/fetch (usado no backend)

## Relatórios e exportação
- jsPDF (`jspdf`)
- Tabelas PDF: jspdf-autotable
- Captura de tela: html2canvas

## Utilidades gerais
- date-fns
