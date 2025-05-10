import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listen } from "@tauri-apps/api/event";
// import Groq from "groq-sdk"; // Import Groq if you have the SDK, otherwise use fetch
import '../styles/MainScreen.css';
import hljs from 'highlight.js'; // Use standard highlight.js import
import Sidebar from './Sidebar'; // Import the Sidebar component
import * as chrono from 'chrono-node'; // Import chrono library for date parsing with named import
import FolderManager from './FolderManager';

// Define types for snippets
interface BaseSnippet {
  id: string;
  type: string;
  content: string;
  source: string;
  timestamp: string;
  tags: string[];
  notes?: string[]; // Array of strings for bullet points
  isFavorite?: boolean;
  sourceApp?: {
    name: string;
    base64_icon?: string; // Add the base64 icon field
  };
}

interface CodeSnippet extends BaseSnippet {
  type: 'code';
  path: string;
}

interface TweetSnippet extends BaseSnippet {
  type: 'tweet';
  handle: string;
}

interface QuoteSnippet extends BaseSnippet {
  type: 'quote';
  author: string;
}

interface LinkSnippet extends BaseSnippet {
  type: 'link';
  title: string;
}

interface TextSnippet extends BaseSnippet {
  type: 'text';
}

interface MessageSnippet extends BaseSnippet {
  type: 'message';
  contact: string;
}

interface ColorSnippet extends BaseSnippet {
  type: 'color';
  colorValue: string;
}

type Snippet = CodeSnippet | TweetSnippet | QuoteSnippet | LinkSnippet | TextSnippet | MessageSnippet | ColorSnippet;

// Sample snippet data for demo mode
const demoSnippets: Snippet[] = [
  {
    id: 'demo-1',
    type: 'code',
    content: `const fetchUserData = async (userId) => {
  try {
    const response = await api.get(\`/users/\${userId}\`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};`,
    source: 'VS Code',
    path: 'src/utils/api.ts',
    timestamp: 'May 2, 2025 · 2:34 PM',
    tags: ['typescript', 'react', 'api']
  },
  {
    id: 'demo-2',
    type: 'tweet',
    content: 'Just launched our new design system! Check out how we\'re using Figma and React to create a seamless workflow between design and development. #designsystem #frontend',
    source: 'Twitter',
    handle: '@designer',
    timestamp: 'May 2, 2025 · 1:15 PM',
    tags: ['design', 'announcement']
  },
  {
    id: 'demo-3',
    type: 'quote',
    content: 'The best way to predict the future is to invent it. The future is not laid out on a track. It is something that we can decide, and to the extent that we do not violate any known laws of the universe, we can probably make it work the way that we want to.',
    source: 'Medium',
    author: 'Alan Kay',
    timestamp: 'May 1, 2025 · 11:22 AM',
    tags: ['inspiration', 'quote']
  },
  {
    id: 'demo-4',
    type: 'text',
    content: 'Pick up groceries: eggs, milk, bread, avocados, chicken, pasta',
    source: 'Notes',
    timestamp: 'May 1, 2025 · 9:42 AM',
    tags: ['todo']
  },
  {
    id: 'demo-5',
    type: 'link',
    content: 'https://react.dev/reference/react',
    source: 'Browser',
    title: 'React Documentation',
    timestamp: 'April 30, 2025 · 4:18 PM',
    tags: ['resource', 'reference', 'react']
  },
  {
    id: 'demo-6',
    type: 'message',
    content: 'Hey, can you send me the latest design mockups for the dashboard? I need to implement those changes by Friday.',
    source: 'iMessage',
    contact: 'Alex Chen',
    timestamp: 'April 30, 2025 · 1:35 PM',
    tags: ['work', 'design']
  }
];

// Helper function to format timestamp
const formatTimestamp = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Regular expression for validating URLs
const urlRegex = /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

// Helper function to check if a string is a valid color
const isValidColor = (text: string): boolean => {
  // Trim whitespace
  const trimmed = text.trim();
  
  // Match HEX colors (#fff, #ffffff, #ffffffff)
  const hexRegex = /^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
  
  // Match RGB/RGBA colors (rgb(255, 255, 255), rgba(255, 255, 255, 0.5))
  const rgbRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\s*\)$/;
  
  // Match HSL/HSLA colors (hsl(360, 100%, 50%), hsla(360, 100%, 50%, 0.5))
  const hslRegex = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\s*\)$/;
  
  // Match named CSS colors (red, blue, transparent, etc.)
  const namedColorRegex = /^(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|transparent|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/i;
  
  return hexRegex.test(trimmed) || 
         rgbRegex.test(trimmed) || 
         hslRegex.test(trimmed) || 
         namedColorRegex.test(trimmed);
};

// Helper function to extract the color value for display
const extractColorValue = (text: string): string => {
  // Trim whitespace and return the color value
  return text.trim();
};

