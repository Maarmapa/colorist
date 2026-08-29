// sRGB → CIELAB, que es el espacio donde CIEDE2000 sabe medir.
//
// Los hex de las cartas de color son sRGB (es lo que muestra una pantalla).
// CIEDE2000 no opera sobre sRGB: necesita Lab, que es aproximadamente
// perceptual. La conversión pasa por XYZ y no es opcional ni aproximable —
// saltarse la linealización (el paso gamma) es el error clásico, y produce
// distancias que parecen razonables pero ordenan mal los candidatos justo en
// los tonos oscuros, que es donde vive la mitad de una paleta de sombras.
//
// Iluminante D65, observador 2°: es la condición de referencia de sRGB y la
// que corresponde para swatches mirados en pantalla o a la luz del día.

import type { Lab } from './ciede2000.ts';

export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

/** Blanco de referencia D65, observador 2°. */
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

/**
 * Parsea un hex a RGB. Devuelve null si no es un hex válido — nunca un color
 * por defecto: un tono que no se puede parsear se reporta como sin mapear, no
 * se pinta de negro y se hace pasar por dato.
 */
export function parseHex(hex: string): RGB | null {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const crudo = m?.[1];
  if (!crudo) return null;
  const h = crudo.length === 3 ? crudo.replace(/./g, (c) => c + c) : crudo;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Deshace la codificación gamma de sRGB. Este es el paso que todos se saltan. */
function linearize(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToXyz({ r, g, b }: RGB): { X: number; Y: number; Z: number } {
  const R = linearize(r) * 100;
  const G = linearize(g) * 100;
  const B = linearize(b) * 100;
  return {
    X: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    Y: R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    Z: R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  };
}

const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

/** El tramo lineal cerca del negro evita que la raíz cúbica explote ahí. */
const f = (t: number) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

export function xyzToLab({ X, Y, Z }: { X: number; Y: number; Z: number }): Lab {
  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb: RGB): Lab {
  return xyzToLab(rgbToXyz(rgb));
}

/** hex → Lab. null si el hex no es válido. */
export function hexToLab(hex: string): Lab | null {
  const rgb = parseHex(hex);
  return rgb ? rgbToLab(rgb) : null;
}

/** Luminancia relativa (WCAG), para decidir si el texto encima del swatch va negro o blanco. */
export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Color de texto legible sobre un fondo dado. Accesibilidad, no estética. */
export function readableInk(hex: string): '#000000' | '#ffffff' {
  const rgb = parseHex(hex);
  if (!rgb) return '#000000';
  return relativeLuminance(rgb) > 0.179 ? '#000000' : '#ffffff';
}
