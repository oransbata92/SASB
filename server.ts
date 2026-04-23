import express from "express";
import axios from "axios";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- TRADING LOGIC ENGINE ---

  function findSwings(candles: any[]) {
    const swingHighs = [];
    const swingLows = [];

    for (let i = 2; i < candles.length - 2; i++) {
      if (
        candles[i].high > candles[i - 1].high &&
        candles[i].high > candles[i - 2].high &&
        candles[i].high > candles[i + 1].high &&
        candles[i].high > candles[i + 2].high
      ) {
        swingHighs.push({ index: i, price: candles[i].high });
      }

      if (
        candles[i].low < candles[i - 1].low &&
        candles[i].low < candles[i - 2].low &&
        candles[i].low < candles[i + 1].low &&
        candles[i].low < candles[i + 2].low
      ) {
        swingLows.push({ index: i, price: candles[i].low });
      }
    }

    return { swingHighs, swingLows };
  }

  function analyzeStructure(candles: any[], swingHighs: any[], swingLows: any[]) {
    if (swingHighs.length < 2 || swingLows.length < 2) {
      return { trend: "SIDEWAYS", resistance: 0, support: 0 };
    }

    const lastHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    const lastLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];

    let trend = "SIDEWAYS";

    if (lastHigh.price > prevHigh.price && lastLow.price > prevLow.price) {
      trend = "UPTREND";
    }

    if (lastHigh.price < prevHigh.price && lastLow.price < prevLow.price) {
      trend = "DOWNTREND";
    }

    return {
      trend,
      resistance: lastHigh.price,
      support: lastLow.price
    };
  }

  function detectBreakout(candles: any[], structure: any) {
    const last = candles[candles.length - 1];

    const bullishBreakout =
      last.close > structure.resistance &&
      last.close > last.open;

    const bearishBreakout =
      last.close < structure.support &&
      last.close < last.open;

    return {
      bullishBreakout,
      bearishBreakout,
      type: bullishBreakout ? "UP" : bearishBreakout ? "DOWN" : null
    };
  }

  function detectRetest(candles: any[], breakout: any, structure: any) {
    if (!breakout.type) return false;

    const last3 = candles.slice(-3);
    const tolerance = 0.005; // 0.5%

    if (breakout.type === "UP") {
      const pullback = last3.some(c =>
        c.low <= structure.resistance * (1 + tolerance) &&
        c.low >= structure.resistance * (1 - tolerance)
      );
      const confirmation = last3[last3.length - 1].close > structure.resistance;
      return pullback && confirmation;
    }

    if (breakout.type === "DOWN") {
      const pullback = last3.some(c =>
        c.high >= structure.support * (1 - tolerance) &&
        c.high <= structure.support * (1 + tolerance)
      );
      const confirmation = last3[last3.length - 1].close < structure.support;
      return pullback && confirmation;
    }

    return false;
  }

  function analyzeVolume(candles: any[], assetClass: string) {
    if (assetClass === "forex") {
      return { strong: true, weak: false, ratio: "1.00" };
    }

    const last20 = candles.slice(-20);
    const avgVol = last20.reduce((a, c) => a + c.volume, 0) / 20;
    const currVol = candles[candles.length - 1].volume;

    return {
      strong: currVol > avgVol * 1.5,
      weak: currVol < avgVol * 1.2,
      ratio: (currVol / avgVol).toFixed(2)
    };
  }

  function calculateRisk(candles: any[], structure: any) {
    const entry = candles[candles.length - 1].close;

    const stopLoss = structure.trend === "UPTREND"
      ? structure.support
      : structure.resistance;

    const riskDist = Math.abs(entry - stopLoss);
    const takeProfit = structure.trend === "UPTREND"
      ? entry + riskDist * 2
      : entry - riskDist * 2;

    const rr = riskDist === 0 ? "0" : (Math.abs(takeProfit - entry) / riskDist).toFixed(2);

    return {
      entry,
      stopLoss,
      takeProfit,
      riskReward: `1:${rr}`,
      valid: parseFloat(rr) >= 1.5
    };
  }

  function makeDecision(data: any) {
    const { symbol, interval, assetClass, trend, breakout, retest, volume, risk } = data;

    if (!breakout.type) {
      return {
        symbol, assetClass, timeframe: interval,
        decision: "WAIT", confidence: 0,
        reasons: ["No breakout or breakdown detected"]
      };
    }

    if (!retest) {
      return {
        symbol, assetClass, timeframe: interval,
        decision: "WAIT", confidence: 20,
        reasons: ["Breakout detected — waiting for retest"]
      };
    }

    if (!risk || !risk.valid) {
      return {
        symbol, assetClass, timeframe: interval,
        decision: "WAIT", confidence: 10,
        reasons: ["Risk/Reward too low (need 1:1.5+)"]
      };
    }

    if (breakout.bullishBreakout && retest && trend === "UPTREND") {
      let confidence = 75;
      let reasons = [
        "✅ Bullish breakout above resistance",
        "✅ Retest held — level confirmed as support",
        "✅ Higher Highs + Higher Lows (Uptrend)"
      ];

      if (volume.strong) {
        confidence = 85;
        reasons.push("✅ Strong volume expansion on breakout");
      } else if (volume.weak && assetClass !== "forex") {
        confidence = 60;
        reasons = ["⚠️ Breakout valid but weak volume — caution"];
      }

      return {
        symbol, assetClass, timeframe: interval, trend,
        decision: "BUY", confidence,
        entry: risk.entry, stopLoss: risk.stopLoss,
        takeProfit: risk.takeProfit, riskReward: risk.riskReward,
        reasons
      };
    }

    if (breakout.bearishBreakout && retest && trend === "DOWNTREND") {
      let confidence = 75;
      let reasons = [
        "✅ Bearish breakdown below support",
        "✅ Retest held — level confirmed as resistance",
        "✅ Lower Highs + Lower Lows (Downtrend)"
      ];

      if (volume.strong) {
        confidence = 85;
        reasons.push("✅ Strong volume expansion on breakdown");
      } else if (volume.weak && assetClass !== "forex") {
        confidence = 60;
        reasons = ["⚠️ Breakdown valid but weak volume — caution"];
      }

      return {
        symbol, assetClass, timeframe: interval, trend,
        decision: "SELL", confidence,
        entry: risk.entry, stopLoss: risk.stopLoss,
        takeProfit: risk.takeProfit, riskReward: risk.riskReward,
        reasons
      };
    }

    return {
      symbol, assetClass, timeframe: interval, trend,
      decision: "WAIT", confidence: 40,
      reasons: ["⏳ No valid setup — structure or confirmation missing"]
    };
  }

  // --- DATA FETCHERS ---

  async function fetchCryptoCandles(symbol: string, interval: string) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
      const res = await axios.get(url);
      return res.data.map((c: any) => ({
        timestamp: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[7])
      }));
    } catch (error) {
      console.error(`Error fetching crypto candles for ${symbol}:`, error);
      return [];
    }
  }

  async function fetchForexCandles(pair: string, interval: string) {
    const resolutionMap: any = {
      "1m": "1", "5m": "5", "15m": "15",
      "1h": "60", "4h": "240", "1d": "D"
    };
    const resolution = resolutionMap[interval] || "5";
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600 * 24 * 7;

    const converted = `OANDA:${pair.slice(0, 3)}_${pair.slice(3)}`;

    try {
      if (!process.env.FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY missing");
      const res = await axios.get(
        `https://finnhub.io/api/v1/forex/candle`,
        {
          params: {
            symbol: converted, resolution, from, to: now,
            token: process.env.FINNHUB_API_KEY
          }
        }
      );

      if (!res.data.c) return [];

      return res.data.c.map((close: any, i: number) => ({
        timestamp: res.data.t[i] * 1000,
        open: res.data.o[i],
        high: res.data.h[i],
        low: res.data.l[i],
        close,
        volume: 0
      })).slice(-200);
    } catch (error) {
      console.error(`Error fetching forex candles for ${pair}:`, error);
      return [];
    }
  }

  async function fetchStockCandles(symbol: string, interval: string) {
    const resolutionMap: any = {
      "1m": "1", "5m": "5", "15m": "15",
      "1h": "60", "4h": "240", "1d": "D"
    };
    const resolution = resolutionMap[interval] || "D";
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600 * 24 * 365;

    try {
      if (!process.env.FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY missing");
      const res = await axios.get(
        `https://finnhub.io/api/v1/stock/candle`,
        {
          params: {
            symbol, resolution, from, to: now,
            token: process.env.FINNHUB_API_KEY
          }
        }
      );

      if (!res.data.c) return [];

      return res.data.c.map((close: any, i: number) => ({
        timestamp: res.data.t[i] * 1000,
        open: res.data.o[i],
        high: res.data.h[i],
        low: res.data.l[i],
        close,
        volume: res.data.v[i] || 0
      })).slice(-200);
    } catch (error) {
      console.error(`Error fetching stock candles for ${symbol}:`, error);
      return [];
    }
  }

  async function fetchCandles(symbol: string, interval: string, assetClass: string) {
    if (assetClass === "crypto") return fetchCryptoCandles(symbol, interval);
    if (assetClass === "forex") return fetchForexCandles(symbol, interval);
    if (assetClass === "stocks") return fetchStockCandles(symbol, interval);
    return [];
  }

  // --- WYCKOFF MARKET PHASE DETECTOR ---

  function calculateMA(data: number[], period: number) {
    if (data.length < period) return 0;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
      sum += data[i];
    }
    return sum / period;
  }

  function calculateRSI(prices: number[], period = 14) {
    if (prices.length <= period) return 50;
    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length - 1; i++) {
      let diff = prices[i + 1] - prices[i];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  function detectPhase(prices: number[]) {
    let ma = calculateMA(prices, 20);
    let rsi = calculateRSI(prices);

    let currentPrice = prices[prices.length - 1];

    let score: any = {
      accumulation: 0,
      markup: 0,
      distribution: 0,
      markdown: 0
    };

    if (currentPrice > ma) score.markup += 2;
    if (rsi > 55) score.markup += 2;

    if (currentPrice < ma) score.markdown += 2;
    if (rsi < 45) score.markdown += 2;

    if (rsi >= 40 && rsi <= 60) score.accumulation += 2;

    if (currentPrice > ma && rsi < 55) score.distribution += 2;

    let total = Object.values(score).reduce((a: any, b: any) => a + b, 0) as number;
    if (total === 0) total = 1;

    let percentages: any = {};
    for (let key in score) {
      percentages[key] = ((score[key] / total) * 100).toFixed(1);
    }

    let phase = Object.keys(score).reduce((a, b) =>
      score[a] > score[b] ? a : b
    );

    let descriptions: any = {
      accumulation: "السوق في مرحلة تجميع مع حركة عرضية واستعداد لحركة قادمة",
      markup: "السوق في اتجاه صاعد مع قوة شرائية واضحة",
      distribution: "السوق يظهر ضعف في القمة واحتمال بدء التصريف",
      markdown: "السوق في اتجاه هابط مع ضغط بيعي واضح"
    };

    return {
      phase,
      confidence: percentages[phase],
      details: percentages,
      description: descriptions[phase],
      indicators: {
        MA: ma.toFixed(2),
        RSI: rsi.toFixed(2),
        price: currentPrice
      }
    };
  }

  // --- API ROUTES ---

  app.get("/api/analyze", async (req, res) => {
    const { symbol, interval, assetClass, balance = 1000, riskPercent = 1 } = req.query as any;

    if (!symbol || !interval || !assetClass) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const candles = await fetchCandles(symbol, interval, assetClass);
    if (candles.length < 50) {
      return res.status(404).json({ error: "Insufficient data" });
    }

    const { swingHighs, swingLows } = findSwings(candles);
    const structure = analyzeStructure(candles, swingHighs, swingLows);
    const breakout = detectBreakout(candles, structure);
    const retest = detectRetest(candles, breakout, structure);
    const volume = analyzeVolume(candles, assetClass);
    const risk = calculateRisk(candles, structure);

    const decisionData = makeDecision({
      symbol, interval, assetClass, trend: structure.trend,
      breakout, retest, volume, risk
    });

    const closePrices = candles.map(c => c.close);
    const wyckoff = detectPhase(closePrices);

    // Position sizing
    const riskAmount = balance * (riskPercent / 100);
    const slDistance = Math.abs(risk.entry - risk.stopLoss);
    const positionSize = slDistance === 0 ? 0 : riskAmount / slDistance;

    res.json({
      ...decisionData,
      wyckoff,
      positionSize: parseFloat(positionSize.toFixed(6)),
      riskAmount: parseFloat(riskAmount.toFixed(2))
    });
  });

  const CRYPTO_LIST = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT", "LINKUSDT", "ATOMUSDT", "AVAXUSDT", "MATICUSDT", "UNIUSDT", "LTCUSDT", "DOTUSDT", "FTMUSDT", "SANDUSDT", "MANAUSDT", "AAVEUSDT", "MKRUSDT", "GRTUSDT"];
  const FOREX_LIST = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "EURJPY", "EURGBP", "GBPJPY", "AUDJPY", "NZDJPY", "EURAUD"];
  const STOCK_LIST = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX", "JPM", "BAC", "GS", "MS", "PYPL", "SQ", "COIN", "AMD", "INTC"];

  app.get("/api/signals", async (req, res) => {
    const { interval = "1h" } = req.query as any;
    
    // For general signals, we'll pick a few from each category to avoid rate limits
    const sampleCrypto = CRYPTO_LIST.slice(0, 5);
    const sampleForex = FOREX_LIST.slice(0, 5);
    const sampleStocks = STOCK_LIST.slice(0, 5);

    const allAnalyses: any[] = [];

    const analyzeAsset = async (symbol: string, assetClass: string) => {
      const candles = await fetchCandles(symbol, interval, assetClass);
      if (candles.length < 50) return null;
      const { swingHighs, swingLows } = findSwings(candles);
      const structure = analyzeStructure(candles, swingHighs, swingLows);
      const breakout = detectBreakout(candles, structure);
      const retest = detectRetest(candles, breakout, structure);
      const volume = analyzeVolume(candles, assetClass);
      const risk = calculateRisk(candles, structure);
      return makeDecision({ symbol, interval, assetClass, trend: structure.trend, breakout, retest, volume, risk });
    };

    const results = await Promise.all([
      ...sampleCrypto.map(s => analyzeAsset(s, "crypto")),
      ...sampleForex.map(s => analyzeAsset(s, "forex")),
      ...sampleStocks.map(s => analyzeAsset(s, "stocks"))
    ]);

    res.json(results.filter(r => r !== null).sort((a, b) => b.confidence - a.confidence));
  });

  app.get("/api/symbols/crypto", (req, res) => res.json(CRYPTO_LIST));
  app.get("/api/symbols/forex", (req, res) => res.json(FOREX_LIST));
  app.get("/api/symbols/stocks", (req, res) => res.json(STOCK_LIST));

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
