import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import de from 'vuetify/es5/locale/de'
import es from 'vuetify/es5/locale/es'
import fr from 'vuetify/es5/locale/fr'
import en from 'vuetify/es5/locale/en'
import it from 'vuetify/es5/locale/it'
import pt from 'vuetify/es5/locale/pt'
import ro from 'vuetify/es5/locale/ro'

Vue.use(Vuetify)



const theme = {
  primary: '#00CAE3',
  secondary: '#4370B2',
  accent: '#4370B2',
  info: '#00CAE3',
}

export default new Vuetify({
  theme: {
    themes: {
      dark: theme,
      light: theme,
    },
  },
  lang: {
    locales: { de, es, fr, en, it, pt, ro },
    current: 'en',
  },
  breakpoint: {
    mobileBreakpoint: 'sm' // This is equivalent to a value of 960
  },
})