import { WebSocketServer } from "websockets";
import type { Page } from "../types.ts";

type WebSocketMessage = {
  type: "update";
  payload: { path: string; data: Page };
};

const getWebsocketServer = (port = 8080) => {
  const wss = new WebSocketServer(port);

  wss.on("connection", (ws) => {
    console.log("wss - Connected");

    ws.send("connected");

    ws.on("message", (message: string) => {
      const { type, payload: { path, data } }: WebSocketMessage = JSON.parse(
        message,
      );

      if (type === "update") {
        ws.send(`received ${type}`);

        Deno.writeTextFile(path, JSON.stringify(data, null, 2)).then(() =>
          ws.send(`wrote to ${path}`)
        )
          .catch((err) => ws.send(`error: ${err}`));
      }
    });
  });

  return wss;
};

const websocketClient = `const socket = new WebSocket('ws://localhost:8080');
  
socket.addEventListener('message', (event) => {
  if (event.data === 'connected') {
    console.log('WebSocket - connected');
  }
  else if (event.data === 'refresh') {
    /* TODO: What to do now? Is it better to do a partial render in the frontend? */
    /* location.reload(); */
  }
  else {
    console.log(event);
  }
});`
  .split("\n")
  .join("");

export { getWebsocketServer, websocketClient };
