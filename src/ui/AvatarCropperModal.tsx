import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, RotateCcw, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';

interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (base64DataUrl: string) => void;
  title?: string;
  initialImage?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function normalizeImage(
  dataUrl: string,
  maxDimension = 600
): Promise<{ normalizedUrl: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth || img.width || 300;
      let h = img.naturalHeight || img.height || 300;

      // Downscale proportionally if larger than standard max dimension
      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const normalizedUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ normalizedUrl, width: w, height: h });
      } else {
        resolve({ normalizedUrl: dataUrl, width: w, height: h });
      }
    };
    img.onerror = () => {
      resolve({ normalizedUrl: dataUrl, width: 200, height: 200 });
    };
    img.src = dataUrl;
  });
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onClose,
  onCropComplete,
  title = 'Crop & Resize Avatar',
  initialImage,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imgDim, setImgDim] = useState<ImageDimensions>({ width: 200, height: 200 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isNormalizing, setIsNormalizing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const VIEWPORT_SIZE = 200;
  const OUTPUT_SIZE = 256;

  useEffect(() => {
    if (initialImage && isOpen) {
      setIsNormalizing(true);
      normalizeImage(initialImage).then(({ normalizedUrl, width, height }) => {
        setImageSrc(normalizedUrl);
        setImgDim({ width, height });
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setIsNormalizing(false);
      });
    }
  }, [initialImage, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsNormalizing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      const { normalizedUrl, width, height } = await normalizeImage(rawDataUrl);
      setImageSrc(normalizedUrl);
      setImgDim({ width, height });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsNormalizing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Base scale fits the normalized image within the 200px viewport circle at zoom = 1
  const maxDim = Math.max(imgDim.width, imgDim.height) || 200;
  const baseScale = VIEWPORT_SIZE / maxDim;

  const currentDisplayWidth = imgDim.width * baseScale * zoom;
  const currentDisplayHeight = imgDim.height * baseScale * zoom;

  const handleConfirmCrop = () => {
    if (!imageSrc || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale factor from 200px viewport to 256px output canvas
    const scale = OUTPUT_SIZE / VIEWPORT_SIZE;

    // Background circle clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Map exact display coordinates from viewport onto output canvas
    const destW = currentDisplayWidth * scale;
    const destH = currentDisplayHeight * scale;
    const destX = OUTPUT_SIZE / 2 + offset.x * scale - destW / 2;
    const destY = OUTPUT_SIZE / 2 + offset.y * scale - destH / 2;

    ctx.drawImage(imgRef.current, destX, destY, destW, destH);
    ctx.restore();

    const base64 = canvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(base64);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 shadow-2xl relative select-none">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          {title}
        </h3>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-4">
          Images are normalized to standard size. Drag to position and zoom out or in to frame your avatar.
        </p>

        {/* Viewport Frame */}
        <div
          className="relative w-[200px] h-[200px] mx-auto rounded-full overflow-hidden border-2 border-blue-500 bg-neutral-950 flex items-center justify-center cursor-move shadow-inner"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isNormalizing ? (
            <div className="text-center p-4 text-neutral-400 text-xs">
              <span>Optimizing image...</span>
            </div>
          ) : imageSrc ? (
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Avatar preview"
              draggable={false}
              className="pointer-events-none select-none"
              style={{
                width: `${currentDisplayWidth}px`,
                height: `${currentDisplayHeight}px`,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                maxWidth: 'none',
              }}
            />
          ) : (
            <div className="text-center p-4 text-neutral-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <span className="text-[10px]">No image selected</span>
            </div>
          )}
        </div>

        {/* Zoom & Adjustment Controls */}
        {imageSrc && !isNormalizing && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1 text-[11px]">
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Zoom Level</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.2, Number((prev - 0.2).toFixed(2))))}
                  title="Zoom Out"
                  className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono text-[10px] w-10 text-center">{zoom.toFixed(2)}x</span>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(4, Number((prev + 0.2).toFixed(2))))}
                  title="Zoom In"
                  className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.2"
                max="4"
                step="0.02"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                title="Reset zoom & position"
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* File Selector & Action Buttons */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1.5 px-3 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer border border-neutral-300 dark:border-neutral-700"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{imageSrc ? 'Change Image' : 'Select File'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={!imageSrc || isNormalizing}
            onClick={handleConfirmCrop}
            className="flex-1 py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
