const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyedropperBridge', {
  getInitData: () => ipcRenderer.invoke('get-eyedropper-data'),
  onInitData: (callback) => {
    ipcRenderer.on('init-eyedropper-data', (_event, data) => callback(data));
  },
  sendColor: (hex) => {
    ipcRenderer.send('eyedropper-color-picked', hex);
  },
  cancel: () => {
    ipcRenderer.send('eyedropper-cancel');
  }
});
