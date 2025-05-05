<template>
  <div>
    <div class="text-center ma-10" v-if="loading">
      <PulseLoader :loading="loading" color="#00cae3" />
    </div>
    <div v-else>
      <div class="row">
        <div v-for="field in documentFields" :key="field.Code" class="col">
          {{ field.Title }}
        </div>
      </div>
      <div
        class="row align-center justify-center"
        v-for="document in documentList"
        :key="document.Code"
      >
        <div
          v-for="docField in getFields(document)"
          :key="`${document.ObjectID}-${docField.Code}`"
          class="col"
        >
          {{ docField.Value }}
        </div>
      </div>
      <div class="v-card__actions pt-0 pb-3 mt-3">
        <div class="spacer"></div>
        <button
          @click="close()"
          type="button"
          class="
            pa-4
            text-capitalize
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
import { PulseLoader } from "@saeris/vue-spinners";

export default {
  name: "DocumentFieldList",
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
  async created() {
    if (
      !this.pluginConfig ||
      !this.pluginConfig.fieldsToShow
    ) {
      window.getApp.$emit(
        "APP_ERROR",
        this.localizedResources.configurationMissing
      );
      this.close();
    } else {
      this.loading = true;
      //DO SOMETHING
      this.loading = false;
    }
  },
  data() {
    return {
      loading: false,
      pluginVersionData: {
        version: "1.4",
        dateLastModified: "19.08.2021",
      },
      apiUrl: this.$store.getters["account/apiUrl"],
      apiToken: this.$store.getters["account/token"],
    };
  },
  computed: {
    documentFields() {
      return this.documentList[0].Fields.slice(
        0,
        this.pluginConfig.fieldsToShow
      );
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
            save: "Speichern",
            close: "Stornieren",
            configurationMissing:
              "Plugin-Konfiguration fehlt oder ist unvollständig",
          };
        case "es":
          return {
            save: "Guardar",
            close: "Cancelar",
            configurationMissing:
              "La configuración del plugin falta o está incompleta",
          };
        case "fr":
          return {
            save: "Enregistrer",
            close: "Annuler",
            configurationMissing:
              "La configuration du plugin est manquante ou incomplète",
          };
        case "it":
          return {
            save: "Salvare",
            close: "Annulla",
            configurationMissing:
              "La configurazione del plugin è mancante o incompleta",
          };
        case "ro":
          return {
            save: "Salvare",
            close: "Anulare",
            configurationMissing:
              "Configurația pluginului lipsește sau este incompletă",
          };
        case "pt":
          return {
            save: "Salve",
            close: "Cancelar",
            configurationMissing:
              "A configuração do plugin está em falta ou incompleta",
          };
        default:
          return {
            save: "Save",
            close: "Cancel",
            configurationMissing:
              "Plugin configuration is missing or incomplete",
          };
      }
    },
  },
  methods: {    
    getFields(document) {
      return document.Fields.slice(
        0,
        this.pluginConfig.fieldsToShow
      );
    },
    save() {
      this.$emit("plugin-close", true);
    },
    close() {
      this.$emit("plugin-close", false);
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
