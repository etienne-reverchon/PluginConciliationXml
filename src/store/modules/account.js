import axios from 'axios'
import BaseService from '@/ecm/common/BaseService.js'
import store from '@/store'

// initial state
const state = {
    token: '',
    user: '',
    userMenu: '',
    userContentTypes: [],
    userSavedSearches: [],
    localization: null,
    apiUrl: '',
    searchOperators: [],
    searchStandardFields: [],
    loginParams: null,
    defaultLanguage: null
}

const getters = {
    isLoggedIn: state => !!state.token,
    currentRole: state => state.user.IsAdmin ? 0 : 1,
    user: state => state.user,
    userMenu: state => state.userMenu,
    userContentTypes: state => state.userContentTypes,
    userSavedSearches: state => state.userSavedSearches,
    token: state => state.token,
    localization: state => state.localization,
    apiUrl: state => state.apiUrl,
    searchOperators: state => state.searchOperators,
    searchStandardFields: state => state.searchStandardFields,
    loginParams: state => state.loginParams,
    defaultLanguage: state => state.defaultLanguage
}
const mutations = {
    SET_TOKEN(state, token) {
        state.token = token
    },
    SET_USER(state, user) {
        state.user = user
    },
    CLEAR_USER(state) {
        state.token = ''
        state.user = {}
        state.userMenu = {}
        state.userContentTypes = []
        state.userSavedSearches = []
    },
    SET_LOCALIZATION(state, localization) {
        state.localization = localization
    },
    SET_USER_MENU(state, userMenu) {
        state.userMenu = userMenu
    },
    SET_USER_CONTENT_TYPE(state, userContentTypes) {
        state.userContentTypes = userContentTypes
    },
    SET_USER_SAVED_SEARCHES(state, userSavedSearches) {
        state.userSavedSearches = userSavedSearches
    },
    SET_SEARCH_OPERATORS(state, searchOperators) {
        state.searchOperators = searchOperators
    },
    SET_SEARCH_STANDAR_FIELDS(state, searchStandardFields) {
        state.searchStandardFields = searchStandardFields
    },
    SET_API_URL(state, apiUrl) {
        state.apiUrl = apiUrl
    },
    SET_LOGIN_PARAMS(state, loginParams) {
        state.loginParams = loginParams
    },
    SET_DEFAULT_LANGUAGE(state, defaultLanguage) {
        state.defaultLanguage = defaultLanguage
    },
}

const actions = {
    setApiUrl({ commit }, apiUrl) {
        commit('SET_API_URL', apiUrl)
    },
    setToken({ commit, dispatch }, token) {
        axios.defaults.headers.common.Authorization = 'bearer ' + token;
        commit('SET_TOKEN', token);
        Promise.all([
            dispatch('getUser'),
            dispatch('getUserMenu'),
            dispatch('getUserContentTypes'),
            dispatch('getUserSavedSearches'),
            dispatch('getLocalization'),
            dispatch('getOperators'),
            dispatch('getStandardFields'),
        ])
    },
    setLoginParams({ commit }, loginParams) {
        commit('SET_LOGIN_PARAMS', loginParams)
    },
    setDefaultLanguage({ commit }, defaultLanguage) {
        commit('SET_DEFAULT_LANGUAGE', defaultLanguage)
    },
    login({ commit, dispatch }, user) {
        return new Promise((resolve, reject) => {
            var myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

            var urlencoded = new URLSearchParams();
            urlencoded.append("username", user.username);
            urlencoded.append("password", user.password);
            urlencoded.append("grant_type", "password");
      
            var requestOptions = {
              method: 'POST',
              headers: myHeaders,
              body: urlencoded,
              redirect: 'follow'
            };
      
            fetch(`${store.getters["account/apiUrl"]}/token`, requestOptions)
              .then(response => response.json())
              .then(resp => {
                const token = resp.access_token
                axios.defaults.headers.common.Authorization = 'bearer ' + token
                commit('SET_TOKEN', token)

                Promise.all([
                    dispatch('getUser'),
                    dispatch('getUserMenu'),
                    dispatch('getUserContentTypes'),
                    dispatch('getUserSavedSearches'),
                    dispatch('getLocalization'),
                    dispatch('getOperators'),
                    dispatch('getStandardFields'),
                ]).finally(() => {
                    resolve(resp)
                })
            }).catch(err => {
                commit('SET_TOKEN', null)
                commit('SET_USER', null)
                reject(err)
            })
            .catch(error => console.log('error', error));
        })
    },
    logout({ commit }) {
        return new Promise(resolve => {
            if (store.getters["account/token"]) {
                BaseService.post({ url: 'account/logout' }).then(() => {
                    resolve()
                })
                    .catch(() => {                        
                    })
                    .then(() => {
                        //always
                        delete axios.defaults.headers.common.Authorization
                        commit('CLEAR_USER')
                        resolve()
                    });
            }
            else {
                delete axios.defaults.headers.common.Authorization
                commit('CLEAR_USER')
                resolve()
            }
        })
    },
    getUser({ commit }) {
        return BaseService.get({ url: 'account/current' }).then(result => {
            commit('SET_USER', result)
        })
    },
    getUserMenu({ commit }) {
        return BaseService.get({ url: 'user/get-menu-options' }).then(result => {
            commit('SET_USER_MENU', result)
        })
    },
    getUserContentTypes({ commit }) {
        return BaseService.get({ url: 'content-type/list' }).then(result => {
            commit('SET_USER_CONTENT_TYPE', result)
        })
    },
    getUserSavedSearches({ commit }) {
        return BaseService.get({ url: 'search/user-saved-list' }).then(result => {
            commit('SET_USER_SAVED_SEARCHES', result)
        })
    },
    getLocalization({ commit }) {
        function getLanguage() {
            var languageCode = store.getters["account/user"] ? store.getters["account/user"].CultureCode : "";
            if (!languageCode) {
                var defaultLanguage = store.getters["account/defaultLanguage"] || "auto";
                if (defaultLanguage == "auto") {
                    languageCode = (navigator.languages
                        ? navigator.languages[0]
                        : navigator.language || navigator.userLanguage
                    ).substring(0, 2);
                }
            }
            switch (languageCode) {
                case "de":
                    return 1;
                case "en":
                    return 2;
                case "es":
                    return 3;
                case "fr":
                    return 4;
                case "it":
                    return 5;
                case "ro":
                    return 6;
                case "pt":
                    return 7;
            }
            return 1;
        }
        return BaseService.get({ url: `localization/${getLanguage()}` }).then(result => {
            commit('SET_LOCALIZATION', result)
        })
    },
    getOperators({ commit }) {
        return BaseService.get({ url: 'search/get-operators' }).then(result => {
            commit('SET_SEARCH_OPERATORS', result)
        })
    },
    getStandardFields({ commit }) {
        return BaseService.get({ url: 'search/get-standard-fields' }).then(result => {
            commit('SET_SEARCH_STANDAR_FIELDS', result)
        })
    },
}

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
