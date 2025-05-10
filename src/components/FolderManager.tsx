import { useState, useEffect } from 'react';
import { createFolder, getFolders } from '../services/firebase';

interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

interface FolderManagerProps {
  onFolderSelect?: (folderId: string | null) => void;
}

const FolderManager: React.FC<FolderManagerProps> = ({ onFolderSelect }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to folder changes from Firebase
    const unsubscribe = getFolders((folderList) => {
      setFolders(folderList);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddNewFolder = () => {
    setIsCreatingFolder(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }

    try {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleFolderClick = (folderId: string) => {
    const newSelectedId = selectedFolderId === folderId ? null : folderId;
    setSelectedFolderId(newSelectedId);
    if (onFolderSelect) {
      onFolderSelect(newSelectedId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  };

  return (
    <div className="folder-manager">
      <div className="folders-section">
        <div className="folders-header">
          <div className="folders-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Folders</span>
          </div>
          
          {!isCreatingFolder && (
            <button className="new-folder-btn" onClick={handleAddNewFolder}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              New Folder
            </button>
          )}
        </div>

        {isCreatingFolder && (
          <div className="folder-input-container">
            <input
              type="text"
              className="folder-input"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
            />
            <div className="folder-input-actions">
              <button className="folder-create-btn" onClick={handleCreateFolder}>
                Create
              </button>
              <button className="folder-cancel-btn" onClick={() => setIsCreatingFolder(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="folders-list">
          <div 
            className={`folder-item ${selectedFolderId === null ? 'selected' : ''}`}
            onClick={() => handleFolderClick(selectedFolderId || '')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span className="folder-name">All Clips</span>
          </div>
          
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`folder-item ${selectedFolderId === folder.id ? 'selected' : ''}`}
              onClick={() => handleFolderClick(folder.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="folder-name">{folder.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FolderManager; 