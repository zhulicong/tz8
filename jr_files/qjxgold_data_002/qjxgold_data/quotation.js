var g_push = { doc: null, frame: null, url: "../../quotation.dll?fields=" };
var g_quotation_desc = {
    first_pass: true,
    symbols: {},
    fields: {},
    req_fields: {},
    symbol_data: []
};

function format_intval(v, digits) {
    var txt = "";

    if (digits > 0) {
        var pow = Math.pow(10, digits);

        if (v < pow && v > -pow) {
            if (v < 0) { txt = "-0."; v = -v; }
            else { txt = "0."; }
            var tmp = "" + v;
            for (var i = tmp.length; i < digits; i++) txt += "0";
            txt += tmp;
            return txt;
        }

        txt += v / pow;
        if (txt.indexOf("e") != -1) return "-";

        var idx = txt.indexOf(".");
        if (idx == -1) { txt += "."; idx = txt.length - 1; }
        for (var i = txt.length - idx - 1; i < digits; i++) txt += "0";

        return txt;
    }

    txt += v;
    return txt;
}

function format_float(val, digits) {
    var txt = "";
    if (digits > 0) {
        var v = Math.round(val * Math.pow(10, digits));
        return format_intval(v, digits);
    } else {
        txt += Math.round(val);
        return txt;
    }
}

function do_iepush(url) {
    if (null == g_push.doc) {
        g_push.doc = new ActiveXObject("htmlfile");

        var txt = '<html><head></head><body></body></html>';

        g_push.doc.open();
        g_push.doc.write(txt);
        g_push.doc.close();

        g_push.doc.parentWindow.cb = function (txt) { on_push(txt); }

        g_push.frame = g_push.doc.createElement("DIV");
        g_push.doc.body.appendChild(g_push.frame);
    }

    g_push.frame.innerHTML = '<IFRAME src="' + url + '"></IFRAME>';
}

function do_push(url) {
    var ua = navigator.userAgent;
    ua = ua.toLowerCase();
    if (ua.indexOf("msie") != -1 && ua.indexOf("opera") == -1) {
        document.execCommand("BackgroundImageCache", false, true);
        do_iepush(url);
    } else if (ua.indexOf("webkit") != -1) {
        if (g_push.doc) g_push.doc.close();

        g_push.doc = new EventSource(url);
        g_push.doc.onmessage = function (evt) { on_push(evt.data); }
    } else {
        g_push.doc = new XMLHttpRequest();
        g_push.doc.multipart = true;
        g_push.doc.onreadystatechange = function () {
            if (g_push.doc.readyState == 3) {
                on_push(g_push.doc.responseText);
            }
        }
        g_push.doc.open("GET", url);
        g_push.doc.send();
    }
}

function stop_push() {
    var ua = navigator.userAgent;
    ua = ua.toLowerCase();
    if (ua.indexOf("msie") != -1 && ua.indexOf("opera") == -1) {
        if (g_push.frame) {
            g_push.frame.innerHTML = "";
        }
    } else {
        if (g_push.doc) {
            if (g_push.doc.close) g_push.doc.close();
            else if (g_push.doc.abort) g_push.doc.abort();
            g_push.doc = null;
        }
    }

    clearInterval(g_push.taskid);
    g_push.taskid = undefined;
}

function count_req_fields() {
    var cnt = 0;
    for (var item in g_quotation_desc.req_fields) cnt++;
    return cnt;
}

function add_req_fields(field) {
    if (g_quotation_desc.req_fields[field] == undefined) {
        g_quotation_desc.req_fields[field] = count_req_fields();
    }
}

function update_quotation_grid(gridid) {
    if (gridid == undefined) gridid = "quotation_grid";

    if (g_push.doc != null || g_push.frame != null) {
        stop_push();
    }

    g_quotation_desc = {
        gid: gridid,
        first_pass: true,
        symbols: {},
        fields: {},
        req_fields: {},
        symbol_data: []
    };

    var grid = document.getElementById(gridid);
    g_quotation_desc.grid = grid;

    var row0 = grid.rows[0];
    for (var i = 0; i < row0.cells.length; i++) {
        var field = row0.cells[i].getAttribute("field");
        if (field != undefined && field != "") {
            g_quotation_desc.fields[field] = i;
        }
    }

    var len = grid.rows.length;
    for (var i = 1; i < len; i++) {
        if (grid.rows[i].parentNode.nodeName.toUpperCase() == "TFOOT")
            break;

        g_quotation_desc.symbols[grid.rows[i].cells[0].innerHTML] = i;

        // get_max_col
        var max = 0;
        for (var field in g_quotation_desc.fields) {
            if (g_quotation_desc.fields[field] > max)
                max = g_quotation_desc.fields[field];
        }

        // append columns
        var curcols = grid.rows[i].cells.length;
        for (var j = curcols; j < max + 1; j++) {
            var cell = document.createElement("td");
            grid.rows[i].appendChild(cell);
        }
    }

    // prepare req fields.
    add_req_fields("Price");
    add_req_fields("LastSettle");
    for (var field in g_quotation_desc.fields) {
        switch (field) {
            case "Fluctuatation":
            case "FluctuatationRate":
            case "Name":
            case "Arrow":
                break;
            case "Settle":
            case "Open":
            case "Close":
            case "High":
            case "Low":
            case "Volume":
            case "Amount":
                add_req_fields(field);
                break;
        }
    }

    var reqstr = g_push.url;
    for (var field in g_quotation_desc.req_fields) {
        reqstr += field;
        reqstr += ",";
    }
    reqstr += "&symbols=";
    for (var sym in g_quotation_desc.symbols) {
        reqstr += sym;
        reqstr += ",";
    }
    do_push(reqstr);
}

