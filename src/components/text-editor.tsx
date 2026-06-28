import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Copy, Trash2, FileText, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
interface TextEditorProps {
  onSave?: (content: string, title?: string) => Promise<void>;
}
const TextEditor: React.FC<TextEditorProps> = ({
  onSave
}) => {
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [slideTitle, setSlideTitle] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [chapters, setChapters] = useState<Array<{
    id: string;
    name: string;
  }>>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchChapters();
    // Setup image interactions on component mount
    setupImageInteractions();
  }, []);
  useEffect(() => {
    // Re-setup image interactions when content changes
    if (content) {
      setTimeout(() => setupImageInteractions(), 100);
    }
  }, [content]);
  const fetchChapters = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('chapters').select('id, name').order('created_at', {
        ascending: true
      });
      if (error) throw error;
      setChapters(data || []);
    } catch (error) {
      console.error('Error fetching chapters:', error);
    }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const items = Array.from(e.clipboardData.items);

    // Check if there are any image files
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        handleImagePaste(file);
        return;
      }
    }
    
    // Get clipboard data - preserve EXACT original format
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');
    let pastedContent = '';
    
    if (htmlData && htmlData.trim()) {
      // For HTML content, keep ALL formatting - only remove unsafe scripts
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlData, 'text/html');

      // Remove only dangerous scripts
      doc.querySelectorAll('script').forEach(node => node.remove());
      doc.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
          if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        });
      });

      pastedContent = doc.body.innerHTML;
    } else if (textData) {
      // For plain text, preserve ALL characters and structure exactly as is
      pastedContent = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/  +/g, (match) => '&nbsp;'.repeat(match.length));
    }
    
    if (contentRef.current && pastedContent) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(pastedContent);
        range.insertNode(fragment);
        range.collapse(false);
        setContent(contentRef.current.innerHTML);
      } else {
        contentRef.current.innerHTML += pastedContent;
        setContent(contentRef.current.innerHTML);
      }
      
      setIsActive(true);
      toast({
        title: 'Content pasted!',
        description: 'Original formatting preserved exactly as copied.'
      });
    }
  };

  const handleImagePaste = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const imageData = e.target?.result as string;
      insertImage(imageData);
    };
    reader.readAsDataURL(file);
  };
  const insertImage = (src: string) => {
    if (!contentRef.current) return;
    const imageId = `img-${Date.now()}`;

    // Create absolutely positioned image overlay
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    imageContainer.style.cssText = `
    position: absolute;
    top: 100px;
    left: 100px;
    z-index: 10;
    max-width: 100%;
    pointer-events: auto;
  `;
    imageContainer.innerHTML = `
    <img 
      id="${imageId}"
      src="${src}" 
      class="editor-image" 
      style="max-width: 300px; height: auto; cursor: move; border: 2px solid transparent; border-radius: 4px; display: block;"
      draggable="false"
    />
    <div class="resize-handles" style="display: none;">
      <div class="resize-handle se" style="position: absolute; bottom: -4px; right: -4px; width: 8px; height: 8px; background: #3b82f6; cursor: se-resize; border-radius: 50%;"></div>
    </div>
  `;

    // Append to the editor container (parent of contentRef)
    if (contentRef.current.parentElement) {
      contentRef.current.parentElement.style.position = 'relative';
      contentRef.current.parentElement.appendChild(imageContainer);
    }
    setIsActive(true);

    // Setup image interaction after insertion
    setTimeout(() => setupImageInteractions(), 100);
    toast({
      title: 'Image added!',
      description: 'Image pasted successfully. Click to select and drag to move over text.'
    });
  };
  const setupImageInteractions = () => {
    if (!contentRef.current) return;

    // Find all image containers (both in content and as overlays)
    const editorParent = contentRef.current.parentElement;
    if (!editorParent) return;
    const imageContainers = editorParent.querySelectorAll('.image-container');
    imageContainers.forEach((container: Element) => {
      const containerElement = container as HTMLElement;
      const imageElement = container.querySelector('.editor-image') as HTMLImageElement;
      if (!imageElement) return;
      const resizeHandles = container.querySelector('.resize-handles') as HTMLElement;

      // Click to select image
      imageElement.onclick = e => {
        e.stopPropagation();

        // Remove selection from other images
        editorParent.querySelectorAll('.editor-image').forEach(otherImg => {
          (otherImg as HTMLElement).style.border = '2px solid transparent';
          const otherContainer = otherImg.closest('.image-container');
          const otherHandles = otherContainer?.querySelector('.resize-handles') as HTMLElement;
          if (otherHandles) otherHandles.style.display = 'none';
        });

        // Select this image
        imageElement.style.border = '2px solid #3b82f6';
        if (resizeHandles) resizeHandles.style.display = 'block';
      };

      // Mouse drag to move (for absolutely positioned images)
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let initialLeft = 0;
      let initialTop = 0;
      imageElement.onmousedown = e => {
        if (e.button !== 0) return; // Only left mouse button

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = containerElement.getBoundingClientRect();
        const parentRect = editorParent.getBoundingClientRect();
        initialLeft = rect.left - parentRect.left;
        initialTop = rect.top - parentRect.top;
        e.preventDefault();
        const onMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          const deltaX = e.clientX - dragStartX;
          const deltaY = e.clientY - dragStartY;
          const newLeft = Math.max(0, initialLeft + deltaX);
          const newTop = Math.max(0, initialTop + deltaY);
          containerElement.style.left = `${newLeft}px`;
          containerElement.style.top = `${newTop}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      // Resize functionality
      const resizeHandle = resizeHandles?.querySelector('.resize-handle') as HTMLElement;
      if (resizeHandle) {
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        resizeHandle.onmousedown = e => {
          e.preventDefault();
          e.stopPropagation();
          isResizing = true;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = imageElement.offsetWidth;
          startHeight = imageElement.offsetHeight;
          const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const newWidth = Math.max(50, startWidth + deltaX);
            const aspectRatio = startHeight / startWidth;
            const newHeight = newWidth * aspectRatio;
            imageElement.style.width = `${newWidth}px`;
            imageElement.style.height = `${newHeight}px`;
          };
          const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        };
      }
    });

    // Click outside to deselect
    const handleClickOutside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.image-container')) {
        editorParent.querySelectorAll('.editor-image').forEach(img => {
          (img as HTMLElement).style.border = '2px solid transparent';
          const container = img.closest('.image-container');
          const handles = container?.querySelector('.resize-handles') as HTMLElement;
          if (handles) handles.style.display = 'none';
        });
      }
    };
    document.addEventListener('click', handleClickOutside);
  };
  const handleInput = () => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerHTML;
      setContent(newContent);
      setIsActive(newContent.trim().length > 0);
    }
  };
  const handleFocus = () => {
    setIsActive(true);
  };
  const handlePrint = () => {
    window.print();
    toast({
      title: "Printing...",
      description: "Your document is being prepared for printing."
    });
  };
  const handleCopy = async () => {
    if (contentRef.current) {
      try {
        await navigator.clipboard.writeText(contentRef.current.innerText);
        toast({
          title: "Copied!",
          description: "Text has been copied to clipboard."
        });
      } catch (err) {
        toast({
          title: "Copy failed",
          description: "Unable to copy text to clipboard.",
          variant: "destructive"
        });
      }
    }
  };
  const handleClear = () => {
    setContent('');
    setIsActive(false);
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
    }
    toast({
      title: "Cleared",
      description: "All content has been removed."
    });
  };
  const handleSave = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Cannot save empty content",
        variant: "destructive"
      });
      return;
    }
    try {
      // Get content with images included
      const contentWithImages = getContentWithImages();
      const nextSerialNumber = await getNextSerialNumber();
      const {
        error
      } = await (supabase as any).from('slides').insert({
        title: slideTitle || null,
        content: contentWithImages,
        serial_number: nextSerialNumber,
        chapter_id: selectedChapter || null
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Slide saved successfully"
      });

      // Clear the editor after saving
      clearEditor();

      // Call onSave callback if provided to refresh parent component
      if (onSave) {
        await onSave(contentWithImages, slideTitle || undefined);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save slide",
        variant: "destructive"
      });
    }
  };
  const getContentWithImages = () => {
    if (!contentRef.current) return content;

    // Get the editor container (parent of contentRef)
    const editorParent = contentRef.current.parentElement;
    if (!editorParent) return content;

    // Get the editor's rect for calculating relative positions
    const editorRect = contentRef.current.getBoundingClientRect();

    // Clone the content to avoid modifying the original
    let contentWithImages = content;

    // Find all absolutely positioned images
    const imageContainers = editorParent.querySelectorAll('.image-container');
    imageContainers.forEach((container: Element) => {
      const img = container.querySelector('.editor-image') as HTMLImageElement;
      if (img) {
        const containerElement = container as HTMLElement;
        const containerRect = containerElement.getBoundingClientRect();

        // Calculate position relative to the editor content area
        const relativeLeft = containerRect.left - editorRect.left;
        const relativeTop = containerRect.top - editorRect.top;

        // Create image HTML with precise position data for saving
        const imageHTML = `<div class="saved-image-container" style="position: absolute; left: ${relativeLeft}px; top: ${relativeTop}px; z-index: 10; max-width: 100%; pointer-events: auto;"><img src="${img.src}" style="width: ${img.style.width || img.offsetWidth + 'px'}; height: ${img.style.height || img.offsetHeight + 'px'}; border-radius: 4px; display: block;" /></div>`;
        contentWithImages += imageHTML;
      }
    });
    return contentWithImages;
  };
  const clearEditor = () => {
    setContent('');
    setSlideTitle('');
    setSelectedChapter('');
    setIsActive(false);
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
    }

    // Clear any absolutely positioned images
    const editorParent = contentRef.current?.parentElement;
    if (editorParent) {
      const imageContainers = editorParent.querySelectorAll('.image-container');
      imageContainers.forEach(container => container.remove());
    }
  };
  const getNextSerialNumber = async () => {
    try {
      const {
        data,
        error
      } = await (supabase as any).from('slides').select('serial_number').order('serial_number', {
        ascending: false
      }).limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0].serial_number + 1 : 1;
    } catch {
      return 1;
    }
  };
  return <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-primary">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Universal Text Formatter</h1>
          </div>
          <p className="no-print text-muted-foreground text-lg max-w-2xl mx-auto">
            Paste any text from anywhere and preserve its original formatting. Perfect for math, physics, and academic content. You can also paste images!
          </p>
        </div>

        {/* Save Section */}
        {content && <div className="no-print mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                <Label htmlFor="chapterSelect" className="text-sm font-medium">Select Chapter</Label>
                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                <Label htmlFor="slideTitle" className="text-sm font-medium">Slide Title (Optional)</Label>
                <Input id="slideTitle" placeholder="Enter slide title..." value={slideTitle} onChange={e => setSlideTitle(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90 transition-smooth">
                <Save className="w-4 h-4 mr-2" />
                Save as Slide
              </Button>
            </div>
          </div>}

        {/* Controls */}
        <div className="no-print flex flex-wrap gap-3 mb-6 justify-center items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fontSize" className="text-sm font-medium">Font Size</Label>
            <Input id="fontSize" type="number" min="8" max="72" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-20 text-center" placeholder="16" />
          </div>
          <Button onClick={handlePrint} className="bg-gradient-primary hover:opacity-90 transition-smooth" disabled={!content}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={!content}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Text
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={!content}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        {/* Editor */}
        <Card className="print-content shadow-elegant border-0 bg-white/80 backdrop-blur-sm">
          <div className="p-8">
            {!content && !isActive ? <div className="no-print text-center py-16 pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Paste Your Content Here</h3>
                  <p className="text-muted-foreground mb-6">
                    Click in the area below and paste (Ctrl+V) any text content. 
                     Formatting from math equations, physics formulas, and academic papers will be preserved. You can also paste images!
                   </p>
                   <div className="text-sm text-muted-foreground">
                     <p>✓ Supports mathematical formulas</p>
                     <p>✓ Preserves special characters</p>
                     <p>✓ Maintains original formatting</p>
                     <p>✓ Paste images with drag & resize support</p>
                  </div>
                </div>
              </div> : null}
            
            <div ref={contentRef} contentEditable onPaste={handlePaste} onInput={handleInput} onFocus={handleFocus} tabIndex={0} className={`
                min-h-[400px] outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg p-4
                ${!content && !isActive ? 'border-2 border-dashed border-muted cursor-text' : ''}
                prose prose-lg max-w-none
                leading-relaxed text-foreground
              `} style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: '1.7',
            fontSize: `${fontSize}px`
          }} data-placeholder="Click here and paste your content (Ctrl+V)" suppressContentEditableWarning={true} />
          </div>
        </Card>

        {/* Footer */}
        <div className="no-print mt-8 text-center text-sm text-muted-foreground">
          <p>Tip: Use Ctrl+V to paste content with preserved formatting</p>
        </div>
      </div>
    </div>;
};
export default TextEditor;
