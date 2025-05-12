<template>
    <div class="multicombo">
      <span v-for="(item,i) in value" :key="i" class="chip">
        {{ item }}
        <button @click="$emit('input', value.filter((_,j)=>j!==i))">✕</button>
      </span>
  
      <input
        v-model="draft"
        @keydown.enter.prevent="add"
        @blur="add"
        :placeholder="placeholder"
      />
  
      <button v-if="value.length" @click="$emit('input', [])">🗑</button>
    </div>
  </template>
  
  <script>
  export default {
    name : 'MultiCombo',
    props: {
      value      : { type: Array,  default: () => [] },
      items      : { type: Array,  default: () => [] },
      placeholder: { type: String, default: '' }
    },
    data() { return { draft: '' }; },
    methods: {
      add() {
        const txt = this.draft.trim();
        if (txt && !this.value.includes(txt)) {
          this.$emit('input', [...this.value, txt]);
        }
        this.draft = '';
      }
    }
  };
  </script>
  
  <style scoped>
  .multicombo{display:flex;align-items:center;flex-wrap:wrap;border:1px solid #ccc;padding:4px;border-radius:4px}
  .chip{background:#e0e0e0;border-radius:16px;padding:2px 6px;margin:2px;display:flex;align-items:center}
  .chip button{background:none;border:none;cursor:pointer;margin-left:4px}
  .multicombo input{border:none;flex:1;min-width:120px;padding:4px}
  </style>
  