// Improved heuristic check for code patterns with more robust detection
const looksLikeCode = (text: string): boolean => {
  // Avoid treating error messages as code
  if (text.includes("Failed to load resource") || 
      text.includes("Error processing query") ||
      text.includes("(Bad Request)") ||
      text.includes("HTTP status code")) {
    return false;
  }
  
  // Check for common code patterns
  const codePatterns = [
    // Function definitions
    /function\s+\w+\s*\(/i,
    // Method definitions
    /\w+\s*\(\s*\)\s*{/i,
    // Class definitions
    /class\s+\w+/i,
    // Variable declarations
    /(const|let|var)\s+\w+\s*=/i,
    // Import statements
    /import\s+[\w{},\s*]+\s+from/i,
    // HTML tags pairs
    /<\w+[^>]*>[\s\S]*?<\/\w+>/i,
    // Self-closing HTML tags
    /<\w+[^>]*\/>/i,
    // CSS rules
    /\.\w+\s*{[^}]+}/i,
    // JavaScript objects
    /{\s*\w+:\s*[^{}]+}/i,
  ];

  // Return true if any code pattern is found
  return codePatterns.some(pattern => pattern.test(text));
};

// Function to try to detect language with highlight.js
const detectLanguageWithHljs = (text: string): string | null => {
  try {
    // Skip very short snippets, highlightAuto can be unreliable on tiny fragments
    if (text.trim().length < 20) return null;
    
    // Remove markdown code block syntax if present
    const cleanedText = text.replace(/^```\w*\n|\n```$/g, '');
    
    // Strong language markers that can quickly identify a language with high confidence
    const languageMarkers: {[key: string]: RegExp[]} = {
      'python': [
        /\bdef\s+\w+\s*\(.*\):\s*$/m,
        /\bimport\s+\w+(\.\w+)*(\s+as\s+\w+)?/,
        /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/m
      ],
      'javascript': [
        /\bconst\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|\bfunction\s+\w+\s*\(/,
        /\bnew\s+Promise\s*\(|\basync\s+function|\bawait\s+/,
        /\bdocument\.getElementById\s*\(|\bwindow\./
      ],
      'typescript': [
        /\binterface\s+\w+\s*\{|\btype\s+\w+\s*=|\b\w+\s*:\s*(string|number|boolean|any)\b/,
        /\w+<\w+(\[\])?>/
      ],
      'html': [
        /<!DOCTYPE\s+html>|<html[^>]*>|<body[^>]*>|<div[^>]*>/i,
        /<\/?[a-z][\s\S]*>/i
      ],
      'css': [
        /[.#][\w-]+\s*\{[^}]*\}/,
        /@media\s+/,
        /\b(margin|padding|border|color|background|font-size|width|height)\s*:/
      ],
      'java': [
        /\bpublic\s+(static\s+)?(void|class|interface)\b/,
        /\bSystem\.out\.println\(/,
        /\bimport\s+java\./
      ],
      'c++': [
        /#include\s*<[^>]+>/,
        /\bstd::\w+/,
        /\bnamespace\s+\w+/
      ],
      'csharp': [
        /\busing\s+System;/,
        /\bnamespace\s+\w+/,
        /\bConsole\.Write(Line)?\(/
      ],
      'rust': [
        /\bfn\s+\w+/,
        /\blet\s+mut\s+\w+/,
        /\bimpl\s+\w+\s+for\s+\w+/
      ],
      'go': [
        /\bpackage\s+main/,
        /\bfunc\s+\w+/,
        /\bfmt\.(Print|Println|Printf)\(/
      ],
      'sql': [
        /\bSELECT\s+.+?\s+FROM\s+/i,
        /\bCREATE\s+TABLE\s+/i,
        /\bINSERT\s+INTO\s+/i
      ],
      'php': [
        /<\?php/,
        /\becho\s+/,
        /\$\w+\s*=/
      ],
      'ruby': [
        /\bdef\s+\w+(\(.+\))?\s*\n/,
        /\bclass\s+\w+(\s+<\s+\w+)?/,
        /\bend\b/
      ],
      'bash': [
        /^#!/,
        /\becho\s+["']/,
        /\$\(\w+\)/
      ]
    };
    
    // First try a quick check for strong language markers
    for (const [language, patterns] of Object.entries(languageMarkers)) {
      if (patterns.some(pattern => pattern.test(cleanedText))) {
        return language;
      }
    }
    
    // If no strong markers matched, use highlight.js auto detection
    const result = hljs.highlightAuto(cleanedText, [
      'javascript', 'typescript', 'python', 'java', 'html', 'css', 'cpp', 
      'csharp', 'go', 'rust', 'bash', 'shell', 'json', 'xml', 'php', 'swift',
      'kotlin', 'ruby', 'sql', 'yaml', 'markdown'
    ]);
    
    // Require a higher relevance threshold for reliable detection
    if (result.language && result.relevance > 8) {
      // Map highlight.js language identifier to simpler tag name if needed
      const languageMap: {[key: string]: string} = {
        'csharp': 'c#',
        'cpp': 'c++',
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        // Add more mappings if needed
      };
      
      return languageMap[result.language] || result.language;
    }
    
    return null; // Couldn't detect with enough confidence
  } catch (error) {
    console.error("❌ Error in highlight.js detection:", error);
    return null;
  }
};

// Define a separate component for the notes section to maintain focus
const NotesInputSection = ({ snippet, addNote, removeNote }: {
  snippet: Snippet;
  addNote: (snippet: Snippet, note: string) => void;
  removeNote: (snippetId: string, noteIndex: number) => void;
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Handle note input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle key press (Enter to add note)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addNote(snippet, inputValue);
      setInputValue('');
    }
  };
  
  // Handle add button click
  const handleAddClick = () => {
    if (inputValue.trim()) {
      addNote(snippet, inputValue);
      setInputValue('');
      // Focus back on input after adding
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
  
  return (
    <div className="notes-section">
      <div className="note-input-container">
        <input
          ref={inputRef}
          type="text"
          className="note-input"
          placeholder="Add a note..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
        />
        <button 
          className="add-note-btn"
          onClick={handleAddClick}
          disabled={!inputValue.trim()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
      
      {snippet.notes && snippet.notes.length > 0 && (
        <ul className="notes-list">
          {snippet.notes.map((note, index) => (
            <li key={index} className="note-item">
              <span className="note-text">{note}</span>
              <button 
                className="remove-note-btn"
                onClick={() => removeNote(snippet.id, index)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const loadInitialSnippets = (): Snippet[] => {
  try {
    console.log('[Load] Attempting to load snippets from localStorage...');
    const savedSnippets = localStorage.getItem('saved_snippets');
    if (savedSnippets) {
      const parsedSnippets = JSON.parse(savedSnippets) as Snippet[];
      console.log(`[Load] Successfully loaded ${parsedSnippets.length} snippets from localStorage.`);
      return parsedSnippets;
    } else {
      console.log('[Load] No saved snippets found in localStorage.');
      return [];
    }
  } catch (error) {
    console.error('❌ [Load] Error loading snippets from localStorage:', error);
    return []; // Return empty array if not found or error occurs
  }
};

interface ParsedFilters {
  keywords?: string[];
  contentType?: string;
  alternativeTypes?: string[]; // Added for AI-based type matching
  codeContext?: {
    language?: string;
    functionality?: string;
    visualElements?: string[];
    algorithm?: string;
    problem?: string;
    output?: string;
  };
  source?: string;
  dateContext?: {
    from: string;
    to: string;
    fromTime?: string;
    toTime?: string;
    hasTimeComponent?: boolean;
  };
  // Keep for backward compatibility 
  date?: {
    from: string;
    to: string;
  };
  // Keep for backward compatibility
  type?: string;
  // Keep for backward compatibility
  app?: string;
  attributes?: {
    favorite?: boolean;
  };
  searchTerms?: {
    term: string;
    importance?: number;
    alternatives?: string[];
    partialMatching?: boolean;
  }[];
  understanding?: {
    userIntent: string;
    searchType: 'code' | 'text' | 'link' | 'image' | 'general';
    codeRelated: boolean;
  };
  codeAnalysis?: {
    functionality: string;
    possibleSyntaxPatterns?: string[];
    expectedOutput: string;
    relatedConcepts?: string[];
  };
}

const MainScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [capturedSnippets, setCapturedSnippets] = useState<Snippet[]>(loadInitialSnippets());
  // Add a new state for filtered snippets
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);
  // Add a state to track if we're currently filtering
  const [isFiltering, setIsFiltering] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'tags' | 'trash'>('all');
  const [selectedApp, setSelectedApp] = useState('all');
  const [isAppFilterOpen, setIsAppFilterOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Smart search state variables
  const [isSmartSearch, setIsSmartSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [processedDateQuery, setProcessedDateQuery] = useState<string | null>(null);
  const [isCommandsDropdownOpen, setIsCommandsDropdownOpen] = useState(false);
  
  // Enhanced structured search filters
  const [parsedFilters, setParsedFilters] = useState<ParsedFilters | null>(null);
  
  // For date sorting
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortType, setSortType] = useState<'newest' | 'oldest'>('newest');

  const sortByNewest = (a: Snippet, b: Snippet) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  };
  
  const sortByOldest = (a: Snippet, b: Snippet) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  };
  
  // Additional state and refs that were removed
  const lastCaptureRef = useRef<{ text: string, timestamp: number, fromCopyButton: boolean }>({
    text: '',
    timestamp: 0,
    fromCopyButton: false
  });
  const hasLoadedRef = useRef(false);
  const [editingNotesIds, setEditingNotesIds] = useState<string[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Groq API Key using environment variables with fallback
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "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";

  // Helper function to check if a word is a stop word
  const isStopWord = (word: string): boolean => {
    const stopWords = ['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from', 'your', 'have', 'been', 'what', 'where', 'when', 'who', 'why', 'how', 'some', 'hey', 'hello', 'hi', 'please', 'can', 'could', 'would', 'should', 'may', 'might', 'will', 'shall'];
    return stopWords.includes(word);
  };

  // Helper function to extract significant words from a query
  const extractSignificantWords = (query: string): string[] => {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !isStopWord(word));
  };
  
  // Basic text matching function for simpler searches
  const basicTextMatch = (snippets: Snippet[], searchTerm: string): Snippet[] => {
    return snippets.filter(snippet => {
      const content = snippet.content.toLowerCase();
      const source = snippet.source.toLowerCase();
      const sourceApp = snippet.sourceApp?.name?.toLowerCase() || '';
      const tags = snippet.tags.map(tag => tag.toLowerCase());
      
      // Direct match for exact terms
      if (content.includes(searchTerm) || 
          source.includes(searchTerm) || 
          sourceApp.includes(searchTerm) || 
          tags.some(tag => tag.includes(searchTerm))) {
        return true;
      }
      
      // Extract significant words and match if enough of them appear
      const significantWords = extractSignificantWords(searchTerm);
      if (significantWords.length > 0) {
        const matchCount = significantWords.filter(word => 
          content.includes(word) || 
          source.includes(word) || 
          sourceApp.includes(word) || 
          tags.some(tag => tag.includes(word))
        ).length;
        
        // Match if at least half the significant words are found
        if (matchCount >= Math.ceil(significantWords.length * 0.5)) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Helper function to get the date of the last occurrence of a specific day of the week
  // day: 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  const getLastDayOfWeek = (day: number): Date => {
    const today = new Date();
    const result = new Date(today);
    const todayDay = today.getDay();
    
    // Calculate days to subtract to get to the previous occurrence of the target day
    let daysToSubtract = todayDay - day;
    if (daysToSubtract <= 0) {
      daysToSubtract += 7; // Go back to previous week if target day is today or in the future
    }
    
    result.setDate(today.getDate() - daysToSubtract);
    return result;
  };

  // Helper function to extract date from timestamp - KEEP THIS ONE
  const getDateFromTimestamp = (timestamp: string): Date => {
    try {
      // Parse direct format first (e.g., "2023-04-30T12:34:56")
      const directDate = new Date(timestamp);
      if (!isNaN(directDate.getTime())) {
        return directDate;
      }
      
      // Try to extract from formatted string (e.g., "April 30, 2023 · 12:34 PM")
      const dateRegex = /(\w+\s+\d+,\s+\d{4})/;
      const match = timestamp.match(dateRegex);
      
      if (match && match[1]) {
        const extractedDate = new Date(match[1]);
        if (!isNaN(extractedDate.getTime())) {
          return extractedDate;
        }
      }
      
      // Last resort - current date
      return new Date();
    } catch (e) {
      console.error("Error parsing timestamp:", e);
      return new Date(); // Fallback to current date
    }
  };

  // Helper function to analyze query intent - MOVED UP
  const analyzeQueryIntent = (query: string): {
    lookingFor: boolean;
    isQuestion: boolean;
    contentType?: string;
    subjects?: string[];
    appSource?: string;
  } => {
    const result = {
      lookingFor: false,
      isQuestion: false,
      contentType: undefined as string | undefined,
      subjects: undefined as string[] | undefined,
      appSource: undefined as string | undefined
    };
    
    // Check if it's a "looking for" query
    if (query.match(/\b(looking for|find|search for|show me|get me|need|want)\b/i)) {
      result.lookingFor = true;
    }
    
    // Check if it's a question
    if (query.match(/\b(what|where|which|who|how|when|is|are|can|does|do)\b/i) || query.includes('?')) {
      result.isQuestion = true;
    }
    
    // Detect content type
    if (query.match(/\b(link|url|website|webpage|site)\b/i)) {
      result.contentType = 'link';
    } else if (query.match(/\b(code|script|function|class|programming)\b/i)) {
      result.contentType = 'code';
    } else if (query.match(/\b(text|note|message)\b/i)) {
      result.contentType = 'text';
    } else if (query.match(/\b(tweet|twitter)\b/i)) {
      result.contentType = 'tweet';
    } else if (query.match(/\b(quote|saying|phrase)\b/i)) {
      result.contentType = 'quote';
    }
    
    // Extract potential app sources
    if (query.match(/\b(from|in|on)\s+(\w+)\b/i)) {
      const matches = query.match(/\b(from|in|on)\s+(\w+)\b/i);
      if (matches && matches[2]) {
        result.appSource = matches[2].toLowerCase();
      }
    }
    
    // Extract main subjects (nouns) from the query
    // Remove filler words and get the remaining significant terms
    const subjects: string[] = [];
    
    // Special case for chat gpt links
    if ((query.includes('chat') && query.includes('gpt')) || query.includes('chatgpt')) {
      subjects.push('chat');
      subjects.push('gpt');
      subjects.push('chatgpt');
      
      // If specifically asking for links
      if (query.includes('link')) {
        result.contentType = 'link';
      }
    } 
    // Special case for discord
    else if (query.includes('discord')) {
      subjects.push('discord');
    }
    // General subject extraction
    else {
      const words = query.split(/\s+/);
      for (const word of words) {
        const cleaned = word.replace(/[^\w]/g, '').toLowerCase();
        if (cleaned.length > 3 && !isStopWord(cleaned)) {
          subjects.push(cleaned);
        }
      }
    }
    
    if (subjects.length > 0) {
      result.subjects = subjects;
    }
    
    return result;
  };
  
  
  // Helper function to apply AI-generated filters - MOVED UP
  const applyAIFilters = (snippets: Snippet[], filters: any, originalQuery: string): Snippet[] => {
    let filtered = [...snippets];
    
    // If we have type filter, apply it
    if (filters.type) {
      filtered = filtered.filter(snippet => matchesTypeQuery(snippet, filters.type));
    }
    
    // If we have app filter, apply it
    if (filters.app) {
      filtered = filtered.filter(snippet => matchesAppQuery(snippet, filters.app));
    }
    
    // If we have date filter, apply it
    if (filters.date) {
      const fromDate = filters.date.from ? new Date(filters.date.from) : null;
      const toDate = filters.date.to ? new Date(filters.date.to) : null;
      
      filtered = filtered.filter(snippet => {
        const snippetDate = getDateFromTimestamp(snippet.timestamp);
        
        if (fromDate && toDate) {
          return snippetDate >= fromDate && snippetDate <= toDate;
        } else if (fromDate) {
          return snippetDate >= fromDate;
        } else if (toDate) {
          return snippetDate <= toDate;
        }
        
        return true;
      });
    }
    
    // Apply additional attribute filters when available
    if (filters.attributes) {
      // Filter by programming language if specified
      if (filters.attributes.language) {
        filtered = filtered.filter(snippet => {
          if (snippet.type !== 'code') return false;
          
          const language = filters.attributes.language.toLowerCase();
          const detectedLanguage = detectLanguageWithHljs(snippet.content)?.toLowerCase() || '';
          
          return detectedLanguage.includes(language);
        });
      }
      
      // Filter by content length if specified
      if (filters.attributes.length) {
        filtered = filtered.filter(snippet => {
          if (filters.attributes.length === 'short') {
            return snippet.content.length < 300; // Arbitrary threshold for "short"
          } else if (filters.attributes.length === 'long') {
            return snippet.content.length >= 300; // Arbitrary threshold for "long"
          }
          return true;
        });
      }
      
      // Filter by favorite status if specified
      if (filters.attributes.favorite !== undefined) {
        filtered = filtered.filter(snippet => 
          snippet.isFavorite === filters.attributes.favorite
        );
      }
    }
    
    return filtered;
  };

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // @ts-ignore - Might be used in future navigation
  const handleBack = () => {
    navigate('/');
  };

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  // Function to delete ALL snippets
  const handleDeleteAll = () => {
    if (window.confirm("Are you sure you want to delete all clipboard history? This cannot be undone.")) {
      setCapturedSnippets([]);
    }
  };

  // Function to delete a snippet
  const handleDeleteSnippet = (id: string) => {
    setCapturedSnippets(prevSnippets => prevSnippets.filter(snippet => snippet.id !== id));
    console.log(`Deleted snippet with ID: ${id}`);
  };

  // Modified to only toggle commands dropdown without changing search bar
  const handleMagicSearch = () => {
    console.log("🔮 Magic search button clicked - toggling commands dropdown");
    toggleCommandsDropdown();
  };

  // Toggle commands dropdown
  const toggleCommandsDropdown = () => {
    setIsCommandsDropdownOpen(!isCommandsDropdownOpen);
  };

  // Handle command selection from dropdown
  const handleCommandSelect = (command: string) => {
    setSearchInput(prevInput => `${command} ${prevInput}`);
    setIsCommandsDropdownOpen(false);
  };

  // Process a type query with AI to understand the content type
  const processTypeQueryWithAI = async (query: string): Promise<ParsedFilters | null> => {
    console.log('Processing type query with AI:', query);
    
    // First set searching state to show loading indicator
    setIsSearching(true);
    
    // Clear any existing filters to avoid stale state
    setParsedFilters(null);

    try {
      // Normalize the query by removing the /type command if present
      const normalizedQuery = query.replace(/^\/type\s+/, '').trim();
      
      if (!normalizedQuery) {
        setIsSearching(false);
        return null;
      }

      // Simple keyword matching for common types to avoid unnecessary API calls
      const simpleTypes = {
        'link': 'link',
        'url': 'link',
        'website': 'link',
        'web': 'link',
        'code': 'code',
        'script': 'code',
        'programming': 'code',
        'text': 'text',
        'note': 'text',
        'message': 'text',
        'color': 'color',
        'hex': 'color',
        'rgb': 'color',
        'rgba': 'color',
        'hsl': 'color'
      };

      // Check if we can determine the type without API call
      const lowerQuery = normalizedQuery.toLowerCase();
      for (const [keyword, type] of Object.entries(simpleTypes)) {
        if (lowerQuery === keyword || lowerQuery.startsWith(keyword + ' ') || lowerQuery.includes(' ' + keyword)) {
          console.log(`Simple matching found type: ${type} for query: ${normalizedQuery}`);
          
          const simpleFilter: ParsedFilters = {
            contentType: type
          };
          
          // If it's code and we can detect a language
          if (type === 'code') {
            const languages = ['javascript', 'python', 'html', 'css', 'typescript', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift'];
            for (const lang of languages) {
              if (lowerQuery.includes(lang)) {
                simpleFilter.codeContext = { language: lang };
                break;
              }
            }
          }
          
          setIsSearching(false);
          return simpleFilter;
        }
      }

      // Continue with AI API call if simple matching didn't work
      // [The rest of the AI API code should remain unchanged]

      // Make a request to the AI API for semantic understanding
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that analyzes user queries for a clipboard manager app and extracts structured information about what the user is looking for.

Your task is to parse natural language queries and return a structured JSON with filters that can be applied to clipboard items.

A query might contain multiple filtering criteria such as:
1. Content type (code, image, text, url, file, color)
2. Programming language specifications (JavaScript, Python, HTML, etc.)
3. Time references (today, yesterday, last week, specific dates)
4. Source application references (from Chrome, copied from VS Code)
5. Content descriptors (about machine learning, related to login)

Focus on understanding the semantic intent of the query, not just matching keywords.

IMPORTANT: Return ONLY a valid JSON object with the following structure:
{
  "contentType": string | null,           // The primary content type (code, image, text, url, file, color)
  "programmingLanguage": string | null,   // If code, what language (javascript, python, html, etc)
  "dateFilter": {                        // Time range filter
    "from": ISO date string | null,      // Start date (inclusive)
    "to": ISO date string | null         // End date (inclusive)
  },
  "sourceApp": string | null,            // Source application name
  "keywords": string[] | null,           // Important content keywords
  "confidence": number                   // 0-1 score of confidence in the interpretation
}

Examples:
- For "javascript from today": Extract both the programming language and the date constraint
- For "screenshots from yesterday": Extract both the content type (image) and the date constraint
- For "code about authentication": Extract both the content type (code) and the keywords
- For "urls from chrome": Extract both the content type (url) and the source application
- For "hex colors": Extract the content type (color)

Always return an ISO date string (YYYY-MM-DD) for date references, using the current date for relative terms.
Use null for any fields that aren't specified in the query.`
            },
            {
              role: 'user',
              content: normalizedQuery
            }
          ],
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]?.message?.content) {
        console.error('No content in AI response:', data);
        setIsSearching(false);
        return null;
      }

      const aiResponse = JSON.parse(data.choices[0].message.content);
      console.log('AI response:', aiResponse);

      // Get current date for relative date processing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Convert AI response to ParsedFilters format
      const parsedFilters: ParsedFilters = {};
      
      // Handle content type
      if (aiResponse.contentType) {
        parsedFilters.contentType = aiResponse.contentType.toLowerCase();
      }
      
      // Handle code type with programming language
      if ((aiResponse.contentType === 'code' || parsedFilters.contentType === 'code') && aiResponse.programmingLanguage) {
        if (!parsedFilters.codeContext) parsedFilters.codeContext = {};
        parsedFilters.codeContext.language = aiResponse.programmingLanguage.toLowerCase();
      } else if (aiResponse.programmingLanguage) {
        // If programming language is specified but type is not 'code', set type to 'code'
        parsedFilters.contentType = 'code';
        if (!parsedFilters.codeContext) parsedFilters.codeContext = {};
        parsedFilters.codeContext.language = aiResponse.programmingLanguage.toLowerCase();
      }
      
      // Handle date filters with special handling for "today"
      if (aiResponse.dateFilter && (aiResponse.dateFilter.from || aiResponse.dateFilter.to)) {
        let fromDate = aiResponse.dateFilter.from;
        let toDate = aiResponse.dateFilter.to;
        
        // If "today" is mentioned, use today's date for both from and to
        if (normalizedQuery.toLowerCase().includes('today')) {
          const todayStr = today.toISOString().split('T')[0];
          fromDate = todayStr;
          toDate = todayStr;
        }
        
        parsedFilters.dateContext = {
          from: fromDate || '1970-01-01',
          to: toDate || new Date().toISOString().split('T')[0],
          hasTimeComponent: false
        };
      }
      
      // Handle source app
      if (aiResponse.sourceApp) {
        parsedFilters.source = aiResponse.sourceApp.toLowerCase();
      }
      
      // Handle keywords
      if (aiResponse.keywords && aiResponse.keywords.length > 0) {
        parsedFilters.searchTerms = aiResponse.keywords.map((term: string) => ({
          term: term.toLowerCase(),
          importance: 1,
          partialMatching: true
        }));
      }
      
      console.log('Parsed filters:', parsedFilters);
      
      // Set the searching state to false before returning
      setIsSearching(false);
      return parsedFilters;
    } catch (error) {
      console.error('Error in AI processing:', error);
      setIsSearching(false);
      return null;
    }
  };

  // Helper function to match a snippet by type
  const matchesTypeQuery = (snippet: Snippet, parsedFilters: ParsedFilters | null): boolean => {
    if (!parsedFilters) return true;
    
    // Start with the assumption that the snippet matches
    let matches = true;
    
    // Check date context if present
    if (parsedFilters.dateContext) {
      const { from, to } = parsedFilters.dateContext;
      const snippetDate = getDateFromTimestamp(snippet.timestamp);
      const fromDate = new Date(from);
      const toDate = new Date(to);
      
      // Set hours to ensure we're comparing full days
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      if (snippetDate < fromDate || snippetDate > toDate) {
        return false; // Date doesn't match, early return
      }
    }
    
    // Check content type
    if (parsedFilters.contentType) {
      const type = parsedFilters.contentType;
      
      // Direct type match
      if (type === 'code' && snippet.type !== 'code') {
        // For code, check if it might be code even if not marked as such
        const isCodeLike = looksLikeCode(snippet.content);
        if (!isCodeLike) return false;
      } 
      else if (type === 'url' && snippet.type !== 'link') {
        // For URLs, check if the content contains a URL pattern
        const hasUrl = /https?:\/\/[^\s]+/.test(snippet.content);
        if (!hasUrl) return false;
      }
      else if (type === 'image' && !/image|screenshot|picture|photo/i.test(snippet.type)) {
        return false;
      }
      else if (type === 'file' && !/file|document|pdf/i.test(snippet.type)) {
        return false;
      }
      else if (type === 'text' && (snippet.type === 'code' || snippet.type === 'link')) {
        return false;
      }
      else if (type === 'color' && snippet.type !== 'color') {
        // For color, check if it might be a color value even if not marked as 'color' type
        const isColorValue = isValidColor(snippet.content);
        if (!isColorValue) return false;
      }
    }
    
    // Check programming language for code snippets
    if (parsedFilters.codeContext?.language && snippet.type === 'code') {
      const lang = parsedFilters.codeContext.language.toLowerCase();
      const detectedLang = detectLanguageWithHljs(snippet.content)?.toLowerCase() || '';
      
      // Use fuzzy matching for language detection
      const langMatches = detectedLang.includes(lang) || 
                          (lang === 'js' && detectedLang.includes('javascript')) ||
                          (lang === 'py' && detectedLang.includes('python')) ||
                          (lang === 'ts' && detectedLang.includes('typescript'));
                          
      if (!langMatches) return false;
    }
    
    // Check source app
    if (parsedFilters.source && snippet.sourceApp?.name) {
      const sourceMatches = snippet.sourceApp.name.toLowerCase().includes(parsedFilters.source.toLowerCase());
      if (!sourceMatches) return false;
    }
    
    // Check keywords
    if (parsedFilters.searchTerms && parsedFilters.searchTerms.length > 0) {
      const allContentFields = [
        snippet.content,
        snippet.notes?.join(' ') || '',
        snippet.source,
        snippet.type
      ].join(' ').toLowerCase();
      
      const keywordMatches = parsedFilters.searchTerms.some(searchTerm => 
        allContentFields.includes(searchTerm.term.toLowerCase())
      );
      
      if (!keywordMatches) return false;
    }
    
    return matches;
  };

  // Helper function to match a specific content type
  const matchesContentType = (snippet: Snippet, contentType: string): boolean => {
    const aiType = contentType.toLowerCase();
    
    // Handle color type
    if (aiType === "color") {
      if (snippet.type.toLowerCase() === "color") {
        return true;
      }
      
      // Check if content might be a color value
      return isValidColor(snippet.content);
    }
    
    // Direct type matching - enforce strict type checking
    // This ensures we don't mix types in search results
    if (aiType === "url" || aiType === "link") {
      // For URL/link types, only match items that are actually URLs
      
      // First check if the snippet itself has link type
      if (snippet.type.toLowerCase() === "link") {
        return true;
      }
      
      // Check content for URL patterns
      if (snippet.content.match(/^https?:\/\/[^\s]+$/i)) {
        return true;
      }
      
      // Check for URL-like characteristics, but be more strict
      if (
        // Must look like a real URL or domain
        snippet.content.match(/^www\.[^\s]+\.[a-z]{2,}(\/|$)/i) ||
        snippet.content.match(/^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i)
      ) {
        return true;
      }
      
      // Reject content with error messages
      if (
        snippet.content.includes('Failed to load') || 
        snippet.content.includes('Error') ||
        snippet.content.includes('error when')
      ) {
        return false;
      }
      
      // Reject if it contains HTML/code syntax
      if (
        snippet.content.includes('<div') || 
        snippet.content.includes('<span') || 
        snippet.content.includes('<input') || 
        snippet.content.includes('function') ||
        snippet.content.includes('class=') ||
        looksLikeCode(snippet.content)
      ) {
        return false;
      }
      
      return false;
    }
    else if (aiType === "code") {
      // For code content, be more specific about what counts as code
      
      // First check if the snippet has code type
      if (snippet.type.toLowerCase() === "code") {
        return true;
      }
      
      // Exclude error messages that mention code but aren't code
      if (
        snippet.content.includes('Failed to load resource') || 
        snippet.content.includes('Error processing query') ||
        snippet.content.includes('(Bad Request)')
      ) {
        return false;
      }
      
      // Check if the content looks like code
      if (looksLikeCode(snippet.content)) {
        return true;
      }
      
      // Check specific code indicators that aren't caught by looksLikeCode
      const hasCodeCharacteristics = 
        // Has code fragments with balanced brackets
        ((snippet.content.includes('{') && snippet.content.includes('}')) ||
         (snippet.content.includes('(') && snippet.content.includes(')'))) &&
        // Has common coding syntax
        (snippet.content.includes('function ') ||
         snippet.content.includes('class ') ||
         snippet.content.includes('import ') ||
         snippet.content.includes('const ') ||
         snippet.content.includes('let ') ||
         snippet.content.includes('var ') ||
         // Has comment syntax
         snippet.content.includes('//') ||
         snippet.content.includes('/*') ||
         snippet.content.includes('*/') ||
         // Has HTML tags
         /<[^>]*>/.test(snippet.content) ||
         // Has indentation patterns common in code
         /^\s{2,}[\w]/m.test(snippet.content)
        );
      
      return hasCodeCharacteristics;
    }
    else if (aiType === "image") {
      // For image content, check for image-specific patterns
      
      // Direct match with type
      if (snippet.type.toLowerCase() === "image") {
        return true;
      }
      
      // Check for image file extensions
      if (snippet.content.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|tiff|ico|heic)$/i)) {
        return true;
      }
      
      // Check for image URLs
      if (snippet.content.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|svg|webp|bmp|tiff|ico)/i)) {
        return true;
      }
      
      // Check specific image content patterns
      const imageContentPatterns = [
        /screenshot of/i,
        /image of/i,
        /photo of/i,
        /picture of/i,
        /\.jpg$/i,
        /\.png$/i,
        /\.gif$/i
      ];
      
      for (const pattern of imageContentPatterns) {
        if (pattern.test(snippet.content)) {
          return true;
        }
      }
      
      return false;
    }
    else if (aiType === "file") {
      // For file content, check for file-specific patterns
      
      // Direct match with type
      if (snippet.type.toLowerCase() === "file") {
        return true;
      }
      
      // Check for file extensions
      if (snippet.content.match(/\.(pdf|docx?|xlsx?|pptx?|zip|tar|gz|rar|csv|txt|rtf|md|json|xml|mp3|mp4|mov|avi)$/i)) {
        return true;
      }
      
      // Check for file paths
      if (snippet.content.match(/^\/[\w\/]+\.\w+$/) ||
          snippet.content.match(/^[A-Z]:\\[\w\\]+\.\w+$/)) {
        return true;
      }
      
      // Check for specific file content patterns
      const fileContentPatterns = [
        /document/i,
        /spreadsheet/i,
        /presentation/i,
        /pdf/i,
        /excel/i,
        /word document/i,
        /powerpoint/i,
        /zip file/i,
        /compressed/i
      ];
      
      for (const pattern of fileContentPatterns) {
        if (pattern.test(snippet.content)) {
          return true;
        }
      }
      
      return false;
    }
    else if (aiType === "text") {
      // For text content, exclude other clearly identified types
      
      // Direct match with type
      if (snippet.type.toLowerCase() === "text" || snippet.type.toLowerCase() === "message") {
        return true;
      }
      
      // Exclude content that is clearly not text
      if (
        looksLikeCode(snippet.content) ||
        snippet.content.match(/^https?:\/\/[^\s]+$/) ||
        snippet.content.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|tiff)$/i) ||
        snippet.content.match(/\.(pdf|docx?|xlsx?|pptx?|zip|tar|gz|rar)$/i)
      ) {
        return false;
      }
      
      // Check for text content characteristics
      if (
        // Has multiple sentences
        snippet.content.match(/[.!?]\s[A-Z]/) ||
        // Has paragraphs
        snippet.content.includes('\n\n') ||
        // Not very short and doesn't look like code or URL
        (snippet.content.length > 50 && 
         !snippet.content.includes('{') && 
         !snippet.content.includes('<') &&
         !snippet.content.includes('function'))
      ) {
        return true;
      }
      
      return true; // Default to including as text if nothing else matches
    }
    
    // Default fallback to type comparison if no special handler
    return snippet.type.toLowerCase() === aiType;
  };

  // Simple helper function for date formatting
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // COMPREHENSIVE DATE PROCESSING - uses chrono to extract all possible date entities
  const processDateQueryWithAI = async (query: string): Promise<string | null> => {
    try {
      console.log("💬 Processing date query:", query);
      setIsSearching(true);
      
      // Define broader time periods that don't overlap
      const timePeriods: Record<string, {start: number, end: number}> = {
        'morning': { start: 5, end: 11 },
        'afternoon': { start: 12, end: 17 },
        'evening': { start: 18, end: 23 },
        'night': { start: 0, end: 5 },
        'midnight': { start: 0, end: 1 },
        'noon': { start: 12, end: 13 }
      };
      
      // Phase 1: Extract ALL possible dates using chrono
      try {
        console.log("🧠 Extracting ALL possible dates from query:", query);
        // Use casual parsing to handle natural language
        const results = chrono.casual.parse(query, new Date(), { forwardDate: false });
        console.log("📊 Chrono found dates:", results);
        
        // If we have at least one date
        if (results && results.length > 0) {
          // Collect all dates - handle both single dates and multiple dates for ranges
          const extractedDates = results.map(result => {
            const startDate = result.start.date();
            const endDate = result.end ? result.end.date() : null;
            const hasTime = result.start.isCertain('hour');
            
            return {
              startDate,
              endDate,
              hasTime
            };
          });
          
          console.log("📆 Extracted dates:", extractedDates);
          
          // Determine if we have a date range
          let rangeStart: Date;
          let rangeEnd: Date;
          let hasTimeComponent = false;
          
          if (extractedDates.length === 1) {
            // Single date mention
            const { startDate, endDate, hasTime } = extractedDates[0];
            rangeStart = startDate;
            rangeEnd = endDate || startDate; // If no end date, use start date
            hasTimeComponent = hasTime;
          } else if (extractedDates.length > 1) {
            // Multiple dates - likely a range like "April 30 and May 1"
            console.log("📏 Multiple dates detected, creating date range");
            // Find earliest and latest dates
            const allDates = extractedDates.flatMap(d => 
              [d.startDate, d.endDate].filter(Boolean) as Date[]
            );
            
            // Sort by timestamp
            allDates.sort((a, b) => a.getTime() - b.getTime());
            
            rangeStart = allDates[0];
            rangeEnd = allDates[allDates.length - 1];
            
            // Check if any of the dates have time components
            hasTimeComponent = extractedDates.some(d => d.hasTime);
          } else {
            // Should never happen since we checked results.length > 0
            throw new Error("No dates found");
          }
          
          // Check for time periods in the query text
          const lowerQuery = query.toLowerCase();
          let timePeriod: string | null = null;
          
          for (const period of Object.keys(timePeriods)) {
            if (lowerQuery.includes(period) || lowerQuery.includes(`around ${period}`)) {
              timePeriod = period;
              break;
            }
          }
          
          // Handle time periods if chrono didn't detect specific time
          if (!hasTimeComponent && timePeriod) {
            const hours = timePeriods[timePeriod];
            
            // Set the time range
            rangeStart.setHours(hours.start, 0, 0, 0);
            rangeEnd.setHours(hours.end, 59, 59, 999);
          } else if (!hasTimeComponent) {
            // Set full day range if no specific time
            rangeStart.setHours(0, 0, 0, 0);
            rangeEnd.setHours(23, 59, 59, 999);
          }
          
          // Format for storage
          const fromStr = rangeStart.toISOString().split('T')[0];
          const toStr = rangeEnd.toISOString().split('T')[0];
          const fromTime = hasTimeComponent ? rangeStart.toISOString().split('T')[1].substring(0, 8) : undefined;
          const toTime = hasTimeComponent ? rangeEnd.toISOString().split('T')[1].substring(0, 8) : undefined;
          
          // Create human-readable display string
          let displayText = "";
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          // Time period text
          const timeText = timePeriod || (hasTimeComponent ? 
            `at ${rangeStart.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}` : 
            "");
          
          if (rangeStart.toDateString() === today.toDateString() && 
              rangeEnd.toDateString() === today.toDateString()) {
            displayText = timeText ? `today ${timeText}` : "today";
          } else if (rangeStart.toDateString() === yesterday.toDateString() && 
                     rangeEnd.toDateString() === yesterday.toDateString()) {
            displayText = timeText ? `yesterday ${timeText}` : "yesterday";
          } else if (rangeStart.toDateString() === rangeEnd.toDateString() || 
                    (timePeriod === 'night' && rangeEnd.getDate() === rangeStart.getDate() + 1)) {
            // Single day or night (which spans to next day)
            displayText = timeText ?
              `${formatDateForDisplay(rangeStart)} ${timeText}` :
              formatDateForDisplay(rangeStart);
          } else {
            // Date range
            displayText = `${formatDateForDisplay(rangeStart)} to ${formatDateForDisplay(rangeEnd)}`;
            if (timeText) {
              displayText += ` ${timeText}`;
            }
          }
          
          // Set for filtering
          setParsedFilters(prevFilters => ({
            ...(prevFilters || {}),
            dateContext: {
              from: fromStr,
              to: toStr,
              fromTime,
              toTime,
              hasTimeComponent: Boolean(hasTimeComponent)
            }
          }));
          
          setProcessedDateQuery(displayText);
          console.log("📅 Date processed:", displayText, { 
            fromDate: rangeStart, 
            toDate: rangeEnd, 
            hasTime: Boolean(hasTimeComponent),
            timePeriod 
          });
          
          setIsSearching(false);
          return displayText;
        } else {
          console.log("❌ Chrono couldn't parse the date");
        }
      } catch (chronoError) {
        console.error("❌ Error with chrono parsing:", chronoError);
      }
      
      // STEP 2: Try direct pattern matching for common phrases
      const timePatterns = [
        // Yesterday morning/afternoon/evening/night
        {regex: /yesterday\s+(morning|afternoon|evening|night|midnight|noon)/i, handler: (matches: RegExpMatchArray) => {
          const period = matches[1].toLowerCase();
          if (!timePeriods[period]) return null;
          
          const hours = timePeriods[period];
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          const startDate = new Date(yesterday);
          const endDate = new Date(yesterday);
          
          startDate.setHours(hours.start, 0, 0, 0);
          
          // For overnight periods like night
          if (hours.start > hours.end) {
            endDate.setDate(endDate.getDate() + 1); // Next day
            endDate.setHours(hours.end, 59, 59, 999);
          } else {
            endDate.setHours(hours.end, 59, 59, 999);
          }
          
          return {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0],
            fromTime: startDate.toISOString().split('T')[1].substring(0, 8),
            toTime: endDate.toISOString().split('T')[1].substring(0, 8),
            display: `yesterday ${period}`,
            hasTimeComponent: true
          };
        }}
      ];
      
      // Try to match additional patterns
      const lowerQuery = query.toLowerCase();
      for (const pattern of timePatterns) {
        const matches = lowerQuery.match(pattern.regex);
        if (matches) {
          console.log("🎯 Pattern match:", matches[0]);
          
          const dateInfo = pattern.handler(matches);
          if (dateInfo) {
            console.log("📆 Pattern handler result:", dateInfo);
            
            // Store in filters
            setParsedFilters(prevFilters => ({
              ...(prevFilters || {}),
              dateContext: {
                from: dateInfo.from,
                to: dateInfo.to,
                fromTime: dateInfo.fromTime,
                toTime: dateInfo.toTime,
                hasTimeComponent: dateInfo.hasTimeComponent
              }
            }));
            
            setProcessedDateQuery(dateInfo.display);
            setIsSearching(false);
            return dateInfo.display;
          }
        }
      }
      
      // STEP 3: Fall back to AI if previous methods didn't work and smart search is enabled
      if (isSmartSearch) {
        console.log("🤖 Falling back to AI for date parsing");
        
        const GEMINI_API_KEY = "AIzaSyD34gajq_HMIwEc-y9ttVghZL1QRPkLxMI";
        if (!GEMINI_API_KEY) {
          console.error("❌ No Gemini API key available");
          setIsSearching(false);
          return null;
        }
        
        // Create today date for context
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Create a very clear prompt
        const prompt = `
Extract the date or date range plus time (if present) from this query: "${query}"
Current date: ${todayStr}

Instructions:
- If the query contains a specific date, return that date
- If the query contains a time (morning, afternoon, evening, night, specific time), include it with EXACT hour ranges:
  * Morning: 5:00am-12:00pm (05:00:00-12:00:00)
  * Afternoon: 12:00pm-6:00pm (12:00:00-18:00:00)
  * Evening: 6:00pm-10:00pm (18:00:00-22:00:00)
  * Night: 10:00pm-4:00am (22:00:00-04:00:00)
  * Midnight: 12:00am-1:00am (00:00:00-01:00:00)
  * Noon: 12:00pm-1:00pm (12:00:00-13:00:00)
- Return a precise date range with start/end dates
- For single days, use the same date for both from/to
- For overnight periods like "night", the end date should be the next day
- For "May 1 night", understand it means May 1 at night (10pm) to May 2 at 4am
- For "April 30 around morning", understand it means April 30 from 5am to 12pm
- Don't make up dates if none are present

Return ONLY a JSON object:
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "fromTime": "HH:MM:SS", // if time specified, otherwise null
  "toTime": "HH:MM:SS", // if time specified, otherwise null
  "display": "human friendly description"
}

Examples:
- "yesterday evening" → {"from": "2023-04-01", "to": "2023-04-01", "fromTime": "18:00:00", "toTime": "22:00:00", "display": "yesterday evening"}
- "May 1 night" → {"from": "2023-05-01", "to": "2023-05-02", "fromTime": "22:00:00", "toTime": "04:00:00", "display": "May 1 night"}
- "april 30 around morning" → {"from": "2023-04-30", "to": "2023-04-30", "fromTime": "05:00:00", "toTime": "12:00:00", "display": "April 30 morning"}
- "last week" → {"from": "2023-03-26", "to": "2023-04-01", "fromTime": null, "toTime": null, "display": "last week"}
`;
        
        try {
          console.log("📡 Calling Gemini API...");
          
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.1,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              }
            })
          });
          
          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log("📊 Gemini API response:", data);
          
          if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("❌ Invalid API response format");
            setIsSearching(false);
            return null;
          }
          
          // Parse the response
          const responseText = data.candidates[0].content.parts[0].text;
          console.log("📝 Raw API response text:", responseText);
          
          try {
            // Clean the response
            const cleanedJson = responseText.replace(/```json\n|\n```|```/g, '').trim();
            const dateInfo = JSON.parse(cleanedJson);
            console.log("🗓️ Parsed date info from AI:", dateInfo);
            
            if (dateInfo && dateInfo.from && dateInfo.to && dateInfo.display) {
              // Store in filters
              setParsedFilters(prevFilters => ({
                ...(prevFilters || {}),
                dateContext: {
                  from: dateInfo.from,
                  to: dateInfo.to,
                  fromTime: dateInfo.fromTime === "null" ? undefined : dateInfo.fromTime,
                  toTime: dateInfo.toTime === "null" ? undefined : dateInfo.toTime,
                  hasTimeComponent: Boolean(dateInfo.fromTime && dateInfo.fromTime !== "null")
                }
              }));
              
              // Set display
              setProcessedDateQuery(dateInfo.display);
              
              console.log("✅ Successfully parsed date with AI:", dateInfo.display);
              
              setIsSearching(false);
              return dateInfo.display;
            }
          } catch (jsonError) {
            console.error("❌ Error parsing JSON from API:", jsonError);
            console.log("Raw response:", responseText);
          }
        } catch (apiError) {
          console.error("❌ Error calling Gemini API:", apiError);
        }
      }
      
      // All parsing failed
      console.log("⚠️ All date parsing methods failed - returning original query");
      setIsSearching(false);
      return query;
    } catch (error) {
      console.error("❌ Global error in processDateQueryWithAI:", error);
      setIsSearching(false);
      return null;
    }
  };

  // Enhanced matching function with precise time handling
  const matchesDateQuery = (timestamp: string, query: string): boolean => {
    console.log("📅 Checking timestamp:", timestamp, "against query:", query);
    
    // Check for specific exact match pattern for debugging
    if (query.toLowerCase().includes("april 30 evening")) {
      const snippetDate = getDateFromTimestamp(timestamp);
      const isApril30 = snippetDate.getMonth() === 3 && snippetDate.getDate() === 30;
      const isEvening = snippetDate.getHours() >= 18 && snippetDate.getHours() <= 23;
      console.log(`🔍 April 30 evening check: isApril30=${isApril30}, isEvening=${isEvening}, hour=${snippetDate.getHours()}`);
    }
    
    // Case 1: If we have parsed filters from AI or chrono, use those for precise matching
    if (parsedFilters && parsedFilters.dateContext && parsedFilters.dateContext.from && parsedFilters.dateContext.to) {
      console.log("🔍 Matching using parsed filters:", parsedFilters.dateContext);
      
      try {
        const snippetDate = getDateFromTimestamp(timestamp);
        console.log("📌 Snippet timestamp:", timestamp);
        console.log("📌 Snippet date object:", snippetDate.toString());
        console.log("📌 Snippet month/day/hour:", snippetDate.getMonth(), snippetDate.getDate(), snippetDate.getHours());
        
        const fromDate = new Date(parsedFilters.dateContext.from);
        const toDate = new Date(parsedFilters.dateContext.to);
        
        // Apply time if available
        if (parsedFilters.dateContext.hasTimeComponent && parsedFilters.dateContext.fromTime) {
          console.log("⏰ Using time components for matching");
          const [fromHours, fromMinutes, fromSeconds] = parsedFilters.dateContext.fromTime.split(':').map(Number);
          fromDate.setHours(fromHours, fromMinutes, fromSeconds);
          
          if (parsedFilters.dateContext.toTime) {
            const [toHours, toMinutes, toSeconds] = parsedFilters.dateContext.toTime.split(':').map(Number);
            toDate.setHours(toHours, toMinutes, toSeconds);
          }
          
          console.log("⏰ Time filter range:", 
            `${fromDate.getHours()}:${fromDate.getMinutes()} to ${toDate.getHours()}:${toDate.getMinutes()}`);
        } else {
          // Full day range
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
        }
        
        console.log(`⏱️ Comparing date ranges: ${fromDate.toISOString()} to ${toDate.toISOString()}`);
        
        let matches = false;
        
        // Special handling for overnight ranges like night (10pm-4am)
        if (parsedFilters.dateContext.hasTimeComponent && 
            parsedFilters.dateContext.fromTime && 
            parsedFilters.dateContext.toTime) {
          
          const fromHour = parseInt(parsedFilters.dateContext.fromTime.split(':')[0]);
          const toHour = parseInt(parsedFilters.dateContext.toTime.split(':')[0]);
          
          // If it's an overnight range (fromHour > toHour)
          if (fromHour > toHour) {
            console.log("🌙 Handling overnight range (night)");
            const snippetHour = snippetDate.getHours();
            
            // Either the time is after the start hour on the start date
            // OR the time is before the end hour on the end date
            const sameStartDate = snippetDate.getFullYear() === fromDate.getFullYear() &&
                                  snippetDate.getMonth() === fromDate.getMonth() &&
                                  snippetDate.getDate() === fromDate.getDate();
            
            const sameEndDate = snippetDate.getFullYear() === toDate.getFullYear() &&
                                snippetDate.getMonth() === toDate.getMonth() &&
                                snippetDate.getDate() === toDate.getDate();
            
            if ((sameStartDate && snippetHour >= fromHour) || 
                (sameEndDate && snippetHour <= toHour)) {
              matches = true;
            }
          } else {
            // For normal time range (e.g. evening: 6pm-11:59pm)
            const sameDate = snippetDate.getFullYear() === fromDate.getFullYear() &&
                            snippetDate.getMonth() === fromDate.getMonth() &&
                            snippetDate.getDate() === fromDate.getDate();
            
            const withinHours = snippetDate.getHours() >= fromHour && 
                               snippetDate.getHours() <= toHour;
            
            console.log(`🔍 Date/Time match check: sameDate=${sameDate}, withinHours=${withinHours}, snippetHour=${snippetDate.getHours()}, range=${fromHour}-${toHour}`);
            
            if (sameDate && withinHours) {
              matches = true;
            }
          }
        } else {
          // Standard date comparison for non-time-specific queries
          matches = snippetDate >= fromDate && snippetDate <= toDate;
        }
        
        console.log(`${matches ? '✅' : '❌'} Match result:`, matches);
        return matches;
      } catch (error) {
        console.error("❌ Error in date comparison:", error);
      }
    }
    
    // Case 2: Try direct string matching for common terms
    console.log("📝 No parsed filters, using simple query matching");
    const snippetDate = getDateFromTimestamp(timestamp);
    const formattedDate = snippetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).toLowerCase();
    
    const lowerQuery = query.toLowerCase();
    const matched = formattedDate.includes(lowerQuery);
    console.log(`${matched ? '✅' : '❌'} String match result for "${lowerQuery}" in "${formattedDate}":`, matched);
    return matched;
  };

  // Helper function to match by app source
  const matchesAppQuery = (snippet: Snippet, appQuery: string | undefined): boolean => {
    if (!appQuery) return true;
    
    const source = snippet.source.toLowerCase();
    const sourceApp = snippet.sourceApp?.name?.toLowerCase() || '';
    const appQueryLower = appQuery.toLowerCase();
    
    // Direct matches
    return source.includes(appQueryLower) || sourceApp.includes(appQueryLower);
  };
  
  // Compute filtered snippets
  const displayedSnippets = useMemo(() => {
    // If we're filtering, use the filtered snippets instead of the captured ones
    let snippetsToUse = isFiltering ? filteredSnippets : capturedSnippets;
    
    // Apply filters based on current view
    let filtered = isDemoMode ? demoSnippets : snippetsToUse;

    // First filter by view (favorites/all)
    if (activeView === 'favorites') {
      filtered = filtered.filter(snippet => snippet.isFavorite);
    }

    // Then filter by selected app if not "all"
    if (selectedApp !== 'all') {
      filtered = filtered.filter(snippet => {
        return snippet.sourceApp?.name === selectedApp || 
               (!snippet.sourceApp?.name && selectedApp === 'Unknown');
      });
    }

    // Apply type and date filters from parsedFilters if available
    if (parsedFilters) {
      let intermediateFiltered = [...filtered]; // Start with the base filtered list

      // Apply ALL relevant filters found in parsedFilters
      intermediateFiltered = intermediateFiltered.filter(snippet => 
        matchesTypeQuery(snippet, parsedFilters)
      );

      // Update the main filtered list
      filtered = intermediateFiltered;
    }

    // Apply search query filter if not a command
    if (searchInput && !searchInput.trim().startsWith('/')) {
      filtered = basicTextMatch(filtered, searchInput.toLowerCase());
    }

    // Apply sorting based on user preference
    return sortType === 'newest' 
      ? filtered.sort(sortByNewest)
      : filtered.sort(sortByOldest);
  }, [
    capturedSnippets, 
    filteredSnippets,
    isFiltering,
    demoSnippets,
    isDemoMode,
    activeView, 
    selectedApp, 
    processedDateQuery, 
    parsedFilters,
    sortType
  ]);
  
  // Helper function to save snippets to localStorage
  const saveSnippetsToLocalStorage = (snippets: Snippet[]) => {
    console.log(`[Save] Attempting to save ${snippets.length} snippets...`);
    if (snippets.length === 0) {
      console.warn('[Save] Attempting to save an empty array. This might clear localStorage.');
    }
    try {
      // Serialize the original snippets (including icons) to JSON and store in localStorage
      const snippetsJson = JSON.stringify(snippets);
      console.log('[Save] Saving JSON data (first 100 chars):', snippetsJson.substring(0, 100) + '...');
      localStorage.setItem('saved_snippets', snippetsJson);
      console.log("[Save] Snippets saved successfully to localStorage.");
    } catch (error) {
      // Check specifically for QuotaExceededError
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error("❌💾 [Save] QuotaExceededError: LocalStorage is full. Cannot save snippets. Consider adding a 'Clear All' button or implementing storage limits.");
        // Optionally, notify the user or implement an LRU cache here
      } else {
        console.error("❌ [Save] Error saving snippets to localStorage:", error);
      }
    }
  };

  // Effect to save snippets whenever they change
  useEffect(() => {
    console.log('[Save Effect] useEffect triggered. hasLoadedRef.current:', hasLoadedRef.current, 'Snippets count:', capturedSnippets.length);
    // Don't save during the initial load, as loadInitialSnippets handles that
    if (hasLoadedRef.current) {
      console.log('[Save Effect] Calling saveSnippetsToLocalStorage...');
      saveSnippetsToLocalStorage(capturedSnippets);
    } else {
      // Mark initial load as complete after the first render
      console.log('[Save Effect] Initial load detected, marking hasLoadedRef.current = true');
      hasLoadedRef.current = true;
    }
  }, [capturedSnippets]); // Dependency array ensures this runs when capturedSnippets changes
  // Update copyToClipboard function
  const copyToClipboard = (text: string, snippetId: string) => {
    // Mark this copy operation as initiated by the copy button
    lastCaptureRef.current = {
      text: text,
      timestamp: Date.now(),
      fromCopyButton: true
    };
    
    // Copy to clipboard
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log("✓ Content copied to clipboard from button");
        setCopiedId(snippetId); // Set the copied snippet ID
        // Reset the copied state and flag after a delay
        setTimeout(() => {
          setCopiedId(null);
          lastCaptureRef.current.fromCopyButton = false;
        }, 2000); // Reset after 2 seconds
      })
      .catch(err => {
        console.error("❌ Error copying to clipboard:", err);
      });
  };

  // Effect to listen for Tauri clipboard events and perform language detection
  useEffect(() => {
    console.log("🔄 Setting up clipboard listener with Heuristics + Refined Groq Classification");
    let unlistenClipboard: (() => void) | undefined;

    const detectLanguageAndAddSnippet = async (text: string, sourceApp?: { name: string, base64_icon?: string }) => {
      if (!text || !text.trim()) {
        console.log("🚫 Empty clipboard content, skipping");
        return;
      }

      // Default tag
      let tags: string[] = ['clipboard'];
      let methodUsed = 'default';
      let contentType = 'text';
      let confidence = 1.0;

      // Check if it's a color
      if (isValidColor(text.trim())) {
        tags = ['color', 'design'];
        methodUsed = 'regex-color';
        console.log(`✅ Detected color via regex`);
        contentType = 'color';
      }
      // Quick URL check (keep this for immediate tagging of obvious URLs)
      else if (urlRegex.test(text)) {
        tags = ['link', 'url'];
        methodUsed = 'regex-url';
        console.log(`✅ Detected link via regex`);
        contentType = 'link';
      } else {
        // Use Groq for comprehensive tag analysis
        try {
          console.log("🧠 Calling Groq API for content tagging...");
          // Get API key from env or use fallback
          const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "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";
          
          // Don't try to call the API if we don't have a key
          if (!GROQ_API_KEY) {
            throw new Error("No Groq API key provided");
          }
          
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content: `You are ClipTagger, an expert programming language classifier and content analyzer who can identify the most relevant tag categories for any type of content.

Your task is to analyze clipboard content and generate appropriate tags that accurately describe the content type, especially for code snippets.

IMPORTANT RULES:
1. Return ONLY a JSON object with "tags" array and "confidence" score (0.0-1.0)
2. Tags must be all lowercase, single words or short hyphenated phrases
3. Focus on identifying the MAIN content type and format, not what it's about
4. For code snippets, be EXTREMELY precise about the programming language - NEVER default to JavaScript
5. Analyze syntax patterns, keywords, and indentation carefully to determine the correct language
6. Never return empty tags array - always include at least "text" if nothing else applies
7. Assign higher confidence (0.9-1.0) for clear classifications, lower (0.5-0.8) for uncertain ones

Programming language identification guidelines:
- Look for language-specific keywords, syntax and patterns
- JavaScript: function, const, let, var, =>
- TypeScript: interface, type, :string, :number, <>
- Python: def, elif, import, __init__, indentation without braces
- HTML: <html>, <div>, <body>, tag structures
- CSS: selectors, {property: value}, @media
- Java: public class, public static void main, System.out.println
- C++: #include, std::, iostream, vectors
- C#: using System, namespace, Console.WriteLine
- Go: package main, func, fmt.Println, :=
- Rust: fn, let mut, impl, match, Option<>
- SQL: SELECT, FROM, WHERE, JOIN
- PHP: <?php, echo, $variables
- Ruby: def, end, require, puts
- Shell/Bash: #!/bin/bash, echo $, command patterns

The most important categories to consider:
- code (with specific language detected) 
- link, url, web-address
- email, contact-info
- error-message, log, stack-trace
- password, credential, api-key, token
- todo-item, list, checklist
- file-path, directory
- timestamp, date-time
- table, csv, tabular-data
- quote, citation
- question, answer
- markdown, formatting
- formula, equation, math
- json, yaml, xml
- command, terminal, shell
- structured-data

Example outputs:
1. For JavaScript code:
{
  "tags": ["code", "javascript"],
  "confidence": 0.95
}

2. For Python code:
{
  "tags": ["code", "python"],
  "confidence": 0.95
}

3. For a shopping list:
{
  "tags": ["list", "todo-item"],
  "confidence": 0.9
}

4. For an error message:
{
  "tags": ["error-message", "stack-trace"],
  "confidence": 0.85
}`
                },
                {
                  role: "user",
                  content: `Analyze this clipboard content and generate ALL possible broad tag categories:

"""
${text.substring(0, 1500)}
"""

Respond ONLY with a JSON object with "tags" array and "confidence" score.`
                },
              ],
              model: "llama3-8b-8192",
              temperature: 0.2,
              max_tokens: 150,
              response_format: { type: "json_object" },
            }),
          });

          if (!response.ok) {
            throw new Error(`Groq API error: ${response.statusText}`);
          }

          const data = await response.json();
          const result = data.choices[0]?.message?.content;

          if (result) {
            try {
              const classification = JSON.parse(result);
              
              if (classification.tags && Array.isArray(classification.tags) && classification.tags.length > 0) {
                // Use the dynamically generated tags, but limit to 2 most relevant tags
                tags = classification.tags
                  .map((tag: string) => tag.toLowerCase())
                  // Prioritize tags (keep them unique)
                  .filter((tag: string, index: number, self: string[]) => self.indexOf(tag) === index);
                
                // Select only 2 most relevant tags
                // - Keep 'code' and its language if present
                // - Keep specific content type identifiers over generic ones
                const codeTag = tags.findIndex(tag => tag === 'code');
                const languageTag = tags.findIndex(tag => [
                  'javascript', 'typescript', 'python', 'html', 'css', 
                  'java', 'c++', 'csharp', 'c#', 'go', 'rust', 'sql', 
                  'php', 'ruby', 'swift', 'kotlin', 'bash', 'shell', 
                  'yaml', 'json', 'xml', 'markdown'
                ].includes(tag));
                
                // Priority tags that should be kept if present
                const priorityTags = ['link', 'url', 'email', 'error-message', 'table', 'json', 'list', 'todo-item', 'markdown'];
                
                // Low priority tags that should be selected last
                const lowPriorityTags = ['text', 'clipboard', 'snippet', 'content'];
                
                // Create a priority-sorted array of tags
                let sortedTags: string[] = [];
                
                // First add code+language pair if both exist
                if (codeTag !== -1 && languageTag !== -1) {
                  sortedTags.push(tags[codeTag], tags[languageTag]);
                  contentType = 'code';
                }
                // Then add code alone if it exists
                else if (codeTag !== -1) {
                  sortedTags.push(tags[codeTag]);
        contentType = 'code';
        
                  // If code exists but no language was detected, try highlight.js
                  const hljsResult = detectLanguageWithHljs(text);
                  if (hljsResult) {
                    sortedTags.push(hljsResult);
                  }
                }
                
                // Then add any priority tags
                priorityTags.forEach(pTag => {
                  const tagIndex = tags.findIndex(tag => tag === pTag);
                  if (tagIndex !== -1 && !sortedTags.includes(tags[tagIndex])) {
                    sortedTags.push(tags[tagIndex]);
                    if (pTag === 'link' || pTag === 'url') {
                      contentType = 'link';
                    }
                  }
                });
                
                // Then add remaining tags except low priority ones
                tags.forEach(tag => {
                  if (!sortedTags.includes(tag) && !lowPriorityTags.includes(tag)) {
                    sortedTags.push(tag);
                  }
                });
                
                // Finally, add low priority tags if needed
                if (sortedTags.length < 2) {
                  lowPriorityTags.forEach(pTag => {
                    const tagIndex = tags.findIndex(tag => tag === pTag);
                    if (tagIndex !== -1 && !sortedTags.includes(tags[tagIndex])) {
                      sortedTags.push(tags[tagIndex]);
                    }
                  });
                }
                
                // Limit to 2 tags
                tags = sortedTags.slice(0, 2);
                
                // Set confidence if available
                if (typeof classification.confidence === 'number') {
                  confidence = classification.confidence;
                }
                
                methodUsed = 'Groq API';
                console.log(`✅ Groq tagging result (limited to top 2 tags):`, tags);
              } else {
                console.log("🤔 Groq API returned invalid tags format.");
              }
            } catch (parseError) {
              console.error("❌ Error parsing Groq JSON response:", parseError, "Raw response:", result);
              // Use default tags on error
              tags = ['clipboard', 'text'];
            }
          } else {
            console.log("🤔 Groq API did not return a valid response.");
          }
        } catch (error) {
          console.error("❌ Error calling Groq API:", error);
          // Fallback to basic code detection
          if (looksLikeCode(text)) {
            // First try with highlight.js
            const hljsResult = detectLanguageWithHljs(text);
            if (hljsResult) {
              tags = ['code', hljsResult];
              methodUsed = 'fallback-highlight.js';
              contentType = 'code';
            } else {
              // Just generic code tag if language can't be determined
              tags = ['code', 'snippet'];
              methodUsed = 'fallback-heuristics';
              contentType = 'code';
            }
          } else {
            // Try to detect obvious content types based on patterns
            if (/^https?:\/\/\S+/i.test(text)) {
              tags = ['link', 'url'];
              methodUsed = 'fallback-regex';
              contentType = 'link';
            } else if (/^([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i.test(text)) {
              tags = ['email', 'contact-info'];
              methodUsed = 'fallback-regex';
            } else if (/Error:|Exception:|FATAL:|WARNING:|^Stack trace:|\bat\s+[\w\.$]+\([^)]+\)/im.test(text)) {
              tags = ['error-message', 'log'];
              methodUsed = 'fallback-regex';
            } else if (/^\s*[\*\-\+]\s|^\d+\.\s/m.test(text) && text.split('\n').length > 2) {
              tags = ['list', 'text'];
              methodUsed = 'fallback-regex';
            } else if (sourceApp?.name === 'Messages' || sourceApp?.name === 'iMessage' || /^[A-Z][a-z]+:.*/.test(text)) {
              tags = ['message', 'conversation'];
              methodUsed = 'fallback-regex';
              contentType = 'message';
            } else if (/\b(def|class|function|import|export|const|let|var|return|if|else|for|while)\b/.test(text)) {
              // More code patterns that might not be caught by looksLikeCode
              tags = ['code', 'snippet'];
              methodUsed = 'fallback-keywords';
              contentType = 'code';
            } else if (/\b(todo|task|reminder|don't forget|remember to)\b/i.test(text)) {
              tags = ['todo', 'task'];
              methodUsed = 'fallback-keywords';
            } else if (/\b(meeting|agenda|schedule|calendar|appointment)\b/i.test(text)) {
              tags = ['meeting', 'schedule'];
              methodUsed = 'fallback-keywords';
            } else if (text.length > 300) {
              tags = ['text', 'paragraph'];
              methodUsed = 'fallback-length';
            } else if (text.split('\n').length > 3) {
              tags = ['multiline', 'text'];
              methodUsed = 'fallback-format';
            } else if (/\b(hello|hi|hey|what's up|howdy)\b/i.test(text.substring(0, 100))) {
              tags = ['greeting', 'message'];
              methodUsed = 'fallback-keywords';
            } else if (/^[A-Z].*[.!?]$/.test(text) && text.length < 200) {
              tags = ['sentence', 'text'];
              methodUsed = 'fallback-format';
            } else {
              // Just use default tag for plain text
              tags = ['text', 'clipboard'];
              methodUsed = 'fallback-default';
            }
          }
        }
      }

      // Ensure tags array is unique and has at least 2 tags
      tags = [...new Set(tags)];
      if (tags.length < 2) {
        if (tags[0] === 'clipboard') {
          tags.push('text');
        } else {
          tags.push('clipboard');
        }
      }

      // Create a new snippet
      const newSnippet: Snippet = {
        id: `snippet-${Date.now()}`,
        type: contentType as 'text' | 'code' | 'link' | 'color',
        content: text,
        source: sourceApp?.name || 'Clipboard',
        timestamp: formatTimestamp(new Date()),
        tags: tags,
        isFavorite: false,
        sourceApp: sourceApp
      } as Snippet;

      // Add path for code snippets
      if (contentType === 'code') {
        (newSnippet as CodeSnippet).path = 'clipboard-code';
      }
      
      // Add title for link snippets
      if (contentType === 'link') {
        // Don't set a duplicate title for link snippets
        // The link will be shown in the content area only
        (newSnippet as LinkSnippet).title = '';
      }

      // Add color value for color snippets
      if (contentType === 'color') {
        (newSnippet as ColorSnippet).colorValue = extractColorValue(text);
      }

      // Detect message type content for better classification
      if (contentType === 'text' && (
          // Check for message-like patterns
          (sourceApp?.name === 'Messages' || sourceApp?.name === 'iMessage') ||
          /^[A-Z][a-z]+:.*/.test(text) || // Name followed by colon
          /^[A-Z][a-z]+ [A-Z][a-z]+:.*/.test(text) || // First and last name followed by colon
          text.includes(': ') || // Any name-like pattern with colon
          // Check for conversation-like content
          (/\b(said|says|replied|wrote|told|asked)\b/i.test(text) && text.length < 1000)
      )) {
        // It's likely a message/conversation
        contentType = 'message';
        (newSnippet as MessageSnippet).type = 'message';
        (newSnippet as MessageSnippet).contact = sourceApp?.name || 'Unknown';
        
        // Ensure message content gets proper tags
        if (tags.includes('clipboard') && tags.length < 2) {
          tags = ['message', 'conversation'];
        } else if (tags[0] === 'clipboard') {
          tags[0] = 'message';
        } else if (tags.length === 1) {
          tags.push('message');
        }
      }

      // Ensure tags are appropriate and there are at least 2
      if (tags.length < 2) {
        // Add a second tag based on content type
        if (contentType === 'code' && !tags.includes('code')) {
          tags.push('code');
        } else if (contentType === 'link' && !tags.includes('link')) {
          tags.push('link');
        } else if (contentType === 'message' && !tags.includes('message')) {
          tags.push('message');
        } else if (!tags.includes('text')) {
          tags.push('text');
        }
      }

      // If we still have only generic tags, add more specific ones
      if (tags.length === 2 && tags.includes('clipboard') && tags.includes('text')) {
        // Try to identify content more specifically
        if (/\b(hello|hi|hey|greetings)\b/i.test(text.substring(0, 100))) {
          tags = ['greeting', 'message'];
        } else if (/\b(question|why|how|what|when|where|who)\b/i.test(text)) {
          tags = ['question', 'text'];
        } else if (/\b(thank|thanks|appreciate)\b/i.test(text)) {
          tags = ['thanks', 'message'];
        } else if (text.split('\n').length > 3) {
          tags = ['multiline', 'text'];
        } else if (text.length > 150) {
          tags = ['paragraph', 'text'];
        } else {
          tags = ['snippet', 'text'];
        }
      }

      console.log(`✅ Adding new snippet with tags: ${tags.join(', ')} (detection method: ${methodUsed}, confidence: ${confidence})`);

      // Add the new snippet to the state - always add to capturedSnippets, not displayedSnippets
      setCapturedSnippets(prev => {
        // Check for duplicate content to avoid adding the same thing twice
        const isDuplicate = prev.some(s => s.content === text);
        if (isDuplicate) {
          console.log("⚠️ Duplicate content detected, not adding snippet");
          return prev;
        }
        
        const updatedSnippets = [newSnippet, ...prev];
        saveSnippetsToLocalStorage(updatedSnippets);
        return updatedSnippets;
      });
      
      // When in search mode, and if the new snippet matches the search criteria, 
      // clear the search to show all snippets including the new one
      if (searchInput.trim()) {
        const normalizedQuery = searchInput.toLowerCase().trim();
        const contentMatch = text.toLowerCase().includes(normalizedQuery);
        const sourceMatch = (sourceApp?.name || 'Clipboard').toLowerCase().includes(normalizedQuery);
        const tagMatch = tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
        
        if (contentMatch || sourceMatch || tagMatch) {
          // Clear search if the new snippet matches the current search
          setSearchInput('');
          setFilteredSnippets([]);
          setIsFiltering(false);
        }
      }
    };

    const setupListener = async () => {
      try {
        const unlistenFn = await listen<{text: string, source_app: {name: string, base64_icon?: string}}>("clipboard-new-text", (event) => {
          const { text, source_app } = event.payload;
          const now = Date.now();

          // Basic checks (duplicate, copy button)
          if (lastCaptureRef.current.fromCopyButton) return;
          if (text === lastCaptureRef.current.text && now - lastCaptureRef.current.timestamp < 500) return;

          lastCaptureRef.current = { text, timestamp: now, fromCopyButton: false };
          console.log("📋 Clipboard event received:", text.substring(0, 30) + "... from " + source_app.name);
          detectLanguageAndAddSnippet(text, source_app);
        });
        
        unlistenClipboard = unlistenFn;
        console.log("✓ Clipboard listener setup complete (Heuristics + Groq Classification)");
      } catch (error) {
        console.error("❌ Failed to set up Tauri clipboard listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unlistenClipboard) unlistenClipboard();
      console.log("🧹 Cleaned up clipboard listener");
    };
  }, []);

  // Get the appropriate icon for a snippet source
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'VS Code':
        return (
          <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M74.9 9.72L61.55 4.56C59.88 3.89 58 4.12 56.52 5.14L17.27 35.93C15.3 37.5 14.96 40.37 16.53 42.34C16.71 42.57 16.9 42.77 17.11 42.95L19.7 45.18C21.14 46.39 23.17 46.65 24.86 45.83L75.41 21.46C76.56 20.91 77.87 22.05 77.4 23.24L27.27 93.56C26.23 95.16 27.01 97.27 28.84 97.83L40.9 101.71C42.04 102.06 43.27 101.82 44.21 101.07L83.47 70.28C85.44 68.71 85.78 65.84 84.21 63.87C84.03 63.63 83.84 63.43 83.63 63.26L81.05 61.03C79.6 59.82 77.58 59.56 75.88 60.38L24.55 84.3C23.4 84.85 22.09 83.71 22.56 82.52L72.68 12.2C73.73 10.6 72.95 8.49 71.11 7.93L74.9 9.72Z" fill="#007ACC"/>
          </svg>
        );
      case 'Twitter':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.15l-5.214-6.817L4.95 21.75H1.64l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#1DA1F2"/>
          </svg>
        );
      case 'Medium':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" fill="#000"/>
          </svg>
        );
      case 'Notes':
      case 'Clipboard':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zM19 19.09H5V4.91h14v14.18zM6 15h12v2H6zm0-4h12v2H6zm0-4h12v2H6z" fill="#FFA500"/>
          </svg>
        );
      case 'Browser':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 22h16a2 2 0 002-2V8l-6-6H4a2 2 0 00-2 2v16a2 2 0 002 2zM4 8l6 6V8H4zm10 12a2 2 0 002-2h4V8h-6v12zm2-14h6v12h-6V6z" fill="#4285F4"/>
          </svg>
        );
      case 'iMessage':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#34C759"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 5v14H5V5h14zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="#6B7280"/>
            <path d="M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="#6B7280"/>
          </svg>
        );
    }
  };

  // Toggle notes editing UI for a snippet
  const toggleNoteEditing = (id: string) => {
    setEditingNotesIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(noteId => noteId !== id);
      }
      return [...prev, id];
    });
    setCurrentNote('');
  };

  // Add a new note to a snippet
  const addNote = (snippet: Snippet, noteText: string) => {
    if (!noteText.trim()) return;

    setCapturedSnippets(prevSnippets => {
      const updatedSnippets = prevSnippets.map(s => {
        if (s.id === snippet.id) {
          const updatedNotes = s.notes ? [...s.notes, noteText.trim()] : [noteText.trim()];
          return { ...s, notes: updatedNotes };
        }
        return s;
      });
      
      saveSnippetsToLocalStorage(updatedSnippets);
      return updatedSnippets;
    });

    setCurrentNote('');
    if (noteInputRef.current) {
      noteInputRef.current.focus();
    }
  };

  // Remove a specific note
  const removeNote = (snippetId: string, noteIndex: number) => {
    setCapturedSnippets(prevSnippets => {
      const updatedSnippets = prevSnippets.map(s => {
        if (s.id === snippetId && s.notes) {
          const updatedNotes = s.notes.filter((_, index) => index !== noteIndex);
          return { ...s, notes: updatedNotes };
        }
        return s;
      });
      
      saveSnippetsToLocalStorage(updatedSnippets);
      return updatedSnippets;
    });
  };

  // Add toggle favorite function
  const toggleFavorite = (id: string) => {
    setCapturedSnippets(prevSnippets => {
      const updatedSnippets = prevSnippets.map(snippet => {
        if (snippet.id === id) {
          return { ...snippet, isFavorite: !snippet.isFavorite };
        }
        return snippet;
      });
      saveSnippetsToLocalStorage(updatedSnippets);
      return updatedSnippets;
    });
  };

  // Get unique app names and their icons from snippets
  const appOptions = useMemo(() => {
    const apps = new Map<string, { icon?: string; count: number }>();
    // Add 'all' option
    apps.set('all', { count: capturedSnippets.length });
    
    capturedSnippets.forEach(snippet => {
      const appName = snippet.source;
      const existing = apps.get(appName);
      if (existing) {
        existing.count++;
        // Keep the icon if it exists
        if (!existing.icon && snippet.sourceApp?.base64_icon) {
          existing.icon = snippet.sourceApp.base64_icon;
        }
      } else {
        apps.set(appName, {
          icon: snippet.sourceApp?.base64_icon,
          count: 1
        });
      }
    });
    
    return Array.from(apps.entries()).map(([name, data]) => ({
      name,
      icon: data.icon,
      count: data.count
    }));
  }, [capturedSnippets]);

  // Custom App Filter Component
  const AppFilter = () => {
    return (
      <div className="filter-control" style={{ minWidth: '120px' }}>
        <div 
          className="app-filter-button"
          onClick={() => setIsAppFilterOpen(!isAppFilterOpen)}
          role="combobox"
          aria-expanded={isAppFilterOpen}
          aria-haspopup="listbox"
          aria-controls="app-filter-dropdown"
        >
          <div className="selected-app">
            {selectedApp === 'all' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
                <span>All Apps</span>
              </>
            ) : (
              <>
                {appOptions.find(app => app.name === selectedApp)?.icon ? (
                  <img 
                    src={appOptions.find(app => app.name === selectedApp)?.icon} 
                    alt=""
                    className="app-icon"
                  />
                ) : (
                  getSourceIcon(selectedApp)
                )}
                <span>{selectedApp}</span>
              </>
            )}
            <svg 
              className={`dropdown-arrow ${isAppFilterOpen ? 'open' : ''}`}
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
        
        {isAppFilterOpen && (
          <>
            <div className="app-filter-backdrop" onClick={() => setIsAppFilterOpen(false)} />
            <ul 
              className="app-filter-dropdown" 
              id="app-filter-dropdown"
              role="listbox"
              aria-label="Filter by app"
            >
              {appOptions.map(app => (
                <li 
                  key={app.name}
                  className={`app-option ${selectedApp === app.name ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedApp(app.name);
                    setIsAppFilterOpen(false);
                  }}
                  role="option"
                  aria-selected={selectedApp === app.name}
                >
                  {app.name === 'all' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                      <line x1="15" y1="3" x2="15" y2="21"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="15" x2="21" y2="15"/>
                    </svg>
                  ) : app.icon ? (
                    <img src={app.icon} alt="" className="app-icon" />
                  ) : (
                    getSourceIcon(app.name)
                  )}
                  <span className="app-name">{app.name === 'all' ? 'All Apps' : app.name}</span>
                  <span className="app-count">{app.count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  };

  // Add sorted snippets logic
  const sortedSnippets = useMemo(() => {
    const sorted = [...displayedSnippets];
    sorted.sort((a, b) => {
      try {
        // First try to parse the timestamp directly
        const [dateStr, timeStr] = a.timestamp.split(' · ');
        const [dateStr2, timeStr2] = b.timestamp.split(' · ');
        
        // Parse dates using the same format they were created with
        const dateA = new Date(dateStr).getTime();
        const dateB = new Date(dateStr2).getTime();
        
        // If dates are equal, compare times
        if (dateA === dateB && timeStr && timeStr2) {
          // Convert 12-hour format to 24-hour for proper comparison
          const timeA = new Date(`1970/01/01 ${timeStr}`).getTime();
          const timeB = new Date(`1970/01/01 ${timeStr2}`).getTime();
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        }
        
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } catch (error) {
        console.error('Error sorting timestamps:', error);
        return 0; // Keep original order if there's an error
      }
    });
    return sorted;
  }, [displayedSnippets, sortOrder]);

  // Renders a different card UI based on snippet type
  const renderSnippetCard = (snippet: Snippet, handleDelete: (id: string) => void) => {
    const commonClasses = "snippet-card";
    const { id, type, content, source, timestamp, tags, notes } = snippet;
    const isEditingNotes = editingNotesIds.includes(id);

    // Shared card header component
    const CardHeader = () => {
      // Debug icon source
      console.log(`Card for ${source} - Has icon: ${snippet.sourceApp?.base64_icon ? 'Yes' : 'No'}`);
      if (snippet.sourceApp?.base64_icon) {
        console.log(`Icon data starts with: ${snippet.sourceApp.base64_icon.substring(0, 40)}...`);
      }
      
      return (
      <div className="snippet-header">
        <div className="snippet-source">
          <span className="source-icon">
            {/* Conditionally render the real icon or the fallback SVG */}
            {snippet.sourceApp?.base64_icon ? (
              <img 
                src={snippet.sourceApp.base64_icon} 
                alt={`${source} icon`} 
                className="app-icon"
                width="16"
                height="16" 
                onError={(e) => {
                  console.error("Error loading icon:", e);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              getSourceIcon(source) // Fallback to SVG function
            )}
          </span>
          <span className="app-source">
            {source}
          </span>
        </div>
        <div className="snippet-time">{timestamp}</div>
      </div>
    )};

    // Notes section component uses the separate component
    const NotesSection = () => {
      if (!isEditingNotes) return null;
      return <NotesInputSection 
        snippet={snippet} 
        addNote={addNote} 
        removeNote={removeNote} 
      />;
    };

    // Shared card footer with tags
    const CardFooter = () => (
      <div className="snippet-footer">
        <div className="snippet-tags">
          {tags.map((tag, index) => (
            <span key={index} className="tag">#{tag}</span>
          ))}
        </div>
        <div className="card-actions">
          <button 
            className={`favorite-btn ${snippet.isFavorite ? 'active' : ''}`}
            aria-label={snippet.isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => toggleFavorite(id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={snippet.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button 
            className={`notes-btn ${isEditingNotes ? 'active' : ''} ${notes && notes.length > 0 ? 'has-notes' : ''}`}
            aria-label="Toggle notes"
            onClick={() => toggleNoteEditing(id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {notes && notes.length > 0 && <span className="note-count">{notes.length}</span>}
          </button>
          <button 
            className={`copy-btn ${copiedId === id ? 'copied' : ''}`} 
            aria-label="Copy snippet" 
            onClick={() => copyToClipboard(content, id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button className="delete-btn" aria-label="Delete snippet" onClick={() => handleDelete(id)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    );

    // Use a variable for the main card rendering logic
    const CardLayout = ({ children }: { children: React.ReactNode }) => (
      <div className={`${commonClasses} ${type}-snippet`}>
        <CardHeader />
        {children}
        <NotesSection />
        <CardFooter />
      </div>
    );

    // Special handling for color snippets
    if (type === 'color') {
      const colorValue = (snippet as ColorSnippet).colorValue || content;
      // For color cards, we use a different layout that shows the color as background
      return (
        <div className={`${commonClasses} color-snippet`}>
          <div 
            className="color-preview" 
            style={{ backgroundColor: colorValue }}
          >
            <span className="color-value">{colorValue}</span>
            {isEditingNotes && <NotesSection />}
          </div>
          <div className="snippet-footer">
            <div className="snippet-tags">
              {tags.map((tag, index) => (
                <span key={index} className="tag">#{tag}</span>
              ))}
            </div>
            <div className="card-actions">
              <button 
                className={`favorite-btn ${snippet.isFavorite ? 'active' : ''}`}
                aria-label={snippet.isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => toggleFavorite(id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={snippet.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
              <button 
                className={`notes-btn ${isEditingNotes ? 'active' : ''} ${notes && notes.length > 0 ? 'has-notes' : ''}`}
                aria-label="Toggle notes"
                onClick={() => toggleNoteEditing(id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {notes && notes.length > 0 && <span className="note-count">{notes.length}</span>}
              </button>
              <button 
                className={`copy-btn ${copiedId === id ? 'copied' : ''}`} 
                aria-label="Copy color value" 
                onClick={() => copyToClipboard(colorValue, id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button className="delete-btn" aria-label="Delete color" onClick={() => handleDelete(id)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'code':
        return (
          <CardLayout>
            <pre className="snippet-content code">
              <code>{content}</code>
            </pre>
          </CardLayout>
        );

      case 'tweet':
        return (
          <CardLayout>
            <div className={`snippet-content tweet`}>
              {content}
            </div>
          </CardLayout>
        );
      
      case 'text':
        const hasNewlines = content.includes('\n');
        const isCodeLike = looksLikeCode(content);
        const textContentClass = hasNewlines 
          ? isCodeLike 
            ? "text text-multiline code-style" 
            : "text text-multiline" 
          : "text";
        
        return (
          <CardLayout>
            {hasNewlines ? (
              <pre className={`snippet-content ${textContentClass}`}>
                {content}
              </pre>
            ) : (
              <div className={`snippet-content ${textContentClass}`}>
                {content}
              </div>
            )}
          </CardLayout>
        );
      
      case 'message':
        const isMessageCodeLike = looksLikeCode(content);
        return (
          <CardLayout>
            <div className={`snippet-content message ${isMessageCodeLike ? 'code-style' : ''}`}>
              {content}
            </div>
          </CardLayout>
        );
      
      case 'quote':
        return (
          <CardLayout>
            <blockquote className="snippet-content quote">
              {content}
            </blockquote>
          </CardLayout>
        );

      case 'link':
        return (
          <CardLayout>
            <a href={content} className="snippet-content link" target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          </CardLayout>
        );
    }
  };

  console.log('[Render] capturedSnippets state before render:', capturedSnippets);

  // Simplified version that doesn't use AI
  const processSmartQueryWithAI = async (query: string) => {
    try {
      setIsSearching(true);
      
      // Just return the query as is without AI processing
      setProcessedDateQuery(null);
      setIsSearching(false);
      return query;
    } catch (error) {
      console.error("Error in smart search:", error);
      setIsSearching(false);
      return null;
    }
  };

  // Fix the processCommandInput function
  const processCommandInput = async (value: string) => {
    console.log("Processing command:", value);
    
    // Reset state when changing command
    setSearchInput(value);
    
    // Reset parsedFilters if we're starting with a different command
    // This ensures previous filters don't interfere with new commands
    if (value.startsWith('/') && !value.includes(searchInput)) {
      setParsedFilters(null);
    }
    
    if (value.startsWith('/')) {
      // Handle date command
      if (value.startsWith('/date')) {
        const dateQuery = value.substring(5).trim();
        if (dateQuery) {
          // Reset parsedFilters to ensure no lingering filters
          setParsedFilters(null);
          const processedQuery = await processDateQueryWithAI(dateQuery);
          console.log('Processed date query:', processedQuery);
        } else {
          setProcessedDateQuery(null);
          setParsedFilters(null);
        }
        return;
      }
      
      // Handle type command
      if (value.startsWith('/type')) {
        const typeQuery = value.substring(5).trim();
        
        // Always reset parsedFilters to ensure a clean state
        setParsedFilters(null);
        
        if (typeQuery) {
          console.log("Processing type query:", typeQuery);
          
          // Use AI to understand the type query
          const filters = await processTypeQueryWithAI(typeQuery);
          
          // Make sure we update the UI even if it's the same type as before
          if (filters) {
            console.log("Setting parsed filters:", filters);
            setParsedFilters(filters); // This should trigger a re-render
          } else {
            console.log("No filters returned from AI processing");
            setParsedFilters(null);
          }
        } else {
          // Reset filters if no query
          setParsedFilters(null);
        }
        return;
      }
      
      // Handle app command
      if (value.startsWith('/app')) {
        // Process app filter
        const appQuery = value.substring(4).trim();
        // Reset parsedFilters to ensure no lingering filters
        setParsedFilters(null);
        if (appQuery) {
          // Filter logic will be handled by useMemo reacting to searchInput change
          return; // Rely on useMemo hook update
        }
      }
      
      // Handle smart command (AI query understanding)
      if (value.startsWith('/smart')) {
        const smartQuery = value.substring(6).trim();
        // Reset parsedFilters to ensure no lingering filters
        setParsedFilters(null);
        if (smartQuery) {
          await processSmartQueryWithAI(smartQuery);
        }
        return;
      }
      
      // Handle favorite command
      if (value.startsWith('/fav')) {
        // Reset parsedFilters to ensure no lingering filters
        setParsedFilters(null);
        // Filter logic will be handled by useMemo reacting to activeView change
        setActiveView('favorites'); // Assuming this triggers useMemo correctly
        return;
      }
      
      // Handle custom commands that appear in dropdown
      if (value === '/newest') {
        // Reset parsedFilters to ensure no lingering filters
        setParsedFilters(null);
        setSortType('newest');
        return;
      }
      
      if (value === '/oldest') {
        // Reset parsedFilters to ensure no lingering filters
        setParsedFilters(null);
        setSortType('oldest');
        return;
      }
      
      // Handle unknown command
      console.log(`Unknown command: ${value}`);
    } else {
      // Reset any active filters when doing a normal search
      setParsedFilters(null);
      setProcessedDateQuery(null);
      
      // Handle normal search
      const filtered = basicTextMatch(capturedSnippets, value.toLowerCase());
      setCapturedSnippets(filtered);
    }
  };

  // Helper function to get semantic matches for types
  const getTypeSemanticMatches = (word: string): string[] => {
    const typeSemantics: {[key: string]: string[]} = {
      "code": ["code", "script", "function", "snippet", "programming", "algorithm", "javascript", "python", "html", "css"],
      "url": ["url", "link", "website", "site", "webpage", "http", "https", "web", "github", "youtube"],
      "image": ["image", "picture", "photo", "screenshot", "diagram", "chart", "graph", "png", "jpg", "jpeg"],
      "file": ["file", "document", "pdf", "spreadsheet", "excel", "word", "powerpoint", "presentation", "doc", "csv"],
      "text": ["text", "note", "message", "content", "paragraph", "article", "essay", "discussion", "conversation"],
      "color": ["color", "hex", "rgb", "rgba", "hsl", "hsla", "colorcode", "hex code", "hex color", "color value", "palette"]
    };
    
    for (const [type, semantics] of Object.entries(typeSemantics)) {
      if (semantics.includes(word) || semantics.some(term => term.includes(word) || word.includes(term))) {
        return [type];
      }
    }
    
    return [];
  };
  
  // Utility function for debouncing
  function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: Parameters<F>): void => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), waitFor);
    };
  }

  // Simplified real-time search function without NLP features
  const performRealTimeSearch = debounce((query: string) => {
    if (!query || query.length < 2) {
      setFilteredSnippets(capturedSnippets);
      return;
    }
    
    const normalizedQuery = query.toLowerCase();
    
    const filteredResults = capturedSnippets.filter(snippet => {
      const content = snippet.content.toLowerCase();
      const notes = snippet.notes ? snippet.notes.join(' ').toLowerCase() : '';
      const type = snippet.type?.toLowerCase() || '';
      
      // Basic text matching
      return content.includes(normalizedQuery) || 
             notes.includes(normalizedQuery) ||
             type.includes(normalizedQuery);
    });
    
    setFilteredSnippets(filteredResults);
  }, 300);

  // Enhanced function to handle search input changes with simplified search
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    const previousValue = searchInput;
    
    // Set the input value first
    setSearchInput(value);
    
    // If we're clearing a command input, also reset the parsedFilters
    if (previousValue.startsWith('/') && (value === '' || !value.startsWith('/'))) {
      console.log("Clearing command input and resetting filters");
      setParsedFilters(null);
      setProcessedDateQuery(null);
      setIsFiltering(false);
      setFilteredSnippets([]);
    }
    
    // Early return if query is empty or just being initialized
    if (!value.trim()) {
      setIsFiltering(false);
      setFilteredSnippets([]);
      setParsedFilters(null);
      return;
    }

    // If the user starts with a slash, it's a command
    if (value.startsWith('/')) {
      processCommandInput(value);
      return;
    }
    
    // Real-time semantic analysis for standard queries
    performRealTimeSearch(value);
  };

  // Inside the MainScreen functional component, add a new state for selected folder:
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Simplified matchesSemantic that just does basic text matching
  const matchesSemantic = (snippet: Snippet, parsedFilters: any): boolean => {
    if (!parsedFilters) return true;
    
    // Simple text search within content and note
    const query = searchInput.toLowerCase();
    const content = snippet.content.toLowerCase();
    const notes = snippet.notes ? snippet.notes.join(' ').toLowerCase() : '';
    
    return content.includes(query) || notes.includes(query);
  };

  return (
    <div className="main-screen-container">
      {/* Only show Sidebar if there are snippets and NOT in demo mode */}
      {(capturedSnippets.length > 0 && !isDemoMode) && (
        <Sidebar 
          isCollapsed={sidebarCollapsed} 
          toggleSidebar={toggleSidebar}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}
      
      <div className={`main-content ${(capturedSnippets.length > 0 && !isDemoMode) ? (sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded') : ''}`}>
        <div className="main-screen">
          {/* back button removed */}
          
          {/* Delete All Button removed */}

          {isDemoMode ? (
            <div className="demo-mode-container">
              <div className="demo-mode-header">
                <span className="demo-badge">Demo Mode</span>
                <button className="exit-demo-btn" onClick={toggleDemoMode}>
                  Exit Demo
                </button>
                <p className="demo-subtitle">This is a demonstration of the clipboard history UI. In the full app, your clipboard items appear here.</p>
              </div>

              <div className="snippets-container">
                <div className="snippets-column">
                  {demoSnippets.filter((_, index) => index % 2 === 0).map(snippet => (
                    <div key={snippet.id} className="snippet-wrapper">
                      {renderSnippetCard(snippet, handleDeleteSnippet)}
                    </div>
                  ))}
                </div>
                <div className="snippets-column">
                  {demoSnippets.filter((_, index) => index % 2 === 1).map(snippet => (
                    <div key={snippet.id} className="snippet-wrapper">
                      {renderSnippetCard(snippet, handleDeleteSnippet)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="captured-snippets-container demo-mode-container">
              {/* Sort Control */}
              {capturedSnippets.length > 0 && !isDemoMode && (
                <div className="controls-container">
                  <AppFilter />
                  <div className="search-bar">
                    <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <svg 
                      className="wand-icon"
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      onClick={toggleCommandsDropdown}
                    >
                      <title>View search commands</title>
                      <path d="M15 4V2"></path>
                      <path d="M15 16v-2"></path>
                      <path d="M8 9h2"></path>
                      <path d="M20 9h2"></path>
                      <path d="M17.8 11.8L19 13"></path>
                      <path d="M15 9h0"></path>
                      <path d="M17.8 6.2L19 5"></path>
                      <path d="M12.2 6.2L11 5"></path>
                      <path d="M12.2 11.8L11 13"></path>
                      <path d="M5 19l7-7"></path>
                    </svg>
                    
                    {isCommandsDropdownOpen && (
                      <div className="commands-dropdown">
                        <div className="commands-header">Search commands</div>
                        <div className="command-item" onClick={() => handleCommandSelect('/date')}>
                          <span className="command">/date</span>
                          <span className="description">Filter by when the item was copied</span>
                        </div>
                        <div className="command-item" onClick={() => handleCommandSelect('/type')}>
                          <span className="command">/type</span>
                          <span className="description">Filter by content type (text, image, URL, code)</span>
                        </div>
                      </div>
                    )}
                    
                    <textarea 
                      placeholder="Search clips..."
                      className="search-input"
                      value={searchInput}
                      onChange={handleSearchInputChange}
                      title={searchInput}
                      rows={1}
                      onInput={(e) => {
                        // Auto-resize textarea
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                      }}
                    />
                    
                    {isSearching && (
                      <div className="search-loading">
                        <svg className="spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="2" x2="12" y2="6"></line>
                          <line x1="12" y1="18" x2="12" y2="22"></line>
                          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                          <line x1="2" y1="12" x2="6" y2="12"></line>
                          <line x1="18" y1="12" x2="22" y2="12"></line>
                          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        <span>AI processing...</span>
                      </div>
                    )}
                    
                    {searchInput && (
                      <button 
                        className="clear-search-btn" 
                        onClick={() => {
                          setSearchInput('');
                        }}
                        aria-label="Clear search"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="sort-control" style={{ minWidth: '180px', marginLeft: '5px' }}>
                    <button 
                      className={`sort-btn ${sortOrder === 'desc' ? 'active' : ''}`}
                      onClick={() => setSortOrder('desc')}
                      aria-label="Sort by newest first"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 4h13M3 8h9M3 12h5M11 16L7 20M7 16l-4 4M21 4v16"/>
                      </svg>
                      Newest
                    </button>
                    <button 
                      className={`sort-btn ${sortOrder === 'asc' ? 'active' : ''}`}
                      onClick={() => setSortOrder('asc')}
                      aria-label="Sort by oldest first"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 4h13M3 8h9M3 12h5M11 16l4 4M15 16l4 4M21 4v16"/>
                      </svg>
                      Oldest
                    </button>
                  </div>
                </div>
              )}

              {/* Folder Manager placed under the controls container, spanning full width */}
              {capturedSnippets.length > 0 && !isDemoMode && (
                <div className="folder-manager-container" style={{ width: '100%', marginTop: '10px' }}>
                  <FolderManager onFolderSelect={setSelectedFolderId} />
                </div>
              )}
              
              {activeView === 'favorites' && sortedSnippets.length === 0 ? (
                <div className="empty-favorites">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  <h3>No favorites yet</h3>
                  <p>Click the star icon on any snippet to add it to your favorites</p>
                </div>
              ) : capturedSnippets.length === 0 && !isDemoMode ? (
                <div className="empty-state">
                  <div className="icon-container">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </div>
                  <h2>Your clipboard history will appear here</h2>
                  <p>Copy some text to get started, or try out the demo to see how it works.</p>
                  <button className="demo-btn" onClick={toggleDemoMode}>
                    Try Demo Mode
                  </button>
                </div>
              ) : sortedSnippets.length === 0 && searchInput.trim() ? (
                <div className="empty-state">
                  <div className="icon-container">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                  <h2>No results found</h2>
                  {searchInput.trim().startsWith('/date') ? (
                    <p>No clips match your date search for "{searchInput.substring(5).trim()}". Try a different date expression.</p>
                  ) : (
                    <p>No clips match your search for "{searchInput}". Try a different search term.</p>
                  )}
                </div>
              ) : (
                <div className="snippets-container">
                  {/* Removed date filter indicator */}
                  <div className="snippets-column">
                    {sortedSnippets.filter((_, index) => index % 2 === 0).map(snippet => (
                      <div key={snippet.id} className="snippet-wrapper">
                        {renderSnippetCard(snippet, handleDeleteSnippet)}
                      </div>
                    ))}
                  </div>
                  <div className="snippets-column">
                    {sortedSnippets.filter((_, index) => index % 2 === 1).map(snippet => (
                      <div key={snippet.id} className="snippet-wrapper">
                        {renderSnippetCard(snippet, handleDeleteSnippet)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainScreen; 

