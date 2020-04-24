// ==UserScript==
// @name         Points Market
// @namespace    http://tampermonkey.net/
// @version      1.1
// @require      http://code.jquery.com/jquery-1.12.4.min.js
// @require      http://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @description  check points market
// @author       You
// @match        https://www.torn.com/*.php
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`table.points-market-table, .points-market-table th, .points-market-table td {
                     border: 1px solid black !important;
                 }`);
    GM_addStyle(`#points_market {
                     margin: 0 23px 0 23px;
                 }
                 #points_market.cheap_points {
                     color: red;
                 }
                 #points_market:hover .points_market_tooltip {
                     display: block;
                 }`);
    GM_addStyle(`.points_market_tooltip {
                     display: none;
                     background: #C8C8C8;
                     padding: 10px;
                     position: absolute;
                     z-index: 999999;
                     top:25px;
                 }`);

    GM_addStyle(`table.points-market-table {
                     font-family: "Lucida Console", Monaco, monospace;
                     border: 1px solid #1C6EA4;
                     background-color: #EEEEEE;
                     width: 100%;
                     text-align: right;
                     border-collapse: collapse;
                 }
                 table.points-market-table td, table.points-market-table th {
                     border: 1px solid #AAAAAA;
                     padding: 3px 2px;
                 }
                 table.points-market-table tbody td {
                     font-size: 13px;
                 }
                 table.points-market-table tr:nth-child(even) {
                     background: #D0E4F5;
                 }
                 table.points-market-table tr.new {
                     background: #D4EED1;
                 }
                 table.points-market-table tr.sold {
                     background: #F5C8BF;
                 }
                 table.points-market-table thead {
                     background: #1C6EA4;
                     background: -moz-linear-gradient(top, #5592bb 0%, #327cad 66%, #1C6EA4 100%);
                     background: -webkit-linear-gradient(top, #5592bb 0%, #327cad 66%, #1C6EA4 100%);
                     background: linear-gradient(to bottom, #5592bb 0%, #327cad 66%, #1C6EA4 100%);
                     border-bottom: 2px solid #444444;
                 }
                 table.points-market-table thead th {
                     font-size: 15px;
                     font-weight: bold;
                     color: #FFFFFF;
                     text-align: center;
                     border-left: 2px solid #D0E4F5;
                 }
                 table.points-market-table thead th:first-child {
                     border-left: none;
                 }`);

    const apiKey = "API_KEY_HERE";
    var tornPointsStatsUrl = `https://api.torn.com/torn/?selections=stats&key=${apiKey}`;
    var tornPointsMarketUrl = `https://api.torn.com/market/?selections=pointsmarket&key=${apiKey}`;

    setTimeout(addLink,500);

    let globalStore = {firstRun: true, prevMaxId: 0};

    function makeRequests() {
        $.when(
            // Get the HTML
            !globalStore.stats ?
            $.get(tornPointsStatsUrl, function(data) {
                globalStore.stats = data;
            }) : null,

            $.get(tornPointsMarketUrl, function(data) {
                globalStore.market = data;
            }),

        ).then(function() {
           popout_creation();
        });
    }

    function popout_creation() {

        var marketValue = globalStore.stats.stats.points_averagecost;
        var marketStats = globalStore.market.pointsmarket;

        globalStore.previousBatch = globalStore.availableBatch || [];
        globalStore.availableBatch = [];

        for (var key in marketStats) {
            if (marketStats.hasOwnProperty(key)) {
                marketStats[key].id = key;
                globalStore.availableBatch.push(marketStats[key]);
            }
        }
        globalStore.availableBatch.sort(compare);

        var merged = mergeSorted(globalStore.availableBatch, globalStore.previousBatch, globalStore);
        var uniques = Array.from(new Set(merged.map(a => a.id))).map(id => {
            return merged.find(a => a.id === id)
        });

        let table = document.createElement("table");
        table.className = "points-market-table";
        table.style.border = "1px solid black";

        // find min/max price on market
        var minMax = findMinMax(globalStore.availableBatch);

        if (minMax[0].cost / marketValue <= .95) {
          $("#points_market").addClass("cheap_points");
        } else {
          $("#points_market").removeClass("cheap_points");
        }

        generateTable(table, uniques, marketValue);

        var div = document.createElement("div");

        div.style.backgroundColor = "black";
        div.className = "points_market_tooltip"

        div.appendChild(table);
        $(".points_market_tooltip").remove();
        $("#points_market").append(div);

    }

    function findMinMax(arr) {
        let min = arr[0], max = arr[0];

        for (let i = 1, len=arr.length; i < len; i++) {
            let v = arr[i];
            min = (v.cost < min.cost) ? v : min;
            max = (v.cost > max.cost) ? v : max;
        }

        return [min, max];
    }

    function compare(a, b) {
        const cost1 = parseInt(a.cost);
        const costb = parseInt(b.cost);

        let comparison = 0;
        if (cost1 > costb) {
            comparison = 1;
        } else if (cost1 < costb) {
            comparison = -1;
        }
        return comparison;
    }

    function generateTable(table, data, mv) {
        let thead = table.createTHead();
        let row = thead.insertRow();
        let headers = ["$/point", "# points", "Total Cost", "MV% ("+mv+")"];
        for (var hd in headers) {
            let th = document.createElement("th");
            let text = document.createTextNode(headers[hd]);
            th.appendChild(text);
            row.appendChild(th);
        }

        for (let element of data) {
            let row = table.insertRow();
            row.id = element.id;

            if (!globalStore.firstRun)
                row.className = element.status;

            for (let key in element) {
                if (key != "id" && key != "status") {
                    let val;
                    if (key == "cost" || key == "total_cost") {
                        val = formatMoney(element[key]);
                    } else {
                        val = element[key];
                    }

                    let cell = row.insertCell();
                    let text = document.createTextNode(val);
                    cell.appendChild(text);
                }
            }
            // add a market value % column
            let cell = row.insertCell();
            let text = document.createTextNode(((element["cost"]/mv) * 100).toFixed(1) + "%");
            cell.appendChild(text);
        }

        globalStore.firstRun = false;
    }


    setTimeout(makeRequests,500);

    setInterval(makeRequests,10000);

})();

function addLink() {

    if ($('.content-title')) {
        $("<a href='https://www.torn.com/pmarket.php' title='' id='points_market' class='t-clear h c-pointer m-icon line-h24 right last'>Points Market Check</a>").insertAfter("#skip-to-content");
    } else {

    }
}

function formatMoney(number) {
    var formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    });

    return formatter.format(number);
}

function mergeSorted(available, old, gs) {
    for (var a in available) {
        var found = old.find(x => x.id == available[a].id);
        if (found) {
            available[a].status = "";
        } else if (available[a].id > gs.prevMaxId) {
            available[a].status = "new";
        }
    }
    for (var b in old) {
        let found = available.find(x => x.id == old[b].id);
        if (found) {
            old[b].status = "";
        } else {
            old[b].status = "sold";
        }
    }
    gs.prevMaxId = Math.max.apply(Math, available.map(function(o) { return o.id; }))

    var result = [], i = 0, j = 0;
    while (i < available.length && j < old.length) {
        if (available[i].cost < old[j].cost) {
            result.push(available[i]);
            i++;
        }else {
            result.push(old[j]);
            j++;
        }
    }
    while (i < available.length) {
        result.push(available[i]);
        i++;
    }
    while (j < old.length) {
        result.push(old[j]);
        j++;
    }
    return result.sort(function(a, b) {
        return a["cost"] - b["cost"] || a["quantity"] - b["quantity"];
    });
}






