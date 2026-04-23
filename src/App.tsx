import React, { useState, useEffect, useCallback } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  BarChart3, 
  CircleAlert,
  ChevronDown,
  RefreshCw,
  Coins,
  ArrowRightLeft,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getAIAnalysis, AIAnalysisResult } from "./services/aiService";

enum AssetClass {
  CRYPTO = "crypto",
  FOREX = "forex",
  STOCKS = "stocks"
}

export default function App() {
  const [assetClass, setAssetClass] = useState<AssetClass>(AssetClass.CRYPTO);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [interval, setInterval] = useState("1h");
  const [balance, setBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [analysis, setAnalysis] = useState<any>(null);
  const [allSignals, setAllSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [allSignalsLoading, setAllSignalsLoading] = useState(false);

  const fetchSymbols = useCallback(async (type: AssetClass) => {
    try {
      const res = await fetch(`/api/symbols/${type}`);
      const data = await res.json();
      setSymbols(data);
      if (data.length > 0) setSymbol(data[0]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchAnalysis = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setAiAnalysis(null);
    try {
      const res = await fetch(`/api/analyze?symbol=${symbol}&interval=${interval}&assetClass=${assetClass}&balance=${balance}&riskPercent=${riskPercent}`);
      const data = await res.json();
      setAnalysis(data);
      
      // Trigger AI Analysis
      if (data && data.decision) {
        setAiLoading(true);
        try {
          const aiData = await getAIAnalysis(data);
          setAiAnalysis(aiData);
        } catch (err) {
          console.error("AI Error:", err);
        } finally {
          setAiLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, assetClass, balance, riskPercent]);

  const fetchAllSignals = useCallback(async () => {
    setAllSignalsLoading(true);
    try {
      const res = await fetch(`/api/signals?interval=${interval}`);
      const data = await res.json();
      setAllSignals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAllSignalsLoading(false);
    }
  }, [interval]);

  useEffect(() => {
    fetchSymbols(assetClass);
  }, [assetClass, fetchSymbols]);

  useEffect(() => {
    fetchAnalysis();
    fetchAllSignals();
    const id = window.setInterval(() => {
      fetchAnalysis();
      fetchAllSignals();
    }, 30000);
    return () => window.clearInterval(id);
  }, [fetchAnalysis, fetchAllSignals]);

  const getDecisionStyles = (decision: string) => {
    if (decision === "BUY") return "text-emerald-500 border-success-accent glow-success";
    if (decision === "SELL") return "text-rose-500 border-danger-accent glow-danger";
    return "text-amber-500 border-warning-accent glow-warning";
  };

  const getAssetIcon = (type: string) => {
    if (type === "crypto") return <Coins className="w-4 h-4 text-crypto" />;
    if (type === "forex") return <ArrowRightLeft className="w-4 h-4 text-forex" />;
    return <Briefcase className="w-4 h-4 text-stocks" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-widest text-white flex items-center gap-2">
              TRADING <span className="text-blue-500">SAAS</span> PRO <span className="text-white/30 text-xs font-light tracking-normal ml-2">v3.0 LIVE</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="glass rounded-lg p-3 flex gap-4">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Buy Signals</p>
                  <p className="text-emerald-500 font-mono font-bold text-lg">{allSignals.filter(s => s.decision === "BUY").length}</p>
                </div>
                <div className="w-px bg-slate-800" />
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Sell Signals</p>
                  <p className="text-rose-500 font-mono font-bold text-lg">{allSignals.filter(s => s.decision === "SELL").length}</p>
                </div>
                <div className="w-px bg-slate-800" />
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total analyzed</p>
                  <p className="text-indigo-400 font-mono font-bold text-lg">{allSignals.length}</p>
                </div>
             </div>
          </div>
        </header>

        {/* Controls */}
        <div className="glass rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: AssetClass.CRYPTO, label: "🪙 Crypto", activeColor: "bg-crypto text-black" },
              { id: AssetClass.FOREX, label: "💱 Forex", activeColor: "bg-forex text-black" },
              { id: AssetClass.STOCKS, label: "📈 Stocks", activeColor: "bg-stocks text-black" }
            ].map((asset) => (
              <button
                key={asset.id}
                onClick={() => setAssetClass(asset.id)}
                className={`px-5 py-2 rounded font-bold transition-all ${
                  assetClass === asset.id 
                  ? `${asset.activeColor} shadow-lg` 
                  : `text-slate-400 border border-slate-700 bg-slate-800/50 hover:bg-slate-800`
                }`}
              >
                {asset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Symbol</label>
              <div className="relative">
                <select 
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Timeframe</label>
              <div className="relative">
                <select 
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {["1m", "5m", "15m", "1h", "4h", "1d"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Account Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input 
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-7 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Risk %</label>
              <div className="relative">
                <select 
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {[0.5, 1, 2, 3, 5].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Analysis Result */}
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="h-96 flex flex-col items-center justify-center space-y-4"
             >
               <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
               <p className="text-slate-400 animate-pulse">Running Price Action Engine...</p>
             </motion.div>
          ) : analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-xl overflow-hidden shadow-2xl relative ${getDecisionStyles(analysis.decision)}`}
            >
              <div className="p-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded bg-slate-800 text-xs font-bold tracking-tighter uppercase whitespace-nowrap">{analysis.assetClass}</span>
                      <h2 className="text-4xl font-black tracking-tighter text-white">{analysis.symbol} — {analysis.trend} — {analysis.timeframe}</h2>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-6xl font-black italic tracking-tighter flex items-center gap-4">
                        {analysis.decision === "BUY" && <TrendingUp className="w-16 h-16" />}
                        {analysis.decision === "SELL" && <TrendingDown className="w-16 h-16" />}
                        {analysis.decision === "WAIT" && <Clock className="w-16 h-16" />}
                        {analysis.decision}
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-full px-6 py-2 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 uppercase font-black leading-none mb-1">Confidence</span>
                        <span className="text-2xl font-black text-white">{analysis.confidence}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/50">
                      <div className="glass p-4 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Entry Price</p>
                        <p className="text-2xl font-mono font-bold text-white">${analysis.entry?.toLocaleString() || "---"}</p>
                      </div>
                      <div className="glass p-4 rounded-xl border-rose-500/30">
                        <p className="text-[10px] font-bold uppercase mb-1 text-rose-500/70">Stop Loss</p>
                        <p className="text-2xl font-mono font-bold text-rose-400">${analysis.stopLoss?.toLocaleString() || "---"}</p>
                      </div>
                      <div className="glass p-4 rounded-xl border-emerald-500/30">
                        <p className="text-[10px] font-bold uppercase mb-1 text-emerald-500/70">Take Profit (2R)</p>
                        <p className="text-2xl font-mono font-bold text-emerald-400">${analysis.takeProfit?.toLocaleString() || "---"}</p>
                      </div>
                      <div className="glass p-4 rounded-xl border-slate-700">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Risk : Reward</p>
                        <p className="text-2xl font-mono font-bold text-white">{analysis.riskReward || "---"}</p>
                      </div>
                    </div>

                    {/* Wyckoff Section */}
                    {analysis.wyckoff && (
                      <div className="mt-6 glass rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                             <BarChart3 className="w-4 h-4" /> Wyckoff Market Phase
                          </h3>
                          <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                            {analysis.wyckoff.confidence}% Confidence
                          </span>
                        </div>
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                            <div className="text-2xl font-black italic tracking-tighter text-white uppercase mb-2">
                              {analysis.wyckoff.phase}
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                              {analysis.wyckoff.description}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                               <p className="text-[10px] text-slate-500 uppercase font-bold">RSI (14)</p>
                               <p className="text-lg font-mono font-bold text-white">{analysis.wyckoff.indicators.RSI}</p>
                            </div>
                            <div className="text-center">
                               <p className="text-[10px] text-slate-500 uppercase font-bold">MA (20)</p>
                               <p className="text-lg font-mono font-bold text-white">${analysis.wyckoff.indicators.MA}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full md:w-80 bg-slate-950/50 rounded-2xl p-6 border border-slate-800 space-y-6 self-stretch">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Position Sizing
                      </h3>
                      <div className="space-y-4 text-center">
                        <div className="py-4 border-b border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-medium">Position Size</p>
                          <p className="text-3xl font-mono font-black text-indigo-400">{analysis.positionSize || "0.00"} {analysis.symbol.replace("USDT", "")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-medium">Risk Amount</p>
                          <p className="text-2xl font-mono font-black text-white">${analysis.riskAmount || "0.00"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block">Analysis details</h3>
                      <div className="space-y-2">
                        {analysis.reasons?.map((reason: string, i: number) => (
                          <div key={i} className="text-xs text-slate-300 flex gap-2">
                             <span className="flex-shrink-0">{reason.startsWith("✅") ? "•" : reason.startsWith("⚠️") ? "!" : "•"}</span>
                             <span>{reason.replace(/[✅⚠️⏳]/g, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Insight Section */}
        <AnimatePresence>
          {(aiLoading || aiAnalysis) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BarChart3 className="w-32 h-32" />
              </div>

              <div className="flex items-center gap-2 mb-6">
                <div className="bg-indigo-500 p-1.5 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  AI Contextual Intelligence
                  {aiLoading && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
                </h2>
              </div>

              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="flex gap-2">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
                  </div>
                  <p className="text-xs text-slate-500 font-mono italic">Gemini Pro is synthesizing market data...</p>
                </div>
              ) : aiAnalysis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div>
                      <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Technical Summary</h3>
                      <p className="text-slate-300 leading-relaxed text-sm">{aiAnalysis.summary}</p>
                    </div>
                    <div>
                      <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Predictive Outlook (Short-term)</h3>
                      <p className="text-slate-300 leading-relaxed text-sm font-medium">{aiAnalysis.shortTermPrediction}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 italic">
                      {aiAnalysis.riskDisclaimer}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">AI Sentiment</h3>
                      <div className={`text-2xl font-black italic tracking-tighter ${
                        aiAnalysis.trendOutlook === "BULLISH" ? "text-emerald-500" : 
                        aiAnalysis.trendOutlook === "BEARISH" ? "text-rose-500" : "text-amber-500"
                      }`}>
                        {aiAnalysis.trendOutlook}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-[9px] font-bold text-emerald-500/70 uppercase mb-2">Support Levels</h4>
                        <div className="space-y-1">
                          {aiAnalysis.supportLevels.slice(0, 2).map((l, i) => (
                            <p key={i} className="text-xs font-mono text-white">{l}</p>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-[9px] font-bold text-rose-500/70 uppercase mb-2">Resistance</h4>
                        <div className="space-y-1">
                          {aiAnalysis.resistanceLevels.slice(0, 2).map((l, i) => (
                            <p key={i} className="text-xs font-mono text-white">{l}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* All Signals Table */}
        <section className="glass rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              Market Scanner <span className="text-[10px] text-emerald-500">LIVE</span>
            </h3>
            {allSignalsLoading && <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Signal</th>
                  <th className="px-6 py-4">Conf%</th>
                  <th className="px-6 py-4">R:R</th>
                  <th className="px-6 py-4">Trend</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allSignals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-500 italic font-light italic">No significant signals found in current scan.</td>
                  </tr>
                ) : (
                  allSignals.map((signal, idx) => (
                    <motion.tr 
                      key={idx} 
                      className={`hover:bg-white/5 transition-colors group cursor-pointer ${
                        signal.decision === 'BUY' ? 'border-success-accent' : 
                        signal.decision === 'SELL' ? 'border-danger-accent' : 
                        'border-warning-accent'
                      }`}
                      style={{ borderLeftWidth: '4px' }}
                      onClick={() => {
                        setAssetClass(signal.assetClass as AssetClass);
                        setSymbol(signal.symbol);
                      }}
                    >
                      <td className="px-6 py-4">{getAssetIcon(signal.assetClass)}</td>
                      <td className="px-6 py-4 font-bold text-white">{signal.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`font-black italic text-xs ${
                          signal.decision === "BUY" ? "text-emerald-500" : 
                          signal.decision === "SELL" ? "text-rose-500" : "text-amber-500"
                        }`}>
                          {signal.decision}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">{signal.confidence}%</td>
                      <td className="px-6 py-4 font-mono">{signal.riskReward || "---"}</td>
                      <td className="px-6 py-4 text-xs text-slate-400 uppercase tracking-widest">{signal.trend}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[10px] uppercase font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 ml-auto">
                          Analyze <TrendingUp className="w-3 h-3" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="text-center py-12 border-t border-slate-800 text-slate-600 text-xs">
          <p>© {new Date().getFullYear()} Trading SaaS Pro. Real-time algorithmic market analysis. Not financial advice.</p>
        </footer>
      </div>
    </div>
  );
}
