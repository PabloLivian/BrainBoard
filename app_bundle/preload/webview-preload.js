/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "electron"
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
(module) {

module.exports = require("electron");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/asset-relocator-loader */
/******/ 	if (typeof __webpack_require__ !== 'undefined') __webpack_require__.ab = __dirname + "/native_modules/";
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
let exports = __webpack_exports__;
/*!********************************************!*\
  !*** ./app/src/preload/webview-preload.ts ***!
  \********************************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const electron_1 = __webpack_require__(/*! electron */ "electron");
electron_1.contextBridge.exposeInMainWorld('_rtb_app_features_', [
    'MIRO_LOADER',
    'MIRO_VISIBILITY_CHANGED_EVENT',
    'MIRO_STAT_TRIGGERED_EVENT',
]);
electron_1.contextBridge.exposeInMainWorld('_rtb_app_actions_', {
    moduleLoaded: (moduleName) => {
        electron_1.ipcRenderer.send('webview-module-loaded', moduleName);
    },
    getDeviceInfo: () => {
        return electron_1.ipcRenderer.sendSync('get-device-info-object');
    },
    getAppConfig: () => {
        return electron_1.ipcRenderer.sendSync('get-app-config');
    },
    initiateSilentUpdate: () => {
        return electron_1.ipcRenderer.send('initiate-silent-update');
    },
    getScreenSharingSources: (options) => {
        return electron_1.ipcRenderer.invoke('get-screen-sharing-sources', options);
    },
    getMediaAccessStatus: (mediaType) => {
        return electron_1.ipcRenderer.invoke('get-media-access-status-granted', mediaType);
    },
});

})();

/******/ })()
;