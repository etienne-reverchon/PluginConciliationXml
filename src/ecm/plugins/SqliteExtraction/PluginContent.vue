<!-- src/ecm/plugins/SqliteExtraction/PluginContent.vue -->
<template>
  <div class="p-4 max-w-lg mx-auto">
    <h2 class="text-xl font-semibold mb-4">{{ pluginConfig.name }}</h2>

    <!-- Zone de drag & drop -->
    <div
      class="dropzone mb-4 p-6 border-2 border-dashed rounded text-center cursor-pointer"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div v-if="!file">
        Glissez-déposez un fichier<br/>
        <small>({{ pluginConfig.acceptMime.join(', ') }})</small>
      </div>
      <div v-else class="font-medium text-gray-700">
        📄 {{ file.name }}
      </div>
    </div>

    <!-- Sélecteur de colonnes -->
    <div class="mb-4">
      <label class="block mb-1">Colonnes à extraire</label>
      <select
        v-model="selectedCols"
        multiple
        class="w-full p-2 border rounded"
      >
        <option
          v-for="col in pluginConfig.defaultColumns"
          :key="col"
          :value="col"
        >
          {{ col }}
        </option>
      </select>
      <small class="text-gray-500">Ctrl+clic pour plusieurs</small>
    </div>

    <!-- Bouton d’action -->
    <button
      @click="runExtraction"
      :disabled="!file || !selectedCols.length || loading"
      class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {{ loading ? 'Extraction…' : 'Extraire et Sauvegarder' }}
    </button>

    <!-- Affichage d’erreur -->
    <p v-if="error" class="mt-3 text-red-600">{{ error }}</p>

    <!-- Lien de téléchargement -->
    <div v-if="result" class="mt-4 p-3 bg-green-100 rounded">
      ✔️ Extraction réussie !<br/>
      <a :href="result.downloadUrl" target="_blank" class="underline text-blue-600">
        Télécharger la base SQLite
      </a>
    </div>
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
      error: null,
      result: null
    }
  },
  methods: {
    onDrop(e) {
      const f = e.dataTransfer.files[0]
      if (!f) return
      if (!this.pluginConfig.acceptMime.includes(f.type)) {
        this.error = `Type non supporté : ${f.type}`
        return
      }
      this.file   = f
      this.error  = null
      this.result = null
    },

    getFieldValue(key) {
      const doc = this.documentList?.[0]
      const field = doc?.Fields?.find(f => f.Key === key)
      if (!field) {
        console.warn(`Champ non trouvé : ${key}`)
      }
      return field ? field.Value : ''
    },

    async runExtraction() {
      this.error   = null
      this.loading = true

      try {
        // Préparer le FormData avec exactement les deux champs attendus
        const form = new FormData()
        form.append('File', this.file)                                // clé "File" comme dans Postman
        form.append('Columns', this.selectedCols.join(','))           // clé "Columns"
        const nameField = this.getFieldValue('Name')
        form.append('DocumentName', nameField)


  
        const apiUrl = "http://localhost:5151"
        const url    = `${apiUrl}/api/SqliteExtraction/extract`

        // Appel direct à ton API ASP.NET
        const resp = await fetch(url, {
          method: 'POST',
          body: form
        })

        if (!resp.ok) {
          const txt = await resp.text()
          throw new Error(`Erreur ${resp.status} – ${txt}`)
        }

        // Parser la réponse JSON
        this.result = await resp.json()
        window.getApp.$emit('APP_MESSAGE', 'Extraction réussie !')
      }
      catch (e) {
        this.error = e.message
        window.getApp.$emit('APP_ERROR', this.error)
      }
      finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.dropzone {
  transition: background-color .2s;
}
.dropzone:hover {
  background-color: #f0f4f8;
}
</style>
