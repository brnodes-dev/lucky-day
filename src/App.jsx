import React, { useState, useEffect } from 'react';
import { Wallet, Ticket, Trophy, Timer, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, Info, Zap, Lock, UserCog, Gavel, LogOut, History, Award, RefreshCcw, ExternalLink, Coins, Terminal, Smartphone, X } from 'lucide-react';

// --- CONFIGURATION ---
const CONFIG = {
  chainId: 5042002, 
  rpcUrl: "https://rpc.testnet.arc.network", 
  // ENDEREÇO DO CONTRATO
  contractAddress: "0x37A9DA7cabECf1d4DcCA4838dA4a2b61927D226c", 
  // Bloco de criação
  startBlock: 14638469, 
  explorerUrl: "https://testnet.arcscan.app/tx/",
  tokens: {
    USDC: { address: "0x3600000000000000000000000000000000000000", decimals: 6, symbol: "USDC", color: "blue" },
    EURC: { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, symbol: "EURC", color: "emerald" }
  }
};

// ABI JSON COMPLETA
const LOTTERY_ABI = [
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"name":"buyTicket","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"ticketPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"name":"getPlayers","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"nextDrawTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getTicketCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"MAX_TICKETS_PER_WALLET","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"forceDraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"name":"getPoolDetails","outputs":[{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"playerCount","type":"uint256"},{"internalType":"uint256","name":"roundId","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"address","name":"_user","type":"address"}],"name":"getUserData","outputs":[{"internalType":"uint256","name":"ticketCount","type":"uint256"}],"stateMutability":"view","type":"function"},
  // Eventos
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,"internalType":"address","name":"token","type":"address"},
      {"indexed": true,"internalType":"uint256","name":"roundId","type":"uint256"},
      {"indexed": true,"internalType":"address","name":"winner","type":"address"},
      {"indexed": false,"internalType":"uint256","name":"prize","type":"uint256"}
    ],
    "name": "WinnerPicked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,"internalType":"address","name":"token","type":"address"},
      {"indexed": true,"internalType":"address","name":"player","type":"address"},
      {"indexed": false,"internalType":"uint256","name":"amount","type":"uint256"}
    ],
    "name": "TicketPurchased",
    "type": "event"
  }
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

