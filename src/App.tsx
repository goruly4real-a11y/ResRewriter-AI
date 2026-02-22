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
  Key,
  Settings,
  X,
  Layout,
  Briefcase,
  User,
  Globe
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
  generateCoverLetter,
  generateProfileAssets,
  generateVisualResume
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
  const [profileAssets, setProfileAssets] = useState('');
  const [visualResume, setVisualResume] = useState('');
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tailor' | 'research' | 'creative'>('tailor');

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all resume data and results?')) {
      setResumeText('');
      setJobDescription('');
      setResumeFile(null);
      setAnalysis('');
      setTailoredResume('');
      setCompanyResearch(null);
      setQuickFeedback('');
      setSkillsGap('');
      setCoverLetter('');
      setProfileAssets('');
      setGeneratedImage('');
      setError(null);
    }
  };

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
    coverLetter: false,
    profileAssets: false,
    visualResume: false,
    exporting: false
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
      setError(err.message || "Failed to tailor resume. The AI might be busy, please try again.");
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
      setError(err.message || "Failed to generate cover letter. Please try again.");
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, coverLetter: false }));
    }
  };

  const onGenerateProfileAssets = async () => {
    if (!resumeText && !resumeFile) return;
    setLoading(prev => ({ ...prev, profileAssets: true }));
    setError(null);
    try {
      const result = await generateProfileAssets(resumeText || "See uploaded file", jobDescription);
      setProfileAssets(result || '');
    } catch (err: any) {
      setError(err.message || "Failed to generate profile assets. Please try again.");
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, profileAssets: false }));
    }
  };

  const onResearch = async () => {
    // Try to extract company name from JD
    const companyMatch = jobDescription.match(/at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const companyName = companyMatch ? companyMatch[1] : prompt("Enter company name to research:");
    if (!companyName) return;
    onResearchManual(companyName);
  };

  const onResearchManual = async (name?: string) => {
    const companyName = name || companyNameInput;
    if (!companyName) return;

    setLoading(prev => ({ ...prev, research: true }));
    setError(null);
    try {
      const result = await researchCompany(companyName);
      setCompanyResearch(result);
    } catch (err: any) {
      setError(err.message || "Failed to research company. Please try again.");
      console.error(err);
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
        setError(err.message || "Failed to generate headshot. Please try again.");
      }
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, image: false }));
    }
  };

  const onGenerateVisualResume = async () => {
    if (!resumeText) {
      setError("Please provide your resume text first in the Tailoring tab.");
      return;
    }
    setLoading(prev => ({ ...prev, visualResume: true }));
    try {
      const result = await generateVisualResume(resumeText);
      setVisualResume(result);
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Failed to generate visual resume.");
    } finally {
      setLoading(prev => ({ ...prev, visualResume: false }));
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
        const result = await analyzeImage(base64, file.type, undefined);
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
    setLoading(prev => ({ ...prev, exporting: true }));
    try {
      const element = resumeRef.current;
      const canvas = await html2canvas(element, {
        scale: 3, // Higher scale for better readability
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save('tailored-resume.pdf');
    } catch (err) {
      console.error('PDF Export Error:', err);
      setError('Failed to export PDF. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, exporting: false }));
    }
  };

  const exportImage = async () => {
    if (!resumeRef.current) return;
    setLoading(prev => ({ ...prev, exporting: true }));
    try {
      const canvas = await html2canvas(resumeRef.current, {
        scale: 3, // Higher scale for better readability
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = 'tailored-resume.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Image Export Error:', err);
      setError('Failed to export image. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, exporting: false }));
    }
  };

  const exportText = () => {
    if (!tailoredResume) return;
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#111827] rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">ResumeCraft</span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-1 bg-[#F3F4F6] p-1 rounded-full">
            {[
              { id: 'tailor', icon: Briefcase, label: 'Tailoring' },
              { id: 'research', icon: Globe, label: 'Research' },
              { id: 'creative', icon: User, label: 'Creative' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white text-[#111827] shadow-sm' 
                  : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button className="btn-primary hidden sm:flex">Get Started</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-2xl mx-auto p-4 rounded-2xl flex items-start gap-3 shadow-lg ${
                error.includes('Rate limit') 
                ? 'bg-amber-50 border border-amber-200 text-amber-900' 
                : 'bg-red-50 border border-red-200 text-red-900'
              }`}
            >
              <div className={`p-2 rounded-full ${error.includes('Rate limit') ? 'bg-amber-100' : 'bg-red-100'}`}>
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-bold uppercase tracking-wider mb-1">
                  {error.includes('Rate limit') ? 'API Limit Reached' : 'Error Occurred'}
                </p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Hero */}
        <section className="text-center space-y-6 max-w-3xl mx-auto py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI-Powered Career Suite
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#111827] leading-[1.1]">
            Land your <span className="text-indigo-600">dream job</span> with AI precision.
          </h1>
          <p className="text-[#6B7280] text-xl max-w-2xl mx-auto leading-relaxed">
            Tailor your resume, research companies, and generate professional assets in seconds. Built for modern job seekers.
          </p>
        </section>

        {/* Main Content Tabs */}
        <AnimatePresence mode="wait">
          {activeTab === 'tailor' && (
            <motion.div
              key="tailor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Input Section */}
              <section id="tailor" className="grid lg:grid-cols-2 gap-8">
                <div className="card space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" /> Your Resume
                      </h2>
                      <p className="text-xs text-[#6B7280]">Paste your text or upload a document</p>
                    </div>
                    <label className="cursor-pointer btn-secondary !py-2 !px-4 text-xs flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Upload
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg,.txt" />
                    </label>
                  </div>
                  <textarea 
                    className="input-field h-80 resize-none font-mono text-xs leading-relaxed"
                    placeholder="Paste your current resume here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={onAnalyze}
                      disabled={loading.analysis || (!resumeText && !resumeFile)}
                      className="btn-secondary flex-1"
                    >
                      {loading.analysis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Analyze
                    </button>
                    <button 
                      onClick={() => onGetFeedback(resumeText)}
                      disabled={loading.feedback || !resumeText}
                      className="btn-secondary flex-1"
                    >
                      {loading.feedback ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Feedback
                    </button>
                  </div>
                  {quickFeedback && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-900 text-sm leading-relaxed"
                    >
                      <div className="flex items-center gap-2 mb-2 font-bold text-[10px] uppercase tracking-wider text-indigo-600">
                        <Sparkles className="w-3 h-3" /> AI Suggestion
                      </div>
                      "{quickFeedback}"
                    </motion.div>
                  )}
                </div>

                <div className="card space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-indigo-600" /> Target Job
                    </h2>
                    <p className="text-xs text-[#6B7280]">Describe the role you're applying for</p>
                  </div>
                  <textarea 
                    className="input-field h-80 resize-none font-mono text-xs leading-relaxed"
                    placeholder="Paste the job description here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                  
                  <div className="space-y-4">
                    <button 
                      onClick={onTailor}
                      disabled={loading.tailor || (!resumeText && !resumeFile) || !jobDescription}
                      className="btn-primary w-full py-4 text-base shadow-lg shadow-black/10"
                    >
                      {loading.tailor ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Tailor My Resume
                    </button>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={onGenerateCoverLetter}
                        disabled={loading.coverLetter || (!resumeText && !resumeFile) || !jobDescription}
                        className="btn-secondary !bg-emerald-50 !border-emerald-100 !text-emerald-700 hover:!bg-emerald-100"
                      >
                        {loading.coverLetter ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Cover Letter
                      </button>
                      <button 
                        onClick={onGenerateProfileAssets}
                        disabled={loading.profileAssets || (!resumeText && !resumeFile) || !jobDescription}
                        className="btn-secondary !bg-blue-50 !border-blue-100 !text-blue-700 hover:!bg-blue-100"
                      >
                        {loading.profileAssets ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        LinkedIn
                      </button>
                    </div>
                  </div>
                </div>
              </section>

        {/* Results Section */}
        <AnimatePresence>
          {(analysis || companyResearch || tailoredResume) && (
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12 pb-24"
            >
              <div className="grid lg:grid-cols-3 gap-8">
                {analysis && (
                  <div className="card lg:col-span-3 space-y-6 !bg-[#111827] !text-white !border-none shadow-2xl">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-[0.2em]">
                      <Search className="w-4 h-4" /> Resume Intelligence
                    </div>
                    <div className="prose prose-invert max-w-none">
                      <Markdown>{analysis}</Markdown>
                    </div>
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
                            <div className="flex items-center bg-[#f5f5f5] rounded-full p-1 border border-[#e5e5e5]">
                              <div className="px-3 py-1.5 text-[#999]">
                                <Download className="w-3.5 h-3.5" />
                              </div>
                              <button 
                                onClick={exportPDF} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Download PDF"
                              >
                                <FileText className="w-3.5 h-3.5" /> PDF
                              </button>
                              <button 
                                onClick={exportImage} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Download Image"
                              >
                                <ImageIcon className="w-3.5 h-3.5" /> PNG
                              </button>
                              <button 
                                onClick={exportText} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Download Text"
                              >
                                <Layout className="w-3.5 h-3.5" /> TXT
                              </button>
                              <button 
                                onClick={handlePrint} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Print Resume"
                              >
                                <Briefcase className="w-3.5 h-3.5" /> Print
                              </button>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(tailoredResume);
                                  alert('Resume copied to clipboard!');
                                }} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Copy to Clipboard"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Copy
                              </button>
                            </div>
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
                          className={`resume-container p-12 bg-white border border-[#e5e5e5] rounded-lg shadow-sm min-h-[800px] transition-all duration-500 ${
                            selectedTemplate === 'classic' ? 'font-serif' : 
                            selectedTemplate === 'technical' ? 'font-mono text-sm' : 
                            selectedTemplate === 'creative' ? 'font-creative' : 'font-sans'
                          }`}
                        >
                          <Markdown>{tailoredResume}</Markdown>
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
                            <div className="flex items-center bg-[#f5f5f5] rounded-full p-1 border border-[#e5e5e5]">
                              <div className="px-3 py-1.5 text-[#999]">
                                <Download className="w-3.5 h-3.5" />
                              </div>
                              <button 
                                onClick={() => {
                                  const blob = new Blob([coverLetter], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'cover-letter.txt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Download Text"
                              >
                                TXT
                              </button>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(coverLetter);
                                  alert('Cover letter copied to clipboard!');
                                }} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Copy to Clipboard"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Copy
                              </button>
                            </div>
                          </div>
                          <div className="p-12 bg-white border border-[#e5e5e5] rounded-lg shadow-sm markdown-body">
                            <Markdown>{coverLetter}</Markdown>
                          </div>
                        </motion.div>
                      )}

                      {profileAssets && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="card space-y-6"
                        >
                          <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">LinkedIn & Profile Assets</h2>
                            <div className="flex items-center bg-[#f5f5f5] rounded-full p-1 border border-[#e5e5e5]">
                              <div className="px-3 py-1.5 text-[#999]">
                                <Download className="w-3.5 h-3.5" />
                              </div>
                              <button 
                                onClick={() => {
                                  const blob = new Blob([profileAssets], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'profile-assets.txt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Download Text"
                              >
                                TXT
                              </button>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(profileAssets);
                                  alert('Profile assets copied to clipboard!');
                                }} 
                                className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-full transition-all flex items-center gap-1.5"
                                title="Copy to Clipboard"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Copy
                              </button>
                            </div>
                          </div>
                          <div className="p-12 bg-white border border-[#e5e5e5] rounded-lg shadow-sm markdown-body">
                            <Markdown>{profileAssets}</Markdown>
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
      </motion.div>
    )}

          {activeTab === 'research' && (
            <motion.div
              key="research"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="card space-y-8 max-w-4xl mx-auto shadow-2xl">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Globe className="w-6 h-6 text-indigo-600" /> Company Intelligence
                  </h2>
                  <p className="text-sm text-[#6B7280]">Get deep insights into any company's culture, recent news, and interview patterns.</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input 
                      type="text"
                      placeholder="Enter company name (e.g. Google, Stripe, Tesla)..."
                      className="input-field pl-11 py-4"
                      value={companyNameInput}
                      onChange={(e) => setCompanyNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onResearchManual()}
                    />
                  </div>
                  <button 
                    onClick={() => onResearchManual()}
                    disabled={loading.research || !companyNameInput}
                    className="btn-primary px-8"
                  >
                    {loading.research ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Research'}
                  </button>
                </div>

                {companyResearch && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6 pt-8 border-t border-[#E5E7EB]"
                  >
                    <div className="prose max-w-none">
                      <Markdown>{companyResearch.text}</Markdown>
                    </div>
                    {companyResearch.sources.length > 0 && (
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">Verified Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {companyResearch.sources.map((chunk: any, i: number) => (
                            <a 
                              key={i} 
                              href={chunk.web?.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs bg-[#F3F4F6] px-3 py-1.5 rounded-full hover:bg-[#E5E7EB] transition-all text-[#4B5563] font-medium"
                            >
                              <Globe className="w-3 h-3" />
                              {chunk.web?.title || 'Source'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'creative' && (
            <motion.div
              key="creative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Creative Section */}
              <section id="creative" className="grid lg:grid-cols-2 gap-8">
                <div className="card space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Layout className="w-6 h-6 text-indigo-600" /> Visual Resume
                    </h2>
                    <p className="text-sm text-[#6B7280]">Generate a stylized, visual representation of your resume using Nano Banana.</p>
                  </div>

                  <div className="space-y-6">
                    <p className="text-sm text-[#666]">
                      This feature uses the Gemini 2.5 Flash Image model to create a creative visual layout of your professional profile.
                    </p>
                    
                    <button 
                      onClick={onGenerateVisualResume}
                      disabled={loading.visualResume || !resumeText}
                      className="btn-secondary w-full py-4 flex items-center justify-center gap-2"
                    >
                      {loading.visualResume ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Generate Visual Resume
                    </button>

                    {visualResume && (
                      <div className="space-y-4 pt-6 border-t border-[#E5E7EB]">
                        <div className="relative group">
                          <img 
                            src={visualResume} 
                            alt="Visual Resume" 
                            className="w-full rounded-2xl shadow-xl"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-4">
                            <button 
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = visualResume;
                                a.download = 'visual-resume.png';
                                a.click();
                              }}
                              className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                              title="Download PNG"
                            >
                              <ImageIcon className="w-5 h-5 text-[#111827]" />
                            </button>
                            <button 
                              onClick={() => {
                                const pdf = new jsPDF();
                                const img = new Image();
                                img.src = visualResume;
                                img.onload = () => {
                                  const pdfWidth = pdf.internal.pageSize.getWidth();
                                  const pdfHeight = (img.height * pdfWidth) / img.width;
                                  pdf.addImage(visualResume, 'PNG', 0, 0, pdfWidth, pdfHeight);
                                  pdf.save('visual-resume.pdf');
                                };
                              }}
                              className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                              title="Download PDF"
                            >
                              <FileText className="w-5 h-5 text-[#111827]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <ImageIcon className="w-6 h-6 text-indigo-600" /> Profile Visuals
                    </h2>
                    <p className="text-sm text-[#6B7280]">Generate a professional headshot or background image using AI.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="label-caps">Visual Prompt</label>
                      <textarea 
                        className="input-field h-32 resize-none"
                        placeholder="Describe the professional image you want (e.g. 'A professional headshot of a software engineer in a modern office setting, soft lighting')..."
                        value={profilePrompt}
                        onChange={(e) => setProfilePrompt(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="label-caps">Aspect Ratio</label>
                        <select 
                          className="input-field"
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                        >
                          <option value="1:1">Square (1:1)</option>
                          <option value="16:9">Landscape (16:9)</option>
                          <option value="9:16">Portrait (9:16)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="label-caps">Quality</label>
                        <select 
                          className="input-field"
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value as any)}
                        >
                          <option value="1K">Standard (1K)</option>
                          <option value="2K">High (2K)</option>
                          <option value="4K">Ultra (4K)</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={onGenerateImage}
                      disabled={loading.image || !profilePrompt}
                      className="btn-primary w-full py-4 shadow-lg shadow-black/10"
                    >
                      {loading.image ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                      Generate Visual
                    </button>
                  </div>
                </div>

                <div className="card space-y-8 flex flex-col">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Search className="w-6 h-6 text-indigo-600" /> Image Intelligence
                    </h2>
                    <p className="text-sm text-[#6B7280]">Analyze your professional photos for feedback on lighting, pose, and background.</p>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center items-center border-2 border-dashed border-[#E5E7EB] rounded-[32px] p-12 text-center group hover:border-indigo-300 transition-all bg-[#F9FAFB]">
                    <label className="cursor-pointer space-y-4">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-indigo-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-[#111827]">Click to upload photo</p>
                        <p className="text-xs text-[#6B7280]">PNG, JPG up to 10MB</p>
                      </div>
                      <input type="file" className="hidden" onChange={onAnalyzeImage} accept="image/*" />
                    </label>
                  </div>

                  {loading.imageAnalysis && (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                  )}

                  {analysisImage && !loading.imageAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid md:grid-cols-3 gap-8 pt-8 border-t border-[#E5E7EB]"
                    >
                      <div className="md:col-span-1">
                        <img src={analysisImage.data} className="w-full rounded-2xl shadow-lg" alt="Analysis" />
                      </div>
                      <div className="md:col-span-2 prose prose-sm max-w-none">
                        <Markdown>{imageAnalysisResult}</Markdown>
                      </div>
                    </motion.div>
                  )}

                  {generatedImage && (
                    <div className="space-y-6 pt-6 border-t border-[#E5E7EB]">
                      <div className="relative group">
                        <img 
                          src={generatedImage} 
                          alt="Generated Profile" 
                          className="w-full rounded-2xl shadow-xl"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-4">
                          <button 
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = generatedImage;
                              a.download = 'profile-image.png';
                              a.click();
                            }}
                            className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                            title="Download PNG"
                          >
                            <ImageIcon className="w-5 h-5 text-[#111827]" />
                          </button>
                          <button 
                            onClick={() => {
                              const pdf = new jsPDF();
                              const img = new Image();
                              img.src = generatedImage;
                              img.onload = () => {
                                const pdfWidth = pdf.internal.pageSize.getWidth();
                                const pdfHeight = (img.height * pdfWidth) / img.width;
                                pdf.addImage(generatedImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
                                pdf.save('profile-image.pdf');
                              };
                            }}
                            className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                            title="Download PDF"
                          >
                            <FileText className="w-5 h-5 text-[#111827]" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="label-caps">Refine Visual</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="input-field flex-1 py-2"
                            placeholder="e.g. 'Make the background darker', 'Add glasses'..."
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
                  )}
                </div>
              </section>
      </motion.div>
    )}
  </AnimatePresence>
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
          <p className="text-sm text-[#9CA3AF]">© 2026 ResumeCraft AI. All rights reserved.</p>
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
