import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import NodeBrowser from './components/NodeBrowser';
import MonitoredItems from './components/MonitoredItems';

// Connect to the backend (relative path, proxied by Vite)
const socket = io();

function App() {
  const [backendConnected, setBackendConnected] = useState(socket.connected);
  const [opcState, setOpcState] = useState({
    connected: false,
    endpoint: '',
    isConnecting: false
  });
  const [endpointUrl, setEndpointUrl] = useState('opc.tcp://opcuaserver.com:48010');
  const [selectedNode, setSelectedNode] = useState(null);
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    const onConnect = () => setBackendConnected(true);
    const onDisconnect = () => setBackendConnected(false);

    const onStatusChange = (status) => {
      setOpcState(status);
      if (status.endpoint) {
        setEndpointUrl(status.endpoint);
      }
    };

    const onLog = (msg) => {
      setLogs((prev) => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 50));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connection-status', onStatusChange);
    socket.on('log', onLog);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connection-status', onStatusChange);
      socket.off('log', onLog);
    };
  }, []);

  const handleConnect = () => socket.emit('opcua-connect', endpointUrl);
  const handleDisconnect = () => {
    socket.emit('opcua-disconnect');
    setSelectedNode(null);
  };

  const handleSubscribe = () => {
    if (selectedNode) {
      socket.emit('opcua-subscribe', { 
          nodeId: selectedNode.nodeId, 
          name: selectedNode.browseName 
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 h-12 bg-vs-header border-b border-vs-border shrink-0">
        <div className="flex items-center gap-3">
            <h1 className="font-semibold text-sm text-gray-200">Plain OPC UA Client</h1>
            <span 
              className={`w-2.5 h-2.5 rounded-full ${backendConnected ? 'bg-green-600' : 'bg-red-500'}`} 
              title={backendConnected ? "Backend Online" : "Backend Offline"}
            ></span>
        </div>
      </header>

      {/* LAYOUT CONTAINER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR */}
        <aside className="w-[320px] bg-vs-panel border-r border-vs-border flex flex-col p-2 gap-2 shrink-0">
            {/* Connection Panel */}
            <div className="bg-vs-dark border border-vs-border p-3 rounded">
                <h3 className="text-xs uppercase font-bold text-gray-500 mb-2 border-b border-vs-border pb-1">Connection</h3>
                <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      className="bg-[#3c3c3c] border border-[#3c3c3c] text-white text-sm px-2 py-1.5 rounded focus:border-vs-blue focus:outline-none"
                      value={endpointUrl} 
                      onChange={(e) => setEndpointUrl(e.target.value)} 
                      placeholder="opc.tcp://..."
                      disabled={opcState.connected || opcState.isConnecting}
                    />
                    {!opcState.connected ? (
                        <button 
                            className="bg-vs-blue hover:brightness-110 text-white text-sm py-1.5 rounded disabled:bg-gray-700 disabled:cursor-not-allowed transition-all"
                            onClick={handleConnect} 
                            disabled={!backendConnected || opcState.isConnecting}
                        >
                            {opcState.isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                    ) : (
                        <button 
                          className="bg-red-700 hover:bg-red-600 text-white text-sm py-1.5 rounded transition-all" 
                          onClick={handleDisconnect}
                        >
                          Disconnect
                        </button>
                    )}
                </div>
                <div className="mt-2 text-xs">
                    {opcState.connected ? <span className="text-green-500 font-medium">● Connected</span> : <span className="text-orange-500">● Disconnected</span>}
                </div>
            </div>

            {/* Browser Panel */}
            <div className="bg-vs-dark border border-vs-border p-3 rounded flex-1 overflow-hidden flex flex-col min-h-[200px]">
                <h3 className="text-xs uppercase font-bold text-gray-500 mb-2 border-b border-vs-border pb-1 shrink-0">Address Space</h3>
                <div className="overflow-y-auto flex-1 -ml-2">
                  <NodeBrowser 
                      socket={socket} 
                      connected={opcState.connected} 
                      onSelectNode={setSelectedNode} 
                  />
                </div>
            </div>

            {/* Details Panel */}
            <div className="bg-vs-dark border border-vs-border p-3 rounded min-h-[160px]">
                <h3 className="text-xs uppercase font-bold text-gray-500 mb-2 border-b border-vs-border pb-1">Selection</h3>
                {selectedNode ? (
                <div className="text-xs space-y-1.5">
                    <div className="break-words"><strong className="text-gray-400">Name:</strong> {selectedNode.browseName}</div>
                    <div className="break-all"><strong className="text-gray-400">ID:</strong> <span className="font-mono text-cyan-300 bg-gray-800 px-1 rounded">{selectedNode.nodeId}</span></div>
                    <div><strong className="text-gray-400">Class:</strong> {selectedNode.nodeClass}</div>
                    
                    <div className="pt-2">
                        {selectedNode.nodeClass === 'Variable' && (
                        <button className="w-full bg-[#2d2d30] hover:bg-[#3e3e42] border border-vs-border text-white py-1 rounded transition-colors" onClick={handleSubscribe}>
                            + Monitor
                        </button>
                        )}
                        {(selectedNode.nodeClass === 'Object' || selectedNode.nodeClass === 'Folder') && (
                            <button className="w-full bg-[#2d2d30] hover:bg-[#3e3e42] border border-vs-border text-white py-1 rounded transition-colors" onClick={() => socket.emit('opcua-subscribe-all', selectedNode.nodeId)}>
                            + Monitor All
                            </button>
                        )}
                    </div>
                </div>
                ) : (
                <div className="text-gray-500 text-sm italic">Select a node from the browser.</div>
                )}
            </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 bg-vs-dark p-4 overflow-hidden flex flex-col">
            <MonitoredItems socket={socket} />
        </main>

      </div>

      {/* FOOTER LOGS */}
      <footer className="h-32 bg-vs-panel border-t border-vs-border flex flex-col shrink-0">
          <div className="bg-[#333] px-2 py-1 text-xs font-bold text-gray-400 shrink-0">System Logs</div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5">
             {logs.length === 0 && <span className="text-gray-600 italic">Ready.</span>}
             {logs.map((log, index) => (
               <div key={index} className="text-gray-400 border-b border-[#2d2d2d] pb-0.5">{log}</div>
             ))}
          </div>
      </footer>
    </div>
  );
}

export default App;