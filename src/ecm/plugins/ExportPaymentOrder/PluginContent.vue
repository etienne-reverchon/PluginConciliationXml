<template>
  <div class="text-center ma-10">
    <PulseLoader :loading="loading" color="#00cae3" />
  </div>
</template>
<script>
import { PulseLoader } from "@saeris/vue-spinners";
import { saveAs } from "file-saver";

export default {
  name: "ExportPaymentOrder",
  components: {
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
  created() {
    this.exportDocuments();
  },
  data() {
    return {
      loading: false,
      folders: [],
      docsToUpdate: [],
      errorList: [],
      standardFields: [
        `%URL%`,
        `%ID%`,
        `%AUTHOR%`,
        `%VERSION%`,
        `%CREATIONDATE%`,
      ],
      pluginVersionData: {
        version: "1.0",
        dateLastModified: "20.08.2021",
      },
      apiUrl: this.$store.getters["account/apiUrl"],
      apiToken: this.$store.getters["account/token"],
    };
  },
  computed: {},
  methods: {
    getFieldValue(document, fieldCode, required, isDate, isDecimal) {
      if (this.standardFields.includes(fieldCode)) {
        var docURL = `${window.location.origin}/#/search/document-ids/${document.ObjectID}`;
        return fieldCode
          .replaceAll(`%URL%`, docURL)
          .replaceAll(`%ID%`, document.ObjectID)
          .replaceAll(`%AUTHOR%`, document.Author)
          .replaceAll(`%VERSION%`, document.Version)
          .replaceAll(`%CREATIONDATE%`, document.CreationDate);
      } else {
        var field = document.Fields.find((f) => f.Code == fieldCode);
        if (!field) {
          this.errorList.push({
            id: document.ObjectID,
            error: `Field not found: ${fieldCode}`,
          });
          return "";
        }
        if (required && !field.Value) {
          this.errorList.push({
            id: document.ObjectID,
            error: `Field cannot be empty: ${field.Title}`,
          });
          return "";
        }
        if (isDate) {
          try {
            return field.Value ? this.toLocaleDateString(field.Value) : "";
          } catch {
            this.errorList.push({
              id: document.ObjectID,
              error: `Invalid date: ${field.Title} - ${field.Value}`,
            });
            return "";
          }
        }
        if (isDecimal) {
          try {
            return field.Value ? this.toISODecimalString(field.Value) : "";
          } catch {
            this.errorList.push({
              id: document.ObjectID,
              error: `Invalid number: ${field.Title} - ${field.Value}`,
            });
            return "";
          }
        }
        return field.Value;
      }
    },
    toLocaleDateString(userDate) {
      var userFormat = this.$store.getters["account/user"].MetricDateFormat;
      let datePartIndex = userFormat.toUpperCase().indexOf("YYYY");
      var yearSubString = 4;
      if (datePartIndex <= 0) {
        datePartIndex = userFormat.toUpperCase().indexOf("YY");
        yearSubString = 2;
      }
      var year = parseInt(userDate.substr(datePartIndex, yearSubString));

      datePartIndex = userFormat.toUpperCase().indexOf("MM");
      var month = parseInt(userDate.substr(datePartIndex, 2));

      datePartIndex = userFormat.toUpperCase().indexOf("DD");
      var day = parseInt(userDate.substr(datePartIndex, 2));

      return new Date(year, month - 1, day).toLocaleDateString("fr-CH");
    },
    toISODecimalString(userDecimal) {
      var userDecSep = this.$store.getters["account/user"].MetricDecimalSep;
      var userThouSep = this.$store.getters["account/user"].MetricThousandSep;
      return userDecimal
        .replaceAll(userThouSep, "")
        .replaceAll(userDecSep, ".");
    },

    async exportDocuments() {
      this.loading = true;
      await this.exportFile();
      this.loading = false;
      if (this.errorList.length == 0) {
        window.getApp.$emit("APP_MESSAGE", "Documents exported with success");
      } else {
        var errors = this.errorList
          .map((e) => `Document ${e.id} - Error: ${e.error}`)
          .join("\n");
        window.getApp.$emit("APP_ERROR", errors);
      }
      this.$emit("plugin-close", this.docsToUpdate.length > 0);
    },
    async exportFile() {
      var self = this;
      var content = "";
      for (const document of self.documentList) {

        //PAYMENT ORDER NUMBER
        var paymentOrderNumber = self.pluginConfig.paymentOrderNumberFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderNumberFieldCode
            )
          : "";

        //PAYMENT ORDER DATE
        var paymentOrderDate = self.pluginConfig.paymentOrderDateFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderDateFieldCode,
              true,
              true
            )
          : "";

        //PAYMENT ORDER DEBITOR ACCOUNT NUMBER
        var paymentOrderDebitorAccountNumber = self.pluginConfig.paymentOrderDebitorAccountNumberFieldCode
          ? self.getFieldValue(document, self.pluginConfig.paymentOrderDebitorAccountNumberFieldCode)
          : "";

        //PAYMENT ORDER DEBITOR NAME
        var paymentOrderDebitorName = self.pluginConfig.paymentOrderDebitorNameFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderDebitorNameFieldCode
            )
          : "";

        //PAYMENT ORDER CURRENCY
        var paymentOrderCurrency = self.pluginConfig.paymentOrderCurrencyFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderCurrencyFieldCode
            )
          : "";

        //PAYMENT ORDER TOTAL AMOUNT (REQUIRED)
        if (!self.pluginConfig.paymentOrderTotalAmountFieldCode) {
          self.errorList.push({
            id: document.ObjectID,
            error: `The amount field is missing in the configuration`,
          });
          continue;
        }
        var paymentOrderAmount = self.getFieldValue(
          document,
          self.pluginConfig.paymentOrderTotalAmountFieldCode,
          true,
          false,
          true
        );

        //CREDITOR NAME
        var paymentOrderCreditorName = self.pluginConfig.paymentOrderCreditorNameFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderCreditorNameFieldCode
            )
          : "";

        //CREDITOR ADDRESS
        var paymentOrderCreditorAddress = self.pluginConfig.paymentOrderCreditorAddressFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderCreditorAddressFieldCode
            )
          : "";

        //PAYMENT DATE
        var paymentOrderPaymentDate = self.pluginConfig.paymentOrderPaymentDateFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderPaymentDateFieldCode
            )
          : "";

        //CREDITOR BANK ACCOUNT
        var paymentOrderCreditorBankAccount = self.pluginConfig.paymentOrderCreditorBankAccountFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderCreditorBankAccountFieldCode
            )
          : "";

        //CREDITOR SWIFT
        var paymentOrderCreditorSWIFT = self.pluginConfig.paymentOrderCreditorSWIFTFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderCreditorSWIFTFieldCode
            )
          : "";

        //INTERMEDIARY SWIFT
        var paymentOrderIntermediarySWIFT = self.pluginConfig.paymentOrderIntermediarySWIFTFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderIntermediarySWIFTFieldCode
            )
          : "";

        //REFERENCe
        var paymentOrderReference = self.pluginConfig.paymentOrderReferenceFieldCode
          ? self.getFieldValue(
              document,
              self.pluginConfig.paymentOrderReferenceFieldCode
            )
          : "";

        var lineTemplate = `${paymentOrderNumber};${paymentOrderDate};${paymentOrderDebitorAccountNumber};${paymentOrderDebitorName};${paymentOrderAmount};${paymentOrderCurrency};${paymentOrderPaymentDate};;${paymentOrderCreditorName};${paymentOrderCreditorAddress};${paymentOrderCreditorBankAccount};${paymentOrderCreditorSWIFT};${paymentOrderIntermediarySWIFT};${paymentOrderReference}`;
        content += lineTemplate + "\r\n";

        if (self.errorList.find((x) => x.id == document.ObjectID)) continue;

        if (
          self.pluginConfig.fieldsToUpdate &&
          self.pluginConfig.fieldsToUpdate.length > 0
        ) {
          self.docsToUpdate.push({
            ObjectID: document.ObjectID,
            Fields: self.pluginConfig.fieldsToUpdate.map((f) => {
              return { Code: f.code, Value: f.value };
            }),
          });
        }
      }

      var blob = new Blob([content], {
        type: "text/plain;charset=utf-8",
      });

      var dateStr = new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .substring(0, 14);
      saveAs(blob, `EXPORT_${dateStr}.txt`);

      if (this.docsToUpdate.length > 0) {
        await this.executeAction(this.docsToUpdate, "document/update-multiple");
      }
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
