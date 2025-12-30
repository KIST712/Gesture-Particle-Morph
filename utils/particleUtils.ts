import * as THREE from 'three';

/**
 * Generates particle positions and colors from text.
 */
export const generateTextParticles = (text: string, particleCount: number): { positions: Float32Array, colors: Float32Array } => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return { 
    positions: new Float32Array(particleCount * 3), 
    colors: new Float32Array(particleCount * 3) 
  };

  const fontSize = 120;
  ctx.font = `900 ${fontSize}px Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(fontSize * 1.5);

  canvas.width = textWidth + 60;
  canvas.height = textHeight;

  // Clear background (black)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Special drawing for "I ❤️ U" to guarantee Red Heart and White Text
  if (text === 'I ❤️ U') {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      // Draw "I" (White)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      ctx.fillText('I', cx - fontSize * 1.2, cy);

      // Draw "❤️" (Red)
      ctx.fillStyle = '#FF0000'; 
      // Try multiple emoji fonts
      ctx.font = `900 ${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText('❤️', cx, cy);

      // Draw "U" (White)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      ctx.fillText('U', cx + fontSize * 1.2, cy);
  } else {
      // Standard White Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const validPixels: number[] = [];
  const pixelColors: {r: number, g: number, b: number}[] = [];

  for (let i = 0; i < canvas.width * canvas.height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    // Threshold: if pixel has brightness
    if (r > 30 || g > 30 || b > 30) {
      validPixels.push(i);
      pixelColors.push({ r: r/255, g: g/255, b: b/255 });
    }
  }

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  if (validPixels.length === 0) {
    return generateCloudParticles(particleCount);
  }

  const targetWidth = 20; // World units width
  const scale = targetWidth / canvas.width;

  for (let i = 0; i < particleCount; i++) {
    const sampleIdx = Math.floor(Math.random() * validPixels.length);
    const pixelIndex = validPixels[sampleIdx];
    const colorData = pixelColors[sampleIdx];

    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);

    const px = (x - canvas.width / 2) * scale;
    const py = -(y - canvas.height / 2) * scale;
    const pz = 0;

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    colors[i * 3] = colorData.r;
    colors[i * 3 + 1] = colorData.g;
    colors[i * 3 + 2] = colorData.b;
  }

  return { positions, colors };
};

export const generateCloudParticles = (particleCount: number): { positions: Float32Array, colors: Float32Array } => {
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    // Sphere distribution
    const r = 10 * Math.cbrt(Math.random()); 
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Dim idle color (dark grey/blueish)
    colors[i * 3] = 0.1;
    colors[i * 3 + 1] = 0.15;
    colors[i * 3 + 2] = 0.2;
  }
  return { positions, colors };
};