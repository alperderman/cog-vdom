//CognitiveJS VDOM

if (typeof window.CustomEvent !== 'function') { window.CustomEvent = function (event, params) { params = params || { bubbles: false, cancelable: false, detail: null }; var evt = document.createEvent('CustomEvent'); evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail); return evt; }; }

var cog = {};
cog.data = {};
cog.nodes = {};
cog.attrs = [];
cog.repeats = {};
cog.templates = {};
cog.bound = {};
cog.encapVar = null;
cog.cache = true;
cog.label = {
    head: "head",
    escape: "#",
    set: "cog-set",
    source: "cog-src",
    temp: "cog-temp",
    repeat: "cog-repeat",
    style: "cog-style",
    context: "cog-context",
    class: "cog-class",
    if: "cog-if",
    live: "cog-live",
    event: "cog-event",
    sourceAwait: "cog-await"
};
cog.event = {
    beforeData: "COGBeforeData",
    afterData: "COGAfterData",
    beforeRender: "COGBeforeRender",
    afterRender: "COGAfterRender"
};
cog.keyword = {
    parent: "_parent",
    key: "_key",
    count: "_count",
    token: "_token",
    prevent: "_prevent"
};
cog.token = {
    open: "{{",
    close: "}}",
    escape: "#"
};
cog.regex = {
    head: new RegExp("<head[^>]*>((.|[\\\n\\\r])*)<\\\/head>", "im"),
    body: new RegExp("<body[^>]*>((.|[\\\n\\\r])*)<\\\/body>", "im"),
    normalize: new RegExp("(?:\\\[\\\'|\\\[\\\"|\\\[)(\\\w+)(?:\\\'\\\]|\\\"\\\]|\\\])", "g"),
    token: new RegExp(cog.token.open + "[\\s\\S]*?" + cog.token.close, "g"),
    node: new RegExp("([\\s\\S]*?)(" + cog.token.open + "[\\s\\S]*?" + cog.token.close + ")", "gm")
};

