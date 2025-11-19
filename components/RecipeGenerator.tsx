import React, { useState, useRef } from 'react';
import { Sparkles, Coffee, ChefHat, Clock, Info, Loader2, Image as ImageIcon, Camera, X, ZoomIn } from 'lucide-react';
import { generateCoffeeRecipe, generateRecipeImage, generateStepImage } from '../services/gemini';
import { Recipe, Language } from '../types';

interface RecipeGeneratorProps {
  language: Language;
}

const PRESETS = [
  { id: 'latte', en: 'Classic Latte', zh: '经典拿铁' },
  { id: 'cappuccino', en: 'Cappuccino', zh: '卡布奇诺' },
  { id: 'americano', en: 'Iced Americano', zh: '冰美式' },
  { id: 'flatwhite', en: 'Flat White', zh: '澳白' },
  { id: 'mocha', en: 'Mocha', zh: '摩卡' },
  { id: 'pour', en: 'Pour Over', zh: '手冲单品' },
  { id: 'espresso', en: 'Espresso', zh: '意式浓缩' },
  { id: 'macchiato', en: 'Caramel Macchiato', zh: '焦糖玛奇朵' },
  { id: 'coldbrew', en: 'Cold Brew', zh: '冷萃咖啡' },
  { id: 'oat', en: 'Oatmeal Latte', zh: '燕麦拿铁' },
  { id: 'coconut', en: 'Coconut Latte', zh: '生椰拿铁' },
  { id: 'dirty', en: 'Dirty Coffee', zh: '脏脏咖啡' },
];

