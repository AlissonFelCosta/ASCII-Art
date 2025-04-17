// ---------------- Global Variables ----------------
let currentImage = null;
const baseFontSize = 7; // Base font size for ASCII art

// ---------------- Helper Functions ----------------

// Clamp a value between min and max.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Generate a normalized 2D Gaussian kernel.
function gaussianKernel2D(sigma, kernelSize) {
  const kernel = [];
  const half = Math.floor(kernelSize / 2);
  let sum = 0;
  for (let y = -half; y <= half; y++) {
    const row = [];
    for (let x = -half; x <= half; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(value);
      sum += value;
    }
    kernel.push(row);
  }
  // Normalize the kernel.
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      kernel[y][x] /= sum;
    }
  }
  return kernel;
}

// Convolve a 2D image (array) with a 2D kernel.
function convolve2D(img, kernel) {
  const height = img.length,
        width = img[0].length;
  const kernelSize = kernel.length,
        half = Math.floor(kernelSize / 2);
  const output = [];
  for (let y = 0; y < height; y++) {
    output[y] = [];
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const yy = y + ky - half;
          const xx = x + kx - half;
          let pixel = (yy >= 0 && yy < height && xx >= 0 && xx < width) ? img[yy][xx] : 0;
          sum += pixel * kernel[ky][kx];
        }
      }
      output[y][x] = sum;
    }
  }
  return output;
}

// Compute the Difference of Gaussians on a 2D grayscale image.
function differenceOfGaussians2D(gray, sigma1, sigma2, kernelSize) {
  const kernel1 = gaussianKernel2D(sigma1, kernelSize);
  const kernel2 = gaussianKernel2D(sigma2, kernelSize);
  const blurred1 = convolve2D(gray, kernel1);
  const blurred2 = convolve2D(gray, kernel2);
  const height = gray.length,
        width = gray[0].length;
  const dog = [];
  for (let y = 0; y < height; y++) {
    dog[y] = [];
    for (let x = 0; x < width; x++) {
      dog[y][x] = blurred1[y][x] - blurred2[y][x];
    }
  }
  return dog;
}

// Apply the Sobel operator to a 2D image, returning gradient magnitude and angle arrays.
function applySobel2D(img, width, height) {
  const mag = [],
        angle = [];
  for (let y = 0; y < height; y++) {
    mag[y] = [];
    angle[y] = [];
    for (let x = 0; x < width; x++) {
      mag[y][x] = 0;
      angle[y][x] = 0;
    }
  }
  const kernelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const kernelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let Gx = 0, Gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = img[y + ky][x + kx];
          Gx += pixel * kernelX[ky + 1][kx + 1];
          Gy += pixel * kernelY[ky + 1][kx + 1];
        }
      }
      const g = Math.sqrt(Gx * Gx + Gy * Gy);
      mag[y][x] = g;
      let theta = Math.atan2(Gy, Gx) * (180 / Math.PI);
      if (theta < 0) theta += 180;
      angle[y][x] = theta;
    }
  }
  return { mag, angle };
}

// Non-maximum suppression to thin out the edges.
function nonMaxSuppression(mag, angle, width, height) {
  const suppressed = [];
  for (let y = 0; y < height; y++) {
    suppressed[y] = [];
    for (let x = 0; x < width; x++) {
      suppressed[y][x] = 0;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const currentMag = mag[y][x];
      let neighbor1 = 0, neighbor2 = 0;
      const theta = angle[y][x];
      if ((theta >= 0 && theta < 22.5) || (theta >= 157.5 && theta <= 180)) {
        // 0° direction: compare left and right.
        neighbor1 = mag[y][x - 1];
        neighbor2 = mag[y][x + 1];
      } else if (theta >= 22.5 && theta < 67.5) {
        // 45° direction: compare top-right and bottom-left.
        neighbor1 = mag[y - 1][x + 1];
        neighbor2 = mag[y + 1][x - 1];
      } else if (theta >= 67.5 && theta < 112.5) {
        // 90° direction: compare top and bottom.
        neighbor1 = mag[y - 1][x];
        neighbor2 = mag[y + 1][x];
      } else if (theta >= 112.5 && theta < 157.5) {
        // 135° direction: compare top-left and bottom-right.
        neighbor1 = mag[y - 1][x - 1];
        neighbor2 = mag[y + 1][x + 1];
      }
      suppressed[y][x] = (currentMag >= neighbor1 && currentMag >= neighbor2) ? currentMag : 0;
    }
  }
  return suppressed;
}

// ---------------- ASCII Art Generation Functions ----------------

