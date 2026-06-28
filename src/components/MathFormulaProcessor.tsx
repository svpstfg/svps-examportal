import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Enhanced math/science symbols and formatting
export const MATH_SYMBOLS = [
  // Basic Math
  { symbol: '√', label: 'Square root', category: 'Basic' },
  { symbol: '∛', label: 'Cube root', category: 'Basic' },
  { symbol: '∜', label: 'Fourth root', category: 'Basic' },
  { symbol: '∞', label: 'Infinity', category: 'Basic' },
  { symbol: '±', label: 'Plus minus', category: 'Basic' },
  { symbol: '∓', label: 'Minus plus', category: 'Basic' },
  
  // Superscripts
  { symbol: '⁰', label: 'Superscript 0', category: 'Superscript' },
  { symbol: '¹', label: 'Superscript 1', category: 'Superscript' },
  { symbol: '²', label: 'Superscript 2', category: 'Superscript' },
  { symbol: '³', label: 'Superscript 3', category: 'Superscript' },
  { symbol: '⁴', label: 'Superscript 4', category: 'Superscript' },
  { symbol: '⁵', label: 'Superscript 5', category: 'Superscript' },
  { symbol: '⁶', label: 'Superscript 6', category: 'Superscript' },
  { symbol: '⁷', label: 'Superscript 7', category: 'Superscript' },
  { symbol: '⁸', label: 'Superscript 8', category: 'Superscript' },
  { symbol: '⁹', label: 'Superscript 9', category: 'Superscript' },
  { symbol: 'ⁿ', label: 'Superscript n', category: 'Superscript' },
  { symbol: 'ˣ', label: 'Superscript x', category: 'Superscript' },
  { symbol: 'ʸ', label: 'Superscript y', category: 'Superscript' },
  
  // Subscripts
  { symbol: '₀', label: 'Subscript 0', category: 'Subscript' },
  { symbol: '₁', label: 'Subscript 1', category: 'Subscript' },
  { symbol: '₂', label: 'Subscript 2', category: 'Subscript' },
  { symbol: '₃', label: 'Subscript 3', category: 'Subscript' },
  { symbol: '₄', label: 'Subscript 4', category: 'Subscript' },
  { symbol: '₅', label: 'Subscript 5', category: 'Subscript' },
  { symbol: '₆', label: 'Subscript 6', category: 'Subscript' },
  { symbol: '₇', label: 'Subscript 7', category: 'Subscript' },
  { symbol: '₈', label: 'Subscript 8', category: 'Subscript' },
  { symbol: '₉', label: 'Subscript 9', category: 'Subscript' },
  { symbol: 'ₙ', label: 'Subscript n', category: 'Subscript' },
  { symbol: 'ₓ', label: 'Subscript x', category: 'Subscript' },
  { symbol: 'ᵢ', label: 'Subscript i', category: 'Subscript' },
  
  // Fractions
  { symbol: '½', label: 'One half', category: 'Fraction' },
  { symbol: '⅓', label: 'One third', category: 'Fraction' },
  { symbol: '¼', label: 'One quarter', category: 'Fraction' },
  { symbol: '⅕', label: 'One fifth', category: 'Fraction' },
  { symbol: '⅙', label: 'One sixth', category: 'Fraction' },
  { symbol: '⅛', label: 'One eighth', category: 'Fraction' },
  { symbol: '⅔', label: 'Two thirds', category: 'Fraction' },
  { symbol: '¾', label: 'Three quarters', category: 'Fraction' },
  { symbol: '⅖', label: 'Two fifths', category: 'Fraction' },
  { symbol: '⅗', label: 'Three fifths', category: 'Fraction' },
  { symbol: '⅘', label: 'Four fifths', category: 'Fraction' },
  { symbol: '⅚', label: 'Five sixths', category: 'Fraction' },
  { symbol: '⅜', label: 'Three eighths', category: 'Fraction' },
  { symbol: '⅝', label: 'Five eighths', category: 'Fraction' },
  { symbol: '⅞', label: 'Seven eighths', category: 'Fraction' },
  
  // Comparison
  { symbol: '=', label: 'Equal', category: 'Comparison' },
  { symbol: '≠', label: 'Not equal', category: 'Comparison' },
  { symbol: '≈', label: 'Approximately', category: 'Comparison' },
  { symbol: '≡', label: 'Identical to', category: 'Comparison' },
  { symbol: '<', label: 'Less than', category: 'Comparison' },
  { symbol: '>', label: 'Greater than', category: 'Comparison' },
  { symbol: '≤', label: 'Less than or equal', category: 'Comparison' },
  { symbol: '≥', label: 'Greater than or equal', category: 'Comparison' },
  { symbol: '≪', label: 'Much less than', category: 'Comparison' },
  { symbol: '≫', label: 'Much greater than', category: 'Comparison' },
  
  // Greek Letters
  { symbol: 'α', label: 'Alpha', category: 'Greek' },
  { symbol: 'β', label: 'Beta', category: 'Greek' },
  { symbol: 'γ', label: 'Gamma', category: 'Greek' },
  { symbol: 'δ', label: 'Delta', category: 'Greek' },
  { symbol: 'ε', label: 'Epsilon', category: 'Greek' },
  { symbol: 'ζ', label: 'Zeta', category: 'Greek' },
  { symbol: 'η', label: 'Eta', category: 'Greek' },
  { symbol: 'θ', label: 'Theta', category: 'Greek' },
  { symbol: 'λ', label: 'Lambda', category: 'Greek' },
  { symbol: 'μ', label: 'Mu', category: 'Greek' },
  { symbol: 'π', label: 'Pi', category: 'Greek' },
  { symbol: 'ρ', label: 'Rho', category: 'Greek' },
  { symbol: 'σ', label: 'Sigma', category: 'Greek' },
  { symbol: 'τ', label: 'Tau', category: 'Greek' },
  { symbol: 'φ', label: 'Phi', category: 'Greek' },
  { symbol: 'χ', label: 'Chi', category: 'Greek' },
  { symbol: 'ψ', label: 'Psi', category: 'Greek' },
  { symbol: 'ω', label: 'Omega', category: 'Greek' },
  { symbol: 'Α', label: 'Alpha (capital)', category: 'Greek' },
  { symbol: 'Β', label: 'Beta (capital)', category: 'Greek' },
  { symbol: 'Γ', label: 'Gamma (capital)', category: 'Greek' },
  { symbol: 'Δ', label: 'Delta (capital)', category: 'Greek' },
  { symbol: 'Θ', label: 'Theta (capital)', category: 'Greek' },
  { symbol: 'Λ', label: 'Lambda (capital)', category: 'Greek' },
  { symbol: 'Π', label: 'Pi (capital)', category: 'Greek' },
  { symbol: 'Σ', label: 'Sigma (capital)', category: 'Greek' },
  { symbol: 'Φ', label: 'Phi (capital)', category: 'Greek' },
  { symbol: 'Ω', label: 'Omega (capital)', category: 'Greek' },
  
  // Chemistry
  { symbol: '⇌', label: 'Equilibrium', category: 'Chemistry' },
  { symbol: '→', label: 'Reaction arrow', category: 'Chemistry' },
  { symbol: '↑', label: 'Gas evolution', category: 'Chemistry' },
  { symbol: '↓', label: 'Precipitate', category: 'Chemistry' },
  { symbol: '⟶', label: 'Long arrow', category: 'Chemistry' },
  { symbol: '°', label: 'Degree', category: 'Chemistry' },
  
  // Physics
  { symbol: 'ℏ', label: 'Reduced Planck constant', category: 'Physics' },
  { symbol: 'ℓ', label: 'Liter', category: 'Physics' },
  { symbol: 'Å', label: 'Angstrom', category: 'Physics' },
  { symbol: '∇', label: 'Nabla/Del', category: 'Physics' },
  { symbol: '∂', label: 'Partial derivative', category: 'Physics' },
  { symbol: '∫', label: 'Integral', category: 'Physics' },
  { symbol: '∮', label: 'Closed integral', category: 'Physics' },
  { symbol: '∑', label: 'Sum', category: 'Physics' },
  { symbol: '∏', label: 'Product', category: 'Physics' },
  { symbol: '⊥', label: 'Perpendicular', category: 'Physics' },
  { symbol: '∥', label: 'Parallel', category: 'Physics' },
  { symbol: '∠', label: 'Angle', category: 'Physics' },
  { symbol: '∆', label: 'Change/Delta', category: 'Physics' },
];

