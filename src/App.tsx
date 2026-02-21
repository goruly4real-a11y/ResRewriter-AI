/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  Sparkles, 
  Download, 
  Image as ImageIcon, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Camera,
  Wand2,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  analyzeResume, 
  tailorResume, 
  researchCompany, 
  getQuickFeedback, 
  generateProfileImage, 
  editProfileImage,
  analyzeImage,
  analyzeSkillsGap,
  optimizeForATS,
  generateCoverLetter
} from './services/gemini';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  // State for Resume & JD
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<{ data: string; mimeType: string } | null>(null);
  
  // State for AI outputs
  const [analysis, setAnalysis] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [companyResearch, setCompanyResearch] = useState<{ text: string; sources: any[] } | null>(null);
  const [quickFeedback, setQuickFeedback] = useState('');
  
  // State for Image Gen
  const [profilePrompt, setProfilePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [editPrompt, setEditPrompt] = useState('');
  const [analysisImage, setAnalysisImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState('');
  const [skillsGap, setSkillsGap] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [error, setError] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    analysis: false,
    tailor: false,
    research: false,
    feedback: false,
    image: false,
    edit: false,
    imageAnalysis: false,
    skillsGap: false,
    ats: false,
    coverLetter: false
  });

  const resumeRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setResumeFile({
        data: base64.split(',')[1],
        mimeType: file.type
      });
      // If it's text, also set the text state
      if (file.type === 'text/plain') {
        const textReader = new FileReader();
        textReader.onload = (te) => setResumeText(te.target?.result as string);
        textReader.readAsText(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const onAnalyze = async () => {
    setLoading(prev => ({ ...prev, analysis: true }));
    setError(null);
    try {
      const result = await analyzeResume(resumeFile || resumeText);
      if (result && result.includes('---SUMMARY---')) {
        const [text, summary] = result.split('---SUMMARY---');
        setResumeText(text.trim());
        setAnalysis(summary.trim());
      } else {
        setAnalysis(result || '');
      }
    } catch (err: any) {
      setError("Failed to analyze resume. Please try again.");
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  };

  const onTailor = async () => {
    if (!resumeText && !resumeFile) return;
    setLoading(prev => ({ ...prev, tailor: true }));
    setError(null);
    try {
      const result = await tailorResume(resumeText || "See uploaded file", jobDescription);
      setTailoredResume(result || '');
      // Automatically analyze skills gap after tailoring
      onAnalyzeSkillsGap();
    } catch (err: any) {
      setError("Failed to tailor resume. The AI might be busy, please try again.");
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, tailor: false }));
    }
  };

  const onAnalyzeSkillsGap = async () => {
    if (!resumeText && !resumeFile) return;
    setLoading(prev => ({ ...prev, skillsGap: true }));
    try {
      const result = await analyzeSkillsGap(resumeText || "See uploaded file", jobDescription);
      setSkillsGap(result || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, skillsGap: false }));
    }
  };

  const onOptimizeATS = async () => {
    if (!tailoredResume || !jobDescription) return;
    setLoading(prev => ({ ...prev, ats: true }));
    try {
      const result = await optimizeForATS(tailoredResume, jobDescription);
      setTailoredResume(result || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, ats: false }));
    }
  };

  const onGenerateCoverLetter = async () => {
    if (!resumeText && !resumeFile) return;
    setLoading(prev => ({ ...prev, coverLetter: true }));
    setError(null);
    try {
      const result = await generateCoverLetter(resumeText || "See uploaded file", jobDescription);
      setCoverLetter(result || '');
    } catch (err: any) {
      setError("Failed to generate cover letter. Please try again.");
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, coverLetter: false }));
    }
  };

  const onResearch = async () => {
    // Try to extract company name from JD
    const companyMatch = jobDescription.match(/at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const companyName = companyMatch ? companyMatch[1] : prompt("Enter company name to research:");
    if (!companyName) return;

    setLoading(prev => ({ ...prev, research: true }));
    try {
      const result = await researchCompany(companyName);
      setCompanyResearch(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, research: false }));
    }
  };

  const onGetFeedback = async (text: string) => {
    setLoading(prev => ({ ...prev, feedback: true }));
    try {
      const result = await getQuickFeedback(text);
      setQuickFeedback(result || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, feedback: false }));
    }
  };

  const onGenerateImage = async () => {
    // Check for API key selection for gemini-3-pro-image-preview
    if (typeof window !== 'undefined' && window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          // After opening, we proceed. The platform handles the key injection.
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      }
    }

    setLoading(prev => ({ ...prev, image: true }));
    setError(null);
    try {
      const result = await generateProfileImage(profilePrompt, imageSize, aspectRatio);
      setGeneratedImage(result);
    } catch (err: any) {
      const errorMsg = err.message || "";
      if (errorMsg.includes("permission denied") || errorMsg.includes("Requested entity was not found")) {
        setError("API Key issue: Permission Denied. Please select a valid paid project API key.");
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        setError("Failed to generate headshot. Please try again.");
      }
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, image: false }));
    }
  };

  const onEditImage = async () => {
    if (!generatedImage) return;
    setLoading(prev => ({ ...prev, edit: true }));
    try {
      const result = await editProfileImage(generatedImage, "image/png", editPrompt);
      setGeneratedImage(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const onAnalyzeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setAnalysisImage({ data: base64, mimeType: file.type });
      
      setLoading(prev => ({ ...prev, imageAnalysis: true }));
      try {
        const result = await analyzeImage(base64, file.type);
        setImageAnalysisResult(result || '');
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(prev => ({ ...prev, imageAnalysis: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const exportPDF = async () => {
    if (!resumeRef.current) return;
    const canvas = await html2canvas(resumeRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('tailored-resume.pdf');
  };

  const exportImage = async () => {
    if (!resumeRef.current) return;
    const canvas = await html2canvas(resumeRef.current);
    const link = document.createElement('a');
    link.download = 'tailored-resume.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-[#e5e5e5] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">ResumeCraft AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#tailor" className="text-sm font-medium text-[#666] hover:text-[#1a1a1a]">Tailoring</a>
            <a href="#research" className="text-sm font-medium text-[#666] hover:text-[#1a1a1a]">Research</a>
            <a href="#creative" className="text-sm font-medium text-[#666] hover:text-[#1a1a1a]">Creative</a>
          </nav>
          <a href="#tailor" className="btn-primary py-2 px-4 text-sm">Get Started</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Hero */}
        <section className="text-center space-y-4 max-w-2xl mx-auto">
          <h1 className="text-5xl font-light tracking-tight text-[#1a1a1a]">
            Craft your <span className="font-medium">perfect</span> career story.
          </h1>
          <p className="text-[#666] text-lg">
            AI-powered resume tailoring, company research, and professional asset generation in one place.
          </p>
        </section>

        {/* Input Section */}
        <section id="tailor" className="grid md:grid-cols-2 gap-8">
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" /> Your Resume
              </h2>
              <label className="cursor-pointer text-sm font-medium text-[#666] hover:text-[#1a1a1a] flex items-center gap-1">
                <Upload className="w-4 h-4" /> Upload PDF/Image
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg,.txt" />
              </label>
            </div>
            <textarea 
              className="input-field h-64 resize-none"
              placeholder="Paste your current resume here or upload a file..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            <div className="flex gap-3">
              <button 
                onClick={onAnalyze}
                disabled={loading.analysis || (!resumeText && !resumeFile)}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                {loading.analysis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Analyze Resume
              </button>
              <button 
                onClick={() => onGetFeedback(resumeText)}
                disabled={loading.feedback || !resumeText}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                {loading.feedback ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Quick Feedback
              </button>
            </div>
            {quickFeedback && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm italic"
              >
                "{quickFeedback}"
              </motion.div>
            )}
          </div>

          <div className="card space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ChevronRight className="w-5 h-5" /> Job Description
            </h2>
            <textarea 
              className="input-field h-64 resize-none"
              placeholder="Paste the job description you're targeting..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <div className="flex gap-3">
              <button 
                onClick={onResearch}
                disabled={loading.research || !jobDescription}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                {loading.research ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Research Company
              </button>
              <button 
                onClick={onTailor}
                disabled={loading.tailor || (!resumeText && !resumeFile) || !jobDescription}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading.tailor ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Tailor Resume
              </button>
            </div>
            <button 
              onClick={onGenerateCoverLetter}
              disabled={loading.coverLetter || (!resumeText && !resumeFile) || !jobDescription}
              className="btn-secondary w-full flex items-center justify-center gap-2 mt-4 border-emerald-100 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50"
            >
              {loading.coverLetter ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Cover Letter
            </button>
          </div>
        </section>

        {/* Ad Placeholder Top */}
        <div className="max-w-4xl mx-auto h-24 bg-[#f9f9f9] border border-dashed border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#ccc] text-xs font-mono uppercase tracking-widest">
          Advertisement Space
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {(analysis || companyResearch || tailoredResume) && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="grid md:grid-cols-3 gap-8">
                {analysis && (
                  <div className="card md:col-span-1 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-[#666]">Resume Insights</h3>
                    <div className="text-sm prose prose-sm">
                      <Markdown>{analysis}</Markdown>
                    </div>
                  </div>
                )}
                {companyResearch && (
                  <div className="card md:col-span-2 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-[#666]">Company Intelligence</h3>
                    <div className="text-sm prose prose-sm">
                      <Markdown>{companyResearch.text}</Markdown>
                    </div>
                    {companyResearch.sources.length > 0 && (
                      <div className="pt-4 border-t border-[#f0f0f0]">
                        <p className="text-xs font-medium text-[#999] mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {companyResearch.sources.map((chunk: any, i: number) => (
                            <a 
                              key={i} 
                              href={chunk.web?.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs bg-[#f5f5f5] px-2 py-1 rounded hover:bg-[#eee] transition-colors"
                            >
                              {chunk.web?.title || 'Source'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {tailoredResume && (
                <div className="space-y-8">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 space-y-8">
                      {skillsGap && (
                        <div className="card space-y-4 bg-amber-50/30 border-amber-100">
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-amber-800 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Skills Gap Analysis
                          </h3>
                          <div className="text-sm prose prose-sm prose-amber">
                            <Markdown>{skillsGap}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Ad Placeholder Sidebar */}
                      <div className="card h-64 bg-[#f9f9f9] border border-dashed border-[#e5e5e5] flex items-center justify-center text-[#ccc] text-xs font-mono uppercase tracking-widest text-center px-4">
                        Ad Space<br/>(Responsive)
                      </div>
                    </div>
                    
                    <div className="md:col-span-2 space-y-8">
                      <div className="card space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <h2 className="text-xl font-semibold">Tailored Resume</h2>
                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={onOptimizeATS}
                              disabled={loading.ats}
                              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2 bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                            >
                              {loading.ats ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              ATS Optimize
                            </button>
                            <button onClick={exportPDF} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                              <Download className="w-4 h-4" /> PDF
                            </button>
                          </div>
                        </div>

                        {/* Template Selection */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                          <span className="text-xs font-semibold uppercase text-[#999] whitespace-nowrap">Template:</span>
                          {[
                            { id: 'modern', name: 'Modern' },
                            { id: 'classic', name: 'Classic' },
                            { id: 'creative', name: 'Creative' },
                            { id: 'technical', name: 'Technical' }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTemplate(t.id)}
                              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                                selectedTemplate === t.id 
                                ? 'bg-[#1a1a1a] text-white' 
                                : 'bg-[#f5f5f5] text-[#666] hover:bg-[#eee]'
                              }`}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>

                        <div 
                          ref={resumeRef}
                          className={`p-12 bg-white border border-[#e5e5e5] rounded-lg shadow-sm min-h-[800px] transition-all duration-500 ${
                            selectedTemplate === 'classic' ? 'font-serif' : 
                            selectedTemplate === 'technical' ? 'font-mono text-sm' : 'font-sans'
                          }`}
                        >
                          <div className={`markdown-body ${
                            selectedTemplate === 'creative' ? 'prose-indigo' : 
                            selectedTemplate === 'technical' ? 'prose-slate' : 'prose-neutral'
                          }`}>
                            <Markdown>{tailoredResume}</Markdown>
                          </div>
                        </div>
                      </div>

                      {coverLetter && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="card space-y-6"
                        >
                          <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Cover Letter</h2>
                            <button 
                              onClick={() => {
                                const blob = new Blob([coverLetter], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'cover-letter.md';
                                a.click();
                              }}
                              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" /> Markdown
                            </button>
                          </div>
                          <div className="p-12 bg-white border border-[#e5e5e5] rounded-lg shadow-sm markdown-body">
                            <Markdown>{coverLetter}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Creative Section */}
        <section id="creative" className="space-y-8">
          <div className="card space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Professional Assets</h2>
                <p className="text-[#666]">Generate or edit your professional profile photo.</p>
              </div>
              <Camera className="w-8 h-8 text-[#1a1a1a]/20" />
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#666]">Headshot Style Prompt</label>
                  <button 
                    onClick={() => window.aistudio?.openSelectKey()}
                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Key className="w-3 h-3" /> Change API Key
                  </button>
                </div>
                <textarea 
                  className="input-field h-32 resize-none"
                  placeholder="e.g., A confident software engineer in a modern office setting, soft natural lighting, professional attire..."
                  value={profilePrompt}
                  onChange={(e) => setProfilePrompt(e.target.value)}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-[#999]">Size</label>
                    <select 
                      className="input-field py-2"
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value as any)}
                    >
                      <option value="1K">1K Resolution</option>
                      <option value="2K">2K Resolution</option>
                      <option value="4K">4K Resolution</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-[#999]">Aspect Ratio</label>
                    <select 
                      className="input-field py-2"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option value="1:1">1:1 Square</option>
                      <option value="3:4">3:4 Portrait</option>
                      <option value="4:3">4:3 Classic</option>
                      <option value="9:16">9:16 Tall</option>
                      <option value="16:9">16:9 Wide</option>
                      <option value="21:9">21:9 Ultra-Wide</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={onGenerateImage}
                  disabled={loading.image || !profilePrompt}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading.image ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generate Headshot
                </button>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#e5e5e5] rounded-[24px] p-8 min-h-[400px] bg-[#f9f9f9]">
                {generatedImage ? (
                  <div className="space-y-6 w-full">
                    <div className="relative group">
                      <img 
                        src={generatedImage} 
                        alt="Generated Profile" 
                        className="w-full rounded-xl shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <button className="text-white font-medium flex items-center gap-2">
                          <Download className="w-5 h-5" /> Download
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[#666]" />
                        <span className="text-sm font-medium">Quick Edit</span>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="input-field flex-1 py-2"
                          placeholder="e.g., Add a retro filter, change background to blue..."
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                        />
                        <button 
                          onClick={onEditImage}
                          disabled={loading.edit || !editPrompt}
                          className="btn-secondary py-2 px-4"
                        >
                          {loading.edit ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <ImageIcon className="w-12 h-12 text-[#ccc] mx-auto" />
                    <p className="text-[#999] font-medium">Your generated image will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Search className="w-5 h-5" /> Image Intelligence
              </h2>
              <label className="cursor-pointer btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" /> Analyze Photo
                <input type="file" className="hidden" onChange={onAnalyzeImage} accept="image/*" />
              </label>
            </div>
            
            {loading.imageAnalysis && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-[#1a1a1a]/20" />
              </div>
            )}

            {analysisImage && !loading.imageAnalysis && (
              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                  <img src={analysisImage.data} className="w-full rounded-xl shadow-sm" alt="Analysis" />
                </div>
                <div className="md:col-span-2 prose prose-sm max-w-none">
                  <Markdown>{imageAnalysisResult}</Markdown>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[#e5e5e5] py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1a1a1a] rounded flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold tracking-tight">ResumeCraft AI</span>
          </div>
          <p className="text-sm text-[#999]">© 2026 ResumeCraft AI. Built with Gemini 3.1 Pro.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-[#666] hover:text-[#1a1a1a]">Privacy</a>
            <a href="#" className="text-sm text-[#666] hover:text-[#1a1a1a]">Terms</a>
            <a href="#" className="text-sm text-[#666] hover:text-[#1a1a1a]">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