// Generate standard ASCII art (non-DOG modes).
function generateASCII(img) {
  const edgeMethod = document.querySelector('input[name="edgeMethod"]:checked').value;
  if (edgeMethod === 'dog') {
    generateContourASCII(img);
    return;
  }
  
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const asciiWidth = parseInt(document.getElementById('asciiWidth').value, 10);
  const brightness = parseFloat(document.getElementById('brightness').value);
  const contrastValue = parseFloat(document.getElementById('contrast').value);
  const blurValue = parseFloat(document.getElementById('blur').value);
  const ditheringEnabled = document.getElementById('dithering').checked;
  const ditherAlgorithm = document.getElementById('ditherAlgorithm').value;
  const invertEnabled = document.getElementById('invert').checked;
  const ignoreWhite = document.getElementById('ignoreWhite').checked;
  const charset = document.getElementById('charset').value;
  
  let gradient;
  switch (charset) {
    case 'standard': gradient = "@%#*+=-:."; break;
    case 'blocks': gradient = "█▓▒░ "; break;
    case 'binary': gradient = "01"; break;
    case 'manual':
      const manualChar = document.getElementById('manualCharInput').value || "0";
      gradient = manualChar + " ";
      break;
    case 'hex': gradient = "0123456789ABCDEF"; break;
    case 'detailed':
    default: gradient = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'.";
      break;
  }
  
  const nLevels = gradient.length;
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const fontAspectRatio = 0.55;
  const asciiHeight = Math.round((img.height / img.width) * asciiWidth * fontAspectRatio);
  
  canvas.width = asciiWidth;
  canvas.height = asciiHeight;
  ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : "none";
  ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);
  
  const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
  const data = imageData.data;
  let gray = [], grayOriginal = [];
  for (let i = 0; i < data.length; i += 4) {
    let lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    if (invertEnabled) lum = 255 - lum;
    let adjusted = clamp(contrastFactor * (lum - 128) + 128 + brightness, 0, 255);
    gray.push(adjusted);
    grayOriginal.push(adjusted);
  }
  
  let ascii = "";
  if (document.querySelector('input[name="edgeMethod"]:checked').value === 'sobel') {
    const threshold = parseInt(document.getElementById('edgeThreshold').value, 10);
    gray = applyEdgeDetection(gray, asciiWidth, asciiHeight, threshold);
    for (let y = 0; y < asciiHeight; y++) {
      let line = "";
      for (let x = 0; x < asciiWidth; x++) {
        const idx = y * asciiWidth + x;
        if (ignoreWhite && grayOriginal[idx] === 255) {
          line += " ";
          continue;
        }
        const computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
        line += gradient.charAt(computedLevel);
      }
      ascii += line + "\n";
    }
  } else if (ditheringEnabled) {
    if (ditherAlgorithm === 'floyd') {
      // Floyd–Steinberg dithering
      for (let y = 0; y < asciiHeight; y++) {
        let line = "";
        for (let x = 0; x < asciiWidth; x++) {
          const idx = y * asciiWidth + x;
          if (ignoreWhite && grayOriginal[idx] === 255) { line += " "; continue; }
          let computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
          line += gradient.charAt(computedLevel);
          const newPixel = (computedLevel / (nLevels - 1)) * 255;
          const error = gray[idx] - newPixel;
          if (x + 1 < asciiWidth) { 
            gray[idx + 1] = clamp(gray[idx + 1] + error * (7 / 16), 0, 255); 
          }
          if (x - 1 >= 0 && y + 1 < asciiHeight) { 
            gray[idx - 1 + asciiWidth] = clamp(gray[idx - 1 + asciiWidth] + error * (3 / 16), 0, 255); 
          }
          if (y + 1 < asciiHeight) { 
            gray[idx + asciiWidth] = clamp(gray[idx + asciiWidth] + error * (5 / 16), 0, 255); 
          }
          if (x + 1 < asciiWidth && y + 1 < asciiHeight) { 
            gray[idx + asciiWidth + 1] = clamp(gray[idx + asciiWidth + 1] + error * (1 / 16), 0, 255); 
          }
        }
        ascii += line + "\n";
      }
    } else if (ditherAlgorithm === 'atkinson') {
      // Atkinson dithering
      for (let y = 0; y < asciiHeight; y++) {
        let line = "";
        for (let x = 0; x < asciiWidth; x++) {
          const idx = y * asciiWidth + x;
          if (ignoreWhite && grayOriginal[idx] === 255) { line += " "; continue; }
          let computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
          line += gradient.charAt(computedLevel);
          const newPixel = (computedLevel / (nLevels - 1)) * 255;
          const error = gray[idx] - newPixel;
          const diffusion = error / 8;
          if (x + 1 < asciiWidth) { 
            gray[idx + 1] = clamp(gray[idx + 1] + diffusion, 0, 255); 
          }
          if (x + 2 < asciiWidth) { 
            gray[idx + 2] = clamp(gray[idx + 2] + diffusion, 0, 255); 
          }
          if (y + 1 < asciiHeight) {
            if (x - 1 >= 0) { 
              gray[idx - 1 + asciiWidth] = clamp(gray[idx - 1 + asciiWidth] + diffusion, 0, 255); 
            }
            gray[idx + asciiWidth] = clamp(gray[idx + asciiWidth] + diffusion, 0, 255);
            if (x + 1 < asciiWidth) { 
              gray[idx + asciiWidth + 1] = clamp(gray[idx + asciiWidth + 1] + diffusion, 0, 255); 
            }
          }
          if (y + 2 < asciiHeight) { 
            gray[idx + 2 * asciiWidth] = clamp(gray[idx + 2 * asciiWidth] + diffusion, 0, 255); 
          }
        }
        ascii += line + "\n";
      }
    } else if (ditherAlgorithm === 'noise') {
      // Noise dithering
      for (let y = 0; y < asciiHeight; y++) {
        let line = "";
        for (let x = 0; x < asciiWidth; x++) {
          const idx = y * asciiWidth + x;
          if (ignoreWhite && grayOriginal[idx] === 255) { line += " "; continue; }
          const noise = (Math.random() - 0.5) * (255 / nLevels);
          const noisyValue = clamp(gray[idx] + noise, 0, 255);
          let computedLevel = Math.round((noisyValue / 255) * (nLevels - 1));
          line += gradient.charAt(computedLevel);
        }
        ascii += line + "\n";
      }
    } else if (ditherAlgorithm === 'ordered') {
      // Ordered dithering using a 4x4 Bayer matrix.
      const bayer = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ];
      const matrixSize = 4;
      for (let y = 0; y < asciiHeight; y++) {
        let line = "";
        for (let x = 0; x < asciiWidth; x++) {
          const idx = y * asciiWidth + x;
          if (ignoreWhite && grayOriginal[idx] === 255) { line += " "; continue; }
          const p = gray[idx] / 255;
          const t = (bayer[y % matrixSize][x % matrixSize] + 0.5) / (matrixSize * matrixSize);
          let valueWithDither = p + t - 0.5;
          valueWithDither = Math.min(Math.max(valueWithDither, 0), 1);
          let computedLevel = Math.floor(valueWithDither * nLevels);
          if (computedLevel >= nLevels) computedLevel = nLevels - 1;
          line += gradient.charAt(computedLevel);
        }
        ascii += line + "\n";
      }
    }
  } else {
    // Simple mapping without dithering.
    for (let y = 0; y < asciiHeight; y++) {
      let line = "";
      for (let x = 0; x < asciiWidth; x++) {
        const idx = y * asciiWidth + x;
        if (ignoreWhite && grayOriginal[idx] === 255) { line += " "; continue; }
        const computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
        line += gradient.charAt(computedLevel);
      }
      ascii += line + "\n";
    }
  }
  document.getElementById('ascii-art').textContent = ascii;
}

