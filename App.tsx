import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, Video, Image as ImageIcon, Layout, Type, CloudRain, Sparkles, Palette, Wand2, Undo, Redo, Trash2, Upload, FileText, ArrowRight, Download, FileSpreadsheet, List, CheckCircle, Music, X, Volume2, Scissors, Wind, CloudFog, Settings2, Clock, Layers, Square } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Types ---

interface BlobEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  phaseX: number;
  phaseY: number;
  baseFreqX: number;
  baseFreqY: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  wobble: number;
}

interface QuizItem {
    id: string;
    question: string;
    options: string[]; // Array of 5 strings (A-E)
    correctAnswer?: number; // 0-4 index (Optional visual highlight)
}

type ParticleType = 'none' | 'stars' | 'rain' | 'wind' | 'smoke' | 'snow';

interface DesignState {
    duration: number; // Total video duration
    speed: number;
    blurLevel: number;
    blobOpacity: number;
    colors: string[];
    bgType: 'color' | 'image';
    bgColor: string;
    bgImage: HTMLImageElement | null;
    bgOpacity: number; 
    
    // Quiz Visual Settings
    fontFamily: string;
    questionColor: string;
    optionColor: string;
    accentColor: string; 
    glassOpacity: number;
    questionFontSize: number;
    optionFontSize: number;
    
    // Layout
    showAnswerBar: boolean;
    optionSpacing: number; // in pixels

    // Particle Settings
    particleEffect: ParticleType;
    particleDensity: number; // 10 - 200
    particleScale: number; // 0.1 - 3.0
    particleOpacity: number; // 0.1 - 1.0
    particleWobble: number; // 0 - 5.0

    // Media
    logo: HTMLImageElement | null;
    audio: File | null;
    audioVolume: number; // 0 - 1
    audioStart: number; // seconds
    audioEnd: number; // seconds
    audioDuration: number; // Total duration of file
    audioFadeIn: number; // seconds
}

// --- Constants ---

const EXPORT_FPS = 60;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920; 

const FUTURISTIC_COLORS = [
  '#FF0055', '#00D4FF', '#0A0F1C', '#7000FF', '#002244',
];

const INITIAL_QUIZ: QuizItem = {
    id: '1',
    question: 'Pancasila sebagai ideologi terbuka berarti bahwa Pancasila...',
    options: [
        'dapat diubah sesuai kepentingan penguasa',
        'bersifat fleksibel tanpa batas',
        'terbuka terhadap perkembangan zaman tanpa meninggalkan nilai dasarnya',
        'hanya berlaku pada masa tertentu',
        'dapat diganti dengan ideologi lain'
    ]
};

const INITIAL_DESIGN: DesignState = {
    duration: 10,
    speed: 0.8,
    blurLevel: 80,
    blobOpacity: 0.8,
    colors: [...FUTURISTIC_COLORS],
    bgType: 'color',
    bgColor: '#0A0F1C',
    bgImage: null,
    bgOpacity: 0.5, 
    
    fontFamily: 'Inter',
    questionColor: '#ffffff',
    optionColor: '#e2e8f0',
    accentColor: '#00D4FF',
    glassOpacity: 0.15,
    questionFontSize: 52,
    optionFontSize: 36,

    showAnswerBar: true,
    optionSpacing: 25,
    
    particleEffect: 'none',
    particleDensity: 50,
    particleScale: 1.0,
    particleOpacity: 0.7,
    particleWobble: 1.0,

    logo: null,
    audio: null,
    audioVolume: 1.0,
    audioStart: 0,
    audioEnd: 0,
    audioDuration: 0,
    audioFadeIn: 0
};

// --- Helper Functions ---

