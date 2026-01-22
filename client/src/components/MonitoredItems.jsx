import { useState, useEffect } from 'react';

const MonitoredItems = ({ socket }) => {
  const [items, setItems] = useState({});

  useEffect(() => {
    if (!socket) return;

    const handleValue = (data) => {
      setItems(prev => ({
        ...prev,
        [data.nodeId]: {
          ...(prev[data.nodeId] || {}),
          value: data.value,
          dataType: data.dataType,
          sourceTimestamp: data.sourceTimestamp,
          statusCode: data.statusCode
        }
      }));
    };

    const handleItemAdded = (data) => {
        setItems(prev => ({
            ...prev,
            [data.nodeId]: {
                ...(prev[data.nodeId] || {}),
                displayName: data.displayName,
                value: prev[data.nodeId]?.value || 'Waiting...'
            }
        }));
    };

    const handleActiveSubs = (subsList) => {
        const newItems = {};
        subsList.forEach(sub => {
            newItems[sub.nodeId] = { 
                displayName: sub.displayName,
                value: 'Waiting...',
                timestamp: null 
            };
        });
        setItems(prev => ({ ...newItems, ...prev }));
    };

    socket.on('opcua-value', handleValue);
    socket.on('opcua-item-added', handleItemAdded);
    socket.on('active-subscriptions', handleActiveSubs);

    return () => {
      socket.off('opcua-value', handleValue);
      socket.off('opcua-item-added', handleItemAdded);
      socket.off('active-subscriptions', handleActiveSubs);
    };
  }, [socket]);

  const handleUnsubscribe = (nodeId) => {
    socket.emit('opcua-unsubscribe', nodeId);
    setItems(prev => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
    });
  };

  const renderValue = (val) => {
    if (val === null || val === undefined) return "null";
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'number') {
        if (!Number.isInteger(val)) return val.toFixed(4);
    }
    return val.toString();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-lg font-medium text-gray-200">Real-Time Data</h3>
          <span className="bg-[#333] px-2 py-0.5 rounded-full text-xs text-gray-400 font-mono">
              {Object.keys(items).length} Items
          </span>
      </div>
      
      {Object.keys(items).length === 0 ? (
        <div className="flex-1 flex items-center justify-center border border-vs-border border-dashed rounded bg-vs-panel bg-opacity-30">
            <p className="text-gray-500">No items monitored. Use the browser to subscribe.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto border border-vs-border bg-vs-panel rounded relative">
            <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#333] text-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-2 font-semibold w-1/5">Name</th>
                    <th className="p-2 font-semibold w-1/5">Value</th>
                    <th className="p-2 font-semibold w-1/4">Node ID</th>
                    <th className="p-2 font-semibold w-1/6">Timestamp</th>
                    <th className="p-2 font-semibold w-1/12">Quality</th>
                    <th className="p-2 w-12 text-center"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-vs-border">
                {Object.entries(items).map(([nodeId, data]) => (
                <tr key={nodeId} className="hover:bg-[#2a2d2e] transition-colors">
                    <td className="p-2 text-cyan-300 font-medium truncate max-w-[200px]" title={data.displayName}>
                        {data.displayName || nodeId}
                    </td>
                    <td className="p-2 font-mono text-[#ce9178] truncate max-w-[200px]">
                        {renderValue(data.value)}
                    </td>
                    <td className="p-2 font-mono text-gray-500 text-xs truncate max-w-[250px]" title={nodeId}>
                        {nodeId}
                    </td>
                    <td className="p-2 text-gray-400 text-xs">
                        {data.sourceTimestamp ? new Date(data.sourceTimestamp).toLocaleTimeString() : '-'}
                    </td>
                    <td className="p-2">
                        <span className={`status-badge ${
                            data.statusCode && data.statusCode.toString().startsWith('Good') ? 'good' : 'bad'
                        }`}>
                            {data.statusCode || '-'}
                        </span>
                    </td>
                    <td className="p-2 text-center">
                    <button 
                        className="text-gray-500 hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-white/5" 
                        onClick={() => handleUnsubscribe(nodeId)} 
                        title="Unsubscribe"
                    >
                        ✕
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default MonitoredItems;
