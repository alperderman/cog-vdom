//CognitiveJS VDOM

if (typeof window.CustomEvent !== 'function') { window.CustomEvent = function (event, params) { params = params || { bubbles: false, cancelable: false, detail: null }; var evt = document.createEvent('CustomEvent'); evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail); return evt; }; }

var cog = {};
cog.data = {};
cog.nodes = {};
cog.props = [];
cog.templates = {};
cog.repeats = {};
cog.bound = [];
cog.tasks = [];
cog.isRebind = false;
cog.encapVar = null;
cog.cache = true;
cog.label = {
    head: "head",
    escape: "#",
    prop: "cog-prop",
    set: "cog-set",
    source: "cog-src",
    temp: "cog-temp",
    repeat: "cog-repeat",
    if: "cog-if",
    live: "cog-live",
    event: "cog-event",
    await: "cog-await"
};
cog.event = {
    beforeData: "COGBeforeData",
    afterData: "COGAfterData",
    beforeRender: "COGBeforeRender",
    afterRender: "COGAfterRender"
};
cog.keyword = {
    this: "_this",
    get: "_get",
    set: "_set",
    type: "_type",
    key: "_key",
    keys: "_keys",
    parent: "_parent",
    index: "_index",
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
    token: new RegExp(cog.token.open + "[\\s\\S]*?" + cog.token.close),
    node: new RegExp("(?:" + cog.token.open + "(.*?)" + cog.token.close + ")|([^]*?)(?=" + cog.token.open + "|$)", "gm")
};

