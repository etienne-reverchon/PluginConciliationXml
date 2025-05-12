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
        Glissez-déposez un PDF<br /><small>(application/pdf)</small>
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
    />

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
        <tr v-for="(row, idx) in rows" :key="idx" class="hover:bg-gray-50">
          <td v-for="col in visibleCols" :key="col" class="border px-2 py-1">
            {{ row[col] || '' }}
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
  data() {
    return {
      pdfFile: null,
      columns: [...this.pluginConfig.defaultColumns],
      rows: [],
      loading: false,
      error: ''
    };
  },
  computed: {
    visibleCols() {
      // Always include filename column
      const base = this.columns.length ? this.columns : (this.rows[0] ? Object.keys(this.rows[0]).filter(c => c !== 'filename') : []);
      return [...base, 'filename'];
    }
  },
  methods: {
    onDrop(e) {
      const file = e.dataTransfer.files[0];
      if (!file || file.type !== 'application/pdf') {
        this.error = 'Veuillez déposer un PDF valide.';
        return;
      }
      this.pdfFile = file;
      this.error = '';
    },

    async runExtraction() {
      if (!this.pdfFile) return;
      this.loading = true;
      this.error = '';

      const tableName = this.pluginConfig.dbTableName || 'OcrExtractionResults';
        // Normalisation du nom de fichier pour comparaison
        const rawName = this.pdfFile.name.trim();
        const filename = rawName.toUpperCase();

      try {
        // 1. Vérifier ou créer la table interne si nécessaire
        let existing = [];
        try {
          // Tentative de lecture des doublons
          existing = await this.callPluginAction({
            Action: 2,
            Data: JSON.stringify({
              TableName: tableName,
              Filters: [
                { ColumnName: 'filename', Operator: 'IN', Value: filename }
              ]
            })
          });
        } catch (err) {
          // Si la table n'existe pas, on la crée avec les colonnes par défaut + filename
          const baseCols = [...this.columns];
          if (!baseCols.includes('filename')) baseCols.push('filename');
          await this.callPluginAction({
            Action: 1,
            Data: JSON.stringify({ TableName: tableName, ColumnNames: baseCols })
          });
          existing = [];
        }
        // Si des enregistrements existent, on bloque l'import
        console.log("IS EXIST ", existing, "TAILE ", existing.length)
        const fileExists = Array.isArray(existing) && existing.some(record =>
          Array.isArray(record.Cells) && record.Cells.some(cell =>
            cell.ColumnName === 'filename' && cell.Value.trim().toUpperCase() === filename
          )
        );
        console.log("File exists : ", fileExists)
        if (existing.length > 100) {
          throw new Error(`Le fichier « ${filename} » a déjà été importé.`);
        }

        // 2. Appel OCR externe
        const form = new FormData();
        form.append('File', this.pdfFile);
        if (this.columns.length) {
          form.append('Columns', this.columns.join(','));
        }
        const res = await fetch(
          'https://api-docvisionai.doc-ecm.cloud/api/ExtractionJson/extract-json',
          { method: 'POST', body: form }
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const { data } = await res.json();
        if (!Array.isArray(data) || !data.length) {
          throw new Error('Aucune ligne extraite.');
        }
        this.rows = data;

        // 3. Créer table (idempotent)
        const cols = Object.keys(data[0]);
        if (!cols.includes('filename')) cols.push('filename');
        await this.callPluginAction({
          Action: 1,
          Data: JSON.stringify({ TableName: tableName, ColumnNames: cols })
        });

        // 4. Insérer les lignes extraites
        const payloadRows = this.rows.map(row => ({
          Id: 0,
          Cells: [
            ...cols.filter(c => c !== 'filename').map(c => ({ ColumnName: c, Value: String(row[c] || '') })),
            { ColumnName: 'filename', Value: filename }
          ]
        }));
        await this.callPluginAction({
          Action: 3,
          Data: JSON.stringify({ TableName: tableName, Rows: payloadRows })
        });

        window.getApp.$emit('APP_MESSAGE', `Extraction réussie ! (${this.rows.length} lignes ajoutées)`);
      } catch (err) {
        this.error = err.message;
        window.getApp.$emit('APP_ERROR', this.error);
      } finally {
        this.loading = false;
      }
    },

    async callPluginAction(opts) {
      const token = this.$store.getters['account/token'];
      const response = await fetch(
        `${this.$store.getters['account/apiUrl']}/api/plugin/execute-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(opts)
        }
      );
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Action ${opts.Action} failed: ${text}`);
      }
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
th, td {
  border: 1px solid #e5e7eb;
}
</style>
