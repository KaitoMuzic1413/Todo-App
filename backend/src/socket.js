const { Server } = require("socket.io");

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      },
      transports: ["polling", "websocket"],
      allowEIO3: true
    });

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("disconnect", (reason) => {
        console.log(`Client disconnected (${socket.id}):`, reason);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io wasn't created!");
    }
    return io;
  },
};