// Apply simple Sobel edge detection on a 1D grayscale array.
function applyEdgeDetection(gray, width, height, threshold) {
  let edges = new Array(width * height).fill(255);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let idx = y * width + x;
      let a = gray[(y - 1) * width + (x - 1)];
      let b = gray[(y - 1) * width + x];
      let c = gray[(y - 1) * width + (x + 1)];
      let d = gray[y * width + (x - 1)];
      let e = gray[y * width + x];
      let f = gray[y * width + (x + 1)];
      let g = gray[(y + 1) * width + (x - 1)];
      let h = gray[(y + 1) * width + x];
      let i = gray[(y + 1) * width + (x + 1)];
      let Gx = (-1 * a) + (0 * b) + (1 * c) +
               (-2 * d) + (0 * e) + (2 * f) +
               (-1 * g) + (0 * h) + (1 * i);
      let Gy = (-1 * a) + (-2 * b) + (-1 * c) +
               (0 * d) + (0 * e) + (0 * f) +
               (1 * g) + (2 * h) + (1 * i);
      let magVal = Math.sqrt(Gx * Gx + Gy * Gy);
      let normalized = (magVal / 1442) * 255;
      edges[idx] = normalized > threshold ? 0 : 255;
    }
  }
  return edges;
}

// Generate contour-based ASCII art using DoG and Sobel with non-maximum suppression.
// Now basic adjustments (brightness, contrast, blur, invert) are also applied.
function generateContourASCII(img) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const asciiWidth = parseInt(document.getElementById('asciiWidth').value, 10);
  const brightness = parseFloat(document.getElementById('brightness').value);
  const contrastValue = parseFloat(document.getElementById('contrast').value);
  const blurValue = parseFloat(document.getElementById('blur').value);
  const invertEnabled = document.getElementById('invert').checked;
  const fontAspectRatio = 0.55;
  const asciiHeight = Math.round((img.height / img.width) * asciiWidth * fontAspectRatio);
  canvas.width = asciiWidth;
  canvas.height = asciiHeight;
  // Use blur filter if applicable.
  ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : "none";
  ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);
  
  const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
  const data = imageData.data;
  let gray2d = [];
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  for (let y = 0; y < asciiHeight; y++) {
    gray2d[y] = [];
    for (let x = 0; x < asciiWidth; x++) {
      const idx = (y * asciiWidth + x) * 4;
      let lum = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (invertEnabled) lum = 255 - lum;
      lum = clamp(contrastFactor * (lum - 128) + 128 + brightness, 0, 255);
      gray2d[y][x] = lum;
    }
  }
  
  const sigma1 = 0.5, sigma2 = 1.0, kernelSize = 3;
  const dog = differenceOfGaussians2D(gray2d, sigma1, sigma2, kernelSize);
  const { mag, angle } = applySobel2D(dog, asciiWidth, asciiHeight);
  const suppressedMag = nonMaxSuppression(mag, angle, asciiWidth, asciiHeight);
  const threshold = parseInt(document.getElementById('dogEdgeThreshold').value, 10);
  
  let ascii = "";
  for (let y = 0; y < asciiHeight; y++) {
    let line = "";
    for (let x = 0; x < asciiWidth; x++) {
      if (suppressedMag[y][x] > threshold) {
        let adjustedAngle = (angle[y][x] + 90) % 180;
        let edgeChar = (adjustedAngle < 22.5 || adjustedAngle >= 157.5) ? "-" :
                       (adjustedAngle < 67.5) ? "/" :
                       (adjustedAngle < 112.5) ? "|" : "\\";
        line += edgeChar;
      } else {
        line += " ";
      }
    }
    ascii += line + "\n";
  }
  document.getElementById('ascii-art').textContent = ascii;
}