const generateBlobs = (colors: string[], width: number, height: number): BlobEntity[] => {
  return colors.map((color) => ({
    id: Math.random().toString(36).substr(2, 9),
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.min(width, height) * (0.3 + Math.random() * 0.3),
    color,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    baseFreqX: Math.ceil(Math.random() * 2), 
    baseFreqY: Math.ceil(Math.random() * 2),
  }));
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const getWrappedTextLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Main Component ---

const App: React.FC = () => {
  // --- State ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // App Logic State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'data' | 'design'>('data');
  const [showAudioModal, setShowAudioModal] = useState(false);
  
  // Data State
  const [currentQuiz, setCurrentQuiz] = useState<QuizItem>(INITIAL_QUIZ);
  const [quizQueue, setQuizQueue] = useState<QuizItem[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // Design State
  const [design, setDesign] = useState<DesignState>(INITIAL_DESIGN);
  const [blobs, setBlobs] = useState<BlobEntity[]>(() => generateBlobs(FUTURISTIC_COLORS, CANVAS_WIDTH, CANVAS_HEIGHT));
  const particles = useRef<Particle[]>([]);

  // --- Animation Engine ---

  useEffect(() => {
    const maxParticles = 200; 
    const newParticles: Particle[] = [];
    for(let i=0; i<maxParticles; i++) {
        newParticles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            vx: 0, 
            vy: 0,
            size: 0,
            alpha: Math.random(),
            life: Math.random(),
            maxLife: 1,
            wobble: Math.random() * Math.PI * 2
        });
    }
    particles.current = newParticles;
  }, []); 

  const updateParticle = (p: Particle, type: ParticleType, w: number, h: number, design: DesignState) => {
      const wobbleSpeed = 0.05 * design.particleWobble;
      const wobbleAmp = 0.5 * design.particleWobble;

      switch (type) {
          case 'snow':
              // Fixed Snow Logic - Independent of global wobble setting to prevent chaos
              p.vy = 2 + Math.random() * 2; // Constant downward speed
              p.x += Math.sin(p.wobble) * 0.5; // Gentle constant drift
              p.wobble += 0.02; 
              p.y += p.vy;
              p.size = (3 + Math.random() * 3) * design.particleScale;
              
              // Reset to top
              if (p.y > h) {
                  p.y = -10;
                  p.x = Math.random() * w;
              }
              break;
          case 'rain':
              p.vy = 20 + Math.random() * 10;
              p.y += p.vy;
              p.x -= 1 * wobbleAmp; 
              p.size = 2 * design.particleScale;
              if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
              break;
          case 'stars':
              p.alpha += (Math.random() - 0.5) * (0.05 * design.particleWobble);
              if (p.alpha < 0) p.alpha = 0;
              if (p.alpha > 1) p.alpha = 1;
              p.size = (2 + Math.random() * 2) * design.particleScale;
              break;
          case 'wind':
              p.vx = 8 + Math.random() * 5;
              p.x += p.vx;
              p.y += Math.sin(p.x * 0.005) * 2 * design.particleWobble;
              p.size = 100 * design.particleScale; 
              p.life -= 0.005;
              if (p.x > w) { p.x = -200; p.life = 1; }
              break;
          case 'smoke':
              p.vy = -1 - Math.random();
              p.y += p.vy;
              p.x += Math.sin(p.wobble) * wobbleAmp;
              p.wobble += wobbleSpeed;
              p.size = (50 + Math.random() * 20) * design.particleScale;
              p.alpha -= 0.005;
              if (p.alpha <= 0) { p.y = h + 50; p.alpha = 0.5; }
              break;
      }
      
      if (type !== 'wind' && type !== 'snow') {
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;
      }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, design: DesignState, w: number, h: number) => {
      const type = design.particleEffect;
      if (type === 'none') return;
      
      const activeCount = Math.floor(design.particleDensity); 
      
      ctx.save();
      for(let i=0; i<activeCount; i++) {
          const p = particles.current[i];
          updateParticle(p, type, w, h, design);
          
          ctx.globalAlpha = p.alpha * design.particleOpacity; 
          
          if (type === 'stars') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
              ctx.fill();
          } else if (type === 'rain') {
              ctx.strokeStyle = '#aaddff';
              ctx.lineWidth = 1 * design.particleScale;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - 2, p.y + (15 * design.particleScale));
              ctx.stroke();
          } else if (type === 'snow') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
              ctx.fill();
          } else if (type === 'wind') {
             ctx.fillStyle = 'rgba(255,255,255,0.05)';
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.fill();
          } else if (type === 'smoke') {
             ctx.fillStyle = 'rgba(150,150,150,0.1)';
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.fill();
          }
      }
      ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;

    // 1. Clear 
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = design.bgColor;
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Blobs (Always drawn first)
    ctx.save();
    ctx.filter = `blur(${design.blurLevel}px)`;
    ctx.globalCompositeOperation = 'screen'; 
    ctx.globalAlpha = design.blobOpacity; // Blobs keep their own opacity

    const baseHz = 0.5; 
    const targetFreq = design.speed * baseHz; 
    
    blobs.forEach((blob) => {
        const idealTotalCycles = blob.baseFreqX * targetFreq * design.duration;
        const effectiveTotalCycles = Math.max(1, Math.round(idealTotalCycles));
        const loopProgress = (time % (design.duration * 1000)) / (design.duration * 1000);
        
        const angle = loopProgress * Math.PI * 2 * effectiveTotalCycles;
        const angleY = loopProgress * Math.PI * 2 * Math.max(1, Math.round(blob.baseFreqY * targetFreq * design.duration));

        const offsetX = Math.sin(angle + blob.phaseX) * (w * 0.35);
        const offsetY = Math.cos(angleY + blob.phaseY) * (h * 0.35);

        const x = (w / 2) + offsetX;
        const y = (h / 2) + offsetY;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, blob.radius);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, blob.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // 3. Draw Background Image (Overlay)
    if (design.bgType === 'image' && design.bgImage) {
        const img = design.bgImage;
        const r = Math.max(w / img.width, h / img.height);
        const nw = img.width * r;
        const nh = img.height * r;
        const cx = (w - nw) * 0.5;
        const cy = (h - nh) * 0.5;
        ctx.save();
        ctx.globalAlpha = design.bgOpacity; // Opacity affects image only
        ctx.drawImage(img, cx, cy, nw, nh);
        ctx.restore();
    } 

    // 4. Particles Overlay
    drawParticles(ctx, design, w, h);

    // 5. Draw Logo
    let logoOffset = 0;
    if (design.logo) {
        ctx.save();
        const logoSize = 150; 
        const ly = 80;
        const r = Math.min(logoSize / design.logo.width, logoSize / design.logo.height);
        const lw = design.logo.width * r;
        const lh = design.logo.height * r;
        ctx.drawImage(design.logo, (w-lw)/2, ly, lw, lh);
        ctx.restore();
        logoOffset = 100;
    }

    // 6. Draw Quiz UI
    
    // --- LAYOUT CONSTANTS ---
    const margin = 60;
    const safeW = w - (margin * 2);
    const questionBoxY = 200 + logoOffset;
    const questionBoxH = 450;
    const optionStartY = questionBoxY + questionBoxH + 40;
    const optionGap = design.optionSpacing;
    const optionBoxH = 140;

    // A. Question Box
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${design.glassOpacity})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${design.glassOpacity + 0.1})`;
    ctx.lineWidth = 2;
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;

    drawRoundedRect(ctx, margin, questionBoxY, safeW, questionBoxH, 40);
    ctx.fill();
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Question Text - Multiline
    ctx.fillStyle = design.questionColor;
    ctx.font = `600 ${design.questionFontSize}px "${design.fontFamily}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const qLines = getWrappedTextLines(ctx, currentQuiz.question, safeW - 80);
    const qLineHeight = design.questionFontSize * 1.3;
    const qTotalH = qLines.length * qLineHeight;
    let qStartY = questionBoxY + (questionBoxH / 2) - (qTotalH / 2) + (qLineHeight/2);
    
    qLines.forEach(line => {
        ctx.fillText(line, w/2, qStartY);
        qStartY += qLineHeight;
    });
    ctx.restore();

    // B. Option Boxes (A-E)
    const optionLabels = ['A', 'B', 'C', 'D', 'E'];

    currentQuiz.options.forEach((optText, i) => {
        if (i > 4) return; // Max 5
        const y = optionStartY + (i * (optionBoxH + optionGap));

        ctx.save();
        
        if (design.showAnswerBar) {
            // Option Box Glass
            ctx.fillStyle = `rgba(255, 255, 255, ${design.glassOpacity - 0.05})`; 
            ctx.strokeStyle = `rgba(255, 255, 255, ${design.glassOpacity})`;
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, margin, y, safeW, optionBoxH, 25);
            ctx.fill();
            ctx.stroke();
        }

        // Circle Indicator (Left Side) - NO FILL, WHITE STROKE
        const circleX = margin + 70;
        const circleY = y + (optionBoxH / 2);

        // Circle Outline
        ctx.strokeStyle = '#ffffff'; // White stroke as requested
        ctx.lineWidth = 5;
        
        ctx.beginPath();
        ctx.arc(circleX, circleY, 35, 0, Math.PI * 2);
        ctx.stroke(); 

        // Circle Text (A, B...)
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 40px "${design.fontFamily}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(optionLabels[i], circleX, circleY + 2);

        // Option Text - Multiline
        ctx.fillStyle = design.optionColor;
        ctx.font = `500 ${design.optionFontSize}px "${design.fontFamily}"`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const textX = circleX + 70;
        const textMaxWidth = safeW - 170;
        const optLines = getWrappedTextLines(ctx, optText, textMaxWidth);
        const optLineHeight = design.optionFontSize * 1.3;
        const optTotalH = optLines.length * optLineHeight;
        
        // Vertically center based on lines
        let optStartY = y + (optionBoxH / 2) - (optTotalH / 2) + (optLineHeight/2);
        
        optLines.forEach(line => {
             ctx.fillText(line, textX, optStartY);
             optStartY += optLineHeight;
        });

        ctx.restore();
    });

  }, [blobs, design, currentQuiz]);

  const animate = useCallback((time: number) => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (ctx) {
        draw(ctx, time);
      }
    }
    if (isPlaying && !isRecording) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [draw, isPlaying, isRecording]);

  useEffect(() => {
    if(isPlaying) {
       requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
        if (requestRef.current !== null) {
            cancelAnimationFrame(requestRef.current);
        }
    };
  }, [animate, isPlaying]); // Depend on isPlaying to toggle loop

  // Audio Playback Sync
  useEffect(() => {
    if (audioRef.current && design.audio) {
        audioRef.current.volume = design.audioVolume;
        
        if (isPlaying && !isRecording) {
            // Loop logic
            if (audioRef.current.currentTime >= design.audioEnd || audioRef.current.currentTime < design.audioStart) {
                audioRef.current.currentTime = design.audioStart;
            }
            audioRef.current.play().catch(() => {});
        } else {
            audioRef.current.pause();
        }
    }
  }, [isPlaying, isRecording, design.audio, design.audioVolume, design.audioStart, design.audioEnd]);

  // --- Handlers ---

  const handleStop = () => {
      setIsPlaying(false);
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = design.audioStart;
      }
  };

  const updateWaveColor = (index: number, newColor: string) => {
      const newColors = [...design.colors];
      newColors[index] = newColor;
      setDesign(prev => ({ ...prev, colors: newColors }));
      // Regenerate blobs with new colors but keep positions somewhat random
      setBlobs(generateBlobs(newColors, CANVAS_WIDTH, CANVAS_HEIGHT));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const parsedQueue: QuizItem[] = [];
        data.forEach((row, index) => {
            if (row.length < 2) return; 
            if (index === 0 && (row[0] === 'Question' || row[0] === 'Pertanyaan')) return;

            const question = row[0];
            const options = [row[1], row[2], row[3], row[4], row[5]].filter(o => o !== undefined && o !== '').map(String);
            while (options.length < 5) options.push('');

            if (question) {
                parsedQueue.push({
                    id: Math.random().toString(36).substr(2, 9),
                    question: String(question),
                    options: options
                });
            }
        });

        if (parsedQueue.length > 0) {
            setQuizQueue(parsedQueue);
            setFileName(file.name);
            alert(`Berhasil memuat ${parsedQueue.length} soal dari Excel!`);
        } else {
            alert("Tidak ada data soal yang valid ditemukan.");
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  if (type === 'bg') {
                      setDesign(prev => ({ ...prev, bgImage: img, bgType: 'image' }));
                  } else {
                      setDesign(prev => ({ ...prev, logo: img }));
                  }
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
      e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          if (audioRef.current) {
              audioRef.current.src = url;
              audioRef.current.onloadedmetadata = () => {
                 setDesign(prev => ({
                     ...prev,
                     audio: file,
                     audioDuration: audioRef.current!.duration,
                     audioStart: 0,
                     audioEnd: audioRef.current!.duration,
                     audioFadeIn: 0
                 }));
                 setShowAudioModal(true);
              };
          }
      }
      e.target.value = '';
  };

  const loadQuizFromQueue = (item: QuizItem) => {
      setCurrentQuiz(item);
  };

  const updateCurrentQuiz = (updates: Partial<QuizItem>) => {
      setCurrentQuiz(prev => ({ ...prev, ...updates }));
  };

  const updateOption = (index: number, val: string) => {
      const newOptions = [...currentQuiz.options];
      newOptions[index] = val;
      setCurrentQuiz(prev => ({ ...prev, options: newOptions }));
  };

  // --- Export Logic ---

  const exportImage = () => {
      if (!canvasRef.current) return;
      const link = document.createElement('a');
      link.download = `quiz-${currentQuiz.id}-${Date.now()}.jpg`;
      link.href = canvasRef.current.toDataURL('image/jpeg', 0.9);
      link.click();
  };

  const exportVideo = async () => {
      if (!canvasRef.current) return;
      setIsPlaying(false);
      setIsRecording(true);
      
      const stream = canvasRef.current.captureStream(EXPORT_FPS);
      
      // Audio Mixing
      let audioCtx: AudioContext | null = null;
      let source: AudioBufferSourceNode | null = null;

      if (design.audio) {
          try {
              audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const dest = audioCtx.createMediaStreamDestination();
              const arrayBuffer = await design.audio.arrayBuffer();
              const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
              
              source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.loop = true;
              source.loopStart = design.audioStart;
              source.loopEnd = design.audioEnd;
              
              const gainNode = audioCtx.createGain();
              
              // Apply Volume
              gainNode.gain.value = design.audioVolume;

              // Apply Fade In
              if (design.audioFadeIn > 0) {
                   gainNode.gain.setValueAtTime(0, 0);
                   gainNode.gain.linearRampToValueAtTime(design.audioVolume, design.audioFadeIn);
              }
              
              source.connect(gainNode);
              gainNode.connect(dest);
              source.start(0, design.audioStart);
              
              const audioTrack = dest.stream.getAudioTracks()[0];
              stream.addTrack(audioTrack);
          } catch(e) {
              console.error("Audio mix failed", e);
          }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') 
          ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' 
          : 'video/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `quiz-${currentQuiz.id}.mp4`;
          a.click();
          URL.revokeObjectURL(url);
          setIsRecording(false);
          setRecordingProgress(0);
          setIsPlaying(true);
          
          if (audioCtx) audioCtx.close();
      };

      recorder.start();
      
      const startTime = performance.now();
      const durationMs = design.duration * 1000;
      
      const tick = (now: number) => {
          const elapsed = now - startTime;
          if (elapsed >= durationMs) {
              recorder.stop();
              return;
          }
          draw(canvasRef.current!.getContext('2d')!, elapsed);
          setRecordingProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)));
          requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0F1C] text-white font-sans overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* --- HEADER --- */}
      <div className="h-16 shrink-0 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-6 z-20 shadow-lg relative">
          <div className="flex items-center gap-3">
            <h1 className="font-extrabold text-2xl tracking-tighter bg-gradient-to-r from-brand-red to-brand-blue bg-clip-text text-transparent">
                Quizeasy
            </h1>
            <span className="text-xs text-gray-500 font-medium tracking-widest border-l border-gray-700 pl-3">GENERATOR DESAIN QUIZ</span>
          </div>
          
          {/* EXPORT BUTTONS (MOVED TO HEADER) */}
           <div className="flex items-center gap-4">
                <button onClick={exportImage} disabled={isRecording} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-brand-blue hover:text-brand-blue transition-all group">
                    <ImageIcon size={16} />
                    <span className="text-xs font-bold">Export JPEG</span>
                </button>
                <button onClick={exportVideo} disabled={isRecording} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-brand-red hover:text-brand-red transition-all group">
                    <Video size={16} />
                    <span className="text-xs font-bold">Export MP4</span>
                </button>
          </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* LEFT: CANVAS PREVIEW */}
          <div className="w-full lg:flex-1 h-[45vh] lg:h-auto shrink-0 bg-[#05070a] p-4 lg:p-8 flex flex-col items-center justify-center relative gap-4 border-b lg:border-b-0 border-gray-800">
              
              <div 
                  className="shadow-2xl rounded-2xl overflow-hidden border-2 border-gray-800 bg-black relative group"
                  style={{ 
                    height: '90%', 
                    aspectRatio: '9/16' 
                  }}
              >
                  <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain" />
                  
                  {/* CANVAS CONTROLS OVERLAY */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center gap-3">
                       {!isRecording && (
                           <>
                               <button 
                                    onClick={() => setIsPlaying(!isPlaying)} 
                                    className="pointer-events-auto bg-black/50 backdrop-blur-sm p-4 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-white/20"
                               >
                                   {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
                               </button>
                               <button 
                                    onClick={handleStop} 
                                    className="pointer-events-auto bg-black/50 backdrop-blur-sm p-4 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-white/20"
                               >
                                   <Square size={32} fill="white" />
                               </button>
                           </>
                       )}
                  </div>

                  {isRecording && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                          <div className="text-3xl font-bold mb-4 animate-pulse text-brand-blue">Rendering Video</div>
                          <div className="text-5xl font-black text-white mb-6">{recordingProgress}%</div>
                          <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden"><div style={{width: `${recordingProgress}%`}} className="h-full bg-brand-red transition-all"/></div>
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT: SETTINGS PANEL */}
          <div className="w-full lg:w-[500px] flex-1 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col z-10 overflow-hidden">
              
              {/* TABS */}
              <div className="flex border-b border-gray-800">
                  <button onClick={() => setActiveTab('data')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'data' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                      <List size={16} /> Data Soal
                  </button>
                  <button onClick={() => setActiveTab('design')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'design' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                      <Palette size={16} /> Desain & Visual
                  </button>
              </div>

              {/* TAB CONTENT */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  
                  {/* TAB: DATA SOAL */}
                  {activeTab === 'data' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                          {/* 1. EXCEL IMPORT */}
                          <div className="p-5 border border-gray-700 rounded-xl bg-gray-800/50">
                              <div className="flex items-center gap-3 mb-4 text-gray-300">
                                  <Upload size={18} />
                                  <span className="font-bold text-sm">Import Data Excel</span>
                              </div>
                              <label className="flex items-center justify-between w-full px-4 py-3 bg-gray-900 border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-brand-blue hover:bg-gray-800 transition-all group">
                                  <div className="flex flex-col">
                                      <span className="text-sm font-medium text-gray-400 group-hover:text-white">{fileName || 'Pilih File .xlsx'}</span>
                                  </div>
                                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                                  <div className="bg-brand-blue/20 text-brand-blue px-2 py-1 rounded text-xs font-bold">Browse</div>
                              </label>
                              <p className="text-[10px] text-gray-500 mt-2">Format: Kolom A (Pertanyaan), Kolom B-F (Opsi Jawaban)</p>

                              {/* QUEUE LIST */}
                              {quizQueue.length > 0 && (
                                  <div className="mt-4 max-h-[150px] overflow-y-auto border-t border-gray-700 pt-2 space-y-2">
                                      {quizQueue.map((item, idx) => (
                                          <div key={idx} className={`p-3 rounded text-xs flex justify-between items-center ${currentQuiz.question === item.question ? 'bg-brand-blue/10 border border-brand-blue/30' : 'bg-gray-900 border border-gray-800'}`}>
                                              <div className="flex flex-col gap-1 overflow-hidden">
                                                 <span className={`truncate font-medium max-w-[280px] ${currentQuiz.question === item.question ? 'text-brand-blue' : 'text-gray-300'}`}>{idx + 1}. {item.question}</span>
                                                 <span className="text-[10px] text-gray-500">5 Options</span>
                                              </div>
                                              <button 
                                                onClick={() => loadQuizFromQueue(item)}
                                                className="px-3 py-1.5 rounded-md bg-brand-blue text-black font-bold hover:bg-blue-400 transition-colors"
                                              >
                                                  Load
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>

                          {/* 2. MANUAL INPUT */}
                          <div className="space-y-4 border-t border-gray-800 pt-6">
                              <div className="flex items-center gap-2 text-gray-300">
                                  <Type size={18} />
                                  <span className="font-bold text-sm">Input Manual</span>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Pertanyaan</label>
                                  <textarea 
                                      value={currentQuiz.question}
                                      onChange={(e) => updateCurrentQuiz({ question: e.target.value })}
                                      className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:border-brand-blue focus:outline-none resize-none placeholder-gray-600 text-white"
                                  />
                              </div>

                              <div className="space-y-3">
                                  <label className="text-xs text-gray-500 font-bold uppercase block">Opsi Jawaban (A-E)</label>
                                  {['A', 'B', 'C', 'D', 'E'].map((label, i) => (
                                      <div key={label} className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${i%2===0 ? 'bg-brand-blue text-black' : 'bg-brand-red text-white'}`}>
                                              {label}
                                          </div>
                                          <input 
                                              type="text"
                                              value={currentQuiz.options[i] || ''}
                                              onChange={(e) => updateOption(i, e.target.value)}
                                              className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:border-brand-blue focus:outline-none"
                                              placeholder={`Opsi ${label}`}
                                          />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* TAB: DESIGN */}
                  {activeTab === 'design' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                          
                          {/* 1. ASET MEDIA */}
                          <div className="p-5 border border-gray-700 rounded-xl bg-[#0F131A]">
                              <div className="flex items-center gap-2 mb-4 text-white">
                                  <ImageIcon size={18} />
                                  <span className="font-bold text-sm">Aset Media</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                  {/* Logo Upload */}
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">Logo</span>
                                      <label className="aspect-video border border-dashed border-brand-blue/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900/50 relative overflow-hidden group">
                                          {design.logo ? (
                                              <>
                                                <img src={design.logo.src} className="w-full h-full object-contain p-2" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload size={16} /></div>
                                              </>
                                          ) : (
                                              <Upload size={18} className="text-brand-blue" />
                                          )}
                                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" />
                                      </label>
                                  </div>

                                  {/* Background Upload */}
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">Background</span>
                                      <label className="aspect-video border border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900/50 relative overflow-hidden group">
                                          {design.bgType === 'image' && design.bgImage ? (
                                              <>
                                                  <img src={design.bgImage.src} className="w-full h-full object-cover" />
                                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload size={16} /></div>
                                              </>
                                          ) : (
                                              <Layout size={18} className="text-gray-500" />
                                          )}
                                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} className="hidden" />
                                      </label>
                                  </div>

                                  {/* Audio Upload */}
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">Audio</span>
                                      <label className="aspect-video border border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900/50 group relative">
                                          {design.audio ? (
                                              <div className="flex flex-col items-center gap-1">
                                                  <Music size={18} className="text-brand-red" />
                                                  <span className="text-[9px] text-gray-300">Edit</span>
                                                  <button 
                                                    onClick={(e) => { e.preventDefault(); setShowAudioModal(true); }}
                                                    className="absolute inset-0"
                                                  ></button>
                                              </div>
                                          ) : (
                                              <div className="flex flex-col items-center gap-1">
                                                <Music size={18} className="text-gray-500" />
                                                <span className="text-[9px] text-gray-500">Upload</span>
                                              </div>
                                          )}
                                          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                                      </label>
                                  </div>
                              </div>
                              
                              {/* Background Opacity & Duration */}
                              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
                                  <div>
                                       <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1"><Layers size={10}/> BG Opacity</label>
                                       <input type="range" min="0" max="1" step="0.1" value={design.bgOpacity} onChange={e => setDesign({...design, bgOpacity: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                  </div>
                                   <div>
                                       <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Durasi Video</label>
                                       <div className="flex items-center gap-2">
                                            <input type="range" min="5" max="60" step="1" value={design.duration} onChange={e => setDesign({...design, duration: parseInt(e.target.value)})} className="flex-1 h-1 bg-gray-700 rounded accent-brand-blue"/>
                                            <span className="text-[10px] text-brand-blue font-mono">{design.duration}s</span>
                                       </div>
                                  </div>
                              </div>
                          </div>
                          
                          {/* 1.5 WAVE SETTINGS */}
                          <div className="p-5 border border-gray-700 rounded-xl bg-[#0F131A]">
                              <div className="flex items-center gap-2 mb-4 text-white">
                                  <Wand2 size={18} />
                                  <span className="font-bold text-sm">Pengaturan Wave</span>
                              </div>
                              <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Wave Opacity</label>
                                          <input type="range" min="0" max="1" step="0.1" value={design.blobOpacity} onChange={e => setDesign({...design, blobOpacity: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                      </div>
                                      <div>
                                          <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Wave Speed</label>
                                          <input type="range" min="0.1" max="3" step="0.1" value={design.speed} onChange={e => setDesign({...design, speed: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                      </div>
                                  </div>
                                  
                                  <div>
                                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">Wave Colors</label>
                                      <div className="flex justify-between items-center gap-2">
                                          {design.colors.map((color, index) => (
                                              <div key={index} className="flex flex-col items-center">
                                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 relative">
                                                      <input 
                                                        type="color" 
                                                        value={color} 
                                                        onChange={(e) => updateWaveColor(index, e.target.value)}
                                                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                                                      />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* 2. TATA LETAK & FONT */}
                          <div className="p-5 border border-gray-700 rounded-xl bg-[#0F131A]">
                              <div className="flex items-center gap-2 mb-4 text-white">
                                  <Layout size={18} />
                                  <span className="font-bold text-sm">Tata Letak & Font</span>
                              </div>
                              
                              <div className="space-y-4">
                                  {/* Font Select */}
                                  <div>
                                      <label className="text-xs text-gray-500 mb-2 block">Jenis Font</label>
                                      <select 
                                        value={design.fontFamily} 
                                        onChange={(e) => setDesign({...design, fontFamily: e.target.value})}
                                        className="w-full bg-[#1A202C] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-brand-blue outline-none"
                                      >
                                          <option value="Inter">Inter</option>
                                          <option value="Poppins">Poppins</option>
                                          <option value="Roboto">Roboto</option>
                                          <option value="Montserrat">Montserrat</option>
                                      </select>
                                  </div>

                                  {/* Toggle Answer Bar */}
                                  <div className="flex items-center justify-between">
                                      <label className="text-xs text-gray-500">Tampilkan Bar Jawaban</label>
                                      <button 
                                        onClick={() => setDesign(prev => ({ ...prev, showAnswerBar: !prev.showAnswerBar }))}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${design.showAnswerBar ? 'bg-white' : 'bg-gray-700'}`}
                                      >
                                          <div className={`w-3 h-3 rounded-full bg-black absolute top-1 transition-all ${design.showAnswerBar ? 'left-6' : 'left-1'}`}></div>
                                      </button>
                                  </div>

                                  {/* Spacing Slider */}
                                  <div>
                                      <div className="flex justify-between mb-2">
                                          <label className="text-xs text-gray-500">Jarak Antar Opsi</label>
                                          <span className="text-xs text-white">{design.optionSpacing}px</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={design.optionSpacing} 
                                        onChange={(e) => setDesign({...design, optionSpacing: parseInt(e.target.value)})}
                                        className="w-full h-1 bg-gray-700 rounded-lg accent-brand-blue" 
                                      />
                                  </div>

                                  {/* Font Sizes */}
                                   <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                                      <div>
                                          <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Size Soal</label>
                                          <input type="range" min="20" max="80" value={design.questionFontSize} onChange={e => setDesign({...design, questionFontSize: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                      </div>
                                      <div>
                                          <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Size Opsi</label>
                                          <input type="range" min="16" max="60" value={design.optionFontSize} onChange={e => setDesign({...design, optionFontSize: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* 3. EFEK PARTIKEL */}
                          <div className="p-5 border border-gray-700 rounded-xl bg-[#0F131A]">
                              <div className="flex items-center gap-2 mb-4 text-white">
                                  <Sparkles size={18} />
                                  <span className="font-bold text-sm">Efek Partikel</span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 mb-6">
                                  {(['none', 'stars', 'rain', 'wind', 'smoke', 'snow'] as const).map(effect => (
                                      <button 
                                        key={effect}
                                        onClick={() => setDesign(prev => ({ ...prev, particleEffect: effect }))}
                                        className={`py-2 px-1 rounded border text-[10px] font-bold uppercase transition-all ${design.particleEffect === effect ? 'bg-brand-red text-white border-brand-red' : 'bg-[#1A202C] text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                      >
                                          {effect === 'none' ? 'TIDAK ADA' : effect}
                                      </button>
                                  ))}
                              </div>

                              {design.particleEffect !== 'none' && (
                                  <div className="space-y-4 pt-2 border-t border-gray-800">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Density</label>
                                              <input type="range" min="10" max="200" step="10" value={design.particleDensity} onChange={e => setDesign({...design, particleDensity: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                          </div>
                                          <div>
                                              <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Scale</label>
                                              <input type="range" min="0.1" max="3" step="0.1" value={design.particleScale} onChange={e => setDesign({...design, particleScale: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                          </div>
                                          <div>
                                              <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Opacity</label>
                                              <input type="range" min="0.1" max="1" step="0.1" value={design.particleOpacity} onChange={e => setDesign({...design, particleOpacity: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                          </div>
                                          <div>
                                              <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Wobble</label>
                                              <input type="range" min="0" max="5" step="0.5" value={design.particleWobble} onChange={e => setDesign({...design, particleWobble: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded accent-white"/>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* --- AUDIO MODAL --- */}
      {showAudioModal && design.audio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="w-[450px] bg-[#0A0F1C] border border-gray-800 rounded-2xl p-6 shadow-2xl shadow-brand-blue/10">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="font-bold text-xl text-white">Audio Settings</h3>
                      <button onClick={() => setShowAudioModal(false)} className="text-gray-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>

                  <div className="space-y-8">
                      {/* Trim Start */}
                      <div>
                          <div className="flex justify-between mb-2">
                             <label className="text-sm font-bold text-brand-blue">Trim Start: {design.audioStart.toFixed(1)}s</label>
                          </div>
                          <input 
                                type="range" 
                                min="0" 
                                max={design.audioDuration} 
                                step="0.1"
                                value={design.audioStart}
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    if(val < design.audioEnd) setDesign({...design, audioStart: val});
                                }}
                                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                          />
                          <p className="text-[10px] text-gray-500 mt-2">Audio will play for max {design.duration} seconds from this point.</p>
                      </div>

                      {/* Volume */}
                      <div>
                          <div className="flex justify-between mb-2">
                              <label className="text-sm font-bold text-brand-blue">Volume: {Math.round(design.audioVolume * 100)}%</label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={design.audioVolume} 
                            onChange={e => setDesign({...design, audioVolume: parseFloat(e.target.value)})}
                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-red" 
                          />
                      </div>

                      {/* Fade In */}
                      <div>
                          <div className="flex justify-between mb-2">
                              <label className="text-sm font-bold text-brand-blue">Fade In Duration: {design.audioFadeIn}s</label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="5" 
                            step="0.5" 
                            value={design.audioFadeIn} 
                            onChange={e => setDesign({...design, audioFadeIn: parseFloat(e.target.value)})}
                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-blue" 
                          />
                      </div>
                  </div>

                  <div className="mt-10 flex gap-3">
                      <button 
                        onClick={() => {
                             if(audioRef.current) {
                                 if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
                                 else { 
                                     audioRef.current.currentTime = design.audioStart; 
                                     audioRef.current.play(); 
                                     setIsPlaying(true); 
                                }
                             }
                        }}
                        className="flex-1 border border-gray-700 text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                          <Play size={16} /> Preview Trim
                      </button>
                      <button 
                        onClick={() => setShowAudioModal(false)}
                        className="flex-1 bg-gradient-to-r from-brand-blue to-brand-red text-white py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                          <CheckCircle size={16} /> Save Settings
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;