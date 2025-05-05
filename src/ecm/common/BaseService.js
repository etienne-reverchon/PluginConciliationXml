import axios from 'axios'
import store from '@/store'

class BaseService {
    constructor() {
        // const
        this.httpVerbs = {
            get: 'get',
            post: 'post',
            delete: 'delete',
            put: 'put'
        }

        // dataType
        this.httpDataType = {
            json: 'json',
            jsonp: 'jsonp',
            xml: 'xml'
        }

        // data content typ
        this.contentType = {
            formUrlEncoded: 'application/x-www-form-urlencoded; charset=UTF-8',
            formData: 'multipart/form-data',
            textPlain: 'text/plain',
            json: 'application/json'
        }
    }

    // cross process input configurations to set default values
    processServicesConfigurations(configurations) {
        const apiUrl = `${store.getters["account/apiUrl"]}/api/`

        // post with files
        if (configurations.postFormData) {
            return {
                baseURL: apiUrl,
                method: this.httpVerbs.post,
                data: configurations.data,
                url: configurations.url,
                config: { headers: { 'Content-Type': this.contentType.formData } }
            }
        }
        return {
            baseURL: apiUrl,
            // cache: configurations.cache || false, //default false
            method: configurations.type || this.httpVerbs.get, // default get
            responseType: configurations.dataType || this.httpDataType.json, // default json
            // async: configurations.async || true, //default async
            // traditional: configurations.traditional || false, //default no traditional for array objects
            // contentType: configurations.contentType || contentType.json, //default json
            config: { headers: { 'Content-Type': configurations.contentType || this.contentType.json } },
            url: configurations.url,
            data: configurations.data
        }
    }

    callAxios(configurations, resolve, reject) {
        var axiosOptions = this.processServicesConfigurations(configurations)

        if (store.getters["account/token"]) {
            axios.defaults.headers.common.Authorization = 'bearer ' + store.getters["account/token"]
        }

        axios(axiosOptions)
            .then(resp => {
                resolve(resp.data)
            })
            .catch(err => {
                reject(err)
            })
    }

    commonAjaxRequest(httpDefaultType, configurations) {
        return new Promise((resolve, reject) => {
            configurations.type = httpDefaultType
            this.callAxios(configurations, resolve, reject)
        })
    }

    // http get
    get(configurations) {
        return this.commonAjaxRequest(this.httpVerbs.get, configurations)
    }

    // http post
    post(configurations) {
        return this.commonAjaxRequest(this.httpVerbs.post, configurations)
    }

    // http post with form data
    postFormData(configurations) {
        configurations.postFormData = true
        return this.commonAjaxRequest(this.httpVerbs.post, configurations)
    }

    // http put
    put(configurations) {
        return this.commonAjaxRequest(this.httpVerbs.put, configurations)
    }

    // http delete
    delete(configurations) {
        return this.commonAjaxRequest(this.httpVerbs.delete, configurations)
    }
}

export default new BaseService()