// ---------------- Download Function ----------------

function downloadPNG() {
  const preElement = document.getElementById('ascii-art');
  const asciiText = preElement.textContent;
  if (!asciiText.trim()) {
    alert("No ASCII art to download.");
    return;
  }
  
  // Split the ASCII art into lines.
  const lines = asciiText.split("\n");
  
  // Set a scaling factor (2x resolution for better quality).
  const scaleFactor = 2;
  
  // Define the border margin (in final pixels, then scaled)
  const borderMargin = 20 * scaleFactor;
  
  // Get computed style values from the pre element.
  const computedStyle = window.getComputedStyle(preElement);
  const baseFontSize = parseInt(computedStyle.fontSize, 10);
  const fontSize = baseFontSize * scaleFactor;
  
  // Create a temporary canvas to measure text dimensions.
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;
  
  // Determine the maximum line width.
  let maxLineWidth = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineWidth = tempCtx.measureText(lines[i]).width;
    if (lineWidth > maxLineWidth) {
      maxLineWidth = lineWidth;
    }
  }
  
  // Calculate the required text dimensions.
  const lineHeight = fontSize; // Basic line height.
  const textWidth = Math.ceil(maxLineWidth);
  const textHeight = Math.ceil(lines.length * lineHeight);
  
  // Create an offscreen canvas with extra space for the border margin.
  const canvasWidth = textWidth + 2 * borderMargin;
  const canvasHeight = textHeight + 2 * borderMargin;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = canvasWidth;
  offCanvas.height = canvasHeight;
  const offCtx = offCanvas.getContext('2d');
  
  // Fill the background based on the current theme.
  const bgColor = document.body.classList.contains('light-mode') ? "#fff" : "#000";
  offCtx.fillStyle = bgColor;
  offCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Set the font and text styles.
  offCtx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;
  offCtx.textBaseline = 'top';
  offCtx.fillStyle = document.body.classList.contains('light-mode') ? "#000" : "#eee";
  
  // Draw each line of the ASCII art onto the canvas with the margin offset.
  for (let i = 0; i < lines.length; i++) {
    offCtx.fillText(lines[i], borderMargin, borderMargin + i * lineHeight);
  }
  
  // Convert the canvas content to a blob and trigger a download.
  offCanvas.toBlob(function(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ascii_art.png';
    a.click();
  });
}

// ---------------- Event Listeners ----------------