// Enhanced text processing for math/science formulas
export const processMathText = (text: string): string => {
  // Preserve original formatting and handle common patterns
  return text
    // Preserve superscripts and subscripts
    .replace(/\*\*\*+/g, '**') // Multiple asterisks to double
    .replace(/___+/g, '__') // Multiple underscores to double
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim();
};

// Enhanced paste handler that preserves rich text formatting
export const processRichTextPaste = (clipboardData: DataTransfer): string => {
  // Try to get HTML first (preserves formatting)
  const htmlData = clipboardData.getData('text/html');
  const plainText = clipboardData.getData('text/plain');
  const rtfData = clipboardData.getData('text/rtf');
  
  if (htmlData && htmlData.trim()) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlData;
    
    // Process the HTML content to preserve mathematical formatting
    const processedHTML = processHTMLForMath(tempDiv);
    return processedHTML;
  }
  
  // If no HTML, try RTF processing for rich text from sources like Word
  if (rtfData && rtfData.trim()) {
    // Basic RTF parsing for superscripts and subscripts
    let processedRTF = plainText;
    
    // Extract RTF formatting patterns and apply them
    const rtfSuperRegex = /\\super\s*([^\\]+?)\\nosupersub/g;
    const rtfSubRegex = /\\sub\s*([^\\]+?)\\nosupersub/g;
    
    let rtfMatch;
    while ((rtfMatch = rtfSuperRegex.exec(rtfData)) !== null) {
      const superscriptText = rtfMatch[1].trim();
      processedRTF = processedRTF.replace(superscriptText, convertToSuperscript(superscriptText));
    }
    
    while ((rtfMatch = rtfSubRegex.exec(rtfData)) !== null) {
      const subscriptText = rtfMatch[1].trim();
      processedRTF = processedRTF.replace(subscriptText, convertToSubscript(subscriptText));
    }
    
    return processedRTF;
  }
  
  // Fallback to plain text - preserve as much formatting as possible
  return plainText || '';
};

