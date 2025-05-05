<template>
  <v-app>
    <v-content>
      <v-container fluid fill-height>
        <v-card class="mx-auto" max-width="500">
          <div v-if="isLoggedIn">
            <v-card-title
              >Welcome
              {{ currentUser.Name + " " + currentUser.Surname }} !</v-card-title
            >
            <v-card-subtitle
              >Please fill in the document IDs to test with the plugin
            </v-card-subtitle>
            <v-card-text>
              <v-combobox
                v-model="objectIDs"
                multiple
                small-chips
                solo
              ></v-combobox>
              <json-viewer :value="documentList"></json-viewer>
            </v-card-text>
            <v-card-actions>
              <v-btn text color="primary" @click="findDocuments"
                >Find documents</v-btn
              >
              <v-btn text color="primary" @click="loadPlugin"
                >Launch plugin</v-btn
              >
              <v-btn text color="error" @click="logout">LOGOUT</v-btn>
            </v-card-actions>
          </div>
          <div v-else>
            <v-card-title>LOGIN</v-card-title>
            <v-card-subtitle>Please login to Doc.ECM first</v-card-subtitle>
            <v-card-text>
              <v-form>
                <v-text-field
                  v-model="username"
                  label="Login"
                  required
                ></v-text-field>
                <v-text-field
                  v-model="password"
                  label="Password"
                  required
                ></v-text-field>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn text color="primary" @click="login">LOGIN</v-btn>
            </v-card-actions>
          </div>
        </v-card>
        <PluginLoaderModal
          :ref="pluginLoaderModalKey"
          @on-refresh-results="findDocuments"
        />
         <SqlitePlugin
          :ref="sqlitePluginModalKey"
        />
      </v-container>
    </v-content>
    <v-hover v-slot="{ hover }">
      <v-snackbar
        :elevation="hover ? 16 : 2"
        :timeout="hover ? -1 : snackbar.timeout"
        top
        center
        :color="snackbar.color"
        v-model="snackbar.show"
      >
        {{ snackbar.text }}
        <template v-slot:action="{ attrs }">
          <v-btn dark v-bind="attrs" @click.native="snackbar.show = false" icon>
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-snackbar>
    </v-hover>
  </v-app>
</template>

<script>
import AppEvents from "./event";
import axios from "axios";
import PluginLoaderModal from "@/components/PluginLoaderModal.vue";
import BaseService from "@/ecm/common/BaseService.js";
import JsonViewer from "vue-json-viewer";



export default {
  name: "App",
  components: { PluginLoaderModal, JsonViewer},
  data: () => ({
    snackbar: {
      show: false,
      text: "",
      color: "",
      timeout: 3000,
    },
    pluginLoaderModalKey: "pluginLoaderModalKey",
    sqlitePluginModalKey: "sqlitePluginModalKey",
    objectIDs: [],
    documentList: [],
    username: "",
    password: "",
  }),

  computed: {
    currentUser() {
      return this.$store.getters["account/user"];
    },
    pluginLoaderModalInstance() {
      return this.$refs[this.pluginLoaderModalKey];
    },
    sqlitePluginModalInstance() {
      return this.$refs[this.sqlitePluginModalKey];
    },
    isLoggedIn() {
      return this.$store.getters["account/isLoggedIn"];
    },
  },
  created() {
    AppEvents.forEach((item) => {
      this.$on(item.name, item.callback);
    });
    window.getApp = this;
    axios.get("/config.json").then((resp) => {
      this.$store.dispatch("account/setApiUrl", resp.data.apiUrl);
      this.$store.dispatch(
        "account/setDefaultLanguage",
        resp.data.defaultLanguage
      );
    });
  },
  methods: {
    loadPlugin() {
      console.log("Load Pluggin")
      if (this.documentList.length == 0) {
        window.getApp.$emit(
          "APP_ERROR",
          "Please find at least one document before launching the plugin"
        );
        return;
      }
      this.pluginLoaderModalInstance.load(this.documentList)    
    },
    login() {
      this.$store.dispatch("account/login", {
        username: this.username,
        password: this.password,
      });
    },
    logout() {
      this.$store.dispatch("account/logout");
    },
    findDocuments() {
      var searchRequest = {
        SearchType: "document-ids",
        SearchPattern: this.objectIDs.join(),
        ContentTypeIDs: "",
        SearchAllVersions: false,
        OrderByQueryPosition: false,
        AllowDeleted: false,
        FieldCodes: "",
      };
      BaseService.post({
        url: `search/get-search-results`,
        data: searchRequest,
      }).then((data) => {
        this.documentList = data.Results;
        this.documentList.forEach((document) => {
          this.addStandardFields(document);
        });
      });
    },
    addStandardFields(document) {
      var standardFields = this.$store.getters["account/searchStandardFields"];
      standardFields.forEach((sf) => {
        var fieldCode = sf.Code;
        var fieldTitle = sf.Title;
        var fieldType = sf.Type;
        var fieldValue = "";
        switch (sf.Code) {
          case "_creationDate_":
            fieldValue = document.CreationDate;
            break;
          case "_author_":
            fieldValue = document.Author;
            break;
          case "_documentID_":
            fieldValue = document.ObjectID;
            break;
        }
        if (fieldValue != "") {
          document.Fields.push({
            Title: fieldTitle,
            Code: fieldCode,
            Type: fieldType,
            Value: fieldValue,
            IsVisible: true,
          });
        }
      });
    },
  },
};
</script>
