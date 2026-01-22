const { OPCUAClient } = require('node-opcua');

const ENDPOINT_URL = "opc.tcp://opcuaserver.com:48010";

async function main() {
    const client = OPCUAClient.create({ endpointMustExist: false });
    try {
        await client.connect(ENDPOINT_URL);
        console.log("Connected to", ENDPOINT_URL);
        const session = await client.createSession();
        
        console.log("Browsing RootFolder...");
        const rootResult = await session.browse("RootFolder");
        
        rootResult.references.forEach(ref => {
            console.log(`Node: ${ref.browseName.toString()}`);
            console.log(` - NodeId: ${ref.nodeId.toString()}`);
            console.log(` - NodeClass (Raw): ${ref.nodeClass}`);
            console.log(` - NodeClass (String): ${ref.nodeClass.toString()}`);
        });

        await session.close();
        await client.disconnect();
    } catch (err) {
        console.error("Error:", err.message);
    }
}
main();