// Process HTML content to preserve mathematical symbols and formatting
const processHTMLForMath = (element: HTMLElement): string => {
  let result = '';
  
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      switch (tagName) {
        case 'sup':
          // Handle superscripts - preserve exact formatting
          const supText = el.textContent || '';
          result += convertToSuperscript(supText);
          break;
        case 'sub':
          // Handle subscripts - preserve exact formatting
          const subText = el.textContent || '';
          result += convertToSubscript(subText);
          break;
        case 'math':
        case 'mfrac':
        case 'msup':
        case 'msub':
        case 'mrow':
        case 'mi':
        case 'mn':
        case 'mo':
          // MathML elements - extract and preserve content
          result += processHTMLForMath(el);
          break;
        case 'i':
        case 'em':
          // Handle italics (common in math variables)
          result += processHTMLForMath(el);
          break;
        case 'b':
        case 'strong':
          // Handle bold (vectors, etc.)
          result += processHTMLForMath(el);
          break;
        case 'span':
          // Handle styled spans with comprehensive style checking
          const style = el.getAttribute('style') || '';
          const className = el.getAttribute('class') || '';
          
          if (style.includes('vertical-align: super') || 
              style.includes('vertical-align:super') ||
              className.includes('superscript') ||
              className.includes('sup')) {
            result += convertToSuperscript(el.textContent || '');
          } else if (style.includes('vertical-align: sub') || 
                     style.includes('vertical-align:sub') ||
                     className.includes('subscript') ||
                     className.includes('sub')) {
            result += convertToSubscript(el.textContent || '');
          } else {
            result += processHTMLForMath(el);
          }
          break;
        case 'br':
          result += '\n';
          break;
        case 'p':
          if (result && !result.endsWith('\n')) {
            result += '\n';
          }
          result += processHTMLForMath(el);
          if (!result.endsWith('\n')) {
            result += '\n';  
          }
          break;
        case 'div':
          if (result && !result.endsWith('\n')) {
            result += '\n';
          }
          result += processHTMLForMath(el);
          if (!result.endsWith('\n')) {
            result += '\n';
          }
          break;
        case 'table':
        case 'tr':
        case 'td':
        case 'th':
          // Handle table structures (matrices, etc.)
          result += processHTMLForMath(el);
          if (tagName === 'tr') {
            result += '\n';
          } else if (tagName === 'td' || tagName === 'th') {
            result += ' ';
          }
          break;
        default:
          // Process other elements recursively
          result += processHTMLForMath(el);
          break;
      }
    }
  }
  
  // Clean up extra whitespace but preserve intentional line breaks
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
  return result.trim();
};

