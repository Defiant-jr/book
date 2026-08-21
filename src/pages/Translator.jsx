import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Copy,
  FolderOpen,
  Languages,
  LayoutDashboard,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const TRANSLATOR_REF = 52000;
const MAX_CHARACTERS = 5000;

const languages = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
  { code: 'fr', label: 'Francês' },
  { code: 'de', label: 'Alemão' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: 'Japonês' },
  { code: 'ko', label: 'Coreano' },
  { code: 'zh-CN', label: 'Chinês (simplificado)' },
  { code: 'ar', label: 'Árabe' },
  { code: 'ru', label: 'Russo' },
];

const navButtons = [
  { label: 'DASHBOARD', path: '/crm', icon: LayoutDashboard },
  { label: 'Drive Jrnotes', path: '/crm/drive', icon: FolderOpen },
  { label: 'Tradutor', path: '/crm/tradutor', icon: Languages },
];

const decodeHtmlEntities = (value) => {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
};

const Translator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('pt');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsTranslating(true);
    setCopied(false);

    try {
      const response = await fetch('/api/google-translate/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, sourceLanguage, targetLanguage }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('O servidor ainda não carregou o serviço de tradução. Reinicie o servidor do sistema.');
      }
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível traduzir o texto.');
      }

      setTranslatedText(decodeHtmlEntities(payload.translatedText));
      setDetectedLanguage(payload.detectedSourceLanguage || '');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na tradução',
        description: error.message || 'Não foi possível traduzir o texto.',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSwap = () => {
    const nextSource = sourceLanguage === 'auto' ? targetLanguage : targetLanguage;
    const nextTarget = sourceLanguage === 'auto' ? (detectedLanguage || 'pt') : sourceLanguage;
    setSourceLanguage(nextSource);
    setTargetLanguage(nextTarget);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
    setDetectedLanguage('');
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const speak = (text, language) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'auto' ? (detectedLanguage || 'pt') : language;
    window.speechSynthesis.speak(utterance);
  };

  const detectedLabel = languages.find((language) => language.code === detectedLanguage)?.label;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <Helmet>
        <title>Tradutor - BooK+</title>
        <meta name="description" content="Tradução de textos integrada ao CRM." />
      </Helmet>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/crm')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Tradutor</h1>
            <p className="text-sm text-gray-400">Traduza textos de forma rápida e segura.</p>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">{TRANSLATOR_REF}</div>
      </div>

      <Card className="glass-card p-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {navButtons.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.path}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex-grow text-gray-300 hover:bg-white/10 hover:text-white sm:flex-grow-0 ${
                  item.path === '/crm/tradutor' ? 'bg-white/10 text-white' : ''
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </Card>

      <Card className="glass-card overflow-hidden">
        <div className="grid grid-cols-1 border-b border-white/10 lg:grid-cols-[1fr_auto_1fr]">
          <div className="p-4">
            <label htmlFor="source-language" className="sr-only">Idioma de origem</label>
            <select
              id="source-language"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value)}
              className="w-full rounded-md border border-white/15 bg-[#142961] px-3 py-2 font-medium text-white outline-none focus:border-blue-400"
            >
              <option value="auto">Detectar idioma</option>
              {languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-center px-2 pb-2 lg:pb-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSwap}
              disabled={!translatedText}
              aria-label="Inverter idiomas"
              className="rounded-full text-blue-200 hover:bg-white/10 hover:text-white"
            >
              <ArrowRightLeft className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4">
            <label htmlFor="target-language" className="sr-only">Idioma de destino</label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              className="w-full rounded-md border border-white/15 bg-[#142961] px-3 py-2 font-medium text-white outline-none focus:border-blue-400"
            >
              {languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid min-h-[360px] grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-[300px] flex-col border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="relative flex-1">
              <textarea
                value={sourceText}
                onChange={(event) => {
                  setSourceText(event.target.value.slice(0, MAX_CHARACTERS));
                  setTranslatedText('');
                  setDetectedLanguage('');
                }}
                placeholder="Digite ou cole o texto"
                className="h-full min-h-[230px] w-full resize-none bg-transparent pr-10 text-xl leading-relaxed text-white outline-none placeholder:text-gray-500"
                autoFocus
              />
              {sourceText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 text-gray-400 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setSourceText('');
                    setTranslatedText('');
                    setDetectedLanguage('');
                  }}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Limpar texto</span>
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-4">
              <Button type="button" variant="ghost" size="icon" onClick={() => speak(sourceText, sourceLanguage)} disabled={!sourceText}>
                <Volume2 className="h-5 w-5" />
                <span className="sr-only">Ouvir texto original</span>
              </Button>
              <span className="text-xs text-gray-500">{sourceText.length} / {MAX_CHARACTERS}</span>
            </div>
          </div>

          <div className="flex min-h-[300px] flex-col bg-white/[0.035] p-5">
            <div className="flex-1">
              {isTranslating ? (
                <div className="flex h-full min-h-[230px] items-center justify-center text-blue-200">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Traduzindo...
                </div>
              ) : (
                <div className={`min-h-[230px] whitespace-pre-wrap text-xl leading-relaxed ${translatedText ? 'text-white' : 'text-gray-500'}`}>
                  {translatedText || 'Tradução'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-4">
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => speak(translatedText, targetLanguage)} disabled={!translatedText}>
                  <Volume2 className="h-5 w-5" />
                  <span className="sr-only">Ouvir tradução</span>
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={handleCopy} disabled={!translatedText}>
                  {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  <span className="sr-only">Copiar tradução</span>
                </Button>
              </div>
              {sourceLanguage === 'auto' && detectedLabel && (
                <span className="text-xs text-gray-400">Detectado: {detectedLabel}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center border-t border-white/10 p-4">
          <Button
            type="button"
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            className="min-w-40 bg-blue-600 text-white hover:bg-blue-500"
          >
            {isTranslating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
            Traduzir
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

export default Translator;
