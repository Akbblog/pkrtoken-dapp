import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ERC20_ABI } from "./abi.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_EXPECTED_CHAIN_ID || 11155111); // Sepolia

const txLink = (h) => `https://sepolia.etherscan.io/tx/${h}`;
const shorten = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

export default function App() {
  // guard (must be inside component)
  if (!CONTRACT_ADDRESS) {
    return (
      <div style={{maxWidth: 720, margin: "32px auto", fontFamily: "Inter, system-ui, sans-serif"}}>
        <h1>PKRtoken Dashboard</h1>
        <p>Missing <code>VITE_CONTRACT_ADDRESS</code>. Set it in Netlify/Vercel env vars, then redeploy.</p>
      </div>
    );
  }

  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [name, setName] = useState("-");
  const [symbol, setSymbol] = useState("-");
  const [decimals, setDecimals] = useState(18);
  const [totalSupply, setTotalSupply] = useState("0");
  const [balance, setBalance] = useState("0");
  const [owner, setOwner] = useState(null);

  const [toAddr, setToAddr] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [mintAmt, setMintAmt] = useState("");
  const [burnAmt, setBurnAmt] = useState("");
  const [status, setStatus] = useState("");

  const provider = useMemo(() => (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null), []);
  const contractRead = useMemo(() => (provider ? new ethers.Contract(CONTRACT_ADDRESS, ERC20_ABI, provider) : null), [provider]);
  const contractWrite = useMemo(
    () =>
      provider && account
        ? (async () => {
            const signer = await provider.getSigner();
            return new ethers.Contract(CONTRACT_ADDRESS, ERC20_ABI, signer);
          })()
        : null,
    [provider, account]
  );

  const isOwner = owner && account && owner.toLowerCase() === account.toLowerCase();
  const onSepolia = chainId === EXPECTED_CHAIN_ID;

  useEffect(() => {
    if (!provider) return;

    const boot = async () => {
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));

      if (contractRead) {
        const [n, s, d] = await Promise.all([contractRead.name(), contractRead.symbol(), contractRead.decimals()]);
        setName(n); setSymbol(s); setDecimals(Number(d));
        const [ts, own] = await Promise.all([contractRead.totalSupply(), contractRead.owner()]);
        setTotalSupply(ethers.formatUnits(ts, Number(d)));
        setOwner(own);
      }

      if (account && contractRead) {
        const bal = await contractRead.balanceOf(account);
        setBalance(ethers.formatUnits(bal, Number(decimals)));
      }
    };

    boot().catch(console.error);

    if (window.ethereum) {
      const handleAcc = (accs) => setAccount(accs?.[0] ?? null);
      const handleChain = (hex) => setChainId(Number(hex));
      window.ethereum.on("accountsChanged", handleAcc);
      window.ethereum.on("chainChanged", handleChain);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAcc);
        window.ethereum.removeListener("chainChanged", handleChain);
      };
    }
  }, [provider, contractRead, account, decimals]);

  const connect = async () => {
    if (!window.ethereum) return alert("Install MetaMask.");
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accs[0]);
    const net = await provider.getNetwork();
    setChainId(Number(net.chainId));
    setStatus("Connected.");
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] }); // 11155111
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
            rpcUrls: ["https://sepolia.infura.io/v3/"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"]
          }]
        });
      } else setStatus(e.message);
    }
  };

  const refreshBalances = async () => {
    if (!contractRead || !account) return;
    const [ts, bal] = await Promise.all([contractRead.totalSupply(), contractRead.balanceOf(account)]);
    setTotalSupply(ethers.formatUnits(ts, decimals));
    setBalance(ethers.formatUnits(bal, decimals));
  };

  const showSent = (label, hash) =>
    setStatus(`${label} sent: <a href="${txLink(hash)}" target="_blank" rel="noreferrer">${hash}</a>`);
  const showConfirmed = (label, hash) =>
    setStatus(`${label} confirmed: <a href="${txLink(hash)}" target="_blank" rel="noreferrer">${hash}</a>`);

  const doTransfer = async () => {
    try {
      if (!toAddr || !transferAmt) return;
      const c = await contractWrite;
      const amt = ethers.parseUnits(transferAmt, decimals);
      const tx = await c.transfer(toAddr.trim(), amt);
      showSent("Transfer", tx.hash);
      await tx.wait(); await refreshBalances();
      showConfirmed("Transfer", tx.hash);
    } catch (e) { setStatus(e.message); }
  };

  const doMint = async () => {
    try {
      if (!isOwner || !mintAmt) return;
      const c = await contractWrite;
      const amt = ethers.parseUnits(mintAmt, decimals);
      const tx = await c.mint(account, amt);
      showSent("Mint", tx.hash);
      await tx.wait(); await refreshBalances();
      showConfirmed("Mint", tx.hash);
    } catch (e) { setStatus(e.message); }
  };

  const doBurn = async () => {
    try {
      if (!burnAmt) return;
      const c = await contractWrite;
      const amt = ethers.parseUnits(burnAmt, decimals);
      const tx = await c.burn(amt);
      showSent("Burn", tx.hash);
      await tx.wait(); await refreshBalances();
      showConfirmed("Burn", tx.hash);
    } catch (e) { setStatus(e.message); }
  };

  const disabled = !account || !onSepolia;

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", fontFamily: "Inter, system-ui, sans-serif", color: "#e5e7eb" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>PKRtoken Dashboard</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>Contract: {CONTRACT_ADDRESS}</div>

      {!account ? (
        <button onClick={connect} style={btn}>Connect Wallet</button>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <span>Account: {shorten(account)} · </span>
          <span>Network: {onSepolia ? "Sepolia ✅" : `Chain ${chainId} ❌`}</span>
          {!onSepolia && <button onClick={switchToSepolia} style={{ ...btn, marginLeft: 8 }}>Switch</button>}
        </div>
      )}

      <div style={row}>
        <div style={box}>
          <div style={label}>Token</div>
          <div>{name} ({symbol}) · Decimals {decimals}</div>
          <div>Total Supply: {totalSupply}</div>
          <div>Owner: {shorten(owner)}</div>
        </div>

        <div style={box}>
          <div style={label}>Your Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{balance} {symbol}</div>
          <button
            onClick={refreshBalances}
            style={{ ...btn, marginTop: "auto", alignSelf: "flex-start" }}
            disabled={disabled}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={box}>
        <div style={label}>Transfer</div>
        <input placeholder="To address 0x..." value={toAddr} onChange={(e)=>setToAddr(e.target.value)} style={input}/>
        <input placeholder={`Amount in ${symbol}`} value={transferAmt} onChange={(e)=>setTransferAmt(e.target.value)} style={input}/>
        <button onClick={doTransfer} style={btn} disabled={disabled || !toAddr || !transferAmt}>Send</button>
      </div>

      <div style={box}>
        <div style={label}>Mint (owner only)</div>
        <input placeholder={`Amount in ${symbol}`} value={mintAmt} onChange={(e)=>setMintAmt(e.target.value)} style={input}/>
        <button onClick={doMint} style={btn} disabled={disabled || !isOwner || !mintAmt}>Mint to me</button>
      </div>

      <div style={box}>
        <div style={label}>Burn</div>
        <input placeholder={`Amount in ${symbol}`} value={burnAmt} onChange={(e)=>setBurnAmt(e.target.value)} style={input}/>
        <button onClick={doBurn} style={btn} disabled={disabled || !burnAmt}>Burn</button>
      </div>

      <div style={{ marginTop: 12, minHeight: 28 }}
           dangerouslySetInnerHTML={{ __html: status }} />
    </div>
  );
}

/* ---------- styles (aligned cards) ---------- */
const row = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
  alignItems: "stretch",
  gridAutoRows: "1fr",         // equal heights for grid rows
};

const box = {
  background: "#111827",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #374151",
  height: "100%",
  display: "flex",             // lets us push the Refresh button down
  flexDirection: "column",
};

const label = {
  fontSize: 12,
  opacity: 0.8,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const btn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #1f2937",
  background: "#1f2937",
  color: "#fff",
  cursor: "pointer",
};

const input = {
  width: "100%",
  padding: 10,
  margin: "10px 0",
  borderRadius: 8,
  border: "px solid #374151",
  background: "#0b1220",
  color: "#e5e7eb",
};
