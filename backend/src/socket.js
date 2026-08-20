const { Server } = require("socket.io");

let io;

module.exports = {
  // Khởi tạo Socket.io
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Chỉ định rõ URL Frontend
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      },
      transports: ["polling", "websocket"], // Cho phép tự động upgrade từ polling lên websocket
      allowEIO3: true // Đảm bảo tương thích phiên bản Engine.IO
    });

    io.on("connection", (socket) => {
      console.log("⚡ Client connected:", socket.id);

      socket.on("disconnect", (reason) => {
        console.log(`❌ Client disconnected (${socket.id}):`, reason);
      });
    });

    return io;
  },

  // Lấy instance của io để sử dụng trong Controllers
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
  },
};