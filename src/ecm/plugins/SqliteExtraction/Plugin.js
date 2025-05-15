export default {
  name: 'conciliation',
  icon: 'file-import',
  pluginConfig: {
    name: 'Conciliation',
    contentType: 'SqliteFile v1.0',
    acceptMime: ['application/pdf'],
    dbTableName : 'ConciliationTable',
    defaultColumns: ['Fecha', 'Comprobante', 'Importe'],
    facturaContentTypeId : 8729,
    mistralApiKey : 'mx58mABSnLF3RkKjE7PRf3h1QnrKqsFi',
    formatdecimals :',',
    formatmilliers : '.',
    deletemilliers : false,
    auth: {
    baseUrl : 'https://apidemo.doc-ecm.cloud',
    tokenUrl : "/token",
    username : "admin.empresa",
    password : "admin.empresa"
  }

  }
}
