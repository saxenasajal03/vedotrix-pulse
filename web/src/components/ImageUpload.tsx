import React, { useState, useRef } from 'react';
import { uploadFileToStorage } from '../lib/storage';
import { UploadCloud, CheckCircle2, AlertCircle, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  bucket?: 'organization-logos' | 'avatars' | 'documents';
  currentUrl?: string;
  onUploaded: (url: string) => void;
  label?: string;
  helperText?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  bucket = 'organization-logos',
  currentUrl,
  onUploaded,
  label = 'Upload Logo / Image',
  helperText = 'PNG, JPG, SVG, or WEBP up to 5MB'
}) => {
  const [preview, setPreview] = useState<string>(currentUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, SVG, or WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    setError(null);
    setIsUploading(true);

    // Create local object URL for instant preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // Upload to live Supabase S3 Storage
    const res = await uploadFileToStorage(file, bucket, bucket === 'organization-logos' ? 'org_logo' : 'asset');

    if (res.success && res.url) {
      setPreview(res.url);
      onUploaded(res.url);
    } else {
      setError(res.error || 'Failed to upload image to Supabase S3 storage.');
    }

    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearImage = () => {
    setPreview('');
    onUploaded('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-semibold text-slate-300">
          {label}
        </label>
      )}

      {preview ? (
        <div className="relative group p-3 bg-slate-950 rounded-xl border border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={preview}
              alt="Uploaded Preview"
              className="w-12 h-12 rounded-lg object-contain bg-slate-900 border border-slate-700 p-1"
            />
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-white flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1 shrink-0" />
                Image Stored in Supabase S3
              </span>
              <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[170px] sm:max-w-xs">
                {preview}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={clearImage}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 hover:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-1.5">
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition" />
            )}
            <div className="text-xs font-bold text-slate-300">
              {isUploading ? 'Uploading to Supabase S3 Cloud...' : 'Click to Upload or Drag & Drop'}
            </div>
            <p className="text-[10px] text-slate-500">{helperText}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-1.5 text-rose-400 text-[11px] pt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
