export default class Plugin {
    constructor () {
        this.id = 0
        this.name = 'Document field list'
        this.icon = 'mdi-power-plug'
        this.pluginConfig = {
            fieldsToShow: 4
        }
    }
}
