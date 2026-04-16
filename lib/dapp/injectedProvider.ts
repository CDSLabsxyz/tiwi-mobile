/**
 * Injected EIP-1193 provider source.
 * Runs inside the WebView before any page script loads.
 *
 * DApps call window.ethereum.request(...) → we post to RN → native side
 * handles the call via signerController → response is injected back by
 * calling window.ethereum._handleResponse(id, result, error).
 */

export interface InjectionInit {
    address: string | null;
    chainIdHex: string;
    rdns?: string;
    name?: string;
    iconDataUri?: string;
}

const PROVIDER_SOURCE = `
(function () {
    if (window.__tiwiInjected) return;
    window.__tiwiInjected = true;

    var pending = {};
    var nextId = 1;
    var listeners = {};

    function emit(event, data) {
        var subs = listeners[event] || [];
        for (var i = 0; i < subs.length; i++) {
            try { subs[i](data); } catch (e) {}
        }
    }

    function post(method, params) {
        return new Promise(function (resolve, reject) {
            var id = nextId++;
            pending[id] = { resolve: resolve, reject: reject };
            try {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    id: id,
                    method: method,
                    params: params || [],
                }));
            } catch (e) {
                delete pending[id];
                reject(e);
            }
        });
    }

    var state = {
        chainId: '__CHAIN_ID__',
        networkVersion: String(parseInt('__CHAIN_ID__', 16)),
        selectedAddress: __ADDRESS_JSON__,
    };

    var walletInfo = {
        uuid: __UUID_JSON__,
        name: __NAME_JSON__,
        icon: __ICON_JSON__,
        rdns: __RDNS_JSON__,
    };

    var provider = {
        isTiwi: true,
        isMetaMask: true,
        _metamask: { isUnlocked: function () { return Promise.resolve(true); } },
        // Non-spec fields some DApps inspect directly.
        icon: walletInfo.icon,
        info: walletInfo,
        get chainId() { return state.chainId; },
        get networkVersion() { return state.networkVersion; },
        get selectedAddress() { return state.selectedAddress; },

        request: function (args) {
            if (!args || typeof args.method !== 'string') {
                return Promise.reject({ code: -32600, message: 'Invalid request' });
            }
            return post(args.method, args.params);
        },

        enable: function () { return this.request({ method: 'eth_requestAccounts' }); },

        send: function (methodOrPayload, paramsOrCallback) {
            if (typeof methodOrPayload === 'string') {
                return this.request({ method: methodOrPayload, params: paramsOrCallback });
            }
            var self = this;
            if (typeof paramsOrCallback === 'function') {
                return this.request(methodOrPayload)
                    .then(function (result) { paramsOrCallback(null, { id: methodOrPayload.id, jsonrpc: '2.0', result: result }); })
                    .catch(function (err) { paramsOrCallback(err, null); });
            }
            return this.request(methodOrPayload);
        },

        sendAsync: function (payload, callback) {
            this.request(payload)
                .then(function (result) { callback(null, { id: payload.id, jsonrpc: '2.0', result: result }); })
                .catch(function (err) { callback(err, null); });
        },

        on: function (event, cb) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
            return this;
        },

        removeListener: function (event, cb) {
            if (!listeners[event]) return this;
            listeners[event] = listeners[event].filter(function (x) { return x !== cb; });
            return this;
        },

        removeAllListeners: function (event) {
            if (event) delete listeners[event];
            else listeners = {};
            return this;
        },

        _handleResponse: function (id, result, error) {
            var p = pending[id];
            if (!p) return;
            delete pending[id];
            if (error) p.reject(error);
            else p.resolve(result);
        },

        _setChain: function (chainIdHex) {
            state.chainId = chainIdHex;
            state.networkVersion = String(parseInt(chainIdHex, 16));
            emit('chainChanged', chainIdHex);
            emit('networkChanged', state.networkVersion);
        },

        _setAccounts: function (accounts) {
            state.selectedAddress = accounts && accounts[0] ? accounts[0] : null;
            emit('accountsChanged', accounts || []);
        },

        _emit: emit,
    };

    Object.defineProperty(window, 'ethereum', {
        value: provider,
        writable: false,
        configurable: false,
    });
    window.tiwi = provider;

    // EIP-6963: Multi Injected Provider Discovery
    function announce() {
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({ info: walletInfo, provider: provider }),
        }));
    }
    window.addEventListener('eip6963:requestProvider', announce);
    announce();

    // Fire a connect event after load so DApps see us as ready
    setTimeout(function () {
        emit('connect', { chainId: state.chainId });
    }, 0);
})();
true;
`;

function uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function buildInjectedScript(init: InjectionInit): string {
    const {
        address,
        chainIdHex,
        rdns = 'com.tiwi.wallet',
        name = 'Tiwi Wallet',
        iconDataUri = '',
    } = init;

    return PROVIDER_SOURCE
        .replace(/__CHAIN_ID__/g, chainIdHex)
        .replace(/__ADDRESS_JSON__/g, JSON.stringify(address))
        .replace(/__UUID_JSON__/g, JSON.stringify(uuid()))
        .replace(/__NAME_JSON__/g, JSON.stringify(name))
        .replace(/__ICON_JSON__/g, JSON.stringify(iconDataUri))
        .replace(/__RDNS_JSON__/g, JSON.stringify(rdns));
}

/**
 * Build a JS snippet that resolves a pending request inside the page.
 * Called from RN via webviewRef.current.injectJavaScript(...).
 */
export function buildResponseInjection(id: number, result: unknown, error?: { code: number; message: string }): string {
    const payload = JSON.stringify({
        result: result ?? null,
        error: error || null,
    });
    return `(function(){
        try {
            var p = ${payload};
            window.ethereum && window.ethereum._handleResponse(${id}, p.result, p.error);
        } catch(e) {}
    })();
    true;`;
}

export function buildEventInjection(event: 'chainChanged' | 'accountsChanged', data: unknown): string {
    if (event === 'chainChanged') {
        return `window.ethereum && window.ethereum._setChain(${JSON.stringify(data)}); true;`;
    }
    return `window.ethereum && window.ethereum._setAccounts(${JSON.stringify(data)}); true;`;
}
