export default class Plugin {
    constructor() {
        this.id = 0
        this.name = 'Export payment order'
        this.icon = 'mdi-power-plug'
        this.pluginConfig = {
            "paymentOrderNumberFieldCode": "PO_CaseNr",
            "paymentOrderDateFieldCode": "PO_Date",
            "paymentOrderDebitorAccountNumberFieldCode": "PO_AccountNr",
            "paymentOrderDebitorNameFieldCode": "PO_Client",
            "paymentOrderTotalAmountFieldCode": "PO_Amount",
            "paymentOrderCurrencyFieldCode": "PO_Currency",
            "paymentOrderPaymentDateFieldCode": "PO_PaymentDate",
            "paymentOrderCreditorNameFieldCode": "PO_Beneficiary",
            "paymentOrderCreditorAddressFieldCode": "PO_BeneficiaryAd",
            "paymentOrderCreditorBankAccountFieldCode": "PO_BeneficiaryIBAN",
            "paymentOrderCreditorSWIFTFieldCode": "PO_BeneficiarySWIFT",
            "paymentOrderIntermediarySWIFTFieldCode": "PO_IntermediarySWIFT",
            "paymentOrderReferenceFieldCode": "%URL%"
        }
    }
}
