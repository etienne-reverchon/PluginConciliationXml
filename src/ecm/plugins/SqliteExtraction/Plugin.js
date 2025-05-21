export default {
  name: 'ConciliationFromXml',
  icon: 'file-import',
  pluginConfig: {
    name: 'ConciliationFromXml',
    contentType: 'SqliteFile v1.0',
    acceptMime: ['application/pdf', 'text/xml'],
    dbTableName : 'ConciliationTable',
    defaultColumns: ['Fecha', 'Comprobante', 'Importe'],
    facturaContentTypeId : 8729,
    mistralApiKey : 'mx58mABSnLF3RkKjE7PRf3h1QnrKqsFi',
    formatdecimals :',',
    formatmilliers : '.',
    deletemilliers : false,
    auth: {
    baseUrl : 'https://apinetdemo.doc-ecm.cloud',
    tokenUrl : "/token",
    username : "admin.empresa",
    password : "admin.empresa"
    },
    conciliationInfos: {
      columsInternalTable : "Comprobante, Importe",
      columsDocument      : "FC_no_de_la_factura, FC_importe_de_la_factura",
      isCheckedColumn     : "isChecked",
      uncheckedValue      : "false",
      checkedValue        : "true",
      codeValidation      : "FC_pagado",
      codeValidationId    : 21093,
      valueToValidate     : "No",
      valueValidation     : "Si"
    },
    xmlFieldMappings: {
      InvoiceDate      : 'n:RltdDts/n:IntrBkSttlmDt',
      InvoiceId        : 'n:RmtInf/n:Strd/n:AddtlRmtInf',
      InvoiceAmount    : 'n:Amt'
    }

  }
}
