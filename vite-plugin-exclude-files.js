/**
 * Plugin do Vite para excluir arquivos .md e .json do build
 */
export function excludeFilesPlugin() {
  return {
    name: 'exclude-files',
    resolveId(id) {
      // Excluir arquivos .md e .json do bundle
      if (id.endsWith('.md') || id.endsWith('.json')) {
        return { id: '\0' + id, external: true };
      }
      return null;
    },
    load(id) {
      // Se for um arquivo .md ou .json, retornar string vazia
      if (id.endsWith('.md') || id.endsWith('.json')) {
        return 'export default {};';
      }
      return null;
    }
  };
}

