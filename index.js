const isRenderer = require('is-electron-renderer')
const electron = require('electron')
const path = require('path')
const http = require('http')
const https = require('https')
const readChunk = require('read-chunk')
const fileType = require('file-type')
const extend = require('deep-extend')

const BrowserWindow = isRenderer
  ? electron.remote.BrowserWindow : electron.BrowserWindow

const pdfjsPath = path.join(__dirname, 'pdfjs', 'web', 'viewer.html')

function isPDF (url) {
  return new Promise((resolve, reject) => {
    if (url.startsWith(`file://${pdfjsPath}?file=`)) {
      resolve(false)
    } else if (url.match(/^file:\/\//i)) {
      const fileUrl = url.replace(/^file:\/\//i, '')
      const buffer = readChunk.sync(fileUrl, 0, 262)
      const ft = fileType(buffer)

      if (!ft) return resolve(false)

      resolve(ft.mime === 'application/pdf')
    } else if (url.match(/\.pdf$/i)) {
      resolve(true)
    } else {
      const m = url.match(/^(https*):\/\//i)
      if (!m) resolve(false)
      const prot = m[1] === 'http' ? http : https

      prot.get(url, res => {
        if (res.headers.location) {
          isPDF(res.headers.location).then(isit => resolve(isit))
            .catch(err => reject(err))
        } else {
          res.once('data', chunk => {
            res.destroy()

            const ft = fileType(chunk)
            if (ft) {
              resolve(ft.mime === 'application/pdf')
            } else {
              resolve(false)
            }
          })
        }
      }).on('error', err => reject(err))
    }
  })
}

class PDFWindow extends BrowserWindow {
  constructor (opts) {
    super(extend({}, opts, {
      webPreferences: { nodeIntegration: false }
    }))

    this.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      this.loadURL(url)
    })

    this.webContents.on('new-window', (event, url) => {
      event.preventDefault()

      event.newGuest = new PDFWindow()
      event.newGuest.loadURL(url)
    })
  }

  loadURL (url, options) {
    isPDF(url).then(isit => {
      if (isit) {
        super.loadURL(`file://${
          path.join(__dirname, 'pdfjs', 'web', 'viewer.html')}?file=${
            decodeURIComponent(url)}`, options)
      } else {
        super.loadURL(url, options)
      }
    }).catch(() => super.loadURL(url, options))
  }
}

PDFWindow.addSupport = function (browserWindow) {
  browserWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    browserWindow.loadURL(url)
  })

  browserWindow.webContents.on('print', (event, url) => {
    console.log('index.js on print')
    event.preventDefault()
    //browserWindow.loadURL(url)
  })

  browserWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault()

    event.newGuest = new PDFWindow()
    event.newGuest.loadURL(url)
  })

  const load = browserWindow.loadURL
  browserWindow.loadURL = function (url, options, style, type) {
    isPDF(url).then(isit => {
      if (isit) {
        console.log('style=1=1=1', style, options, type);
        load.call(browserWindow, `file://${pdfjsPath}?file=${
          decodeURIComponent(url)}#style=${style}&zoom=100&type=${type}`, options)
      } else {
        load.call(browserWindow, url, options)
      }
    })
  }

  
}

module.exports = PDFWindow
