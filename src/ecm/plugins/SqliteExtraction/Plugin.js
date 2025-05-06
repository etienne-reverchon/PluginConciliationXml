export default {
  name: 'conciliation',
  icon: 'file-import',
  pluginConfig: {
    name: 'Conciliation',
    contentType: 'SqliteFile v1.0',
    acceptMime: ['application/pdf'],
    defaultColumns: ['Fecha', 'Concepto', 'Saldo'], 
    mistralApiKey : 'mx58mABSnLF3RkKjE7PRf3h1QnrKqsFi',
    formatdecimals :',',
    formatmilliers : '.',
    deletemilliers : false,

  }
}
