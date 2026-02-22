import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

// Use a safe way to access environment variables in the browser
const getAI = (userKey?: string) => {
  // @ts-ignore - process.env is replaced by Vite define
  const envKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
  const key = userKey || envKey;
  
  if (!key) {
    throw new Error("No API key provided. Please set a Gemini API key in settings.");
  }
  return new GoogleGenAI({ apiKey: key });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check for specific error types
    const status = error.status || (error.response && error.response.status);
    const message = error.message || "";

    // Retry on rate limit (429) or server errors (5xx)
    if (retries > 0 && (status === 429 || status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    // Provide clearer feedback for common errors
    if (status === 403 || message.includes("permission denied")) {
      throw new Error("API Key issue: Permission Denied. Please ensure you have a valid Gemini API key with proper billing/project access.");
    }
    if (status === 429) {
      throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
    }
    if (message.includes("safety")) {
      throw new Error("The request was blocked by safety filters. Please try a different prompt.");
    }

    throw new Error(message || "An unexpected error occurred with the Gemini API. Please try again.");
  }
}

export async function generateProfileAssets(resumeText: string, jobDescription: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      Based on the following resume and job description, generate professional profile assets:
      1. A LinkedIn Summary (About section) that is engaging and keyword-optimized.
      2. Three "Cover Letter Snippets" - short, impactful paragraphs that can be used in emails or as part of a longer letter, each focusing on a different strength (e.g., Technical Skills, Leadership, Problem Solving).
      
      Output in Markdown format with clear headings.
      
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
        model: "gemini-flash-latest",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function analyzeResume(resumeContent: string | { data: string; mimeType: string }, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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
        model: "gemini-flash-latest",
        contents: { parts },
      });
      return response.text;
    }
  });
}

export async function tailorResume(resumeText: string, jobDescription: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
    const model = "gemini-3.1-pro-preview";
    const prompt = `
      You are an expert career coach. Tailor the following resume to match the job description.
      
      STRUCTURE GUIDELINES:
      - Use a clear hierarchy with Markdown headings.
      - # Full Name (at the top)
      - ## Contact Information (Email, Phone, LinkedIn, Location)
      - ## Professional Summary (3-4 impactful sentences)
      - ## Core Competencies (A bulleted list of key skills)
      - ## Professional Experience (Reverse chronological order)
        - ### Job Title | Company Name | Dates
        - Use bullet points for achievements, starting with strong action verbs.
      - ## Education
      
      TAILORING INSTRUCTIONS:
      - Highlight skills and experiences that directly map to the job description.
      - Quantify achievements where possible (e.g., "Increased sales by 20%").
      - Maintain a professional, modern tone.

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
        model: "gemini-flash-latest",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function researchCompany(companyName: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
    const model = "gemini-flash-latest";
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

export async function getQuickFeedback(text: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
    const model = "gemini-flash-lite-latest";
    const prompt = `Provide a very brief, 2-sentence critique of this text for professional impact: "${text}"`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text;
  });
}

export async function generateProfileImage(prompt: string, size: "1K" | "2K" | "4K" = "1K", aspectRatio: string = "1:1", userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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

export async function analyzeSkillsGap(resumeText: string, jobDescription: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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
        model: "gemini-flash-latest",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function analyzeImage(base64Image: string, mimeType: string, prompt: string = "Describe this image in detail and extract any text or insights.", userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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

export async function editProfileImage(base64Image: string, mimeType: string, editPrompt: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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

export async function generateCoverLetter(resumeText: string, jobDescription: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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
        model: "gemini-flash-latest",
        contents: prompt,
      });
      return response.text;
    }
  });
}

export async function optimizeForATS(tailoredResume: string, jobDescription: string, userKey?: string) {
  return withRetry(async () => {
    const ai = getAI(userKey);
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
        model: "gemini-flash-latest",
        contents: prompt,
      });
      return response.text;
    }
  });
}
