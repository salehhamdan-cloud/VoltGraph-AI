
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ElectricalNode, AnalysisResult } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

// Define the response schema for structured analysis
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ['safe', 'warning', 'danger'],
      description: "Overall safety status of the configuration."
    },
    summary: {
      type: Type.STRING,
      description: "A brief technical summary of the circuit."
    },
    issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of potential hazards, incompatibilities, or code violations."
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of suggested improvements or fixes."
    }
  },
  required: ["status", "summary", "issues", "recommendations"]
};

export const analyzeCircuit = async (nodes: ElectricalNode[]): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Analyze the following electrical single-line diagram structure (represented as a list of component trees) for an industrial or commercial setup.
      
      Note: Some fields (Amps, Voltage, Model) may be missing/optional. Infer standard values based on component type if missing, or flag as "Missing Data" if critical for safety.

      Review for:
      1. Amperage cascading logic (if data available).
      2. Voltage compatibility (if data available).
      3. Missing critical components (e.g., transformers without downstream protection).
      4. General best practices for the component types listed.
      
      Circuit Data:
      ${JSON.stringify(nodes, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "You are a Senior Electrical Engineer specializing in Single Line Diagrams (SLD) and safety compliance (IEC/NEC standards). Analyze the provided JSON tree structure strictly."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      status: 'warning',
      summary: 'Failed to connect to AI analysis service.',
      issues: ['Could not verify circuit safety due to network or API error.'],
      recommendations: ['Check your internet connection and API key settings.']
    };
  }
};
