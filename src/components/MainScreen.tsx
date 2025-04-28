import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listen } from "@tauri-apps/api/event";
// import Groq from "groq-sdk"; // Import Groq if you have the SDK, otherwise use fetch
import '../styles/MainScreen.css';
import hljs from 'highlight.js'; // Use standard highlight.js import

// Define types for snippets
interface BaseSnippet {
  id: string;
  type: string;
  content: string;
  source: string;
  timestamp: string;
  tags: string[];
  notes?: string[]; // Array of strings for bullet points
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

type Snippet = CodeSnippet | TweetSnippet | QuoteSnippet | LinkSnippet | TextSnippet | MessageSnippet;

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

// Improved heuristic check for code patterns with more robust detection
const looksLikeCode = (text: string): boolean => {
  // Skip very short text (likely not code)
  if (text.length < 10) return false;

  // Negative patterns (strong indicators of natural language)
  const naturalLanguagePatterns = [
    /\b(the|a|an|and|or|but|because|therefore|however|although|nevertheless)\b/gi, // Common English conjunctions/articles
    /\?{1,3}\s*$|\!{1,3}\s*$/m, // Question/exclamation marks at end of lines
    /\b(I|we|you|he|she|they)\s+(am|are|is|was|were|have|has|had)\b/i, // Common pronoun+verb combinations
    /\b(please|thanks|thank you|sincerely|regards)\b/i, // Conversational/email phrases
    /\b(what|when|where|why|how)\s+(is|are|do|does)\b/i, // Question structures
  ];
  
  // Count natural language indicators
  let naturalLanguageScore = 0;
  naturalLanguagePatterns.forEach(pattern => {
    if (pattern.test(text)) naturalLanguageScore++;
  });
  
  // If at least 2 strong natural language indicators and not a large text block, assume it's not code
  if (naturalLanguageScore >= 2 && text.length < 200) return false;
  
  // Definitive code patterns (strong indicators of actual code)
  const hasDefinitiveCodePatterns = [
    /\bfunction\s+\w+\s*\([^)]*\)\s*\{/i, // function declarations with brackets
    /\bclass\s+\w+\s*(\extends\s+\w+)?\s*\{/i, // class declarations
    /\bimport\s+[\w{},\s*]+\s+from\s+['"]/i, // JS/TS import statements
    /\brequire\s*\(\s*['"]/i, // Node.js require statements
    /\bdef\s+\w+\s*\([^)]*\)\s*:/i, // Python function definition
    /^\s*from\s+[\w.]+\s+import\s+[\w,\s*]+$/m, // Python import
    /<\w+(\s+\w+\s*=\s*["'][^"']*["'])*\s*>.*<\/\w+>/s, // HTML tags with potential attributes
    /\s*@\w+(\([^)]*\))?\s*$/m, // Decorators/annotations (Java, Python, TS)
    /\b(public|private|protected)\s+(static\s+)?\w+\s+\w+\s*\(/i, // Java/C# method declarations
    /\bconst\s+\w+\s*=\s*\(?.*=>.*\)?;?$/m, // Arrow functions with assignment
    /^\s*if\s*\([^)]*\)\s*[\{:].*$/m, // if statements
    /^\s*for\s*\([^)]*\)\s*[\{:].*$/m, // for loops
    /^\s*while\s*\([^)]*\)\s*[\{:].*$/m, // while loops
    /^\s*switch\s*\([^)]*\)\s*\{.*$/m, // switch statements
  ].some(pattern => pattern.test(text));
  
  // If we find any definitive code pattern, it's very likely code
  if (hasDefinitiveCodePatterns) return true;
  
  // Basic code syntax checks (less definitive but still indicative)
  const hasBrackets = /[\{\}\[\]\(\)]/.test(text);
  const hasKeywordsOrSymbols = /\b(function|class|def|import|export|const|let|var|return|if|else|switch|case|break|continue|try|catch|finally|throw|for|while|do|in|of|new|this|super|async|await|static|void|null|undefined|true|false|=>|===|!==|&&|\|\|)\b/i.test(text);
  const hasIndentation = /^\s{2,}|\t+/m.test(text);
  const hasTags = /<\/?[a-zA-Z][^>]*>/.test(text);
  const hasComments = /\/\/.*$|\/\*[\s\S]*?\*\/|#.*$/m.test(text);
  const hasAssignmentOperations = /(^|\s)(\w+)\s*[=:]\s*[^;:,)]*[;\n]/m.test(text);
  
  // Check if multiple lines exist with consistent formatting
  const lines = text.split("\n");
  const multiLine = lines.length > 2; // Require at least 3 lines to be more certain
  
  // Check for consistent indentation (strong code indicator)
  let hasConsistentIndent = false;
  if (multiLine) {
    // Count lines with leading spaces/tabs
    const indentedLines = lines.filter(line => /^\s+\S/.test(line)).length;
    hasConsistentIndent = indentedLines >= 2; // At least 2 indented lines
  }
  
  // Check for semicolons or other statement terminators
  const hasStatementTerminators = /;$|\)$|\{$|\}$/m.test(text);
  
  // Comprehensive scoring system
  let score = 0;
  if (hasBrackets) score += 1;
  if (hasKeywordsOrSymbols) score += 2;
  if (multiLine && hasIndentation) score += 2;
  if (hasTags) score += 2;
  if (hasComments) score += 2;
  if (hasAssignmentOperations) score += 1;
  if (hasConsistentIndent) score += 2;
  if (hasStatementTerminators) score += 1;
  
  // Reduce score based on natural language indicators
  score = Math.max(0, score - naturalLanguageScore);
  
  // Consider it code if the score is high enough
  // Higher threshold for single line (to avoid false positives)
  return multiLine ? (score >= 3) : (score >= 4);
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

// Helper function to load snippets initially
const loadInitialSnippets = (): Snippet[] => {
  console.log('[Load] Attempting to load initial snippets from localStorage...');
  try {
    const savedSnippetsJSON = localStorage.getItem('saved_snippets');
    console.log('[Load] Raw data from localStorage:', savedSnippetsJSON ? savedSnippetsJSON.substring(0, 100) + '...' : 'null');
    if (savedSnippetsJSON) {
      const savedSnippets = JSON.parse(savedSnippetsJSON) as Snippet[];
      console.log(`[Load] Successfully parsed ${savedSnippets.length} snippets.`);
      return savedSnippets;
    }
    console.log("[Load] No saved snippets found.");
  } catch (error) {
    console.error("[Load] Error parsing snippets from localStorage:", error);
  }
  return []; // Return empty array if not found or error occurs
};

const MainScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [capturedSnippets, setCapturedSnippets] = useState<Snippet[]>(loadInitialSnippets());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const lastCaptureRef = useRef<{ text: string, timestamp: number, fromCopyButton: boolean }>({
    text: '',
    timestamp: 0,
    fromCopyButton: false
  });
  const hasLoadedRef = useRef(false);
  const [editingNotesIds, setEditingNotesIds] = useState<string[]>([]);
  // @ts-ignore
  const [currentNote, setCurrentNote] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Groq API Key (Ideally use environment variables)
  const GROQ_API_KEY = "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";

  const handleBack = () => {
    navigate('/');
  };

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  // Function to delete ALL snippets
  const handleDeleteAll = () => {
    console.warn('[Delete All] Clearing all snippets from state and localStorage.');
    // Clear the state
    setCapturedSnippets([]);
    // Clear localStorage
    try {
      localStorage.removeItem('saved_snippets');
      console.log('[Delete All] localStorage cleared successfully.');
    } catch (error) {
      console.error('❌ [Delete All] Error clearing localStorage:', error);
    }
    // Also clear editing state if any
    setEditingNotesIds([]);
  };

  // Function to delete a snippet
  const handleDeleteSnippet = (id: string) => {
    setCapturedSnippets(prevSnippets => {
      const updatedSnippets = prevSnippets.filter(snippet => snippet.id !== id);
      // Save to localStorage immediately on delete
      saveSnippetsToLocalStorage(updatedSnippets);
      return updatedSnippets;
    });
  };

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

      // Quick URL check (keep this for immediate tagging of obvious URLs)
      const urlRegex = /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
      if (urlRegex.test(text)) {
        tags = ['link', 'url'];
        methodUsed = 'regex-url';
        console.log(`✅ Detected link via regex`);
      } else {
        // Use Groq for comprehensive tag analysis
        try {
          console.log("🧠 Calling Groq API for content tagging...");
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
                }
                // Then add code alone if it exists
                else if (codeTag !== -1) {
                  sortedTags.push(tags[codeTag]);
                  
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
            } else {
              // Just generic code tag if language can't be determined
              tags = ['code'];
              methodUsed = 'fallback-heuristics';
            }
          } else {
            // Try to detect obvious content types based on patterns
            if (/^https?:\/\/\S+/i.test(text)) {
              tags = ['link', 'url'];
              methodUsed = 'fallback-regex';
            } else if (/^([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i.test(text)) {
              tags = ['email', 'contact-info'];
              methodUsed = 'fallback-regex';
            } else if (/Error:|Exception:|FATAL:|WARNING:|^Stack trace:|\bat\s+[\w\.$]+\([^)]+\)/im.test(text)) {
              tags = ['error-message', 'log'];
              methodUsed = 'fallback-regex';
            } else if (/^\s*[\*\-\+]\s|^\d+\.\s/m.test(text) && text.split('\n').length > 2) {
              tags = ['list', 'text'];
              methodUsed = 'fallback-regex';
            } else {
              // Just use default tag for plain text
              tags = ['text'];
              methodUsed = 'fallback-default';
            }
          }
        }
      }

      // Ensure tags array is unique 
      tags = [...new Set(tags)];

      const newSnippet: TextSnippet = {
        id: crypto.randomUUID(),
        type: 'text',
        content: text,
        source: sourceApp?.name || 'Clipboard',
        sourceApp: sourceApp,
        timestamp: formatTimestamp(new Date()),
        tags: tags,
      };

      setCapturedSnippets(prevSnippets => {
        console.log(`[State Update] Adding new snippet with tags: #${tags.join(', #')} (detection method: ${methodUsed}, confidence: ${confidence})`);
        console.log('[State Update] Previous snippets count:', prevSnippets.length);
        console.log('[State Update] Previous snippets (first 3):', prevSnippets.slice(0, 3).map(s => ({ id: s.id, content: s.content.substring(0, 20) + '...' })));
        console.log('[State Update] New snippet being added:', { id: newSnippet.id, content: newSnippet.content.substring(0, 20) + '...' });

        const updatedSnippets = [newSnippet, ...prevSnippets];

        console.log('[State Update] Updated snippets count:', updatedSnippets.length);
        console.log('[State Update] Updated snippets (first 3):', updatedSnippets.slice(0, 3).map(s => ({ id: s.id, content: s.content.substring(0, 20) + '...' })));

        // The useEffect watching capturedSnippets handles saving now, so this specific call might be redundant,
        // but leaving it here for now shouldn't cause harm.
        // saveSnippetsToLocalStorage(updatedSnippets); 
        
        return updatedSnippets;
      });

      setIsDemoMode(false);
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
            {source} {/* This now shows the app name correctly */}
          </span>
          {'path' in snippet && snippet.path && <span className="path">{snippet.path}</span>}
          {'handle' in snippet && snippet.handle && <span className="handle">{snippet.handle}</span>}
          {'author' in snippet && snippet.author && <span className="author">by {snippet.author}</span>}
          {'title' in snippet && snippet.title && <span className="title">{snippet.title}</span>}
          {'contact' in snippet && snippet.contact && <span className="contact">from {snippet.contact}</span>}
        </div>
        <div className="snippet-time">{timestamp}</div>
      </div>
    )};

    // Notes section component uses the separate component
    const NotesSection = () => {
      if (!isEditingNotes) return null;
      return <NotesInputSection snippet={snippet} addNote={addNote} removeNote={removeNote} />;
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
            className={`notes-btn ${isEditingNotes ? 'active' : ''}`}
            aria-label="Toggle notes"
            onClick={() => toggleNoteEditing(id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {notes && notes.length > 0 && <span className="note-count">{notes.length}</span>}
          </button>
          <button className="ai-btn" aria-label="Generate AI summary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
              <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
              <path d="M9 18h6"/>
            </svg>
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
        const textContentClass = hasNewlines ? "text text-multiline" : "text";
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
        return (
          <CardLayout>
            <div className={`snippet-content message`}>
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
              {(snippet as LinkSnippet).title || content}
            </a>
          </CardLayout>
        );
    }
  };

  console.log('[Render] capturedSnippets state before render:', capturedSnippets);

  return (
    <div className="main-screen">
      <button className="back-button" onClick={handleBack}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>

      {/* Add Delete All Button */} 
      {capturedSnippets.length > 0 && !isDemoMode && (
        <button 
          className="delete-all-btn"
          onClick={handleDeleteAll}
          title="Delete all captured snippets"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          Clear All
        </button>
      )}

      {isDemoMode ? (
        <div className="demo-mode-container">
          <div className="demo-mode-header">
            <span className="demo-badge">Demo Mode</span>
            <p className="demo-subtitle">Here's what your SnipStack might look like.</p>
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

          <button className="exit-demo-btn" onClick={toggleDemoMode}>
            Exit Demo Mode
          </button>
        </div>
      ) : capturedSnippets.length > 0 ? (
        <div className="captured-snippets-container demo-mode-container">
          <div className="snippets-container">
            <div className="snippets-column">
              {capturedSnippets.filter((_, index) => index % 2 === 0).map(snippet => (
                <div key={snippet.id} className="snippet-wrapper">
                  {renderSnippetCard(snippet, handleDeleteSnippet)}
                </div>
              ))}
            </div>
            <div className="snippets-column">
              {capturedSnippets.filter((_, index) => index % 2 === 1).map(snippet => (
                <div key={snippet.id} className="snippet-wrapper">
                  {renderSnippetCard(snippet, handleDeleteSnippet)}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon-container">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="48" 
              height="48" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </div>
          <h2>Start copying to fill your SnipStack</h2>
          <p>Anything you copy will appear here automatically</p>
          <button className="demo-btn" onClick={toggleDemoMode}>
            Try Demo Mode
          </button>
        </div>
      )}
    </div>
  );
};

export default MainScreen; 
