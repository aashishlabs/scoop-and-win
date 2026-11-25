'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const FLAVORS = [
  { name: 'Madagascan Vanilla', main: '#FFF8E7', shade: '#EAD8B1', highlight: '#FFFFFF', bonus: false },
  { name: 'Belgian Chocolate', main: '#5C3317', shade: '#3B1E0B', highlight: '#8B5A2B', bonus: false },
  { name: 'Alphonso Mango', main: '#FFB703', shade: '#D98A00', highlight: '#FFE169', bonus: false },
  { name: 'Rose Berry Gelato', main: '#E05780', shade: '#B5385E', highlight: '#FF9EBB', bonus: false },
  { name: 'Pistachio Royale', main: '#7FB069', shade: '#588147', highlight: '#B5E48C', bonus: false },
  { name: 'Choco-Dip Rainbow', main: '#F472B6', shade: '#4C1D95', highlight: '#FDE047', bonus: true, rainbow: true },
];

function evaluateRewardTier(score) {
  if (score >= 1200) return { badge: 'GOLD CROWN TIER', reward: '15% Off Second Scoop or Combo' };
  if (score >= 600) return { badge: 'SILVER ROYAL TIER', reward: '₹15 Off Any Sundae' };
  return { badge: 'BRONZE ROYAL TIER', reward: 'Free Waffle Cone Upgrade or Topping' };
}

