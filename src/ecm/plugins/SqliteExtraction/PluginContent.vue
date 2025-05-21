<template>
  <div class="p-4 max-w-xl mx-auto">
    <h2 class="text-xl font-semibold mb-4">{{ pluginConfig.name }}</h2>

    <!-- zone de dépôt -->
    <div
      class="dropzone mb-4 p-6 border-2 border-dashed rounded text-center cursor-pointer"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div v-if="!xmlFile">
        Glissez-déposez un fichier CAMT.054 XML<br><small>(text/xml)</small>
      </div>
      <div v-else class="font-medium text-gray-700">
        🗎 {{ xmlFile.name }}
      </div>
    </div>

    <!-- sélection des colonnes -->
    <multi-combo
      v-model="columns"
      :items="pluginConfig.defaultColumns"
      placeholder="Colonnes à extraire"
      class="mb-6"
    />

    <!-- extraction -->
    <button
      class="flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-all"
      :disabled="!xmlFile || loadingExtraction"
      @click="runExtraction"
    >
      {{ loadingExtraction ? 'Extraction…' : 'Extraire et Sauvegarder' }}
    </button>

    <!-- conciliation -->
    <button
      class="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-all"
      :disabled="loadingConciliation"
      @click="runConciliation"
    >
      {{ loadingConciliation ? 'Conciliation en cours…' : 'Lancer la conciliation' }}
    </button>

    <p v-if="error" class="mt-3 text-red-600">{{ error }}</p>

    <!-- résultat -->
    <table v-if="rows.length" class="table-auto w-full mt-6 border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <!-- clé = nom de colonne -->
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
        <!-- clé = index ligne -->
        <tr v-for="(row, rIndex) in rows" :key="rIndex" class="hover:bg-gray-50">
          <!-- clé = combinaison ligne+colonne -->
          <td
            v-for="(col, cIndex) in visibleCols"
            :key="`${rIndex}-${cIndex}`"
            class="border px-2 py-1"
          >
            {{ row[col] || '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>




<script>
import MultiCombo from './MultiCombo.vue';

/* ----------  utils : normalisation montant + pattern recherche GED  --------- */
function normaliseAmount(v) {
  let s = String(v ?? '').trim().replace(/\s+/g, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else                 s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}
function buildSearchPattern(filters) {
  return '(' + filters.map(f => {
    const type = f.type ?? (/^[-0-9,.]+$/.test(f.Value) ? 'numeric' : 'string');
    const op   = { string: 's01', numeric: 'n01' }[type];
    return `;${f.FieldName}|${op}|${f.Value}|${type};`;
  }).join('AND') + ')';
}

/* util – nettoie la valeur brute d’<AddtlRmtInf> */
function normalizeInvoiceId(raw) {
  if (!raw) return '';

  // 1) référence QR : 25-27 chiffres consécutifs
  const qr = raw.match(/\b\d{20,27}\b/);
  if (qr) return qr[0];

  // 2) "Facture 4069", "FACTURE 5133 CLIENTE …"
  const fac = raw.match(/facture\s*([0-9]+)/i);
  if (fac) return fac[1];

  const num = raw.match(/\d{3,}/);
  if (num) return num[0];

  return raw.trim();
}

function extractCamtRows(xmlText, cfg, filename) {
  const nsURI = 'urn:iso:std:iso:20022:tech:xsd:camt.054.001.04';
  const ns    = p => (p === 'n' ? nsURI : null);
  const doc   = new DOMParser().parseFromString(xmlText, 'application/xml');

  const snap = doc.evaluate('//n:TxDtls', doc, ns,
                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const rows = [];

  for (let i = 0; i < snap.snapshotLength; i++) {
    const tx   = snap.snapshotItem(i);
    const line = {};

    for (const [col, xp] of Object.entries(cfg.xmlFieldMappings)) {
      line[col] = doc.evaluate(xp, tx, ns,
                    XPathResult.STRING_TYPE, null).stringValue.trim();
    }

    /* ► nettoyage spécifique de l'InvoiceId ◄ */
    line.InvoiceId = normalizeInvoiceId(line.InvoiceId);

    /* garde la ligne si InvoiceId & InvoiceAmount présents */
    if (!line.InvoiceId || !line.InvoiceAmount) continue;

    rows.push({
      ...line,
      filename,
      [cfg.conciliationInfos.isCheckedColumn]:
        cfg.conciliationInfos.uncheckedValue
    });
  }
  return rows;
}


/* ----------  token + requêtes REST GED / plugin -------------------- */
let apiToken   = null;
let tokenUntil = 0;
async function getApiToken(auth) {
  if (apiToken && Date.now() < tokenUntil - 30_000) return apiToken;
  const body = new URLSearchParams({ grant_type:'password',
                                     username  :auth.username,
                                     password  :auth.password });
  const res  = await fetch(auth.baseUrl + auth.tokenUrl, {
                  method :'POST',
                  headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
                  body });
  if (!res.ok) throw new Error(`/token → ${res.status}`);
  const json = await res.json();
  apiToken   = json.access_token;
  tokenUntil = Date.now() + json.expires_in * 1000;
  return apiToken;
}
async function fetchAuth(method, url, data, auth) {
  const token = await getApiToken(auth);
  const res   = await fetch(url, {
                  method,
                  headers:{ 'Content-Type':'application/json',
                            'Authorization':`Bearer ${token}` },
                  body:data ? JSON.stringify(data) : undefined });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export default {
  name      : 'SqliteExtractionXML',
  components: { MultiCombo },
  props     : { pluginConfig:{ type:Object, required:true } },

  data() {
    return {
      xmlFile           : null,
      columns           : [],
      rows              : [],
      loadingExtraction : false,
      loadingConciliation:false,
      error             : ''
    };
  },

  computed: {
    visibleCols() {
      const base = this.columns.length
        ? this.columns
        : (this.rows[0] ? Object.keys(this.rows[0])
              .filter(c => !['filename', this.isCheckedCol].includes(c)) : []);
      return [...base, 'filename'];
    },
    cfg()            { return this.pluginConfig.conciliationInfos || {}; },
    internalCols()   { return (this.cfg.columsInternalTable||'').split(',').map(s=>s.trim()); },
    externalCols()   { return (this.cfg.columsDocument     ||'').split(',').map(s=>s.trim()); },
    isCheckedCol()   { return this.cfg.isCheckedColumn || 'isChecked';  },
    uncheckedValue() { return this.cfg.uncheckedValue  || 'false';      },
    checkedValue()   { return this.cfg.checkedValue    || 'true';       }
  },

  methods: {
    /* ----- drag-and-drop ----- */
    onDrop(e) {
      const file  = e.dataTransfer.files[0];
      const isXml = file && (file.type === 'text/xml' || /\.xml$/i.test(file.name));
      if (!isXml) { this.error = 'Veuillez déposer un fichier XML valide.'; return; }
      this.xmlFile = file;
      this.error   = '';
    },

    /* ----- extraction ----- */

    async runExtraction() {
  if (!this.xmlFile) return;

  this.loadingExtraction = true;
  this.error             = '';

  const tableName = this.pluginConfig.dbTableName || 'XmlExtractionResults';
  const filename  = this.xmlFile.name.trim().toUpperCase();

  try {
    /* ----------------------------------------------------------------
       Étape 0 : crée (ou ajuste) la table AVANT toute vérification
    ---------------------------------------------------------------- */
    const baseCols = [...this.pluginConfig.defaultColumns,
                      'filename',
                      this.isCheckedCol];
    await this.callPluginAction({
      Action: 1,
      Data  : JSON.stringify({ TableName: tableName, ColumnNames: baseCols })
    });

    /* ----------------------------------------------------------------
       Étape 1 : contrôle strict du doublon filename
    ---------------------------------------------------------------- */
    const resp = await this.callPluginAction({
      Action: 2,
      Data  : JSON.stringify({
        TableName: tableName,
        Filters  : [{ ColumnName: 'filename',
                      Operator  : 'IN',
                      Value     : filename }]
      })
    });

    /* la réponse peut être : string JSON | {Rows:[…]} | array */
    let rowsFound = Array.isArray(resp) ? resp
                  : resp?.Rows            ? resp.Rows
                  : typeof resp === 'string' ? JSON.parse(resp)
                  : [];
    const isDuplicate = rowsFound.some(r =>
      (r.Cells || []).some(c =>
        c.ColumnName === 'filename' &&
        c.Value.trim().toUpperCase() === filename
      )
    );
    if (isDuplicate) {
      throw new Error(`Le fichier « ${filename} » a déjà été importé.`);
    }

    /* ----------------------------------------------------------------
       Étape 2 : parse XML → rows
    ---------------------------------------------------------------- */
    const xmlText = await this.xmlFile.text();
    const data    = extractCamtRows(xmlText, this.pluginConfig, filename);
    if (!data.length) throw new Error('Aucune transaction valide dans le XML.');
    this.rows = data;

    /* ----------------------------------------------------------------
       Étape 3 : insère les lignes
    ---------------------------------------------------------------- */
    const cols = Object.keys(this.rows[0]); // colonnes réelles + filename + isChecked
    const payloadRows = this.rows.map(r => ({
      Id   : 0,
      Cells: cols.map(c => ({ ColumnName: c, Value: String(r[c] ?? '') }))
    }));
    await this.callPluginAction({
      Action: 3,
      Data  : JSON.stringify({ TableName: tableName, Rows: payloadRows })
    });

    window.getApp.$emit(
      'APP_MESSAGE',
      `Extraction XML réussie ! (${this.rows.length} lignes ajoutées)`
    );
  } catch (err) {
    this.error = err.message;
    window.getApp.$emit('APP_ERROR', this.error);
  } finally {
    this.loadingExtraction = false;
  }
},

    
    /* ----- conciliation (identique à ta version originale) ----- */
    async runConciliation() {
      console.clear();
      if (!this.rows.length) await this.loadRowsFromTable();
      if (!this.rows.length)
        return window.getApp.$emit('APP_MESSAGE','Aucun enregistrement à concilier.');

      this.loadingConciliation = true;
      const ctId    = this.pluginConfig.facturaContentTypeId;
      const tbl     = this.pluginConfig.dbTableName;
      const [intKey,intValKey]      = this.internalCols;
      const [extKeyNum,extKeyAmt]   = this.externalCols;

      try {
        const todo = this.rows.map((r,i)=>({...r,_idx:i}))
          .filter(r => r[this.isCheckedCol]===this.uncheckedValue &&
                       String(r[intKey]??'').trim()!=='' &&
                       String(r[intValKey]??'').trim()!=='' );

        let matched=0;
        for(const r of todo) {
          const num = String(r[intKey]).trim();
          const val = normaliseAmount(r[intValKey]);

          const docs = await this.searchFactura(ctId,[
            { FieldName:extKeyNum, Value:num, type:'string' }
          ]);
          const doc = docs[0]; if(!doc) continue;

          const cmp = normaliseAmount(
            doc.Fields.find(f=>f.Code===extKeyAmt)?.Value );
          if(Math.abs(Number(cmp)-Number(val))>0.01) continue;

          await this.marquerPagado(doc,ctId);

          await this.callPluginAction({ Action:3, Data:JSON.stringify({
            TableName:tbl, Rows:[{
              Id:Number(r._rowId)||0,
              Cells:[
                { ColumnName:this.isCheckedCol,Value:this.checkedValue },
                { ColumnName:intKey,          Value:num  },
                { ColumnName:intValKey,       Value:String(val) }
              ]
            }]}
          )});
          this.$set(this.rows[r._idx],this.isCheckedCol,this.checkedValue);
          matched++;
        }
        window.getApp.$emit('APP_MESSAGE',
          `Conciliation terminée : ${matched}/${todo.length} rapprochées.`);
      } catch(err){ console.error(err); this.error=err.message; }
      finally{ this.loadingConciliation=false; }
    },

    /* ----- helpers GED & plugin ----- */
    async searchFactura(ctId, filters) {
      const res = await this.callRest('POST',
        `${this.pluginConfig.auth.baseUrl}/api/search/advanced`,
        { searchPattern:buildSearchPattern(filters),
          contentTypeIDs:String(ctId) });
      return Array.isArray(res) ? res : (res.Objects||[]);
    },
    async marquerPagado(doc,ctId){
      const infos = this.pluginConfig.conciliationInfos;
      const champ = infos.codeValidation, valeur=infos.valueValidation,
            defId = infos.codeValidationId;
      const fields = doc.Fields.map(f=>({...f}));
      const cible  = fields.find(f=>f.Code===champ);
      cible ? cible.Value=valeur :
              fields.push({ DefFieldID:defId,Type:3,Code:champ,Value:valeur });

      await this.callRest('POST',
        `${this.pluginConfig.auth.baseUrl}/api/document/save`,
        { ObjectID:doc.ObjectID??doc.Id, Operation:2,
          ContentTypeID:Number(ctId), Fields:fields });
    },
    async loadRowsFromTable(){
      const tbl=this.pluginConfig.dbTableName;
      let resp = await this.callPluginAction(
        { Action:2, Data:JSON.stringify({ TableName:tbl }) });
      if(typeof resp==='string') resp=JSON.parse(resp);
      const recs=Array.isArray(resp)?resp:(resp?.Rows||[]);
      this.rows = recs.map(r=>{
        const o={}; (r.Cells||[]).forEach(c=>o[c.ColumnName]=c.Value);
        o[this.isCheckedCol]=o[this.isCheckedCol]||this.uncheckedValue;
        o._rowId=r.Id; return o;
      });
    },
    async callRest(method,url,body){
      return fetchAuth(method,url,body,this.pluginConfig.auth);
    },
    async callPluginAction(body){
      const api = this.$store.getters['account/apiUrl'];
      return fetchAuth('POST',`${api}/api/plugin/execute-action`,
                       body,this.pluginConfig.auth);
    }
  }
};
</script>

<style scoped>
.dropzone{transition:background-color .2s;}
.dropzone:hover{background-color:#f0f4f8;}
table{border:1px solid #d1d5db;}
th,td{border:1px solid #e5e7eb;}
</style>