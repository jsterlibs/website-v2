import { WebSocketServer } from "websockets";

const getWebsocketServer = (port = 8080) => {
  const wss = new WebSocketServer(port);

  wss.on("connection", (ws) => {
    console.log("wss - Connected");

    ws.send("connected");

    // Catch possible messages here
    /*ws.on("message", (message: string) => {
      console.log(message);
      ws.send(message);
    });*/
  });

  return wss;
};

const websocketClient = `const socket = new WebSocket('ws://localhost:8080');
  
socket.addEventListener('message', (event) => {
  if (event.data === 'connected') {
    console.log('WebSocket - connected');
  }

  if (event.data === 'refresh') {
    location.reload();
  }
});`
  .split("\n")
  .join("");

export { getWebsocketServer, websocketClient };