export default function ScoopAndWinPage() {
  const [screen, setScreen] = useState('landing');
  const [sheetData, setSheetData] = useState({
    Customers: [],
    Coupons: [],
    Settings: { staff_pin: '2580', campaign_active: true, referral_reward_text: 'Free ₹100 Cone' },
  });
  const [loadingSheet, setLoadingSheet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const [incomingRefCode, setIncomingRefCode] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');

  const [finalScore, setFinalScore] = useState(0);
  const [claimPhone, setClaimPhone] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimRef, setClaimRef] = useState('');
  const [claimError, setClaimError] = useState('');
  const [activeUserPhone, setActiveUserPhone] = useState('');
  const [liveClock, setLiveClock] = useState('');

  const [cashierCouponId, setCashierCouponId] = useState(null);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [cashierError, setCashierError] = useState('');

  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState('Customers');
  const [pinDraft, setPinDraft] = useState('2580');
  const [refRewardDraft, setRefRewardDraft] = useState('Free ₹100 Cone');
  const [campaignActiveDraft, setCampaignActiveDraft] = useState(true);

  const [hud, setHud] = useState({
    timeLeft: 30,
    score: 0,
    combo: 1,
    lives: 3,
    phase: 'Royal Warmup',
    tierBanner: '',
    rulesOpen: false,
    showTapHint: true,
  });

  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const audioCtxRef = useRef(null);
  const soundMutedRef = useRef(false);
  const [soundMuted, setSoundMuted] = useState(false);

  const gameRef = useRef({
    running: false,
    rafId: null,
    timerId: null,
    timeLeft: 30,
    score: 0,
    combo: 1,
    lives: 3,
    coneX: 180,
    coneWidth: 74,
    coneHeight: 84,
    scoopRadius: 25,
    stackStepY: 31,
    stack: [],
    fallingScoop: null,
    swingScoop: null,
    swingAngle: 0,
    spawnedCount: 0,
    highestTierReached: 0,
    particles: [],
    floatingTexts: [],
    ambientDust: [],
    cameraY: 0,
    targetCameraY: 0,
    firstDropDone: false,
    lastFrameTime: 0,
  });

  const notify = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(notify.t);
    notify.t = window.setTimeout(() => setToast(''), 3200);
  }, []);

  const fetchLiveSheet = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingSheet(true);
      const res = await fetch('/api/sheet', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok && json.data) {
        setSheetData(json.data);
        setPinDraft(json.data.Settings.staff_pin || '2580');
        setRefRewardDraft(json.data.Settings.referral_reward_text || 'Free ₹100 Cone');
        setCampaignActiveDraft(Boolean(json.data.Settings.campaign_active));
      } else if (!silent) {
        notify(json.error || 'Could not load Google Sheet');
      }
    } catch {
      if (!silent) notify('Unable to reach /api/sheet');
    } finally {
      setLoadingSheet(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchLiveSheet();
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || '').trim().toUpperCase();
    if (ref) {
      setIncomingRefCode(ref);
      setClaimRef(ref);
    }
  }, [fetchLiveSheet]);

  useEffect(() => {
    setLiveClock(new Date().toLocaleTimeString());
    const id = window.setInterval(() => setLiveClock(new Date().toLocaleTimeString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const initAudio = () => {
    if (soundMutedRef.current) return;
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTone = (freq, type = 'sine', duration = 0.16, gainVal = 0.12, delay = 0) => {
    if (soundMutedRef.current) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    } catch { }
  };

  const toggleSound = () => {
    const next = !soundMutedRef.current;
    soundMutedRef.current = next;
    setSoundMuted(next);
    notify(next ? 'Sound muted' : 'Royal chimes enabled');
  };

  const stopGame = useCallback(() => {
    const g = gameRef.current;
    g.running = false;
    window.clearInterval(g.timerId);
    window.cancelAnimationFrame(g.rafId);
  }, []);

  const syncHudFromState = useCallback(() => {
    const g = gameRef.current;
    setHud((prev) => ({
      ...prev,
      timeLeft: g.timeLeft,
      score: g.score,
      combo: g.combo,
      lives: g.lives,
      phase: g.timeLeft > 20 ? 'Royal Warmup' : g.timeLeft > 10 ? 'Velvet Tempo' : 'Final Rush!',
      showTapHint: !g.firstDropDone,
    }));
  }, []);

  const finishGame = useCallback(() => {
    stopGame();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, 'triangle', 0.35, 0.13, i * 0.09));
    setFinalScore(gameRef.current.score);
    setClaimError('');
    setScreen('claim');
  }, [stopGame]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const W = wrapper.clientWidth || 380;
    const H = wrapper.clientHeight || 520;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W, H };
  }, []);

  const spawnSwingScoop = (W, forceStandard = false) => {
    const g = gameRef.current;
    g.spawnedCount += 1;
    const isBonus = !forceStandard && g.spawnedCount % 4 === 0;
    const pool = isBonus ? [FLAVORS[5]] : FLAVORS.slice(0, 5);
    const flavor = pool[Math.floor(Math.random() * pool.length)];
    g.swingScoop = { x: W / 2, y: 52, radius: g.scoopRadius, flavor };
  };

  const startGame = () => {
    if (!sheetData.Settings.campaign_active) {
      notify('Campaign is currently paused by the store owner.');
      return;
    }
    initAudio();
    setScreen('game');

    window.setTimeout(() => {
      const { W, H } = resizeCanvas() || { W: 380, H: 520 };
      const g = gameRef.current;
      g.running = true;
      g.timeLeft = 30;
      g.score = 0;
      g.combo = 1;
      g.lives = 3;
      g.coneX = W / 2;
      g.stack = [];
      g.fallingScoop = null;
      g.swingAngle = 0;
      g.spawnedCount = 0;
      g.highestTierReached = 0;
      g.particles = [];
      g.floatingTexts = [];
      g.cameraY = 0;
      g.targetCameraY = 0;
      g.firstDropDone = false;
      g.ambientDust = Array.from({ length: 24 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 1.8,
        speedY: -8 - Math.random() * 14,
        alpha: 0.2 + Math.random() * 0.45,
      }));

      spawnSwingScoop(W, true);
      setHud({
        timeLeft: 30,
        score: 0,
        combo: 1,
        lives: 3,
        phase: 'Royal Warmup',
        tierBanner: '',
        rulesOpen: false,
        showTapHint: true,
      });

      window.clearInterval(g.timerId);
      g.timerId = window.setInterval(() => {
        if (!g.running) return;
        g.timeLeft -= 1;
        syncHudFromState();
        if (g.timeLeft <= 0) finishGame();
      }, 1000);

      const drawScoop = (ctx, x, y, radius, flavor) => {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.72, radius * 0.85, radius * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.15, x, y, radius);
        grad.addColorStop(0, flavor.highlight);
        grad.addColorStop(0.55, flavor.main);
        grad.addColorStop(1, flavor.shade);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI, 0, false);
        const lobes = 5;
        const step = (radius * 2) / lobes;
        for (let i = 0; i < lobes; i++) {
          const lx = x + radius - i * step;
          ctx.quadraticCurveTo(lx - step * 0.5, y + radius * 0.42, lx - step, y + radius * 0.12);
        }
        ctx.closePath();
        ctx.fill();

        if (flavor.rainbow || flavor.bonus) {
          const cols = ['#FDE047', '#38BDF8', '#FB7185', '#4ADE80'];
          for (let i = -2; i <= 2; i++) {
            ctx.fillStyle = cols[Math.abs(i) % cols.length];
            ctx.beginPath();
            ctx.roundRect(x + i * 7 - 2, y - 9 + (i % 2) * 5, 5, 2.5, 1.2);
            ctx.fill();
          }
          ctx.strokeStyle = '#F6E27F';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        ctx.restore();
      };

      const drawCone = (ctx, centerX, rimY, width, height) => {
        ctx.save();
        const halfW = width / 2;
        const tipY = rimY + height;
        const coneGrad = ctx.createLinearGradient(centerX - halfW, rimY, centerX + halfW, tipY);
        coneGrad.addColorStop(0, '#E8AE68');
        coneGrad.addColorStop(0.5, '#C8843B');
        coneGrad.addColorStop(1, '#8C5219');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(centerX - halfW, rimY);
        ctx.lineTo(centerX + halfW, rimY);
        ctx.lineTo(centerX, tipY);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = 'rgba(92,46,10,0.35)';
        ctx.lineWidth = 1.4;
        for (let offset = -width; offset <= width; offset += 14) {
          ctx.beginPath();
          ctx.moveTo(centerX + offset, rimY);
          ctx.lineTo(centerX + offset + height * 0.65, tipY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(centerX + offset, rimY);
          ctx.lineTo(centerX + offset - height * 0.65, tipY);
          ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#F6E27F';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(centerX - halfW - 2, rimY);
        ctx.lineTo(centerX + halfW + 2, rimY);
        ctx.stroke();
        ctx.restore();
      };

      const tick = (now) => {
        if (!g.running) return;
        const dt = Math.min(0.05, (now - (g.lastFrameTime || now)) / 1000);
        g.lastFrameTime = now;
        const { W: curW, H: curH } = resizeCanvas() || { W: 380, H: 520 };

        const elapsed = 30 - g.timeLeft;
        g.swingAngle += dt * (2.25 + elapsed * 0.05);
        g.coneX = curW / 2 + Math.sin(g.swingAngle * 0.65) * (curW * 0.22);

        if (g.swingScoop) {
          g.swingScoop.x = curW / 2 + Math.cos(g.swingAngle) * (curW * 0.32);
          g.swingScoop.y = 52;
        }

        const coneBottomY = curH - 20;
        const coneRimY = coneBottomY - g.coneHeight;
        const stackTopWorldY =
          g.stack.length === 0
            ? coneRimY
            : coneRimY - g.scoopRadius * 0.68 - (g.stack.length - 1) * g.stackStepY;

        g.targetCameraY = g.stack.length >= 4 ? Math.max(0, curH * 0.66 - stackTopWorldY) : 0;
        g.cameraY += (g.targetCameraY - g.cameraY) * Math.min(1, dt * 6);

        if (g.fallingScoop) {
          const s = g.fallingScoop;
          const prevY = s.y;
          s.vy += 940 * dt;
          s.y += s.vy * dt;

          const topItem = g.stack[g.stack.length - 1];
          const targetX = topItem ? g.coneX + topItem.offsetX : g.coneX;
          const catchWorldY = g.stack.length === 0 ? coneRimY - s.radius * 0.65 : stackTopWorldY - g.stackStepY;
          const catchY = catchWorldY + g.cameraY;

          if (prevY <= catchY + 14 && s.y >= catchY) {
            const dx = s.x - targetX;
            const absDx = Math.abs(dx);
            if (absDx <= 46) {
              const clean = absDx <= 28;
              const prevOffset = topItem ? topItem.offsetX : 0;
              let earned = 0;
              let nextOffset = prevOffset;
              let label = '';

              if (s.flavor.bonus) {
                earned = 200 * g.combo;
                g.score += earned;
                nextOffset = prevOffset * 0.2;
                g.combo = Math.min(5, g.combo + 1);
                label = `RAINBOW BONUS! +${earned} → ${g.combo}x`;
              } else if (clean) {
                earned = 100 * g.combo;
                g.score += earned;
                nextOffset = prevOffset * 0.65;
                g.combo = Math.min(5, g.combo + 1);
                label = `SWEET SPOT! +${earned} → ${g.combo}x`;
              } else {
                earned = 75 * g.combo;
                g.score += earned;
                g.combo = Math.max(1, g.combo - 1);
                nextOffset = prevOffset + dx * 0.35;
                label = `CAUGHT! +${earned} (${g.combo}x)`;
              }

              g.stack.push({
                offsetX: Math.max(-44, Math.min(44, nextOffset)),
                radius: s.radius,
                flavor: s.flavor,
              });

              if (g.score >= 1200 && g.highestTierReached < 2) {
                g.highestTierReached = 2;
                setHud((p) => ({ ...p, tierBanner: 'GOLD CROWN UNLOCKED: 15% OFF 2ND SCOOP!' }));
                window.setTimeout(() => setHud((p) => ({ ...p, tierBanner: '' })), 2400);
              } else if (g.score >= 600 && g.highestTierReached < 1) {
                g.highestTierReached = 1;
                setHud((p) => ({ ...p, tierBanner: 'SILVER UNLOCKED: ₹15 OFF ANY SUNDAE!' }));
                window.setTimeout(() => setHud((p) => ({ ...p, tierBanner: '' })), 2400);
              }

              playTone(440 + Math.min(g.combo, 6) * 65, 'triangle', 0.16, 0.14);
              for (let i = 0; i < 16; i++) {
                const a = (Math.PI * 2 * i) / 16;
                g.particles.push({
                  x: targetX,
                  y: catchY,
                  vx: Math.cos(a) * 90,
                  vy: Math.sin(a) * 90 - 30,
                  life: 1,
                  size: 2.5,
                  color: i % 2 === 0 ? '#F6E27F' : '#FFFDF9',
                });
              }
              g.floatingTexts.push({ text: label, x: targetX, y: catchY - 26, vy: -55, life: 0.95, color: '#F6E27F' });
              g.fallingScoop = null;
              spawnSwingScoop(curW);
              syncHudFromState();
            }
          }

          if (g.fallingScoop && s.y > curH + 30) {
            g.fallingScoop = null;
            g.combo = 1;
            g.lives -= 1;
            playTone(170, 'sawtooth', 0.22, 0.1);
            g.floatingTexts.push({ text: 'MISSED!', x: s.x, y: curH - 70, vy: -45, life: 0.9, color: '#FDA4AF' });
            syncHudFromState();
            if (g.lives <= 0) {
              finishGame();
              return;
            }
            spawnSwingScoop(curW);
          }
        }

        g.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt * 1.6; });
        g.particles = g.particles.filter((p) => p.life > 0);
        g.floatingTexts.forEach((ft) => { ft.y += ft.vy * dt; ft.life -= dt * 1.1; });
        g.floatingTexts = g.floatingTexts.filter((ft) => ft.life > 0);
        g.ambientDust.forEach((d) => { d.y += d.speedY * dt; if (d.y < -10) { d.y = curH + 10; d.x = Math.random() * curW; } });

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const bg = ctx.createLinearGradient(0, 0, 0, curH);
          bg.addColorStop(0, '#1D0E23');
          bg.addColorStop(0.6, '#140918');
          bg.addColorStop(1, '#0E0511');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, curW, curH);

          g.ambientDust.forEach((d) => {
            ctx.fillStyle = `rgba(246, 226, 127, ${d.alpha})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
          });

          const coneScreenRimY = coneRimY + g.cameraY;
          const topItem = g.stack[g.stack.length - 1];
          const targetX = topItem ? g.coneX + topItem.offsetX : g.coneX;
          const targetScreenY = stackTopWorldY + g.cameraY;

          if (g.swingScoop) {
            ctx.save();
            ctx.strokeStyle = 'rgba(246, 226, 127, 0.25)';
            ctx.setLineDash([5, 6]);
            ctx.beginPath();
            ctx.moveTo(g.swingScoop.x, g.swingScoop.y + 24);
            ctx.lineTo(g.swingScoop.x, targetScreenY);
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = 'rgba(246, 226, 127, 0.72)';
          ctx.fillStyle = 'rgba(246, 226, 127, 0.14)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(targetX, targetScreenY, 28, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          drawCone(ctx, g.coneX, coneScreenRimY, g.coneWidth, g.coneHeight);
          g.stack.forEach((item, idx) => {
            const wy = coneRimY - g.scoopRadius * 0.68 - idx * g.stackStepY;
            drawScoop(ctx, g.coneX + item.offsetX, wy + g.cameraY, item.radius, item.flavor);
          });
          if (g.swingScoop) drawScoop(ctx, g.swingScoop.x, g.swingScoop.y, g.swingScoop.radius, g.swingScoop.flavor);
          if (g.fallingScoop) drawScoop(ctx, g.fallingScoop.x, g.fallingScoop.y, g.fallingScoop.radius, g.fallingScoop.flavor);

          g.particles.forEach((p) => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
          g.floatingTexts.forEach((ft) => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.life);
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
          });
        }

        g.rafId = window.requestAnimationFrame(tick);
      };

      g.lastFrameTime = performance.now();
      window.cancelAnimationFrame(g.rafId);
      g.rafId = window.requestAnimationFrame(tick);
    }, 30);
  };

  const handleCanvasTap = () => {
    const g = gameRef.current;
    if (!g.running || !g.swingScoop || g.fallingScoop) return;
    initAudio();
    g.firstDropDone = true;
    setHud((p) => ({ ...p, showTapHint: false, rulesOpen: false }));
    g.fallingScoop = { x: g.swingScoop.x, y: g.swingScoop.y, vy: 340, radius: g.swingScoop.radius, flavor: g.swingScoop.flavor };
    g.swingScoop = null;
    playTone(320, 'sine', 0.1, 0.08);
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    setClaimError('');
    const cleanPhone = claimPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setClaimError('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      setSubmitting(true);
      const tier = evaluateRewardTier(finalScore);
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          name: claimName,
          referralCode: claimRef,
          rewardLabel: tier.reward,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setSheetData(json.data);
        setActiveUserPhone(cleanPhone);
        setIncomingRefCode('');
        setScreen('vault');
        notify('Saved to Owner Google Sheet!');
      } else if (json.alreadyPlayedToday) {
        setClaimError(json.error);
        window.setTimeout(() => { setActiveUserPhone(cleanPhone); setScreen('vault'); }, 1100);
      } else {
        setClaimError(json.error || 'Could not claim coupon.');
      }
    } catch {
      setClaimError('Network error saving to Google Sheet.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCashierRedemption = async () => {
    setCashierError('');
    try {
      setSubmitting(true);
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: cashierCouponId, pin: staffPinInput.trim() }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setSheetData(json.data);
        setCashierCouponId(null);
        setStaffPinInput('');
        notify(json.message || 'Coupon redeemed in Google Sheet!');
      } else {
        setCashierError(json.error || 'Invalid PIN');
      }
    } catch {
      setCashierError('Failed to update Google Sheet');
    } finally {
      setSubmitting(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_pin: pinDraft,
          referral_reward_text: refRewardDraft,
          campaign_active: campaignActiveDraft,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setSheetData(json.data);
        notify('Owner Google Sheet settings updated');
      } else {
        notify(json.error || 'Could not save settings');
      }
    } catch {
      notify('Error saving settings');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCustomer = sheetData.Customers.find((c) => c.phone === activeUserPhone);
  const userCoupons = sheetData.Coupons.filter((c) => c.user_phone === activeUserPhone).slice().reverse();
  const activeCoupon = userCoupons.find((c) => c.status === 'UNLOCKED');
  const tierInfo = evaluateRewardTier(finalScore);
  const progressPct = Math.min(100, Math.round((hud.score / 1200) * 100));

  const getShareUrl = (code) => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set('ref', code);
    return url.toString();
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-5">
      <header className="w-full max-w-md flex items-center justify-between mb-4">
        <button onClick={() => { stopGame(); setScreen('landing'); }} className="flex items-center gap-2.5 text-left">
          <span className="text-2xl text-amber-300">♛</span>
          <div>
            <div className="font-display text-sm font-bold tracking-wider gold-text-gradient">SCOOP & WIN</div>
            <div className="text-[10px] text-amber-200/70 uppercase tracking-widest">Live Sheet Sync</div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="px-2.5 py-1.5 rounded-full border border-amber-400/30 bg-[#241229]/90 text-[11px] font-semibold text-amber-200"
          >
            {soundMuted ? 'Muted' : 'Chimes On'}
          </button>
          <button
            onClick={() => { setSheetModalOpen(true); fetchLiveSheet(true); }}
            className="px-3 py-1.5 rounded-full border border-amber-400/40 bg-[#241229]/90 text-[11px] font-semibold text-amber-200 flex items-center gap-1.5"
          >
            <span>{loadingSheet ? 'Syncing...' : 'Owner Sheet'}</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-md flex-1 flex flex-col">
        {!sheetData.Settings.campaign_active && (
          <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 text-center">
            Campaign is currently paused by store owner. Existing coupons can still be viewed & redeemed.
          </div>
        )}

        {screen === 'landing' && (
          <div className="space-y-4">
            {incomingRefCode && (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 text-center">
                VIP Friend Invitation: <span className="font-bold">{incomingRefCode}</span> — Play & redeem at the counter to unlock a bonus cone for your friend!
              </div>
            )}
            <div className="royal-card rounded-3xl p-6 text-center space-y-4">
              <div className="inline-block px-3 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                30-Second Royal Challenge
              </div>
              <h1 className="font-serif text-2xl font-bold leading-snug gold-text-gradient">
                Stack the Royal Cone & Win Instant Treats
              </h1>
              <p className="text-sm text-white/75 leading-relaxed">
                Every claim and counter redemption syncs live to the parlor owner&apos;s Google Sheet across any phone.
              </p>
              <button
                onClick={startGame}
                className="btn-gold w-full py-3.5 rounded-2xl font-display font-bold text-sm uppercase tracking-widest"
              >
                Play 30s Royal Challenge
              </button>
              <div className="pt-2 space-y-3">
                <button onClick={() => setLookupOpen((v) => !v)} className="text-xs text-amber-300 underline underline-offset-4">
                  Already played? View My Coupons & Referral Status
                </button>
                {lookupOpen && (
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      maxLength={10}
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="flex-1 rounded-xl bg-[#120815] border border-amber-400/40 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={async () => {
                        await fetchLiveSheet(true);
                        const clean = lookupPhone.replace(/\D/g, '');
                        if (clean.length === 10) {
                          setActiveUserPhone(clean);
                          setScreen('vault');
                        } else {
                          notify('Enter 10-digit number');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-300/50 text-xs font-bold text-amber-200"
                    >
                      Open Vault
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && (
          <div className="space-y-3">
            <div className="royal-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-display text-lg font-bold text-amber-300">{hud.timeLeft}s</div>
                  <div className="text-[10px] text-white/60 uppercase">{hud.phase}</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-lg font-bold">{hud.score.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-300 font-bold">{hud.combo}x Combo</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold">Lives: {hud.lives}/3</div>
                  <button
                    type="button"
                    onClick={() => setHud((p) => ({ ...p, rulesOpen: !p.rulesOpen }))}
                    className="text-[10px] uppercase font-bold text-amber-300 underline"
                  >
                    Scoring Rules
                  </button>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-[#120815] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-slate-200 to-amber-300 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div
              ref={wrapperRef}
              className="relative rounded-3xl overflow-hidden border border-amber-400/45 bg-[#120815]"
              style={{ height: '520px', maxHeight: '70vh' }}
              onPointerDown={handleCanvasTap}
            >
              <canvas ref={canvasRef} className="w-full h-full block" />
              {hud.tierBanner && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-full bg-amber-400 text-[#180D1B] text-[11px] font-bold whitespace-nowrap shadow-lg">
                  {hud.tierBanner}
                </div>
              )}
              {hud.rulesOpen && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 z-20 w-72 rounded-2xl bg-[#120815]/95 border border-amber-400/60 p-3.5 text-[11px] space-y-1.5"
                >
                  <div className="font-bold text-amber-300">Scoring & Tiers</div>
                  <div>Clean Center (≤28px): +100 × Combo (max 5x)</div>
                  <div>Off-Center (29–46px): +75 × Combo (-1x step)</div>
                  <div>Rainbow Bonus (Every 4th): +200 × Combo</div>
                  <div className="pt-1 text-white/70">
                    0–599 Bronze • 600–1199 Silver (₹15 Off) • 1200+ Gold (15% Off)
                  </div>
                </div>
              )}
              {hud.showTapHint && (
                <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                  <div className="px-4 py-1.5 rounded-full bg-[#180D1B]/80 border border-amber-400/40 text-xs font-semibold text-amber-200">
                    Tap Anywhere to Drop Scoop!
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'claim' && (
          <div className="royal-card rounded-3xl p-6 space-y-4 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Challenge Complete</div>
            <div className="font-display text-4xl font-bold gold-text-gradient">{finalScore.toLocaleString()}</div>
            <div className="rounded-2xl bg-[#120815]/80 border border-amber-400/30 p-3 space-y-1">
              <div className="text-xs font-bold text-amber-300">{tierInfo.badge}</div>
              <div className="text-sm font-semibold">{tierInfo.reward}</div>
            </div>
            <form onSubmit={handleClaimSubmit} className="space-y-3 text-left">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl bg-[#120815] border border-amber-400/40 px-3.5 py-3 text-sm"
              />
              <input
                type="text"
                maxLength={24}
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-xl bg-[#120815] border border-amber-400/30 px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                maxLength={6}
                value={claimRef}
                readOnly={Boolean(incomingRefCode)}
                onChange={(e) => setClaimRef(e.target.value.toUpperCase())}
                placeholder="Friend referral code (optional)"
                className="w-full uppercase rounded-xl bg-[#120815] border border-amber-400/30 px-3.5 py-2.5 text-sm text-amber-300 font-bold"
              />
              {claimError && <div className="text-xs text-rose-300">{claimError}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="btn-gold w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-widest disabled:opacity-60"
              >
                {submitting ? 'Saving to Google Sheet...' : 'Unlock My Royal Coupon'}
              </button>
            </form>
          </div>
        )}

        {screen === 'vault' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="text-xs text-white/80 font-semibold">
                {activeCustomer?.name ? `${activeCustomer.name} • ` : ''}+91 {activeUserPhone}
              </div>
              <button
                onClick={() => fetchLiveSheet(true).then(() => notify('Synced with Google Sheet'))}
                className="text-xs text-amber-300 underline"
              >
                Refresh Sheet
              </button>
            </div>

            {activeCoupon ? (
              <div className="live-coupon-frame">
                <div className="rounded-[1.25rem] bg-[#180D1B] p-5 text-center space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold">
                    <span>Active Counter Pass</span>
                    <span>{liveClock}</span>
                  </div>
                  <div className="font-serif text-xl font-bold gold-text-gradient">{activeCoupon.reward_label}</div>
                  <div className="text-xs font-mono text-white/70">{activeCoupon.coupon_id}</div>
                  <button
                    onClick={() => { setCashierCouponId(activeCoupon.coupon_id); setStaffPinInput(''); setCashierError(''); }}
                    className="btn-gold w-full mt-4 py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-widest"
                  >
                    Show to Cashier to Redeem
                  </button>
                </div>
              </div>
            ) : (
              <div className="royal-card rounded-2xl p-4 text-xs text-white/75 text-center leading-relaxed">
                No active coupon right now. Share your WhatsApp referral code below—when a referred friend redeems at the counter, your {sheetData.Settings.referral_reward_text} unlocks automatically!
              </div>
            )}

            <div className="royal-card rounded-3xl p-5 space-y-3 text-center">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Unlock {sheetData.Settings.referral_reward_text}
                </div>
                <div className="font-display text-2xl font-bold tracking-widest text-white">
                  {activeCustomer?.my_ref_code || '----'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    if (!activeCustomer) return;
                    const msg = `🍦 I won an ice cream reward! Play the 30s Royal Challenge with my link: ${getShareUrl(activeCustomer.my_ref_code)}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                  }}
                  className="py-3 px-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs uppercase"
                >
                  Share on WhatsApp
                </button>
                <button
                  onClick={() => {
                    if (!activeCustomer) return;
                    const link = getShareUrl(activeCustomer.my_ref_code);
                    const ta = document.createElement('textarea');
                    ta.value = link;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    notify('Copied referral link!');
                  }}
                  className="py-3 px-3 rounded-2xl bg-[#120815] border border-amber-400/40 text-amber-300 font-bold text-xs uppercase"
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div className="royal-card rounded-3xl p-4 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">My Rewards Ledger</div>
              {userCoupons.length === 0 ? (
                <div className="text-xs text-white/60">No coupons found for this number.</div>
              ) : (
                userCoupons.map((cp) => (
                  <div
                    key={cp.coupon_id}
                    className="flex items-center justify-between rounded-xl bg-[#120815]/80 border border-white/10 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold">{cp.reward_label}</div>
                      <div className="text-[10px] text-white/55">
                        {cp.coupon_id} • {cp.redeemed_at || cp.unlocked_at || 'Awaiting friend redemption'}
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-amber-300">
                      {cp.status === 'PENDING'
                        ? `PENDING (${cp.triggered_by_phone.slice(0, 2)}****${cp.triggered_by_phone.slice(-2)})`
                        : cp.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {cashierCouponId && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="royal-card w-full max-w-xs rounded-3xl p-5 space-y-4 text-center">
            <div className="text-sm font-bold text-amber-300">Cashier 4-Digit PIN</div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={staffPinInput}
              onChange={(e) => setStaffPinInput(e.target.value)}
              placeholder="• • • •"
              className="w-40 mx-auto block text-center tracking-[0.6em] font-display text-2xl font-bold rounded-2xl bg-[#120815] border border-amber-400/50 py-3 text-amber-300"
            />
            {cashierError && <div className="text-xs text-rose-300">{cashierError}</div>}
            <div className="flex gap-2">
              <button
                onClick={() => setCashierCouponId(null)}
                className="flex-1 py-3 rounded-2xl bg-[#120815] border border-white/15 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={confirmCashierRedemption}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl btn-gold text-xs font-bold disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="royal-card w-full max-w-md max-h-[85vh] rounded-3xl p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm font-bold text-amber-300">Owner Google Sheet (Live)</div>
              <button onClick={() => setSheetModalOpen(false)} className="text-sm px-2 py-1 rounded bg-[#120815]">
                ✕
              </button>
            </div>
            <div className="flex gap-1 border-b border-amber-400/20 text-xs font-semibold">
              {['Customers', 'Coupons', 'Settings'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSheetTab(t)}
                  className={`px-3 py-1.5 rounded-t-xl ${sheetTab === t ? 'bg-[#241229] text-amber-300 border-t border-x border-amber-400/40' : 'text-white/60'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {sheetTab === 'Customers' &&
                sheetData.Customers.map((c, idx) => (
                  <div key={c.phone || idx} className="rounded-xl bg-[#120815]/80 p-2.5 border border-white/10">
                    <div className="font-semibold">
                      {c.phone} ({c.name || 'Guest'})
                    </div>
                    <div className="text-white/60">
                      Code: {c.my_ref_code} • RefBy: {c.referred_by_phone || '—'}
                    </div>
                  </div>
                ))}
              {sheetTab === 'Coupons' &&
                sheetData.Coupons.map((cp) => (
                  <div key={cp.coupon_id} className="rounded-xl bg-[#120815]/80 p-2.5 border border-white/10">
                    <div className="font-semibold">
                      {cp.coupon_id} • {cp.user_phone}
                    </div>
                    <div className="text-white/70">
                      {cp.reward_label} — <span className="text-amber-300">{cp.status}</span>
                    </div>
                  </div>
                ))}
              {sheetTab === 'Settings' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-white/70 mb-1">4-Digit Staff PIN</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value)}
                      className="w-32 rounded-xl bg-[#120815] border border-amber-400/40 px-3 py-2 font-mono text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Referral Reward Label</label>
                    <input
                      type="text"
                      value={refRewardDraft}
                      onChange={(e) => setRefRewardDraft(e.target.value)}
                      className="w-full rounded-xl bg-[#120815] border border-amber-400/40 px-3 py-2"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={campaignActiveDraft}
                      onChange={(e) => setCampaignActiveDraft(e.target.checked)}
                    />
                    <span>Campaign Active</span>
                  </label>
                  <button
                    onClick={saveSettings}
                    disabled={submitting}
                    className="btn-gold w-full py-2.5 rounded-xl font-bold text-xs uppercase disabled:opacity-60"
                  >
                    Save to Sheet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-400 text-[#180D1B] text-xs font-bold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
