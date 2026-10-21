import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, RotateCcw, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';

interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (base64DataUrl: string) => void;
  title?: string;
  initialImage?: string;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onClose,
  onCropComplete,
  title = 'Crop & Resize Avatar',
  initialImage,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (initialImage) {
      setImageSrc(initialImage);
    }
  }, [initialImage]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target?.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
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

  const handleConfirmCrop = () => {
    if (!imageSrc || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const OUTPUT_SIZE = 256;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport is 200x200 px
    const VIEWPORT_SIZE = 200;
    const img = imgRef.current;

    // Background circle clip
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Scale factor from viewport to output canvas
    const scale = OUTPUT_SIZE / VIEWPORT_SIZE;

    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.scale(scale * zoom, scale * zoom);
    ctx.translate(-img.naturalWidth / 2 + offset.x / zoom, -img.naturalHeight / 2 + offset.y / zoom);

    ctx.drawImage(img, 0, 0);
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
          Upload an image, drag to position, and use the zoom slider to frame your avatar.
        </p>

        {/* Viewport Frame */}
        <div
          className="relative w-[200px] h-[200px] mx-auto rounded-full overflow-hidden border-2 border-blue-500 bg-neutral-950 flex items-center justify-center cursor-move shadow-inner"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {imageSrc ? (
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Avatar preview"
              draggable={false}
              className="max-w-none pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
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
        {imageSrc && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1 text-[11px]">
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Zoom</span>
              </span>
              <span className="font-mono text-[10px]">{zoom.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.05"
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
                title="Reset position"
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* File Selector */}
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
            disabled={!imageSrc}
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
