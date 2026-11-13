#!/usr/bin/env python3
"""
Generates the reminder sounds in media/. Every sound is synthesised here, so
there is nothing to license. Run:  python3 tools/make-sounds.py
Needs numpy and scipy.

Five styles, each with an "in" (arriving: rises) and an "out" (leaving: falls):
  modern   soft glassy two-note chime with a short tail
  elegant  gentle four-note strum, like a celesta or harp
  warm     two notes on a wooden marimba                  (default)
  water    two water droplets
  minimal  one soft, short tap
"""
import os, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media')

def axis(dur): return np.arange(int(dur * SR)) / SR

def env(dur, attack, tau, release=0.04):
    """Smooth (raised-cosine) attack, exponential decay, smooth end. No clicks."""
    t = axis(dur)
    a = 0.5 - 0.5 * np.cos(np.pi * np.clip(t / attack, 0, 1))
    r = 0.5 - 0.5 * np.cos(np.pi * np.clip((dur - t) / release, 0, 1))
    return a * np.exp(-t / tau) * r

def tone(freq, dur, parts, attack):
    """parts: (frequency ratio, level, decay seconds, detune in cents)."""
    t = axis(dur)
    out = np.zeros_like(t)
    for ratio, amp, tau, cents in parts:
        out += amp * env(dur, attack, tau) * np.sin(2 * np.pi * freq * ratio * 2 ** (cents / 1200) * t)
    return out

def chirp(f0, f1, dur, glide, attack, tau):
    """A tone whose pitch slides quickly from f0 to f1 (a droplet)."""
    t = axis(dur)
    f = f1 - (f1 - f0) * np.exp(-t / glide)
    return env(dur, attack, tau) * np.sin(2 * np.pi * np.cumsum(f) / SR)

def lowpass(x, fc, order=2):
    return sosfilt(butter(order, fc, fs=SR, output='sos'), x)

def click(dur, fc, amp):
    """The tiny soft 'tick' of a mallet touching a bar."""
    n = rng.standard_normal(int(dur * SR))
    return amp * lowpass(n * np.hanning(len(n)), fc)

def mixdown(total, events):
    buf = np.zeros(int(total * SR))
    for at, sig in events:
        i = int(at * SR)
        sig = sig[: len(buf) - i]
        buf[i : i + len(sig)] += sig
    return buf

def reverb(x, mix, decay, fc=3500, predelay=0.012):
    """A small, dark room: gives the dry tones a soft tail."""
    n = int(decay * 5 * SR)
    ir = lowpass(rng.standard_normal(n) * np.exp(-np.arange(n) / SR / decay), fc)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    wet = np.concatenate([np.zeros(int(predelay * SR)), wet])[: len(x)]
    return x + mix * wet

def loudness(x, win=0.1):
    """Loudest 100 ms, as RMS. Used to make the styles equally loud."""
    n = int(win * SR)
    c = np.cumsum(np.concatenate([[0.0], x ** 2]))
    return float(np.sqrt(np.max(c[n:] - c[:-n]) / n))

def save(name, x, target=0.14, max_peak=0.6):
    x = x - np.mean(x)
    fade = int(0.06 * SR)
    x[-fade:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade))
    x *= min(target / loudness(x), max_peak / np.max(np.abs(x)))
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    print(f'{name:12s} {len(x)/SR:4.2f}s  peak {np.max(np.abs(x)):.2f}  loudness {loudness(x):.3f}  {os.path.getsize(path)//1024} KB')

# ---- modern: soft glass chime. A second, quieter, slightly detuned sine adds a calm shimmer. ----
GLASS = [(1, 0.72, 0.30, -1.5), (1, 0.28, 0.30, 2.5), (2, 0.20, 0.14, 0), (3, 0.05, 0.08, 0)]
def modern(notes):
    dry = mixdown(1.3, [(i * 0.13, tone(f, 0.95, GLASS, 0.012) * (1.0 if i == 0 else 0.92)) for i, f in enumerate(notes)])
    return lowpass(reverb(dry, 0.28, 0.22), 6500)
save('modern-in', modern([587.33, 880.00]))   # D5 up to A5
save('modern-out', modern([880.00, 587.33]))

# ---- elegant: a quiet strummed chord (G major), long gentle tail. -------------------------------
CELESTA = [(1, 1.0, 0.45, 0), (2, 0.28, 0.20, 0), (3, 0.10, 0.10, 0), (4.2, 0.04, 0.05, 0)]
def elegant(notes):
    dry = mixdown(1.7, [(i * 0.055, tone(f, 1.25, CELESTA, 0.005) * (0.8 + 0.07 * i)) for i, f in enumerate(notes)])
    return lowpass(reverb(dry, 0.4, 0.36), 7000)
CHORD = [392.00, 587.33, 783.99, 987.77]      # G4 D5 G5 B5
save('elegant-in', elegant(CHORD))
save('elegant-out', elegant(CHORD[::-1]))

# ---- warm: marimba. A wooden bar rings at 1x and 4x its pitch; the 4x part dies quickly. --------
BAR = [(1, 1.0, 0.17, 0), (4, 0.30, 0.05, 0), (9.2, 0.06, 0.02, 0)]
def warm(notes):
    ev = []
    for i, f in enumerate(notes):
        ev += [(i * 0.14, tone(f, 0.6, BAR, 0.003)), (i * 0.14, click(0.006, 2500, 0.15))]
    return reverb(mixdown(0.95, ev), 0.14, 0.14)
save('warm-in', warm([392.00, 523.25]))       # G4 up to C5
save('warm-out', warm([523.25, 392.00]))

# ---- water: droplets. Each is a fast pitch slide with a short ring. -----------------------------
def drop(f0, f1):
    return mixdown(0.24, [(0, chirp(f0, f1, 0.24, 0.020, 0.002, 0.05)), (0, 0.25 * chirp(f0 * 1.5, f1 * 1.5, 0.16, 0.015, 0.002, 0.03))])
def water(pairs):
    dry = mixdown(0.95, [(i * 0.15, drop(a, b) * (1.0 if i == 0 else 0.9)) for i, (a, b) in enumerate(pairs)])
    return reverb(dry, 0.32, 0.24, fc=5000)
save('water-in', water([(480, 1050), (640, 1400)]))
save('water-out', water([(1400, 640), (1050, 480)]))

# ---- minimal: one soft tap. For people who want barely any sound. -------------------------------
def minimal(f):
    tap = tone(f, 0.26, [(1, 1.0, 0.04, 0), (2.4, 0.22, 0.018, 0)], 0.0015)
    return reverb(mixdown(0.42, [(0, tap), (0, click(0.004, 3000, 0.1))]), 0.1, 0.09)
save('minimal-in', minimal(932.33), max_peak=0.7)    # A#5
save('minimal-out', minimal(622.25), max_peak=0.7)   # D#5
