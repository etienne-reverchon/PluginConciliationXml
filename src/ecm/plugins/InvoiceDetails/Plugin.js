export default class Plugin {
    constructor() {
        this.id = 0
        this.name = 'Invoice Details'
        this.icon = 'mdi-power-plug'
        this.pluginConfig = {
            dbTableName: "InvoiceDetails"
        }
    }
}