cog.render = function (layoutSrc) {
    var layout;
    step_start();
    function step_start() {
        cog.tasks = new cog.observable(cog.tasks, function (a) {
            if (!cog.isRebind) {
                cog.isRebind = true;
                setTimeout(function () {
                    cog.rebind();
                    cog.isRebind = false;
                }, 0);
            }
        });
        if (typeof layoutSrc === "string") {
            cog.xhr(layoutSrc, function (xhr) {
                if (xhr.status == 200) {
                    layout = xhr.responseText;
                    step_design();
                }
            }, { method: "GET" });
        } else {
            cog.setElems(function () {
                cog.data = new cog.observable(cog.data, function (a) {
                    cog.tasks.push(a);
                });
                document.dispatchEvent(new CustomEvent(cog.event.beforeRender));
                if (cog.isElement(layoutSrc)) {
                    cog.bind(layoutSrc);
                } else {
                    cog.bind();
                }
                setTimeout(function () {
                    document.dispatchEvent(new CustomEvent(cog.event.afterRender));
                }, 0);
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
            cog.setElems(function () {
                cog.data = new cog.observable(cog.data, function (a) {
                    cog.tasks.push(a);
                });
                step_bind();
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
    var i, ii, dommap, tokenPure, newNode, cloneNode, tokenContent, newNodeRef, attrKey, attrVal, attrContent, tempNode, tempAttr, tempId, tempToken, tempTokenObj, tempAlias, tempRender, nodeSplitTokens, nodeSplitToken, prop, propType, attrContentParse, attrContentObj, attrContentObjProp;
    if (dom == null) { dom = document.body; }
    if (arg == null) { arg = {}; }
    if (arg.parent == null) { arg.parent = false; }
    while (tempNode = dom.querySelector("[" + cog.label.temp + "]")) {
        tempAttr = tempNode.getAttribute(cog.label.temp).split(";");
        tempId = tempAttr[0].trim();
        if (tempAttr.length == 3) {
            tempToken = tempAttr[2].split(",");
            for (i in tempToken) {
                tempToken[i] = tempToken[i].trim();
            }
            tempTokenObj = {};
            tempAlias = tempAttr[1].split(",");
            for (i in tempAlias) {
                tempAlias[i] = tempAlias[i].trim();
                tempTokenObj[tempAlias[i]] = tempToken[i];
            }
        } else {
            tempTokenObj = null;
        }
        tempNode.removeAttribute(cog.label.temp);
        if (cog.templates.hasOwnProperty(tempId)) {
            tempRender = cog.template({ id: tempId, data: tempTokenObj, bind: true, fragment: true });
            tempNode.parentNode.replaceChild(tempRender, tempNode);
        }
    }
    cog.bindRepeats(dom, arg.parent);
    dommap = cog.createDOMMap(dom);
    cog.iterate(dommap, {
        obj: function (obj) {
            if (obj.hasOwnProperty("attrs")) {
                for (i = 0; i < obj.attrs.length; i++) {
                    attrKey = obj.attrs[i].attr;
                    attrVal = obj.attrs[i].value;
                    if (attrKey.substring(0, cog.label.escape.length) == cog.label.escape) {
                        obj.node.removeAttribute(attrKey);
                        attrKey = attrKey.substring(cog.label.escape.length, attrKey.length);
                    }
                    if (attrKey.indexOf(cog.label.prop) === 0) {
                        propType = "prop";
                    } else if (attrKey == cog.label.if) {
                        propType = "if";
                    } else {
                        propType = "attr";
                    }
                    if (cog.regex.token.test(attrVal) || propType != "attr") {
                        cog.props.push({ node: obj.node });
                        prop = cog.props[cog.props.length - 1];
                        if (propType != "attr") {
                            attrContentParse = cog.evalParse(attrVal);
                            nodeSplitTokens = cog.splitTokens(attrVal);
                            for (ii in nodeSplitTokens) {
                                nodeSplitToken = nodeSplitTokens[ii];
                                if (typeof nodeSplitToken !== 'string') {
                                    cog.pushNode(nodeSplitToken[1], { prop: prop });
                                }
                            }
                            if (propType == "if") {
                                if (cog.if(attrContentParse)) {
                                    obj.node.style.display = "";
                                } else {
                                    obj.node.style.display = "none";
                                }
                                prop.type = "if";
                                prop.content = attrContentParse;
                            } else {
                                attrContentObj = cog.eval("({" + attrContentParse + "})");
                                attrContentObj = cog.propCondition(attrContentObj);
                                if (attrContentObj) {
                                    if (attrContentObj.hasOwnProperty("style")) {
                                        attrContentObjProp = attrContentObj["style"];
                                        for (ii in attrContentObjProp) {
                                            obj.node.style[ii] = attrContentObjProp[ii];
                                        }
                                    }
                                    if (attrContentObj.hasOwnProperty("class")) {
                                        if (typeof attrContentObj["class"] === "string") {
                                            attrContentObjProp = attrContentObj["class"].trim().split(" ");
                                        } else {
                                            attrContentObjProp = attrContentObj["class"];
                                        }
                                        for (ii in attrContentObjProp) {
                                            obj.node.classList.add(attrContentObjProp[ii]);
                                        }
                                    }
                                    if (attrContentObj.hasOwnProperty("context")) {
                                        attrContentObjProp = attrContentObj["context"];
                                        for (ii in attrContentObjProp) {
                                            obj.node[ii] = attrContentObjProp[ii];
                                        }
                                    }
                                    if (attrContentObj.hasOwnProperty("attr")) {
                                        attrContentObjProp = attrContentObj["attr"];
                                        for (ii in attrContentObjProp) {
                                            obj.node.setAttribute(ii, attrContentObjProp[ii]);
                                        }
                                    }
                                }
                                prop.type = "prop";
                                prop.content = attrContentParse;
                                prop.old = attrContentObj;
                            }
                            obj.node.removeAttribute(attrKey);
                        } else {
                            attrContent = document.createElement("span");
                            newNode = document.createDocumentFragment();
                            nodeSplitTokens = cog.splitTokens(attrVal);
                            for (ii in nodeSplitTokens) {
                                nodeSplitToken = nodeSplitTokens[ii];
                                if (typeof nodeSplitToken === 'string') {
                                    newNode.appendChild(document.createTextNode(nodeSplitToken));
                                } else {
                                    tokenPure = nodeSplitToken[1];
                                    tokenContent = cog.get(tokenPure);
                                    if (tokenContent !== undefined) {
                                        newNodeRef = cog.pushNode(tokenPure, { prop: prop, node: document.createTextNode(tokenContent) });
                                        newNode.appendChild(newNodeRef.node);
                                    } else {
                                        newNode.appendChild(document.createTextNode(nodeSplitToken[0]));
                                    }
                                }
                            }
                            attrContent.appendChild(newNode);
                            obj.node.setAttribute(attrKey, attrContent.innerHTML);
                            prop.type = "attr";
                            prop.attr = attrKey;
                            prop.content = attrContent;
                        }
                    }
                }
            }
            if (obj.hasOwnProperty("type") && obj.type == "text" && !obj.isSVG && !obj.isScript) {
                if (cog.regex.token.test(obj.content)) {
                    newNode = document.createDocumentFragment();
                    nodeSplitTokens = cog.splitTokens(obj.content);
                    for (i in nodeSplitTokens) {
                        nodeSplitToken = nodeSplitTokens[i];
                        if (typeof nodeSplitToken === 'string') {
                            newNode.appendChild(document.createTextNode(nodeSplitToken));
                        } else {
                            tokenPure = nodeSplitToken[1];
                            tokenContent = cog.get(tokenPure);
                            if (tokenContent !== undefined) {
                                if (!cog.isElement(tokenContent) && typeof tokenContent !== 'object') {
                                    newNodeRef = cog.pushNode(tokenPure, document.createTextNode(tokenContent));
                                    newNode.appendChild(newNodeRef);
                                } else {
                                    cloneNode = cog.bind(tokenContent.cloneNode(true));
                                    newNodeRef = cog.pushNode(tokenPure, cloneNode);
                                    newNode.appendChild(newNodeRef);
                                }
                            } else {
                                newNode.appendChild(document.createTextNode(nodeSplitToken[0]));
                            }
                        }
                    }
                    if (obj.node.parentNode) {
                        obj.node.parentNode.replaceChild(newNode, obj.node);
                    }
                }
            }
        }
    });
    if (typeof arg.callback === 'function') {
        arg.callback();
    }
    return dom;
};
cog.propCondition = function (obj) {
    if (obj.hasOwnProperty("if")) {
        if (cog.if(obj.if[0])) {
            return cog.propCondition(obj.if[1]);
        } else {
            if (typeof obj.if[2] !== 'undefined') {
                return cog.propCondition(obj.if[2]);
            } else {
                return false;
            }
        }
    } else {
        return obj;
    }
};
cog.splitTokens = function (str) {
    var m, result = [];
    cog.regex.node.lastIndex = 0;
    while ((m = cog.regex.node.exec(str)) !== null) {
        if (m.index === cog.regex.node.lastIndex) {
            cog.regex.node.lastIndex++;
        }
        if (m[0] != "") {
            if (m[1] === undefined) {
                result.push(m[0]);
            } else {
                result.push([m[0], m[1]]);
            }
        }
    }
    return result;
};
cog.template = function (arg) {
    var i, ii, iii, iiii, aliasKeysLength, aliasKeys, aliasKey, aliasKeyArr, aliasKeyArrLength, aliasKeyArrResult, aliasReplace, aliasNode, aliasNodeItem, dommap, alias, node, props, prop, cloneNode, tokenPure, newNode, newNodeLength, tokenArr, attrContent, attrKey, attrVal, nodeSplitTokens, nodeSplitToken;
    if (arg.id == null) { return; }
    if (arg.fragment == null) { arg.fragment = false; }
    if (arg.bind == null) { arg.bind = false; }
    if (arg.parent == null) { arg.parent = false; }
    if (cog.templates[arg.id] == null && arg.node != null) {
        cog.templates[arg.id] = { alias: {}, props: [], node: arg.node.cloneNode(true) };
        if (arg.alias != null) {
            aliasKeysLength = arg.alias.length;
            for (i = 0; i < aliasKeysLength; i++) {
                cog.templates[arg.id]["alias"][arg.alias[i]] = [];
            }
            node = cog.templates[arg.id]["node"];
            node.removeAttribute(cog.label.repeat);
            node.removeAttribute(cog.label.temp);
            alias = cog.templates[arg.id]["alias"];
            props = cog.templates[arg.id]["props"];
            aliasKeys = arg.alias;
            dommap = cog.createDOMMap(node);
            cog.iterate(dommap, {
                obj: function (obj) {
                    if (!obj.isRepeat && !obj.isTemplate) {
                        if (obj.hasOwnProperty("attrs")) {
                            for (i = 0; i < obj.attrs.length; i++) {
                                attrKey = obj.attrs[i].attr;
                                attrVal = obj.attrs[i].value;
                                if (cog.regex.token.test(attrVal)) {
                                    attrContent = document.createElement("span");
                                    newNode = document.createDocumentFragment();
                                    nodeSplitTokens = cog.splitTokens(attrVal);
                                    for (ii in nodeSplitTokens) {
                                        nodeSplitToken = nodeSplitTokens[ii];
                                        if (typeof nodeSplitToken === 'string') {
                                            newNode.appendChild(document.createTextNode(nodeSplitToken));
                                        } else {
                                            tokenPure = nodeSplitToken[1];
                                            tokenArr = tokenPure.split(".");
                                            aliasKeyArrResult = false;
                                            for (iii = 0; iii < aliasKeysLength; iii++) {
                                                aliasKey = aliasKeys[iii];
                                                aliasKeyArr = aliasKey.split(".");
                                                aliasKeyArrLength = aliasKeyArr.length;
                                                for (iiii = 0; iiii < aliasKeyArrLength; iiii++) {
                                                    if (aliasKeyArr[iiii] != tokenArr[iiii]) {
                                                        break;
                                                    }
                                                    if (iiii == aliasKeyArrLength - 1) {
                                                        aliasKeyArrResult = true;
                                                    }
                                                }
                                                if (aliasKeyArrResult) {
                                                    break;
                                                }
                                            }
                                            if (aliasKeyArrResult) {
                                                newNodeLength = alias[aliasKey].push({ prop: props.length, node: document.createTextNode(aliasKey) });
                                                if (attrKey == cog.label.repeat || attrKey == cog.label.temp) {
                                                    newNode.appendChild(alias[aliasKey][newNodeLength - 1].node);
                                                    newNode.appendChild(document.createTextNode(tokenPure.replace(aliasKey, '')));
                                                } else {
                                                    newNode.appendChild(document.createTextNode(cog.token.open));
                                                    newNode.appendChild(alias[aliasKey][newNodeLength - 1].node);
                                                    newNode.appendChild(document.createTextNode(tokenPure.replace(aliasKey, '')));
                                                    newNode.appendChild(document.createTextNode(cog.token.close));
                                                }
                                            } else {
                                                newNode.appendChild(document.createTextNode(nodeSplitToken[0]));
                                            }
                                        }
                                    }
                                    attrContent.appendChild(newNode);
                                    obj.node.setAttribute(attrKey, attrContent.innerHTML);
                                    props.push({ node: obj.node, attr: attrKey, content: attrContent });
                                }
                            }
                        }
                        if (obj.hasOwnProperty("type") && obj.type == "text" && !obj.isSVG && !obj.isScript) {
                            if (cog.regex.token.test(obj.content)) {
                                newNode = document.createDocumentFragment();
                                nodeSplitTokens = cog.splitTokens(obj.content);
                                for (i in nodeSplitTokens) {
                                    nodeSplitToken = nodeSplitTokens[i];
                                    if (typeof nodeSplitToken === 'string') {
                                        newNode.appendChild(document.createTextNode(nodeSplitToken));
                                    } else {
                                        tokenPure = nodeSplitToken[1];
                                        tokenArr = tokenPure.split(".");
                                        aliasKeyArrResult = false;
                                        for (ii = 0; ii < aliasKeysLength; ii++) {
                                            aliasKey = aliasKeys[ii];
                                            aliasKeyArr = aliasKey.split(".");
                                            aliasKeyArrLength = aliasKeyArr.length;
                                            for (iii = 0; iii < aliasKeyArrLength; iii++) {
                                                if (aliasKeyArr[iii] != tokenArr[iii]) {
                                                    break;
                                                }
                                                if (iii == aliasKeyArrLength - 1) {
                                                    aliasKeyArrResult = true;
                                                }
                                            }
                                            if (aliasKeyArrResult) {
                                                break;
                                            }
                                        }
                                        if (aliasKeyArrResult) {
                                            newNodeLength = alias[aliasKey].push(document.createTextNode(aliasKey));
                                            newNode.appendChild(document.createTextNode(cog.token.open));
                                            newNode.appendChild(alias[aliasKey][newNodeLength - 1]);
                                            newNode.appendChild(document.createTextNode(tokenPure.replace(aliasKey, '')));
                                            newNode.appendChild(document.createTextNode(cog.token.close));
                                        } else {
                                            newNode.appendChild(document.createTextNode(nodeSplitToken[0]));
                                        }
                                    }
                                }
                                if (obj.node.parentNode) {
                                    obj.node.parentNode.replaceChild(newNode, obj.node);
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    if (cog.templates[arg.id] != null && arg.node == null) {
        node = cog.templates[arg.id]["node"];
        if (arg.data != null) {
            alias = cog.templates[arg.id]["alias"];
            aliasKeys = Object.keys(alias);
            props = cog.templates[arg.id]["props"];
            aliasKeysLength = aliasKeys.length;
            for (i = 0; i < aliasKeysLength; i++) {
                aliasKey = aliasKeys[i];
                if (arg.data.hasOwnProperty(aliasKey)) {
                    aliasReplace = arg.data[aliasKey];
                    aliasNode = alias[aliasKey];
                    for (ii in aliasNode) {
                        aliasNodeItem = aliasNode[ii];
                        if (aliasNodeItem.hasOwnProperty("prop")) {
                            newNode = document.createTextNode(arg.data[aliasKey]);
                            aliasNodeItem.node.parentNode.replaceChild(newNode, aliasNodeItem.node);
                            aliasNode[ii].node = newNode;
                            prop = props[aliasNodeItem.prop];
                            prop.node.setAttribute(prop.attr, prop.content.innerHTML);
                        } else {
                            newNode = document.createTextNode(arg.data[aliasKey]);
                            aliasNodeItem.parentNode.replaceChild(newNode, aliasNodeItem);
                            aliasNode[ii] = newNode;
                        }
                    }
                }
            }
        }
        cloneNode = document.createElement(node.tagName);
        cloneNode.innerHTML = node.innerHTML;
        if (arg.bind) {
            cloneNode = cog.bind(cloneNode, { parent: arg.parent });
        }
        if (arg.fragment) {
            return cog.elemFragment(cloneNode);
        } else {
            return cloneNode;
        }
    }
};
cog.evalParse = function (str) {
    var result = "", nodeSplitTokens = cog.splitTokens(str), nodeSplitToken;
    for (ii in nodeSplitTokens) {
        nodeSplitToken = nodeSplitTokens[ii];
        if (typeof nodeSplitToken === 'string') {
            result = result + nodeSplitToken;
        } else {
            result = result + "cog.get('" + nodeSplitToken[1] + "')";
        }
    }
    return result;
};
cog.getNode = function (keys) {
    var i, key, keysLength, ref = cog.nodes;
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    keysLength = keys.length;
    for (i = 0; i < keysLength; i++) {
        key = keys[i];
        if (!ref.hasOwnProperty(key)) {
            if (ref.hasOwnProperty(cog.keyword.this) && ref[cog.keyword.this].hasOwnProperty(key)) {
                ref = ref[cog.keyword.this][key];
            } else {
                return undefined;
            }
        } else {
            ref = ref[key];
        }
    }
    if (ref.hasOwnProperty(cog.keyword.this)) {
        ref = ref[cog.keyword.this];
    }
    return ref;
};
cog.pushNode = function (keys, node) {
    var i, key, keysLength, ref = cog.nodes, nodesLength, result;
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    keysLength = keys.length;
    for (i = 0; i < keysLength; i++) {
        key = keys[i];
        if (!ref.hasOwnProperty(key)) {
            if (ref.hasOwnProperty(cog.keyword.this) && ref[cog.keyword.this].hasOwnProperty(key)) {
                ref = ref[cog.keyword.this];
            } else {
                if (i == keysLength - 1) {
                    ref[key] = {};
                    ref[key][cog.keyword.this] = [];
                } else {
                    ref[key] = {};
                }
            }
        }
        if (i == keysLength - 1) {
            nodesLength = ref[key][cog.keyword.this].push(node);
            result = ref[key][cog.keyword.this][nodesLength - 1];
        } else {
            ref = ref[key];
        }
    }
    return result;
};
cog.bindRepeats = function (dom, parent) {
    var i, repeatNode, repeatAttr, repeatId, repeatToken, repeatTokenObj, repeatAlias, repeatData, repeatDataLength, repeatDataToken, repeatDataKey, repeatTemp;
    while (repeatNode = dom.querySelector("[" + cog.label.repeat + "]")) {
        repeatAttr = repeatNode.getAttribute(cog.label.repeat).split(";");
        repeatId = repeatAttr[0].trim();
        repeatToken = repeatAttr[2].split(",");
        for (i in repeatToken) {
            repeatToken[i] = repeatToken[i].trim();
        }
        repeatTokenObj = {};
        repeatAlias = repeatAttr[1].split(",");
        for (i in repeatAlias) {
            repeatAlias[i] = repeatAlias[i].trim();
            repeatTokenObj[repeatAlias[i]] = repeatToken[i];
        }
        repeatNode.removeAttribute(cog.label.repeat);
        repeatDataToken = repeatToken[0];
        repeatData = cog.get(repeatDataToken);
        if (typeof repeatData !== 'undefined') {
            repeatDataLength = repeatData.length;
        } else {
            repeatDataLength = 0;
        }
        repeatDataKey = repeatId + ":" + repeatToken.join(",");
        repeatNode.innerHTML = "";
        if (cog.repeats.hasOwnProperty(repeatDataToken) && cog.repeats[repeatDataToken].hasOwnProperty(repeatDataKey)) {
            repeatNode.innerHTML = cog.repeats[repeatDataToken][repeatDataKey]["owner"].innerHTML;
            cog.repeats[repeatDataToken][repeatDataKey]["clone"].push(repeatNode);
        } else {
            if (!cog.repeats.hasOwnProperty(repeatDataToken)) {
                cog.repeats[repeatDataToken] = {};
            }
            cog.repeats[repeatDataToken][repeatDataKey] = { owner: repeatNode, template: repeatId, dataAlias: repeatAlias[0], data: repeatDataToken, alias: cog.shallowClone(repeatTokenObj), clone: [], childs: [], inner: [] };
            if (parent) {
                parent.inner.push(repeatDataToken);
            }
            cog.repeats[repeatDataToken][repeatDataKey]["childs"] = [];
            for (i = 0; i < repeatDataLength; i++) {
                repeatTokenObj[repeatAlias[0]] = repeatDataToken + "." + i;
                repeatTemp = cog.template({ id: repeatId, data: repeatTokenObj, fragment: false, bind: true, parent: cog.repeats[repeatDataToken][repeatDataKey] });
                cog.repeats[repeatDataToken][repeatDataKey]["childs"][i] = [];
                while (repeatTemp.firstChild) {
                    cog.repeats[repeatDataToken][repeatDataKey]["childs"][i].push(repeatTemp.firstChild);
                    repeatNode.appendChild(repeatTemp.firstChild);
                }
            }
        }
    }
};
cog.shallowClone = function (obj) {
    if (typeof obj === 'object') {
        if (Array.isArray(obj)) {
            return obj.slice();
        } else {
            var clone = {};
            for (var key in obj) {
                clone[key] = obj[key];
            }
            return clone;
        }
    } else {
        return obj;
    }
};
cog.rebindRepeats = function (token) {
    var i, ii, iii, repeat, content, contentLength, repeatChilds, repeatChild, repeatChildsLength, repeatAlias, repeatTemp;
    if (typeof token !== 'string') {
        token = token.join(".");
    }
    if (cog.repeats.hasOwnProperty(token)) {
        content = cog.get(token);
        if (typeof content !== 'undefined') {
            contentLength = content.length;
        } else {
            contentLength = 0;
        }
        for (i in cog.repeats[token]) {
            repeat = cog.repeats[token][i];
            if (cog.isInDocument(repeat.owner)) {
                repeatChilds = repeat["childs"];
                repeatChildsLength = repeatChilds.length;
                if (repeatChildsLength > contentLength) {
                    for (ii = repeatChildsLength - 1; ii >= contentLength; ii--) {
                        repeatChild = repeatChilds[ii];
                        for (iii in repeatChild) {
                            repeatChild[iii].parentNode.removeChild(repeatChild[iii]);
                        }
                        repeatChilds.pop();
                    }
                }
                if (repeatChildsLength < contentLength) {
                    for (ii = repeatChildsLength; ii < contentLength; ii++) {
                        repeatAlias = cog.shallowClone(repeat.alias);
                        repeatAlias[repeat.dataAlias] = repeat.data + "." + ii;
                        repeatTemp = cog.template({ id: repeat.template, data: repeatAlias, fragment: false, bind: true, parent: repeat });
                        repeat["childs"][ii] = [];
                        while (repeatTemp.firstChild) {
                            repeat["childs"][ii].push(repeatTemp.firstChild);
                            repeat.owner.appendChild(repeatTemp.firstChild);
                        }
                    }
                }
                for (ii in repeat["inner"]) {
                    cog.rebindRepeats(repeat["inner"][ii]);
                }
                for (ii in repeat["clone"]) {
                    repeat["clone"][ii].innerHTML = repeat.owner.innerHTML;
                }
            } else {
                delete cog.repeats[token][i];
            }
        }

    }
};
cog.rebind = function () {
    var i, task, token;
    while (task = cog.tasks[0]) {
        task = task[cog.keyword.get];
        token = task.keys.join(".");
        cog.rebindRepeats(token);
        if (task.action == "set") {
            cog.rebindNodes(token);
        }
        if (task.action == "unshift") {
            cog.rebindNodes(token);
        }
        if (task.action == "shift") {
            cog.rebindNodes(token);

        }
        if (task.action == "push") {
            for (i = task.index; i < task.amount; i++) {
                cog.rebindNodes(token + "." + i);
            }
        }
        if (task.action == "pop") {
            cog.rebindNodes(token + "." + task.index);
        }
        if (task.action == "splice") {
            for (i = task.index; i < task.amount; i++) {
                cog.rebindNodes(token + "." + i);
            }
        }
        cog.rebindBound(token);
        cog.tasks.splice(0, 1);
    }
};
cog.isInDocument = function (el) {
    var html = document.body.parentNode;
    while (el) {
        if (el === html) {
            return true;
        }
        el = el.parentNode;
    }
    return false;
};
cog.rebindNodes = function (token) {
    if (typeof token !== 'string') {
        token = token.join(".");
    }
    var i, cloneNode, nodeToken, nodeTokensLength, prop, nodeTokens = cog.getNode(token), nodeTokenKey, nodeTokenKeys, nodeTokenKeysLength, content = cog.get(token), attrContentObj, attrContentObjProp;
    if (typeof nodeTokens === 'object') {
        if (Array.isArray(nodeTokens)) {
            nodeTokensLength = nodeTokens.length;
            for (i = nodeTokensLength - 1; i >= 0; i--) {
                nodeToken = nodeTokens[i];
                if (nodeToken.hasOwnProperty("prop")) {
                    prop = nodeToken.prop;
                    if (cog.isInDocument(prop.node)) {
                        if (prop.type == "prop") {
                            attrContentObj = cog.eval("({" + prop.content + "})");
                            attrContentObj = cog.propCondition(attrContentObj);
                            if (prop.old) {
                                if (prop.old.hasOwnProperty("style")) {
                                    attrContentObjProp = prop.old["style"];
                                    for (ii in attrContentObjProp) {
                                        prop.node.style[ii] = "";
                                    }
                                }
                                if (prop.old.hasOwnProperty("class")) {
                                    if (typeof prop.old["class"] === "string") {
                                        attrContentObjProp = prop.old["class"].trim().split(" ");
                                    } else {
                                        attrContentObjProp = prop.old["class"];
                                    }
                                    for (ii in attrContentObjProp) {
                                        obj.node.classList.remove(attrContentObjProp[ii]);
                                    }
                                }
                                if (prop.old.hasOwnProperty("context")) {
                                    attrContentObjProp = prop.old["context"];
                                    for (ii in attrContentObjProp) {
                                        prop.node[ii] = attrContentObjProp[ii];
                                    }
                                }
                                if (prop.old.hasOwnProperty("attr")) {
                                    attrContentObjProp = prop.old["attr"];
                                    for (ii in attrContentObjProp) {
                                        prop.node.removeAttribute(ii);
                                    }
                                }
                            }
                            if (attrContentObj) {
                                if (attrContentObj.hasOwnProperty("style")) {
                                    attrContentObjProp = attrContentObj["style"];
                                    for (ii in attrContentObjProp) {
                                        prop.node.style[ii] = attrContentObjProp[ii];
                                    }
                                }
                                if (attrContentObj.hasOwnProperty("class")) {
                                    if (typeof attrContentObj["class"] === "string") {
                                        attrContentObjProp = attrContentObj["class"].trim().split(" ");
                                    } else {
                                        attrContentObjProp = attrContentObj["class"];
                                    }
                                    for (ii in attrContentObjProp) {
                                        obj.node.classList.add(attrContentObjProp[ii]);
                                    }
                                }
                                if (attrContentObj.hasOwnProperty("context")) {
                                    attrContentObjProp = attrContentObj["context"];
                                    for (ii in attrContentObjProp) {
                                        prop.node[ii] = attrContentObjProp[ii];
                                    }
                                }
                                if (attrContentObj.hasOwnProperty("attr")) {
                                    attrContentObjProp = attrContentObj["attr"];
                                    for (ii in attrContentObjProp) {
                                        prop.node.setAttribute(ii, attrContentObjProp[ii]);
                                    }
                                }
                            }
                            prop.old = attrContentObj;
                        } else if (prop.type == "if") {
                            if (cog.if(prop.content)) {
                                prop.node.style.display = "";
                            } else {
                                prop.node.style.display = "none";
                            }
                        } else if (prop.type == "attr") {
                            if (nodeToken.node.nodeValue != content) {
                                nodeToken.node.nodeValue = content;
                                prop.node.setAttribute(prop.attr, prop.content.innerHTML);
                            }
                        }
                    } else {
                        nodeTokens.splice(i, 1);
                        cog.props.splice(cog.props.indexOf(prop), 1);
                    }
                } else {
                    if (cog.isInDocument(nodeToken)) {
                        if (!cog.isElement(content) && nodeToken.nodeValue != content) {
                            nodeToken.nodeValue = content;
                        } else if (cog.isElement(content)) {
                            cloneNode = cog.bind(content.cloneNode(true));
                            nodeToken.parentNode.replaceChild(cloneNode, nodeToken);
                            nodeTokens[i] = cloneNode;
                        }
                    } else {
                        nodeTokens.splice(i, 1);
                    }
                }
            }
        } else {
            nodeTokenKeys = Object.keys(nodeTokens);
            nodeTokenKeysLength = nodeTokenKeys.length;
            for (i = 0; i < nodeTokenKeysLength; i++) {
                nodeTokenKey = nodeTokenKeys[i];
                cog.rebindNodes(token + "." + nodeTokenKey);
            }
        }
    }
};
cog.rebindBound = function (token) {
    var i, bounds, bound;
    if (typeof token !== 'string') {
        token = token.join(".");
    }
    if (cog.bound.hasOwnProperty(token)) {
        bounds = cog.bound[token];
        for (i in bounds) {
            bound = bounds[i];
            cog.rebindRepeats(bound);
            cog.rebindNodes(bound);
        }
    }
};
cog.addBound = function (dataKeys, targetKeys) {
    var bound;
    if (typeof dataKeys !== 'string') {
        dataKeys = dataKeys.join(".");
    }
    if (typeof targetKeys !== 'string') {
        targetKeys = targetKeys.join(".");
    }
    if (cog.bound.hasOwnProperty(dataKeys)) {
        bound = cog.bound[dataKeys];
        if (bound.indexOf(targetKeys) === -1) {
            bound.push(targetKeys);
        }
    } else {
        cog.bound[dataKeys] = [targetKeys];
    }
};
cog.removeBound = function (dataKeys, targetKeys) {
    var bound, index;
    if (typeof dataKeys !== 'string') {
        dataKeys = dataKeys.join(".");
    }
    if (typeof targetKeys !== 'string') {
        targetKeys = targetKeys.join(".");
    }
    if (cog.bound.hasOwnProperty(dataKeys)) {
        bound = cog.bound[dataKeys];
        index = bound.indexOf(targetKeys);
        if (index !== -1) {
            bound.splice(index, 1);
        }
    }
};
cog.get = function (keys) {
    var i, key, keysLength, ref = cog.data, token;
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    if (keys[0].substring(0, cog.token.escape.length) == cog.token.escape) {
        token = keys.join(".");
        return cog.token.open + token.substring(cog.token.escape.length, token.length) + cog.token.close;
    }
    keysLength = keys.length;
    for (i = 0; i < keysLength; i++) {
        key = keys[i];
        if (!ref.hasOwnProperty(key)) {
            return undefined;
        }
        ref = ref[key];
    }
    if (ref instanceof cog.observable && ref[cog.keyword.type] !== 'object' && ref[cog.keyword.type] !== 'array') {
        ref = ref[cog.keyword.get];
    }
    if (typeof ref === 'function') {
        ref = ref(cog.shallowClone(keys));
    }
    return ref;
};
cog.set = function (keys, val, func) {
    var i, key, keysLength, ref = cog.data, content = cog.get(keys);
    if (func == null) { func = false; }
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    keysLength = keys.length;
    if (func && typeof val === 'function') {
        val = val(content);
    }
    for (i = 0; i < keysLength; i++) {
        key = keys[i];
        if (i == keysLength - 1 && content !== val) {
            if (!ref.hasOwnProperty(key) && ref instanceof cog.observable) {
                ref[cog.keyword.set](val, key);
            } else {
                ref[key] = val;
            }
        } else {
            if (!ref.hasOwnProperty(key)) {
                if (ref instanceof cog.observable) {
                    ref[cog.keyword.set]({}, key);
                } else {
                    ref[key] = {};
                }
            }
            ref = ref[key];
        }
    }
};
cog.alter = function (keys, val) {
    cog.set(keys, val, true);
};
cog.observable = function (value, callback, parent, keys) {
    if (value instanceof cog.observable) { return value; }
    var _self = this, _value, _init = false, _keys, _parent;
    if (checkType(callback) !== 'function') {
        callback = function () { };
    }
    if (keys == null) {
        _keys = [];
    } else {
        _keys = keys;
    }
    if (parent == null) {
        _parent = undefined;
    } else {
        _parent = parent;
    }
    function checkType(input) {
        var typeString = Object.prototype.toString.call(input);
        return typeString.slice(8, typeString.length - 1).toLowerCase();
    }
    function defineNewProperty(key) {
        if (!_self.hasOwnProperty(key)) {
            Object.defineProperty(_self, key, {
                configurable: true,
                enumerable: true,
                get: function () {
                    return _value[key];
                },
                set: function (val) {
                    _self[cog.keyword.set].apply(_self, [val, key]);
                }
            });
        }
    }
    function defineNewObservable(key, val, func) {
        var valueKeys = cog.shallowClone(_keys);
        valueKeys.push(key);
        if (val instanceof cog.observable) {
            val = new cog.observable(val[cog.keyword.get], callback, _self, valueKeys);
        } else {
            val = new cog.observable(val, callback, _self, valueKeys);
        }
        if (typeof func === 'function') {
            func(val);
        } else {
            _value[key] = val;
        }
        return { val: val, keys: valueKeys };
    }
    function fixArrayIndex() {
        var val, i, ln = _value.length;
        for (i = 0, ln; i < ln; i++) {
            val = cog.shallowClone(_value[i][cog.keyword.keys]);
            val[val.length - 1] = i;
            _value[i][cog.keyword.keys] = val;
        }
    }
    Object.defineProperty(_self, cog.keyword.get, {
        configurable: false,
        enumerable: false,
        get: function () {
            if (_self[cog.keyword.type] === 'array' || _self[cog.keyword.type] === 'object') {
                var data, i;
                if (_self[cog.keyword.type] === 'array') {
                    data = [];
                } else {
                    data = {};
                }
                for (i in _self) {
                    data[i] = _self[i][cog.keyword.get];
                }
                return data;
            } else {
                return _value;
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.set, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: function (val, key) {
            var o = defineNewObservable(key, val);
            defineNewProperty(key);
            if (_init) {
                callback({
                    action: "set",
                    value: o.val[cog.keyword.get],
                    keys: cog.shallowClone(o.keys)
                });
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.type, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: checkType(value)
    });
    Object.defineProperty(_self, cog.keyword.key, {
        configurable: false,
        enumerable: false,
        get: function () {
            return _self[cog.keyword.keys][_self[cog.keyword.keys].length - 1];
        }
    });
    Object.defineProperty(_self, cog.keyword.keys, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _keys
    });
    Object.defineProperty(_self, cog.keyword.parent, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: _parent
    });
    if (_parent && _parent[cog.keyword.type] === 'array') {
        Object.defineProperty(_self, cog.keyword.index, {
            configurable: false,
            enumerable: false,
            get: function () {
                return _self[cog.keyword.keys][_self[cog.keyword.keys].length - 1];
            }
        });
    }
    if (_self[cog.keyword.type] === 'array' || _self[cog.keyword.type] === 'object') {
        if (_self[cog.keyword.type] === 'array') {
            _value = [];
            Object.defineProperty(_self, "push", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    var index, args = [], valueLength = _value.length, argumentsLength = arguments.length, o;
                    for (var i = 0, ln = argumentsLength; i < ln; i++) {
                        index = _value.length;
                        o = defineNewObservable(index, arguments[i], function (v) { _value.push(v); });
                        defineNewProperty(index);
                        args.push(o.val[cog.keyword.get]);
                    }
                    if (_init) {
                        callback({
                            action: "push",
                            args: args,
                            index: valueLength,
                            amount: argumentsLength,
                            keys: cog.shallowClone(_keys)
                        });
                    }
                    return _value.length;
                }
            });
            Object.defineProperty(_self, "pop", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    var valueLength = _value.length;
                    if (valueLength > -1) {
                        var index = valueLength - 1,
                            item = _value.pop();
                        delete _self[index];
                        callback({
                            action: "pop",
                            index: valueLength,
                            keys: cog.shallowClone(_keys)
                        });
                        return item;
                    }
                }
            });
            Object.defineProperty(_self, "unshift", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    var i, ln, args = [], o;
                    for (i = 0, ln = arguments.length; i < ln; i++) {
                        o = defineNewObservable(i, arguments[i], function (v) { _value.splice(i, 0, v); });
                        defineNewProperty(_value.length - 1);
                        args.push(o.val[cog.keyword.get]);
                    }
                    fixArrayIndex();
                    callback({
                        action: "unshift",
                        args: args,
                        keys: cog.shallowClone(_keys)
                    });
                    return _value.length;
                }
            });
            Object.defineProperty(_self, "shift", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    if (_value.length > -1) {
                        var item = _value.shift();
                        delete _self[_value.length];
                        fixArrayIndex();
                        callback({
                            action: "shift",
                            keys: cog.shallowClone(_keys)
                        });
                        return item;
                    }
                }
            });
            Object.defineProperty(_self, "splice", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function (index, howMany) {
                    var removed = [], item, args = [index, howMany], valueLength = _value.length, o;
                    index = index == null ? 0 : index < 0 ? valueLength + index : index;
                    howMany = howMany == null ? valueLength - index : howMany > 0 ? howMany : 0;
                    while (howMany--) {
                        item = _value.splice(index, 1)[0];
                        removed.push(item);
                        delete _self[_value.length];
                    }
                    for (var i = 2, ln = arguments.length; i < ln; i++) {
                        o = defineNewObservable(index, arguments[i], function (v) { _value.splice(index, 0, v); });
                        defineNewProperty(_value.length - 1);
                        args.push(o.val[cog.keyword.get]);
                        index++;
                    }
                    fixArrayIndex();
                    callback({
                        action: "splice",
                        args: args,
                        index: index,
                        amount: valueLength,
                        keys: cog.shallowClone(_keys)
                    });
                    return removed;
                }
            });
            Object.defineProperty(_self, "length", {
                configurable: false,
                enumerable: false,
                get: function () {
                    return _value.length;
                },
                set: function (val) {
                    var n = Number(val);
                    var length = _value.length;
                    if (n % 1 === 0 && n >= 0) {
                        if (n < length) {
                            _self.splice(n);
                        } else if (n > length) {
                            _self.push.apply(_self, new Array(n - length));
                        }
                    } else {
                        throw new RangeError("Invalid array length");
                    }
                    _value.length = n;
                    return val;
                }
            });
            Object.getOwnPropertyNames(Array.prototype).forEach(function (name) {
                if (!(name in _self)) {
                    Object.defineProperty(_self, name, {
                        configurable: false,
                        enumerable: false,
                        writable: false,
                        value: Array.prototype[name]
                    });
                }
            });
            _self.push.apply(_self, value);
        } else {
            _value = {};
            for (var i in value) {
                defineNewObservable(i, value[i]);
                defineNewProperty(i);
            }
        }
    } else {
        _value = value;
    }
    _init = true;
};
cog.setElems = function (callback) {
    cog.loadContents(function () {
        var setElem, setAttr, setAttrSplit, setType, setKey, setKeys, setTemp, setTempId, setTempAlias, i, links = document.getElementsByTagName("link"), link, heads = document.querySelectorAll("[" + cog.label.head + "]"), head, tempNode, tempAttr, tempId, tempAlias;
        while (setElem = document.querySelector("[" + cog.label.set + "]")) {
            setAttr = setElem.getAttribute(cog.label.set);
            setAttrSplit = setAttr.split(":");
            setType = setAttrSplit[0].trim();
            setKey = setAttrSplit[1].trim();
            setKeys = setKey.split(".");
            if (setType == "json") {
                propData = cog.isJSON(setElem.innerText);
                if (propData) {
                    cog.set(setKeys, propData);
                }
            }
            if (setType == "raw") {
                propData = cog.eval("(" + setElem.innerText + ")");
                cog.set(setKeys, propData);
            }
            if (setType == "text") {
                cog.set(setKeys, setElem.innerText);
            }
            if (setType == "html") {
                cog.set(setKeys, cog.elemFragment(setElem));
            }
            if (setType == "temp") {
                setTemp = setKey.split(";");
                setTempId = setTemp[0].trim();
                setTempAlias = setTemp[1].split(",");
                for (i in setTempAlias) {
                    setTempAlias[i] = setTempAlias[i].trim();
                }
                cog.template({ id: setTempId, node: setElem, alias: setTempAlias });
            }
            setElem.parentNode.removeChild(setElem);
        }
        while (tempNode = document.querySelector("[" + cog.label.repeat + "]:not([" + cog.label.await + "])")) {
            tempAttr = tempNode.getAttribute(cog.label.repeat).split(";");
            tempId = tempAttr[0].trim();
            tempAlias = tempAttr[1].split(",");
            for (i in tempAlias) {
                tempAlias[i] = tempAlias[i].trim();
            }
            tempNode.setAttribute(cog.label.await, "");
            if (!cog.templates.hasOwnProperty(tempId)) {
                cog.template({ id: tempId, node: tempNode, alias: tempAlias });
            }
        }
        while (tempNode = document.querySelector("[" + cog.label.repeat + "][" + cog.label.await + "]")) {
            tempNode.removeAttribute(cog.label.await);
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
        if (typeof callback === 'function') {
            callback();
        }
    });
};
cog.eventListener = function (event) {
    cog.eventHandler(event);
};
cog.eventHandler = function (event, elem) {
    if (!elem) { elem = event.target; }
    if (typeof elem.getAttribute !== 'function') { return; }
    var events, prevent = false, i;
    if (elem.getAttribute(cog.label.live) != null) {
        events = cog.eval("({" + elem.getAttribute(cog.label.live) + "})");
        events = cog.propCondition(events);
        if (events) {
            if (!events.hasOwnProperty("event")) {
                events.event = "change";
            }
            if (events.event == event.type) {
                if (!events.hasOwnProperty("data")) {
                    events.data = "value";
                }
                if (typeof elem[events.data] !== "undefined") {
                    events.data = elem[events.data];
                } else {
                    events.data = cog.eval(events.data);
                }
                cog.set(events.live, events.data);
            }
            if (events.hasOwnProperty(cog.keyword.prevent) && cog.if(events[cog.keyword.prevent])) {
                prevent = true;
            }
        }
    }
    if (elem.getAttribute(cog.label.event) != null) {
        events = cog.eval("({" + elem.getAttribute(cog.label.event) + "})");
        events = cog.propCondition(events);
        if (events) {
            for (i in events) {
                if (i == event.type) {
                    if (typeof events[i] === 'function') {
                        events[i]();
                    } else {
                        cog.eval(events[i]);
                    }
                }
            }
            if (events.hasOwnProperty(cog.keyword.prevent) && cog.if(events[cog.keyword.prevent])) {
                prevent = true;
            }
        }
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
cog.isNodeList = function (nodes) {
    var stringRepr = Object.prototype.toString.call(nodes);
    return typeof nodes === 'object' && /^\[object (HTMLCollection|NodeList|Object)\]$/.test(stringRepr) && (typeof nodes.length === 'number') && (nodes.length === 0 || (typeof nodes[0] === "object" && nodes[0].nodeType > 0));
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
    var stack = [obj], currentObj, currentObjKeys, i, ii, key;
    var _loop = function _loop() {
        currentObj = stack.pop();
        if (typeof arg.obj === "function") {
            arg.obj(currentObj);
        }
        currentObjKeys = Object.keys(currentObj)
        for (i = 0; i < currentObjKeys.length; i++) {
            key = currentObjKeys[i];
            if (typeof arg.item === "function") {
                arg.item(key, currentObj[key]);
            }
            if (typeof currentObj[key] === "object" && currentObj[key] !== null) {
                if (cog.isNodeList(currentObj[key])) {
                    for (ii = 0; ii < currentObj[key].length; ii++) {
                        stack.push(currentObj[key][ii]);
                    }
                } else {
                    stack.push(currentObj[key]);
                }
            }
        }
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
cog.createDOMMap = function (element, isSVG, isScript, isRepeat, isTemplate) {
    return Array.prototype.map.call(element.childNodes, (function (node) {
        var details = {
            content: node.childNodes && node.childNodes.length > 0 ? null : node.textContent,
            attrs: node.nodeType !== 1 ? [] : cog.getAttributes(node.attributes),
            type: node.nodeType === 3 ? 'text' : (node.nodeType === 8 ? 'comment' : node.tagName.toLowerCase()),
            node: node
        };
        var dasRepeat, dasTemplate;
        details.isSVG = isSVG || details.type === 'svg';
        details.isScript = isScript || details.type === 'script';
        if (isRepeat) {
            details.isRepeat = true;
            dasRepeat = true;
        } else {
            details.isRepeat = false;
            dasRepeat = (node.hasAttribute && node.hasAttribute(cog.label.repeat));
        }
        if (isTemplate) {
            details.isTemplate = true;
            dasTemplate = true;
        } else {
            details.isTemplate = false;
            dasTemplate = (node.hasAttribute && node.hasAttribute(cog.label.repeat));
        }
        details.children = cog.createDOMMap(node, details.isSVG, details.isScript, dasRepeat, dasTemplate);
        return details;
    }));
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
cog.loadContents = function (callback) {
    var node, nodeAttr, srcObj;
    node = document.querySelector("[" + cog.label.source + "]:not([" + cog.label.await + "])");
    if (node) {
        nodeAttr = node.getAttribute(cog.label.source);
        srcObj = cog.strToObj(nodeAttr);
        if (!srcObj) {
            srcObj = { url: nodeAttr };
        }
        if (srcObj.cache != null) {
            if (srcObj.cache != 'false') {
                srcObj.cache = true;
            } else {
                srcObj.cache = false;
            }
        }
        if (srcObj.url != null) {
            node.setAttribute(cog.label.await, "");
            cog.xhr(srcObj.url, function (xhr) {
                if (xhr.status == 200) {
                    node.outerHTML = xhr.responseText;
                }
            }, { method: srcObj.method, data: srcObj.data, type: srcObj.type, cache: srcObj.cache });
            cog.loadContents(callback);
        }
    } else {
        if (typeof callback === 'function') {
            if (!document.querySelector("[" + cog.label.source + "][" + cog.label.await + "]")) {
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
    if (arg.data == null) { arg.data = ''; }
    if (arg.async == null) { arg.async = true; }
    var xhr, guid, cacheUrl, hashUrl, key, mergedObj, urlObj;
    arg.method = arg.method.toUpperCase();
    xhr = new XMLHttpRequest();
    if (arg.type != null) {
        xhr.responseType = arg.type;
    }
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