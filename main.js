/*
 * Copyright (c) 2013 Patrick Chatain
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
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, PathUtils */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var AppInit = brackets.getModule("utils/AppInit"),
        NodeConnection = brackets.getModule("utils/NodeConnection"),
        CommandManager = brackets.getModule("command/CommandManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        FileUtils = brackets.getModule("file/FileUtils"),
        PanelManager = brackets.getModule("view/PanelManager"),
        Resizer = brackets.getModule("utils/Resizer"),
        Menus = brackets.getModule("command/Menus"),
        StringUtils = brackets.getModule("utils/StringUtils");

    // Local modules
    var panelHTML = require("text!panel.html");

    // jQuery objects
    var $iframe;

    // Other vars
    var currentDoc,
        panel,
        visible = false,
        realVisibility = false;

    // Create a new node connection. Requires the following extension:
    // https://github.com/joelrbrandt/brackets-node-client
    var nodeConnection = new NodeConnection();

    var Strings = require("./strings");

    var MMD_CONTEXT_MENU_EXPORT_HTML_ID = 'MMD_CONTEXT_MENU_EXPORT_HTML_ID',
        MMD_CONTEXT_MENU_MMD_REF_ID = 'MMD_CONTEXT_MENU_MMD_REF_ID',
        MMD_CONTEXT_MENU_MMD_PREVIEW_ID = 'MMD_CONTEXT_MENU_MMD_PREVIEW_ID';


    var menuDividerId;

    var needDisplayMenu = true;

    var _timer;

    // Helper function that chains a series of promise-returning
    // functions together via their done callbacks.
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }


    function convertMarkdown(md, onSuccess) {
        var convert = nodeConnection.domains.mmd.convert(md, onSuccess);
        convert.fail(function (err) {
            console.error("[brackets-mmd-node] failed to run mmd.convert", err);
        });
        convert.done(function (html) {
            onSuccess(html.code);
        });
        return convert;
    }


    function _loadDoc(doc, preserveScrollPos) {

        var htmlReceived = function (bodyText) {
            bodyText = bodyText.replace(/href=\"([^\"]*)\"/g, "title=\"$1\"");

            // Make <base> tag for relative URLS
            var baseUrl = window.location.protocol + "//" + FileUtils.getDirectoryPath(doc.file.fullPath);

            // Assemble the HTML source
            var htmlSource = "<html><head>";
            htmlSource += "<base href='" + baseUrl + "'>";
            htmlSource += "<link href='" + require.toUrl("./multimarkdown.css") + "' rel='stylesheet'></link>";
            htmlSource += "</head><body onload='document.body.scrollTop=" + scrollPos + "'>";
            htmlSource += bodyText;
            htmlSource += "</body></html>";
            $iframe.attr("srcdoc", htmlSource);
        };


        if (doc && visible && $iframe) {
            var docText = doc.getText(),
                scrollPos = 0,
                bodyText = "";

            if (preserveScrollPos) {
                scrollPos = $iframe.contents()[0].body.scrollTop;
            }

            // Parse markdown into HTML
            bodyText = convertMarkdown(docText, htmlReceived);

        }
    }


    function _documentChange(e) {
        // "debounce" the page updates to avoid thrashing/flickering
        // Note: this should use Async.whenIdle() once brackets/pull/5528
        // is merged.
        if (_timer) {
            window.clearTimeout(_timer);
        }
        _timer = window.setTimeout(function () {
            _timer = null;
            _loadDoc(e.target, true);
        }, 300);
    }

    function _resizeIframe() {
        if (visible && $iframe) {
            var iframeWidth = panel.$panel.innerWidth();
            $iframe.attr("width", iframeWidth + "px");
        }
    }

    function _setPanelVisibility(isVisible) {
        if (isVisible === realVisibility) {
            return;
        }

        realVisibility = isVisible;
        if (isVisible) {
            if (!panel) {
                var $panel = $(panelHTML);
                $iframe = $panel.find("#panel-markdown-preview-frame");

                panel = PanelManager.createBottomPanel("markdown-preview-panel", $panel);
                $panel.on("panelResizeUpdate", function (e, newSize) {
                    $iframe.attr("height", newSize);
                });
                $iframe.attr("height", $panel.height());

                window.setTimeout(_resizeIframe);
            }
            _loadDoc(DocumentManager.getCurrentDocument());
            panel.show();
        } else {
            panel.hide();
        }
    }

    function _currentDocChangedHandler() {
        var doc = DocumentManager.getCurrentDocument(),
            ext = doc ? PathUtils.filenameExtension(doc.file.fullPath).toLowerCase() : "";

        if (currentDoc) {
            $(currentDoc).off("change", _documentChange);
            currentDoc = null;
        }

        if (doc && /md|markdown|txt/.test(ext)) {
            currentDoc = doc;
            _addMenuToContextMenu();
            $(currentDoc).on("change", _documentChange);
            if (!$("#status-language").hasClass("mmd-clickable"))
                $("#status-language").addClass("mmd-clickable").on("click", _toggleVisibility);
            //            $("#status-language").bind("contextmenu", _toggleMenu);
            _setPanelVisibility(visible);
            _loadDoc(doc);
        } else {
            _removeMenuFromContextMenu();
            $("#status-language").removeClass("mmd-clickable").unbind("click");
            //            $("#status-language").unbind("contextmenu");
            _setPanelVisibility(false);
        }
    }

    function _toggleVisibility() {
        visible = !visible;
        _setPanelVisibility(visible);
    }

    function _toggleMenu() {
        alert('show menu');
    }


    function _addMenuToContextMenu() {
        if (!needDisplayMenu) return;
        needDisplayMenu = false;
        var dividerMenu = Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuDivider();
        menuDividerId = dividerMenu.id;
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(MMD_CONTEXT_MENU_MMD_PREVIEW_ID, "", Menus.LAST);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(MMD_CONTEXT_MENU_EXPORT_HTML_ID, "", Menus.LAST);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(MMD_CONTEXT_MENU_MMD_REF_ID, "", Menus.LAST);

    }

    function _removeMenuFromContextMenu() {
        if (menuDividerId) Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuDivider(menuDividerId);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem(MMD_CONTEXT_MENU_MMD_PREVIEW_ID);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem(MMD_CONTEXT_MENU_EXPORT_HTML_ID);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem(MMD_CONTEXT_MENU_MMD_REF_ID);
        needDisplayMenu = true;

    }

    function _showPreview() {
        visible = true;
        _currentDocChangedHandler();
    }

    function _exportHtml() {
        visible = true;
        _setPanelVisibility(true);
        var htmlReceived = function (bodyText) {
            //            bodyText= bodyText.replace(/[^a-z0-9\.\-\_\s\t]/ig, function (c) {
            //                return '&#' + c.charCodeAt(0) + ';';
            //            });

            var content = $('<div>').text(bodyText).html();
            $iframe.attr("srcdoc", content);

        };

        var doc = DocumentManager.getCurrentDocument().getText();
        var html = convertMarkdown(doc, htmlReceived);
    }

    function _showSyntaxRef() {
        visible = true;
        _setPanelVisibility(true);

        var path = ExtensionUtils.getModulePath(module, "node/node_modules/mmd/deps/MultiMarkdown-4/cheat-sheet/index.html");
        $iframe.removeAttr("srcdoc");
        $iframe.attr("src", path);
    }

    AppInit.appReady(function () {


        // Every step of communicating with node is asynchronous, and is
        // handled through jQuery promises. To make things simple, we
        // construct a series of helper functions and then chain their
        // done handlers together. Each helper function registers a fail
        // handler with its promise to report any errors along the way.


        // Helper function to connect to node
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[brackets-mmd-node] failed to connect to node");
            });

            $(connectionPromise).on("base.log", function (evt, level, timestamp, message) {
                console.log("[node] %s %s %s", level, timestamp, message);
            });

            return connectionPromise;
        }

        // Helper function that loads our domain into the node server
        function loadMmdDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/MmdDomaine");

            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function (a) {
                console.log("[brackets-mmd-node] failed to load domain" + a);
            });
            return loadPromise;
        }
        _currentDocChangedHandler();
        chain(connect, loadMmdDomain);

    });

    // Insert CSS for this extension
    ExtensionUtils.loadStyleSheet(module, "multimarkdownPreview.css");

    // Add a document change handler
    $(DocumentManager).on("currentDocumentChange", _currentDocChangedHandler);

    // currentDocumentChange is *not* called for the initial document. Use
    // appReady() to set initial state.

    //Register Menu

    CommandManager.register(Strings.MMD_CONTEXT_MENU_MMD_PREVIEW, MMD_CONTEXT_MENU_MMD_PREVIEW_ID, _showPreview);
    CommandManager.register(Strings.MMD_CONTEXT_MENU_EXPORT_HTML, MMD_CONTEXT_MENU_EXPORT_HTML_ID, _exportHtml);
    CommandManager.register(Strings.MMD_CONTEXT_MENU_MMD_REF, MMD_CONTEXT_MENU_MMD_REF_ID, _showSyntaxRef);

    // Listen for resize events
    $(PanelManager).on("editorAreaResize", _resizeIframe);
    $("#sidebar").on("panelCollapsed panelExpanded panelResizeUpdate", _resizeIframe);
});
