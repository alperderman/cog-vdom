if (typeof window.CustomEvent !== 'function') { window.CustomEvent = function (event, params) { params = params || { bubbles: false, cancelable: false, detail: null }; var evt = document.createEvent('CustomEvent'); evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail); return evt; }; }
var cog = {};
cog.data = {};
cog.props = [];
cog.templates = {};
cog.isRendered = false;
cog.encapVar = null;
cog.cache = true;
cog.label = {
    head: "head",
    escapeAttr: "_",
    escapeTag: "cog-escape",
    prop: "cog-prop",
    set: "cog-set",
    source: "cog-src",
    temp: "cog-temp",
    repeat: "cog-repeat",
    reverse: "cog-reverse",
    if: "cog-if",
    live: "cog-live",
    event: "cog-event",
    await: "cog-await"
};
cog.event = {
    beforeRender: "COGBeforeRender",
    afterRender: "COGAfterRender"
};
cog.keyword = {
    get: "_get",
    set: "_set",
    iterate: "_iterate",
    value: "_value",
    type: "_type",
    token: "_token",
    key: "_key",
    parent: "_parent",
    index: "_index",
    indexNodes: "_indexNodes",
    prevent: "_prevent",
    nodes: "_nodes",
    repeats: "_repeats",
    bound: "_bound"
};
cog.token = {
    open: "{{",
    close: "}}",
    escape: "_"
};
cog.regex = {
    head: new RegExp("<head[^>]*>((.|[\\\n\\\r])*)<\\\/head>", "im"),
    body: new RegExp("<body[^>]*>((.|[\\\n\\\r])*)<\\\/body>", "im"),
    token: new RegExp(cog.token.open + "[\\s\\S]*?" + cog.token.close),
    node: new RegExp("(?:" + cog.token.open + "(.*?)" + cog.token.close + ")|([^]*?)(?=" + cog.token.open + "|$)", "gm")
};
cog.render = function (layoutSrc) {
    var i, layout, scripts;
    step_start();
    function convert_data() {
        cog.data = new cog.observable(cog.data, function (a) {
            cog.rebind(a);
        });
    }
    function step_start() {
        if (typeof layoutSrc === "string") {
            cog.xhr(layoutSrc, function (xhr) {
                if (xhr.status == 200) {
                    layout = xhr.responseText;
                    step_design();
                }
            }, { method: "GET" });
        } else {
            cog.setElems(function () {
                convert_data();
                document.dispatchEvent(new CustomEvent(cog.event.beforeRender));
                if (cog.isElement(layoutSrc)) {
                    cog.bind(layoutSrc);
                } else {
                    cog.bind();
                }
                setTimeout(function () {
                    cog.cleanEscapeTags();
                    scripts = document.querySelectorAll("script[" + cog.label.await + "]");
                    cog.loadScriptsNS(scripts, function () {
                        for (i = 0; i < scripts.length; i++) {
                            scripts[i].removeAttribute(cog.label.await);
                        }
                        step_finish();
                    });
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
                convert_data();
                step_bind();
            });
        }, 0);
    }
    function step_bind() {
        document.dispatchEvent(new CustomEvent(cog.event.beforeRender));
        setTimeout(function () {
            cog.bind(document.body, function () {
                cog.cleanEscapeTags();
                step_scripts();
            });
        }, 0);
    }
    function step_scripts() {
        cog.loadScriptsNS(document.querySelectorAll("script"), function () {
            scripts = document.querySelectorAll("script[" + cog.label.await + "]");
            for (i = 0; i < scripts.length; i++) {
                scripts[i].removeAttribute(cog.label.await);
            }
            cog.DOMLoad();
            step_finish();
        });
    }
    function step_finish() {
        setTimeout(function () {
            cog.scrollToHash();
            cog.isRendered = true;
            document.dispatchEvent(new CustomEvent(cog.event.afterRender));
        }, 0);
    }
};
cog.bind = function (dom, callback) {
    var i, ii, iterator, node, ob, nodeAttr, nodeAttrs, nodeContent, attrKey, attrVal, attrContent, tempNode, tempAttr, tempId, tempToken, tempTokenObj, tempAlias, tempRender, nodeSplitTokens, nodeSplitToken, prop, propType, newNode, attrContentParse, attrContentObj, attrContentObjProp;
    if (dom == null) { dom = document.body; }
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
    cog.bindRepeats(dom);
    iterator = document.createTreeWalker(dom, NodeFilter.SHOW_ELEMENT, function (node) {
        if (!node.hasAttribute(cog.label.escapeTag) && node.tagName !== 'SCRIPT') {
            return NodeFilter.FILTER_ACCEPT;
        } else {
            return NodeFilter.FILTER_REJECT;
        }
    }, false);
    while (node = iterator.nextNode()) {
        nodeAttrs = node.attributes;
        nodeContent = node.textContent;
        for (i = 0; i < nodeAttrs.length; i++) {
            nodeAttr = nodeAttrs[i];
            attrKey = nodeAttr.name;
            attrVal = nodeAttr.value;
            if (attrKey.substring(0, cog.label.escapeAttr.length) == cog.label.escapeAttr) {
                node.removeAttribute(attrKey);
                attrKey = attrKey.substring(cog.label.escapeAttr.length, attrKey.length);
            }
            if (attrKey.indexOf(cog.label.prop) === 0) {
                propType = "prop";
            } else if (attrKey == cog.label.if) {
                propType = "if";
            } else {
                propType = "attr";
            }
            if (cog.regex.token.test(attrVal) || propType != "attr") {
                cog.props.push({ node: node });
                prop = cog.props[cog.props.length - 1];
                if (propType != "attr") {
                    attrContentParse = cog.prepareTokenStr(attrVal);
                    nodeSplitTokens = cog.splitTokens(attrVal, true);
                    for (nodeSplitToken in nodeSplitTokens) {
                        ob = cog.get(nodeSplitToken, true);
                        if (cog.isIndex(nodeSplitToken)) {
                            ob[cog.keyword.indexNodes].push({ prop: prop });
                        } else {
                            ob[cog.keyword.nodes].push({ prop: prop });
                        }
                    }
                    if (propType == "if") {
                        if (cog.if(cog.constructTokenStr(attrContentParse))) {
                            node.style.display = "";
                        } else {
                            node.style.display = "none";
                        }
                        prop.type = "if";
                        prop.content = attrContentParse;
                    } else {
                        attrContentObj = cog.eval("({" + cog.constructTokenStr(attrContentParse) + "})");
                        attrContentObj = cog.propCondition(attrContentObj);
                        if (attrContentObj) {
                            if (attrContentObj.hasOwnProperty("style")) {
                                attrContentObjProp = attrContentObj["style"];
                                for (ii in attrContentObjProp) {
                                    node.style[ii] = attrContentObjProp[ii];
                                }
                            }
                            if (attrContentObj.hasOwnProperty("class")) {
                                if (typeof attrContentObj["class"] === "string") {
                                    attrContentObjProp = attrContentObj["class"].trim().split(" ");
                                } else {
                                    attrContentObjProp = attrContentObj["class"];
                                }
                                for (ii in attrContentObjProp) {
                                    node.classList.add(attrContentObjProp[ii]);
                                }
                            }
                            if (attrContentObj.hasOwnProperty("context")) {
                                attrContentObjProp = attrContentObj["context"];
                                for (ii in attrContentObjProp) {
                                    node[ii] = attrContentObjProp[ii];
                                }
                            }
                            if (attrContentObj.hasOwnProperty("attr")) {
                                attrContentObjProp = attrContentObj["attr"];
                                for (ii in attrContentObjProp) {
                                    node.setAttribute(ii, attrContentObjProp[ii]);
                                }
                            }
                        }
                        prop.type = "prop";
                        prop.content = attrContentParse;
                        prop.old = attrContentObj;
                    }
                    node.removeAttribute(attrKey);
                } else {
                    attrContent = document.createElement("span");
                    attrContent.textContent = attrVal;
                    cog.replaceTextNode(attrContent, cog.splitTokens(attrVal), function (token, pureToken, content, parent, oldNode) {
                        if (cog.isElement(content)) {
                            newNode = cog.bind(content.cloneNode(true));
                        } else {
                            if (typeof content !== 'object') {
                                newNode = document.createTextNode(content);
                            } else {
                                newNode = document.createTextNode(JSON.stringify(content[cog.keyword.get]));
                            }
                        }
                        parent.insertBefore(newNode, oldNode);
                        ob = cog.get(pureToken, true);
                        if (cog.isIndex(pureToken)) {
                            ob[cog.keyword.indexNodes].push({ prop: prop, node: newNode });
                        } else {
                            ob[cog.keyword.nodes].push({ prop: prop, node: newNode });
                        }
                    });
                    node.setAttribute(attrKey, attrContent.textContent);
                    prop.type = "attr";
                    prop.attr = attrKey;
                    prop.content = attrContent;
                }
            }
        }
        if (cog.regex.token.test(nodeContent)) {
            cog.replaceTextNode(node, cog.splitTokens(nodeContent), function (token, pureToken, content, parent, oldNode) {
                if (cog.isElement(content)) {
                    newNode = cog.bind(content.cloneNode(true));
                } else {
                    if (typeof content !== 'object') {
                        newNode = document.createTextNode(content);
                    } else {
                        newNode = document.createTextNode(JSON.stringify(content[cog.keyword.get]));
                    }
                }
                parent.insertBefore(newNode, oldNode);
                ob = cog.get(pureToken, true);
                if (cog.isIndex(pureToken)) {
                    ob[cog.keyword.indexNodes].push(newNode);
                } else {
                    ob[cog.keyword.nodes].push(newNode);
                }
            });
        }
    }
    if (typeof callback === 'function') {
        callback();
    }
    return dom;
};
cog.bindRepeats = function (dom) {
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
        repeatData = cog.get(repeatDataToken, true);
        if (typeof repeatData !== 'undefined') {
            repeatDataLength = repeatData.length;
            repeatDataKey = repeatId + ":" + repeatToken.join(",");
            repeatNode.innerHTML = "";
            if (repeatData[cog.keyword.repeats].hasOwnProperty(repeatDataKey)) {
                repeatNode.innerHTML = repeatData[cog.keyword.repeats][repeatDataKey]["owner"].innerHTML;
                repeatData[cog.keyword.repeats][repeatDataKey]["clone"].push(repeatNode);
            } else {
                repeatData[cog.keyword.repeats][repeatDataKey] = { owner: repeatNode, template: repeatId, dataAlias: repeatAlias[0], alias: cog.shallowClone(repeatTokenObj), clone: [], childs: [] };
                repeatData[cog.keyword.repeats][repeatDataKey]["childs"] = [];
                for (i = 0; i < repeatDataLength; i++) {
                    repeatTokenObj[repeatAlias[0]] = repeatDataToken + "." + i;
                    repeatTemp = cog.template({ id: repeatId, data: repeatTokenObj, fragment: false, bind: true });
                    repeatData[cog.keyword.repeats][repeatDataKey]["childs"][i] = { ob: repeatData[i], nodes: [] };
                    while (repeatTemp.firstChild) {
                        repeatData[cog.keyword.repeats][repeatDataKey]["childs"][i]["nodes"].push(repeatTemp.firstChild);
                        repeatNode.appendChild(repeatTemp.firstChild);
                    }
                }
            }
        }
    }
};
cog.rebind = function (task) {
    var ob;
    ob = task.ob;
    if (task.action == "unshift") {
        cog.spliceRepeats(ob, task.index, task.remove, task.add);
    }
    if (task.action == "shift") {
        cog.spliceRepeats(ob, task.index, task.remove, task.add);
    }
    if (task.action == "push") {
        cog.spliceRepeats(ob, task.index, task.remove, task.add);
    }
    if (task.action == "pop") {
        cog.spliceRepeats(ob, task.index, task.remove, task.add);
    }
    if (task.action == "splice") {
        cog.spliceRepeats(ob, task.index, task.remove, task.add);
    }
    if (task.action == "reverse") {
        cog.correctIndex(ob);
    }
    if (task.action == "sort") {
        cog.correctIndex(ob);
    }
    if (task.action == "set") {
        ob[cog.keyword.iterate](function (cob) {
            cog.rebindNodes(cob[cog.keyword.nodes], cob[cog.keyword.get]);
            cog.rebindNodes(cob[cog.keyword.indexNodes], cob[cog.keyword.index]);
            cog.correctIndex(cob);
            cog.rebound(cob);
        });
    }
    if (task.action == "push" || task.action == "pop") {
        ob[cog.keyword.iterate](function (cob) {
            cog.rebound(cob);
        });
    }
    if (task.action == "unshift" || task.action == "shift" || task.action == "splice" || task.action == "reverse" || task.action == "sort") {
        ob[cog.keyword.iterate](function (cob) {
            cog.rebindNodes(cob[cog.keyword.indexNodes], cob[cog.keyword.index]);
            cog.rebound(cob);
        });
    }
    cog.cloneRepeats(ob);
};
cog.rebound = function (ob) {
    var i, bob;
    for (i in ob[cog.keyword.bound]) {
        bob = ob[cog.keyword.bound][i];
        bob[cog.keyword.iterate](function (cob) {
            cog.rebindNodes(cob[cog.keyword.nodes], cob[cog.keyword.get]);
            cog.rebindNodes(cob[cog.keyword.indexNodes], cob[cog.keyword.index]);
            cog.correctIndex(cob);
        });
        cog.cloneRepeats(bob);
    }
};
cog.correctIndex = function (ob) {
    var i, ii, iii, repeats = ob[cog.keyword.repeats], repeatsKeys, repeatBeforeChildNodes, repeatAfterChildNodes, realIndex, repeat, repeatChilds, checkLRepeat, checkLRepeatChildsLength, checkLRepeatChilds, checkLRepeatChild, repeatChild;
    repeatsKeys = Object.keys(repeats);
    if (!(repeatsKeys.length > 0)) { return; }
    checkLRepeat = ob[cog.keyword.repeats][repeatsKeys[0]];
    checkLRepeatChildsLength = checkLRepeat["childs"].length;
    if (checkLRepeatChildsLength > ob.length) {
        cog.spliceRepeats(ob, ob.length, checkLRepeatChildsLength - ob.length, 0);
    }
    if (checkLRepeatChildsLength < ob.length) {
        cog.spliceRepeats(ob, checkLRepeatChildsLength, 0, ob.length - checkLRepeatChildsLength);
    }
    realIndex = 0;
    checkLRepeatChilds = checkLRepeat["childs"];
    while (realIndex < ob.length) {
        for (i in checkLRepeatChilds) {
            checkLRepeatChild = checkLRepeatChilds[i];
            if (realIndex == checkLRepeatChild["ob"][cog.keyword.index]) {
                if (realIndex != i) {
                    for (ii in repeats) {
                        repeat = repeats[ii];
                        repeatChilds = repeat["childs"];
                        repeatChild = repeatChilds[i];
                        repeatAfterChildNodes = repeatChilds[i]["nodes"];
                        repeatBeforeChildNodes = repeatChilds[realIndex]["nodes"];
                        if (repeatBeforeChildNodes) {
                            for (iii in repeatAfterChildNodes) {
                                repeatBeforeChildNodes[0].parentNode.insertBefore(repeatAfterChildNodes[iii], repeatBeforeChildNodes[0]);
                            }
                        } else {
                            for (iii in repeatAfterChildNodes) {
                                repeat["owner"].appendChild(repeatAfterChildNodes[iii]);
                            }
                        }
                        repeatChilds.splice(i, 1);
                        repeatChilds.splice(realIndex, 0, repeatChild);
                    }
                }
                realIndex++;
                break;
            }
        }
    }
};
cog.cloneRepeats = function (ob) {
    var i, ii, repeats, repeat;
    ob[cog.keyword.iterate](function (cob) {
        repeats = cob[cog.keyword.repeats];
        for (i in repeats) {
            repeat = repeats[i];
            for (ii in repeat["clone"]) {
                repeat["clone"][ii].innerHTML = repeat["owner"].innerHTML;
            }
        }
    });
};
cog.spliceRepeats = function (ob, index, remove, add) {
    var i, ii, iii, repeats = ob[cog.keyword.repeats], repeat, repeatChilds, repeatChild, repeatBeforeChildNodes, sumIndex, repeatAlias, repeatTemp, repeatNewChilds;
    for (i in repeats) {
        repeat = repeats[i];
        if (cog.isInDocument(repeat["owner"])) {
            repeatChilds = repeat["childs"];
            for (ii = 0; ii < remove; ii++) {
                repeatChild = repeatChilds[index + ii];
                for (iii in repeatChild["nodes"]) {
                    repeatChild["nodes"][iii].parentNode.removeChild(repeatChild["nodes"][iii]);
                }
            }
            repeatChilds.splice(index, remove);
            for (ii = 0; ii < add; ii++) {
                sumIndex = index + ii;
                if (repeatChilds[sumIndex] && repeatChilds[sumIndex]["nodes"]) {
                    repeatBeforeChildNodes = repeatChilds[sumIndex]["nodes"];
                } else {
                    repeatBeforeChildNodes = false;
                }
                repeatAlias = cog.shallowClone(repeat["alias"]);
                repeatAlias[repeat["dataAlias"]] = ob[cog.keyword.token] + "." + sumIndex;
                repeatTemp = cog.template({ id: repeat["template"], data: repeatAlias, fragment: false, bind: true, parent: repeat });
                repeatNewChilds = [];
                if (repeatBeforeChildNodes) {
                    while (repeatTemp.firstChild) {
                        repeatNewChilds.push(repeatTemp.firstChild);
                        repeatBeforeChildNodes[0].parentNode.insertBefore(repeatTemp.firstChild, repeatBeforeChildNodes[0]);
                    }
                } else {
                    while (repeatTemp.firstChild) {
                        repeatNewChilds.push(repeatTemp.firstChild);
                        repeat["owner"].appendChild(repeatTemp.firstChild);
                    }
                }
                repeatChilds.splice(sumIndex, 0, { ob: ob[sumIndex], nodes: repeatNewChilds });
            }
        } else {
            delete ob[cog.keyword.repeats][i];
        }
    }
};
cog.rebindNodes = function (nodes, content) {
    var i, ii, node, prop, attrContentObj, attrContentObjProp;
    for (i = 0; i < nodes.length; i++) {
        node = nodes[i];
        if (node.hasOwnProperty("prop")) {
            prop = node.prop;
            if (cog.isInDocument(prop.node)) {
                if (prop.type == "prop") {
                    attrContentObj = cog.eval("({" + cog.constructTokenStr(prop.content) + "})");
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
                                prop.node.classList.remove(attrContentObjProp[ii]);
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
                                prop.node.classList.add(attrContentObjProp[ii]);
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
                    if (cog.if(cog.constructTokenStr(prop.content))) {
                        prop.node.style.display = "";
                    } else {
                        prop.node.style.display = "none";
                    }
                } else if (prop.type == "attr") {
                    if (node.node.nodeValue != content) {
                        node.node.nodeValue = content;
                        prop.node.setAttribute(prop.attr, prop.content.innerHTML);
                    }
                }
            } else {
                nodes.splice(i, 1);
                cog.props.splice(cog.props.indexOf(prop), 1);
            }
        } else {
            if (cog.isInDocument(node)) {
                if (!cog.isElement(content) && node.nodeValue != content) {
                    node.nodeValue = content;
                } else if (cog.isElement(content)) {
                    cloneNode = cog.bind(content.cloneNode(true));
                    node.parentNode.replaceChild(cloneNode, node);
                    nodes[i] = cloneNode;
                }
            } else {
                nodes.splice(i, 1);
            }
        }
    }
};
cog.addBound = function (dataKeys, targetKeys) {
    if (!cog.isRendered) {
        document.addEventListener(cog.event.afterRender, function () {
            cog.addBound(dataKeys, targetKeys);
        });
    } else {
        var changed = cog.get(dataKeys, true), changee = cog.get(targetKeys, true);
        if (typeof changed !== 'undefined' && typeof changee !== 'undefined') {
            if (changed[cog.keyword.bound].indexOf(changee) === -1) {
                changed[cog.keyword.bound].push(changee);
            }
            if (changee[cog.keyword.bound].indexOf(changed) === -1) {
                changee[cog.keyword.bound].push(changed);
            }
        }
    }
};
cog.removeBound = function (dataKeys, targetKeys) {
    if (!cog.isRendered) {
        document.addEventListener(cog.event.afterRender, function () {
            cog.removeBound(dataKeys, targetKeys);
        });
    } else {
        var changed = cog.get(dataKeys, true), changee = cog.get(targetKeys, true);
        if (typeof changed !== 'undefined' && typeof changee !== 'undefined') {
            if (changed[cog.keyword.bound].indexOf(changee) !== -1) {
                changed[cog.keyword.bound].splice(changed[cog.keyword.bound].indexOf(changee), 1);
            }
            if (changee[cog.keyword.bound].indexOf(changed) !== -1) {
                changee[cog.keyword.bound].splice(changee[cog.keyword.bound].indexOf(changed), 1);
            }
        }
    }
};
cog.get = function (keys, ob) {
    var i, parentKeys, key, keysLength, ref = cog.data, refType;
    if (ob == null) { ob = false; }
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    keysLength = keys.length;
    if (ob && keys[keysLength - 1] == cog.keyword.index) {
        keys.pop();
        return cog.get(keys, true);
    }
    for (i = 0; i < keysLength; i++) {
        key = keys[i];
        if (!ref.hasOwnProperty(key)) {
            return undefined;
        }
        ref = ref[key];
    }
    if (!ob && ref instanceof cog.observable) {
        refType = ref[cog.keyword.type];
        if (refType !== 'object' && refType !== 'array') {
            ref = ref[cog.keyword.get];
        }
    }
    if (typeof ref === 'function') {
        parentKeys = cog.shallowClone(keys);
        parentKeys.pop();
        ref = ref(parentKeys, keys);
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
cog.template = function (arg) {
    var i, ii, iii, iterator, node, nodeAttr, nodeAttrs, nodeContent, aliasKeysLength, aliasKeys, aliasKey, aliasKeyArr, aliasKeyArrLength, aliasKeyArrResult, aliasReplace, aliasNode, aliasNodeItem, alias, tempNode, props, prop, cloneNode, newNode, tokenArr, attrContent, attrKey, attrVal, nodeSplitTokens;
    if (arg.id == null) { return; }
    if (arg.fragment == null) { arg.fragment = false; }
    if (arg.bind == null) { arg.bind = false; }
    if (cog.templates[arg.id] == null && arg.node != null) {
        cog.templates[arg.id] = { alias: {}, props: [], node: arg.node.cloneNode(true) };
        if (arg.alias != null) {
            aliasKeysLength = arg.alias.length;
            for (i = 0; i < aliasKeysLength; i++) {
                cog.templates[arg.id]["alias"][arg.alias[i]] = [];
            }
            tempNode = cog.templates[arg.id]["node"];
            tempNode.removeAttribute(cog.label.repeat);
            tempNode.removeAttribute(cog.label.temp);
            alias = cog.templates[arg.id]["alias"];
            props = cog.templates[arg.id]["props"];
            aliasKeys = arg.alias;
            iterator = document.createTreeWalker(tempNode, NodeFilter.SHOW_ELEMENT, function (node) {
                if (!node.hasAttribute(cog.label.escapeTag) && node.tagName !== 'SCRIPT') {
                    return NodeFilter.FILTER_ACCEPT;
                } else {
                    return NodeFilter.FILTER_REJECT;
                }
            }, false);
            while (node = iterator.nextNode()) {
                nodeAttrs = node.attributes;
                nodeContent = node.textContent;
                for (i = 0; i < nodeAttrs.length; i++) {
                    nodeAttr = nodeAttrs[i];
                    attrKey = nodeAttr.name;
                    attrVal = nodeAttr.value;
                    if (cog.regex.token.test(attrVal)) {
                        attrContent = document.createElement("span");
                        attrContent.textContent = attrVal;
                        nodeSplitTokens = cog.splitTokens(attrVal, true);
                        props.push({ node: node, attr: attrKey });
                        prop = props[props.length - 1];
                        cog.replaceTextNode(attrContent, nodeSplitTokens, function (token, pureToken, content, parent, oldNode) {
                            tokenArr = pureToken.split(".");
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
                                newNode = document.createTextNode(aliasKey);
                                if (attrKey == cog.label.repeat || attrKey == cog.label.temp) {
                                    parent.insertBefore(newNode, oldNode);
                                    parent.insertBefore(document.createTextNode(pureToken.replace(aliasKey, '')), oldNode);
                                } else {
                                    parent.insertBefore(document.createTextNode(cog.token.open), oldNode);
                                    parent.insertBefore(newNode, oldNode);
                                    parent.insertBefore(document.createTextNode(pureToken.replace(aliasKey, '')), oldNode);
                                    parent.insertBefore(document.createTextNode(cog.token.close), oldNode);
                                }
                                alias[aliasKey].push({ prop: prop, node: newNode });
                            } else {
                                parent.insertBefore(document.createTextNode(token), oldNode);
                            }
                        });
                        node.setAttribute(attrKey, attrContent.textContent);
                        prop["content"] = attrContent;
                    }
                }
                if (cog.regex.token.test(nodeContent)) {
                    cog.replaceTextNode(node, cog.splitTokens(nodeContent, true), function (token, pureToken, content, parent, oldNode) {
                        tokenArr = pureToken.split(".");
                        aliasKeyArrResult = false;
                        for (i = 0; i < aliasKeysLength; i++) {
                            aliasKey = aliasKeys[i];
                            aliasKeyArr = aliasKey.split(".");
                            aliasKeyArrLength = aliasKeyArr.length;
                            for (ii = 0; ii < aliasKeyArrLength; ii++) {
                                if (aliasKeyArr[ii] != tokenArr[ii]) {
                                    break;
                                }
                                if (ii == aliasKeyArrLength - 1) {
                                    aliasKeyArrResult = true;
                                }
                            }
                            if (aliasKeyArrResult) {
                                break;
                            }
                        }
                        if (aliasKeyArrResult) {
                            newNode = document.createTextNode(aliasKey);
                            parent.insertBefore(document.createTextNode(cog.token.open), oldNode);
                            parent.insertBefore(newNode, oldNode);
                            parent.insertBefore(document.createTextNode(pureToken.replace(aliasKey, '')), oldNode);
                            parent.insertBefore(document.createTextNode(cog.token.close), oldNode);
                            alias[aliasKey].push(newNode);
                        } else {
                            parent.insertBefore(document.createTextNode(token), oldNode);
                        }
                    });
                }
            }
        }
    }
    if (cog.templates[arg.id] != null && arg.node == null) {
        tempNode = cog.templates[arg.id]["node"];
        if (arg.data != null) {
            alias = cog.templates[arg.id]["alias"];
            aliasKeys = Object.keys(alias);
            aliasKeysLength = aliasKeys.length;
            for (i = 0; i < aliasKeysLength; i++) {
                aliasKey = aliasKeys[i];
                if (arg.data.hasOwnProperty(aliasKey)) {
                    aliasReplace = arg.data[aliasKey];
                    aliasNode = alias[aliasKey];
                    for (ii in aliasNode) {
                        aliasNodeItem = aliasNode[ii];
                        if (aliasNodeItem.hasOwnProperty("prop")) {
                            newNode = document.createTextNode(aliasReplace);
                            aliasNodeItem.node.parentNode.replaceChild(newNode, aliasNodeItem.node);
                            aliasNode[ii].node = newNode;
                            prop = aliasNodeItem.prop;
                            prop.node.setAttribute(prop.attr, prop.content.innerHTML);
                        } else {
                            newNode = document.createTextNode(aliasReplace);
                            aliasNodeItem.parentNode.replaceChild(newNode, aliasNodeItem);
                            aliasNode[ii] = newNode;
                        }
                    }
                }
            }
        }
        cloneNode = document.createElement(tempNode.tagName);
        cloneNode.innerHTML = tempNode.innerHTML;
        if (arg.bind) {
            cloneNode = cog.bind(cloneNode);
        }
        if (arg.fragment) {
            return cog.elemFragment(cloneNode);
        } else {
            return cloneNode;
        }
    }
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
                propData = cog.isJSON(setElem.textContent);
                if (propData) {
                    cog.set(setKeys, propData);
                }
            }
            if (setType == "raw") {
                propData = cog.eval("(" + setElem.textContent + ")");
                cog.set(setKeys, propData);
            }
            if (setType == "text") {
                cog.set(setKeys, setElem.textContent);
            }
            if (setType == "html") {
                cog.extractAssets(setElem);
                cog.set(setKeys, cog.elemFragment(setElem));
            }
            if (setType == "temp") {
                cog.extractAssets(setElem);
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
            head.removeAttribute(cog.label.head);
            document.head.appendChild(head);
        }
        if (typeof callback === 'function') {
            callback();
        }
    });
};
cog.observable = function (value, callback, parent) {
    if (value instanceof cog.observable) { return value; }
    var _self = this, _value, _init = false, _parent, _bound = [], _nodes = [], _index, _indexNodes = [], _repeats = {}, _obType;
    if (typeof callback !== 'function') {
        callback = function () { };
    }
    if (parent == null) {
        _parent = undefined;
    } else {
        _parent = parent;
    }
    Object.defineProperty(_self, "defineNewObservable", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: function (key, val, func) {
            var type, definee;
            if (typeof func === 'function') {
                if (val instanceof cog.observable) {
                    val = new cog.observable(val[cog.keyword.get], callback, _self);
                } else {
                    val = new cog.observable(val, callback, _self);
                }
                func(val);
                return val;
            } else {
                definee = _self[cog.keyword.value][key];
                if (definee instanceof cog.observable) {
                    type = definee[cog.keyword.type];
                    if (type === 'array' || type === 'object') {
                        if (val instanceof cog.observable) {
                            val = new cog.observable(val[cog.keyword.get], callback, _self);
                        } else {
                            val = new cog.observable(val, callback, _self);
                        }
                        definee[cog.keyword.iterate](function (ob, obKeys) {
                            if (obKeys.length > 0) {
                                var obExists = true, obVal = val, obType, i, ii, obKey;
                                for (i in obKeys) {
                                    obKey = obKeys[i];
                                    if (obVal[cog.keyword.value].hasOwnProperty(obKey)) {
                                        obVal = obVal[cog.keyword.value][obKey];
                                    } else {
                                        obExists = false;
                                        if (ob[cog.keyword.parent][cog.keyword.type] === 'array') {
                                            for (ii = obKey; ii < ob[cog.keyword.parent].length; ii++) {
                                                delete ob[cog.keyword.parent][ii];
                                            }
                                            ob[cog.keyword.parent][cog.keyword.value].splice(obKey, ob[cog.keyword.parent].length - obKey);
                                        } else {
                                            delete ob[cog.keyword.parent][obKey];
                                            delete ob[cog.keyword.parent][cog.keyword.value][obKey];
                                        }
                                        break;
                                    }
                                }
                                if (obExists) {
                                    obType = ob[cog.keyword.type];
                                    if (obType !== 'array' && obType !== 'object') {
                                        ob[cog.keyword.value] = obVal[cog.keyword.value];
                                    }
                                }
                            }
                        });
                        val[cog.keyword.iterate](function (ob, obKeys) {
                            if (obKeys.length > 0) {
                                var obVal = definee, i, obNew;
                                for (i in obKeys) {
                                    if (obVal[cog.keyword.value].hasOwnProperty(obKeys[i])) {
                                        obVal = obVal[cog.keyword.value][obKeys[i]];
                                    } else {
                                        obNew = new cog.observable(ob[cog.keyword.get], callback, obVal);
                                        if (obVal[cog.keyword.type] === 'array') {
                                            obNew[cog.keyword.index] = obKeys[i];
                                        }
                                        obVal[cog.keyword.value][obKeys[i]] = obNew;
                                        obVal.defineNewProperty(obKeys[i]);
                                        break;
                                    }
                                }
                            }
                        });
                    } else {
                        if (val instanceof cog.observable) {
                            val = val[cog.keyword.get];
                        }
                        definee[cog.keyword.value] = val;
                    }
                    return definee;
                } else {
                    if (val instanceof cog.observable) {
                        val = new cog.observable(val[cog.keyword.get], callback, _self);
                    } else {
                        val = new cog.observable(val, callback, _self);
                    }
                    _self[cog.keyword.value][key] = val;
                    return val;
                }
            }
        }
    });
    Object.defineProperty(_self, "defineNewProperty", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: function (key) {
            if (!_self.hasOwnProperty(key)) {
                Object.defineProperty(_self, key, {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        return _self[cog.keyword.value][key];
                    },
                    set: function (val) {
                        _self[cog.keyword.set].apply(_self, [val, key]);
                    }
                });
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.token, {
        configurable: false,
        enumerable: false,
        get: function () {
            var keys = [], selfParent = _self, selfValue = _self;
            while (selfParent = selfParent[cog.keyword.parent]) {
                keys.unshift(cog.getKeyByValue(selfParent[cog.keyword.value], selfValue));
                selfValue = selfParent;
            }
            return keys.join(".");
        }
    });
    Object.defineProperty(_self, cog.keyword.key, {
        configurable: false,
        enumerable: false,
        get: function () {
            var key;
            if (_self[cog.keyword.parent]) {
                key = cog.getKeyByValue(_self[cog.keyword.parent], _self);
            }
            return key;
        }
    });
    Object.defineProperty(_self, cog.keyword.get, {
        configurable: false,
        enumerable: false,
        get: function () {
            var obType = _self[cog.keyword.type];
            if (obType === 'array' || obType === 'object') {
                var data, i;
                if (obType === 'array') {
                    data = [];
                } else {
                    data = {};
                }
                for (i in _self) {
                    data[i] = _self[i][cog.keyword.get];
                }
                return data;
            } else {
                return _self[cog.keyword.value];
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.set, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: function (val, key) {
            var o = _self.defineNewObservable(key, val);
            _self.defineNewProperty(key);
            if (_init) {
                callback({
                    action: "set",
                    value: o[cog.keyword.get],
                    ob: o
                });
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.iterate, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: function (func, obKeys) {
            if (typeof func === 'function') {
                if (obKeys == null) { obKeys = [] }
                func(_self, obKeys);
                var obType = _self[cog.keyword.type], obKey;
                if (obType === 'array' || obType === 'object') {
                    for (obKey in _self[cog.keyword.value]) {
                        _self[cog.keyword.value][obKey][cog.keyword.iterate](func, obKeys.concat([obKey]));
                    }
                }
            }
        }
    });
    Object.defineProperty(_self, cog.keyword.nodes, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _nodes
    });
    Object.defineProperty(_self, cog.keyword.index, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _index
    });
    Object.defineProperty(_self, cog.keyword.indexNodes, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _indexNodes
    });
    Object.defineProperty(_self, cog.keyword.repeats, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _repeats
    });
    Object.defineProperty(_self, cog.keyword.bound, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _bound
    });
    Object.defineProperty(_self, cog.keyword.value, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: _value
    });
    Object.defineProperty(_self, cog.keyword.type, {
        configurable: false,
        enumerable: false,
        get: function () {
            return cog.checkType(value);
        }
    });
    Object.defineProperty(_self, cog.keyword.parent, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: _parent
    });
    if (_parent && _parent[cog.keyword.type] === 'array') {
        _self[cog.keyword.index] = _parent[cog.keyword.value].indexOf(_self);
    }
    _obType = _self[cog.keyword.type];
    if (_obType === 'array' || _obType === 'object') {
        if (_obType === 'array') {
            _self[cog.keyword.value] = [];
            Object.defineProperty(_self, "push", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    var index, ln, args = [], valueLength = _self[cog.keyword.value].length, argumentsLength = arguments.length, o;
                    for (var i = 0, ln = argumentsLength; i < ln; i++) {
                        index = _self[cog.keyword.value].length;
                        o = _self.defineNewObservable(index, arguments[i], function (v) {
                            _self[cog.keyword.value].push(v);
                            v[cog.keyword.index] = index;
                        });
                        _self.defineNewProperty(index);
                        args.push(o[cog.keyword.get]);
                    }
                    if (_init) {
                        callback({
                            action: "push",
                            args: args,
                            index: valueLength,
                            remove: 0,
                            add: argumentsLength,
                            ob: _self
                        });
                    }
                    return _self[cog.keyword.value].length;
                }
            });
            Object.defineProperty(_self, "pop", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    var valueLength = _self[cog.keyword.value].length;
                    if (valueLength > -1) {
                        var index = valueLength - 1,
                            item = _self[cog.keyword.value].pop();
                        delete _self[index];
                        callback({
                            action: "pop",
                            index: valueLength - 1,
                            remove: 1,
                            add: 0,
                            ob: _self
                        });
                        return item;
                    }
                }
            });
            Object.defineProperty(_self, "reverse", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    if (_self[cog.keyword.value].length > -1) {
                        var item = _self[cog.keyword.value].reverse(), index;
                        for (index in _self[cog.keyword.value]) {
                            _self[cog.keyword.value][index][cog.keyword.index] = index;
                        }
                        callback({
                            action: "reverse",
                            ob: _self
                        });
                        return item;
                    }
                }
            });
            Object.defineProperty(_self, "sort", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    if (_self[cog.keyword.value].length > -1) {
                        var item = _self[cog.keyword.get], index;
                        item.sort();
                        _self[cog.keyword.parent][cog.keyword.set](item, _self[cog.keyword.key]);
                        for (index in _self[cog.keyword.value]) {
                            _self[cog.keyword.value][index][cog.keyword.index] = index;
                        }
                        callback({
                            action: "sort",
                            ob: _self
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
                    var i, ln, argumentsLength = arguments.length, args = [], o, index;
                    for (i = 0, ln = argumentsLength; i < ln; i++) {
                        o = _self.defineNewObservable(i, arguments[i], function (v) {
                            _self[cog.keyword.value].splice(i, 0, v);
                            for (index in _self[cog.keyword.value]) {
                                _self[cog.keyword.value][index][cog.keyword.index] = index;
                            }
                        });
                        _self.defineNewProperty(_self[cog.keyword.value].length - 1);
                        args.push(o[cog.keyword.get]);
                    }
                    callback({
                        action: "unshift",
                        args: args,
                        index: 0,
                        remove: 0,
                        add: argumentsLength,
                        ob: _self
                    });
                    return _self[cog.keyword.value].length;
                }
            });
            Object.defineProperty(_self, "shift", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: function () {
                    if (_self[cog.keyword.value].length > -1) {
                        var item = _self[cog.keyword.value].shift(), index;
                        delete _self[_self[cog.keyword.value].length];
                        for (index in _self[cog.keyword.value]) {
                            _self[cog.keyword.value][index][cog.keyword.index] = index;
                        }
                        callback({
                            action: "shift",
                            index: 0,
                            remove: 1,
                            add: 0,
                            ob: _self
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
                    var removed = [], item, args = [index, howMany], valueLength = _self[cog.keyword.value].length, o, i, ln;
                    index = index == null ? 0 : index < 0 ? valueLength + index : index;
                    howMany = howMany == null ? valueLength - index : howMany > 0 ? howMany : 0;
                    var pargs = [index, howMany];
                    while (howMany--) {
                        item = _self[cog.keyword.value].splice(index, 1)[0];
                        removed.push(item);
                        delete _self[_self[cog.keyword.value].length];
                    }
                    for (i = 2, ln = arguments.length; i < ln; i++) {
                        o = _self.defineNewObservable(index, arguments[i], function (v) {
                            _self[cog.keyword.value].splice(index, 0, v);
                        });
                        _self.defineNewProperty(_self[cog.keyword.value].length - 1);
                        args.push(o[cog.keyword.get]);
                        index++;
                    }
                    for (i = args[0], ln = _self[cog.keyword.value].length; i < ln; i++) {
                        _self[cog.keyword.value][i][cog.keyword.index] = i;
                    }
                    callback({
                        action: "splice",
                        args: args,
                        index: pargs[0],
                        remove: pargs[1],
                        add: arguments.length - 2 < 0 ? 0 : arguments.length - 2,
                        ob: _self
                    });
                    return removed;
                }
            });
            Object.defineProperty(_self, "length", {
                configurable: false,
                enumerable: false,
                get: function () {
                    return _self[cog.keyword.value].length;
                },
                set: function (val) {
                    var n = Number(val);
                    var length = _self[cog.keyword.value].length;
                    if (n % 1 === 0 && n >= 0) {
                        if (n < length) {
                            _self.splice(n);
                        } else if (n > length) {
                            _self.push.apply(_self, new Array(n - length));
                        }
                    } else {
                        throw new RangeError("Invalid array length");
                    }
                    _self[cog.keyword.value].length = n;
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
            _self[cog.keyword.value] = {};
            for (var i in value) {
                _self.defineNewObservable(i, value[i]);
                _self.defineNewProperty(i);
            }
        }
    } else {
        _self[cog.keyword.value] = value;
    }
    _init = true;
};
cog.checkType = function (input) {
    var typeString = Object.prototype.toString.call(input);
    return typeString.slice(8, typeString.length - 1).toLowerCase();
};
cog.getKeyByValue = function (obj, val) {
    if (Array.isArray(obj)) {
        return obj.indexOf(val);
    } else {
        var key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (obj[key] === val) {
                    return key;
                }
            }
        }
    }
};
cog.isIndex = function (keys) {
    if (typeof keys === 'string') {
        keys = keys.split(".");
    }
    return keys[keys.length - 1] == cog.keyword.index;
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
cog.replaceTextNode = function (elem, replace, callback) {
    if (Object.keys(replace).length === 0) { return; }
    var nodes = [], i = 0, parent, idx, oldNode, token, content, pureToken;
    var iterator = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT, function (node) {
        if (cog.regex.token.test(node.nodeValue)) {
            return NodeFilter.FILTER_ACCEPT;
        } else {
            return NodeFilter.FILTER_REJECT;
        }
    }, false);
    while (iterator.nextNode()) {
        nodes.push(iterator.currentNode);
    }
    while (parent = nodes[i]) {
        for (pureToken in replace) {
            token = cog.token.open + pureToken + cog.token.close;
            idx = parent.nodeValue.indexOf(token);
            if (idx == -1) { continue; }
            content = replace[pureToken];
            oldNode = parent.splitText(idx);
            oldNode.nodeValue = oldNode.nodeValue.replace(token, '');
            callback(token, pureToken, content, parent.parentNode, oldNode);
            if (cog.regex.token.test(oldNode.nodeValue)) {
                nodes.splice(i + 1, 0, oldNode);
            } else {
                break;
            }
        }
        i++;
    }
};
cog.splitTokens = function (str, isList) {
    var m, result = {}, content;
    if (isList == null) { isList = false; }
    cog.regex.node.lastIndex = 0;
    while ((m = cog.regex.node.exec(str)) !== null) {
        if (m.index === cog.regex.node.lastIndex) {
            cog.regex.node.lastIndex++;
        }
        if (m[0] != "") {
            if (m[1] !== undefined && !result.hasOwnProperty(m[0])) {
                if (isList) {
                    result[m[1]] = "";
                } else {
                    content = cog.get(m[1]);
                    if (content !== undefined) {
                        result[m[1]] = content;
                    }
                }
            }
        }
    }
    return result;
};
cog.prepareTokenStr = function (str) {
    var m, result = [], content;
    cog.regex.node.lastIndex = 0;
    while ((m = cog.regex.node.exec(str)) !== null) {
        if (m.index === cog.regex.node.lastIndex) {
            cog.regex.node.lastIndex++;
        }
        if (m[0] != "") {
            if (m[1] !== undefined) {
                content = cog.get(m[1], true);
                if (content !== undefined) {
                    result.push(content);
                }
            } else {
                result.push(m[0]);
            }
        }
    }
    return result;
};
cog.constructTokenStr = function (arr) {
    var i, val, result = "";
    for (i = 0; i < arr.length; i++) {
        val = arr[i];
        if (val instanceof cog.observable) {
            result = result + 'cog.get("' + val[cog.keyword.token] + '")';
        } else {
            result = result + val;
        }
    }
    return result;
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
cog.scrollToHash = function () {
    if (window.location.hash.slice(1) && document.getElementById(window.location.hash.slice(1))) {
        document.getElementById(window.location.hash.slice(1)).scrollIntoView();
    }
};
cog.cleanEscapeTags = function () {
    var i, elems = document.querySelectorAll("[" + cog.label.escapeTag + "]"), elem;
    for (i = 0; i < elems.length; i++) {
        elem = elems[i];
        elem.removeAttribute(cog.label.escapeTag);
    }
};
cog.extractAssets = function (elem) {
    if (elem == null) { elem = document; }
    var i, links = elem.getElementsByTagName("link"), link, styles = elem.getElementsByTagName("style"), style, scripts = elem.getElementsByTagName("script"), script;
    for (i = 0; i < links.length; i++) {
        link = links[i];
        document.head.appendChild(link);
        link.href = link.href;
    }
    for (i = 0; i < styles.length; i++) {
        style = styles[i];
        document.head.appendChild(style);
    }
    for (i = 0; i < scripts.length; i++) {
        script = scripts[i];
        script.setAttribute(cog.label.await, "");
        document.body.appendChild(script);
    }
};
cog.eventListener = function (event) {
    cog.eventHandler(event);
};
cog.eventHandler = function (event, elem) {
    if (!elem) { elem = event.target; }
    if (typeof elem.getAttribute !== 'function') { return; }
    var events, attrEvents, prevent = false, i, ii, attr;
    attr = elem.getAttribute(cog.label.live);
    if (attr != null) {
        attr = attr.trim();
        if (attr[0] == "{") {
            attrEvents = cog.eval("([" + attr + "])");
        } else {
            attrEvents = cog.eval("([{" + attr + "}])");
        }
        for (i in attrEvents) {
            events = cog.propCondition(attrEvents[i]);
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
    }
    attr = elem.getAttribute(cog.label.event);
    if (attr != null) {
        attr = attr.trim();
        if (attr[0] == "{") {
            attrEvents = cog.eval("([" + attr + "])");
        } else {
            attrEvents = cog.eval("([{" + attr + "}])");
        }
        for (i in attrEvents) {
            events = cog.propCondition(attrEvents[i]);
            if (events) {
                for (ii in events) {
                    if (ii == event.type) {
                        if (typeof events[ii] === 'function') {
                            events[ii]();
                        } else {
                            cog.eval(events[ii]);
                        }
                    }
                }
                if (events.hasOwnProperty(cog.keyword.prevent) && cog.if(events[cog.keyword.prevent])) {
                    prevent = true;
                }
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
        srcObj = cog.eval("({" + nodeAttr + "})");
        if (typeof srcObj !== "object") {
            srcObj = { url: nodeAttr };
        }
        if (srcObj.text == null || srcObj.text == 'false') {
            srcObj.text = false;
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
                    if (srcObj.text) {
                        node.parentNode.insertBefore(document.createTextNode(xhr.responseText), node);
                        node.parentNode.removeChild(node);
                    } else {
                        node.outerHTML = xhr.responseText;
                    }
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
cog.init = function () {
    cog.addEventListenerAll(document.documentElement, cog.eventListener);
};
cog.init();