import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadFieldProps {
  label: string;
  value?: string;
  onChange: (imageUrl: string) => void;
  onRemove: () => void;
  placeholder?: string;
  className?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  onRemove,
  placeholder = "Upload an image or enter URL",
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(value || '');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      // Convert to base64 for now (in a real app, you'd upload to a storage service)
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImageUrl(base64);
        onChange(base64);
        toast.success('Image uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    if (url.trim()) {
      onChange(url);
    }
  };

  const handleRemove = () => {
    setImageUrl('');
    onRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Image removed');
  };

  const isValidImageUrl = (url: string) => {
    try {
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.startsWith('data:image/');
    } catch {
      return url.startsWith('data:image/');
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        {label}
      </Label>
      
      <div className="space-y-3">
        {/* File Upload */}
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Image
          </Button>
          
          {imageUrl && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="flex items-center gap-1 text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            </>
          )}
        </div>

        {/* URL Input */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Or enter image URL:</Label>
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
        </div>

        {/* Image Preview */}
        {imageUrl && isValidImageUrl(imageUrl) && (
          <Card className="border-2 border-dashed">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Image Preview:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex justify-center">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-full max-h-32 object-contain rounded border"
                  onError={() => {
                    toast.error('Failed to load image. Please check the URL.');
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Preview Modal */}
      {isPreviewOpen && imageUrl && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={imageUrl}
              alt="Full preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};