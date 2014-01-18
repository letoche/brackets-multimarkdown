/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";

    try {
        var mmdConverter = require('mmd');
    } catch (e) {}

    /**
     * @private
     * Handler function for the simple.getMemory command.
     * @return {{total: number, free: number}} The total and free amount of
     *   memory on the user's system, in bytes.
     */
    function cmdConvert(md, onSuccess) {
        var html;
        if (mmdConverter) {
            html = mmdConverter.convert(md);
        } else {
            html = 'please install Multimardown-node :<br> in brackets extension folder<br>cd brackets-multimarkdown/node<br>sudo npm install<br>restart Brackets';
        }
        return {
            code: html
        };
    }

    /**
     * Initializes the test domain with several test commands.
     * @param {DomainManager} DomainManager The DomainManager for the server
     */
    function init(DomainManager) {

        if (!DomainManager.hasDomain("mmd")) {
            DomainManager.registerDomain("mmd", {
                major: 0,
                minor: 1
            });
        }
        DomainManager.registerCommand(
            "mmd", // domain name
            "convert", // command name
            cmdConvert, // command handler function
            false, // this command is synchronous
            "Convert multimarkdown to html", ["md"], [{
                name: "html",
                type: "{code: htmlcode}",
                description: ""
            }]
        );
    }

    exports.init = init;

}());