function on_push(txt) {
    var data = eval(txt);
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (item == null || item == undefined)
            continue;

        var quotation = undefined;
        if (g_quotation_desc.first_pass) {
            g_quotation_desc.symbol_data[i] = {};
            quotation = g_quotation_desc.symbol_data[i];
            quotation.Symbol = item[0];
            quotation.Name = item[1];
            quotation.Digits = item[2];
            quotation.updown = 0;

            for (var req_field in g_quotation_desc.req_fields) {
                quotation[req_field] = item[g_quotation_desc.req_fields[req_field] + 3];
            }
        } else {
            quotation = g_quotation_desc.symbol_data[item[0]];
            for (var req_field in g_quotation_desc.req_fields) {
                var qval = item[g_quotation_desc.req_fields[req_field] + 1];
                if (qval == undefined) continue;

                if (req_field == "Price") {
                    quotation.updown = qval;
                }

                quotation[req_field] += qval; // Math.pow(10, quotation.Digits);
            }
        }

        if (quotation.Price > 0 && quotation.LastSettle > 0) {
            quotation.Fluctuatation = quotation.Price - quotation.LastSettle;
            quotation.FluctuatationRate = quotation.Fluctuatation / quotation.LastSettle * 100;
        } else {
            quotation.Fluctuatation = undefined;
            quotation.FluctuatationRate = undefined;
        }

        quotation.lastupdate = new Date();
        var digits = quotation.Digits;
        var row = g_quotation_desc.grid.rows[g_quotation_desc.symbols[quotation.Symbol]];
        for (var field in g_quotation_desc.fields) {
            var col = g_quotation_desc.fields[field];
            if (row != undefined && col != undefined) {
                var cell = row.cells[col];
                switch (field) {
                    case "Open":
                    case "High":
                    case "Low":
                    case "Close":
                    case "Price":
                    case "Settle":
                    case "LastSettle":
                        if (quotation[field] > 0) {
                            cell.innerHTML = format_intval(quotation[field], digits);
                            if (quotation.LastSettle > 0) {
                                cell.className = quotation[field] == quotation.LastSettle ? "" :
                                quotation[field] > quotation.LastSettle ? "g" : "l";
                            }
                        } else {
                            cell.innerHTML = "-";
                            cell.className = "";
                        }
                        break;
                    case "Fluctuatation":
                    case "FluctuatationRate":
                        if (quotation[field] != undefined) {
                            if (field == "FluctuatationRate") {
                                cell.innerHTML = format_float(quotation[field], 2);
                                cell.innerHTML += "%";
                            } else {
                                cell.innerHTML = format_intval(quotation[field], digits);
                            }
                            cell.className = quotation[field] == 0 ? "" :
                                quotation[field] > 0 ? "g" : "l";
                        } else {
                            cell.innerHTML = "-";
                            cell.className = "";
                        }
                        break;
                    case "Arrow":
                        cell.className = quotation.updown == 0 ? "" :
                            quotation.updown > 0 ? "ad" : "dec";
                        break;
                    case "Name":
                        if (quotation[field] != undefined) cell.innerHTML = quotation.Name;
                        break;
                    default:
                        cell.innerHTML = quotation[field] == undefined ? "-" : quotation[field];
                }
            }
        }
    }

    g_push.lastupdate = new Date();
    if (g_quotation_desc.first_pass) g_push.taskid = setInterval(update_state, 500);
    g_quotation_desc.first_pass = false;
}

function update_state() {
    var now = new Date();
    var col = g_quotation_desc.fields["Arrow"];
    if (col != undefined) {
        for (var i = 0; i < g_quotation_desc.symbol_data.length; i++) {
            var oit = g_quotation_desc.symbol_data[i];
            if (now - oit.lastupdate > 1000) {
                oit.lastupdate = now;
                oit.updown = 0;
                var row = g_quotation_desc.symbols[oit.Symbol];
                g_quotation_desc.grid.rows[row].cells[col].className = "";
            }
        }
    }

    if (now - g_push.lastupdate > 60000) {
        stop_push();
        update_quotation_grid(g_quotation_desc.gid);
    }
}

  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-23668230-2']);
  _gaq.push(['_setDomainName', '.baring.cn']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();

