import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

type Option = {
  value: string;
  label: string;
};

type SelectorProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function Selector({ options, value, onChange, placeholder = 'Select...' }: SelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="selector-v3" ref={containerRef}>
      <button
        type="button"
        className={`selector-trigger-v3 ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="selector-menu-v3">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`selector-item-v3 ${option.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
