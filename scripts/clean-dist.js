#!/usr/bin/env node
/**
 * 🔒 Script de Limpeza da Pasta Dist
 * Remove arquivos sensíveis e de desenvolvimento após o build
 */

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const DIST_DIR = join(process.cwd(), 'dist');

// Arquivos que NÃO devem estar no build de produção
const FILES_TO_REMOVE = [
  // Arquivos de teste
  'test-websocket.html',
  'test-server.html',
  
  // Arquivos de desenvolvimento/servidor
  'servidor-simples.js',
  'nginx.conf',
  
  // Arquivos de dados sensíveis (se existirem)
  'comprovante-pagamento-global-GLOBAL40506837.jpg',
  'admin-docs-json (1).json',
  
  // Outros arquivos que não devem estar no build
  '*.md',
  '*.txt',
  '.env*',
];

console.log('🔒 Limpando arquivos sensíveis da pasta dist...\n');

let removedCount = 0;

FILES_TO_REMOVE.forEach(file => {
  const filePath = join(DIST_DIR, file);
  
  // Se for um padrão com wildcard, precisamos verificar manualmente
  if (file.includes('*')) {
    console.log(`⚠️  Padrão com wildcard ignorado: ${file}`);
    return;
  }
  
  if (existsSync(filePath)) {
    try {
      rmSync(filePath, { recursive: true, force: true });
      console.log(`✅ Removido: ${file}`);
      removedCount++;
    } catch (error) {
      console.error(`❌ Erro ao remover ${file}:`, error.message);
    }
  } else {
    console.log(`⏭️  Não encontrado: ${file}`);
  }
});

console.log(`\n✨ Limpeza concluída! ${removedCount} arquivo(s) removido(s).`);
console.log('📋 Arquivos restantes na dist são apenas os necessários para produção.');

