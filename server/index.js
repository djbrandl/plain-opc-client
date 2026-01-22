const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OPCUAClient, AttributeIds, ClientSubscription, ClientMonitoredItem, TimestampsToReturn, NodeClass } = require('node-opcua');
const cors = require('cors');

const app = express();
app.use(cors());

// Load Config
const config = require('../server_config.json');
const PORT = process.env.PORT || config.port || 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity in this demo
    methods: ["GET", "POST"]
  }
});

// Global state
let opcClient = null;
let opcSession = null;
let opcSubscription = null;
let currentEndpoint = null;
let isConnecting = false;
const monitoredItems = new Map(); // nodeId -> ClientMonitoredItem

async function disconnectOPCUA() {
  if (opcSubscription) {
    try {
      await opcSubscription.terminate();
    } catch (err) {
      console.error("Error terminating subscription:", err.message);
    }
    opcSubscription = null;
  }
  
  monitoredItems.clear();

  if (opcSession) {
    try {
      await opcSession.close();
    } catch (err) {
      console.error("Error closing session:", err.message);
    }
    opcSession = null;
  }
  if (opcClient) {
    try {
      await opcClient.disconnect();
    } catch (err) {
      console.error("Error disconnecting client:", err.message);
    }
    opcClient = null;
  }
  currentEndpoint = null;
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current status
  socket.emit('connection-status', {
    connected: !!opcSession,
    endpoint: currentEndpoint,
    isConnecting: isConnecting
  });

  // Re-send active subscriptions to new client if they exist
  if (monitoredItems.size > 0) {
      const activeSubs = Array.from(monitoredItems.values()).map(item => ({
          nodeId: item.itemToMonitor.nodeId.toString(),
          displayName: item.displayName || item.itemToMonitor.nodeId.toString()
      }));
      socket.emit('active-subscriptions', activeSubs);
  }

  socket.on('opcua-connect', async (endpointUrl) => {
    if (isConnecting) return;
    
    if (opcSession && currentEndpoint === endpointUrl) {
      socket.emit('log', 'Already connected to this endpoint.');
      return;
    }

    if (opcSession) {
      io.emit('log', 'Disconnecting from previous server...');
      await disconnectOPCUA();
    }

    isConnecting = true;
    currentEndpoint = endpointUrl;
    io.emit('connection-status', { connected: false, endpoint: currentEndpoint, isConnecting: true });
    io.emit('log', `Connecting to ${endpointUrl}...`);

    try {
      opcClient = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 1 }
      });

      opcClient.on("backoff", (retry, delay) => {
        io.emit('log', `Connection failed, retrying (${retry})...`);
      });

      await opcClient.connect(endpointUrl);
      io.emit('log', 'Connected to client, creating session...');
      
      opcSession = await opcClient.createSession();
      io.emit('log', 'Session created successfully.');

      // Create a subscription
      opcSubscription = await opcSession.createSubscription2({
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
      });
      io.emit('log', 'Subscription created.');
      
      isConnecting = false;
      io.emit('connection-status', { connected: true, endpoint: currentEndpoint, isConnecting: false });

    } catch (err) {
      console.error("Connection Error:", err.message);
      io.emit('log', `Error: ${err.message}`);
      await disconnectOPCUA();
      isConnecting = false;
      io.emit('connection-status', { connected: false, endpoint: null, isConnecting: false });
    }
  });

  socket.on('opcua-disconnect', async () => {
    io.emit('log', 'Disconnecting...');
    await disconnectOPCUA();
    io.emit('log', 'Disconnected.');
    io.emit('connection-status', { connected: false, endpoint: null, isConnecting: false });
  });

  socket.on('opcua-browse', async (nodeId) => {
      if (!opcSession) {
        socket.emit('log', 'Browse failed: No session');
        return;
      }
      
      const nodeToBrowse = nodeId || "RootFolder";
      console.log(`Browsing node: "${nodeToBrowse}"`);

      try {
          const browseResult = await opcSession.browse(nodeToBrowse);
          
          console.log(`Browsing "${nodeToBrowse}" returned ${browseResult.references.length} references.`);

          const nodes = browseResult.references.map(ref => {
              // Log raw reference for debugging if needed
              // console.log(`  - Ref: ${ref.browseName.toString()} (${ref.nodeId.toString()})`);
              
              return {
                  nodeId: ref.nodeId.toString(),
                  browseName: ref.browseName.name ? ref.browseName.name.toString() : ref.browseName.toString(),
                  nodeClass: NodeClass[ref.nodeClass] ? NodeClass[ref.nodeClass].toString() : "Unspecified", 
                  typeDefinition: ref.typeDefinition.toString()
              };
          });
          
          socket.emit('browse-result', { parentId: nodeId, nodes });
      } catch (err) {
          console.error(`Browse Error for "${nodeToBrowse}":`, err.message);
          socket.emit('log', `Browse Error: ${err.message}`);
      }
  });

  socket.on('opcua-subscribe', async (data) => {
      const nodeId = typeof data === 'string' ? data : data.nodeId;
      const name = typeof data === 'string' ? null : data.name;

      if (!opcSession || !opcSubscription) {
          socket.emit('log', 'Cannot subscribe: No active session/subscription.');
          return;
      }
      await subscribeToNode(nodeId, socket, name);
  });

  socket.on('opcua-subscribe-all', async (parentNodeId) => {
      if (!opcSession) return;
      socket.emit('log', `Browsing ${parentNodeId} to subscribe all...`);
      
      try {
          const browseResult = await opcSession.browse(parentNodeId);
          let count = 0;
          
          for (const ref of browseResult.references) {
              if (ref.nodeClass === NodeClass.Variable) {
                   // Use browseName from reference
                   const name = ref.browseName.name ? ref.browseName.name.toString() : ref.browseName.toString();
                   await subscribeToNode(ref.nodeId.toString(), socket, name);
                   count++;
              }
          }
          socket.emit('log', `Subscribed to ${count} items in ${parentNodeId}`);

      } catch (err) {
          console.error("Subscribe All Error:", err.message);
          socket.emit('log', `Subscribe All Error: ${err.message}`);
      }
  });

  async function subscribeToNode(nodeId, socket, providedName = null) {
      if (monitoredItems.has(nodeId)) {
          return;
      }

      try {
          // If name not provided, try to read it, otherwise fallback to NodeId
          let displayName = providedName;
          if (!displayName) {
             try {
                 const dataValue = await opcSession.read({ nodeId, attributeId: AttributeIds.DisplayName });
                 if (dataValue.statusCode.isGood()) {
                     displayName = dataValue.value.value.text;
                 }
             } catch (e) {
                 // ignore read error
             }
          }
          displayName = displayName || nodeId;

          const item = ClientMonitoredItem.create(
              opcSubscription,
              {
                  nodeId: nodeId,
                  attributeId: AttributeIds.Value
              },
              {
                  samplingInterval: 1000,
                  discardOldest: true,
                  queueSize: 10
              },
              TimestampsToReturn.Both
          );

          item.on("changed", (dataValue) => {
              io.emit('opcua-value', {
                  nodeId: nodeId,
                  value: dataValue.value.value,
                  dataType: dataValue.value.dataType,
                  sourceTimestamp: dataValue.sourceTimestamp,
                  statusCode: dataValue.statusCode.toString()
              });
          });

          // Store extra metadata
          item.displayName = displayName;

          monitoredItems.set(nodeId, item);
          
          // Notify client of new subscription metadata
          io.emit('opcua-item-added', { nodeId, displayName });
          
      } catch (err) {
          console.error(`Failed to subscribe to ${nodeId}:`, err.message);
          socket.emit('log', `Failed to subscribe to ${nodeId}: ${err.message}`);
      }
  }

  socket.on('opcua-unsubscribe', async (nodeId) => {
      if (monitoredItems.has(nodeId)) {
          const item = monitoredItems.get(nodeId);
          await item.terminate();
          monitoredItems.delete(nodeId);
          io.emit('log', `Unsubscribed from ${nodeId}`);
      }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});