// Convert text to superscript unicode
const convertToSuperscript = (text: string): string => {
  const superscriptMap: {[key: string]: string} = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
    '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
    '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
    'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
    'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
    'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ'
  };
  
  return text.split('').map(char => superscriptMap[char.toLowerCase()] || char).join('');
};

// Convert text to subscript unicode
const convertToSubscript = (text: string): string => {
  const subscriptMap: {[key: string]: string} = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
    '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
    '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ',
    'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ',
    'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
    'v': 'ᵥ', 'x': 'ₓ'
  };
  
  return text.split('').map(char => subscriptMap[char.toLowerCase()] || char).join('');
};

// Convert common text patterns to unicode equivalents
export const convertToUnicode = (text: string): string => {
  const conversions: { [key: string]: string } = {
    // Superscripts
    '^0': '⁰', '^1': '¹', '^2': '²', '^3': '³', '^4': '⁴', '^5': '⁵',
    '^6': '⁶', '^7': '⁷', '^8': '⁸', '^9': '⁹', '^n': 'ⁿ', '^x': 'ˣ', '^y': 'ʸ',
    // Subscripts
    '_0': '₀', '_1': '₁', '_2': '₂', '_3': '₃', '_4': '₄', '_5': '₅',
    '_6': '₆', '_7': '₇', '_8': '₈', '_9': '₉', '_n': 'ₙ', '_x': 'ₓ', '_i': 'ᵢ',
    // Common symbols
    'sqrt': '√', 'pi': 'π', 'alpha': 'α', 'beta': 'β', 'gamma': 'γ',
    'delta': 'δ', 'theta': 'θ', 'lambda': 'λ', 'mu': 'μ', 'sigma': 'σ',
    'phi': 'φ', 'omega': 'ω', 'infinity': '∞', 'degree': '°',
    '+-': '±', '-+': '∓', '<=': '≤', '>=': '≥', '!=': '≠', '~=': '≈',
    '->': '→', '<->': '⇌', 'integral': '∫', 'sum': '∑', 'product': '∏',
    'partial': '∂', 'nabla': '∇', 'perpendicular': '⊥', 'parallel': '∥',
    'angle': '∠', 'hbar': 'ℏ'
  };
  
  let result = text;
  Object.entries(conversions).forEach(([pattern, unicode]) => {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, unicode);
  });
  
  return result;
};

interface MathSymbolToolbarProps {
  onSymbolInsert: (symbol: string) => void;
  activeField: string | null;
}

export const MathSymbolToolbar: React.FC<MathSymbolToolbarProps> = ({ 
  onSymbolInsert, 
  activeField 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Basic');
  
  const categories = Array.from(new Set(MATH_SYMBOLS.map(s => s.category)));
  const filteredSymbols = MATH_SYMBOLS.filter(s => s.category === selectedCategory);
  
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {categories.map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="h-7 px-2 text-xs"
          >
            {category}
          </Button>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-1 p-3 bg-muted rounded-md max-h-32 overflow-y-auto">
        {filteredSymbols.map((item) => (
          <Button
            key={`${item.category}-${item.symbol}`}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-sm hover:bg-primary hover:text-primary-foreground"
            onClick={() => {
              if (activeField) {
                onSymbolInsert(item.symbol);
              } else {
                toast.info('Click on a text field first, then select a symbol');
              }
            }}
            title={item.label}
          >
            {item.symbol}
          </Button>
        ))}
      </div>
    </div>
  );
};