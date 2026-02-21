import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

// Use process.env.API_KEY if available (for user-selected keys), otherwise fallback to the default GEMINI_API_KEY
const getAI = () => {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: key });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Retry on rate limit (429) or server errors (5xx)
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function analyzeResume(resumeContent: string | { data: string; mimeType: string }) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const prompt = "Analyze this resume. First, perform OCR or extract the full text content accurately. Then, provide a brief summary of key skills and experience. Output the FULL TEXT of the resume first, followed by the summary, separated by '---SUMMARY---'.";
    
    const parts: any[] = [];
    if (typeof resumeContent === 'string') {
      parts.push({ text: resumeContent });
    } else {
      parts.push({ inlineData: resumeContent });
    }
    parts.push({ text: prompt });

    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
      });
      return response.text;
    } catch (err) {
      // Fallback to Flash if Pro fails
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
      });
      return response.text;
    }
  });
}

export async function tailorResume(resumeText: string, jobDescription: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      You are an expert career coach. Tailor the following resume to match the job description.
      Focus on highlighting relevant skills and experiences. 
      Maintain a professional tone.
      Output the tailored resume in Markdown format.

      RESUME:
      ${resumeText}

      JOB DESCRIPTION:
      ${jobDescription}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function researchCompany(companyName: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3-flash-preview";
    const prompt = `Research the company "${companyName}". Provide a brief overview of their mission, recent news, and culture to help tailor a resume.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    };
  });
}

export async function getQuickFeedback(text: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-2.5-flash-lite-latest";
    const prompt = `Provide a very brief, 2-sentence critique of this text for professional impact: "${text}"`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text;
  });
}

export async function generateProfileImage(prompt: string, size: "1K" | "2K" | "4K" = "1K", aspectRatio: string = "1:1") {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3-pro-image-preview";
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: `A professional headshot for a LinkedIn profile: ${prompt}` }],
      },
      config: {
        imageConfig: {
          imageSize: size as any,
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  });
}

export async function analyzeSkillsGap(resumeText: string, jobDescription: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      Analyze the following resume and job description. 
      1. Identify key skills (hard and soft) required by the job description that are missing or weak in the resume.
      2. Provide specific suggestions on how to incorporate these skills (e.g., "Mention your experience with X in the Y project").
      
      Output in Markdown format with two sections: "Missing/Under-emphasized Skills" and "Suggestions for Improvement".

      RESUME:
      ${resumeText}

      JOB DESCRIPTION:
      ${jobDescription}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function analyzeImage(base64Image: string, mimeType: string, prompt: string = "Describe this image in detail and extract any text or insights.") {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType,
            },
          },
          { text: prompt },
        ],
      },
    });

    return response.text;
  });
}

export async function editProfileImage(base64Image: string, mimeType: string, editPrompt: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-2.5-flash-image";
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType,
            },
          },
          { text: editPrompt },
        ],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  });
}

export async function generateCoverLetter(resumeText: string, jobDescription: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      You are an expert career coach. Write a compelling, professional cover letter based on the following resume and job description.
      Focus on matching the candidate's strongest achievements to the job's key requirements.
      Maintain a professional yet enthusiastic tone.
      Output the cover letter in Markdown format.

      RESUME:
      ${resumeText}

      JOB DESCRIPTION:
      ${jobDescription}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function optimizeForATS(tailoredResume: string, jobDescription: string) {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      Review the following tailored resume and the original job description.
      1. Identify relevant ATS keywords and phrases from the job description.
      2. Strategically incorporate these keywords into the resume while maintaining a natural, professional flow.
      3. Avoid keyword stuffing.
      
      Output the fully optimized resume in Markdown format.

      TAILORED RESUME:
      ${tailoredResume}

      JOB DESCRIPTION:
      ${jobDescription}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    }
  });
}
