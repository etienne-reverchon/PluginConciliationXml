import Vue from 'vue'
import Vuex from 'vuex'
import account from './modules/account'
import VuexPersistence from 'vuex-persist'

const vuexLocal = new VuexPersistence({
  key: 'docecm',
  storage: window.localStorage,
  modules: ['account'],
})


Vue.use(Vuex)

const store = new Vuex.Store({
  modules: {
    account
  },
  plugins: [vuexLocal.plugin],
})

export default store
