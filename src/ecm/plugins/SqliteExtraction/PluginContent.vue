<template>
  <div class="p-4 max-w-xl mx-auto">
    <h2 class="text-xl font-semibold mb-4">{{ pluginConfig.name }}</h2>

    <!-- Zone de drag & drop PDF -->
    <div
      class="dropzone mb-4 p-6 border-2 border-dashed rounded text-center cursor-pointer"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div v-if="!file">
        Glissez-deposez un PDF a traiter<br />
        <small>(application/pdf)</small>
      </div>
      <div v-else class="font-medium text-gray-700">
        📄 {{ file.name }}
      </div>
    </div>

    <!-- Saisie libre des colonnes -->
    <v-combobox
      v-model="selectedCols"
      :items="pluginConfig.defaultColumns"
      multiple
      small-chips
      deletable-chips
      solo
      clearable
      label="Colonnes a extraire (laisser vide pour toutes)"
      class="mb-6"
    />

    <!-- Bouton principal -->
    <button
      @click="runExtraction"
      :disabled="!file || loading"
      class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {{ loading ? 'Extraction…' : 'Extraire et Sauvegarder' }}
    </button>

    <!-- Erreur -->
    <p v-if="error" class="mt-3 text-red-600">{{ error }}</p>
  </div>
</template>

<script>
export default {
  name: 'SqliteExtraction',
  props: ['pluginConfig', 'documentList'],
  data() {
    return {
      file: null,
      selectedCols: [...this.pluginConfig.defaultColumns],
      loading: false,
      error: null
    };
  },
  methods: {
    // UI
    onDrop(e) {
      const f = e.dataTransfer.files[0];
      if (!f || f.type !== 'application/pdf') {
        this.error = 'Veuillez deposer un fichier PDF.';
        return;
      }
      this.file = f;
      this.error = null;
    },

    // Processus principal
    async runExtraction() {
      this.error = null;
      this.loading = true;
      try {
        // 1) upload PDF vers Mistral via action 6 CallRestAPI
        const pdf64 = await this.fileToBase64(this.file);
        const uploadRes = await this.callRestApi({
          APIUrl: 'https://api.mistral.ai/v1/files',
          RequestType: 'POST',
          RequestHeaders: [{ Name: 'Authorization', Value: `Bearer ${this.pluginConfig.mistralApiKey}` }],
          RequestFiles: [
            { ParamName: 'file', Base64File: pdf64, FileName: this.file.name }
          ],
          RequestParameters: [
            { Name: 'purpose', Value: 'ocr', Type: 4 }
          ]
        });
        const uploadId = uploadRes.id;

        // 2) recuperer URL signee
        const signed = await this.callRestApi({
          APIUrl: `https://api.mistral.ai/v1/files/${uploadId}/url?expiry=10`,
          RequestType: 'GET',
          RequestHeaders: [{ Name: 'Authorization', Value: `Bearer ${this.pluginConfig.mistralApiKey}` }]
        });
        const signedUrl = signed.url;

        // 3) appel OCR
        const ocrPayload = {
          model: 'mistral-ocr-latest',
          document: { type: 'document_url', document_url: signedUrl },
          include_image_base64: false
        };
        const ocr = await this.callRestApi({
          APIUrl: 'https://api.mistral.ai/v1/ocr',
          RequestType: 'POST',
          RequestHeaders: [
            { Name: 'Authorization', Value: `Bearer ${this.pluginConfig.mistralApiKey}` },
            { Name: 'Accept', Value: 'application/json' }
          ],
          RequestParameters: [
            { Name: 'application/json', Value: JSON.stringify(ocrPayload), Type: 4 }
          ]
        });
        console.log('OCR raw response', ocr);

        const markdown = ocr.pages.map(p => p.markdown).join('\n');
        const wanted = this.selectedCols.length ? this.selectedCols : undefined;
        const rows = this.parseMarkdown(markdown, wanted);
        if (!rows.length) throw new Error('Aucune donnee extraite.');

        await this.saveRowsToInternalTable(rows);
        window.getApp.$emit('APP_MESSAGE', `Import termine (${rows.length} lignes)`);
      } catch (e) {
        this.error = e.message;
        window.getApp.$emit('APP_ERROR', this.error);
      } finally {
        this.loading = false;
      }
    },

    // Helpers actions Doc.ECM / REST
    async callPluginAction(payload) {
      const api = this.$store.getters['account/apiUrl'];
      const token = this.$store.getters['account/token'];
      const resp = await fetch(`${api}/api/plugin/execute-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      return JSON.parse(await resp.text());
    },
    async callRestApi(params) {
      const raw = await this.callPluginAction({
        Action: 6,
        Data  : JSON.stringify({ ApiRequestParameters: params })
      });
      try {
        return JSON.parse(raw);
      } catch (_) {
        return raw;
      }
    },
    async ensureTable(columns) {
      await this.callPluginAction({
        Action: 1,
        Data: JSON.stringify({ TableName: this.pluginConfig.dbTableName || 'OcrExtractionResults', ColumnNames: columns })
      });
    },
    async saveRowsToInternalTable(rows) {
      const cols = Object.keys(rows[0]);
      await this.ensureTable(cols);
      const payloadRows = rows.map(r => ({
        Id: 0,
        Cells: cols.map(c => ({ ColumnName: c, Value: String(r[c] ?? '') }))
      }));
      await this.callPluginAction({
        Action: 3,
        Data: JSON.stringify({ TableName: this.pluginConfig.dbTableName || 'OcrExtractionResults', Rows: payloadRows })
      });
    },

    // Utils
    fileToBase64(file) {
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    },
    normalize(str) {
      return str.normalize('NFD').replace(/[\p{Diacritic}]/gu, '').toLowerCase();
    },
    parseMarkdown(md, wantedCols) {
      const lines = md.split(/\r?\n/);
      const headerRe = /^\|/;
      const sepRe = /^\|[- :]+\|/;
      let headerIdx = -1;
      let map = {};
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!headerRe.test(l) || sepRe.test(l)) continue;
        const parts = l.slice(1, -1).split('|').map(s => s.trim());
        const cand = {};
        (wantedCols || parts).forEach(col => {
          const idx = parts.findIndex(p => this.normalize(p) === this.normalize(col));
          if (idx !== -1) cand[col] = idx;
        });
        const all = (wantedCols || parts).every(c => c in cand);
        if (all) { headerIdx = i; map = cand; break; }
      }
      if (headerIdx === -1) return [];
      const rows = [];
      for (let i = headerIdx + 2; i < lines.length; i++) {
        const l = lines[i];
        if (!headerRe.test(l)) break;
        const parts = l.slice(1, -1).split('|').map(s => s.trim());
        const obj = {};
        Object.keys(map).forEach(col => { obj[col] = parts[map[col]] || ''; });
        rows.push(obj);
      }
      return rows;
    }
  }
};
</script>

<style scoped>
.dropzone { transition: background-color 0.2s; }
.dropzone:hover { background-color: #f0f4f8; }
</style>
