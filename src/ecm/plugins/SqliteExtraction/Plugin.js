export default {
    name: 'Extraction PDF → SQLite',
    icon: 'file-import',
    pluginConfig: {
      name: 'Extraction vers SQLite',
      contentType: 'SqliteFile v1.0',
      acceptMime: ['application/pdf'],
      defaultColumns: ['Fecha', 'Descripción', 'Importe']
    }
  }
  