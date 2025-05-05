<template>
  <div>
    <div class="text-center ma-10" v-if="loading">
      <PulseLoader :loading="loading" color="#00cae3" />
    </div>
    <div v-else>
      <div class="row">
        <div class="col col-1"></div>
        <div class="col col-3">Country of Origin</div>
        <div class="col col-3">Country of Destination</div>
        <div class="col col-3">Product Description</div>
        <div class="col col-1">Total Price</div>
        <div class="col col-1"></div>
      </div>
      <div
        class="row align-center justify-center"
        v-for="invoiceDetail in invoiceDetailItems"
        :key="invoiceDetail.id"
      >
        <div class="col col-1 text-right">
          <button
            type="button"
            class="
              pa-4
              text-capitalize
              font-weight-regular
              v-btn v-btn--contained
              theme--light
              v-size--small
              error
            "
            @click="removeInvoiceDetail(invoiceDetail.id)"
          >
            <span class="v-btn__content">Remove</span>
          </button>
        </div>
        <div class="col col-3">
          <VueSelect
            label="NAME"
            :options="originCountries"
            v-model="invoiceDetail.countryOfOrigin"
            :reduce="country => country.NAME"
            @input="(country) => getDestinationCountries(invoiceDetail, country)"
          ></VueSelect>
        </div>
        <div class="col col-3">
          <VueSelect
            label="NAME"
            :key="`${invoiceDetail.id}-${invoiceDetail.countryOfOrigin}`"
            :options="invoiceDetail.destinationCountries"
            :reduce="country => country.NAME"
            v-model="invoiceDetail.countryOfDestination"
          ></VueSelect>
        </div>
        <div class="col col-3">
          <div
            class="v-input theme--light v-text-field v-text-field--is-booted"
          >
            <div class="v-input__control">
              <div class="v-input__slot">
                <div class="v-text-field__slot">
                  <input
                    v-model="invoiceDetail.productDescription"
                    type="text"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col col-1">
          <div
            class="v-input theme--light v-text-field v-text-field--is-booted"
          >
            <div class="v-input__control">
              <div class="v-input__slot">
                <div class="v-text-field__slot">
                  <input v-model="invoiceDetail.price" type="number" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col col-1">
          <button
            type="button"
            class="
              pa-4
              text-capitalize
              font-weight-regular
              v-btn v-btn--contained
              theme--light
              v-size--small
              success
            "
            @click="addInvoiceDetail()"
          >
            <span class="v-btn__content">Add</span>
          </button>
        </div>
      </div>
      <div>{{ localizedResources.invoiceTotal }}: {{ invoiceTotal }}</div>
      <div class="v-card__actions pt-0 pb-3 mt-3">
        <div class="spacer"></div>
        <button
          @click="close()"
          type="button"
          class="
            pa-4
            text-capitalize
            font-weight-regular
            v-btn v-btn--contained
            theme--light
            v-size--small
          "
        >
          <span class="v-btn__content">{{
            localizedResources.close
          }}</span></button
        ><button
          @click="save()"
          type="button"
          class="
            pa-4
            text-capitalize
            font-weight-regular
            v-btn v-btn--contained
            theme--light
            v-size--small
            primary
          "
        >
          <span class="v-btn__content">{{ localizedResources.save }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
<script>
import VueSelect from "vue-select";
import { PulseLoader } from "@saeris/vue-spinners";
import "vue-select/dist/vue-select.css";

class InvoiceDetail {
  constructor(objectID, dto) {
    this.id =
      Math.random().toString(36).substring(2) +
      new Date().getTime().toString(36);
    this.objectID = objectID;
    this.countryOfOrigin = "";
    this.countryOfDestination = "";
    this.productDescription = "";
    this.price = 0;

    if (dto) {
      this.id = dto.Id;
      this.objectID = dto.Cells.find((c) => c.ColumnName == "ObjectID").Value;
      this.countryOfOrigin = dto.Cells.find(
        (c) => c.ColumnName == "CountryOfOrigin"
      ).Value;
      this.countryOfDestination = dto.Cells.find(
        (c) => c.ColumnName == "CountryOfDestination"
      ).Value;
      this.productDescription = dto.Cells.find(
        (c) => c.ColumnName == "ProductDescription"
      ).Value;
      this.price = dto.Cells.find((c) => c.ColumnName == "Price").Value;
    }
  }
  toDto() {
    return {
      Id: isNaN(this.id) ? 0 : this.id,
      Cells: [
        {
          ColumnName: "ObjectID",
          Value: this.objectID,
        },
        {
          ColumnName: "CountryOfOrigin",
          Value: this.countryOfOrigin || "",
        },
        {
          ColumnName: "CountryOfDestination",
          Value: this.countryOfDestination || "",
        },
        {
          ColumnName: "ProductDescription",
          Value: this.productDescription,
        },
        {
          ColumnName: "Price",
          Value: this.price,
        },
      ],
    };
  }
}

export default {
  name: "InvoiceDetailsPlugin",
  components: {
    VueSelect,
    PulseLoader,
  },
  props: {
    documentList: {
      type: Array,
      default: () => [],
    },
    pluginID: {
      type: Number,
      required: true,
    },
    pluginConfig: {
      type: Object,
      default: () => {},
    },
  },
  async created() {
    if (!this.pluginConfig || !this.pluginConfig.dbTableName) {
      window.getApp.$emit(
        "APP_ERROR",
        this.localizedResources.configurationMissing
      );
      this.close();
    } else {
      this.loading = true;
      await this.getOriginCountries();
      await this.getInvoiceDetails();
      this.loading = false;
    }
  },
  data() {
    return {
      loading: false,
      disableControls: false,
      invoiceDetailItems: [],
      originalInvoiceDetailItems: [],
      originCountries: [],
      pluginVersionData: {
        version: "1.4",
        dateLastModified: "19.08.2021",
      },
      apiUrl: this.$store.getters["account/apiUrl"],
      apiToken: this.$store.getters["account/token"],
    };
  },
  computed: {
    objectID() {
      return this.documentList[0].ObjectID;
    },
    documentFields() {
      return this.documentList[0].Fields;
    },
    currentUser() {
      var user = this.$store.getters["account/user"];
      return `${user.Name} ${user.Surname}`;
    },
    localizedResources() {
      var currentCulture = this.$store.getters["account/user"].CultureCode;
      switch (currentCulture) {
        case "de":
          return {
            invoiceTotal: "Rechnungsbetrag",
            save: "Speichern",
            close: "Stornieren",
            configurationMissing:
              "Plugin-Konfiguration fehlt oder ist unvollständig",
          };
        case "es":
          return {
            invoiceTotal: "Total de la factura",
            save: "Guardar",
            close: "Cancelar",
            configurationMissing:
              "La configuración del plugin falta o está incompleta",
          };
        case "fr":
          return {
            invoiceTotal: "Total de la facture",
            save: "Enregistrer",
            close: "Annuler",
            configurationMissing:
              "La configuration du plugin est manquante ou incomplète",
          };
        case "it":
          return {
            invoiceTotal: "Totale fattura",
            save: "Salvare",
            close: "Annulla",
            configurationMissing:
              "La configurazione del plugin è mancante o incompleta",
          };
        case "ro":
          return {
            invoiceTotal: "Totalul facturii",
            save: "Salvare",
            close: "Anulare",
            configurationMissing:
              "Configurația pluginului lipsește sau este incompletă",
          };
        case "pt":
          return {
            invoiceTotal: "Total da fatura",
            save: "Salve",
            close: "Cancelar",
            configurationMissing:
              "A configuração do plugin está em falta ou incompleta",
          };
        default:
          return {
            invoiceTotal: "Invoice total",
            save: "Save",
            close: "Cancel",
            configurationMissing:
              "Plugin configuration is missing or incomplete",
          };
      }
    },
    invoiceTotal() {
      var impTotal = this.invoiceDetailItems
        .map((i) => parseFloat(i.price || 0))
        .reduce((a, b) => a + b, 0);
      return parseFloat(impTotal).toFixed(2);
    },
  },
  methods: {
    async getOriginCountries() {
      var createOrUpdateInternalTableAction = {
        Action: 1, //CreateOrUpdateInternalTable
        Data: JSON.stringify({
          TableName: "Routes",
          ColumnNames: ["Origin", "Destination"],
        }),
      };
      //Create or update InvoiceDetails table
      await this.executeAction(createOrUpdateInternalTableAction);

      var getTableQueryAction = {
        Action: 4, //DBQuery
        Data: JSON.stringify({
          Source: "InternalTables",
          Query: "SELECT DISTINCT [ORIGIN] AS NAME FROM ROUTES",
        }),
      };

      this.originCountries = await this.executeAction(getTableQueryAction);
    },
    async getDestinationCountries(invoiceDetail, countryOfOrigin) {
      var getTableQueryAction = {
        Action: 4, //DBQuery
        Data: JSON.stringify({
          Source: "InternalTables",
          Query: `SELECT DISTINCT [DESTINATION] AS NAME FROM ROUTES WHERE ORIGIN = '${countryOfOrigin}'`,
        }),
      };
      invoiceDetail.destinationCountries = await this.executeAction(getTableQueryAction);
    },
    async getInvoiceDetails() {
      var createOrUpdateInternalTableAction = {
        Action: 1, //CreateOrUpdateInternalTable
        Data: JSON.stringify({
          TableName: this.pluginConfig.dbTableName,
          ColumnNames: [
            "ObjectID",
            "CountryOfOrigin",
            "CountryOfDestination",
            "ProductDescription",
            "Price",
          ],
        }),
      };
      //Create or update InvoiceDetails table
      await this.executeAction(createOrUpdateInternalTableAction);

      //Get all versions of document
      var allVersionsIds = `${this.objectID}`;
      try {
        var allVersions = await this.executeAction(
          "",
          `document/get-version-list/${this.objectID}/true`,
          "GET"
        );
        allVersionsIds = allVersions.map((v) => v.ObjectID || v).join();
      } catch (error) {
        allVersions = await this.executeAction(
          "",
          `document/get-version-list/${this.objectID}`,
          "GET"
        );
        allVersionsIds = allVersions.map((v) => v.ObjectID).join();
      }
      var getDataInternalTableAction = {
        Action: 2, //GetDataInternalTable
        Data: JSON.stringify({
          TableName: this.pluginConfig.dbTableName,
          Filters: [
            {
              ColumnName: "ObjectID",
              Operator: "IN",
              Value: allVersionsIds,
            },
          ],
        }),
      };
      //Get invoiceDetails
      var invDetails = await this.executeAction(getDataInternalTableAction);
      //Map invoiceDetails
      if (invDetails.length > 0) {
        this.originalInvoiceDetailItems = invDetails;
        this.invoiceDetailItems = invDetails.map(
          (imp) => new InvoiceDetail(this.objectID, imp)
        );
      } else {
        this.addInvoiceDetail();
      }
    },
    addInvoiceDetail() {
      this.invoiceDetailItems.push(new InvoiceDetail(this.objectID));
    },
    removeInvoiceDetail(id) {
      this.invoiceDetailItems = this.invoiceDetailItems.filter(
        (item) => item.id !== id
      );
      if (this.invoiceDetailItems.length == 0) {
        this.addInvoiceDetail();
      }
    },
    async save() {
      //Save InvoiceDetails
      var invoiceDetailsToSave = this.invoiceDetailItems.map((i) => i.toDto());
      this.originalInvoiceDetailItems.forEach((item) => {
        if (!invoiceDetailsToSave.some((i) => i.Id == item.Id)) {
          invoiceDetailsToSave.push({
            Id: item.Id,
            Cells: [],
          });
        }
      });

      var saveDataInternalTableAction = {
        Action: 3, //SaveDataInternalTable
        Data: JSON.stringify({
          TableName: this.pluginConfig.dbTableName,
          Rows: invoiceDetailsToSave,
        }),
      };

      await this.executeAction(saveDataInternalTableAction);
      if (
        this.pluginConfig.fieldsToUpdate &&
        this.pluginConfig.fieldsToUpdate.length > 0
      ) {
        var docsToUpdate = [
          {
            ObjectID: this.objectID,
            Fields: this.pluginConfig.fieldsToUpdate.map((f) => {
              return { Code: f.code, Value: f.value };
            }),
          },
        ];
        await this.executeAction(docsToUpdate, "document/update-multiple");
        this.close(true);
      } else {
        this.close();
      }
    },
    close(refreshResults) {
      this.$emit("plugin-close", refreshResults);
    },
    async executeAction(body, targetUrl, method) {
      let url = `${this.apiUrl}/api/${targetUrl || "plugin/execute-action"}`;

      var requestOptions = {
        method: method || "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
      };
      if (body) {
        requestOptions.body = JSON.stringify(body);
      }
      var data = await fetch(url, requestOptions).then((r) => r.json());
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    },
  },
};
</script>
<style>
.v-select ul {
  padding-left: 0px !important;
}
.vs__selected-options {
  flex-wrap: nowrap !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}
.v-dialog {
  overflow-y: visible;
}
</style>
