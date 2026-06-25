// src/components/Minerva.jsx
// Minerva — the manager bot. Chat + voice interface over the whole command
// center. Uses the browser's built-in SpeechRecognition (speech-to-text) and
// SpeechSynthesis (text-to-speech) — no external service needed.

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';

const SUGGESTIONS = [
  "What's worth looking at this week?",
  "Show me the cheapest land right now",
  "Any county tax-sale alerts?",
  "What cheap businesses came in?",
  "Which tech stocks should I watch?",
];

export default function Minerva() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I'm Minerva. I keep an eye on your land, tech, and business modules. Ask me what's worth your attention, or tap the mic and just talk to me." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');

  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  // Load available TTS voices and auto-pick the most natural-sounding one.
  // Browsers load voices asynchronously, so we listen for the change event.
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const pickBest = (list) => {
      const prefer = [
        /Google US English/i,
        /Microsoft.*(Natural|Aria|Jenny|Guy|Ava|Emma)/i,
        /Samantha/i,
        /Google.*English/i,
        /Microsoft.*English/i,
      ];
      for (const pat of prefer) {
        const hit = list.find(v => pat.test(v.name) && /en/i.test(v.lang));
        if (hit) return hit.name;
      }
      const anyEn = list.find(v => /en/i.test(v.lang));
      return anyEn ? anyEn.name : (list[0] && list[0].name) || '';
    };
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length === 0) return;
      setVoices(list);
      setSelectedVoice(prev => prev || pickBest(list));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Set up speech recognition once
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput('');
      send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const speak = useCallback((text) => {
    if (!voiceOn) return;
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    if (selectedVoice) {
      const v = window.speechSynthesis.getVoices().find(x => x.name === selectedVoice);
      if (v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  }, [voiceOn, selectedVoice]);

  const send = useCallback(async (text) => {
    const question = (text || '').trim();
    if (!question || loading) return;

    const history = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const { answer } = await api.askMinerva(question, history);
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      speak(answer);
    } catch (err) {
      const msg = "I hit a snag reaching the command center. Give it another try in a moment.";
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, speak]);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      window.speechSynthesis && window.speechSynthesis.cancel();
      try { rec.start(); setListening(true); } catch { /* already started */ }
    }
  };

  const stopSpeaking = () => window.speechSynthesis && window.speechSynthesis.cancel();

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 20, maxWidth: 620 }}>
        Your command-center analyst. Minerva reads across land, tech stocks, and businesses to tell you what's been found and what's worth a look.
      </p>

      {/* Chat window */}
      <div
        ref={scrollRef}
        style={{
          border: '1px solid var(--brass)', background: 'var(--ink-raised)',
          borderRadius: 16, boxShadow: '0 0 24px rgba(255,159,85,0.15), inset 0 0 40px rgba(0,0,0,0.5)',
          height: 440, overflowY: 'auto', padding: 20, marginBottom: 14,
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              background: m.role === 'user' ? 'var(--brass-dim)' : 'var(--ink)',
              color: m.role === 'user' ? 'var(--ink)' : 'var(--parchment)',
              border: m.role === 'user' ? 'none' : '1px solid var(--ink-line)',
              borderRadius: 4, padding: '10px 14px',
              fontFamily: m.role === 'user' ? 'var(--font-ui)' : 'var(--font-serif)',
              fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {m.role === 'assistant' && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 4 }}>
                  Minerva
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--parchment-dim)', fontSize: 14 }}>
            Minerva is reviewing the ledger...
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={loading}
            style={{
              background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--parchment-dim)',
              fontFamily: 'var(--font-ui)', fontSize: 12, padding: '5px 10px', borderRadius: 2,
              cursor: loading ? 'default' : 'pointer',
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={toggleMic}
          disabled={!voiceSupported}
          title={voiceSupported ? 'Tap to speak' : 'Voice input not supported in this browser'}
          style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: '50%', cursor: voiceSupported ? 'pointer' : 'default',
            border: '1px solid ' + (listening ? 'var(--rust-bright)' : 'var(--brass)'),
            background: listening ? 'var(--rust-bright)' : 'transparent',
            color: listening ? 'var(--ink)' : 'var(--brass)', fontSize: 18,
          }}
        >
          {listening ? '...' : 'mic'}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask Minerva anything about your modules..."
          style={{
            flex: 1, background: 'var(--ink-raised)', border: '1px solid var(--ink-line)',
            color: 'var(--parchment)', fontFamily: 'var(--font-ui)', fontSize: 14,
            padding: '12px 14px', borderRadius: 2,
          }}
        />

        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{
            background: 'var(--brass)', border: 'none', color: 'var(--ink)',
            fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600,
            padding: '12px 18px', borderRadius: 2, cursor: (loading || !input.trim()) ? 'default' : 'pointer',
          }}>
          Send
        </button>
      </div>

      {/* Voice controls */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
          Speak replies aloud
        </label>

        {voices.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)' }}>Voice:</span>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              style={{
                background: 'var(--ink-raised)', border: '1px solid var(--ink-line)', color: 'var(--parchment)',
                fontFamily: 'var(--font-ui)', fontSize: 12, padding: '5px 8px', borderRadius: 2, maxWidth: 220,
              }}
            >
              {voices.filter(v => /en/i.test(v.lang)).map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setVoiceOn(true); speak("Hello, I'm Minerva. This is how I sound."); }}
              style={{ background: 'transparent', border: '1px solid var(--brass)', color: 'var(--brass)', fontFamily: 'var(--font-ui)', fontSize: 11, padding: '4px 8px', borderRadius: 2, cursor: 'pointer' }}>
              preview
            </button>
          </div>
        )}

        <button onClick={stopSpeaking}
          style={{ background: 'transparent', border: 'none', color: 'var(--brass)', fontFamily: 'var(--font-ui)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          Stop speaking
        </button>
        {!voiceSupported && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--parchment-dim)' }}>
            (Voice input works best in Chrome)
          </span>
        )}
      </div>
    </div>
  );
}
