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

    <button
      class="flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-all"
      :disabled="!pdfFile || loadingExtraction"
      @click="runExtraction"
    >
      {{ loadingExtraction ? 'Extraction…' : 'Extraire et Sauvegarder' }}
    </button>

    <!-- bouton Conciliation -->
    <button
      class="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-all"
      :disabled="loadingConciliation"
      @click="runConciliation"
    >
      {{ loadingConciliation ? 'Conciliation en cours…' : 'Lancer la conciliation' }}
    </button>

    <p v-if="error" class="mt-3 text-red-600">{{ error }}</p>

    <button
      class="mt-4 py-2 px-4 bg-gray-700 text-white rounded"
      @click="debugGEDDocuments"
    >
      Debug GED
    </button>

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

let apiToken = null;
let tokenUntil = 0;

async function getApiToken(auth) {
  if (apiToken && Date.now() < tokenUntil - 30000) return apiToken;
  const body = new URLSearchParams({ grant_type: 'password', username: auth.username, password: auth.password });
  const res = await fetch(auth.baseUrl + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`/token → ${res.status}`);
  const json = await res.json();
  apiToken = json.access_token;
  tokenUntil = Date.now() + json.expires_in * 1000;
  return apiToken;
}

async function fetchAuth(method, url, data, auth) {
  const token = await getApiToken(auth);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function normaliseAmount(v) {
  let s = String(v ?? '').trim().replace(/\s+/g, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

function buildSearchPattern(filters) {
  return '(' + filters.map(f => {
    const type = f.type ?? (/^[-0-9,.]+$/.test(f.Value) ? 'numeric' : 'string');
    const op = { string: 's01', numeric: 'n01' }[type];
    return `;${f.FieldName}|${op}|${f.Value}|${type};`;
  }).join('AND') + ')';
}

export default {
  name: 'SqliteExtraction',
  components: { MultiCombo },
  props: { pluginConfig: { type: Object, required: true } },
  data() {
    return {
      pdfFile: null,
      columns: [...this.pluginConfig.defaultColumns],
      rows: [],
      loadingExtraction: false,
      loadingConciliation: false,
      error: ''
    };
  },
  computed: {
    visibleCols() {
      const base = this.columns.length ? this.columns : (this.rows[0] ? Object.keys(this.rows[0]).filter(c => c !== 'filename' && c !== 'isChecked') : []);
      return [...base, 'filename'];
    },
    cfg() {
      return this.pluginConfig.conciliationInfos || {};
    },
    internalCols() {
      return (this.cfg.columsInternalTable || '').split(',').map(s => s.trim());
    },
    externalCols() {
      return (this.cfg.columsDocument || '').split(',').map(s => s.trim());
    },
    isCheckedCol() { return this.cfg.isCheckedColumn || 'isChecked'; },
    uncheckedValue() { return this.cfg.uncheckedValue || 'false'; },
    checkedValue() { return this.cfg.checkedValue || 'true'; },
    ConciliatedCode() { return this.cfg.codeValidation || 'Pagado'; },
    ConciliatedValue() { return this.cfg.valueValidation || 'Si'; },
    NoConciliatedValue() { return this.cfg.valueToValidate || 'No'; }
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

    async debugGEDDocuments() {
      const ctId = String(this.pluginConfig.facturaContentTypeId);
      try {
        const res = await this.callRest('POST', `${this.pluginConfig.auth.baseUrl}/api/search/advanced`, {
          searchPattern: '(;%|%|%|string;)',
          contentTypeIDs: ctId
        });
        const docs = Array.isArray(res) ? res : (res.Objects || []);
        console.info(`🔍 ${docs.length} doc(s) trouvé(s)`);
        docs.forEach(d => {
          const num = d.Fields?.find(f => f.Code === this.externalCols[0])?.Value ?? '—';
          const amt = d.Fields?.find(f => f.Code === this.externalCols[1])?.Value ?? '—';
          console.log(`ID=${d.ObjectID} | Nº Facture=${num} | Montant=${amt}`);
        });
      } catch (err) {
        console.error('Debug GED :', err);
      }
    },

    isRowComplete(row) {
     return this.internalCols.every(col =>
       String(row[col] ?? '').trim() !== ''
     );
   },
    

    async runConciliation() {
  console.clear();
  if (!this.rows.length) await this.loadRowsFromTable();
  if (!this.rows.length) {
    return window.getApp.$emit('APP_MESSAGE', 'Aucun enregistrement à concilier.');
  }
  this.loadingConciliation = true;

  const ctId       = this.pluginConfig.facturaContentTypeId;
  const tbl        = this.pluginConfig.dbTableName;
  const [intKey, intValKey]   = this.internalCols;
  const [extKeyNum, extKeyAmt] = this.externalCols;

  try {
    const todo = this.rows
      .map((r,i) => ({ ...r, _idx: i }))
      .filter(r =>
        r[this.isCheckedCol] === this.uncheckedValue &&
        this.isRowComplete(r)
      );

    let matched = 0;

    for (const r of todo) {
      const num = String(r[intKey] || '').trim();
      const val = normaliseAmount(r[intValKey]);
      if (!num || !val) continue;

      const docs = await this.searchFactura(ctId, [
        { FieldName: extKeyNum, Value: num, type: 'string' }
      ]);
      const doc = docs[0];
      if (!doc) continue;

      const cmpRaw = doc.Fields.find(f => f.Code === extKeyAmt)?.Value;
      const cmp    = normaliseAmount(cmpRaw);
      if (Math.abs(Number(cmp) - Number(val)) > 0.01) continue;

      await this.marquerPagado(doc, ctId);

      await this.callPluginAction({
        Action: 3,
        Data: JSON.stringify({
          TableName: tbl,
          Rows: [{
            Id: Number(r._rowId) || 0,
            Cells: [
              { ColumnName: this.isCheckedCol, Value: this.checkedValue },
              { ColumnName: intKey,    Value: num  },
              { ColumnName: intValKey, Value: String(val) }
            ]
          }]
        })
      });

      this.$set(this.rows[r._idx], this.isCheckedCol, this.checkedValue);
      matched++;
    }

    window.getApp.$emit(
      'APP_MESSAGE',
      `Conciliation terminée : ${matched}/${todo.length} facture(s) rapprochée(s).`
    );

  } catch (err) {
    console.error(err);
    this.error = err.message;
  } finally {
    this.loadingConciliation = false;
  }
}
,
    async runExtraction() {
      if (!this.pdfFile) return;
      this.loadingExtraction = true;
      this.error = '';

      const tableName = this.pluginConfig.dbTableName || 'OcrExtractionResults';
      const rawName = this.pdfFile.name.trim();
      const filename = rawName.toUpperCase();

      try {
        let existing = [];
        try {
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
          const baseCols = [...this.columns];
          if (!baseCols.includes('filename')) baseCols.push('filename');
          await this.callPluginAction({
            Action: 1,
            Data: JSON.stringify({ TableName: tableName, ColumnNames: baseCols })
          });
          existing = [];
        }
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

        this.rows = data.map(row => {
          const newRow = { ...row };
          newRow[ this.isCheckedCol ] = this.uncheckedValue;
          return newRow;
        });

        const cols = Object.keys(this.rows[0]);
        if (!cols.includes('filename')) cols.push('filename');
        await this.callPluginAction({
          Action: 1,
          Data: JSON.stringify({ TableName: tableName, ColumnNames: cols })
        });

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
        this.loadingExtraction = false;
      }
    },
    async marquerPagado(doc, ctId) {
  const champ  = this.pluginConfig.conciliationInfos.codeValidation;
  const valeur = this.pluginConfig.conciliationInfos.valueValidation; 
  const defId  = this.pluginConfig.conciliationInfos.codeValidationId;

  const currentFields = doc.Fields.map(f => ({ ...f }));
  const cible = currentFields.find(f => f.Code === champ);

  if (cible) {
    cible.Value = valeur;
  } else {
    currentFields.push({
      DefFieldID: defId,
      Type: 3,
      Code: champ,
      Value: valeur
    });
  }

  console.log('📤 PATCH GED:', {
    ObjectID: doc.ObjectID ?? doc.Id,
    ContentTypeID: ctId,
    Champ: champ,
    Valeur: valeur
  });

  await this.callRest(
    'POST',
    `${this.pluginConfig.auth.baseUrl}/api/document/save`,
    {
      ObjectID     : doc.ObjectID ?? doc.Id,
      Operation    : 2,
      ContentTypeID: Number(ctId),
      Fields       : currentFields
    }
  );
},


    async marquerLigneOk(row, tbl) {
      const cells = [
        { ColumnName: this.internalCols[0], Value: row[this.internalCols[0]] },
        { ColumnName: this.internalCols[1], Value: row[this.internalCols[1]] },
        { ColumnName: this.isCheckedCol, Value: this.checkedValue }
      ];
      await this.callPluginAction({
        Action: 3,
        Data: JSON.stringify({ TableName: tbl, Rows: [{ Id: Number(row._rowId), Cells: cells }] })
      });
    },

    async searchFactura(ctId, filters) {
      const res = await this.callRest('POST', `${this.pluginConfig.auth.baseUrl}/api/search/advanced`, {
        searchPattern: buildSearchPattern(filters),
        contentTypeIDs: String(ctId)
      });
      return Array.isArray(res) ? res : (res.Objects || []);
    },

    async loadRowsFromTable() {
      const tbl = this.pluginConfig.dbTableName;
      if (!tbl) return this.rows = [];
      let resp = await this.callPluginAction({ Action: 2, Data: JSON.stringify({ TableName: tbl }) });
      if (typeof resp === 'string') resp = JSON.parse(resp);
      const recs = Array.isArray(resp) ? resp : (resp?.Rows || []);
      this.rows = recs.map(r => {
        const o = {};
        (r.Cells || []).forEach(c => o[c.ColumnName] = c.Value);
        o[this.isCheckedCol] = o[this.isCheckedCol] || this.uncheckedValue;
        o._rowId = r.Id;
        return o;
      });
    },

    async callRest(method, endpoint, body) {
      return fetchAuth(method, endpoint, body, this.pluginConfig.auth);
    },

    async callPluginAction(body) {
      return fetchAuth('POST', `${this.$store.getters['account/apiUrl']}/api/plugin/execute-action`, body, this.pluginConfig.auth);
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
