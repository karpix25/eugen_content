
import React, { useState, useEffect } from 'react';
import { Layout, ImageIcon, Sparkles, Loader2, Trash2, Plus, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from './lib/utils';

interface CarouselStyle {
  id: string;
  name: string;
  image_url: string;
  analysis: any;
  user_id: string | null;
}

interface StyleManagerProps {
  authToken: string;
  isAdmin: boolean;
}

export default function StyleManager({ authToken, isAdmin }: StyleManagerProps) {
  const [styles, setStyles] = useState<CarouselStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isGlobal, setIsGlobal] = useState(true);

  useEffect(() => {
    fetchStyles();
  }, []);

  const fetchStyles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/carousel/styles', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setStyles(data);
    } catch (err) {
      console.error("Failed to fetch styles", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImage(reader.result as string);
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!referenceImage) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/carousel/styles/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ image: referenceImage })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult(data);
    } catch (err: any) {
      alert("Analysis failed: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!newStyleName || !analysisResult || !referenceImage) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/carousel/styles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: newStyleName,
          image_url: referenceImage,
          analysis: analysisResult,
          is_global: isGlobal
        })
      });
      
      if (res.ok) {
        setNewStyleName('');
        setReferenceImage(null);
        setAnalysisResult(null);
        fetchStyles();
      }
    } catch (err) {
      console.error("Failed to save style", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this style?")) return;
    try {
      const res = await fetch(`/api/carousel/styles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) fetchStyles();
    } catch (err) {
      console.error("Failed to delete style", err);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">Style Manager</h2>
          <p className="text-white/40">Manage global and personal carousel design styles.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Analysis Section */}
          <div className="bg-[#111] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-xl font-bold">Analyze Reference</h3>
            </div>

            <div className="space-y-4">
              <label className="block w-full aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-3xl hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden group">
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                {referenceImage ? (
                  <img src={referenceImage} className="w-full h-full object-cover" alt="Reference" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <ImageIcon className="w-10 h-10 text-white/20 group-hover:text-emerald-500 transition-colors" />
                    <p className="text-sm font-bold text-white/20 uppercase tracking-widest">Upload Reference Image</p>
                  </div>
                )}
              </label>

              {referenceImage && !analysisResult && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full h-14 bg-emerald-500 text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <RefreshCw className="w-6 h-6" />}
                  {analyzing ? 'Analyzing Design...' : 'Analyze Design with Gemini'}
                </button>
              )}
            </div>
          </div>

          {/* Result Section */}
          <div className="bg-[#111] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            {analysisResult ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold">Analysis Result</h3>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="p-4 bg-white/5 rounded-2xl space-y-4">
                    <div>
                      <h4 className="text-xs font-black uppercase text-emerald-500 mb-2">Typography</h4>
                      <p className="text-sm text-white/80">Primary: {analysisResult.fonts?.primary}</p>
                      <p className="text-xs text-white/40 mt-1">{analysisResult.fonts?.typographyRules}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-emerald-500 mb-2">Palette</h4>
                      <div className="flex gap-2">
                        {analysisResult.colors?.primary?.map((c: string) => (
                          <div key={c} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <input
                    type="text"
                    placeholder="Style Name (e.g. Neo-Brutalist White)"
                    value={newStyleName}
                    onChange={(e) => setNewStyleName(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 focus:border-emerald-500/50 outline-none transition-all"
                  />
                  <div className="flex items-center gap-3 px-2">
                    <button
                      onClick={() => setIsGlobal(!isGlobal)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        isGlobal ? "bg-emerald-500" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        isGlobal ? "left-7" : "left-1"
                      )} />
                    </button>
                    <span className="text-sm font-bold uppercase tracking-widest text-white/40">Make Global Template</span>
                  </div>
                  <button
                    onClick={handleSave}
                    className="w-full h-14 bg-white text-black rounded-2xl font-bold hover:bg-emerald-500 transition-all"
                  >
                    Save Style
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                <Layout className="w-16 h-16 text-white/10" />
                <p className="text-white/20 font-bold uppercase tracking-widest">Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Styles Grid */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <Layout className="w-6 h-6 text-emerald-500" />
          Existing Styles
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {styles.map(style => (
            <div key={style.id} className="group relative aspect-[4/5] bg-[#111] rounded-[2rem] overflow-hidden border border-white/5 hover:border-emerald-500/30 transition-all">
              <img src={style.image_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" alt={style.name} />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black to-transparent">
                <p className="font-bold text-sm truncate">{style.name}</p>
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1">
                  {style.user_id ? 'Personal' : 'Global Template'}
                </p>
              </div>
              
              <div className="absolute top-4 right-4 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => handleDelete(style.id)}
                  className="p-3 bg-red-500 text-white rounded-2xl shadow-xl hover:bg-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
