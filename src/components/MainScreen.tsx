import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainScreen.css';

// Define types for snippets
interface BaseSnippet {
  id: number;
  type: string;
  content: string;
  source: string;
  timestamp: string;
  tags: string[];
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
    id: 1,
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
    id: 2,
    type: 'tweet',
    content: 'Just launched our new design system! Check out how we\'re using Figma and React to create a seamless workflow between design and development. #designsystem #frontend',
    source: 'Twitter',
    handle: '@designer',
    timestamp: 'May 2, 2025 · 1:15 PM',
    tags: ['design', 'announcement']
  },
  {
    id: 3,
    type: 'quote',
    content: 'The best way to predict the future is to invent it. The future is not laid out on a track. It is something that we can decide, and to the extent that we do not violate any known laws of the universe, we can probably make it work the way that we want to.',
    source: 'Medium',
    author: 'Alan Kay',
    timestamp: 'May 1, 2025 · 11:22 AM',
    tags: ['inspiration', 'quote']
  },
  {
    id: 4,
    type: 'text',
    content: 'Pick up groceries: eggs, milk, bread, avocados, chicken, pasta',
    source: 'Notes',
    timestamp: 'May 1, 2025 · 9:42 AM',
    tags: ['todo']
  },
  {
    id: 5,
    type: 'link',
    content: 'https://react.dev/reference/react',
    source: 'Browser',
    title: 'React Documentation',
    timestamp: 'April 30, 2025 · 4:18 PM',
    tags: ['resource', 'reference', 'react']
  },
  {
    id: 6,
    type: 'message',
    content: 'Hey, can you send me the latest design mockups for the dashboard? I need to implement those changes by Friday.',
    source: 'iMessage',
    contact: 'Alex Chen',
    timestamp: 'April 30, 2025 · 1:35 PM',
    tags: ['work', 'design']
  }
];

const MainScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isDemoMode, setIsDemoMode] = useState(false);

  const handleBack = () => {
    navigate('/');
  };

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

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
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zM19 19.09H5V4.91h14v14.18zM6 15h12v2H6zm0-4h12v2H6zm0-4h12v2H6z" fill="#FFA500"/>
          </svg>
        );
      case 'Browser':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 22h16a2 2 0 002-2V8l-6-6H4a2 2 0 00-2 2v16a2 2 0 002 2zm0-18h10v4a2 2 0 002 2h4v10H4V4zm2 6v2h8v-2H6zm0 4v2h12v-2H6zm0 4v2h12v-2H6z" fill="#4285F4"/>
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

  // Renders a different card UI based on snippet type
  const renderSnippetCard = (snippet: Snippet) => {
    const commonClasses = "snippet-card";
    const { id, type, content, source, timestamp, tags } = snippet;

    // Shared card header component
    const CardHeader = () => (
      <div className="snippet-header">
        <div className="snippet-source">
          <span className="source-icon">
            {getSourceIcon(source)}
          </span>
          <span className="app-source">{source}</span>
          {'path' in snippet && <span className="path">{snippet.path}</span>}
          {'handle' in snippet && <span className="handle">{snippet.handle}</span>}
          {'author' in snippet && <span className="author">by {snippet.author}</span>}
          {'title' in snippet && <span className="title">{snippet.title}</span>}
          {'contact' in snippet && <span className="contact">from {snippet.contact}</span>}
        </div>
        <div className="snippet-time">{timestamp}</div>
      </div>
    );

    // Shared card footer with tags
    const CardFooter = () => (
      <div className="snippet-footer">
        <div className="snippet-tags">
          {tags.map((tag, index) => (
            <span key={index} className="tag">#{tag}</span>
          ))}
        </div>
        <div className="card-actions">
          <button className="notes-btn" aria-label="Add personal notes">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="ai-btn" aria-label="Generate AI summary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
              <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
              <path d="M9 18h6"/>
            </svg>
          </button>
          <button className="copy-btn" aria-label="Copy snippet">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
    );

    switch (type) {
      case 'code':
        return (
          <div key={id} className={`${commonClasses} code-snippet`}>
            <CardHeader />
            <pre className="snippet-content code">
              <code>{content}</code>
            </pre>
            <CardFooter />
          </div>
        );
      
      case 'tweet':
        return (
          <div key={id} className={`${commonClasses} tweet-snippet`}>
            <CardHeader />
            <div className="snippet-content tweet">
              {content}
            </div>
            <CardFooter />
          </div>
        );
      
      case 'quote':
        return (
          <div key={id} className={`${commonClasses} quote-snippet`}>
            <CardHeader />
            <blockquote className="snippet-content quote">
              {content}
            </blockquote>
            <CardFooter />
          </div>
        );

      case 'link':
        return (
          <div key={id} className={`${commonClasses} link-snippet`}>
            <CardHeader />
            <a href={content} className="snippet-content link" target="_blank" rel="noopener noreferrer">
              {content}
            </a>
            <CardFooter />
          </div>
        );

      case 'text':
        return (
          <div key={id} className={`${commonClasses} text-snippet`}>
            <CardHeader />
            <div className="snippet-content text">
              {content}
            </div>
            <CardFooter />
          </div>
        );
      
      case 'message':
        return (
          <div key={id} className={`${commonClasses} message-snippet`}>
            <CardHeader />
            <div className="snippet-content message">
              {content}
            </div>
            <CardFooter />
          </div>
        );
    }
  };

  return (
    <div className="main-screen">
      <button className="back-button" onClick={handleBack}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>

      {isDemoMode ? (
        <div className="demo-mode-container">
          <div className="demo-mode-header">
            <span className="demo-badge">Demo Mode</span>
            <p className="demo-subtitle">Here's what your SnipStack might look like.</p>
          </div>

          <div className="snippets-container">
            {demoSnippets.map(snippet => renderSnippetCard(snippet))}
          </div>

          <button className="exit-demo-btn" onClick={toggleDemoMode}>
            Exit Demo Mode
          </button>
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