cog.render = function (layoutSrc) {
    var layout;
    step_start();
    function step_start() {
        if (typeof layoutSrc === "string") {
            cog.xhr(layoutSrc, function (xhr) {
                if (xhr.status == 200) {
                    layout = xhr.responseText;
                    step_design();
                }
            }, { method: "GET" });
        } else {
            cog.set(null, null, {
                setElems: true,
                callback: function () {
                    if (cog.isElement(layoutSrc)) {
                        cog.bind(layoutSrc);
                    } else {
                        cog.bind();
                    }
                }
            });
        }
    }
    function step_design() {
        while (document.getElementsByTagName('script').length > 0) {
            document.getElementsByTagName('script')[0].parentNode.removeChild(document.getElementsByTagName('script')[0]);
        }
        if ((/\<\/head\>/).test(layout)) {
            document.head.innerHTML += layout.match(cog.regex.head)[1];
        }
        if ((/\<\/body\>/).test(layout)) {
            document.documentElement.innerHTML = document.documentElement.innerHTML.replace("<body", "<body" + layout.match("<body" + "(.*)" + ">")[1]);
            document.body.innerHTML += layout.match(cog.regex.body)[1];
        }
        if (!(/\<\/head\>/).test(layout) && !(/\<\/body\>/).test(layout)) {
            document.body.innerHTML += layout;
        }
        setTimeout(function () {
            cog.set(null, null, {
                setElems: true,
                callback: function () {
                    step_bind();
                }
            });
        }, 0);
    }
    function step_bind() {
        document.dispatchEvent(new CustomEvent(cog.event.beforeRender));
        setTimeout(function () {
            cog.bind(document.body, {
                callback: function () {
                    step_scripts();
                }
            });
        }, 0);
    }
    function step_scripts() {
        cog.loadScriptsNS(document.querySelectorAll("script"), function () {
            step_finish();
        });
    }
    function step_finish() {
        cog.DOMLoad();
        if (window.location.hash.slice(1) && document.getElementById(window.location.hash.slice(1))) {
            document.getElementById(window.location.hash.slice(1)).scrollIntoView();
        }
        setTimeout(function () {
            document.dispatchEvent(new CustomEvent(cog.event.afterRender));
        }, 0);
    }
};
cog.bind = function (dom, arg) {
    var i, ii, dommap, tempRender, tempNode, tempId, tempAttr, tempToken, tempAlias, repeatNode, repeatsArr, repeatsArrKey, repeatsArrNodes, repeatTemp, repeatAttr, repeatAttrToken, repeatAttrTokenArr, repeatAttrAlias, repeatAttrTemp, attrKey, attrVal, attrNode, attrContent, attrTokens, attrContentObj, cloneNode, tokens, token, tokenPure, tokenArr, tokenContent, tokenContents, tokenEscaped, i, nodeRegexMatches, nodeRegexString, nodeRegexMatch, newNode, newNodeLength;
    if (dom == null) {
        dom = document.body;
    }
    if (arg == null) {
        arg = {};
    }
    dommap = cog.createDOMMap(dom);

    cog.iterate(dommap, {
        obj: function (obj) {
            if (obj.hasOwnProperty("attrs")) {
                for (i = 0; i < obj.attrs.length; i++) {
                    attrKey = obj.attrs[i].attr;
                    attrVal = obj.attrs[i].value;

                    tokens = cog.removeDuplicatesFromArray(attrVal.match(cog.regex.token));
                    if (tokens.length > 0 || (attrKey == cog.label.style || attrKey == cog.label.context || attrKey == cog.label.class || attrKey == cog.label.if)) {
                        if (attrKey.substring(0, cog.label.escape.length) == cog.label.escape) {
                            obj.node.removeAttribute(attrKey);
                            attrKey = attrKey.substring(cog.label.escape.length, attrKey.length);
                        }
                        tokenContents = {};
                        for (ii = 0; ii < tokens.length; ii++) {
                            token = tokens[ii];
                            tokenPure = cog.normalizeKeys(token.substring(cog.token.open.length, token.length - cog.token.close.length));
                            tokenArr = tokenPure.split(".");
                            if (tokenPure.substring(0, cog.token.escape.length) != cog.token.escape) {
                                if (arg.token != null && arg.alias != null && tokenArr[0] == arg.alias) {
                                    tokenPure = arg.token + tokenPure.substring(arg.alias.length, tokenPure.length);
                                }
                                tokenContent = cog.getRecursiveValue({ str: tokenPure });
                                if (typeof tokenContent !== "undefined") {
                                    tokenContents[tokenPure] = tokenContent;
                                    if (!cog.nodes.hasOwnProperty(tokenPure)) {
                                        cog.nodes[tokenPure] = [];
                                    }
                                }
                            }

                        }
                        nodeRegexMatches = [];
                        nodeRegexString = "";
                        while (nodeRegexMatch = cog.regex.node.exec(attrVal)) {
                            if (nodeRegexMatch[1] != "") {
                                nodeRegexMatches.push(nodeRegexMatch[1]);
                                nodeRegexString = nodeRegexString + nodeRegexMatch[1];
                            }
                            tokenPure = cog.normalizeKeys(nodeRegexMatch[2].substring(cog.token.open.length, nodeRegexMatch[2].length - cog.token.close.length));
                            if (tokenPure.substring(0, cog.token.escape.length) == cog.token.escape) {
                                tokenEscaped = nodeRegexMatch[2].substring(0, cog.token.open.length) + nodeRegexMatch[2].substring(cog.token.open.length + cog.token.escape.length, nodeRegexMatch[2].length);
                                nodeRegexMatches.push(tokenEscaped);
                            } else {
                                nodeRegexMatches.push(nodeRegexMatch[2]);
                            }
                            nodeRegexString = nodeRegexString + nodeRegexMatch[2];
                        }
                        nodeRegexString = attrVal.replace(nodeRegexString, "");
                        if (nodeRegexString != "") {
                            nodeRegexMatches.push(nodeRegexString);
                        }
                        attrContent = document.createElement("span");
                        newNode = document.createDocumentFragment();
                        attrTokens = [];
                        for (ii = 0; ii < nodeRegexMatches.length; ii++) {
                            tokenPure = cog.normalizeKeys(nodeRegexMatches[ii].substring(cog.token.open.length, nodeRegexMatches[ii].length - cog.token.close.length));
                            tokenArr = tokenPure.split(".");
                            if (arg.token != null && arg.alias != null && tokenArr[0] == arg.alias) {
                                tokenPure = arg.token + tokenPure.substring(arg.alias.length, tokenPure.length);
                            }
                            if (tokenContents.hasOwnProperty(tokenPure)) {
                                newNodeLength = cog.nodes[tokenPure].push(document.createTextNode(tokenContents[tokenPure]));
                                newNode.appendChild(cog.nodes[tokenPure][newNodeLength - 1]);
                                attrTokens.push(tokenPure);
                            } else {
                                newNode.appendChild(document.createTextNode(nodeRegexMatches[ii]));
                            }
                        }
                        attrContent.appendChild(newNode);
                        if (attrKey == cog.label.style) {
                            attrContentObj = cog.cssToObj(attrContent.innerHTML);
                            if (typeof attrContentObj === "object" && !Array.isArray(attrContentObj)) {
                                for (ii = 0; ii < Object.keys(attrContentObj).length; ii++) {
                                    obj.node.style[Object.keys(attrContentObj)[ii]] = attrContentObj[Object.keys(attrContentObj)[ii]];
                                }
                                cog.attrs.push({ node: obj.node, type: "style", content: attrContent, tokens: attrTokens });
                            }
                            obj.node.removeAttribute(attrKey);
                        } else if (attrKey == cog.label.context) {
                            attrContentObj = cog.strToObj(attrContent.innerHTML);
                            if (typeof attrContentObj === "object" && !Array.isArray(attrContentObj)) {
                                for (ii = 0; ii < Object.keys(attrContentObj).length; ii++) {
                                    obj.node[Object.keys(attrContentObj)[ii]] = attrContentObj[Object.keys(attrContentObj)[ii]];
                                }
                                cog.attrs.push({ node: obj.node, type: "context", content: attrContent, tokens: attrTokens });
                            }
                            obj.node.removeAttribute(attrKey);
                        } else if (attrKey == cog.label.class) {
                            attrContentObj = attrContent.innerHTML.trim().split(" ");
                            for (ii = 0; ii < attrContentObj.length; ii++) {
                                if (attrContentObj[ii] != null) {
                                    obj.node.classList.add(attrContentObj[ii]);
                                }
                            }
                            cog.attrs.push({ node: obj.node, type: "class", content: attrContent, tokens: attrTokens, old: attrContentObj });
                            obj.node.removeAttribute(attrKey);
                        } else if (attrKey == cog.label.if) {
                            attrContentObj = attrContent.innerHTML;
                            if (cog.if(attrContentObj)) {
                                obj.node.style.display = "";
                            } else {
                                obj.node.style.display = "none";
                            }
                            cog.attrs.push({ node: obj.node, type: "if", content: attrContent, tokens: attrTokens });
                            obj.node.removeAttribute(attrKey);
                        } else {
                            attrNode = document.createAttribute(attrKey);
                            attrNode.value = attrContent.innerHTML;
                            obj.node.setAttribute(attrKey, attrContent.innerHTML);
                            cog.attrs.push({ node: obj.node, type: "attr", attr: attrKey, content: attrContent, tokens: attrTokens });
                        }
                    }
                }
            }
            if (obj.hasOwnProperty("type") && obj.type == "text" && !obj.isSVG) {
                tokens = cog.removeDuplicatesFromArray(obj.content.match(cog.regex.token));
                if (tokens.length > 0) {
                    tokenContents = {};
                    for (i = 0; i < tokens.length; i++) {
                        token = tokens[i];
                        tokenPure = cog.normalizeKeys(token.substring(cog.token.open.length, token.length - cog.token.close.length));
                        tokenArr = tokenPure.split(".");
                        if (tokenPure.substring(0, cog.token.escape.length) != cog.token.escape) {
                            if (arg.token != null && arg.alias != null && tokenArr[0] == arg.alias) {
                                tokenPure = arg.token + tokenPure.substring(arg.alias.length, tokenPure.length);
                            }
                            tokenContent = cog.getRecursiveValue({ str: tokenPure });
                            if (typeof tokenContent !== "undefined") {
                                tokenContents[tokenPure] = tokenContent;
                                if (!cog.nodes.hasOwnProperty(tokenPure) && !cog.isElement(tokenContent)) {
                                    cog.nodes[tokenPure] = [];
                                }
                            }
                        }
                    }
                    nodeRegexMatches = [];
                    nodeRegexString = "";
                    while (nodeRegexMatch = cog.regex.node.exec(obj.content)) {
                        if (nodeRegexMatch[1] != "") {
                            nodeRegexMatches.push(nodeRegexMatch[1]);
                            nodeRegexString = nodeRegexString + nodeRegexMatch[1];
                        }

                        tokenPure = cog.normalizeKeys(nodeRegexMatch[2].substring(cog.token.open.length, nodeRegexMatch[2].length - cog.token.close.length));
                        if (tokenPure.substring(0, cog.token.escape.length) == cog.token.escape) {
                            tokenEscaped = nodeRegexMatch[2].substring(0, cog.token.open.length) + nodeRegexMatch[2].substring(cog.token.open.length + cog.token.escape.length, nodeRegexMatch[2].length);
                            nodeRegexMatches.push(tokenEscaped);
                        } else {
                            nodeRegexMatches.push(nodeRegexMatch[2]);
                        }
                        nodeRegexString = nodeRegexString + nodeRegexMatch[2];
                    }
                    nodeRegexString = obj.content.replace(nodeRegexString, "");
                    if (nodeRegexString != "") {
                        nodeRegexMatches.push(nodeRegexString);
                    }
                    newNode = document.createDocumentFragment();
                    for (i = 0; i < nodeRegexMatches.length; i++) {
                        tokenPure = cog.normalizeKeys(nodeRegexMatches[i].substring(cog.token.open.length, nodeRegexMatches[i].length - cog.token.close.length));
                        tokenArr = tokenPure.split(".");
                        if (arg.token != null && arg.alias != null && tokenArr[0] == arg.alias) {

                            tokenPure = arg.token + tokenPure.substring(arg.alias.length, tokenPure.length);
                        }
                        if (tokenContents.hasOwnProperty(tokenPure)) {
                            if (!cog.isElement(tokenContents[tokenPure])) {
                                newNodeLength = cog.nodes[tokenPure].push(document.createTextNode(tokenContents[tokenPure]));
                                newNode.appendChild(cog.nodes[tokenPure][newNodeLength - 1]);
                            } else {
                                cloneNode = cog.bind(tokenContents[tokenPure].cloneNode(true));

                                newNode.appendChild(cloneNode);
                            }
                        } else {
                            newNode.appendChild(document.createTextNode(nodeRegexMatches[i]));
                        }
                    }
                    obj.node.parentNode.replaceChild(newNode, obj.node);
                }
            }
        }
    });
    while (tempNode = document.querySelector("[" + cog.label.temp + "]")) {
        tempAttr = tempNode.getAttribute(cog.label.temp).split(",");
        tempId = cog.normalizeKeys(tempAttr[0].trim())
        tempToken = cog.normalizeKeys(tempAttr[1].trim());
        tempAlias = cog.normalizeKeys(tempAttr[2].trim());
        tempNode.removeAttribute(cog.label.temp);
        if (cog.templates.hasOwnProperty(tempId)) {
            tempRender = cog.template({ id: tempId, data: tempToken + "," + tempAlias });
            tempNode.parentNode.replaceChild(tempRender, tempNode);
        }
    }
    while (repeatNode = document.querySelector("[" + cog.label.repeat + "]")) {
        repeatAttr = repeatNode.getAttribute(cog.label.repeat).split(",");
        repeatAttrToken = cog.normalizeKeys(repeatAttr[0].trim());
        repeatAttrTokenArr = cog.getRecursiveValue({ str: repeatAttrToken });
        repeatAttrAlias = repeatAttr[1].trim();
        repeatAttrTemp = repeatAttr[2].trim();
        repeatNode.removeAttribute(cog.label.repeat);
        if (!cog.templates.hasOwnProperty(repeatAttrTemp)) {
            cog.template({ id: repeatAttrTemp, elem: repeatNode });
        }
        repeatNode.innerHTML = "";
        if (Array.isArray(repeatAttrTokenArr)) {
            repeatsArr = [];
            for (i = 0; i < repeatAttrTokenArr.length; i++) {
                repeatsArrNodes = [];
                repeatTemp = cog.template({ id: repeatAttrTemp, data: repeatAttrToken + "." + i + "," + repeatAttrAlias, fragment: true });
                for (ii = 0; ii < repeatTemp.childNodes.length; ii++) {
                    repeatsArrNodes.push(repeatTemp.childNodes[ii]);
                }
                repeatsArr.push(repeatsArrNodes);
            }
            if (!cog.repeats.hasOwnProperty(repeatAttrToken)) {
                cog.repeats[repeatAttrToken] = [];
            }
            repeatsArrKey = cog.repeats[repeatAttrToken].push({ nodes: repeatsArr, parent: repeatNode, token: repeatAttrToken, alias: repeatAttrAlias, temp: repeatAttrTemp }) - 1;
            for (i = 0; i < cog.repeats[repeatAttrToken][repeatsArrKey].nodes.length; i++) {
                for (ii = 0; ii < cog.repeats[repeatAttrToken][repeatsArrKey].nodes[i].length; ii++) {
                    repeatNode.appendChild(cog.repeats[repeatAttrToken][repeatsArrKey].nodes[i][ii]);
                }
            }
        }
    }
    if (typeof arg.callback === 'function') {
        arg.callback();
    }
    return dom;
};
cog.rebind = function (key) {
    var token = cog.normalizeKeys(key), i, ii, iii, newNode, content = cog.getRecursiveValue({ str: token }), attrContentObj, repeatTemp, repeatsArrNodes, repeatsLength;
    if (cog.nodes.hasOwnProperty(token)) {
        for (i = 0; i < cog.nodes[token].length; i++) {
            if (cog.nodes[token][i].textContent != content) {
                newNode = document.createTextNode(content);
                cog.nodes[token][i].parentNode.replaceChild(newNode, cog.nodes[token][i]);
                cog.nodes[token][i] = newNode;
            }
        }
        for (i = 0; i < cog.attrs.length; i++) {
            for (ii = 0; ii < cog.attrs[i].tokens.length; ii++) {
                if (token == cog.attrs[i].tokens[ii]) {
                    if (cog.attrs[i].type == "attr" && cog.attrs[i].node.getAttribute(cog.attrs[i].attr) != cog.attrs[i].content.innerHTML) {
                        cog.attrs[i].node.setAttribute(cog.attrs[i].attr, cog.attrs[i].content.innerHTML);
                    } else if (cog.attrs[i].type == "style") {
                        attrContentObj = cog.cssToObj(cog.attrs[i].content.innerHTML);
                        if (typeof attrContentObj === "object" && !Array.isArray(attrContentObj)) {
                            for (iii = 0; iii < Object.keys(attrContentObj).length; iii++) {
                                if (attrContentObj[Object.keys(attrContentObj)[iii]] != cog.attrs[i].node.style[Object.keys(attrContentObj)[iii]]) {
                                    cog.attrs[i].node.style[Object.keys(attrContentObj)[iii]] = attrContentObj[Object.keys(attrContentObj)[iii]];
                                }
                            }
                        }
                    } else if (cog.attrs[i].type == "context") {
                        attrContentObj = cog.strToObj(cog.attrs[i].content.innerHTML);
                        if (typeof attrContentObj === "object" && !Array.isArray(attrContentObj)) {
                            for (iii = 0; iii < Object.keys(attrContentObj).length; iii++) {
                                if (attrContentObj[Object.keys(attrContentObj)[iii]] != cog.attrs[i].node[Object.keys(attrContentObj)[iii]]) {
                                    cog.attrs[i].node[Object.keys(attrContentObj)[iii]] = attrContentObj[Object.keys(attrContentObj)[iii]];
                                }
                            }
                        }
                    } else if (cog.attrs[i].type == "class") {
                        attrContentObj = cog.attrs[i].content.innerHTML.trim().split(" ");
                        for (iii = 0; iii < cog.attrs[i].old.length; iii++) {
                            if (cog.attrs[i].old[iii] != null) {
                                cog.attrs[i].node.classList.remove(cog.attrs[i].old[iii]);
                            }
                        }
                        for (iii = 0; iii < attrContentObj.length; iii++) {
                            if (attrContentObj[iii] != null) {
                                cog.attrs[i].node.classList.add(attrContentObj[iii]);
                            }
                        }
                        cog.attrs[i].old = attrContentObj;
                    } else if (cog.attrs[i].type == "if") {
                        attrContentObj = cog.attrs[i].content.innerHTML;
                        if (cog.if(attrContentObj)) {
                            cog.attrs[i].node.style.display = "";
                        } else {
                            cog.attrs[i].node.style.display = "none";
                        }
                    }
                }
            }
        }
    }
    if (cog.repeats.hasOwnProperty(token) && cog.repeats[token][0].nodes.length != content.length) {
        repeatsLength = cog.repeats[token][0].nodes.length;
        if (cog.repeats[token][0].nodes.length > content.length) {
            for (i = 0; i < cog.repeats[token].length; i++) {
                for (ii = content.length; ii < cog.repeats[token][i].nodes.length; ii++) {
                    for (iii = 0; iii < cog.repeats[token][i].nodes[ii].length; iii++) {
                        cog.repeats[token][i].nodes[ii][iii].parentNode.removeChild(cog.repeats[token][i].nodes[ii][iii]);
                    }
                }
                cog.repeats[token][i].nodes.splice(content.length, repeatsLength - content.length);
            }
        } else {
            for (i = 0; i < cog.repeats[token].length; i++) {
                for (ii = cog.repeats[token][i].nodes.length; ii < content.length; ii++) {
                    repeatsArrNodes = [];
                    repeatTemp = cog.template({ id: cog.repeats[token][i].temp, data: cog.repeats[token][i].token + "." + ii + "," + cog.repeats[token][i].alias, fragment: true });
                    for (iii = 0; iii < repeatTemp.childNodes.length; iii++) {
                        repeatsArrNodes.push(repeatTemp.childNodes[iii]);
                    }
                    cog.repeats[token][i].nodes.push(repeatsArrNodes);
                }
                for (ii = repeatsLength; ii < cog.repeats[token][i].nodes.length; ii++) {
                    for (iii = 0; iii < cog.repeats[token][i].nodes[ii].length; iii++) {
                        cog.repeats[token][i].parent.appendChild(cog.repeats[token][i].nodes[ii][iii]);
                    }
                }
            }
        }
    }
    for (i = 0; i < Object.keys(cog.nodes).length; i++) {
        if (token != cog.normalizeKeys(Object.keys(cog.nodes)[i]) && cog.checkKeys(token, Object.keys(cog.nodes)[i])) {
            cog.rebind(Object.keys(cog.nodes)[i]);
        }
    }
    rebound();
    cog.collectGarbage();
    function rebound() {
        var i, ii, rebindKey, boundKeys, boundKey;
        for (i = 0; i < Object.keys(cog.bound).length; i++) {
            rebindKey = Object.keys(cog.bound)[i];
            boundKeys = cog.bound[rebindKey];
            if (typeof boundKeys === 'string') {
                boundKey = boundKeys;
                if (token != cog.normalizeKeys(rebindKey) && cog.checkKeys(token, boundKey)) {
                    cog.rebind(rebindKey);
                }
            } else if (Array.isArray(boundKeys)) {
                for (ii = 0; ii < boundKeys.length; ii++) {
                    boundKey = boundKeys[ii];
                    if (token != cog.normalizeKeys(rebindKey) && cog.checkKeys(token, boundKey)) {
                        cog.rebind(rebindKey);
                        break;
                    }
                }
            }
        }
    }
};
cog.collectGarbage = function () {
    var i, ii, iii, excludeAttrs = [], checkAttr, removeRepeats = [], removeAttrs = [], removeNodes = [], removeNode;
    for (i = 0; i < Object.keys(cog.repeats).length; i++) {
        for (ii = 0; ii < cog.repeats[Object.keys(cog.repeats)[i]].length; ii++) {
            if (!document.body.contains(cog.repeats[Object.keys(cog.repeats)[i]][ii].parent)) {
                removeRepeats.push({ k: i, kk: ii });
            }
        }
    }
    for (i = removeRepeats.length - 1; i >= 0; i--) {
        cog.repeats[Object.keys(cog.repeats)[removeRepeats[i].k]].splice(removeRepeats[i].kk, 1);
        if (cog.repeats[Object.keys(cog.repeats)[removeRepeats[i].k]].length == 0) {
            delete cog.repeats[Object.keys(cog.repeats)[removeRepeats[i].k]];
        }
    }
    for (i = 0; i < cog.attrs.length; i++) {
        checkAttr = cog.attrs[i].node;
        if (!document.body.contains(checkAttr)) {
            cog.attrs[i].content.innerHTML = "";
            removeAttrs.push(i);
        } else {
            excludeAttrs.push(cog.attrs[i].content);
        }
    }
    for (i = removeAttrs.length - 1; i >= 0; i--) {
        cog.attrs.splice(removeAttrs[i], 1);
    }
    for (i = 0; i < Object.keys(cog.nodes).length; i++) {
        for (ii = 0; ii < cog.nodes[Object.keys(cog.nodes)[i]].length; ii++) {
            if (!document.body.contains(cog.nodes[Object.keys(cog.nodes)[i]][ii].parentNode)) {
                removeNode = true;
                for (iii = 0; iii < excludeAttrs.length; iii++) {
                    if (cog.nodes[Object.keys(cog.nodes)[i]][ii].parentNode === excludeAttrs[iii]) {
                        removeNode = false;
                        break;
                    }
                }
                if (removeNode) {
                    removeNodes.push({ k: Object.keys(cog.nodes)[i], kk: ii });
                }
            }
        }
        if (cog.nodes[Object.keys(cog.nodes)[i]].length == 0) {
            delete cog.nodes[Object.keys(cog.nodes)[i]];
        }
    }
    for (i = removeNodes.length - 1; i >= 0; i--) {
        cog.nodes[removeNodes[i].k].splice(removeNodes[i].kk, 1);
        if (cog.nodes[removeNodes[i].k].length == 0) {
            delete cog.nodes[removeNodes[i].k];
        }
    }
};
cog.getElementAllEvents = function (elem) {
    var elemLives = [], elemEvents = [];
    if (elem.getAttribute(cog.label.live) != null) {
        elemLives = (cog.strToObj(elem.getAttribute(cog.label.live), "array"));
    }
    if (elem.getAttribute(cog.label.event) != null) {
        elemEvents = (cog.strToObj(elem.getAttribute(cog.label.event), "array"));
    }
    return elemLives.concat(elemEvents);
};
cog.eventListener = function (event) {
    cog.eventHandler(event);
};
cog.eventHandler = function (event, elem) {
    if (!elem) { elem = event.target; }
    if (typeof elem.getAttribute !== 'function') { return; }
    var elemAllEvents = cog.getElementAllEvents(elem), prevent = false;
    if (elemAllEvents.length > 0) {

        elemAllEvents.forEach(function (obj) {

            if (obj.hasOwnProperty("live")) {
                if (!obj.hasOwnProperty("event")) {
                    obj.event = "change";
                }
                if (!obj.hasOwnProperty("data")) {
                    obj.data = "value";
                }
                if (obj.event == event.type) {
                    cog.set(obj.live, elem[obj.data]);
                }
            } else {
                Object.keys(obj).forEach(function (e) {
                    if (e == event.type) {
                        cog.get(obj[e])(event);
                    }
                });
            }
            if (obj.hasOwnProperty(cog.keyword.prevent) && cog.if(obj[cog.keyword.prevent])) {
                prevent = true;
            }
        });
    }
    if (!prevent && elem.parentNode) {
        cog.eventHandler(event, elem.parentNode);
    }
};
cog.addEventListenerAll = function (target, listener, capture) {
    if (capture == null) { capture = false; }
    for (var key in target) {
        if (/^on/.test(key)) {
            target.addEventListener(key.substr(2), listener, capture);
        }
    }
};
cog.template = function (arg) {
    var template, createEl, token, alias;
    if (arg.id == null) { return; }
    if (arg.fragment == null) { arg.fragment = false; }
    if (cog.templates[arg.id] == null && arg.elem != null) {
        if (typeof arg.elem === 'string') {
            createEl = document.createElement("div");
            createEl.innerHTML = arg.elem;
            cog.templates[arg.id] = createEl.cloneNode(true);
        } else {
            cog.templates[arg.id] = arg.elem.cloneNode(true);
        }
    }
    if (cog.templates[arg.id] != null) {
        template = cog.templates[arg.id].cloneNode(true);
    }
    if (arg.data != null && template != null) {
        token = cog.normalizeKeys(arg.data.split(",")[0].trim());
        alias = arg.data.split(",")[1].trim();
        cog.bind(template, { token: token, alias: alias });
    }
    if (arg.fragment) {
        template = cog.elemFragment(template);
    }
    return template;
};
cog.cssToObj = function (css) {
    var obj = {}, s = css.toLowerCase().replace(/-(.)/g, function (m, g) {
        return g.toUpperCase();
    }).replace(/;\s?$/g, "").split(/:|;/g);
    for (var i = 0; i < s.length; i += 2)
        obj[s[i].replace(/\s/g, "")] = s[i + 1].replace(/^\s+|\s+$/g, "");
    return obj;
};
cog.strToObj = function (json, type) {
    fixedJSON = json.trim();
    if (fixedJSON.indexOf("{") !== 0) {
        fixedJSON = "{" + fixedJSON + "}";
    }
    if (type == "array") {
        fixedJSON = "[" + fixedJSON + "]";
    }
    var fixedJSON = fixedJSON
        .replace(/'/g, '"')
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/([{\[,])\s*$/, '$1')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
        .replace(/\\\"/g, '"');
    return JSON.parse(fixedJSON);
};
cog.get = function (key, arg) {
    if (key == null) { return; }
    if (arg == null) { arg = {}; }
    if (arg.action == null) { arg.action = "get"; }
    if (arg.reference == null) { arg.reference = false; }
    if (arg.execute == null) { arg.execute = false; }
    var result, old, alter = false;
    if (typeof arg.replace === 'function') {
        alter = true;
    }
    if (arg.action == "get") {
        result = cog.getRecursiveValue({ str: key, ref: arg.reference, exec: arg.execute });
    }
    if (arg.action == "set" || alter) {
        if (old !== arg.set || alter) {
            if (alter) {
                result = arg.replace({ act: arg.action, str: key, val: arg.set, ref: arg.reference, exec: arg.execute });
            } else {
                result = cog.getRecursiveValue({ act: arg.action, str: key, val: arg.set, ref: arg.reference, exec: arg.execute });
            }
            cog.rebind(key);
            document.dispatchEvent(new CustomEvent(cog.event.afterData, { detail: { key: key, old: old, new: result } }));
        } else {
            result = old;
        }
    }
    if (typeof arg.callback === 'function') {
        arg.callback({ key: key, old: old, new: result });
    }
    return result;
};
cog.set = function (key, set, arg) {
    if (arg == null) { arg = {}; }
    if (arg.alter == null) { arg.alter = false; }
    if (arg.setElems == null) { arg.setElems = false; }
    if (arg.setElems) {
        cog.loadContents(function () {
            var setElem, setAttr, setType, setKey, i, links = document.getElementsByTagName("link"), link, heads = document.querySelectorAll("[" + cog.label.head + "]"), head;
            while (setElem = document.querySelector("[" + cog.label.set + "]")) {
                setAttr = setElem.getAttribute(cog.label.set);
                setType = cog.parseSet(setAttr)[0];
                setKey = cog.parseSet(setAttr)[1].trim();
                if (setType == "json") {
                    propData = cog.isJSON(setElem.innerText);
                    if (propData) {
                        cog.getRecursiveValue({ act: "set", str: setKey, val: propData });
                    }
                }
                if (setType == "raw") {
                    propData = cog.eval("(" + setElem.innerText + ")");
                    cog.getRecursiveValue({ act: "set", str: setKey, val: propData, exec: false });
                }
                if (setType == "text") {
                    cog.getRecursiveValue({ act: "set", str: setKey, val: setElem.innerText });
                }
                if (setType == "html") {
                    cog.getRecursiveValue({ act: "set", str: setKey, val: setElem.innerHTML });
                }
                if (setType == "temp") {
                    cog.template({ id: setKey, elem: setElem });
                }
                setElem.parentNode.removeChild(setElem);
            }
            for (i = 0; i < links.length; i++) {
                link = links[i];
                document.head.appendChild(link);
                link.href = link.href;
            }
            for (i = 0; i < heads.length; i++) {
                head = heads[i];
                head.removeAttribute("head");
                document.head.appendChild(head);
            }
            if (typeof arg.callback === 'function') {
                arg.callback();
            }
        });
    } else if (arg.alter && typeof set === 'function') {
        cog.get(key, {
            action: "set",
            set: set,
            callback: arg.callback,
            replace: function (argReplace) {
                var result = cog.getRecursiveValue({ str: argReplace.str, exec: false });
                var replace = set(result);
                if (replace !== result) {
                    argReplace.val = replace;
                    result = cog.getRecursiveValue(argReplace);
                }
                return result;
            }
        });
    } else {
        cog.get(key, {
            action: "set",
            set: set,
            callback: arg.callback
        });
    }
};
cog.alter = function (key, set, arg) {
    if (arg == null) { arg = {}; }
    arg.alter = true;
    cog.set(key, set, arg);
};
cog.iterate = function (obj, arg) {
    if (arg == null) {
        arg = {};
    }
    if (arg.obj == null) {
        arg.obj = false;
    }
    if (arg.item == null) {
        arg.item = false;
    }
    var stack = [obj];
    var _loop = function _loop() {
        var currentObj = stack.pop();
        if (typeof arg.obj === "function") {
            arg.obj(currentObj);
        }
        Object.keys(currentObj).forEach(function (key) {
            if (typeof arg.item === "function") {
                arg.item(key, currentObj[key]);
            }
            if (typeof currentObj[key] === "object" && currentObj[key] !== null) {
                stack.push(currentObj[key]);
            }
        });
    };
    while ((stack === null || stack === void 0 ? void 0 : stack.length) > 0) {
        _loop();
    }
};
cog.getAttributes = function (attributes) {
    return Array.prototype.map.call(attributes, function (attribute) {
        return {
            attr: attribute.name,
            value: attribute.value
        };
    });
};
cog.createDOMMap = function (element, isSVG) {
    return Array.prototype.map.call(element.childNodes, (function (node) {
        var details = {
            content: node.childNodes && node.childNodes.length > 0 ? null : node.textContent,
            attrs: node.nodeType !== 1 ? [] : cog.getAttributes(node.attributes),
            type: node.nodeType === 3 ? 'text' : (node.nodeType === 8 ? 'comment' : node.tagName.toLowerCase()),
            node: node
        };
        details.isSVG = isSVG || details.type === 'svg';
        details.children = cog.createDOMMap(node, details.isSVG);
        return details;
    }));
};
cog.getRecursiveValue = function (arg) {
    if (arg == null) { arg = {}; }
    if (arg.act == null) {
        if (typeof arg.val !== 'undefined') {
            arg.act = "set";
        } else {
            arg.act = "get";
        }
    }
    if (arg.root == null) { arg.root = cog.data; }
    if (arg.ref == null) { arg.ref = true; }
    if (arg.exec == null) { arg.exec = true; }
    var refData = arg.root, result, i, key;
    if (typeof arg.str === 'string') {
        strSplit = cog.normalizeKeys(arg.str).split(".");
    } else {
        strSplit = arg.str;
    }
    for (i = 0; i < strSplit.length; i++) {
        key = strSplit[i];
        if ((typeof refData === 'object' || typeof refData === 'string') && refData[key] != null && i != strSplit.length - 1 && i != arg.index) {
            refData = refData[key];
            if (typeof refData === 'function') {
                refData = refData();
            }
        } else {
            if (key == cog.keyword.parent) {
                strSplit.splice(i, 1);
                strSplit.splice(i - 1, 1);
                i = i - 2;
                arg.index = i;
                arg.str = strSplit;
                refData = cog.getRecursiveValue(arg);
                result = refData;
            } else if (key == cog.keyword.key) {
                result = strSplit[i - 1];
            } else if (key == cog.keyword.token) {
                strSplit.splice(i, 1);
                result = cog.normalizeKeys(strSplit);
            } else if (key == cog.keyword.count) {
                if (typeof refData === 'object' && !Array.isArray(refData)) {
                    result = Object.keys(refData).length;
                } else {
                    result = refData.length;
                }
            } else {
                if (arg.act === "set" && refData[key] !== arg.val) {
                    document.dispatchEvent(new CustomEvent(cog.event.beforeData, { detail: { key: arg.str, old: refData[key], new: arg.val } }));
                    refData[key] = arg.val;
                }
                result = refData[key];
                break;
            }
        }
    }
    if (typeof result === 'function' && arg.exec) {
        result = result();
    }
    if (typeof result === 'object' && !arg.ref) {
        result = JSON.parse(JSON.stringify(result));
    }
    return result;
};
cog.normalizeKeys = function (val) {
    var result;
    if (typeof val === 'string') {
        result = val.replace(cog.regex.normalize, function (m1, m2) { return "." + m2; });
        result = result.replace(/^\./, '');
    }
    if (Array.isArray(val)) {
        result = "";
        val.forEach(function (key, i) {
            if (i == 0) {
                result += key;
            } else {
                result += "." + key;
            }
        });
    }
    return result;
};
cog.checkKeys = function (key1, key2) {
    var result = false, i, keys1, keys2, keysLong, keyShort, keyLong = "";
    key1 = cog.normalizeKeys(key1);
    key2 = cog.normalizeKeys(key2);
    if (key1 == key2) { return true; }
    keys1 = key1.split(".");
    keys2 = key2.split(".");
    if (keys1.length == keys2.length) { return false; }
    if (keys1.length > keys2.length) {
        keysLong = keys1;
        keyShort = key2;
    } else {
        keysLong = keys2;
        keyShort = key1;
    }
    for (i = 0; i < keysLong.length; i++) {
        if (i == 0) {
            keyLong += keysLong[i];
        } else {
            keyLong += "." + keysLong[i];
        }
        if (keyLong == keyShort) {
            result = true;
            break;
        }
    }
    return result;
};
cog.parseSet = function (str) {
    return str.split(":");
};
cog.elemFragment = function (elem) {
    var fragment = document.createDocumentFragment();
    while (elem.firstChild) {
        fragment.appendChild(elem.firstChild);
    }
    return fragment;
};
cog.encapEval = function () {
    try { return eval(cog.encapVar); } catch (e) { }
};
cog.if = function (str) {
    if (typeof str === 'string') {
        cog.encapVar = str;
        if (cog.encapEval()) {
            return true;
        } else {
            return false;
        }
    } else {
        return str;
    }
};
cog.eval = function (str) {
    cog.encapVar = str;
    return cog.encapEval();
};
cog.init = function () {
    cog.addEventListenerAll(document.documentElement, cog.eventListener);
};
cog.isElement = function (elem) {
    return elem instanceof Element || elem instanceof HTMLDocument;
};
cog.isJSON = function (str) {
    var o;
    try {
        o = JSON.parse(str);
        if (o && typeof o === "object") {
            return o;
        }
    }
    catch (e) { }
    return false;
};
cog.removeDuplicatesFromArray = function (arr) {
    var m = {}, newArr = [], i, v;
    if (arr) {
        for (i = 0; i < arr.length; i++) {
            v = arr[i];
            if (!m[v] && v != "") {
                newArr.push(v);
                m[v] = true;
            }
        }
    }
    return newArr;
};
cog.loadContents = function (callback) {
    var node, srcObj;
    node = document.querySelector("[" + cog.label.source + "]:not([" + cog.label.sourceAwait + "])");
    if (node) {
        srcObj = cog.strToObj(node.getAttribute(cog.label.source));
        if (srcObj == null) {
            srcObj = {};
        }
        if (srcObj.cache != null) {
            if (srcObj.cache != 'false') {
                srcObj.cache = true;
            } else {
                srcObj.cache = false;
            }
        }
        if (srcObj.url != null) {
            node.setAttribute(cog.label.sourceAwait, "");
            cog.xhr(srcObj.url, function (xhr) {
                if (xhr.status == 200) {
                    node.outerHTML = xhr.responseText;
                }
            }, { method: srcObj.method, data: srcObj.data, type: srcObj.type, cache: srcObj.cache });
            cog.loadContents(callback);
        }
    } else {
        if (typeof callback === 'function') {
            if (!document.querySelector("[" + cog.label.sourceAwait + "]")) {
                callback();
            } else {
                setTimeout(function () {
                    cog.loadContents(callback);
                }, 10);
            }
        }
    }
};
cog.loadScriptsNS = function (node, callback, i) {
    if (node == null) { node = document.getElementsByTagName("script"); }
    if (i == null) { i = 0; }
    var len = node.length;
    if (len > 0 && i < len) {
        if (node[i].type != "text/html") {
            if (node[i].src) {
                cog.getScript(node[i].src, function () {
                    i++;
                    cog.loadScriptsNS(node, callback, i);
                });
            } else {
                cog.DOMEval(node[i].text);
                i++;
                cog.loadScriptsNS(node, callback, i);
            }
        } else {
            i++;
            cog.loadScriptsNS(node, callback, i);
        }
    } else {
        if (typeof callback === 'function') {
            callback();
        }
    }
};
cog.getUrlParams = function (url) {
    var i, result = {}, queryString, keyValuePairs, keyValuePair, paramName, paramValue;
    queryString = query_string();
    if (queryString) {
        keyValuePairs = queryString.split('&');
        for (i = 0; i < keyValuePairs.length; i++) {
            keyValuePair = keyValuePairs[i].split('=');
            paramName = keyValuePair[0];
            if (keyValuePair[1]) {
                paramValue = keyValuePair[1];
            } else {
                paramValue = '';
            }
            result[paramName] = decodeURIComponent(paramValue.replace(/\+/g, ' '));
        }
    }
    function query_string() {
        var reducedUrl, queryString;
        reducedUrl = url.split('#')[0];
        queryString = reducedUrl.split('?')[1];
        if (!queryString) {
            if (reducedUrl.search('=') !== false) {
                queryString = reducedUrl;
            }
        }
        return queryString
    }
    return result;
};
cog.urlEncode = function (obj) {
    var key, result;
    if (typeof obj === 'object') {
        result = [];
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                result.push(key + '=' + encodeURIComponent(obj[key]));
            }
        }
        result = result.join('&');
    } else {
        result = obj;
    }
    return result;
};
cog.xhr = function (url, callback, arg) {
    if (arg == null) { arg = {}; }
    if (arg.cache == null) { arg.cache = cog.cache; }
    if (arg.method == null) { arg.method = 'GET'; }
    if (arg.type == null) { arg.type = ''; }
    if (arg.data == null) { arg.data = ''; }
    if (arg.async == null) { arg.async = true; }
    var xhr, guid, cacheUrl, hashUrl, key, mergedObj, urlObj;
    arg.method = arg.method.toUpperCase();
    xhr = new XMLHttpRequest();
    xhr.responseType = arg.type;
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            callback(xhr);
        }
    };
    if (arg.method == 'GET' && !arg.cache) {
        guid = Date.now();
        cacheUrl = url.replace(/#.*$/, "");
        hashUrl = url.slice(cacheUrl.length);
        cacheUrl = cacheUrl.replace(/([?&])_=[^&]*/, function (m1, m2) { return m2; });
        hashUrl = ((/\?/).test(cacheUrl) ? "&" : "?") + "_=" + (guid++) + hashUrl;
        url = cacheUrl + hashUrl;
    }
    if (arg.method == 'GET' && arg.data != '') {
        mergedObj = {};
        urlObj = cog.getUrlParams(url);
        for (key in urlObj) { mergedObj[key] = urlObj[key]; }
        for (key in arg.data) { mergedObj[key] = arg.data[key]; }
        url = url.split(/[?#]/)[0] + '?' + cog.urlEncode(mergedObj);
    }
    xhr.open(arg.method, url, arg.async);
    if (arg.method == 'GET') {
        xhr.send();
    } else {
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(cog.urlEncode(arg.data));
    }
};
cog.DOMLoad = function () {
    document.dispatchEvent(new CustomEvent('DOMContentLoaded'));
    window.dispatchEvent(new CustomEvent('DOMContentLoaded'));
    window.dispatchEvent(new CustomEvent('load'));
};
cog.DOMEval = function (code) {
    var script;
    script = document.createElement("script");
    script.text = code;
    document.head.appendChild(script).parentNode.removeChild(script);
};
cog.getScript = function (url, callback) {
    cog.xhr(url, function (xhr) {
        if (xhr.status == 200) {
            cog.DOMEval(xhr.responseText);
        }
        if (typeof callback === 'function') {
            setTimeout(function () {
                callback(xhr);
            }, 0);
        }
    }, { method: "GET" });
};
cog.init();