export const TV_CHART_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #010501; overflow: hidden; }
        #tv_chart_container { height: 100vh; width: 100vw; }
        #error-display { position: absolute; top: 10px; left: 10px; color: red; font-family: monospace; font-size: 10px; z-index: 9999; }
    </style>
</head>
<body>
    <div id="error-display"></div>
    <div id="tv_chart_container"></div>

    <script type="text/javascript">
        function log(m) {
            console.log(m);
            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', message: m }));
        }
        function err(m) {
            document.getElementById('error-display').innerText = m;
            log("❌ ERROR: " + m);
        }
        window.onerror = function (m, s, l) { err(m + " at line " + l); };
        log("1. WebView starting...");
        
        // --- DATAFEED LOGIC ---
        window.tiwiDatafeed = {
            onReady: (cb) => {
                log("Datafeed: onReady");
                setTimeout(() => cb({
                    supports_time: true,
                    supported_resolutions: ["1", "5", "15", "60", "240", "D"]
                }), 0);
            },
            searchSymbols: (ui, ex, st, cb) => cb([]),
            resolveSymbol: (name, cb, err) => {
                log("Datafeed: resolveSymbol -> " + name);
                window.sendNativeMessage({ type: 'RESOLVE_SYMBOL', symbol: name, id: Date.now() }, (res) => {
                    cb(res.data);
                });
            },
            getBars: (symbolInfo, resolution, periodParams, cb, err) => {
                log("Datafeed: getBars for " + symbolInfo.name + " (" + resolution + ")");
                const req = {
                    type: 'GET_BARS',
                    symbol: symbolInfo.name,
                    resolution,
                    from: periodParams.from,
                    to: periodParams.to,
                    countBack: periodParams.countBack,
                    id: Date.now()
                };
                window.sendNativeMessage(req, (res) => {
                    if (res.error) {
                        log("getBars error: " + res.error);
                        cb([], { noData: true });
                    } else {
                        log("getBars success: " + res.data.length + " bars");
                        cb(res.data, { noData: res.data.length === 0 });
                    }
                });
            },
            subscribeBars: (symbolInfo, resolution, onRealtimeCallback) => {
                window.onRealtimeCallback = onRealtimeCallback;
            },
            unsubscribeBars: () => {
                window.onRealtimeCallback = null;
            }
        };

        const pending = new Map();
        window.sendNativeMessage = (req, cb) => {
            pending.set(req.id.toString(), cb);
            window.ReactNativeWebView.postMessage(JSON.stringify(req));
        };
        window.onNativeResponse = (res) => {
            const cb = pending.get(res.requestId.toString());
            if (cb) {
                cb(res);
                pending.delete(res.requestId.toString());
            }
        };
        window.updateLastPrice = (bar) => {
            if (window.onRealtimeCallback) window.onRealtimeCallback(bar);
        };
    </script>

    <!-- Load library from production host -->
    <script type="text/javascript" src="https://app.tiwiprotocol.xyz/charts/charting_library/charting_library.standalone.js" onerror="err('Library load failed from production')"></script>

    <script type="text/javascript">
        log("2. Scripts loaded. Checking TradingView object...");

        function getParam(n) {
            const v = new RegExp('[?&]' + n + '=([^&#]*)').exec(window.location.href);
            return v ? decodeURIComponent(v[1]) : null;
        }

        function init() {
            if (typeof TradingView === 'undefined') {
                return err("TradingView library not found in global scope");
            }

            log("3. Initializing widget for " + getParam('symbol'));

            const widget = window.tvWidget = new TradingView.widget({
                symbol: getParam('symbol') || 'BTC-USD',
                interval: getParam('interval') || '60',
                container: "tv_chart_container",
                datafeed: window.tiwiDatafeed,
                library_path: "https://app.tiwiprotocol.xyz/charts/charting_library/",
                locale: "en",
                theme: "dark",
                autosize: true,
                timezone: "Etc/UTC",
                toolbar_bg: "#010501",
                overrides: {
                    "paneProperties.background": "#010501",
                    "paneProperties.vertGridProperties.color": "transparent",
                    "paneProperties.horzGridProperties.color": "transparent",
                    "mainSeriesProperties.candleStyle.upColor": "#3FEA9B",
                    "mainSeriesProperties.candleStyle.downColor": "#FF5C5C",
                },
                disabled_features: ["header_symbol_search"],
                enabled_features: ["study_templates", "left_toolbar", "control_bar", "header_resolutions", "header_chart_type", "header_settings", "header_indicators", "header_undo_redo"]
            });

            widget.onChartReady(function () {
                log("4. Widget Ready event fired");
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ON_CHART_READY' }));
                }
            });
        }

        window.addEventListener('load', function () {
            log("DOM Load Ready");
            setTimeout(init, 500);
        });
    </script>
</body>
</html>
`;