const RecipeGenerator: React.FC<RecipeGeneratorProps> = ({ language }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Store images for each step: key is step index, value is base64 url
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input');
  
  // State for image lightbox
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Ref to track active generation session to allow cancellation and prevent state updates on stale recipes
  const isGeneratingRef = useRef(false);

  const t = {
    title: language === 'en' ? 'Recipe Studio' : '咖啡配方工坊',
    subtitle: language === 'en' 
      ? "Describe your dream coffee, and we'll create the recipe and a visual guide."
      : "描述您梦想中的咖啡，我们将为您生成配方和制作图示。",
    label: language === 'en' ? 'What would you like to drink?' : '您想喝点什么？',
    placeholder: language === 'en' 
      ? 'e.g., A creamy iced latte with caramel and a hint of sea salt...'
      : '例如：一杯加了海盐焦糖的冰拿铁，口感绵密...',
    generateBtn: language === 'en' ? 'Generate Recipe' : '生成配方',
    brewing: language === 'en' ? 'Brewing your custom recipe...' : '正在为您调制专属配方...',
    drawing: language === 'en' ? 'Drawing visual guide...' : '正在绘制制作图示...',
    error: language === 'en' ? 'Failed to brew your recipe. Please try again.' : '配方生成失败，请重试。',
    noImage: language === 'en' ? 'No image generated' : '未生成图片',
    ingredients: language === 'en' ? 'Ingredients' : '所需原料',
    instructions: language === 'en' ? 'Instructions' : '制作步骤',
    tips: language === 'en' ? "Barista's Secret" : '咖啡师秘籍',
    againBtn: language === 'en' ? 'Create Another Recipe' : '再做一个配方',
    quickSelect: language === 'en' ? 'Quick Select:' : '快速选择：',
    loadingStep: language === 'en' ? 'Visualizing...' : '生成图示中...',
  };

  const handleGenerate = async (inputPrompt: string) => {
    if (!inputPrompt.trim()) return;

    // Cancel any ongoing background generation
    isGeneratingRef.current = false;

    setPrompt(inputPrompt);
    setLoading(true);
    setError(null);
    setStep('generating');
    setRecipe(null);
    setImageUrl(null);
    setStepImages({});

    try {
      // 1. Generate Recipe Text
      const generatedRecipe = await generateCoffeeRecipe(inputPrompt, language);
      setRecipe(generatedRecipe);
      
      // Move to result view immediately so user can see text
      setStep('result');
      setLoading(false);

      // 2. Trigger Image Generations Sequentially
      isGeneratingRef.current = true;
      generateImagesSequentially(generatedRecipe);

    } catch (err) {
      console.error(err);
      setError(t.error);
      setStep('input');
      setLoading(false);
    }
  };

  // Function to handle sequential image generation to avoid Rate Limit (429) errors
  const generateImagesSequentially = async (currentRecipe: Recipe) => {
    // 1. Main Image
    try {
      if (!isGeneratingRef.current) return;
      const img = await generateRecipeImage(currentRecipe.title, currentRecipe.description);
      if (isGeneratingRef.current) setImageUrl(img);
    } catch (err) {
      console.error("Main image failed", err);
    }

    // 2. Step Images (Sequential with delay)
    for (let i = 0; i < currentRecipe.steps.length; i++) {
      if (!isGeneratingRef.current) break;

      // Artificial delay to respect API quota/rate limits
      // 4000ms delay ensures we don't hit the "requests per minute" limit too fast
      await new Promise(resolve => setTimeout(resolve, 4000));

      if (!isGeneratingRef.current) break;

      try {
        const stepText = currentRecipe.steps[i];
        const img = await generateStepImage(stepText, currentRecipe.title);
        
        if (isGeneratingRef.current) {
          setStepImages(prev => ({ ...prev, [i]: img }));
        }
      } catch (err) {
        console.error(`Step ${i} image failed`, err);
      }
    }
  };

  const handleReset = () => {
    isGeneratingRef.current = false;
    setStep('input');
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border border-coffee-200 overflow-hidden flex flex-col min-h-[600px]">
        <div className="bg-coffee-800 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <ChefHat className="w-6 h-6 text-coffee-300" />
            <h2 className="font-serif font-bold text-2xl">{t.title}</h2>
          </div>
          <p className="text-coffee-200 text-sm">{t.subtitle}</p>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          {step === 'input' && (
            <div className="flex flex-col h-full justify-center items-center space-y-6 py-4 animate-fadeIn">
              <div className="w-full max-w-md space-y-4">
                <label className="block text-sm font-medium text-coffee-700">
                  {t.label}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t.placeholder}
                  className="w-full px-4 py-3 rounded-xl border border-coffee-200 focus:ring-2 focus:ring-coffee-500 focus:border-transparent h-32 resize-none bg-coffee-50 text-coffee-900 placeholder-coffee-300 transition-all"
                />
                
                {/* Presets Grid */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-coffee-500 uppercase tracking-wider">{t.quickSelect}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setPrompt(language === 'en' ? preset.en : preset.zh)}
                        className="px-2 py-2 text-xs sm:text-sm font-medium text-coffee-700 bg-white border border-coffee-200 rounded-lg hover:bg-coffee-100 hover:border-coffee-300 transition-colors truncate"
                      >
                        {language === 'en' ? preset.en : preset.zh}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleGenerate(prompt)}
                  disabled={!prompt.trim() || loading}
                  className="w-full bg-coffee-600 hover:bg-coffee-700 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] shadow-md mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" />
                  {t.generateBtn}
                </button>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center h-full py-12 space-y-4 animate-fadeIn">
              <div className="relative">
                <div className="absolute inset-0 bg-coffee-400 rounded-full opacity-20 animate-ping"></div>
                <Loader2 className="w-12 h-12 text-coffee-600 animate-spin relative z-10" />
              </div>
              <p className="text-coffee-700 font-medium animate-pulse">
                  {t.brewing}
              </p>
            </div>
          )}

          {step === 'result' && recipe && (
            <div className="space-y-8 animate-fadeIn">
              {/* Image Section */}
              <div 
                className="relative w-full h-64 rounded-xl overflow-hidden bg-coffee-100 shadow-inner group border border-coffee-100 cursor-pointer"
                onClick={() => imageUrl && setSelectedImage(imageUrl)}
              >
                {imageUrl ? (
                  <>
                    <img 
                      src={imageUrl} 
                      alt={recipe.title} 
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                    {/* Overlay Icon */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="text-white w-10 h-10 drop-shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-coffee-400 flex-col gap-2 animate-pulse">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-sm">{t.drawing}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 pointer-events-none">
                  <h3 className="text-white font-serif font-bold text-2xl leading-tight">{recipe.title}</h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-coffee-700 italic border-l-4 border-coffee-400 pl-4 py-1 bg-coffee-50/50 rounded-r-lg">
                {recipe.description}
              </p>

              {/* Ingredients */}
              <div className="bg-coffee-50 p-6 rounded-xl border border-coffee-100">
                 <h4 className="font-bold text-coffee-800 mb-4 flex items-center gap-2 pb-2 border-b border-coffee-200">
                    <Coffee className="w-5 h-5 text-coffee-600" /> {t.ingredients}
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="text-sm text-coffee-700 flex items-center gap-2 bg-white p-2 rounded-lg border border-coffee-100/50 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-coffee-400 shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
              </div>

              {/* Instructions with Step Images */}
              <div className="space-y-4">
                 <h4 className="font-bold text-coffee-800 mb-4 flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-coffee-600" /> {t.instructions}
                  </h4>
                  <div className="space-y-6">
                    {recipe.steps.map((step, i) => (
                      <div key={i} className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-coffee-100 shadow-sm transition-colors hover:border-coffee-300">
                         {/* Step Image Container */}
                         <div 
                           className="w-full md:w-32 h-32 rounded-lg bg-coffee-50 shrink-0 overflow-hidden border border-coffee-100 relative cursor-pointer group"
                           onClick={() => stepImages[i] && setSelectedImage(stepImages[i])}
                         >
                            {stepImages[i] ? (
                               <>
                                 <img src={stepImages[i]} alt={`Step ${i+1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                   <ZoomIn className="text-white w-6 h-6 drop-shadow-lg" />
                                 </div>
                               </>
                            ) : (
                               <div className="flex flex-col items-center justify-center h-full text-coffee-300 gap-1 animate-pulse">
                                  <Camera size={20} />
                                  <span className="text-[10px] uppercase tracking-wide text-center px-2">{t.loadingStep}</span>
                               </div>
                            )}
                            <div className="absolute top-0 left-0 bg-coffee-600 text-white text-xs font-bold px-2 py-1 rounded-br-lg shadow-md pointer-events-none">
                               {i + 1}
                            </div>
                         </div>
                         
                         {/* Step Text */}
                         <div className="flex-1 py-1">
                            <p className="text-coffee-800 leading-relaxed">{step}</p>
                         </div>
                      </div>
                    ))}
                  </div>
              </div>

              {/* Pro Tip */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex gap-3">
                <Info className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-yellow-800 text-sm block mb-1">{t.tips}</span>
                  <p className="text-sm text-yellow-700">{recipe.tips}</p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full border border-coffee-300 text-coffee-700 hover:bg-coffee-50 font-medium py-3 px-6 rounded-xl transition-colors"
              >
                {t.againBtn}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
          >
            <X size={32} />
          </button>
          <img 
            src={selectedImage} 
            alt="Enlarged view" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default RecipeGenerator;