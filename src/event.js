export default [
  {
    name: 'APP_MESSAGE',
    callback: function (msg) {
      this.snackbar = {
        show: true,
        color: 'success',
        text: msg,
      }
    },
  },
  {
    name: 'APP_ERROR',
    // @error api response data
    callback: function (msg) {
      this.snackbar = {
        show: true,
        color: 'error',
        text: msg,
      }
    },
  },
  {
    name: 'APP_INFO',
    // @error api response data
    callback: function (msg) {
      this.snackbar = {
        show: true,
        color: 'info',
        text: msg,
      }
    },
  },
  {
    name: 'APP_WARNING',
    // @error api response data
    callback: function (msg) {
      this.snackbar = {
        show: true,
        color: 'warning',
        text: msg,
      }
    },
  }
]