// File upload event.
document.getElementById('upload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      currentImage = img;
      generateASCII(img);
    };
    img.src = event.target.result;
    document.getElementById('imagePreview').src = event.target.result;
    document.getElementById('imagePreview').style.display = "block";

  };
  reader.readAsDataURL(file);
});

// Update controls when changed.
document.getElementById('asciiWidth').addEventListener('input', updateSettings);
document.getElementById('brightness').addEventListener('input', updateSettings);
document.getElementById('contrast').addEventListener('input', updateSettings);
document.getElementById('blur').addEventListener('input', updateSettings);
document.getElementById('dithering').addEventListener('change', updateSettings);
document.getElementById('ditherAlgorithm').addEventListener('change', updateSettings);
document.getElementById('invert').addEventListener('change', updateSettings);
document.getElementById('ignoreWhite').addEventListener('change', updateSettings);
document.getElementById('theme').addEventListener('change', updateSettings);
document.getElementById('charset').addEventListener('change', function() {
  const manualControl = document.getElementById('manualCharControl');
  manualControl.style.display = (this.value === 'manual') ? 'flex' : 'none';
  updateSettings();
});
document.getElementById('zoom').addEventListener('input', updateSettings);

// Edge detection radio buttons.
document.querySelectorAll('input[name="edgeMethod"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    const method = document.querySelector('input[name="edgeMethod"]:checked').value;
    document.getElementById('sobelThresholdControl').style.display = (method === 'sobel') ? 'flex' : 'none';
    document.getElementById('dogThresholdControl').style.display = (method === 'dog') ? 'flex' : 'none';
    // Basic adjustments remain enabled in all modes.
    updateSettings();
  });
});
document.getElementById('edgeThreshold').addEventListener('input', updateSettings);
document.getElementById('dogEdgeThreshold').addEventListener('input', updateSettings);

// Reset and Copy buttons.
document.getElementById('reset').addEventListener('click', resetSettings);
document.getElementById('copyBtn').addEventListener('click', function() {
  const asciiText = document.getElementById('ascii-art').textContent;
  navigator.clipboard.writeText(asciiText).then(() => {
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  }, () => {
    alert('Copy failed!');
  });
});
document.getElementById('downloadBtn').addEventListener('click', downloadPNG);

// ---------------- Update and Reset Functions ----------------

function updateSettings() {
  document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
  document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
  document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
  document.getElementById('blurVal').textContent = document.getElementById('blur').value;
  document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
  document.getElementById('edgeThresholdVal').textContent = document.getElementById('edgeThreshold').value;
  document.getElementById('dogEdgeThresholdVal').textContent = document.getElementById('dogEdgeThreshold').value;
  
  // Update theme.
  const theme = document.getElementById('theme').value;
  document.body.classList.toggle('light-mode', theme === 'light');
  
  // Adjust ASCII art font size based on zoom.
  const zoomPercent = parseInt(document.getElementById('zoom').value, 10);
  const newFontSize = (baseFontSize * zoomPercent) / 100;
  const asciiArt = document.getElementById('ascii-art');
  asciiArt.style.fontSize = newFontSize + "px";
  asciiArt.style.lineHeight = newFontSize + "px";
  
  if (currentImage) {
    generateASCII(currentImage);
  }
}

function resetSettings() {
  document.getElementById('asciiWidth').value = 100;
  document.getElementById('brightness').value = 0;
  document.getElementById('contrast').value = 0;
  document.getElementById('blur').value = 0;
  document.getElementById('dithering').checked = true;
  document.getElementById('ditherAlgorithm').value = 'floyd';
  document.getElementById('invert').checked = false;
  document.getElementById('ignoreWhite').checked = true;
  document.getElementById('charset').value = 'detailed';
  document.getElementById('zoom').value = 100;
  document.getElementById('edgeNone').checked = true;
  document.getElementById('edgeThreshold').value = 100;
  document.getElementById('dogEdgeThreshold').value = 100;
  document.getElementById('sobelThresholdControl').style.display = 'none';
  document.getElementById('dogThresholdControl').style.display = 'none';
  // Re-enable basic adjustments.
  document.getElementById('brightness').disabled = false;
  document.getElementById('contrast').disabled = false;
  document.getElementById('blur').disabled = false;
  document.getElementById('invert').disabled = false;
  updateSettings();
}

window.addEventListener('load', function() {
  const defaultImg = new Image();
  defaultImg.crossOrigin = "Anonymous"; 
  defaultImg.src = "data:image/jpeg;base64,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";
  defaultImg.onload = function() {
    currentImage = defaultImg;
    generateASCII(defaultImg);
  };
});