export default function App() {
  const [libLoaded, setLibLoaded] = useState(false);
  const [account, setAccount] = useState('');
  const [readProvider, setReadProvider] = useState(null);
  const [walletProvider, setWalletProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  
  // Data State
  const [pools, setPools] = useState({
      USDC: { players: 0, pot: '0.00', userTickets: 0, price: '1.00' },
      EURC: { players: 0, pot: '0.00', userTickets: 0, price: '1.00' }
  });
  const [participants, setParticipants] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [timeLeft, setTimeLeft] = useState('');
  const [nextDraw, setNextDraw] = useState(0);
  const [maxTickets, setMaxTickets] = useState(10); 
  const [selectedToken, setSelectedToken] = useState('USDC');
  
  // Admin & UI
  const [isOwnerWallet, setIsOwnerWallet] = useState(false); 
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false); 
  const [loading, setLoading] = useState(false); 
  const [historyLoading, setHistoryLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // DEBUG LOGS
  const [logs, setLogs] = useState([]);
  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // Init
  useEffect(() => {
    if (window.ethers) { initProviders(); return; }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js";
    script.async = true;
    script.onload = () => initProviders();
    document.body.appendChild(script);
  }, []);

  const initProviders = async () => {
      setLibLoaded(true);
      let rProvider;
      if (window.ethereum) {
          rProvider = new window.ethers.providers.Web3Provider(window.ethereum);
          setWalletProvider(rProvider);
          const network = await rProvider.getNetwork();
          if (network.chainId !== CONFIG.chainId) setWrongNetwork(true);
      } else {
          try {
            rProvider = new window.ethers.providers.StaticJsonRpcProvider(CONFIG.rpcUrl, { chainId: CONFIG.chainId, name: 'arc-testnet' });
          } catch(e) { console.error(e); }
      }
      setReadProvider(rProvider);
      if (rProvider) { fetchData(null, rProvider); fetchHistory(null, rProvider); }
  };

  // Account Management
  useEffect(() => {
    if (libLoaded && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accs => {
         if(accs.length > 0) { 
             setAccount(accs[0]); 
             const p = new window.ethers.providers.Web3Provider(window.ethereum);
             setSigner(p.getSigner());
         }
      });

      window.ethereum.on('accountsChanged', (accs) => {
         if(accs.length > 0) { 
             setAccount(accs[0]); 
             setIsAdminLoggedIn(false); 
             const p = new window.ethers.providers.Web3Provider(window.ethereum);
             setSigner(p.getSigner());
             localStorage.removeItem('walletDisconnected');
         }
         else { 
             setAccount(''); 
             setSigner(null);
             setIsAdminLoggedIn(false); 
             setIsOwnerWallet(false); 
         }
      });
    }
  }, [libLoaded]);

  useEffect(() => {
      if(account && readProvider) {
          const p = new window.ethers.providers.Web3Provider(window.ethereum);
          const s = p.getSigner();
          setSigner(s);
          checkOwner(account, readProvider);
          fetchData(s, readProvider);
      }
  }, [account, readProvider]);

  const checkOwner = async (user, prov) => {
      try {
          const c = new window.ethers.Contract(CONFIG.contractAddress, LOTTERY_ABI, prov);
          const owner = await c.owner();
          setIsOwnerWallet(owner.toLowerCase() === user.toLowerCase());
      } catch(e) {}
  };

  // --- CORE DATA ---
  const fetchData = async (sgn, prov) => {
      if(!prov) return;
      try {
          const lottery = new window.ethers.Contract(CONFIG.contractAddress, LOTTERY_ABI, prov);
          const usdc = new window.ethers.Contract(CONFIG.tokens.USDC.address, ERC20_ABI, prov);
          const eurc = new window.ethers.Contract(CONFIG.tokens.EURC.address, ERC20_ABI, prov);
          
          const [drawTime, max, usdcBal, eurcBal, usdcDetails, eurcDetails, usdcPlayers, eurcPlayers] = await Promise.all([
              lottery.nextDrawTime(),
              lottery.MAX_TICKETS_PER_WALLET(),
              usdc.balanceOf(CONFIG.contractAddress),
              eurc.balanceOf(CONFIG.contractAddress),
              lottery.getPoolDetails(CONFIG.tokens.USDC.address),
              lottery.getPoolDetails(CONFIG.tokens.EURC.address),
              lottery.getPlayers(CONFIG.tokens.USDC.address),
              lottery.getPlayers(CONFIG.tokens.EURC.address)
          ]);

          setNextDraw(drawTime.toNumber());
          setMaxTickets(max.toNumber());

          const combinedPlayers = [
              ...(usdcPlayers || []).map(addr => ({ address: addr, symbol: 'USDC' })),
              ...(eurcPlayers || []).map(addr => ({ address: addr, symbol: 'EURC' }))
          ];
          setParticipants(combinedPlayers);

          let usdcUser = 0, eurcUser = 0;
          if (account) {
              try {
                usdcUser = (await lottery.getUserData(CONFIG.tokens.USDC.address, account)).toNumber();
                eurcUser = (await lottery.getUserData(CONFIG.tokens.EURC.address, account)).toNumber();
              } catch (e) { }
          }

          const usdcPot = usdcBal ? (parseFloat(window.ethers.utils.formatUnits(usdcBal, 6)) * 0.9).toFixed(2) : '0.00';
          const eurcPot = eurcBal ? (parseFloat(window.ethers.utils.formatUnits(eurcBal, 6)) * 0.9).toFixed(2) : '0.00';

          setPools({
              USDC: {
                  players: usdcDetails ? usdcDetails.playerCount.toNumber() : 0,
                  pot: usdcPot,
                  userTickets: usdcUser,
                  price: '1.00'
              },
              EURC: {
                  players: eurcDetails ? eurcDetails.playerCount.toNumber() : 0,
                  pot: eurcPot,
                  userTickets: eurcUser,
                  price: '1.00'
              }
          });

      } catch (e) { addLog(`Fetch Data Error: ${e.message}`); }
  };

  // --- HISTORY FETCH (REVERSE SCANNING + LIMIT) ---
  const fetchHistory = async (sgn, prov) => {
      if(!prov) return;
      setHistoryLoading(true);
      
      try {
          const lottery = new window.ethers.Contract(CONFIG.contractAddress, LOTTERY_ABI, prov);
          const iface = new window.ethers.utils.Interface(LOTTERY_ABI);
          
          const currentBlock = await prov.getBlockNumber();
          const startBlock = CONFIG.startBlock;
          const CHUNK_SIZE = 3000;
          const MAX_WINNERS = 10;
          
          let foundWinners = [];
          
          for (let to = currentBlock; to > startBlock; to -= CHUNK_SIZE) {
              let from = to - CHUNK_SIZE;
              if (from < startBlock) from = startBlock;
              
              if (foundWinners.length >= MAX_WINNERS) break;

              try {
                  await new Promise(r => setTimeout(r, 200));

                  const chunkLogs = await prov.getLogs({
                      fromBlock: from,
                      toBlock: to,
                      address: CONFIG.contractAddress
                  });

                  const reversedLogs = chunkLogs.reverse();

                  for (let log of reversedLogs) {
                      try {
                          const parsed = iface.parseLog(log);
                          
                          if (parsed.name === "WinnerPicked") {
                              const { token, roundId, winner, prize } = parsed.args;
                              
                              let symbol = 'UNK';
                              if(token && token.toLowerCase() === CONFIG.tokens.USDC.address.toLowerCase()) symbol = 'USDC';
                              if(token && token.toLowerCase() === CONFIG.tokens.EURC.address.toLowerCase()) symbol = 'EURC';

                              let dateStr = 'Recent';
                              let timestamp = Date.now() / 1000;
                              
                              try {
                                  const block = await prov.getBlock(log.blockNumber);
                                  if(block) {
                                      timestamp = block.timestamp;
                                      dateStr = new Date(block.timestamp * 1000).toLocaleDateString();
                                  }
                              } catch(e) {}

                              const winnerData = {
                                  txHash: log.transactionHash,
                                  winner,
                                  prize: window.ethers.utils.formatUnits(prize, 6),
                                  symbol,
                                  date: dateStr,
                                  roundId: roundId.toString(),
                                  blockNumber: log.blockNumber,
                                  timestamp
                              };

                              foundWinners.push(winnerData);
                              
                              setHistory(prev => {
                                  const exists = prev.find(p => p.txHash === winnerData.txHash && p.symbol === winnerData.symbol);
                                  if (exists) return prev;
                                  const newHistory = [...prev, winnerData];
                                  return newHistory.sort((a,b) => b.blockNumber - a.blockNumber);
                              });

                              if (foundWinners.length >= MAX_WINNERS) break;
                          }
                      } catch (err) { }
                  }
              } catch (chunkErr) {
                  console.error("Chunk Error", chunkErr);
              }
          }
          
      } catch(e) { 
          console.error("History Fatal Error", e);
      } finally { 
          setHistoryLoading(false); 
      }
  };

  useEffect(() => {
    const t = setInterval(() => {
        if(nextDraw === 0) return;
        const diff = nextDraw - Math.floor(Date.now()/1000);
        if(diff <= 0) setTimeLeft("Drawing...");
        else {
            const h = Math.floor(diff/3600);
            const m = Math.floor((diff%3600)/60);
            const s = diff%60;
            setTimeLeft(`${h}h ${m}m ${s}s`);
        }
    }, 1000);
    return () => clearInterval(t);
  }, [nextDraw]);

  // --- TRANSACTIONS ---
  
  const buyTicket = async (symbol) => {
      if(!signer) return connectWallet();
      setLoading(symbol);
      try {
          const tokenConfig = CONFIG.tokens[symbol];
          const tokenContract = new window.ethers.Contract(tokenConfig.address, ERC20_ABI, signer);
          const lottery = new window.ethers.Contract(CONFIG.contractAddress, LOTTERY_ABI, signer);
          const price = window.ethers.utils.parseUnits("1.0", 6);

          const allow = await tokenContract.allowance(account, CONFIG.contractAddress);
          if(allow.lt(price)) {
              showFeedback('info', `Approving ${symbol}...`);
              const tx = await tokenContract.approve(CONFIG.contractAddress, price);
              await tx.wait();
          }

          showFeedback('info', `Buying ${symbol} Ticket...`);
          const tx = await lottery.buyTicket(tokenConfig.address);
          await tx.wait();
          
          showFeedback('success', 'Ticket Purchased!');
          fetchData(signer, readProvider);
      } catch(e) {
          console.error(e);
          showFeedback('error', 'Transaction Failed');
      } finally { setLoading(false); }
  };

  const forceDraw = async () => {
      if(!signer) return;
      setLoading('DRAW');
      try {
          const lottery = new window.ethers.Contract(CONFIG.contractAddress, LOTTERY_ABI, signer);
          const tx = await lottery.forceDraw({ gasLimit: 1500000 });
          await tx.wait();
          showFeedback('success', 'Draws Executed!');
          setTimeout(() => { fetchData(signer, readProvider); fetchHistory(signer, readProvider); }, 3000);
      } catch(e) { showFeedback('error', 'Draw Failed'); }
      finally { setLoading(false); }
  };

  // --- CONNECT LOGIC (MOBILE UPDATED) ---
  const connectWallet = async () => {
    // 1. PC/Wallet Browser (Injected)
    if (window.ethereum) {
        try {
          const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accs.length > 0) {
            const p = new window.ethers.providers.Web3Provider(window.ethereum);
            const s = p.getSigner(accs[0]);
            await s.signMessage(`Login LuckyDay ${Date.now()}`);
            setAccount(accs[0]);
            setSigner(s);
          }
        } catch (e) { showFeedback('error', 'Connection Cancelled'); }
        return;
    }

    // 2. Mobile without Injected Wallet -> Show Menu
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        setShowMobileMenu(true);
    } else {
        // 3. Desktop sem carteira
        window.open("https://metamask.io/download/", "_blank");
    }
  };

  const handleMobileConnect = (type) => {
      const currentUrl = window.location.href.replace('https://', '').replace('http://', '');
      let link = '';
      
      if (type === 'metamask') {
          link = `https://metamask.app.link/dapp/${currentUrl}`;
      } else if (type === 'rabby') {
          // CORREÇÃO: Usando Universal Link da Rabby conforme documentado
          link = `https://rabby.io/`; 
      }
      
      if (link) window.location.href = link;
      setShowMobileMenu(false);
  };

  const disconnectWallet = () => {
    setAccount(''); setSigner(null); setIsAdminLoggedIn(false); setIsOwnerWallet(false);
  };

  const showFeedback = (type, msg) => {
      setFeedback({ type, message: msg });
      setTimeout(() => setFeedback(null), 4000);
  };

  const formatAddress = (addr) => {
      if (typeof addr !== 'string') return '...';
      return `${addr.substring(0,6)}...${addr.slice(-4)}`;
  };

  if (!libLoaded) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 pb-20">
      
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-emerald-500 to-blue-500 p-2 rounded-lg shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-white tracking-tight">Lucky<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Day</span></span>
          </div>
          
          {/* LIVE BADGE - CENTERED */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 bg-emerald-900/30 border border-emerald-500/30 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]">
             <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]"></div>
             <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Live on Arc Testnet</span>
          </div>

          <div className="flex items-center gap-3">
             {isOwnerWallet && !isAdminLoggedIn && (
                <button onClick={async () => {
                    try { await signer.signMessage("Admin Login"); setIsAdminLoggedIn(true); } catch(e){}
                }} className="text-xs font-bold border border-amber-500 text-amber-500 px-4 py-2 rounded-full hover:bg-amber-500/10 flex items-center gap-2 transition-all">
                    <Lock size={14}/> Admin
                </button>
             )}
             {account ? (
                 <div className="flex items-center gap-2">
                     <span className="px-4 py-2 rounded-full text-sm font-medium border border-slate-800 bg-slate-900 text-slate-300 font-mono">
                        {formatAddress(account)}
                     </span>
                     <button onClick={disconnectWallet} className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <LogOut size={20}/>
                     </button>
                 </div>
             ) : (
                 <button onClick={connectWallet} className="px-6 py-2.5 rounded-full text-sm font-bold bg-white text-slate-950 hover:bg-slate-200 shadow-lg">Connect Wallet</button>
             )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 relative">
        
        {wrongNetwork && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center gap-3 text-red-400 animate-pulse">
                <AlertTriangle className="w-5 h-5"/> 
                <span className="font-bold">Wrong Network! Please switch to Arc Testnet.</span>
            </div>
        )}

        {feedback && (
            <div className={`fixed top-24 right-4 px-6 py-4 rounded-xl border flex items-center gap-3 z-50 shadow-2xl animate-in slide-in-from-right fade-in duration-300 ${feedback.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-blue-950/90 border-blue-500/50 text-blue-200'}`}>
                {feedback.type === 'success' ? <CheckCircle2 size={20}/> : <Info size={20}/>}
                <span className="font-medium">{feedback.message}</span>
            </div>
        )}

        {/* MOBILE WALLET MENU MODAL */}
        {showMobileMenu && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                    <button 
                        onClick={() => setShowMobileMenu(false)}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                    
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Smartphone className="text-emerald-400"/> Connect Mobile
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">Choose your preferred wallet app to open LuckyDay.</p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => handleMobileConnect('metamask')}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center gap-3 transition-all font-bold text-white group"
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="MetaMask"/>
                            Open MetaMask
                        </button>
                        
                        <button 
                            onClick={() => handleMobileConnect('rabby')}
                            className="w-full py-4 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 rounded-xl flex items-center justify-center gap-3 transition-all font-bold text-indigo-200 group"
                        >
                            <img src="https://rabby.io/assets/logo.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Rabby" onError={(e) => e.target.style.display='none'}/>
                            <span className="flex items-center gap-2"><Zap size={16}/> Open Rabby</span>
                        </button>
                    </div>
                    <div className="mt-4 text-center text-xs text-slate-500">
                        If buttons don't work, please open your wallet app manually and use the built-in browser.
                    </div>
                </div>
            </div>
        )}

        {/* ADMIN PANEL */}
        {isAdminLoggedIn && (
          <div className="mb-12 border border-amber-500/30 bg-amber-900/10 rounded-3xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <UserCog className="w-24 h-24 text-amber-500" />
             </div>
             
             <div className="relative z-10">
               <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-amber-500/20 rounded-lg">
                   <UserCog className="w-6 h-6 text-amber-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-amber-400">Admin Panel</h2>
               </div>

               <div className="grid md:grid-cols-2 gap-8">
                 {/* Info */}
                 <div className="bg-slate-950/50 rounded-xl p-4 border border-amber-500/20">
                    <h3 className="font-bold text-slate-300 mb-4 text-sm uppercase tracking-wider">Status</h3>
                    <div className="space-y-2">
                        <p className="text-sm text-slate-400">USDC Players: <span className="text-white">{pools.USDC.players}</span></p>
                        <p className="text-sm text-slate-400">EURC Players: <span className="text-white">{pools.EURC.players}</span></p>
                        <p className="text-sm text-slate-400">Pool Total: <span className="text-white">{pools.USDC.pot} USDC + {pools.EURC.pot} EURC</span></p>
                    </div>
                 </div>

                 {/* Draw Control */}
                 <div className="flex flex-col justify-between">
                    <div className="mb-4">
                       <p className="text-sm text-slate-400">Draw Status:</p>
                       <p className="text-xl font-mono text-white mt-1">{timeLeft}</p>
                    </div>
                    
                    <button
                      onClick={forceDraw}
                      disabled={loading}
                      className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Gavel className="w-5 h-5" />}
                      Trigger Draw Now
                    </button>
                    <p className="text-[10px] text-amber-500/60 mt-2 text-center">
                       Warning: This will execute the draw immediately, distribute prizes, and reset the lottery. Use with caution.
                    </p>
                 </div>
               </div>
             </div>
          </div>
        )}

        <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight">
                Double The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Chances</span>
            </h1>
            <p className="text-slate-400 text-lg">Separate pools. Fair odds. Choose your currency and play.</p>
            
            <div className="mt-8 inline-flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl">
                 <Timer className="text-slate-400 w-5 h-5" />
                 <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Next Draw In:</span>
                 <span className="text-2xl font-mono font-bold text-white">{timeLeft || "--:--:--"}</span>
            </div>
        </div>

        {/* SPLIT POOLS DISPLAY */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
            
            {/* ---- USDC COLUMN ---- */}
            <div className="flex flex-col gap-6">
                {/* USDC BUY CARD */}
                <div className="bg-slate-900 border border-blue-500/20 rounded-[2rem] overflow-hidden relative group hover:border-blue-500/40 transition-all">
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <Coins className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">USDC Pool</h2>
                                    <p className="text-blue-400 text-xs font-bold tracking-wider uppercase">1.00 USDC Entry</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Win Estimate</p>
                                <p className="text-3xl font-bold text-white">{pools.USDC.pot} <span className="text-sm text-slate-500">USDC</span></p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between text-sm p-4 bg-slate-950 rounded-xl border border-slate-800">
                                <span className="text-slate-400">Your Tickets</span>
                                <span className="font-mono text-white font-bold">
                                    <span className={pools.USDC.userTickets >= maxTickets ? "text-red-400" : "text-blue-400"}>{pools.USDC.userTickets}</span>/{maxTickets}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => buyTicket('USDC')}
                                disabled={loading || !account || pools.USDC.userTickets >= maxTickets}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {loading === 'USDC' ? <RefreshCcw className="animate-spin"/> : <Ticket/>}
                                {pools.USDC.userTickets >= maxTickets ? 'Limit Reached' : 'Enter USDC Draw'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* USDC PLAYERS LIST */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6 flex flex-col h-[300px] relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                        <Trophy className="w-5 h-5 text-blue-400"/>
                        <h3 className="font-bold text-white">USDC Players <span className="text-slate-500 ml-2 text-sm font-normal">({pools.USDC.players})</span></h3>
                    </div>
                    
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2 -mr-2">
                        {participants.filter(p => p.symbol === 'USDC').length > 0 ? participants.filter(p => p.symbol === 'USDC').map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-blue-500/30 transition-colors">
                                <span className="font-mono text-sm text-slate-400">{formatAddress(p.address)}</span>
                                <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 font-bold">Ticket #{i+1}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-40">
                                <p className="text-sm">No players yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ---- EURC COLUMN ---- */}
            <div className="flex flex-col gap-6">
                {/* EURC BUY CARD */}
                <div className="bg-slate-900 border border-emerald-500/20 rounded-[2rem] overflow-hidden relative group hover:border-emerald-500/40 transition-all">
                    <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <Coins className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">EURC Pool</h2>
                                    <p className="text-emerald-400 text-xs font-bold tracking-wider uppercase">1.00 EURC Entry</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Win Estimate</p>
                                <p className="text-3xl font-bold text-white">{pools.EURC.pot} <span className="text-sm text-slate-500">EURC</span></p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between text-sm p-4 bg-slate-950 rounded-xl border border-slate-800">
                                <span className="text-slate-400">Your Tickets</span>
                                <span className="font-mono text-white font-bold">
                                    <span className={pools.EURC.userTickets >= maxTickets ? "text-red-400" : "text-emerald-400"}>{pools.EURC.userTickets}</span>/{maxTickets}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => buyTicket('EURC')}
                                disabled={loading || !account || pools.EURC.userTickets >= maxTickets}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                {loading === 'EURC' ? <RefreshCcw className="animate-spin"/> : <Ticket/>}
                                {pools.EURC.userTickets >= maxTickets ? 'Limit Reached' : 'Enter EURC Draw'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* EURC PLAYERS LIST */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6 flex flex-col h-[300px] relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                        <Trophy className="w-5 h-5 text-emerald-400"/>
                        <h3 className="font-bold text-white">EURC Players <span className="text-slate-500 ml-2 text-sm font-normal">({pools.EURC.players})</span></h3>
                    </div>
                    
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2 -mr-2">
                        {participants.filter(p => p.symbol === 'EURC').length > 0 ? participants.filter(p => p.symbol === 'EURC').map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-colors">
                                <span className="font-mono text-sm text-slate-400">{formatAddress(p.address)}</span>
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 font-bold">Ticket #{i+1}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-40">
                                <p className="text-sm">No players yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>

        {/* GLOBAL WINNERS HISTORY */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <History className="w-5 h-5 text-indigo-400"/>
                    </div>
                    <h3 className="font-bold text-white text-lg">Global Winners History</h3>
                </div>
                <button 
                    onClick={() => fetchHistory(signer, readProvider)} 
                    disabled={historyLoading}
                    className="p-2 rounded-full hover:bg-slate-800 text-slate-600 hover:text-white transition-colors"
                    title="Refresh History"
                >
                    <RefreshCcw className={`w-5 h-5 ${historyLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.length > 0 ? history.map((h, i) => (
                    <a 
                        key={i} 
                        href={`${CONFIG.explorerUrl}${h.txHash ? h.txHash.trim() : ''}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-5 bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-all group cursor-pointer relative"
                        title="View on Arcscan"
                    >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <ExternalLink className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <Award className="w-4 h-4 text-yellow-500" />
                                <span className="font-mono text-sm text-indigo-300 font-bold group-hover:text-indigo-200 transition-colors">
                                    {h.winner ? `${h.winner.substring(0,6)}...${h.winner.slice(-4)}` : 'Unknown'}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">{h.date}</span>
                        </div>
                        <div className="text-right">
                            <span className={`text-sm px-3 py-1 rounded-full font-mono font-bold transition-colors ${h.symbol === 'USDC' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                +{Number(h.prize).toFixed(2)} {h.symbol}
                            </span>
                        </div>
                    </a>
                )) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-600 opacity-40">
                        <History className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm font-medium">{historyLoading ? 'Loading blockchain history...' : 'No history yet.'}</p>
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
}