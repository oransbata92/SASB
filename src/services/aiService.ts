import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface AIAnalysisResult {
  summary: string;
  shortTermPrediction: string;
  supportLevels: string[];
  resistanceLevels: string[];
  trendOutlook: "BULLISH" | "BEARISH" | "NEUTRAL";
  riskDisclaimer: string;
}

export async function getAIAnalysis(marketData: any): Promise<AIAnalysisResult> {
  const prompt = `
    Analyze the following trading data and provide a professional technical report.
    
    Data:
    Symbol: ${marketData.symbol}
    Timeframe: ${marketData.timeframe}
    Trend: ${marketData.trend}
    Current System Decision: ${marketData.decision}
    System Confidence: ${marketData.confidence}%
    Entry: ${marketData.entry}
    Stop Loss: ${marketData.stopLoss}
    Take Profit: ${marketData.takeProfit}
    Reasons from System: ${marketData.reasons.join(", ")}
    
    Requirements:
    1. A detailed technical summary of what this means.
    2. A technical short-term prediction (next 5-10 candles).
    3. Identify 2 key support levels and 2 key resistance levels based on current data.
    4. Provide an overall trend outlook.
    5. Include a standard financial risk disclaimer in Arabic or English.
    
    Format the response strictly as a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            shortTermPrediction: { type: Type.STRING },
            supportLevels: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            resistanceLevels: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            trendOutlook: { 
              type: Type.STRING,
              enum: ["BULLISH", "BEARISH", "NEUTRAL"]
            },
            riskDisclaimer: { type: Type.STRING }
          },
          required: ["summary", "shortTermPrediction", "supportLevels", "resistanceLevels", "trendOutlook", "riskDisclaimer"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text.trim()) as AIAnalysisResult;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
}
