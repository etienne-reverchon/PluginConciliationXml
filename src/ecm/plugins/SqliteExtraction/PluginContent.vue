<template>
  <div class="p-4 max-w-xl mx-auto">
    <h2 class="text-xl font-semibold mb-4">{{ pluginConfig.name }}</h2>

    <!-- dropzone -->
    <div
      class="dropzone mb-4 p-6 border-2 border-dashed rounded text-center cursor-pointer"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div v-if="!pdfFile">
        Glissez-déposez un PDF<br><small>(application/pdf)</small>
      </div>
      <div v-else class="font-medium text-gray-700">
        📄 {{ pdfFile.name }}
      </div>
    </div>

    <!-- sélection des colonnes -->
    <multi-combo
      v-model="columns"
      :items="pluginConfig.defaultColumns"
      placeholder="Colonnes à extraire"
      class="mb-6"
    ></multi-combo>

    <!-- bouton extraction -->
    <button
      class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      :disabled="!pdfFile || loading"
      @click="runExtraction"
    >
      {{ loading ? 'Extraction…' : 'Extraire et Sauvegarder' }}
    </button>
    <p v-if="error" class="mt-3 text-red-600">{{ error }}</p>

    <!-- résultats -->
    <table v-if="rows.length" class="table-auto w-full mt-6 border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <th
            v-for="col in visibleCols"
            :key="col"
            class="border px-2 py-1 text-left"
          >
            {{ col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in rows"
          :key="i"
          class="hover:bg-gray-50"
        >
          <td
            v-for="col in visibleCols"
            :key="col"
            class="border px-2 py-1"
          >
            {{ r[col] || '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import MultiCombo from './MultiCombo.vue';

export default {
  name: 'SqliteExtraction',
  components: { MultiCombo },
  props: {
    pluginConfig: { type: Object, required: true }
  },
  data: function() {
    return {
      pdfFile: null,
      columns: this.pluginConfig.defaultColumns.slice(),
      rows: [],
      loading: false,
      error: ''
    };
  },
  computed: {
    visibleCols: function() {
      if (this.columns && this.columns.length) {
        return this.columns;
      }
      return this.rows.length ? Object.keys(this.rows[0]) : [];
    }
  },
  methods: {
    onDrop: function(e) {
      var f = e.dataTransfer.files[0];
      if (!f || f.type !== 'application/pdf') {
        this.error = 'Veuillez déposer un PDF valide.';
        return;
      }
      this.pdfFile = f;
      this.error = '';
    },

    runExtraction: function() {
      var self = this;
      if (!self.pdfFile) return;
      self.loading = true;
      self.error = '';
      self.rows = [];

      // 1) Préparer FormData
      var form = new FormData();
      form.append('File', self.pdfFile);
      if (self.columns && self.columns.length) {
        form.append('Columns', self.columns.join(','));
      }

      // 2) Appel à l’API d’extraction
      fetch('https://api-docvisionai.doc-ecm.cloud/api/ExtractionJson/extract-json', {
        method: 'POST',
        body: form
      })
        .then(function(res) {
          if (!res.ok) throw new Error('API error ' + res.status);
          return res.json();
        })
        .then(function(payload) {
          if (!Array.isArray(payload.data) || !payload.data.length) {
            throw new Error('Aucune ligne extraite.');
          }
          self.rows = payload.data;

          // 3) Création table interne
          var cols = Object.keys(self.rows[0]);
          return self.callPluginAction({
            Action: 1,
            Data: JSON.stringify({
              TableName: self.pluginConfig.dbTableName || 'OcrExtractionResults',
              ColumnNames: cols
            })
          }).then(function() { return cols; });
        })
        .then(function(cols) {
          // 4) Insertion des lignes
          var payloadRows = self.rows.map(function(r) {
            return {
              Id: 0,
              Cells: cols.map(function(c) {
                return { ColumnName: c, Value: String(r[c] || '') };
              })
            };
          });
          return self.callPluginAction({
            Action: 3,
            Data: JSON.stringify({
              TableName: self.pluginConfig.dbTableName || 'OcrExtractionResults',
              Rows: payloadRows
            })
          });
        })
        .then(function() {
          window.getApp.$emit('APP_MESSAGE', 'Extraction réussie ! (' + self.rows.length + ' lignes)');
        })
        .catch(function(err) {
          self.error = err.message;
          window.getApp.$emit('APP_ERROR', self.error);
        })
        .finally(function() {
          self.loading = false;
        });
    },

    callPluginAction: function(opts) {
      var token = this.$store.getters['account/token'];
      return fetch(this.$store.getters['account/apiUrl'] + '/api/plugin/execute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(opts)
      })
        .then(function(r) { return r.text(); })
        .then(function(t) { return JSON.parse(t); });
    }
  }
};
</script>

<style scoped>
.dropzone {
  transition: background-color 0.2s;
}
.dropzone:hover {
  background-color: #f0f4f8;
}
table {
  border: 1px solid #d1d5db;
}
th,
td {
  border: 1px solid #e5e7eb;
}
</style>
