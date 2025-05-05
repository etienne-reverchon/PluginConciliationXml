<template>
  <v-dialog
    :ref="modal.key"
    v-model="open"
    @keydown.esc="hide()"
    persistent
    scrollable
    max-width="75%"
  >
    <v-card>
      <v-card-title class="pt-3">
        <span class="headline">{{ plugin.name }}</span>
        <v-spacer />
        <v-icon aria-label="Close" @click.prevent="hide()">mdi-close</v-icon>
      </v-card-title>
      <v-card-text class="pt-1 pb-0">
        <component
          :is="pluginContent"
          :ref="pluginKey"
          :documentList="documents"
          :pluginID="plugin.pluginConfig.id"
          :pluginConfig="plugin.pluginConfig"
          @plugin-close="pluginClose"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import SqlitePlugin from '@/ecm/plugins/SqliteExtraction/Plugin';

export default {
  name: 'PluginLoaderModal',
  data() {
    return {
      modal: { title: 'Extraction PDF → SQLite', key: 'pluginLoaderModalKey' },
      open: false,
      plugin: new SqlitePlugin(),
      pluginContent: null,
      documents: [],
      pluginKey: 'pluginContentRef',
    };
  },
  methods: {
    load(documents) {
      this.documents = documents;
      this.plugin = new SqlitePlugin();
      this.pluginContent = () => import('@/ecm/plugins/SqliteExtraction/PluginContent');
      this.open = true;
    },
    pluginClose(refreshResults) {
      if (refreshResults) {
        this.$emit('on-refresh-results');
      }
      this.open = false;
    },
    hide() {
      this.open = false;
    }
  }
};
</script>

<style scoped>
/* optional modal styling */
</style>
