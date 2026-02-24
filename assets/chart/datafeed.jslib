/**
 * TIWI Native-Bridge Datafeed
 * Communicates with React Native layer via postMessage
 */

window.tiwiDatafeed = {
    onReady: (callback) => {
        setTimeout(() => callback({
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
        }), 0);
    },

    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        onResultReadyCallback([]);
    },

    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        // We notify the native layer to give us symbol info
        const request = {
            id: Date.now(),
            type: 'RESOLVE_SYMBOL',
            symbol: symbolName
        };
        window.sendNativeMessage(request, (response) => {
            if (response.error) {
                onResolveErrorCallback(response.error);
            } else {
                onSymbolResolvedCallback(response.data);
            }
        });
    },

    getBars: (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        const request = {
            id: Date.now(),
            type: 'GET_BARS',
            symbol: symbolInfo.name,
            resolution: resolution,
            from: periodParams.from,
            to: periodParams.to,
            countBack: periodParams.countBack
        };

        window.sendNativeMessage(request, (response) => {
            if (response.error) {
                onErrorCallback(response.error);
            } else {
                if (response.data.length === 0) {
                    onHistoryCallback([], { noData: true });
                } else {
                    onHistoryCallback(response.data, { noData: false });
                }
            }
        });
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
        window.onRealtimeCallback = onRealtimeCallback;
    },

    unsubscribeBars: (subscriberUID) => {
        window.onRealtimeCallback = null;
    }
};

// --- Bridge Helpers ---

const pendingRequests = new Map();

window.sendNativeMessage = (request, callback) => {
    pendingRequests.set(request.id, callback);
    window.ReactNativeWebView.postMessage(JSON.stringify(request));
};

window.onNativeResponse = (response) => {
    const callback = pendingRequests.get(response.requestId);
    if (callback) {
        callback(response);
        pendingRequests.delete(response.requestId);
    }
};

window.updateLastPrice = (bar) => {
    if (window.onRealtimeCallback) {
        window.onRealtimeCallback(bar);
    }
};
