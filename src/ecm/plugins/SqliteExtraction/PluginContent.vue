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

/* ------------------------------------------------------------------ */
/*  Gestion du token d'API                                            */
/* ------------------------------------------------------------------ */
let apiToken   = null;
let tokenUntil = 0;

/** Retourne un token JWT valide (renouvelle si expiré) */
async function getApiToken(auth) {
  if (apiToken && Date.now() < tokenUntil - 30_000) {   // marge 30 s
    return apiToken;
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    username  : auth.username,
    password  : auth.password
  });

  const res = await fetch('https://apidemo.doc-ecm.cloud/token', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    throw new Error(`/token → ${res.status}`);
  }

  const json = await res.json();
  apiToken   = json.access_token;
  tokenUntil = Date.now() + json.expires_in * 1_000;
  return apiToken;
}

/** Wrapper générique : ajoute le Bearer automatiquement */
async function fetchAuth(method, url, data, auth) {
  const token = await getApiToken(auth);
  const res   = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>'');
    throw new Error(`${url} → ${res.status} ${txt}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/* utilitaires globaux                                               */
/* ------------------------------------------------------------------ */

function normaliseDate(str) {

  const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{3,4})$/);

  if (!m) return null;

  let [ , d, mth, y ] = m;
  if (y.length === 3) y = '2' + y;          // “202” → “2020x”
  if (y.length === 2) y = '20' + y;         // “24”  → “2024”

  return `${y.padStart(4,'0')}-${mth.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

const buildSearchPattern = (filters) =>
  '(' + filters.map(f => {
    // 1) type implicite
    const type = f.type ?? (
      f.FieldName.startsWith('FC_fecha') ? 'datetime' :
      /^[-0-9,.]+$/.test(f.Value)       ? 'numeric'  : 'string'
    );

    // 2) valeur normalisée si datetime
    const value = (type === 'datetime')
      ? normaliseDate(f.Value) || f.Value
      : f.Value;

    // 3) opérateur en fonction du type
    const opByType = { string:'s01', numeric:'n01', datetime:'d05' };
    const op = opByType[type];

    return `;${f.FieldName}|${op}|${value}|${type};`;
  }).join('AND') + ')';

  function normaliseAmount(v) {
  let s = String(v ?? '').trim();
  if (!s) return '';

  // 1) enlever les espaces / fine / insécables
  s = s.replace(/\s+/g, '');

  /* ----------------------------------------------------------------
     Si la chaîne contient une virgule, on considère que :
       · la virgule est la décimale
       · tous les points sont des séparateurs de milliers → on les enlève
     Sinon :
       · le point est la décimale
       · les virgules éventuelles sont des milliers → on les enlève
  -----------------------------------------------------------------*/
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');     // "1.234,56" → "1234.56"
  } else {
    s = s.replace(/,/g, '');                        // "1,234.56" → "1234.56"
  }

  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}


  

/* ------------------------------------------------------------------ */



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
      loadingExtraction: false,
      loadingConciliation: false,
      error: ''
    };
  },
  computed: {
    visibleCols() {
      // Always include filename column
      const base = this.columns.length ? this.columns : (this.rows[0] ? Object.keys(this.rows[0]).filter(c => c !== 'filename' && c !== 'isChecked') : []);
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

    async debugGEDDocuments() {
  // 1. la valeur doit rester une chaîne, pas un tableau
  const ctId = String(this.pluginConfig.facturaContentTypeId);

  try {
    const res = await this.callRest(
      'POST',
      'https://apinetdemo.doc-ecm.cloud/api/search/advanced',
      {
        searchPattern : "(;%|%|%|string;)",
        contentTypeIDs: ctId          // ✅ STRING
        // pas de take / skip
      }
    );

    /* 2. Le service renvoie directement un tableau -> on le gère */
    const docs = Array.isArray(res) ? res : (res.Objects || []);

    console.info(`🔍 ${docs.length} doc(s) trouvés pour ContentTypeID=${ctId}`);

    /* 3. Dans la réponse les métadonnées s’appellent Code/Value, pas FieldName */
    docs.forEach(d => {
      const num = d.Fields?.find(f => f.Code === 'FC_no_de_la_factura')?.Value ?? '—';
      const amt = d.Fields?.find(f => f.Code === 'FC_importe_de_la_factura')?.Value ?? '—';
      console.log(`🧾 ID=${d.ObjectID} | Nº Facture=${num} | Montant=${amt}`);
    });

  } catch (err) {
    console.error('❌ Debug GED :', err);
  }
},

    async loadRowsFromTable() {
      const tableName = this.pluginConfig.dbTableName;
      if (!tableName) return;

      let resp;
      try {
        resp = await this.callPluginAction({
          Action: 2,
          Data  : JSON.stringify({ TableName: tableName })
        });
      } catch (e) {
        console.error(`Action 2 KO : ${e.message}`);
        this.rows = [];
        return;
      }

      if (typeof resp === 'string') {
        try {
          resp = JSON.parse(resp);
        } catch (e) {
          console.error('Impossible de parser la réponse :', resp);
          this.rows = [];
          return;
        }
      }

      let records = [];

      if (Array.isArray(resp)) {
        records = resp;                                // cas ① tableau direct
      } else if (Array.isArray(resp?.Rows)) {
        records = resp.Rows;                           // cas ② {Rows:[…]}
      } else if (resp && resp.Id && resp.Cells) {
        records = [resp];                              // cas ③ objet unique
      } else {
        console.warn(`Table « ${tableName} » vide ou format inconnu`, resp);
        this.rows = [];
        return;
      }

      this.rows = records.map(r => {
        const o = {};
        (r.Cells || []).forEach(c => { o[c.ColumnName] = c.Value; });

        o.FC_no_de_la_factura      ??= o.Comprobante;
        o.FC_importe_de_la_factura ??= o.Importe;
        o.FC_fecha_de_la_factu     ??= o.Fecha;
        o.isChecked                ??= 'false';
        o._rowId                   = r.Id;
        return o;
      });

      if (!this.columns?.length && this.rows[0]) {
        this.columns = Object.keys(this.rows[0])
          .filter(c => !['filename', 'isChecked'].includes(c));
      }

      console.log(`${this.rows.length} ligne(s) chargée(s) depuis « ${tableName} »`);
    },


    async callRest(method, endpoint, body = null) {
      return fetchAuth(
        method,
        `${endpoint}`,
        body,
        this.pluginConfig.auth 
      );
    },

    isRowComplete(row) {
      return Object.entries(row)
        .filter(([k]) => !['filename', 'isChecked'].includes(k))
        .every(([, v]) => String(v ?? '').trim() !== '');
    },

    /* -------------------------------------------------------------- */
/* Conciliation OCR ↔ GED                                          */
/* -------------------------------------------------------------- */
async runConciliation () {
  console.clear();
  console.log('runConciliation lancé');

  /* 0. Pré-chargement éventuel des lignes ---------------------- */
  if (!this.rows.length) await this.loadRowsFromTable();
  if (!this.rows.length) {
    window.getApp.$emit('APP_MESSAGE', 'Aucun enregistrement à concilier.');
    return;
  }

  this.loadingConciliation = true;

  const tableName   = this.pluginConfig.dbTableName;
  const facturaCtId = this.pluginConfig.facturaContentTypeId;

  try {
    /* 1. Construit la todo-list : lignes complètes et non cochées */
    const todo = this.rows
      .map((r, i) => ({ ...r, _idx: i }))
      .filter(r => !['true', true].includes(r.isChecked) && this.isRowComplete(r));

    let matched = 0;

    /* 2. Parcours des lignes ---------------------------------- */
    for (const r of todo) {
      const numFact  = String(r.FC_no_de_la_factura || '').trim();
      const importe  = normaliseAmount(r.FC_importe_de_la_factura);
      if (!numFact || !importe) continue;              // garde-fous

      /* 2.1 Recherche GED sur le N° de facture seul ----------- */
      const docs = await this.searchFactura(facturaCtId, [
        { FieldName:'FC_no_de_la_factura', Operator:'=', Value:numFact, type:'string' }
      ]);
      const doc  = docs[0];
      if (!doc) continue;

      /* 2.2 Contrôle du montant avec tolérance ---------------- */
      const bruteDoc   = doc.Fields?.find(f => f.Code === 'FC_importe_de_la_factura')?.Value;
      const importeDoc = normaliseAmount(bruteDoc);
      console.log(`🔍 N°${numFact} | Ligne=${importe} | GED=${importeDoc}`);
      if (Math.abs(Number(importeDoc) - Number(importe)) > 0.01) continue;

      /* 2.3 Mise à jour du doc GED (FC_pagado → 'Si') ---------- */
      await this.marquerPagado(doc, facturaCtId);

      /* 2.4 Mise à jour de la table interne ------------------- */
      await this.marquerLigneOk(r, tableName);
      this.$set(this.rows[r._idx], 'isChecked', 'true');
      matched++;
    }

    /* 3. Fin de boucle, feedback UI --------------------------- */
    window.getApp.$emit(
      'APP_MESSAGE',
      `Conciliation terminée : ${matched}/${todo.length} facture(s) rapprochée(s).`
    );

  } catch (err) {
    this.error = err.message || String(err);
    window.getApp.$emit('APP_ERROR', this.error);

  } finally {
    this.loadingConciliation = false;
  }
},

/* === Helpers ====================================================== */

/* Marque FC_pagado = 'Si' et sauvegarde le document GED */
async marquerPagado (doc, ctId) {
  const currentFields = doc.Fields.map(f => ({ ...f }));        // shallow copy
  const pagado        = currentFields.find(f => f.Code === 'FC_pagado');

  if (pagado) pagado.Value = 'Si';
  else currentFields.push({
    DefFieldID : 21093,  Type : 3,  Code : 'FC_pagado',  Value : 'Si'
  });

  await this.callRest('POST',
    'https://apinetdemo.doc-ecm.cloud/api/document/save',
    {
      ObjectID     : doc.ObjectID ?? doc.Id,
      Operation    : 2,
      ContentTypeID: Number(ctId),
      Fields       : currentFields
    });
},

/* Coche la ligne correspondante dans la table interne */
async marquerLigneOk (row, tableName) {
  await this.callPluginAction({
    Action: 3,
    Data  : JSON.stringify({
      TableName: tableName,
      Rows: [{
        Id   : Number(row._rowId) || 0,
        Cells: [
          { ColumnName:'isChecked',   Value:'true' },
          { ColumnName:'Importe',     Value: row.FC_importe_de_la_factura },
          { ColumnName:'Comprobante', Value: row.FC_no_de_la_factura },
          { ColumnName:'Fecha', Value: row.FC_fecha_de_la_factu}
        ]
      }]
    })
  });
},



  
async searchFactura(ctId, filters) {

  const res = await this.callRest(
    'POST',
    'https://apinetdemo.doc-ecm.cloud/api/search/advanced',
    {
      searchPattern : buildSearchPattern(filters),
      contentTypeIDs: String(ctId)
    }
  );
  return Array.isArray(res) ? res : (res.Objects || []);
},

    /* ------------------------------------------------------------------ */


    async runExtraction() {
      if (!this.pdfFile) return;
      this.loadingExtraction = true;
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

        // Ajouter la colonne isChecked à chaque ligne avec la valeur false par défaut
        this.rows = data.map(row => {
          const newRow = { ...row };
          newRow.isChecked = 'false';
          return newRow;
        });

        // 3. Créer table (idempotent)
        const cols = Object.keys(this.rows[0]);
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
        this.loadingExtraction = false;
      }
    },
    async callPluginAction(body) {
      return fetchAuth(
        'POST',
        `${this.$store.getters['account/apiUrl']}/api/plugin/execute-action`,
        body,
        this.pluginConfig.auth
      );
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
