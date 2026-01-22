import { useState, useEffect } from 'react';

// Recursive Tree Node Component
const TreeNode = ({ node, socket, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleBrowseResult = ({ parentId, nodes }) => {
      if (parentId === node.nodeId) {
        setChildren(nodes);
        setLoading(false);
        setHasLoaded(true);
      }
    };

    socket.on('browse-result', handleBrowseResult);
    return () => {
      socket.off('browse-result', handleBrowseResult);
    };
  }, [socket, node.nodeId]);

  const toggleExpand = (e) => {
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
    } else {
      setExpanded(true);
      if (!hasLoaded && !loading) {
        setLoading(true);
        console.log(`Browsing node: ${node.nodeId}`);
        socket.emit('opcua-browse', node.nodeId);
      }
    }
  };

  const isFolder = node.nodeClass === 'Object' || node.nodeClass === 'Method' || node.nodeId === "RootFolder" || node.nodeClass === "View";
  const isVariable = node.nodeClass === 'Variable';

  return (
    <div className="ml-3 select-none">
      <div 
        className="flex items-center py-0.5 hover:bg-[#37373d] cursor-pointer rounded-sm pr-2 group" 
        onClick={() => onSelect(node)}
        title={`NodeID: ${node.nodeId}`}
      >
        <span 
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-500 transition-transform ${
              !isFolder ? 'invisible' : 'hover:text-gray-300'
          } ${expanded ? 'rotate-90' : ''}`} 
          onClick={isFolder ? toggleExpand : undefined}
        >
          ▶
        </span>
        <span 
          className={`ml-1 text-sm truncate ${
              isVariable ? 'text-cyan-400' : 'text-gray-300 font-medium'
          }`}
        >
          {node.browseName}
        </span>
        {loading && <span className="ml-2 text-xs text-gray-500 animate-pulse">...</span>}
      </div>
      
      {expanded && (
        <div className="border-l border-gray-700 ml-2 pl-1">
          {children.length > 0 ? (
            children.map((child) => (
              <TreeNode 
                key={child.nodeId} 
                node={child} 
                socket={socket} 
                onSelect={onSelect} 
              />
            ))
          ) : (
            !loading && <div className="ml-5 text-xs text-gray-500 italic py-1">Empty</div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Browser Component
const NodeBrowser = ({ socket, connected, onSelectNode }) => {
  const rootNode = {
    nodeId: "RootFolder",
    browseName: "Root",
    nodeClass: "Object"
  };

  if (!connected) {
    return <div className="p-4 text-center text-gray-500 text-sm italic">Connect to server to browse nodes.</div>;
  }

  return (
    <div className="font-mono text-sm pb-2">
      <TreeNode 
          node={rootNode} 
          socket={socket} 
          onSelect={onSelectNode} 
      />
    </div>
  );
};

export default NodeBrowser;
