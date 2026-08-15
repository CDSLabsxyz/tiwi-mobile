// Standalone BSC scan - no viem, just fetch + raw RPC. More resilient.
const POOL = '0xb9F9bA56bCd4287694c9526E6F4EE4D03F652E70';
const URLS = [
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed.bnbchain.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
];

let urlIdx = 0;
async function rpc(method, params) {
  let lastErr;
  for (let attempt = 0; attempt < URLS.length * 2; attempt++) {
    const url = URLS[urlIdx % URLS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await res.json();
      if (j.error) throw new Error(`${method}: ${j.error.message}`);
      return j.result;
    } catch (e) {
      lastErr = e;
      urlIdx++;
    }
  }
  throw lastErr;
}

function hex(n) { return '0x' + BigInt(n).toString(16); }
function pad32(addrOrInt) {
  let h = typeof addrOrInt === 'string' ? addrOrInt.toLowerCase().replace(/^0x/, '') : addrOrInt.toString(16);
  return h.padStart(64, '0');
}

// Selectors
//   getPoolInfo()                     -> 0x... (compute below)
//   getUserInfo(address)              -> 0x...
//   keccak256("Deposit(address,uint256)")  topic
import { keccak256, toHex } from 'viem';
const k = (s) => keccak256(toHex(s));
const SEL = (sig) => k(sig).slice(0, 10);

const SEL_GET_POOL_INFO = SEL('getPoolInfo()');
const SEL_GET_USER_INFO = SEL('getUserInfo(address)');
const TOPIC_DEPOSIT = k('Deposit(address,uint256)');
const TOPIC_WITHDRAW = k('Withdraw(address,uint256)');

console.log('Selectors:');
console.log('  getPoolInfo:', SEL_GET_POOL_INFO);
console.log('  getUserInfo:', SEL_GET_USER_INFO);
console.log('  Deposit topic:', TOPIC_DEPOSIT);

async function ethCall(to, data) {
  return rpc('eth_call', [{ to, data }, 'latest']);
}

function decodeUint(hexStr, slot) {
  // 32-byte slots, hexStr starts with 0x
  const start = 2 + slot * 64;
  return BigInt('0x' + hexStr.slice(start, start + 64));
}
function decodeAddr(hexStr, slot) {
  const start = 2 + slot * 64;
  return '0x' + hexStr.slice(start + 24, start + 64);
}
function decodeBool(hexStr, slot) {
  return decodeUint(hexStr, slot) !== 0n;
}

// 1) Verify code at address
const code = await rpc('eth_getCode', [POOL, 'latest']);
console.log(`\nBytecode length at ${POOL}: ${code.length} chars`);
if (code === '0x' || code.length <= 2) {
  console.log('No code - not a contract.');
  process.exit(0);
}

// 2) getPoolInfo() - V2 layout
let poolInfo;
try {
  poolInfo = await ethCall(POOL, SEL_GET_POOL_INFO);
  console.log('\ngetPoolInfo() returned:');
  console.log('  stakingToken_:        ', decodeAddr(poolInfo, 0));
  console.log('  rewardToken_:         ', decodeAddr(poolInfo, 1));
  console.log('  poolOwner_:           ', decodeAddr(poolInfo, 2));
  console.log('  poolReward_:          ', decodeUint(poolInfo, 3).toString());
  console.log('  rewardDurationSeconds:', decodeUint(poolInfo, 4).toString());
  console.log('  maxTvl_:              ', decodeUint(poolInfo, 5).toString());
  console.log('  rewardPerSecond_:     ', decodeUint(poolInfo, 6).toString());
  console.log('  startTime_:           ', decodeUint(poolInfo, 7).toString());
  console.log('  endTime_:             ', decodeUint(poolInfo, 8).toString());
  console.log('  active_:              ', decodeBool(poolInfo, 9));
  console.log('  totalStaked_:         ', decodeUint(poolInfo, 10).toString());
  console.log('  rewardBalance_:       ', decodeUint(poolInfo, 11).toString());
  console.log('  funded_:              ', decodeBool(poolInfo, 12));
} catch (e) {
  console.log('getPoolInfo() failed:', e.message);
}

// 3) Latest block
const latestHex = await rpc('eth_blockNumber', []);
const latest = BigInt(latestHex);
console.log(`\nLatest block: ${latest}`);

// 4) Scan Deposit logs
const CHUNK = 5000n;
const LOOKBACK = 4_000_000n; // ~4 months on BSC
const start = latest > LOOKBACK ? latest - LOOKBACK : 0n;
console.log(`Scanning Deposit logs from ${start} -> ${latest} in ${CHUNK}-block chunks...`);

const users = new Set();
let totalLogs = 0;
let firstSeen = null;
let lastSeen = null;
let from = start;
while (from <= latest) {
  const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
  try {
    const logs = await rpc('eth_getLogs', [{
      address: POOL,
      fromBlock: hex(from),
      toBlock: hex(to),
      topics: [TOPIC_DEPOSIT],
    }]);
    if (logs.length) {
      for (const l of logs) {
        const topic = l.topics[1]; // indexed user
        const addr = '0x' + topic.slice(26).toLowerCase();
        users.add(addr);
        if (!firstSeen) firstSeen = parseInt(l.blockNumber, 16);
        lastSeen = parseInt(l.blockNumber, 16);
      }
      totalLogs += logs.length;
      process.stdout.write(`  [${from}..${to}] +${logs.length} (uniq=${users.size})\n`);
    }
  } catch (e) {
    console.log(`  [${from}..${to}] FAIL: ${e.message}`);
  }
  from = to + 1n;
}

console.log(`\nTotal Deposit events: ${totalLogs}`);
console.log(`Unique addresses ever deposited: ${users.size}`);
if (firstSeen) console.log(`First deposit block: ${firstSeen}, last deposit block: ${lastSeen}`);

// 5) For each unique user, call getUserInfo and check if amount > 0
console.log(`\nChecking current stake for each unique address...`);
const arr = [...users];
const active = [];
const concurrency = 8;
let idx = 0;
async function worker() {
  while (idx < arr.length) {
    const i = idx++;
    const u = arr[i];
    const data = SEL_GET_USER_INFO + pad32(u);
    try {
      const result = await ethCall(POOL, data);
      const amount = decodeUint(result, 0);
      const stakeTime = decodeUint(result, 2);
      const pending = decodeUint(result, 3);
      if (amount > 0n) active.push({ user: u, amount, stakeTime, pending });
    } catch (e) {
      console.log(`  getUserInfo(${u}) FAIL: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log(`\n========================================`);
console.log(`ACTIVE STAKERS: ${active.length}`);
console.log(`========================================\n`);

active.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
console.log('Active stakers (largest first):');
for (const s of active) {
  const amtBnb = Number(s.amount) / 1e18;
  const ts = s.stakeTime > 0n ? new Date(Number(s.stakeTime) * 1000).toISOString() : '-';
  console.log(`  ${s.user}  amount=${s.amount.toString()} (~${amtBnb}) stakeTime=${ts}`);
}
