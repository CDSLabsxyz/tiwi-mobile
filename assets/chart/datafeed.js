/**
 * TIWI INSTITUTIONAL DATAFEED (V3)
 */

const API_BASE = "https://81c9-105-112-216-223.ngrok-free.app";

function nativeLog(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', message: m }));
    console.log(m);
}

window.tiwiDatafeed = {
    onReady: (cb) => {
        nativeLog("Datafeed: onReady");
        setTimeout(() => cb({
            supports_time: true,
            supported_resolutions: ["1", "5", "15", "60", "240", "D"]
        }), 0);
    },

    searchSymbols: (ui, ex, st, cb) => cb([]),

    resolveSymbol: (name, cb, err) => {
        nativeLog("Datafeed: resolveSymbol -> " + name);
        if (window.ReactNativeWebView) {
            window.sendNativeMessage({ type: 'RESOLVE_SYMBOL', symbol: name, id: Date.now() }, (res) => {
                cb(res.data);
            });
        } else {
            // Web testing fallback
            setTimeout(() => cb({
                name: name, ticker: name, description: name, type: 'crypto', session: '24x7',
                timezone: 'Etc/UTC', exchange: 'TIWI', minmov: 1, pricescale: 100, has_intraday: true,
                supported_resolutions: ["1", "5", "15", "60", "240", "D"]
            }), 0);
        }
    },

    getBars: (symbolInfo, resolution, periodParams, cb, err) => {
        nativeLog(`Datafeed: getBars for ${symbolInfo.name} (${resolution})`);

        if (window.ReactNativeWebView) {
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
                    nativeLog("getBars error: " + res.error);
                    cb([], { noData: true });
                } else {
                    nativeLog(`getBars success: ${res.data.length} bars`);
                    cb(res.data, { noData: res.data.length === 0 });
                }
            });
        } else {
            // Web Fetch Fallback
            const url = `${API_BASE}/api/v1/charts/history?symbol=${symbolInfo.name}&resolution=${resolution}&from=${periodParams.from}&to=${periodParams.to}`;
            fetch(url).then(r => r.json()).then(h => {
                let b = [];
                if (h.t) {
                    b = h.t.map((t, i) => ({ time: t * 1000, low: h.l[i], high: h.h[i], open: h.o[i], close: h.c[i], volume: h.v?.[i] || 0 }));
                } else if (Array.isArray(h)) {
                    b = h.map(x => ({ time: (x.time || x.t) * 1000, open: x.open || x.o, high: x.high || x.h, low: x.low || x.l, close: x.close || x.c, volume: x.v || 0 }));
                }
                cb(b, { noData: b.length === 0 });
            }).catch(e => {
                nativeLog("Web Fetch Error: " + e.message);
                cb([], { noData: true });
            });
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback) => {
        window.onRealtimeCallback = onRealtimeCallback;
    },

    unsubscribeBars: () => {
        window.onRealtimeCallback = null;
    }
};

// Bridge Logic
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
