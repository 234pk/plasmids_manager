/**
 * PlasmidViewer - 交互式质粒图谱查看器
 * 
 * @version 0.1.0
 * @license MIT
 */

(function(global) {
    'use strict';

    // 导出
    global.PlasmidViewer = require('./PlasmidViewer.js');
    global.GenBankParser = require('./GenBankParser.js');

    // AMD / CommonJS 支持
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            PlasmidViewer: global.PlasmidViewer,
            GenBankParser: global.GenBankParser
        };
    }

})(typeof window !== 'undefined' ? window : this);
